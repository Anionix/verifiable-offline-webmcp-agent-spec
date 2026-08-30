// information_uuid_v5=eeccc01c-0134-5420-9946-9efe2adbb772
// event_uuid_v7=01a05044-13e6-7415-b86e-0a3c1ef4634d
// state_transition=PARENT_RECHECK_INSUFFICIENT -> RETAINED_PARENT_WORKING_DIRECTORY_CREATION occurred_at=2026-08-30T01:23:53.958Z
// machine-contract: the caller holds the reviewed parent descriptor until this fixed child exits; the child compares its current directory with that descriptor's exact identity before creating only single-component names. It never changes directory or falls back to an absolute creation path.
// information_uuid_v5=e8dfa4b3-a12e-5e5c-b5b0-f0c5f879d8b2
// event_uuid_v7=01a050d9-b310-759a-8f13-ba61b21f506e
// state_transition=PATH_BOUND_CREATE_RACE -> DESCRIPTOR_VERIFIED_CHILD_CREATE occurred_at=2026-08-30T04:07:24.050Z
// machine-contract: a missing-file callback may replace the named parent, but creation never starts until a child has inherited the still-open parent descriptor and proved that its already-established working directory has the same device and inode.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { closeSync, constants, fstatSync, linkSync, lstatSync, openSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type NotificationStorageKind = "audit" | "database";

export const STORAGE_CONFIG = {
  audit: {
    filename: /^[A-Za-z0-9][A-Za-z0-9._-]{0,126}\.ndjson$/,
    filenameMessage: "audit path must end in a simple .ndjson filename",
  },
  database: {
    filename: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.sqlite$/,
    filenameMessage: "database path must end in a simple .sqlite filename",
  },
} as const;

interface StorageCreationRequest {
  kind: NotificationStorageKind;
  filename: string;
  parentDev: string;
  parentIno: string;
  windowsPublication: boolean;
}

interface StorageCreationReceipt {
  dev: string;
  ino: string;
}

function parseRequest(value: unknown): StorageCreationRequest {
  if (typeof value !== "object" || value === null) throw new TypeError("invalid storage creation request");
  const request = value as Partial<StorageCreationRequest>;
  if (request.kind !== "audit" && request.kind !== "database") throw new TypeError("invalid storage kind");
  if (typeof request.filename !== "string" || !STORAGE_CONFIG[request.kind].filename.test(request.filename)) {
    throw new TypeError(STORAGE_CONFIG[request.kind].filenameMessage);
  }
  if (
    typeof request.parentDev !== "string" ||
    !/^\d{1,30}$/.test(request.parentDev) ||
    typeof request.parentIno !== "string" ||
    !/^\d{1,30}$/.test(request.parentIno) ||
    typeof request.windowsPublication !== "boolean"
  )
    throw new TypeError("invalid storage parent identity");
  return request as StorageCreationRequest;
}

/** Runs only in an isolated child whose current directory never changes. The callback is an in-process test seam, never a serialized request field. */
export function createStorageFileInWorkingDirectory(value: unknown, afterParentValidated?: () => void): StorageCreationReceipt {
  const request = parseRequest(value);
  const parent = statSync(".", { bigint: true });
  if (!parent.isDirectory() || parent.dev.toString() !== request.parentDev || parent.ino.toString() !== request.parentIno) {
    throw new TypeError(`${request.kind} parent changed before bound creation`);
  }
  // POSIX resolves every basename against the kernel-held current directory even after rename.
  // Windows locks the current directory against rename/move/delete; it is NOT an openat claim.
  afterParentValidated?.();
  const windowsPublication = process.platform === "win32" || request.windowsPublication;
  const stagingName = windowsPublication ? `.${request.filename}.${randomBytes(16).toString("hex")}.tmp` : null;
  let descriptor: number | null = null;
  let staged = false;
  try {
    descriptor = openSync(
      stagingName ?? request.filename,
      constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | (process.platform === "win32" ? 0 : constants.O_NOFOLLOW),
      0o600,
    );
    staged = stagingName !== null;
    if (stagingName !== null) {
      linkSync(stagingName, request.filename);
      unlinkSync(stagingName);
      staged = false;
    }
    const created = fstatSync(descriptor, { bigint: true });
    if (!created.isFile() || created.nlink !== 1n) throw new TypeError(`${request.kind} created path must be a single-link regular file`);
    return { dev: created.dev.toString(), ino: created.ino.toString() };
  } catch (error) {
    if (["EEXIST", "ELOOP"].includes((error as NodeJS.ErrnoException).code ?? "")) {
      throw new TypeError(`${request.kind} path changed during exclusive publication`, { cause: error });
    }
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    // Cleanup is bound to the same current directory, including when publication fails.
    if (staged && stagingName !== null) unlinkSync(stagingName);
  }
}

/** No inherited startup hooks, shell, caller-selected program, or pathname-creation fallback. */
export function createStorageFileAtRetainedParent(
  parentPath: string,
  parentDescriptor: number,
  filename: string,
  kind: NotificationStorageKind,
  platform: NodeJS.Platform,
): StorageCreationReceipt {
  const parent = fstatSync(parentDescriptor, { bigint: true });
  const request: StorageCreationRequest = {
    kind,
    filename,
    parentDev: parent.dev.toString(),
    parentIno: parent.ino.toString(),
    windowsPublication: platform === "win32",
  };
  const environment: NodeJS.ProcessEnv = {};
  // Keep property names fixed; only the platform-provided values are inherited.
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT;
  const windowsDirectory = process.env.WINDIR ?? process.env.windir;
  if (systemRoot !== undefined) environment.SystemRoot = systemRoot;
  if (windowsDirectory !== undefined) environment.WINDIR = windowsDirectory;
  try {
    const namedParent = lstatSync(parentPath, { bigint: true });
    if (namedParent.isSymbolicLink() || !namedParent.isDirectory() || namedParent.dev !== parent.dev || namedParent.ino !== parent.ino) {
      throw new TypeError(`${kind} parent changed before bound creation`);
    }
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError(`${kind} bound creation helper failed`, { cause: error });
  }
  environment.STORAGE_CREATE_PARENT_FD = "3";
  // Pass the still-open parent descriptor to the child. The child starts with
  // the reviewed directory as its working directory, compares that directory
  // with descriptor 3 before creating, and then uses only a basename. The
  // pathname is therefore resolved once while the descriptor remains live;
  // a later rename cannot redirect the relative create to a replacement.
  let child;
  try {
    child = spawnSync(process.execPath, ["--experimental-strip-types", fileURLToPath(import.meta.url)], {
      cwd: parentPath,
      env: environment,
      input: JSON.stringify(request),
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 10_000,
      killSignal: "SIGKILL",
      stdio: ["pipe", "pipe", "pipe", parentDescriptor],
    });
  } catch (error) {
    throw new TypeError(`${kind} bound creation helper failed`, { cause: error });
  }
  if (child.error || child.signal) throw new TypeError(`${kind} bound creation helper failed`, { cause: child.error });
  let receipt: { ok?: boolean; dev?: unknown; ino?: unknown; message?: unknown };
  try {
    receipt = JSON.parse(child.stdout) as typeof receipt;
  } catch (error) {
    throw new TypeError(`${kind} bound creation helper returned no valid receipt`, { cause: error });
  }
  if (child.status !== 0 || receipt.ok !== true) {
    throw new TypeError(typeof receipt.message === "string" ? receipt.message : `${kind} bound creation failed`);
  }
  if (typeof receipt.dev !== "string" || !/^\d{1,30}$/.test(receipt.dev) || typeof receipt.ino !== "string" || !/^\d{1,30}$/.test(receipt.ino)) {
    throw new TypeError(`${kind} bound creation helper returned an invalid identity`);
  }
  // This receipt is a creation observation, not a transferred or still-open file descriptor.
  return { dev: receipt.dev, ino: receipt.ino };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.env.STORAGE_CREATE_PARENT_FD === "3") {
  try {
    const request = JSON.parse(readFileSync(0, "utf8"));
    const parent = fstatSync(3, { bigint: true });
    const current = statSync(".", { bigint: true });
    if (!parent.isDirectory() || !current.isDirectory() || parent.dev !== current.dev || parent.ino !== current.ino) {
      throw new TypeError("storage parent changed before bound creation");
    }
    const receipt = createStorageFileInWorkingDirectory(request);
    process.stdout.write(JSON.stringify({ ok: true, ...receipt }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : "bound storage creation failed" }));
    process.exitCode = 1;
  }
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const receipt = createStorageFileInWorkingDirectory(JSON.parse(readFileSync(0, "utf8")));
    process.stdout.write(JSON.stringify({ ok: true, ...receipt }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : "bound storage creation failed" }));
    process.exitCode = 1;
  }
}

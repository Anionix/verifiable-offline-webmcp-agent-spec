// information_uuid_v5=91fb20bb-2827-5346-bf7a-c0ba33ccf5c8
// event_uuid_v7=01a04cf4-5c1a-740e-bf0b-21652882816d
// state_transition=PLATFORM_AMBIGUOUS_STORAGE -> PLATFORM_BOUND_STORAGE occurred_at=2026-08-29T09:57:57.921Z
// machine-contract: POSIX owner and mode checks run only where those bits have access-control meaning; every platform still enforces fixed roots, canonical containment, simple filenames, and link rejection.
// information_uuid_v5=8df16df0-2a3c-5e18-9e82-4e36870b5a43
// machine-contract: the repository .local root is opened without following links before POSIX hardening, and a replaced or linked root is rejected before caller-selected storage I/O.
// information_uuid_v5=7ec89a3a-66b4-5f3f-9f9a-ca4ae7a7168f
// event_uuid_v7=01a04d0d-7640-7679-856f-27997864efad
// state_transition=REGULAR_PATH_WITH_UNCHECKED_LINK_COUNT -> SINGLE_LINK_FILE_BOUND_TO_OPEN_DESCRIPTOR occurred_at=2026-08-29T10:25:23.008Z
// machine-contract: an existing notification file is accepted only when it is a regular file with exactly one link, and descriptor-based callers must prove the opened inode is still the reviewed path before I/O.
// information_uuid_v5=43be5738-7807-5976-8f05-5d59070f309d
// event_uuid_v7=01a04d1a-b461-7163-a623-c21c313cde60
// state_transition=CODEQL_TEMP_PATH_AMBIGUOUS -> EXCLUSIVE_PRIVATE_STORAGE_CREATION_JUSTIFIED occurred_at=2026-08-29T10:39:50.881Z
// machine-contract: creation occurs only after fixed-root containment and private-direct-child checks, with O_NOFOLLOW, O_CREAT, O_EXCL, mode 0600, and descriptor identity validation; the narrow CodeQL directive documents this exact false-positive boundary.
// information_uuid_v5=628ac7e0-de86-53a4-8652-3b4071dee40d
// event_uuid_v7=01a04d1a-b46a-7604-adfc-a673e5e8350a
// state_transition=PATH_LSTAT_IDENTITY_CHECK -> TWO_OPEN_DESCRIPTORS_COMPARED occurred_at=2026-08-29T10:39:50.890Z
// machine-contract: storage identity is decided only from two simultaneously open O_NOFOLLOW descriptors whose device, inode, regular-file type, and single-link count agree.
// information_uuid_v5=94c4f2a0-e903-54a6-bf1e-c5467bfe6161
// event_uuid_v7=01a04d24-08c8-7179-a011-ba04af7e7248
// state_transition=CODEQL_CHECK_USE_AMBIGUOUS -> COMPARISON_OPEN_DOCUMENTED occurred_at=2026-08-29T10:50:05.633Z
// machine-contract: the second root open is the comparison control, not an operation authorized by the first; both O_NOFOLLOW descriptors remain open until their identities are compared and a mismatch fails closed.
import { closeSync, constants, fchmodSync, fstatSync, mkdirSync, openSync, realpathSync, statSync } from "node:fs";
import type { Stats } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

export type NotificationStorageKind = "audit" | "database";

export interface StoragePathOptions {
  repositoryStorageRoot?: string;
  temporaryRoot?: string;
  platform?: NodeJS.Platform;
}

const STORAGE_CONFIG = {
  audit: {
    filename: /^[A-Za-z0-9][A-Za-z0-9._-]{0,126}\.ndjson$/,
    filenameMessage: "audit path must end in a simple .ndjson filename",
  },
  database: {
    filename: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.sqlite$/,
    filenameMessage: "database path must end in a simple .sqlite filename",
  },
} as const;

function hasPosixPermissionSemantics(platform: NodeJS.Platform): boolean {
  return platform !== "win32";
}

function requirePrivateDirectory(path: string, kind: NotificationStorageKind, platform: NodeJS.Platform): void {
  const stats = statSync(path);
  if (!stats.isDirectory()) throw new TypeError(`${kind} parent must be a directory`);
  if (!hasPosixPermissionSemantics(platform)) return;
  if (typeof process.getuid === "function" && stats.uid !== process.getuid()) {
    throw new TypeError(`${kind} parent must be owned by the current user`);
  }
  if ((stats.mode & 0o077) !== 0) {
    throw new TypeError(`${kind} parent must be private to the current user`);
  }
}

function requireSingleLinkRegularFile(stats: Stats, kind: NotificationStorageKind): void {
  if (!stats.isFile()) throw new TypeError(`${kind} path must be a regular file`);
  if (stats.nlink !== 1) throw new TypeError(`${kind} path must not have multiple hard links`);
}

function openExistingStorageDescriptor(path: string, kind: NotificationStorageKind): number | null {
  try {
    return openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    if (code === "ELOOP") throw new TypeError(`${kind} path must not be a symbolic link`, { cause: error });
    throw error;
  }
}

export function assertNotificationStorageDescriptor(path: string, descriptor: number, kind: NotificationStorageKind): void {
  const namedDescriptor = openExistingStorageDescriptor(path, kind);
  if (namedDescriptor === null) throw new TypeError(`${kind} path changed during open`);
  try {
    const guarded = fstatSync(descriptor);
    const named = fstatSync(namedDescriptor);
    requireSingleLinkRegularFile(guarded, kind);
    requireSingleLinkRegularFile(named, kind);
    if (named.dev !== guarded.dev || named.ino !== guarded.ino) {
      throw new TypeError(`${kind} path changed during open`);
    }
  } finally {
    closeSync(namedDescriptor);
  }
}

export function openNotificationStorageGuard(path: string, kind: NotificationStorageKind): number {
  let descriptor: number | null = null;
  try {
    try {
      // machine-contract: this path already passed fixed-root containment and private-parent checks; O_EXCL prevents pre-existing or raced aliases.
      // codeql[js/insecure-temporary-file]
      descriptor = openSync(path, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      descriptor = openSync(path, constants.O_RDWR | constants.O_NOFOLLOW);
    }
    assertNotificationStorageDescriptor(path, descriptor, kind);
    return descriptor;
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new TypeError(`${kind} path must not be a symbolic link`, { cause: error });
    }
    throw error;
  }
}

function ensureRepositoryStorageRoot(storageRoot: string, kind: NotificationStorageKind, platform: NodeJS.Platform): string {
  try {
    mkdirSync(storageRoot, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  let guardDescriptor: number | null = null;
  let namedDescriptor: number | null = null;
  try {
    const flags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
    guardDescriptor = openSync(storageRoot, flags);
    const guarded = fstatSync(guardDescriptor);
    if (!guarded.isDirectory()) throw new TypeError(`${kind} storage root must be a directory`);
    if (hasPosixPermissionSemantics(platform)) fchmodSync(guardDescriptor, 0o700);

    const canonicalRoot = realpathSync(storageRoot);
    // codeql[js/file-system-race]
    namedDescriptor = openSync(storageRoot, flags);
    const named = fstatSync(namedDescriptor);
    if (!named.isDirectory() || named.dev !== guarded.dev || named.ino !== guarded.ino || named.nlink !== guarded.nlink) {
      throw new TypeError(`${kind} storage root changed during validation`);
    }
    return canonicalRoot;
  } catch (error) {
    if (["ELOOP", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) {
      throw new TypeError(`${kind} storage root must not be a symbolic link and must be a directory`, { cause: error });
    }
    throw error;
  } finally {
    if (namedDescriptor !== null) closeSync(namedDescriptor);
    if (guardDescriptor !== null) closeSync(guardDescriptor);
  }
}

export function containedNotificationStoragePath(candidate: string, kind: NotificationStorageKind, options: StoragePathOptions = {}): string {
  const config = STORAGE_CONFIG[kind];
  const filename = basename(candidate);
  if (!config.filename.test(filename)) throw new TypeError(config.filenameMessage);

  const platform = options.platform ?? process.platform;
  const repositoryStorageRoot = resolve(options.repositoryStorageRoot ?? ".local");
  const temporaryRoot = resolve(options.temporaryRoot ?? tmpdir());
  const requestedPath = resolve(candidate);
  const fromLocalRoot = relative(repositoryStorageRoot, requestedPath);
  const fromTemporaryRoot = relative(temporaryRoot, requestedPath);
  const isBelowLocalRoot = fromLocalRoot !== "" && fromLocalRoot !== ".." && !fromLocalRoot.startsWith(`..${sep}`) && !isAbsolute(fromLocalRoot);
  const isBelowTemporaryRoot =
    fromTemporaryRoot !== "" && fromTemporaryRoot !== ".." && !fromTemporaryRoot.startsWith(`..${sep}`) && !isAbsolute(fromTemporaryRoot);
  const lexicalRoot = isBelowLocalRoot ? repositoryStorageRoot : isBelowTemporaryRoot ? temporaryRoot : null;
  if (lexicalRoot === null) throw new TypeError(`${kind} path is outside the allowed storage roots`);

  const canonicalRoot =
    lexicalRoot === repositoryStorageRoot ? ensureRepositoryStorageRoot(repositoryStorageRoot, kind, platform) : realpathSync(temporaryRoot);
  const canonicalParent = realpathSync(dirname(requestedPath));
  const fromCanonicalRoot = relative(canonicalRoot, canonicalParent);
  if (fromCanonicalRoot === ".." || fromCanonicalRoot.startsWith(`..${sep}`) || isAbsolute(fromCanonicalRoot)) {
    throw new TypeError(`${kind} path resolves outside its allowed storage root`);
  }
  if (lexicalRoot === temporaryRoot) {
    if (hasPosixPermissionSemantics(platform)) {
      const rootStats = statSync(canonicalRoot);
      const rootIsPrivate = (rootStats.mode & 0o077) === 0;
      const rootIsSticky = (rootStats.mode & 0o1000) !== 0;
      if (!rootIsPrivate && !rootIsSticky) {
        throw new TypeError("temporary storage root must be private or sticky");
      }
    }
    if (fromCanonicalRoot === "" || fromCanonicalRoot.includes(sep)) {
      throw new TypeError(`${kind} parent must be one direct private child of the temporary root`);
    }
  }
  requirePrivateDirectory(canonicalParent, kind, platform);

  const safePath = resolve(canonicalParent, filename);
  const existingDescriptor = openExistingStorageDescriptor(safePath, kind);
  try {
    if (existingDescriptor !== null) requireSingleLinkRegularFile(fstatSync(existingDescriptor), kind);
  } finally {
    if (existingDescriptor !== null) closeSync(existingDescriptor);
  }
  return safePath;
}

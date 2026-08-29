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
import { closeSync, constants, fchmodSync, fstatSync, lstatSync, mkdirSync, openSync, realpathSync, statSync } from "node:fs";
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

export function assertNotificationStorageDescriptor(path: string, descriptor: number, kind: NotificationStorageKind): void {
  const opened = fstatSync(descriptor);
  requireSingleLinkRegularFile(opened, kind);
  const named = lstatSync(path);
  if (named.isSymbolicLink()) throw new TypeError(`${kind} path must not be a symbolic link`);
  requireSingleLinkRegularFile(named, kind);
  if (named.dev !== opened.dev || named.ino !== opened.ino) {
    throw new TypeError(`${kind} path changed during open`);
  }
}

export function openNotificationStorageGuard(path: string, kind: NotificationStorageKind): number {
  let descriptor: number | null = null;
  try {
    try {
      descriptor = openSync(path, constants.O_RDWR | constants.O_NOFOLLOW);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      descriptor = openSync(path, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
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

  const before = lstatSync(storageRoot);
  if (before.isSymbolicLink()) {
    throw new TypeError(`${kind} storage root must not be a symbolic link`);
  }
  if (!before.isDirectory()) throw new TypeError(`${kind} storage root must be a directory`);

  if (hasPosixPermissionSemantics(platform)) {
    let descriptor: number | null = null;
    try {
      descriptor = openSync(storageRoot, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const opened = fstatSync(descriptor);
      if (!opened.isDirectory()) throw new TypeError(`${kind} storage root must be a directory`);
      fchmodSync(descriptor, 0o700);
      const after = lstatSync(storageRoot);
      if (after.isSymbolicLink() || !after.isDirectory() || after.dev !== opened.dev || after.ino !== opened.ino) {
        throw new TypeError(`${kind} storage root changed during validation`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ELOOP") {
        throw new TypeError(`${kind} storage root must not be a symbolic link`, { cause: error });
      }
      throw error;
    } finally {
      if (descriptor !== null) closeSync(descriptor);
    }
  }

  return realpathSync(storageRoot);
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
  try {
    const existing = lstatSync(safePath);
    if (existing.isSymbolicLink()) {
      throw new TypeError(`${kind} path must not be a symbolic link`);
    }
    requireSingleLinkRegularFile(existing, kind);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return safePath;
}

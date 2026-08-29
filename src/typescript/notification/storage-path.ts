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
// machine-contract: creation occurs only after fixed-root containment and private-direct-child checks, with O_NOFOLLOW, O_CREAT, O_EXCL, mode 0600, and descriptor identity validation.
// information_uuid_v5=628ac7e0-de86-53a4-8652-3b4071dee40d
// event_uuid_v7=01a04d1a-b46a-7604-adfc-a673e5e8350a
// state_transition=PATH_LSTAT_IDENTITY_CHECK -> TWO_OPEN_DESCRIPTORS_COMPARED occurred_at=2026-08-29T10:39:50.890Z
// machine-contract: storage identity is decided only from two simultaneously open O_NOFOLLOW descriptors whose device, inode, regular-file type, and single-link count agree.
// information_uuid_v5=94c4f2a0-e903-54a6-bf1e-c5467bfe6161
// event_uuid_v7=01a04d24-08c8-7179-a011-ba04af7e7248
// state_transition=CODEQL_CHECK_USE_AMBIGUOUS -> COMPARISON_OPEN_DOCUMENTED occurred_at=2026-08-29T10:50:05.633Z
// machine-contract: the second root open is the comparison control, not an operation authorized by the first; both O_NOFOLLOW descriptors remain open until their identities are compared and a mismatch fails closed.
// information_uuid_v5=99fe8c38-06b1-5b9a-9372-89c4f64b382a
// event_uuid_v7=01a04d2b-e1fe-7097-808d-814578e6836f
// state_transition=REPEATED_INLINE_PATH_OPEN -> SHARED_NONFOLLOW_DESCRIPTOR_OPEN occurred_at=2026-08-29T10:58:47.110Z
// machine-contract: every storage-root descriptor is obtained through one non-following directory-open boundary; two returned descriptors stay open until identity comparison, so neither path observation authorizes later file I/O.
// information_uuid_v5=0540c151-d37d-5b5e-83a4-5032033c34e3
// event_uuid_v7=01a04d40-5d78-789e-90ff-3e02d9cf0045
// state_transition=WINDOWS_LINK_TARGET_ACCEPTED -> NAMED_LINK_REJECTED_AND_DESCRIPTOR_BOUND occurred_at=2026-08-29T11:20:59.000Z
// machine-contract: Windows does not gain link rejection from O_NOFOLLOW, so every accepted root or storage file must also be a non-link lstat entry whose identity matches the still-open descriptors before any bytes are read or written.
// information_uuid_v5=122a2c58-92fc-5cd7-bb62-f46948d45a5d
// event_uuid_v7=01a04d47-a0d8-7ba5-9dde-01bf920d3fc4
// state_transition=OVERBROAD_STORAGE_CLAIM -> FINAL_LINK_SCOPE_EXPLICIT occurred_at=2026-08-29T11:28:55.000Z
// machine-contract: final-name proof does not claim to solve concurrent parent replacement or to expose SQLite's internal handle; those independent boundaries remain fail-open risks tracked separately.
// information_uuid_v5=77d013eb-4de8-5cee-9ad6-80d2caf3566e
// event_uuid_v7=01a04d54-cedc-7a4a-8fab-4b84061d412d
// state_transition=DANGLING_LINK_MISTAKEN_FOR_ABSENT_FILE -> NAMED_ENTRY_REJECTED_BEFORE_EXCLUSIVE_CREATE occurred_at=2026-08-29T11:43:18.748Z
// machine-contract: ENOENT means a storage file is absent only when lstat also finds no named entry; writable guards create exclusively, then bind the still-open descriptor to the reviewed name before any bytes are written.
// information_uuid_v5=88edc2ed-d5db-5ebf-b557-ea6cee221669
// event_uuid_v7=01a04d5a-11db-7e3a-b13e-96c11c361add
// state_transition=WINDOWS_CREATE_NEW_FOLLOWS_REPARSE_POINT -> RANDOM_STAGE_HARDLINK_PUBLISH occurred_at=2026-08-29T11:49:03.579Z
// machine-contract: Windows never applies O_CREAT to the caller-selected final name; a 128-bit random staging file is opened first, then link publishes it only if the final directory entry is absent, and the open descriptor is identity-bound after the staging name is removed.
import { randomBytes } from "node:crypto";
import { closeSync, constants, fchmodSync, fstatSync, linkSync, lstatSync, mkdirSync, openSync, realpathSync, statSync, unlinkSync } from "node:fs";
import type { Stats } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export type NotificationStorageKind = "audit" | "database";

export interface StoragePathOptions {
  repositoryStorageRoot?: string;
  temporaryRoot?: string;
  platform?: NodeJS.Platform;
}

export interface StorageDescriptorOptions {
  platform?: NodeJS.Platform;
  /** Deterministic test seam at the final-name absence/publication boundary. */
  afterStorageAbsenceObserved?: (path: string) => void;
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

function noFollowFlag(platform: NodeJS.Platform): number {
  return platform === "win32" ? 0 : constants.O_NOFOLLOW;
}

function requireNamedStorageFile(path: string, kind: NotificationStorageKind): Stats {
  const named = lstatSync(path);
  if (named.isSymbolicLink()) throw new TypeError(`${kind} path must not be a symbolic link`);
  requireSingleLinkRegularFile(named, kind);
  return named;
}

function namedStorageFileIsAbsent(path: string, kind: NotificationStorageKind): boolean {
  try {
    requireNamedStorageFile(path, kind);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

function openExistingStorageDescriptor(
  path: string,
  kind: NotificationStorageKind,
  platform: NodeJS.Platform,
  accessFlags = constants.O_RDONLY,
): number | null {
  try {
    return openSync(path, accessFlags | noFollowFlag(platform) | constants.O_NONBLOCK);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      if (namedStorageFileIsAbsent(path, kind)) return null;
      throw new TypeError(`${kind} path changed during open`, { cause: error });
    }
    if (code === "ELOOP") throw new TypeError(`${kind} path must not be a symbolic link`, { cause: error });
    throw error;
  }
}

function createWindowsStorageDescriptor(path: string, kind: NotificationStorageKind, accessFlags: number): number {
  const stagingPath = join(dirname(path), `.${basename(path)}.${randomBytes(16).toString("hex")}.tmp`);
  let descriptor: number | null = null;
  let stagingNameExists = false;
  try {
    descriptor = openSync(stagingPath, accessFlags | constants.O_CREAT | constants.O_EXCL, 0o600);
    stagingNameExists = true;
    requireSingleLinkRegularFile(fstatSync(descriptor), kind);
    try {
      linkSync(stagingPath, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        if (!namedStorageFileIsAbsent(path, kind)) {
          throw new TypeError(`${kind} path changed during exclusive publication`, { cause: error });
        }
        throw new TypeError(`${kind} path changed during exclusive publication`, { cause: error });
      }
      throw error;
    }
    unlinkSync(stagingPath);
    stagingNameExists = false;
    return descriptor;
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    if (stagingNameExists) {
      try {
        unlinkSync(stagingPath);
      } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") throw cleanupError;
      }
    }
    throw error;
  }
}

function openStorageRootDescriptor(path: string, platform: NodeJS.Platform): number {
  return openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | noFollowFlag(platform));
}

export function assertNotificationStorageDescriptor(
  path: string,
  descriptor: number,
  kind: NotificationStorageKind,
  options: StorageDescriptorOptions = {},
): void {
  const platform = options.platform ?? process.platform;
  const namedDescriptor = openExistingStorageDescriptor(path, kind, platform);
  if (namedDescriptor === null) throw new TypeError(`${kind} path changed during open`);
  try {
    const guarded = fstatSync(descriptor);
    const named = fstatSync(namedDescriptor);
    const namedEntry = requireNamedStorageFile(path, kind);
    requireSingleLinkRegularFile(guarded, kind);
    requireSingleLinkRegularFile(named, kind);
    if (named.dev !== guarded.dev || named.ino !== guarded.ino || namedEntry.dev !== guarded.dev || namedEntry.ino !== guarded.ino) {
      throw new TypeError(`${kind} path changed during open`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new TypeError(`${kind} path changed during open`, { cause: error });
    }
    throw error;
  } finally {
    closeSync(namedDescriptor);
  }
}

export function openExistingNotificationStorageGuard(path: string, kind: NotificationStorageKind, options: StorageDescriptorOptions = {}): number | null {
  const platform = options.platform ?? process.platform;
  const descriptor = openExistingStorageDescriptor(path, kind, platform);
  if (descriptor === null) return null;
  try {
    assertNotificationStorageDescriptor(path, descriptor, kind, options);
    return descriptor;
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}

function openWritableNotificationStorageGuard(path: string, kind: NotificationStorageKind, accessFlags: number, options: StorageDescriptorOptions): number {
  const platform = options.platform ?? process.platform;
  const noFollow = noFollowFlag(platform);
  let descriptor: number | null = null;
  try {
    descriptor = openExistingStorageDescriptor(path, kind, platform, accessFlags);
    if (descriptor === null) {
      options.afterStorageAbsenceObserved?.(path);
      if (platform === "win32") {
        descriptor = createWindowsStorageDescriptor(path, kind, accessFlags);
      } else {
        // machine-contract: this path already passed fixed-root containment and private-parent checks; POSIX O_NOFOLLOW plus O_EXCL prevents pre-existing or raced aliases.
        descriptor = openSync(path, accessFlags | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
      }
    }
    assertNotificationStorageDescriptor(path, descriptor, kind, options);
    return descriptor;
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor);
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" && !namedStorageFileIsAbsent(path, kind)) {
      throw new TypeError(`${kind} path changed during open`, { cause: error });
    }
    if (code === "ELOOP") {
      throw new TypeError(`${kind} path must not be a symbolic link`, { cause: error });
    }
    throw error;
  }
}

export function openNotificationStorageGuard(path: string, kind: NotificationStorageKind, options: StorageDescriptorOptions = {}): number {
  return openWritableNotificationStorageGuard(path, kind, constants.O_RDWR, options);
}

export function openNotificationStorageAppendGuard(path: string, kind: NotificationStorageKind, options: StorageDescriptorOptions = {}): number {
  return openWritableNotificationStorageGuard(path, kind, constants.O_APPEND | constants.O_WRONLY, options);
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
    guardDescriptor = openStorageRootDescriptor(storageRoot, platform);
    const guarded = fstatSync(guardDescriptor);
    if (!guarded.isDirectory()) throw new TypeError(`${kind} storage root must be a directory`);
    if (hasPosixPermissionSemantics(platform)) fchmodSync(guardDescriptor, 0o700);

    const canonicalRoot = realpathSync(storageRoot);
    namedDescriptor = openStorageRootDescriptor(storageRoot, platform);
    const named = fstatSync(namedDescriptor);
    const namedEntry = lstatSync(storageRoot);
    if (namedEntry.isSymbolicLink()) {
      throw new TypeError(`${kind} storage root must not be a symbolic link and must be a directory`);
    }
    if (
      !named.isDirectory() ||
      !namedEntry.isDirectory() ||
      named.dev !== guarded.dev ||
      named.ino !== guarded.ino ||
      named.nlink !== guarded.nlink ||
      namedEntry.dev !== guarded.dev ||
      namedEntry.ino !== guarded.ino
    ) {
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
  const existingDescriptor = openExistingNotificationStorageGuard(safePath, kind, { platform });
  // The guard already binds an existing file to its reviewed final name. A missing name remains safe only because every later writer uses exclusive creation.
  if (existingDescriptor !== null) closeSync(existingDescriptor);
  return safePath;
}

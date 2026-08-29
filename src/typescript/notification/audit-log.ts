// information_uuid_v5=d94ff2b1-0ab0-54a1-9746-59e0a7e00a1a
// event_uuid_v7=01a04872-0494-75c7-8f93-a81072ba9724
// machine-contract: append is allowed only after the existing SHA-256 chain verifies.
// information_uuid_v5=86a5edfe-a906-5771-8c0f-4dadad5aaebf
// event_uuid_v7=01a04cd1-5eaa-70e9-aa80-545fb4d96d5d
// state_transition=UNTRUSTED_STORAGE_PATH -> CONTAINED_NONSYMLINK_PATH occurred_at=2026-08-29T09:19:44.810Z
// machine-contract: audit I/O is allowed only below the repository .local directory or the operating-system test directory after canonical containment and symlink checks.
// information_uuid_v5=c82fc322-fc96-5ce1-aa03-ba374d074d0e
// event_uuid_v7=01a04ce0-0e77-76e2-b032-8dc5fd1e2f77
// state_transition=CHECK_THEN_OPEN -> PRIVATE_PARENT_AND_NOFOLLOW_IO occurred_at=2026-08-29T09:35:47.319Z
// machine-contract: every audit read and append opens the reviewed path with O_NOFOLLOW inside a private caller-owned directory; constructor-time checks alone never authorize later I/O.
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../canonical.ts";
import type { TransitionRecord } from "./types.ts";

interface AuditLine extends TransitionRecord {
  previousHash: string;
  eventHash: string;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const repositoryStorageRoot = join(repositoryRoot, ".local");
const AUDIT_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,126}\.ndjson$/;

function requirePrivateDirectory(path: string): void {
  const stats = statSync(path);
  if (!stats.isDirectory()) throw new TypeError("audit parent must be a directory");
  if (typeof process.getuid === "function" && stats.uid !== process.getuid()) {
    throw new TypeError("audit parent must be owned by the current user");
  }
  if ((stats.mode & 0o077) !== 0) throw new TypeError("audit parent must be private to the current user");
}

function containedAuditPath(candidate: string): string {
  const filename = basename(candidate);
  if (!AUDIT_FILENAME.test(filename)) {
    throw new TypeError("audit path must end in a simple .ndjson filename");
  }

  // Only this fixed application directory may be created. Caller-selected parents must already exist.
  mkdirSync(repositoryStorageRoot, { recursive: true, mode: 0o700 });
  chmodSync(repositoryStorageRoot, 0o700);
  const requestedPath = resolve(candidate);
  const localRoot = resolve(repositoryStorageRoot);
  const temporaryRoot = resolve(tmpdir());
  const fromLocalRoot = relative(localRoot, requestedPath);
  const fromTemporaryRoot = relative(temporaryRoot, requestedPath);
  const isBelowLocalRoot = fromLocalRoot !== ""
    && fromLocalRoot !== ".."
    && !fromLocalRoot.startsWith(`..${sep}`)
    && !isAbsolute(fromLocalRoot);
  const isBelowTemporaryRoot = fromTemporaryRoot !== ""
    && fromTemporaryRoot !== ".."
    && !fromTemporaryRoot.startsWith(`..${sep}`)
    && !isAbsolute(fromTemporaryRoot);
  const lexicalRoot = isBelowLocalRoot ? localRoot : isBelowTemporaryRoot ? temporaryRoot : null;
  if (lexicalRoot === null) throw new TypeError("audit path is outside the allowed storage roots");

  const canonicalRoot = realpathSync(lexicalRoot);
  const canonicalParent = realpathSync(dirname(requestedPath));
  const fromCanonicalRoot = relative(canonicalRoot, canonicalParent);
  if (fromCanonicalRoot === ".." || fromCanonicalRoot.startsWith(`..${sep}`) || isAbsolute(fromCanonicalRoot)) {
    throw new TypeError("audit path resolves outside its allowed storage root");
  }
  if (lexicalRoot === temporaryRoot) {
    const rootStats = statSync(canonicalRoot);
    const rootIsPrivate = (rootStats.mode & 0o077) === 0;
    const rootIsSticky = (rootStats.mode & 0o1000) !== 0;
    if (!rootIsPrivate && !rootIsSticky) throw new TypeError("temporary storage root must be private or sticky");
    if (fromCanonicalRoot === "" || fromCanonicalRoot.includes(sep)) {
      throw new TypeError("audit parent must be one direct private child of the temporary root");
    }
  }
  requirePrivateDirectory(canonicalParent);

  const safePath = join(canonicalParent, filename);
  if (existsSync(safePath) && lstatSync(safePath).isSymbolicLink()) {
    throw new TypeError("audit path must not be a symbolic link");
  }
  return safePath;
}

function readAuditText(path: string): string | null {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(descriptor).isFile()) throw new TypeError("audit path must be a regular file");
    return readFileSync(descriptor, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    if (code === "ELOOP") throw new TypeError("audit path must not be a symbolic link", { cause: error });
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function appendAuditText(path: string, text: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    if (!fstatSync(descriptor).isFile()) throw new TypeError("audit path must be a regular file");
    appendFileSync(descriptor, text, { encoding: "utf8" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new TypeError("audit path must not be a symbolic link", { cause: error });
    }
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

export class AuditLog {
  readonly path: string;

  constructor(path: string) {
    this.path = containedAuditPath(path);
  }

  append(record: TransitionRecord): AuditLine {
    const previousHash = this.lastHash();
    const core = { ...record, previousHash };
    const eventHash = hash(canonicalJson(core));
    const line: AuditLine = { ...core, eventHash };
    appendAuditText(this.path, JSON.stringify(line) + "\n");
    return line;
  }

  verify(): { valid: boolean; count: number; lastHash: string } {
    const text = readAuditText(this.path);
    if (text === null) return { valid: true, count: 0, lastHash: "" };
    let previousHash = "";
    let count = 0;
    for (const raw of text.split("\n")) {
      if (!raw.trim()) continue;
      const line = JSON.parse(raw) as AuditLine;
      const { eventHash, ...core } = line;
      if (core.previousHash !== previousHash || hash(canonicalJson(core)) !== eventHash) {
        return { valid: false, count, lastHash: previousHash };
      }
      previousHash = eventHash;
      count += 1;
    }
    return { valid: true, count, lastHash: previousHash };
  }

  readIntentCreation(intentId: string): TransitionRecord | null {
    const verification = this.verify();
    if (!verification.valid) throw new Error("audit chain is invalid");
    const text = readAuditText(this.path);
    if (text === null) return null;
    for (const raw of text.split("\n")) {
      if (!raw.trim()) continue;
      const line = JSON.parse(raw) as AuditLine;
      if (line.intentId !== intentId || line.kind !== "intent-created") continue;
      const { previousHash: _previousHash, eventHash: _eventHash, ...record } = line;
      return record;
    }
    return null;
  }

  private lastHash(): string {
    return this.verify().lastHash;
  }
}

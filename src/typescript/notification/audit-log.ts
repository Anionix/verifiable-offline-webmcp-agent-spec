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
// information_uuid_v5=4701fbc2-25e6-5a23-b7c0-4fb56abd6673
// event_uuid_v7=01a04d0d-7648-762e-8124-3ceea8de45f9
// state_transition=NOFOLLOW_WITH_UNCHECKED_HARDLINK -> SINGLE_LINK_DESCRIPTOR_BOUND_IO occurred_at=2026-08-29T10:25:23.016Z
// machine-contract: every audit read and append rejects multiple links and proves the opened descriptor still names the reviewed path before bytes are read or appended.
// information_uuid_v5=77d013eb-4de8-5cee-9ad6-80d2caf3566e
// event_uuid_v7=01a04d54-cedc-7a4a-8fab-4b84061d412d
// state_transition=DIRECT_CREATE_THROUGH_UNCHECKED_NAME -> EXCLUSIVE_CREATE_THEN_DESCRIPTOR_BOUND_APPEND occurred_at=2026-08-29T11:43:18.748Z
// machine-contract: audit reads and appends use shared final-name guards; a dangling link is rejected before O_CREAT can create its external target.
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../canonical.ts";
import {
  captureNotificationStorageParent,
  containedNotificationStoragePath,
  openExistingNotificationStorageGuard,
  openNotificationStorageAppendGuard,
  type StorageParentIdentity,
} from "./storage-path.ts";
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

function containedAuditPath(candidate: string): string {
  return containedNotificationStoragePath(candidate, "audit", { repositoryStorageRoot });
}

function readAuditText(path: string, expectedParent: StorageParentIdentity): string | null {
  const descriptor = openExistingNotificationStorageGuard(path, "audit", { expectedParent });
  if (descriptor === null) return null;
  try {
    return readFileSync(descriptor, "utf8");
  } finally {
    closeSync(descriptor);
  }
}

function appendAuditText(path: string, text: string, expectedParent: StorageParentIdentity): void {
  const descriptor = openNotificationStorageAppendGuard(path, "audit", { expectedParent });
  try {
    appendFileSync(descriptor, text, { encoding: "utf8" });
  } finally {
    closeSync(descriptor);
  }
}

export class AuditLog {
  readonly path: string;
  private readonly parentIdentity: StorageParentIdentity;

  constructor(path: string) {
    this.path = containedAuditPath(path);
    this.parentIdentity = captureNotificationStorageParent(this.path, "audit");
  }

  append(record: TransitionRecord): AuditLine {
    const previousHash = this.lastHash();
    const core = { ...record, previousHash };
    const eventHash = hash(canonicalJson(core));
    const line: AuditLine = { ...core, eventHash };
    appendAuditText(this.path, JSON.stringify(line) + "\n", this.parentIdentity);
    return line;
  }

  verify(): { valid: boolean; count: number; lastHash: string } {
    const text = readAuditText(this.path, this.parentIdentity);
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
    const text = readAuditText(this.path, this.parentIdentity);
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

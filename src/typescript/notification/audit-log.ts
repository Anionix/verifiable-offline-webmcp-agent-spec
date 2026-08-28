// information_uuid_v5=d94ff2b1-0ab0-54a1-9746-59e0a7e00a1a
// event_uuid_v7=01a04872-0494-75c7-8f93-a81072ba9724
// machine-contract: append is allowed only after the existing SHA-256 chain verifies.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { canonicalJson } from "../canonical.ts";
import type { TransitionRecord } from "./types.ts";

interface AuditLine extends TransitionRecord {
  previousHash: string;
  eventHash: string;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export class AuditLog {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  append(record: TransitionRecord): AuditLine {
    const previousHash = this.lastHash();
    const core = { ...record, previousHash };
    const eventHash = hash(canonicalJson(core));
    const line: AuditLine = { ...core, eventHash };
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, JSON.stringify(line) + "\n", { encoding: "utf8", mode: 0o600 });
    return line;
  }

  verify(): { valid: boolean; count: number; lastHash: string } {
    if (!existsSync(this.path)) return { valid: true, count: 0, lastHash: "" };
    let previousHash = "";
    let count = 0;
    for (const raw of readFileSync(this.path, "utf8").split("\n")) {
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
    if (!existsSync(this.path)) return null;
    for (const raw of readFileSync(this.path, "utf8").split("\n")) {
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

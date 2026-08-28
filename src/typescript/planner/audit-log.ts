// information_uuid_v5=0336b015-9448-5d2a-a57f-cd3bf9bca876
// event_uuid_v7=01a0493d-49b5-738a-b7a8-042296d8ca25
// machine-contract: EMPTY -> HASH_LINKED_EVENTS -> VERIFIED; audit records contain digests and field names, never disclosed values or authorization material.
import { createHash } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { isUuidVersion, uuidV7, uuidV7EpochMs } from "../uuid.ts";
import {
  PLANNER_VERSION,
  type PlannerAuditEvent,
  type PlannerAuditEventCore,
  type PlannerAuditKind,
  type PlannerStopReason,
} from "./types.ts";

const GENESIS = createHash("sha256").update("ONLINE-PLANNER-AUDIT-v0.5\0", "utf8").digest("hex");

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function deterministicUuidV7(epochMs: number, seed: string): string {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0 || epochMs >= 2 ** 48) throw new RangeError("epochMs must fit 48 unsigned bits");
  const bytes = createHash("sha256").update(seed, "utf8").digest().subarray(0, 16);
  let time = BigInt(epochMs);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(time & 0xffn);
    time >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface PlannerAuditAppend {
  runId: string;
  taskId: string;
  kind: PlannerAuditKind;
  fromState: string;
  toState: string;
  reason: PlannerStopReason | "CANDIDATE_ONLY" | null;
  inputDigest: string;
  requestDigest: string | null;
  disclosedContextKeys: readonly string[];
  exposedToolNames: readonly string[];
  transportAttempts: 0 | 1;
}

export class PlannerAuditLog {
  readonly #events: PlannerAuditEvent[] = [];
  readonly #now: () => number;
  readonly #eventId: (epochMs: number, sequence: number) => string;

  constructor(options: {
    now?: () => number;
    eventId?: (epochMs: number, sequence: number) => string;
  } = {}) {
    this.#now = options.now ?? Date.now;
    this.#eventId = options.eventId ?? ((epochMs) => uuidV7(epochMs));
  }

  append(value: PlannerAuditAppend): PlannerAuditEvent {
    const occurredAtEpochMs = this.#now();
    const sequence = this.#events.length + 1;
    const core: PlannerAuditEventCore = {
      version: PLANNER_VERSION,
      eventId: this.#eventId(occurredAtEpochMs, sequence),
      occurredAt: new Date(occurredAtEpochMs).toISOString(),
      occurredAtEpochMs,
      sequence,
      previousHash: this.#events.at(-1)?.recordHash ?? GENESIS,
      ...structuredClone(value),
      disclosedContextKeys: [...value.disclosedContextKeys].sort(),
      exposedToolNames: [...value.exposedToolNames].sort(),
      automaticRetries: 0,
      authorizationCreated: 0,
      externalEffectStarts: 0,
    };
    const record: PlannerAuditEvent = {
      ...core,
      recordHash: sha256Hex(canonicalJson(core as unknown as CanonicalValue)),
    };
    this.#events.push(record);
    return structuredClone(record);
  }

  events(): readonly PlannerAuditEvent[] {
    return structuredClone(this.#events);
  }

  verify(): { valid: boolean; count: number; lastHash: string } {
    let previousHash = GENESIS;
    for (let index = 0; index < this.#events.length; index += 1) {
      const event = this.#events[index]!;
      const { recordHash, ...core } = event;
      if (
        event.sequence !== index + 1
        || event.previousHash !== previousHash
        || event.recordHash !== sha256Hex(canonicalJson(core as unknown as CanonicalValue))
        || !isUuidVersion(event.eventId, 7)
        || uuidV7EpochMs(event.eventId) !== event.occurredAtEpochMs
        || Date.parse(event.occurredAt) !== event.occurredAtEpochMs
        || event.authorizationCreated !== 0
        || event.externalEffectStarts !== 0
        || event.automaticRetries !== 0
      ) return { valid: false, count: index, lastHash: previousHash };
      previousHash = recordHash;
    }
    return { valid: true, count: this.#events.length, lastHash: previousHash };
  }
}

export function plannerAuditGenesisHash(): string {
  return GENESIS;
}

// information_uuid_v5=86f82995-5b21-5d8a-ba1d-d26329db64d6
// event_uuid_v7=01a0491b-3dba-7e97-ba92-5d4a2509759c
// machine-contract: UNTRUSTED_BATCH -> VERIFIED -> INGESTED | DUPLICATE | QUARANTINED; this boundary has no external-effect execution capability.
import { createPublicKey } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CanonicalValue } from "../canonical.ts";
import { isUuidVersion, uuidV7 } from "../uuid.ts";
import { globalGenesisHash, globalRecordHash, sha256Hex } from "./crypto.ts";
import { verifyDeviceChain } from "./device-log.ts";
import {
  SYNC_VERSION,
  type DangerousReview,
  type DeviceIdentity,
  type GlobalIngestionRecord,
  type GlobalIngestionRecordCore,
  type IngestResult,
  type IngestionDecision,
  type QuarantineCode,
  type QuarantineRecord,
  type SignedCheckpoint,
  type SignedDeviceEvent,
} from "./types.ts";

interface KnownKeyRow {
  device_id: string;
  log_id: string;
  key_id: string;
  public_key_pem: string;
}

interface EventRow {
  device_id: string;
  device_sequence: number;
  source_chain_hash: string;
  source_event_digest: string;
  record_json: string;
}

interface CheckpointRow {
  checkpoint_digest: string;
  tree_size: number;
}

function nowIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

export class LocalSyncLedger {
  readonly database: DatabaseSync;
  readonly #now: () => number;

  constructor(path: string, options: { now?: () => number } = {}) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#now = options.now ?? Date.now;
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS known_device_keys (
        device_id TEXT PRIMARY KEY,
        log_id TEXT NOT NULL UNIQUE,
        key_id TEXT NOT NULL UNIQUE,
        public_key_pem TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ingestion_events (
        global_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        ingestion_event_id TEXT NOT NULL UNIQUE,
        ingested_at INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        device_sequence INTEGER NOT NULL,
        source_event_id TEXT NOT NULL UNIQUE,
        source_event_digest TEXT NOT NULL,
        source_chain_hash TEXT NOT NULL,
        decision TEXT NOT NULL CHECK (decision IN ('MERGED_SAFE_STATE', 'HUMAN_REVIEW_REQUIRED')),
        previous_global_hash TEXT NOT NULL,
        global_hash TEXT NOT NULL UNIQUE,
        record_json TEXT NOT NULL,
        UNIQUE(device_id, device_sequence)
      );
      CREATE TABLE IF NOT EXISTS device_checkpoints (
        device_id TEXT NOT NULL,
        checkpoint_digest TEXT NOT NULL UNIQUE,
        tree_size INTEGER NOT NULL,
        chain_head TEXT NOT NULL,
        previous_checkpoint_hash TEXT,
        checkpoint_json TEXT NOT NULL,
        PRIMARY KEY(device_id, checkpoint_digest)
      );
      CREATE INDEX IF NOT EXISTS device_checkpoint_order
        ON device_checkpoints(device_id, tree_size);
      CREATE TABLE IF NOT EXISTS safe_tags (
        set_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        first_source_event_digest TEXT NOT NULL,
        PRIMARY KEY(set_id, tag)
      );
      CREATE TABLE IF NOT EXISTS dangerous_reviews (
        intent_id TEXT PRIMARY KEY,
        effect_kind TEXT NOT NULL,
        payload_digest TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status = 'HUMAN_REVIEW_REQUIRED'),
        source_count INTEGER NOT NULL,
        conflicting_payloads INTEGER NOT NULL CHECK (conflicting_payloads IN (0, 1))
      );
      CREATE TABLE IF NOT EXISTS dangerous_review_sources (
        intent_id TEXT NOT NULL REFERENCES dangerous_reviews(intent_id),
        source_event_digest TEXT NOT NULL UNIQUE,
        device_id TEXT NOT NULL,
        device_sequence INTEGER NOT NULL,
        PRIMARY KEY(intent_id, source_event_digest)
      );
      CREATE TABLE IF NOT EXISTS quarantine (
        quarantine_id TEXT PRIMARY KEY,
        occurred_at INTEGER NOT NULL,
        code TEXT NOT NULL,
        device_id TEXT,
        device_sequence INTEGER,
        observed_digest TEXT NOT NULL,
        record_json TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.database.close();
  }

  registerDevice(identity: DeviceIdentity, publicKeyPem: string): void {
    if (![identity.deviceId, identity.logId, identity.keyId].every(value => isUuidVersion(value, 5))) {
      throw new TypeError("registered device identity must use UUIDv5");
    }
    const publicKey = createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== "ed25519") throw new TypeError("registered key must be Ed25519");
    const normalizedPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const existing = this.database.prepare("SELECT * FROM known_device_keys WHERE device_id = ?")
      .get(identity.deviceId) as KnownKeyRow | undefined;
    if (existing) {
      if (
        existing.log_id !== identity.logId
        || existing.key_id !== identity.keyId
        || existing.public_key_pem !== normalizedPem
      ) throw new Error("device identity is already bound to different key material");
      return;
    }
    this.database.prepare(`
      INSERT INTO known_device_keys (device_id, log_id, key_id, public_key_pem) VALUES (?, ?, ?, ?)
    `).run(identity.deviceId, identity.logId, identity.keyId, normalizedPem);
  }

  ingest(events: readonly SignedDeviceEvent[], checkpoint: SignedCheckpoint): IngestResult {
    if (events.length === 0) return this.quarantine("EMPTY_CHAIN", null, null, checkpoint.digest);
    const first = events[0]!;
    const known = this.database.prepare("SELECT * FROM known_device_keys WHERE device_id = ?")
      .get(first.deviceId) as KnownKeyRow | undefined;
    if (!known) return this.quarantine("UNKNOWN_KEY", first.deviceId, first.sequence, first.proof.eventDigest);
    if (known.log_id !== first.logId || known.key_id !== first.keyId) {
      return this.quarantine("IDENTITY_MISMATCH", first.deviceId, first.sequence, first.proof.eventDigest);
    }
    const verification = verifyDeviceChain(events, checkpoint, known.public_key_pem);
    if (!verification.valid) {
      return this.quarantine(verification.code, first.deviceId, events[verification.eventCount]?.sequence ?? null, first.proof.eventDigest);
    }

    for (const event of events) {
      const existing = this.database.prepare(`
        SELECT device_id, device_sequence, source_chain_hash, source_event_digest, record_json
        FROM ingestion_events WHERE device_id = ? AND device_sequence = ?
      `).get(event.deviceId, event.sequence) as EventRow | undefined;
      if (existing && existing.source_chain_hash !== event.proof.chainHash) {
        return this.quarantine("FORK_DETECTED", event.deviceId, event.sequence, event.proof.eventDigest);
      }
    }

    const maxRow = this.database.prepare(`
      SELECT COALESCE(MAX(device_sequence), 0) AS value FROM ingestion_events WHERE device_id = ?
    `).get(first.deviceId) as { value: number };
    let nextDeviceSequence = Number(maxRow.value) + 1;
    for (const event of events) {
      const exists = this.database.prepare(`
        SELECT 1 AS value FROM ingestion_events WHERE device_id = ? AND device_sequence = ?
      `).get(event.deviceId, event.sequence) as { value: number } | undefined;
      if (exists) continue;
      if (event.sequence !== nextDeviceSequence) {
        return this.quarantine("SEQUENCE_GAP", event.deviceId, event.sequence, event.proof.eventDigest);
      }
      nextDeviceSequence += 1;
    }

    const previousCheckpoint = this.database.prepare(`
      SELECT checkpoint_digest, tree_size FROM device_checkpoints
      WHERE device_id = ? ORDER BY tree_size DESC, rowid DESC LIMIT 1
    `).get(first.deviceId) as CheckpointRow | undefined;
    const checkpointExists = this.database.prepare(`
      SELECT 1 AS value FROM device_checkpoints WHERE checkpoint_digest = ?
    `).get(checkpoint.digest) as { value: number } | undefined;
    if (
      !checkpointExists
      && previousCheckpoint
      && checkpoint.treeSize >= previousCheckpoint.tree_size
      && checkpoint.previousCheckpointHash !== previousCheckpoint.checkpoint_digest
    ) return this.quarantine("CHECKPOINT_MISMATCH", first.deviceId, checkpoint.treeSize, checkpoint.digest);

    return this.transaction(() => {
      const inserted: GlobalIngestionRecord[] = [];
      for (const event of events) {
        const duplicate = this.database.prepare(`
          SELECT record_json FROM ingestion_events WHERE device_id = ? AND device_sequence = ?
        `).get(event.deviceId, event.sequence) as { record_json: string } | undefined;
        if (duplicate) continue;
        const globalRow = this.database.prepare(`
          SELECT COALESCE(MAX(global_sequence), 0) + 1 AS value FROM ingestion_events
        `).get() as { value: number };
        const globalSequence = Number(globalRow.value);
        const head = this.database.prepare(`
          SELECT global_hash FROM ingestion_events ORDER BY global_sequence DESC LIMIT 1
        `).get() as { global_hash: string } | undefined;
        const previousGlobalHash = head?.global_hash ?? globalGenesisHash();
        const ingestedAtEpochMs = this.#now();
        const decision: IngestionDecision = event.operation.type === "SAFE_TAG_ADD"
          ? "MERGED_SAFE_STATE"
          : "HUMAN_REVIEW_REQUIRED";
        const core: GlobalIngestionRecordCore = {
          version: SYNC_VERSION,
          ingestionEventId: uuidV7(ingestedAtEpochMs),
          ingestedAt: nowIso(ingestedAtEpochMs),
          ingestedAtEpochMs,
          globalSequence,
          previousGlobalHash,
          deviceId: event.deviceId,
          deviceSequence: event.sequence,
          sourceEventId: event.eventId,
          sourceEventDigest: event.proof.eventDigest,
          sourceChainHash: event.proof.chainHash,
          operation: structuredClone(event.operation),
          decision,
        };
        const record: GlobalIngestionRecord = {
          ...core,
          globalHash: globalRecordHash(previousGlobalHash, core as unknown as CanonicalValue),
        };
        this.database.prepare(`
          INSERT INTO ingestion_events (
            global_sequence, ingestion_event_id, ingested_at, device_id, device_sequence,
            source_event_id, source_event_digest, source_chain_hash, decision,
            previous_global_hash, global_hash, record_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.globalSequence,
          record.ingestionEventId,
          record.ingestedAtEpochMs,
          record.deviceId,
          record.deviceSequence,
          record.sourceEventId,
          record.sourceEventDigest,
          record.sourceChainHash,
          record.decision,
          record.previousGlobalHash,
          record.globalHash,
          JSON.stringify(record),
        );
        this.applyDecision(record);
        inserted.push(record);
      }
      if (!checkpointExists) {
        this.database.prepare(`
          INSERT INTO device_checkpoints (
            device_id, checkpoint_digest, tree_size, chain_head, previous_checkpoint_hash, checkpoint_json
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          checkpoint.deviceId,
          checkpoint.digest,
          checkpoint.treeSize,
          checkpoint.chainHead,
          checkpoint.previousCheckpointHash,
          JSON.stringify(checkpoint),
        );
      }
      return inserted.length === 0
        ? { status: "DUPLICATE", records: [] }
        : { status: "INGESTED", records: inserted };
    });
  }

  ingestionRecords(): readonly GlobalIngestionRecord[] {
    return (this.database.prepare("SELECT record_json FROM ingestion_events ORDER BY global_sequence").all() as Array<{ record_json: string }>)
      .map(row => JSON.parse(row.record_json) as GlobalIngestionRecord);
  }

  quarantines(): readonly QuarantineRecord[] {
    return (this.database.prepare("SELECT record_json FROM quarantine ORDER BY occurred_at, rowid").all() as Array<{ record_json: string }>)
      .map(row => JSON.parse(row.record_json) as QuarantineRecord);
  }

  safeTags(setId: string): readonly string[] {
    return (this.database.prepare("SELECT tag FROM safe_tags WHERE set_id = ? ORDER BY tag").all(setId) as Array<{ tag: string }>)
      .map(row => row.tag);
  }

  dangerousReviews(): readonly DangerousReview[] {
    return (this.database.prepare("SELECT * FROM dangerous_reviews ORDER BY intent_id").all() as Array<{
      intent_id: string;
      effect_kind: DangerousReview["effectKind"];
      payload_digest: string;
      status: "HUMAN_REVIEW_REQUIRED";
      source_count: number;
      conflicting_payloads: number;
    }>).map(row => ({
      intentId: row.intent_id,
      effectKind: row.effect_kind,
      payloadDigest: row.payload_digest,
      status: row.status,
      sourceCount: Number(row.source_count),
      conflictingPayloads: Boolean(row.conflicting_payloads),
    }));
  }

  globalCount(): number {
    return Number((this.database.prepare("SELECT count(*) AS value FROM ingestion_events").get() as { value: number }).value);
  }

  externalEffectStarts(): 0 {
    return 0;
  }

  verifyGlobalChain(): { valid: boolean; count: number; lastHash: string } {
    let previousHash = globalGenesisHash();
    let expectedSequence = 1;
    for (const record of this.ingestionRecords()) {
      const { globalHash, ...core } = record;
      if (
        record.globalSequence !== expectedSequence
        || record.previousGlobalHash !== previousHash
        || globalRecordHash(previousHash, core as unknown as CanonicalValue) !== globalHash
      ) return { valid: false, count: expectedSequence - 1, lastHash: previousHash };
      const source = this.database.prepare(`
        SELECT source_event_digest, source_chain_hash FROM ingestion_events WHERE global_sequence = ?
      `).get(record.globalSequence) as { source_event_digest: string; source_chain_hash: string };
      if (source.source_event_digest !== record.sourceEventDigest || source.source_chain_hash !== record.sourceChainHash) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash };
      }
      previousHash = globalHash;
      expectedSequence += 1;
    }
    return { valid: true, count: expectedSequence - 1, lastHash: previousHash };
  }

  private applyDecision(record: GlobalIngestionRecord): void {
    const operation = record.operation;
    if (operation.type === "SAFE_TAG_ADD") {
      this.database.prepare(`
        INSERT OR IGNORE INTO safe_tags (set_id, tag, first_source_event_digest) VALUES (?, ?, ?)
      `).run(operation.setId, operation.tag, record.sourceEventDigest);
      return;
    }
    const existing = this.database.prepare("SELECT * FROM dangerous_reviews WHERE intent_id = ?")
      .get(operation.intentId) as {
        effect_kind: string;
        payload_digest: string;
        source_count: number;
        conflicting_payloads: number;
      } | undefined;
    if (!existing) {
      this.database.prepare(`
        INSERT INTO dangerous_reviews (
          intent_id, effect_kind, payload_digest, status, source_count, conflicting_payloads
        ) VALUES (?, ?, ?, 'HUMAN_REVIEW_REQUIRED', 1, 0)
      `).run(operation.intentId, operation.effectKind, operation.payloadDigest);
    } else {
      const conflict = existing.effect_kind !== operation.effectKind || existing.payload_digest !== operation.payloadDigest;
      this.database.prepare(`
        UPDATE dangerous_reviews
        SET source_count = source_count + 1,
            conflicting_payloads = CASE WHEN conflicting_payloads = 1 OR ? THEN 1 ELSE 0 END
        WHERE intent_id = ?
      `).run(conflict ? 1 : 0, operation.intentId);
    }
    this.database.prepare(`
      INSERT INTO dangerous_review_sources (
        intent_id, source_event_digest, device_id, device_sequence
      ) VALUES (?, ?, ?, ?)
    `).run(operation.intentId, record.sourceEventDigest, record.deviceId, record.deviceSequence);
  }

  private quarantine(
    code: QuarantineCode,
    deviceId: string | null,
    deviceSequence: number | null,
    observedDigest: string,
  ): IngestResult {
    const occurredAtEpochMs = this.#now();
    const digest = /^[0-9a-f]{64}$/.test(observedDigest) ? observedDigest : sha256Hex(observedDigest);
    const record: QuarantineRecord = {
      version: SYNC_VERSION,
      quarantineId: uuidV7(occurredAtEpochMs),
      occurredAt: nowIso(occurredAtEpochMs),
      occurredAtEpochMs,
      code,
      deviceId,
      deviceSequence,
      observedDigest: digest,
      state: "REJECTED",
      externalEffectStarts: 0,
    };
    this.database.prepare(`
      INSERT INTO quarantine (
        quarantine_id, occurred_at, code, device_id, device_sequence, observed_digest, record_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.quarantineId,
      record.occurredAtEpochMs,
      record.code,
      record.deviceId,
      record.deviceSequence,
      record.observedDigest,
      JSON.stringify(record),
    );
    return { status: "QUARANTINED", code, quarantine: record };
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

// information_uuid_v5=0930eb1a-bc57-5573-96f6-7b4942d43282
// event_uuid_v7=01a04872-04c9-72d5-b80b-adb45c7105a7
// machine-contract: one logical_operation_id owns one intent; state claims are serialized with BEGIN IMMEDIATE.
// event_uuid_v7=01a04893-376b-7148-8c50-845366465b93
// machine-contract: a suppressed duplicate or ambiguous retry is still persisted as a same-state attempt with its own UUIDv7.
// information_uuid_v5=5b3dd6c4-39fd-57b2-98bc-842b8d7f88bc
// event_uuid_v7=01a0498b-5662-7094-9bef-88e9b2f13a10
// machine-contract: execution claims remain auditable; only explicit NOT_STARTED assessments contribute zero to the conservative count.
// information_uuid_v5=9ca3a8c3-2305-534c-a98f-8127cae34c23
// event_uuid_v7=01a04993-3867-7e11-b120-01b3bab8ec62
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T18:13:00.135Z
// machine-contract: STARTED and UNKNOWN each consume one external-effect-start budget slot.
// information_uuid_v5=aaac8ecc-02ba-512e-ae0b-3584d2482e61
// event_uuid_v7=01a04c92-0d3a-7302-a9ae-07a565dd08db
// state_transition=USER_APPROVED_EXPIRED -> DRY_RUN_REPREPARED occurred_at=2026-08-29T08:14:35.194Z
// machine-contract: preview clears an expired approval before a new approval can be recorded; an old receipt can never authorize a later effect.
// information_uuid_v5=86a5edfe-a906-5771-8c0f-4dadad5aaebf
// event_uuid_v7=01a04cd1-5eaa-70e9-aa80-545fb4d96d5d
// state_transition=UNTRUSTED_STORAGE_PATH -> CONTAINED_NONSYMLINK_PATH occurred_at=2026-08-29T09:19:44.810Z
// machine-contract: SQLite opens only :memory: or a canonical non-symlink .sqlite file below the repository .local directory or the operating-system test directory.
// information_uuid_v5=c82fc322-fc96-5ce1-aa03-ba374d074d0e
// event_uuid_v7=01a04ce0-0e77-76e2-b032-8dc5fd1e2f77
// state_transition=SHARED_PARENT_ALLOWED -> CALLER_OWNED_PRIVATE_PARENT_REQUIRED occurred_at=2026-08-29T09:35:47.319Z
// machine-contract: SQLite receives a reviewed regular path only from a directory owned by the current user with no group or other access; environment input cannot select the path.
import { chmodSync, existsSync, lstatSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { EffectStartStatus } from "../governance/replay-verification.ts";
import {
  provenanceDetails,
  provenanceFromDetails,
  type InputProvenance,
} from "./input-provenance.ts";
import type {
  ClaimResult,
  ControlState,
  EffectState,
  NotificationIntent,
  NotificationTarget,
  TransitionRecord,
} from "./types.ts";
import { StateConflictError } from "./types.ts";

interface IntentRow {
  intent_id: string;
  logical_operation_id: string;
  title: string;
  body: string;
  target: NotificationTarget;
  payload_digest: string;
  control_state: ControlState;
  effect_state: EffectState;
  approval_event_id: string | null;
  approval_target: NotificationTarget | null;
  approval_payload_digest: string | null;
  approval_expires_at: number | null;
  created_at: number;
  updated_at: number;
  revision: number;
}

export interface NewIntentRecord {
  intentId: string;
  logicalOperationId: string;
  title: string;
  body: string;
  target: NotificationTarget;
  payloadDigest: string;
  inputProvenance: InputProvenance;
  eventId: string;
  now: number;
}

export interface StoredInputProvenanceEvidence {
  eventId: string;
  provenance: Readonly<InputProvenance>;
}

export interface StoredEffectClaimEvidence {
  eventId: string;
  startedAt: number;
  startStatus: EffectStartStatus;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const repositoryStorageRoot = join(repositoryRoot, ".local");
const DATABASE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.sqlite$/;

function requirePrivateDirectory(path: string): void {
  const stats = statSync(path);
  if (!stats.isDirectory()) throw new TypeError("database parent must be a directory");
  if (typeof process.getuid === "function" && stats.uid !== process.getuid()) {
    throw new TypeError("database parent must be owned by the current user");
  }
  if ((stats.mode & 0o077) !== 0) throw new TypeError("database parent must be private to the current user");
}

function containedDatabasePath(candidate: string): string {
  if (candidate === ":memory:") return candidate;
  const filename = basename(candidate);
  if (!DATABASE_FILENAME.test(filename)) {
    throw new TypeError("database path must end in a simple .sqlite filename");
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
  if (lexicalRoot === null) throw new TypeError("database path is outside the allowed storage roots");

  const canonicalRoot = realpathSync(lexicalRoot);
  const canonicalParent = realpathSync(dirname(requestedPath));
  const fromCanonicalRoot = relative(canonicalRoot, canonicalParent);
  if (fromCanonicalRoot === ".." || fromCanonicalRoot.startsWith(`..${sep}`) || isAbsolute(fromCanonicalRoot)) {
    throw new TypeError("database path resolves outside its allowed storage root");
  }
  if (lexicalRoot === temporaryRoot) {
    const rootStats = statSync(canonicalRoot);
    const rootIsPrivate = (rootStats.mode & 0o077) === 0;
    const rootIsSticky = (rootStats.mode & 0o1000) !== 0;
    if (!rootIsPrivate && !rootIsSticky) throw new TypeError("temporary storage root must be private or sticky");
    if (fromCanonicalRoot === "" || fromCanonicalRoot.includes(sep)) {
      throw new TypeError("database parent must be one direct private child of the temporary root");
    }
  }
  requirePrivateDirectory(canonicalParent);

  const safePath = join(canonicalParent, filename);
  if (existsSync(safePath) && lstatSync(safePath).isSymbolicLink()) {
    throw new TypeError("database path must not be a symbolic link");
  }
  return safePath;
}

export class NotificationStore {
  readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(containedDatabasePath(path));
    this.database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS intents (
        intent_id TEXT PRIMARY KEY,
        logical_operation_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        target TEXT NOT NULL CHECK (target = 'local-mac-notification'),
        payload_digest TEXT NOT NULL,
        control_state TEXT NOT NULL,
        effect_state TEXT NOT NULL,
        approval_event_id TEXT,
        approval_target TEXT,
        approval_payload_digest TEXT,
        approval_expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS attempts (
        event_id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL REFERENCES intents(intent_id),
        kind TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        from_control TEXT,
        to_control TEXT NOT NULL,
        from_effect TEXT,
        to_effect TEXT NOT NULL,
        details_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS effects (
        effect_event_id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL REFERENCES intents(intent_id),
        started_at INTEGER NOT NULL,
        start_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (start_status IN ('STARTED', 'NOT_STARTED', 'UNKNOWN')),
        outcome TEXT NOT NULL,
        receipt_json TEXT
      );
      CREATE INDEX IF NOT EXISTS attempts_intent_time ON attempts(intent_id, occurred_at);
      CREATE INDEX IF NOT EXISTS effects_intent_time ON effects(intent_id, started_at);
    `);
    const effectColumns = this.database.prepare("PRAGMA table_info(effects)").all() as Array<{ name: string }>;
    if (!effectColumns.some((column) => column.name === "start_status")) {
      this.database.exec("ALTER TABLE effects ADD COLUMN start_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (start_status IN ('STARTED', 'NOT_STARTED', 'UNKNOWN'))");
    }
    this.database.exec("UPDATE effects SET start_status = 'STARTED' WHERE outcome = 'CONFIRMED_PRESENT' AND start_status = 'UNKNOWN'");
  }

  close(): void {
    this.database.close();
  }

  createIntent(record: NewIntentRecord): { intent: NotificationIntent; transition: TransitionRecord | null } {
    return this.transaction(() => {
      const existing = this.getByLogicalOperation(record.logicalOperationId);
      if (existing) {
        if (existing.payloadDigest !== record.payloadDigest || existing.target !== record.target) {
          throw new StateConflictError("logical operation already exists with a different payload or target");
        }
        return { intent: existing, transition: null };
      }
      this.database.prepare(`
        INSERT INTO intents (
          intent_id, logical_operation_id, title, body, target, payload_digest,
          control_state, effect_state, created_at, updated_at, revision
        ) VALUES (?, ?, ?, ?, ?, ?, 'PROPOSED', 'NOT_STARTED', ?, ?, 1)
      `).run(
        record.intentId,
        record.logicalOperationId,
        record.title,
        record.body,
        record.target,
        record.payloadDigest,
        record.now,
        record.now,
      );
      const transition: TransitionRecord = {
        eventId: record.eventId,
        intentId: record.intentId,
        kind: "intent-created",
        occurredAt: record.now,
        fromControl: "DISCOVERED",
        toControl: "PROPOSED",
        fromEffect: null,
        toEffect: "NOT_STARTED",
        details: {
          payloadDigest: record.payloadDigest,
          target: record.target,
          ...provenanceDetails(record.inputProvenance),
        },
      };
      this.insertAttempt(transition);
      return { intent: this.requireIntent(record.intentId), transition };
    });
  }

  getIntent(intentId: string): NotificationIntent | null {
    const row = this.database.prepare("SELECT * FROM intents WHERE intent_id = ?").get(intentId) as IntentRow | undefined;
    return row ? this.toIntent(row) : null;
  }

  getByLogicalOperation(logicalOperationId: string): NotificationIntent | null {
    const row = this.database.prepare("SELECT * FROM intents WHERE logical_operation_id = ?").get(logicalOperationId) as IntentRow | undefined;
    return row ? this.toIntent(row) : null;
  }

  getInputProvenance(intentId: string): Readonly<InputProvenance> | null {
    return this.getInputProvenanceEvidence(intentId)?.provenance ?? null;
  }

  getInputProvenanceEvidence(intentId: string): StoredInputProvenanceEvidence | null {
    const row = this.database.prepare(`
      SELECT event_id, details_json FROM attempts
      WHERE intent_id = ? AND kind = 'intent-created'
      ORDER BY occurred_at ASC, rowid ASC LIMIT 1
    `).get(intentId) as { event_id: string; details_json: string } | undefined;
    if (!row) return null;
    return Object.freeze({
      eventId: row.event_id,
      provenance: provenanceFromDetails(JSON.parse(row.details_json)),
    });
  }

  getLatestEffectClaimEvidence(intentId: string): StoredEffectClaimEvidence | null {
    const row = this.database.prepare(`
      SELECT effect_event_id, started_at, start_status FROM effects
      WHERE intent_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1
    `).get(intentId) as { effect_event_id: string; started_at: number; start_status: EffectStartStatus } | undefined;
    return row ? Object.freeze({ eventId: row.effect_event_id, startedAt: row.started_at, startStatus: row.start_status }) : null;
  }

  markDryRun(intentId: string, eventId: string, now: number): { intent: NotificationIntent; transition: TransitionRecord | null } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (
        before.controlState === "USER_APPROVED"
        && before.effectState === "NOT_STARTED"
        && (before.approvalExpiresAt === null || before.approvalExpiresAt <= now)
      ) {
        if (this.countEffectStarts(intentId) !== 0) {
          throw new StateConflictError("expired approval cannot be reprepared after an effect start");
        }
        this.database.prepare(`
          UPDATE intents SET control_state = 'DRY_RUN',
            approval_event_id = NULL, approval_target = NULL, approval_payload_digest = NULL,
            approval_expires_at = NULL, updated_at = ?, revision = revision + 1
          WHERE intent_id = ?
        `).run(now, intentId);
        const transition = this.makeTransition(
          before,
          eventId,
          now,
          "expired-approval-reprepared",
          "DRY_RUN",
          "NOT_STARTED",
          { expiredApprovalEventId: before.approvalEventId },
        );
        this.insertAttempt(transition);
        return { intent: this.requireIntent(intentId), transition };
      }
      if (before.controlState !== "PROPOSED") return { intent: before, transition: null };
      return this.transition(before, eventId, now, "dry-run-reviewed", "DRY_RUN", before.effectState, {});
    });
  }

  approve(intentId: string, eventId: string, now: number, expiresAt: number): { intent: NotificationIntent; transition: TransitionRecord | null } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (before.controlState === "VERIFIED") return { intent: before, transition: null };
      if (before.controlState === "USER_APPROVED" && (before.approvalExpiresAt ?? 0) > now) {
        return { intent: before, transition: null };
      }
      if (before.controlState !== "DRY_RUN") throw new StateConflictError(`approval requires DRY_RUN, got ${before.controlState}`);
      if (before.effectState !== "NOT_STARTED" || this.countEffectStarts(intentId) !== 0) {
        throw new StateConflictError("approval safety invariant requires zero prior effect starts");
      }
      this.database.prepare(`
        UPDATE intents SET
          control_state = 'USER_APPROVED', approval_event_id = ?, approval_target = target,
          approval_payload_digest = payload_digest, approval_expires_at = ?, updated_at = ?, revision = revision + 1
        WHERE intent_id = ?
      `).run(eventId, expiresAt, now, intentId);
      const transition = this.makeTransition(before, eventId, now, "user-approved", "USER_APPROVED", before.effectState, {
        approvalExpiresAt: expiresAt,
        payloadDigest: before.payloadDigest,
        target: before.target,
      });
      this.insertAttempt(transition);
      return { intent: this.requireIntent(intentId), transition };
    });
  }

  claimExecution(intentId: string, eventId: string, now: number): ClaimResult {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (before.controlState === "VERIFIED" || before.effectState === "CONFIRMED_PRESENT") {
        const transition = this.recordAttempt(before, eventId, now, "duplicate-execution-suppressed", {
          reason: "effect-already-confirmed-present",
        });
        return { status: "ALREADY_VERIFIED", intent: before, transition };
      }
      if (before.controlState === "EXECUTING" || before.effectState === "AMBIGUOUS" || before.effectState === "RECONCILING") {
        const transition = this.recordAttempt(before, eventId, now, "ambiguous-execution-suppressed", {
          reason: "reconciliation-required-before-retry",
        });
        return { status: "RECONCILE_REQUIRED", intent: before, transition };
      }
      if (before.controlState !== "USER_APPROVED") {
        throw new StateConflictError(`execution requires USER_APPROVED, got ${before.controlState}`);
      }
      if (before.effectState !== "NOT_STARTED" || this.countEffectStarts(intentId) !== 0) {
        throw new StateConflictError("execution safety invariant requires zero prior effect starts");
      }
      if (
        before.approvalExpiresAt === null
        || before.approvalExpiresAt <= now
        || before.approvalTarget !== before.target
        || before.approvalPayloadDigest !== before.payloadDigest
      ) {
        const result = this.transition(before, eventId, now, "approval-expired-or-mismatched", "ABORTED", before.effectState, {});
        return { status: "APPROVAL_EXPIRED", intent: result.intent, transition: result.transition! };
      }
      this.database.prepare(`
        UPDATE intents SET control_state = 'EXECUTING', effect_state = 'AMBIGUOUS', updated_at = ?, revision = revision + 1
        WHERE intent_id = ?
      `).run(now, intentId);
      this.database.prepare(`
        INSERT INTO effects (effect_event_id, intent_id, started_at, start_status, outcome, receipt_json)
        VALUES (?, ?, ?, 'UNKNOWN', 'AMBIGUOUS', NULL)
      `).run(eventId, intentId, now);
      const transition = this.makeTransition(before, eventId, now, "execution-claimed", "EXECUTING", "AMBIGUOUS", {
        approvalEventId: before.approvalEventId,
      });
      this.insertAttempt(transition);
      return { status: "CLAIMED", intent: this.requireIntent(intentId), transition };
    });
  }

  beginReconcile(intentId: string, eventId: string, now: number): { intent: NotificationIntent; transition: TransitionRecord } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (before.controlState !== "EXECUTING" || before.effectState !== "AMBIGUOUS") {
        throw new StateConflictError(`reconcile requires EXECUTING/AMBIGUOUS, got ${before.controlState}/${before.effectState}`);
      }
      return this.transition(before, eventId, now, "reconcile-started", "EXECUTING", "RECONCILING", {} as Record<string, never>) as { intent: NotificationIntent; transition: TransitionRecord };
    });
  }

  completePresent(intentId: string, eventId: string, now: number, receipt: Record<string, unknown>): { intent: NotificationIntent; transition: TransitionRecord } {
    return this.finish(intentId, eventId, now, "effect-confirmed-present", "VERIFIED", "CONFIRMED_PRESENT", receipt);
  }

  completeAbsent(intentId: string, eventId: string, now: number, receipt: Record<string, unknown>): { intent: NotificationIntent; transition: TransitionRecord } {
    return this.finish(intentId, eventId, now, "effect-confirmed-absent", "ABORTED", "CONFIRMED_ABSENT", receipt);
  }

  returnAmbiguous(intentId: string, eventId: string, now: number): { intent: NotificationIntent; transition: TransitionRecord } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (before.controlState !== "EXECUTING" || before.effectState !== "RECONCILING") {
        throw new StateConflictError("only a reconciling intent can return to ambiguous");
      }
      return this.transition(before, eventId, now, "reconcile-inconclusive", "EXECUTING", "AMBIGUOUS", {}) as { intent: NotificationIntent; transition: TransitionRecord };
    });
  }

  assessEffectStart(
    intentId: string,
    eventId: string,
    now: number,
    startStatus: Exclude<EffectStartStatus, "UNKNOWN">,
    reason: string,
  ): { intent: NotificationIntent; transition: TransitionRecord | null } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (before.controlState !== "EXECUTING" || !["AMBIGUOUS", "RECONCILING"].includes(before.effectState)) {
        throw new StateConflictError("effect-start assessment requires an executing intent");
      }
      const latest = this.getLatestEffectClaimEvidence(intentId);
      if (!latest) throw new StateConflictError("effect claim is missing");
      if (latest.startStatus === "STARTED" && startStatus === "NOT_STARTED") {
        throw new StateConflictError("a started effect cannot be downgraded to not started");
      }
      if (latest.startStatus === startStatus) return { intent: before, transition: null };
      this.database.prepare("UPDATE effects SET start_status = ? WHERE effect_event_id = ?")
        .run(startStatus, latest.eventId);
      const transition = this.recordAttempt(before, eventId, now, "effect-start-assessed", {
        fromStartStatus: latest.startStatus,
        toStartStatus: startStatus,
        reason,
      });
      return { intent: before, transition };
    });
  }

  recordReplayStopped(
    intentId: string,
    eventId: string,
    now: number,
    details: Record<string, string | number | boolean | null>,
  ): { intent: NotificationIntent; transition: TransitionRecord } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (before.controlState !== "ABORTED" || before.effectState !== "CONFIRMED_ABSENT") {
        throw new StateConflictError("replay evaluation requires ABORTED/CONFIRMED_ABSENT");
      }
      const transition = this.recordAttempt(before, eventId, now, "confirmed-absent-replay-stopped", details);
      return { intent: before, transition };
    });
  }

  resetAfterAbsent(
    intentId: string,
    eventId: string,
    now: number,
    details: Record<string, string | number | boolean | null>,
  ): { intent: NotificationIntent; transition: TransitionRecord } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (before.controlState !== "ABORTED" || before.effectState !== "CONFIRMED_ABSENT") {
        throw new StateConflictError("retry reset requires ABORTED/CONFIRMED_ABSENT");
      }
      this.database.prepare(`
        UPDATE intents SET control_state = 'PROPOSED', effect_state = 'NOT_STARTED',
          approval_event_id = NULL, approval_target = NULL, approval_payload_digest = NULL,
          approval_expires_at = NULL, updated_at = ?, revision = revision + 1
        WHERE intent_id = ?
      `).run(now, intentId);
      const transition = this.makeTransition(
        before,
        eventId,
        now,
        "confirmed-absent-reproposed-after-six-checks",
        "PROPOSED",
        "NOT_STARTED",
        details,
      );
      this.insertAttempt(transition);
      return { intent: this.requireIntent(intentId), transition };
    });
  }

  countEffectClaims(intentId: string): number {
    const row = this.database.prepare("SELECT count(*) AS count FROM effects WHERE intent_id = ?").get(intentId) as { count: number };
    return Number(row.count);
  }

  countEffectStarts(intentId: string): number {
    const row = this.database.prepare(`
      SELECT count(*) AS count FROM effects
      WHERE intent_id = ? AND start_status != 'NOT_STARTED'
    `).get(intentId) as { count: number };
    return Number(row.count);
  }

  private finish(
    intentId: string,
    eventId: string,
    now: number,
    kind: string,
    control: ControlState,
    effect: EffectState,
    receipt: Record<string, unknown>,
  ): { intent: NotificationIntent; transition: TransitionRecord } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
      if (before.controlState !== "EXECUTING" || !["AMBIGUOUS", "RECONCILING"].includes(before.effectState)) {
        throw new StateConflictError(`completion requires executing ambiguous effect, got ${before.controlState}/${before.effectState}`);
      }
      const latest = this.database.prepare(`
        SELECT effect_event_id FROM effects WHERE intent_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1
      `).get(intentId) as { effect_event_id: string } | undefined;
      if (!latest) throw new StateConflictError("effect claim is missing");
      this.database.prepare("UPDATE effects SET outcome = ?, receipt_json = ? WHERE effect_event_id = ?")
        .run(effect, JSON.stringify(receipt), latest.effect_event_id);
      return this.transition(before, eventId, now, kind, control, effect, {
        receiptDigest: JSON.stringify(receipt).length,
      }) as { intent: NotificationIntent; transition: TransitionRecord };
    });
  }

  private transition(
    before: NotificationIntent,
    eventId: string,
    now: number,
    kind: string,
    control: ControlState,
    effect: EffectState,
    details: Record<string, string | number | boolean | null>,
  ): { intent: NotificationIntent; transition: TransitionRecord } {
    this.database.prepare(`
      UPDATE intents SET control_state = ?, effect_state = ?, updated_at = ?, revision = revision + 1 WHERE intent_id = ?
    `).run(control, effect, now, before.intentId);
    const transition = this.makeTransition(before, eventId, now, kind, control, effect, details);
    this.insertAttempt(transition);
    return { intent: this.requireIntent(before.intentId), transition };
  }

  private makeTransition(
    before: NotificationIntent,
    eventId: string,
    now: number,
    kind: string,
    control: ControlState,
    effect: EffectState,
    details: Record<string, string | number | boolean | null>,
  ): TransitionRecord {
    return {
      eventId,
      intentId: before.intentId,
      kind,
      occurredAt: now,
      fromControl: before.controlState,
      toControl: control,
      fromEffect: before.effectState,
      toEffect: effect,
      details,
    };
  }

  private recordAttempt(
    before: NotificationIntent,
    eventId: string,
    now: number,
    kind: string,
    details: Record<string, string | number | boolean | null>,
  ): TransitionRecord {
    const transition = this.makeTransition(
      before,
      eventId,
      now,
      kind,
      before.controlState,
      before.effectState,
      details,
    );
    this.insertAttempt(transition);
    return transition;
  }

  private insertAttempt(record: TransitionRecord): void {
    this.database.prepare(`
      INSERT INTO attempts (
        event_id, intent_id, kind, occurred_at, from_control, to_control,
        from_effect, to_effect, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.eventId,
      record.intentId,
      record.kind,
      record.occurredAt,
      record.fromControl,
      record.toControl,
      record.fromEffect,
      record.toEffect,
      JSON.stringify(record.details),
    );
  }

  private requireIntent(intentId: string): NotificationIntent {
    const intent = this.getIntent(intentId);
    if (!intent) throw new StateConflictError(`unknown intent ${intentId}`);
    return intent;
  }

  private toIntent(row: IntentRow): NotificationIntent {
    return {
      intentId: row.intent_id,
      logicalOperationId: row.logical_operation_id,
      title: row.title,
      body: row.body,
      target: row.target,
      payloadDigest: row.payload_digest,
      controlState: row.control_state,
      effectState: row.effect_state,
      approvalEventId: row.approval_event_id,
      approvalTarget: row.approval_target,
      approvalPayloadDigest: row.approval_payload_digest,
      approvalExpiresAt: row.approval_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revision: row.revision,
    };
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

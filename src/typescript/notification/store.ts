// information_uuid_v5=0930eb1a-bc57-5573-96f6-7b4942d43282
// event_uuid_v7=01a04872-04c9-72d5-b80b-adb45c7105a7
// machine-contract: one logical_operation_id owns one intent; state claims are serialized with BEGIN IMMEDIATE.
// event_uuid_v7=01a04893-376b-7148-8c50-845366465b93
// machine-contract: a suppressed duplicate or ambiguous retry is still persisted as a same-state attempt with its own UUIDv7.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
  eventId: string;
  now: number;
}

export class NotificationStore {
  readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
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
        outcome TEXT NOT NULL,
        receipt_json TEXT
      );
      CREATE INDEX IF NOT EXISTS attempts_intent_time ON attempts(intent_id, occurred_at);
      CREATE INDEX IF NOT EXISTS effects_intent_time ON effects(intent_id, started_at);
    `);
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
        details: { payloadDigest: record.payloadDigest, target: record.target },
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

  markDryRun(intentId: string, eventId: string, now: number): { intent: NotificationIntent; transition: TransitionRecord | null } {
    return this.transaction(() => {
      const before = this.requireIntent(intentId);
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
        INSERT INTO effects (effect_event_id, intent_id, started_at, outcome, receipt_json)
        VALUES (?, ?, ?, 'AMBIGUOUS', NULL)
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

  resetAfterAbsent(intentId: string, eventId: string, now: number): { intent: NotificationIntent; transition: TransitionRecord } {
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
      const transition = this.makeTransition(before, eventId, now, "confirmed-absent-reproposed", "PROPOSED", "NOT_STARTED", {});
      this.insertAttempt(transition);
      return { intent: this.requireIntent(intentId), transition };
    });
  }

  countEffectClaims(intentId: string): number {
    const row = this.database.prepare("SELECT count(*) AS count FROM effects WHERE intent_id = ?").get(intentId) as { count: number };
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

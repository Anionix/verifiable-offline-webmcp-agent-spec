// information_uuid_v5=fd2cf52a-0427-5987-ab5d-eab7d9faff43
// event_uuid_v7=01a04872-04fc-748e-9c06-62a3b55b0240
// machine-contract: DRY_RUN -> USER_APPROVED -> EXECUTING -> VERIFIED; AMBIGUOUS -> RECONCILING before any retry.
import { createHash } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { uuidV5, uuidV7 } from "../uuid.ts";
import { AuditLog } from "./audit-log.ts";
import { NotificationStore } from "./store.ts";
import {
  AmbiguousEffectError,
  ConfirmedAbsentError,
  ROOT_UUID_NAMESPACE,
  StateConflictError,
  type ApprovalReceipt,
  type NotificationAdapter,
  type NotificationIntent,
  type NotificationIntentInput,
  type NotificationPreview,
  type Presence,
  type TransitionRecord,
} from "./types.ts";

export interface EngineDependencies {
  store: NotificationStore;
  audit: AuditLog;
  now?: () => number;
  newEventId?: (epochMs: number) => string;
}

export type ExecutionOutcome =
  | { status: "VERIFIED"; intent: NotificationIntent }
  | { status: "ABORTED_CONFIRMED_ABSENT"; intent: NotificationIntent }
  | { status: "AMBIGUOUS"; intent: NotificationIntent }
  | { status: "ALREADY_VERIFIED"; intent: NotificationIntent }
  | { status: "RECONCILE_REQUIRED"; intent: NotificationIntent }
  | { status: "APPROVAL_EXPIRED"; intent: NotificationIntent };

function digest(value: CanonicalValue): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function normalizeText(value: string, label: string, maximum: number): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized || normalized.length > maximum) {
    throw new TypeError(`${label} must contain 1-${maximum} characters`);
  }
  return normalized;
}

export class NotificationEngine {
  readonly store: NotificationStore;
  readonly audit: AuditLog;
  private readonly now: () => number;
  private readonly newEventId: (epochMs: number) => string;

  constructor(dependencies: EngineDependencies) {
    this.store = dependencies.store;
    this.audit = dependencies.audit;
    this.now = dependencies.now ?? Date.now;
    this.newEventId = dependencies.newEventId ?? uuidV7;
  }

  createIntent(input: NotificationIntentInput): NotificationIntent {
    const logicalOperationId = normalizeText(input.logicalOperationId, "logicalOperationId", 128);
    if (!/^[\p{L}\p{N}._:@/-]+$/u.test(logicalOperationId)) {
      throw new TypeError("logicalOperationId contains unsupported characters");
    }
    const title = normalizeText(input.title, "title", 120);
    const body = normalizeText(input.body, "body", 1000);
    const target = input.target ?? "local-mac-notification";
    if (target !== "local-mac-notification") throw new TypeError("unsupported notification target");
    const payloadDigest = digest({ body, target, title });
    const intentId = uuidV5(ROOT_UUID_NAMESPACE, `notification-intent/${logicalOperationId}`);
    const now = this.now();
    const result = this.store.createIntent({
      intentId,
      logicalOperationId,
      title,
      body,
      target,
      payloadDigest,
      eventId: this.newEventId(now),
      now,
    });
    if (result.transition) this.append(result.transition);
    return result.intent;
  }

  async preview(intentId: string, adapter?: NotificationAdapter): Promise<NotificationPreview> {
    const now = this.now();
    const result = this.store.markDryRun(intentId, this.newEventId(now), now);
    if (result.transition) this.append(result.transition);
    if (adapter) return adapter.preview(result.intent);
    return this.toPreview(result.intent);
  }

  approve(intentId: string, validityMs = 120_000): ApprovalReceipt {
    if (!Number.isSafeInteger(validityMs) || validityMs < 1_000 || validityMs > 300_000) {
      throw new RangeError("approval validity must be between 1 and 300 seconds");
    }
    const now = this.now();
    const eventId = this.newEventId(now);
    const result = this.store.approve(intentId, eventId, now, now + validityMs);
    if (result.transition) this.append(result.transition);
    const intent = result.intent;
    if (!intent.approvalEventId || !intent.approvalExpiresAt || !intent.approvalTarget || !intent.approvalPayloadDigest) {
      throw new StateConflictError("approval receipt was not persisted");
    }
    return {
      eventId: intent.approvalEventId,
      intentId: intent.intentId,
      target: intent.approvalTarget,
      payloadDigest: intent.approvalPayloadDigest,
      approvedAt: now,
      expiresAt: intent.approvalExpiresAt,
    };
  }

  async execute(intentId: string, adapter: NotificationAdapter): Promise<ExecutionOutcome> {
    const now = this.now();
    const claim = this.store.claimExecution(intentId, this.newEventId(now), now);
    if (claim.status !== "CLAIMED") {
      if ("transition" in claim) this.append(claim.transition);
      return { status: claim.status, intent: claim.intent };
    }
    this.append(claim.transition);
    const approval = this.approvalFrom(claim.intent, now);
    try {
      const result = await adapter.execute(claim.intent, approval);
      if (result.presence === "PRESENT") return this.confirmPresent(intentId, result.receipt ?? {});
      if (result.presence === "ABSENT") return this.confirmAbsent(intentId, result.receipt ?? {});
      return { status: "AMBIGUOUS", intent: this.requireIntent(intentId) };
    } catch (error) {
      if (error instanceof ConfirmedAbsentError) return this.confirmAbsent(intentId, { reason: error.message });
      if (error instanceof AmbiguousEffectError) return { status: "AMBIGUOUS", intent: this.requireIntent(intentId) };
      return { status: "AMBIGUOUS", intent: this.requireIntent(intentId) };
    }
  }

  async reconcile(intentId: string, adapter: NotificationAdapter): Promise<ExecutionOutcome> {
    const start = this.beginReconcile(intentId);
    const presence = await adapter.reconcile(start);
    return this.finishReconcile(intentId, presence, { source: "adapter-readback" });
  }

  claimBrowserExecution(intentId: string):
    | { status: "COMMAND"; intent: NotificationIntent; command: { title: string; body: string; tag: string } }
    | Exclude<ExecutionOutcome, { status: "VERIFIED" } | { status: "ABORTED_CONFIRMED_ABSENT" } | { status: "AMBIGUOUS" }> {
    const now = this.now();
    const claim = this.store.claimExecution(intentId, this.newEventId(now), now);
    if (claim.status !== "CLAIMED") {
      if ("transition" in claim) this.append(claim.transition);
      return { status: claim.status, intent: claim.intent };
    }
    this.append(claim.transition);
    return {
      status: "COMMAND",
      intent: claim.intent,
      command: { title: claim.intent.title, body: claim.intent.body, tag: claim.intent.intentId },
    };
  }

  confirmBrowserReceipt(intentId: string, receipt: Record<string, unknown>): ExecutionOutcome {
    return this.confirmPresent(intentId, { ...receipt, source: "service-worker-readback" });
  }

  reconcileBrowser(intentId: string, presence: Presence): ExecutionOutcome {
    this.beginReconcile(intentId);
    return this.finishReconcile(intentId, presence, { source: "service-worker-getNotifications" });
  }

  resetAfterConfirmedAbsent(intentId: string): NotificationIntent {
    const now = this.now();
    const result = this.store.resetAfterAbsent(intentId, this.newEventId(now), now);
    this.append(result.transition);
    return result.intent;
  }

  getIntent(intentId: string): NotificationIntent | null {
    return this.store.getIntent(intentId);
  }

  private beginReconcile(intentId: string): NotificationIntent {
    const now = this.now();
    const result = this.store.beginReconcile(intentId, this.newEventId(now), now);
    this.append(result.transition);
    return result.intent;
  }

  private finishReconcile(intentId: string, presence: Presence, receipt: Record<string, unknown>): ExecutionOutcome {
    if (presence === "PRESENT") return this.confirmPresent(intentId, receipt);
    if (presence === "ABSENT") return this.confirmAbsent(intentId, receipt);
    const now = this.now();
    const result = this.store.returnAmbiguous(intentId, this.newEventId(now), now);
    this.append(result.transition);
    return { status: "AMBIGUOUS", intent: result.intent };
  }

  private confirmPresent(intentId: string, receipt: Record<string, unknown>): ExecutionOutcome {
    const now = this.now();
    const result = this.store.completePresent(intentId, this.newEventId(now), now, receipt);
    this.append(result.transition);
    return { status: "VERIFIED", intent: result.intent };
  }

  private confirmAbsent(intentId: string, receipt: Record<string, unknown>): ExecutionOutcome {
    const now = this.now();
    const result = this.store.completeAbsent(intentId, this.newEventId(now), now, receipt);
    this.append(result.transition);
    return { status: "ABORTED_CONFIRMED_ABSENT", intent: result.intent };
  }

  private approvalFrom(intent: NotificationIntent, now: number): ApprovalReceipt {
    if (
      !intent.approvalEventId
      || !intent.approvalTarget
      || !intent.approvalPayloadDigest
      || !intent.approvalExpiresAt
      || intent.approvalExpiresAt <= now
    ) throw new StateConflictError("valid approval is missing");
    return {
      eventId: intent.approvalEventId,
      intentId: intent.intentId,
      target: intent.approvalTarget,
      payloadDigest: intent.approvalPayloadDigest,
      approvedAt: intent.updatedAt,
      expiresAt: intent.approvalExpiresAt,
    };
  }

  private toPreview(intent: NotificationIntent): NotificationPreview {
    return {
      intentId: intent.intentId,
      logicalOperationId: intent.logicalOperationId,
      target: intent.target,
      title: intent.title,
      body: intent.body,
      payloadDigest: intent.payloadDigest,
      approvalRequired: true,
    };
  }

  private requireIntent(intentId: string): NotificationIntent {
    const intent = this.store.getIntent(intentId);
    if (!intent) throw new StateConflictError(`unknown intent ${intentId}`);
    return intent;
  }

  private append(transition: TransitionRecord): void {
    // machine-contract: state_transition=<fromControl>-><toControl> effect_transition=<fromEffect>-><toEffect>
    // event_id is UUIDv7; intent_id is UUIDv5. Audit append must succeed before any external adapter call.
    const verification = this.audit.verify();
    if (!verification.valid) throw new StateConflictError("audit chain is invalid; execution stopped");
    this.audit.append(transition);
  }
}

// information_uuid_v5=fd2cf52a-0427-5987-ab5d-eab7d9faff43
// event_uuid_v7=01a04872-04fc-748e-9c06-62a3b55b0240
// machine-contract: DRY_RUN -> USER_APPROVED -> EXECUTING -> VERIFIED; AMBIGUOUS -> RECONCILING before any retry.
// event_uuid_v7=01a048bc-86ba-79d9-8db9-31f8276c06e8
// machine-contract: effect-start evidence is exposed as a measured integer so the UI cannot claim a decorative count of one.
// information_uuid_v5=5b3dd6c4-39fd-57b2-98bc-842b8d7f88bc
// event_uuid_v7=01a0498b-5662-7094-9bef-88e9b2f13a10
// machine-contract: explicitly proven pre-effect failures count zero; STARTED and UNKNOWN claims count conservatively.
// information_uuid_v5=9ca3a8c3-2305-534c-a98f-8127cae34c23
// event_uuid_v7=01a04993-3867-7e11-b120-01b3bab8ec62
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T18:13:00.135Z
// machine-contract: a current ABSENT readback cannot erase an UNKNOWN historical effect start.
import { createHash } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import {
  ReplayBlockedError,
  evaluateReplayEvidence,
  sha256Canonical,
  verifyIndependentEffect,
  type EffectStartStatus,
  type EffectVerification,
  type RecordedPresence,
  type ReplayEvidence,
} from "../governance/replay-verification.ts";
import { uuidV5, uuidV7 } from "../uuid.ts";
import { AuditLog } from "./audit-log.ts";
import { internalInputProvenance, type InputProvenance } from "./input-provenance.ts";
import { NotificationStore, type StoredInputProvenanceEvidence } from "./store.ts";
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

export interface BrowserNotificationReadBack {
  activeTags: readonly string[];
}

const REPLAY_CONTRACT_VERSION = "0.1.0";

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
    const inputProvenance = input.inputProvenance ?? internalInputProvenance();
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
      inputProvenance,
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
      if (result.presence !== "UNKNOWN") {
        return await this.verifyAdapterReadBack(claim.intent, adapter, result.presence, "TOOL_RETURN");
      }
      return { status: "AMBIGUOUS", intent: this.requireIntent(intentId) };
    } catch (error) {
      if (error instanceof ConfirmedAbsentError) {
        this.assessEffectStart(intentId, "NOT_STARTED", "adapter-confirmed-failure-before-effect");
        return await this.verifyAdapterReadBack(claim.intent, adapter, "ABSENT", "TOOL_RETURN");
      }
      if (error instanceof AmbiguousEffectError) return { status: "AMBIGUOUS", intent: this.requireIntent(intentId) };
      return { status: "AMBIGUOUS", intent: this.requireIntent(intentId) };
    }
  }

  async reconcile(intentId: string, adapter: NotificationAdapter): Promise<ExecutionOutcome> {
    const intent = this.requireIntent(intentId);
    return this.verifyAdapterReadBack(intent, adapter, "UNKNOWN", "NO_RESPONSE");
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

  confirmBrowserReceipt(intentId: string, readBack: BrowserNotificationReadBack): ExecutionOutcome {
    const tags = this.validateBrowserTags(intentId, readBack, false);
    if (tags.length !== 1) throw new StateConflictError("confirmation requires exactly one active notification tag");
    return this.verifyBrowserReadBack(intentId, tags, "PRESENT", "BROWSER_SHOW_NOTIFICATION");
  }

  reconcileBrowser(intentId: string, readBack: BrowserNotificationReadBack): ExecutionOutcome {
    const tags = this.validateBrowserTags(intentId, readBack, true);
    const presence: Presence = tags.length === 0 ? "ABSENT" : "PRESENT";
    return this.verifyBrowserReadBack(intentId, tags, presence, "NO_RESPONSE");
  }

  resetAfterConfirmedAbsent(intentId: string, evidence: ReplayEvidence): NotificationIntent {
    const before = this.requireIntent(intentId);
    if (before.controlState !== "ABORTED" || before.effectState !== "CONFIRMED_ABSENT") {
      throw new StateConflictError("replay evaluation requires ABORTED/CONFIRMED_ABSENT");
    }
    const now = this.now();
    const evaluation = evaluateReplayEvidence({
      expectedIntentId: before.intentId,
      expectedPayloadDigest: before.payloadDigest,
      expectedVersion: REPLAY_CONTRACT_VERSION,
      expectedPreconditionDigest: this.replayPreconditionDigest(before),
      expectedEffectStartStatus: this.requireEffectClaim(intentId).startStatus,
      requiredFreshAfterEpochMs: before.updatedAt,
      nowEpochMs: now,
      evaluationEventId: this.newEventId(now),
      evidence,
    });
    const details = {
      replayDecision: evaluation.decision,
      passedGateCount: evaluation.gates.filter((gate) => gate.status === "PASS").length,
      blockedGates: evaluation.gates.filter((gate) => gate.status === "BLOCKED").map((gate) => gate.gate).join(","),
      replayContractVersion: REPLAY_CONTRACT_VERSION,
    };
    if (evaluation.decision === "STOP") {
      const stopped = this.store.recordReplayStopped(intentId, evaluation.evaluationEventId, now, details);
      this.append(stopped.transition);
      throw new ReplayBlockedError(evaluation);
    }
    const result = this.store.resetAfterAbsent(intentId, evaluation.evaluationEventId, now, details);
    this.append(result.transition);
    return result.intent;
  }

  replayPreconditionDigest(intent: NotificationIntent): string {
    return sha256Canonical({
      controlState: intent.controlState,
      effectState: intent.effectState,
      effectStartStatus: this.requireEffectClaim(intent.intentId).startStatus,
      intentId: intent.intentId,
      payloadDigest: intent.payloadDigest,
      revision: intent.revision,
    });
  }

  getIntent(intentId: string): NotificationIntent | null {
    return this.store.getIntent(intentId);
  }

  getEffectStartCount(intentId: string): number {
    if (!this.getIntent(intentId)) return 0;
    return this.store.countEffectStarts(intentId);
  }

  getInputProvenance(intentId: string): Readonly<InputProvenance> | null {
    return this.store.getInputProvenance(intentId);
  }

  getInputProvenanceEvidence(intentId: string): StoredInputProvenanceEvidence | null {
    return this.store.getInputProvenanceEvidence(intentId);
  }

  private beginReconcile(intentId: string): NotificationIntent {
    const now = this.now();
    const result = this.store.beginReconcile(intentId, this.newEventId(now), now);
    this.append(result.transition);
    return result.intent;
  }

  private async verifyAdapterReadBack(
    intent: NotificationIntent,
    adapter: NotificationAdapter,
    claimedPresence: RecordedPresence,
    claimSource: "TOOL_RETURN" | "NO_RESPONSE",
  ): Promise<ExecutionOutcome> {
    const start = this.beginReconcile(intent.intentId);
    let observedPresence: Presence;
    try {
      observedPresence = await adapter.reconcile(start);
    } catch {
      return this.finishReconcile(intent.intentId, "UNKNOWN", {
        source: "adapter-readback-error",
      });
    }
    const claim = this.requireEffectClaim(intent.intentId);
    const observedAtEpochMs = this.now();
    const verification = verifyIndependentEffect({
      expectedIntentId: intent.intentId,
      expectedPayloadDigest: intent.payloadDigest,
      nowEpochMs: observedAtEpochMs,
      recordedClaim: {
        intentId: intent.intentId,
        payloadDigest: intent.payloadDigest,
        claimEventId: claim.eventId,
        claimedAtEpochMs: claim.startedAt,
        claimedPresence,
        effectStartStatus: claim.startStatus,
        source: claimSource,
      },
      independentObservation: {
        intentId: intent.intentId,
        payloadDigest: intent.payloadDigest,
        observationEventId: this.newEventId(observedAtEpochMs),
        observedAtEpochMs,
        observedPresence,
        source: "INDEPENDENT_READ_BACK",
        method: "ADAPTER_RECONCILE",
      },
    });
    return this.finishIndependentVerification(intent.intentId, verification);
  }

  private verifyBrowserReadBack(
    intentId: string,
    activeTags: readonly string[],
    claimedPresence: RecordedPresence,
    claimSource: "BROWSER_SHOW_NOTIFICATION" | "NO_RESPONSE",
  ): ExecutionOutcome {
    const intent = this.beginReconcile(intentId);
    const claim = this.requireEffectClaim(intentId);
    const observedAtEpochMs = this.now();
    const verification = verifyIndependentEffect({
      expectedIntentId: intent.intentId,
      expectedPayloadDigest: intent.payloadDigest,
      nowEpochMs: observedAtEpochMs,
      recordedClaim: {
        intentId: intent.intentId,
        payloadDigest: intent.payloadDigest,
        claimEventId: claim.eventId,
        claimedAtEpochMs: claim.startedAt,
        claimedPresence,
        effectStartStatus: claim.startStatus,
        source: claimSource,
      },
      independentObservation: {
        intentId: intent.intentId,
        payloadDigest: intent.payloadDigest,
        observationEventId: this.newEventId(observedAtEpochMs),
        observedAtEpochMs,
        observedPresence: activeTags.length === 0 ? "ABSENT" : "PRESENT",
        source: "INDEPENDENT_READ_BACK",
        method: "SERVICE_WORKER_GET_NOTIFICATIONS",
      },
    });
    return this.finishIndependentVerification(intentId, verification);
  }

  private finishIndependentVerification(intentId: string, verification: EffectVerification): ExecutionOutcome {
    if (verification.decision === "VERIFY_PRESENT") {
      this.assessEffectStart(intentId, "STARTED", "independent-readback-confirmed-presence");
      return this.confirmPresent(intentId, { verification });
    }
    if (verification.decision === "VERIFY_ABSENT") return this.confirmAbsent(intentId, { verification });
    return this.finishReconcile(intentId, "UNKNOWN", {
      evidenceStatus: verification.truthEstimate.evidenceStatus,
      source: "independent-verification",
    });
  }

  private validateBrowserTags(intentId: string, readBack: BrowserNotificationReadBack, allowEmpty: boolean): readonly string[] {
    if (!readBack || !Array.isArray(readBack.activeTags)) throw new TypeError("activeTags must be an array");
    if (readBack.activeTags.length > 1) throw new StateConflictError("duplicate notification readback detected");
    if (!allowEmpty && readBack.activeTags.length === 0) throw new StateConflictError("active notification readback is empty");
    if (readBack.activeTags.some((tag) => typeof tag !== "string" || tag !== intentId)) {
      throw new StateConflictError("notification readback is bound to a different intent tag");
    }
    return Object.freeze([...readBack.activeTags]);
  }

  private requireEffectClaim(intentId: string): { eventId: string; startedAt: number; startStatus: EffectStartStatus } {
    const claim = this.store.getLatestEffectClaimEvidence(intentId);
    if (!claim) throw new StateConflictError("effect claim is missing");
    return claim;
  }

  private assessEffectStart(
    intentId: string,
    startStatus: Exclude<EffectStartStatus, "UNKNOWN">,
    reason: string,
  ): void {
    const now = this.now();
    const result = this.store.assessEffectStart(intentId, this.newEventId(now), now, startStatus, reason);
    if (result.transition) this.append(result.transition);
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

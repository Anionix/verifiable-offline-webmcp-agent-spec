// information_uuid_v5=d7ce8ad5-d504-5036-b097-1d1c51d63391
// event_uuid_v7=01a04972-bfde-799b-af03-519f7107c2ad
// state_transition=PROPOSED -> EXECUTING occurred_at=2026-08-28T17:37:32.126Z
// machine-contract: CONFIRMED_ABSENT -> SIX_FRESH_CHECKS -> PROPOSED; any failed check stops before a second effect claim.
// machine-contract: TOOL_CLAIM -> INDEPENDENT_READ_BACK -> TRUTH_ESTIMATE; a tool claim alone never establishes external truth.
// information_uuid_v5=9ca3a8c3-2305-534c-a98f-8127cae34c23
// event_uuid_v7=01a04993-3867-7e11-b120-01b3bab8ec62
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T18:13:00.135Z
// machine-contract: current ABSENT does not prove historical NOT_STARTED; UNKNOWN remains non-replayable and counts conservatively.
import { createHash, timingSafeEqual } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { isUuidVersion, uuidV7EpochMs } from "../uuid.ts";

const SHA_256 = /^[0-9a-f]{64}$/;

export type ReplayGateName =
  | "AUTHORIZATION"
  | "PERMISSION"
  | "VERSION"
  | "CONSENT"
  | "TIME_TO_LIVE"
  | "PRECONDITION";

export interface BoundReplayEvidence {
  intentId: string;
  payloadDigest: string;
  evidenceEventId: string;
  observedAtEpochMs: number;
}

export type EffectStartStatus = "STARTED" | "NOT_STARTED" | "UNKNOWN";

export interface ReplayEvidence {
  authorization: BoundReplayEvidence & {
    source: "AUTHORIZATION_POLICY";
    decision: "ALLOW" | "DENY" | "HUMAN";
  };
  permission: BoundReplayEvidence & {
    source: "HOST_PERMISSION_READBACK";
    state: "GRANTED" | "DENIED" | "PROMPT";
  };
  version: BoundReplayEvidence & {
    source: "VERSION_REGISTRY";
    requiredVersion: string;
    observedVersion: string;
  };
  consent: BoundReplayEvidence & {
    source: "USER_CONSENT_RECEIPT";
    expiresAtEpochMs: number;
  };
  timeToLive: BoundReplayEvidence & {
    source: "TRUSTED_CLOCK";
    queuedAtEpochMs: number;
    expiresAtEpochMs: number;
  };
  precondition: BoundReplayEvidence & {
    source: "INDEPENDENT_READ_BACK";
    priorEffectState: "CONFIRMED_ABSENT" | "AMBIGUOUS" | "CONFIRMED_PRESENT" | "NOT_STARTED";
    priorEffectStartStatus: EffectStartStatus;
    expectedDigest: string;
    observedDigest: string;
  };
}

export interface ReplayGateResult {
  gate: ReplayGateName;
  status: "PASS" | "BLOCKED";
  reason: string;
  evidenceEventId: string;
}

export interface ReplayEvaluation {
  evaluationEventId: string;
  evaluatedAtEpochMs: number;
  decision: "ALLOW_REPLAY" | "STOP";
  gates: readonly ReplayGateResult[];
  reasons: readonly string[];
}

export class ReplayBlockedError extends Error {
  readonly evaluation: ReplayEvaluation;

  constructor(evaluation: ReplayEvaluation) {
    super(`replay stopped: ${evaluation.reasons.join("; ")}`);
    this.name = "ReplayBlockedError";
    this.evaluation = evaluation;
  }
}

export type RecordedPresence = "PRESENT" | "ABSENT" | "UNKNOWN";

export interface RecordedEffectClaim {
  intentId: string;
  payloadDigest: string;
  claimEventId: string;
  claimedAtEpochMs: number;
  claimedPresence: RecordedPresence;
  effectStartStatus: EffectStartStatus;
  source: "TOOL_RETURN" | "BROWSER_SHOW_NOTIFICATION" | "NO_RESPONSE";
}

export interface IndependentEffectObservation {
  intentId: string;
  payloadDigest: string;
  observationEventId: string;
  observedAtEpochMs: number;
  observedPresence: RecordedPresence;
  source: "INDEPENDENT_READ_BACK";
  method: "ADAPTER_RECONCILE" | "SERVICE_WORKER_GET_NOTIFICATIONS";
}

export interface EffectTruthEstimate {
  presence: "CONFIRMED_PRESENT" | "CONFIRMED_ABSENT" | "INCONCLUSIVE" | "UNMEASURED";
  evidenceStatus: "CONFIRMED" | "INCONCLUSIVE" | "UNMEASURED";
  basisEventId: string | null;
  reason: string;
}

export interface EffectVerification {
  recordedClaim: Readonly<RecordedEffectClaim> | null;
  independentObservation: Readonly<IndependentEffectObservation> | null;
  truthEstimate: Readonly<EffectTruthEstimate>;
  decision: "VERIFY_PRESENT" | "VERIFY_ABSENT" | "RECONCILE";
}

export interface ReadBackPostcondition {
  expectedIntentId: string;
  expectedPayloadDigest: string;
  observedIntentId: string;
  observedPayloadDigest: string;
  expectedDigest: string;
  observedDigest: string;
  observationEventId: string;
  observedAtEpochMs: number;
  nowEpochMs: number;
  source: "INDEPENDENT_READ_BACK";
}

export interface ReadBackVerification {
  status: "MATCH" | "MISMATCH" | "INVALID_EVIDENCE";
  canCommit: boolean;
  reason: string;
  observationEventId: string;
}

export function sha256Canonical(value: CanonicalValue): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function sameDigest(left: string, right: string): boolean {
  if (!SHA_256.test(left) || !SHA_256.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function validEventTime(eventId: string, observedAtEpochMs: number): boolean {
  return Number.isSafeInteger(observedAtEpochMs)
    && isUuidVersion(eventId, 7)
    && uuidV7EpochMs(eventId) === observedAtEpochMs;
}

function boundEvidenceReason(
  evidence: BoundReplayEvidence,
  expectedIntentId: string,
  expectedPayloadDigest: string,
  requiredFreshAfterEpochMs: number,
  nowEpochMs: number,
): string | null {
  if (evidence.intentId !== expectedIntentId || !sameDigest(evidence.payloadDigest, expectedPayloadDigest)) {
    return "evidence is bound to a different intent or payload";
  }
  if (!validEventTime(evidence.evidenceEventId, evidence.observedAtEpochMs)) {
    return "evidence event identifier and timestamp do not match";
  }
  if (evidence.observedAtEpochMs < requiredFreshAfterEpochMs || evidence.observedAtEpochMs > nowEpochMs) {
    return "evidence is stale or from the future";
  }
  return null;
}

function gate(
  name: ReplayGateName,
  evidence: BoundReplayEvidence,
  commonFailure: string | null,
  specificFailure: string | null,
): ReplayGateResult {
  const reason = commonFailure ?? specificFailure;
  return Object.freeze({
    gate: name,
    status: reason ? "BLOCKED" : "PASS",
    reason: reason ?? "fresh trusted evidence matches the queued operation",
    evidenceEventId: evidence.evidenceEventId,
  });
}

export function evaluateReplayEvidence(input: {
  expectedIntentId: string;
  expectedPayloadDigest: string;
  expectedVersion: string;
  expectedPreconditionDigest: string;
  expectedEffectStartStatus: EffectStartStatus;
  requiredFreshAfterEpochMs: number;
  nowEpochMs: number;
  evaluationEventId: string;
  evidence: ReplayEvidence;
}): ReplayEvaluation {
  if (
    !isUuidVersion(input.expectedIntentId, 5)
    || !SHA_256.test(input.expectedPayloadDigest)
    || !SHA_256.test(input.expectedPreconditionDigest)
    || input.expectedVersion.length === 0
  ) {
    throw new TypeError("expected replay identity must be UUIDv5 plus SHA-256 payload digest");
  }
  if (!Number.isSafeInteger(input.nowEpochMs) || !Number.isSafeInteger(input.requiredFreshAfterEpochMs)) {
    throw new TypeError("replay evaluation times must be safe integers");
  }
  if (!validEventTime(input.evaluationEventId, input.nowEpochMs)) {
    throw new TypeError("replay evaluation UUIDv7 must encode the evaluation time");
  }
  const common = (evidence: BoundReplayEvidence) => boundEvidenceReason(
    evidence,
    input.expectedIntentId,
    input.expectedPayloadDigest,
    input.requiredFreshAfterEpochMs,
    input.nowEpochMs,
  );
  const results = [
    gate(
      "AUTHORIZATION",
      input.evidence.authorization,
      common(input.evidence.authorization),
      input.evidence.authorization.source === "AUTHORIZATION_POLICY" && input.evidence.authorization.decision === "ALLOW"
        ? null : "current authorization policy does not allow replay",
    ),
    gate(
      "PERMISSION",
      input.evidence.permission,
      common(input.evidence.permission),
      input.evidence.permission.source === "HOST_PERMISSION_READBACK" && input.evidence.permission.state === "GRANTED"
        ? null : "current host permission is not granted",
    ),
    gate(
      "VERSION",
      input.evidence.version,
      common(input.evidence.version),
      input.evidence.version.source === "VERSION_REGISTRY"
        && input.evidence.version.requiredVersion === input.expectedVersion
        && input.evidence.version.requiredVersion === input.evidence.version.observedVersion
        ? null : "required and observed versions differ",
    ),
    gate(
      "CONSENT",
      input.evidence.consent,
      common(input.evidence.consent),
      input.evidence.consent.source === "USER_CONSENT_RECEIPT"
        && Number.isSafeInteger(input.evidence.consent.expiresAtEpochMs)
        && input.evidence.consent.expiresAtEpochMs > input.nowEpochMs
        ? null : "bound user consent is missing or expired",
    ),
    gate(
      "TIME_TO_LIVE",
      input.evidence.timeToLive,
      common(input.evidence.timeToLive),
      input.evidence.timeToLive.source === "TRUSTED_CLOCK"
        && Number.isSafeInteger(input.evidence.timeToLive.queuedAtEpochMs)
        && Number.isSafeInteger(input.evidence.timeToLive.expiresAtEpochMs)
        && input.evidence.timeToLive.queuedAtEpochMs <= input.nowEpochMs
        && input.evidence.timeToLive.expiresAtEpochMs > input.nowEpochMs
        ? null : "queued operation lifetime is invalid or expired",
    ),
    gate(
      "PRECONDITION",
      input.evidence.precondition,
      common(input.evidence.precondition),
      input.evidence.precondition.source === "INDEPENDENT_READ_BACK"
        && input.evidence.precondition.priorEffectState === "CONFIRMED_ABSENT"
        && input.expectedEffectStartStatus === "NOT_STARTED"
        && input.evidence.precondition.priorEffectStartStatus === input.expectedEffectStartStatus
        && sameDigest(input.evidence.precondition.expectedDigest, input.expectedPreconditionDigest)
        && sameDigest(input.evidence.precondition.expectedDigest, input.evidence.precondition.observedDigest)
        ? null : "independent precondition readback does not confirm absence",
    ),
  ] as const;
  const reasons = results.filter((item) => item.status === "BLOCKED").map((item) => `${item.gate}: ${item.reason}`);
  return Object.freeze({
    evaluationEventId: input.evaluationEventId,
    evaluatedAtEpochMs: input.nowEpochMs,
    decision: reasons.length === 0 ? "ALLOW_REPLAY" : "STOP",
    gates: Object.freeze([...results]),
    reasons: Object.freeze(reasons),
  });
}

function validClaim(
  claim: RecordedEffectClaim,
  expectedIntentId: string,
  expectedPayloadDigest: string,
  nowEpochMs: number,
): boolean {
  return isUuidVersion(expectedIntentId, 5)
    && isUuidVersion(claim.intentId, 5)
    && ["TOOL_RETURN", "BROWSER_SHOW_NOTIFICATION", "NO_RESPONSE"].includes(claim.source)
    && ["PRESENT", "ABSENT", "UNKNOWN"].includes(claim.claimedPresence)
    && ["STARTED", "NOT_STARTED", "UNKNOWN"].includes(claim.effectStartStatus)
    && claim.intentId === expectedIntentId
    && sameDigest(claim.payloadDigest, expectedPayloadDigest)
    && validEventTime(claim.claimEventId, claim.claimedAtEpochMs)
    && claim.claimedAtEpochMs <= nowEpochMs;
}

function validObservation(
  observation: IndependentEffectObservation,
  expectedIntentId: string,
  expectedPayloadDigest: string,
  nowEpochMs: number,
): boolean {
  return observation.source === "INDEPENDENT_READ_BACK"
    && isUuidVersion(expectedIntentId, 5)
    && isUuidVersion(observation.intentId, 5)
    && ["ADAPTER_RECONCILE", "SERVICE_WORKER_GET_NOTIFICATIONS"].includes(observation.method)
    && ["PRESENT", "ABSENT", "UNKNOWN"].includes(observation.observedPresence)
    && observation.intentId === expectedIntentId
    && sameDigest(observation.payloadDigest, expectedPayloadDigest)
    && validEventTime(observation.observationEventId, observation.observedAtEpochMs)
    && observation.observedAtEpochMs <= nowEpochMs;
}

export function verifyIndependentEffect(input: {
  expectedIntentId: string;
  expectedPayloadDigest: string;
  nowEpochMs: number;
  recordedClaim: RecordedEffectClaim | null;
  independentObservation: IndependentEffectObservation | null;
}): EffectVerification {
  if (
    !isUuidVersion(input.expectedIntentId, 5)
    || !SHA_256.test(input.expectedPayloadDigest)
    || !Number.isSafeInteger(input.nowEpochMs)
  ) {
    throw new TypeError("effect verification requires a UUIDv5 intent, SHA-256 payload digest, and safe current time");
  }
  const claim = input.recordedClaim ? Object.freeze({ ...input.recordedClaim }) : null;
  const observation = input.independentObservation ? Object.freeze({ ...input.independentObservation }) : null;
  if (claim && !validClaim(claim, input.expectedIntentId, input.expectedPayloadDigest, input.nowEpochMs)) {
    return effectVerification(claim, observation, "RECONCILE", "INCONCLUSIVE", "INCONCLUSIVE", null, "recorded claim trace is invalid");
  }
  if (!observation) {
    return effectVerification(claim, null, "RECONCILE", "UNMEASURED", "UNMEASURED", null, "tool claim has no independent observation");
  }
  if (!validObservation(observation, input.expectedIntentId, input.expectedPayloadDigest, input.nowEpochMs)) {
    return effectVerification(claim, observation, "RECONCILE", "INCONCLUSIVE", "INCONCLUSIVE", null, "independent observation is invalid or bound elsewhere");
  }
  // machine-contract: CLAIMED_AT <= OBSERVED_AT <= NOW; an older readback cannot verify a newer effect claim.
  if (claim && observation.observedAtEpochMs < claim.claimedAtEpochMs) {
    return effectVerification(claim, observation, "RECONCILE", "INCONCLUSIVE", "INCONCLUSIVE", null, "independent observation predates the recorded effect claim");
  }
  if (observation.observedPresence === "UNKNOWN") {
    return effectVerification(claim, observation, "RECONCILE", "INCONCLUSIVE", "INCONCLUSIVE", observation.observationEventId, "independent readback is inconclusive");
  }
  if (observation.observedPresence === "PRESENT") {
    return effectVerification(claim, observation, "VERIFY_PRESENT", "CONFIRMED_PRESENT", "CONFIRMED", observation.observationEventId, "independent readback confirms presence");
  }
  if (!claim || claim.effectStartStatus !== "NOT_STARTED") {
    return effectVerification(
      claim,
      observation,
      "RECONCILE",
      "INCONCLUSIVE",
      "INCONCLUSIVE",
      observation.observationEventId,
      "current absence does not prove that the external effect never started",
    );
  }
  return effectVerification(claim, observation, "VERIFY_ABSENT", "CONFIRMED_ABSENT", "CONFIRMED", observation.observationEventId, "independent readback confirms absence");
}

function effectVerification(
  recordedClaim: Readonly<RecordedEffectClaim> | null,
  independentObservation: Readonly<IndependentEffectObservation> | null,
  decision: EffectVerification["decision"],
  presence: EffectTruthEstimate["presence"],
  evidenceStatus: EffectTruthEstimate["evidenceStatus"],
  basisEventId: string | null,
  reason: string,
): EffectVerification {
  return Object.freeze({
    recordedClaim,
    independentObservation,
    truthEstimate: Object.freeze({ presence, evidenceStatus, basisEventId, reason }),
    decision,
  });
}

export function verifyReadBackPostcondition(input: ReadBackPostcondition): ReadBackVerification {
  if (
    input.source !== "INDEPENDENT_READ_BACK"
    || !isUuidVersion(input.expectedIntentId, 5)
    || !isUuidVersion(input.observedIntentId, 5)
    || input.expectedIntentId !== input.observedIntentId
    || !sameDigest(input.expectedPayloadDigest, input.observedPayloadDigest)
    || !validEventTime(input.observationEventId, input.observedAtEpochMs)
    || !Number.isSafeInteger(input.nowEpochMs)
    || input.observedAtEpochMs > input.nowEpochMs
  ) {
    return Object.freeze({
      status: "INVALID_EVIDENCE",
      canCommit: false,
      reason: "readback identity, operation binding, source, or time is invalid",
      observationEventId: input.observationEventId,
    });
  }
  const matches = sameDigest(input.expectedDigest, input.observedDigest);
  return Object.freeze({
    status: matches ? "MATCH" : "MISMATCH",
    canCommit: matches,
    reason: matches ? "observed postcondition matches expected postcondition" : "observed postcondition differs from expected postcondition",
    observationEventId: input.observationEventId,
  });
}

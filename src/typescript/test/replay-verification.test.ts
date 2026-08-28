// information_uuid_v5=29daf230-cecb-5d34-bdc9-7d77dc357b5f
// event_uuid_v7=01a04972-c080-7410-a2b5-db184976a8cf
// state_transition=DRY_RUN -> VERIFIED occurred_at=2026-08-28T17:37:32.288Z
// machine-contract: TEST-OFFLINE-003 and TEST-VERIFY-001..003 prove six fresh replay checks plus independent truth estimation.
import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateReplayEvidence,
  sha256Canonical,
  verifyIndependentEffect,
  verifyReadBackPostcondition,
  type ReplayEvidence,
} from "../governance/replay-verification.ts";
import { ROOT_UUID_NAMESPACE } from "../notification/types.ts";
import { uuidV5, uuidV7 } from "../uuid.ts";

const NOW = 1_788_000_000_000;
const INTENT_ID = uuidV5(ROOT_UUID_NAMESPACE, "notification-intent/replay-verification-test");
const PAYLOAD_DIGEST = sha256Canonical({ body: "one", target: "local-mac-notification", title: "test" });
const PRECONDITION_DIGEST = sha256Canonical({ effectState: "CONFIRMED_ABSENT", intentId: INTENT_ID });

function bound() {
  return {
    intentId: INTENT_ID,
    payloadDigest: PAYLOAD_DIGEST,
    evidenceEventId: uuidV7(NOW),
    observedAtEpochMs: NOW,
  };
}

function validReplayEvidence(): ReplayEvidence {
  return {
    authorization: { ...bound(), source: "AUTHORIZATION_POLICY", decision: "ALLOW" },
    permission: { ...bound(), source: "HOST_PERMISSION_READBACK", state: "GRANTED" },
    version: { ...bound(), source: "VERSION_REGISTRY", requiredVersion: "0.1.0", observedVersion: "0.1.0" },
    consent: { ...bound(), source: "USER_CONSENT_RECEIPT", expiresAtEpochMs: NOW + 60_000 },
    timeToLive: { ...bound(), source: "TRUSTED_CLOCK", queuedAtEpochMs: NOW - 1_000, expiresAtEpochMs: NOW + 60_000 },
    precondition: {
      ...bound(),
      source: "INDEPENDENT_READ_BACK",
      priorEffectState: "CONFIRMED_ABSENT",
      priorEffectStartStatus: "NOT_STARTED",
      expectedDigest: PRECONDITION_DIGEST,
      observedDigest: PRECONDITION_DIGEST,
    },
  };
}

function evaluate(evidence: ReplayEvidence) {
  return evaluateReplayEvidence({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    expectedVersion: "0.1.0",
    expectedPreconditionDigest: PRECONDITION_DIGEST,
    expectedEffectStartStatus: "NOT_STARTED",
    requiredFreshAfterEpochMs: NOW - 1,
    nowEpochMs: NOW,
    evaluationEventId: uuidV7(NOW),
    evidence,
  });
}

test("TEST-OFFLINE-003: replay is allowed only after all six fresh checks pass", () => {
  const valid = evaluate(validReplayEvidence());
  assert.equal(valid.decision, "ALLOW_REPLAY");
  assert.deepEqual(valid.gates.map((item) => item.gate), [
    "AUTHORIZATION",
    "PERMISSION",
    "VERSION",
    "CONSENT",
    "TIME_TO_LIVE",
    "PRECONDITION",
  ]);
  assert.equal(valid.gates.every((item) => item.status === "PASS"), true);

  const failures: Array<readonly [string, (evidence: ReplayEvidence) => void]> = [
    ["AUTHORIZATION", (evidence) => { evidence.authorization.decision = "DENY"; }],
    ["PERMISSION", (evidence) => { evidence.permission.state = "DENIED"; }],
    ["VERSION", (evidence) => { evidence.version.observedVersion = "0.9.0"; }],
    ["CONSENT", (evidence) => { evidence.consent.expiresAtEpochMs = NOW; }],
    ["TIME_TO_LIVE", (evidence) => { evidence.timeToLive.expiresAtEpochMs = NOW; }],
    ["PRECONDITION", (evidence) => { evidence.precondition.priorEffectState = "AMBIGUOUS"; }],
  ];
  for (const [expectedGate, mutate] of failures) {
    const evidence = validReplayEvidence();
    mutate(evidence);
    const result = evaluate(evidence);
    assert.equal(result.decision, "STOP", expectedGate);
    assert.equal(result.gates.find((item) => item.gate === expectedGate)?.status, "BLOCKED", expectedGate);
  }
});

test("TEST-VERIFY-001: an observable write commits only when readback matches", () => {
  const expected = sha256Canonical({ status: "saved", value: 7 });
  const mismatch = verifyReadBackPostcondition({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    observedIntentId: INTENT_ID,
    observedPayloadDigest: PAYLOAD_DIGEST,
    expectedDigest: expected,
    observedDigest: sha256Canonical({ status: "saved", value: 8 }),
    observationEventId: uuidV7(NOW),
    observedAtEpochMs: NOW,
    nowEpochMs: NOW,
    source: "INDEPENDENT_READ_BACK",
  });
  assert.deepEqual({ status: mismatch.status, canCommit: mismatch.canCommit }, { status: "MISMATCH", canCommit: false });

  const match = verifyReadBackPostcondition({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    observedIntentId: INTENT_ID,
    observedPayloadDigest: PAYLOAD_DIGEST,
    expectedDigest: expected,
    observedDigest: expected,
    observationEventId: uuidV7(NOW),
    observedAtEpochMs: NOW,
    nowEpochMs: NOW,
    source: "INDEPENDENT_READ_BACK",
  });
  assert.deepEqual({ status: match.status, canCommit: match.canCommit }, { status: "MATCH", canCommit: true });

  const wrongOperation = verifyReadBackPostcondition({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    observedIntentId: uuidV5(ROOT_UUID_NAMESPACE, "notification-intent/different-operation"),
    observedPayloadDigest: PAYLOAD_DIGEST,
    expectedDigest: expected,
    observedDigest: expected,
    observationEventId: uuidV7(NOW),
    observedAtEpochMs: NOW,
    nowEpochMs: NOW,
    source: "INDEPENDENT_READ_BACK",
  });
  assert.deepEqual(
    { status: wrongOperation.status, canCommit: wrongOperation.canCommit },
    { status: "INVALID_EVIDENCE", canCommit: false },
  );

  const futureReadBack = verifyReadBackPostcondition({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    observedIntentId: INTENT_ID,
    observedPayloadDigest: PAYLOAD_DIGEST,
    expectedDigest: expected,
    observedDigest: expected,
    observationEventId: uuidV7(NOW + 1),
    observedAtEpochMs: NOW + 1,
    nowEpochMs: NOW,
    source: "INDEPENDENT_READ_BACK",
  });
  assert.deepEqual(
    { status: futureReadBack.status, canCommit: futureReadBack.canCommit },
    { status: "INVALID_EVIDENCE", canCommit: false },
  );
});

test("TEST-VERIFY-002: a tool claim alone cannot verify an external effect", () => {
  const recordedClaim = {
    intentId: INTENT_ID,
    payloadDigest: PAYLOAD_DIGEST,
    claimEventId: uuidV7(NOW),
    claimedAtEpochMs: NOW,
    claimedPresence: "PRESENT" as const,
    effectStartStatus: "STARTED" as const,
    source: "TOOL_RETURN" as const,
  };
  const withoutObservation = verifyIndependentEffect({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    nowEpochMs: NOW,
    recordedClaim,
    independentObservation: null,
  });
  assert.equal(withoutObservation.decision, "RECONCILE");
  assert.equal(withoutObservation.truthEstimate.presence, "UNMEASURED");

  const withObservation = verifyIndependentEffect({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    nowEpochMs: NOW,
    recordedClaim,
    independentObservation: {
      intentId: INTENT_ID,
      payloadDigest: PAYLOAD_DIGEST,
      observationEventId: uuidV7(NOW),
      observedAtEpochMs: NOW,
      observedPresence: "PRESENT",
      source: "INDEPENDENT_READ_BACK",
      method: "ADAPTER_RECONCILE",
    },
  });
  assert.equal(withObservation.decision, "VERIFY_PRESENT");
  assert.equal(withObservation.truthEstimate.evidenceStatus, "CONFIRMED");

  const staleObservation = verifyIndependentEffect({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    nowEpochMs: NOW,
    recordedClaim,
    independentObservation: {
      intentId: INTENT_ID,
      payloadDigest: PAYLOAD_DIGEST,
      observationEventId: uuidV7(NOW - 1),
      observedAtEpochMs: NOW - 1,
      observedPresence: "PRESENT",
      source: "INDEPENDENT_READ_BACK",
      method: "ADAPTER_RECONCILE",
    },
  });
  assert.equal(staleObservation.decision, "RECONCILE");
  assert.equal(staleObservation.truthEstimate.evidenceStatus, "INCONCLUSIVE");
  assert.match(staleObservation.truthEstimate.reason, /predates/);

  const absenceAfterUnknownStart = verifyIndependentEffect({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    nowEpochMs: NOW,
    recordedClaim: { ...recordedClaim, effectStartStatus: "UNKNOWN" },
    independentObservation: {
      intentId: INTENT_ID,
      payloadDigest: PAYLOAD_DIGEST,
      observationEventId: uuidV7(NOW),
      observedAtEpochMs: NOW,
      observedPresence: "ABSENT",
      source: "INDEPENDENT_READ_BACK",
      method: "ADAPTER_RECONCILE",
    },
  });
  assert.equal(absenceAfterUnknownStart.decision, "RECONCILE");
  assert.match(absenceAfterUnknownStart.truthEstimate.reason, /does not prove/);
});

test("TEST-VERIFY-003: recorded claim and independent truth remain separate", () => {
  const result = verifyIndependentEffect({
    expectedIntentId: INTENT_ID,
    expectedPayloadDigest: PAYLOAD_DIGEST,
    nowEpochMs: NOW,
    recordedClaim: {
      intentId: INTENT_ID,
      payloadDigest: PAYLOAD_DIGEST,
      claimEventId: uuidV7(NOW),
      claimedAtEpochMs: NOW,
      claimedPresence: "ABSENT",
      effectStartStatus: "NOT_STARTED",
      source: "TOOL_RETURN",
    },
    independentObservation: {
      intentId: INTENT_ID,
      payloadDigest: PAYLOAD_DIGEST,
      observationEventId: uuidV7(NOW),
      observedAtEpochMs: NOW,
      observedPresence: "PRESENT",
      source: "INDEPENDENT_READ_BACK",
      method: "ADAPTER_RECONCILE",
    },
  });
  assert.equal(result.recordedClaim?.claimedPresence, "ABSENT");
  assert.equal(result.independentObservation?.observedPresence, "PRESENT");
  assert.equal(result.truthEstimate.presence, "CONFIRMED_PRESENT");
  assert.notStrictEqual(result.recordedClaim, result.truthEstimate);
});

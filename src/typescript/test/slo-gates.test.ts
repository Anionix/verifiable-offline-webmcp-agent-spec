// information_uuid_v5=b694cbe1-f6f9-5f0a-99a7-e042ee3d70d0
// event_uuid_v7=01a049a3-edbb-76f1-af65-5b3afd0e8015
// state_transition=EXECUTING -> VERIFIED occurred_at=2026-08-28T18:31:15.131Z
// machine-contract: TEST-SLO-001..006 each has a deterministic passing fixture and a counterexample that must STOP.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  evaluateSloGates,
  sloPayloadDigest,
  type EvidenceSection,
  type SloGateEvaluation,
  type SloGateInput,
  type SloTestId,
} from "../governance/slo-gates.ts";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../../..");
const inputPath = resolve(repositoryRoot, "data/slo-gate-input.synthetic.json");
const evidencePath = resolve(repositoryRoot, "metadata/slo-gate-verification.json");

function fixture(): SloGateInput {
  return JSON.parse(readFileSync(inputPath, "utf8")) as SloGateInput;
}

function rebind(section: EvidenceSection<unknown>): void {
  section.provenance.payloadDigest = sloPayloadDigest(section.payload as never);
}

function gate(result: SloGateEvaluation, testId: SloTestId) {
  const found = result.gates.find((item) => item.testId === testId);
  assert.ok(found, `missing ${testId}`);
  return found;
}

test("the public synthetic fixture passes all six gates and matches generated evidence", () => {
  const result = evaluateSloGates(fixture());
  assert.equal(result.decision, "PASS");
  assert.equal(result.evidenceClass, "SYNTHETIC");
  assert.deepEqual(result.gates.map((item) => item.testId), [
    "TEST-SLO-001",
    "TEST-SLO-002",
    "TEST-SLO-003",
    "TEST-SLO-004",
    "TEST-SLO-005",
    "TEST-SLO-006",
  ]);
  assert.equal(result.gates.every((item) => item.status === "PASS"), true);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as { status: string; evaluation: SloGateEvaluation };
  assert.equal(evidence.status, "VERIFIED_SYNTHETIC");
  assert.deepEqual(evidence.evaluation, result);
});

test("TEST-SLO-001: service rate equal to or below arrival rate stops capacity approval", () => {
  const input = fixture();
  input.queue.payload.serviceCompletionCount = input.queue.payload.arrivalCount;
  rebind(input.queue);
  const result = gate(evaluateSloGates(input), "TEST-SLO-001");
  assert.equal(result.status, "STOP");
  assert.match(result.reasons.join(" "), /service rate must be greater/);
});

test("TEST-SLO-002: a Little-law mismatch and incomplete waiting cohort both stop", () => {
  const mismatch = fixture();
  mismatch.queue.payload.queueAreaItemMs = 30000;
  rebind(mismatch.queue);
  const mismatchGate = gate(evaluateSloGates(mismatch), "TEST-SLO-002");
  assert.equal(mismatchGate.status, "STOP");
  assert.match(mismatchGate.reasons.join(" "), /inconsistent/);

  const incomplete = fixture();
  incomplete.queue.payload.waitingSampleCount = 9;
  rebind(incomplete.queue);
  const incompleteGate = gate(evaluateSloGates(incomplete), "TEST-SLO-002");
  assert.equal(incompleteGate.status, "STOP");
  assert.match(incompleteGate.reasons.join(" "), /cover every arrival/);
});

test("TEST-SLO-003: calibration uses validation labels and ignores model self-report", () => {
  const base = fixture();
  const baseGate = gate(evaluateSloGates(base), "TEST-SLO-003");
  const changedSelfReport = fixture();
  for (const sample of changedSelfReport.calibration.payload.samples) {
    sample.llmSelfReportedConfidencePpm = sample.llmSelfReportedConfidencePpm === 1 ? 999999 : 1;
  }
  rebind(changedSelfReport.calibration);
  const changedGate = gate(evaluateSloGates(changedSelfReport), "TEST-SLO-003");
  assert.deepEqual(changedGate.metrics, baseGate.metrics);
  assert.equal(changedGate.metrics.selfReportedConfidenceUsed, false);

  const wrongRole = fixture();
  (wrongRole.calibration.payload as { datasetRole: string }).datasetRole = "TRAINING";
  rebind(wrongRole.calibration);
  assert.equal(gate(evaluateSloGates(wrongRole), "TEST-SLO-003").status, "STOP");

  const miscalibrated = fixture();
  for (const sample of miscalibrated.calibration.payload.samples) {
    sample.modelScorePpm = 1_000_000;
    sample.outcome = 0;
  }
  rebind(miscalibrated.calibration);
  const miscalibratedGate = gate(evaluateSloGates(miscalibrated), "TEST-SLO-003");
  assert.equal(miscalibratedGate.status, "STOP");
  assert.match(miscalibratedGate.reasons.join(" "), /calibration error|Brier/);
});

test("TEST-SLO-004: negative or non-conserving probability mass stops", () => {
  const negative = fixture();
  negative.outcomeMass.payload.qB = -1;
  rebind(negative.outcomeMass);
  assert.equal(gate(evaluateSloGates(negative), "TEST-SLO-004").status, "STOP");

  const wrongTotal = fixture();
  wrongTotal.outcomeMass.payload.qH += 1;
  rebind(wrongTotal.outcomeMass);
  const wrongTotalGate = gate(evaluateSloGates(wrongTotal), "TEST-SLO-004");
  assert.equal(wrongTotalGate.status, "STOP");
  assert.match(wrongTotalGate.reasons.join(" "), /sum exactly/);
});

test("TEST-SLO-005: bad-commit and duplicate limits are hard constraints", () => {
  const bad = fixture();
  bad.chanceConstraints.payload.badCommitUpperBoundNumerator = 2;
  bad.chanceConstraints.payload.objectiveScoreMicroUnits = Number.MAX_SAFE_INTEGER;
  rebind(bad.chanceConstraints);
  const badGate = gate(evaluateSloGates(bad), "TEST-SLO-005");
  assert.equal(badGate.status, "STOP");
  assert.equal(badGate.metrics.objectiveScoreUsedForSafetyDecision, false);
  assert.match(badGate.reasons.join(" "), /bad-commit probability/);

  const duplicate = fixture();
  duplicate.chanceConstraints.payload.duplicateEffectUpperBoundNumerator = 1001;
  rebind(duplicate.chanceConstraints);
  const duplicateGate = gate(evaluateSloGates(duplicate), "TEST-SLO-005");
  assert.equal(duplicateGate.status, "STOP");
  assert.match(duplicateGate.reasons.join(" "), /duplicate-effect probability/);

  const measuredWithoutBound = fixture();
  measuredWithoutBound.chanceConstraints.provenance.evidenceClass = "MEASURED";
  measuredWithoutBound.chanceConstraints.provenance.illustrative = false;
  measuredWithoutBound.chanceConstraints.provenance.sourceKind = "RUNTIME_MEASUREMENT";
  measuredWithoutBound.chanceConstraints.provenance.measurementEnvironment = "deterministic-test-host";
  const measuredGate = gate(evaluateSloGates(measuredWithoutBound), "TEST-SLO-005");
  assert.equal(measuredGate.status, "STOP");
  assert.match(measuredGate.reasons.join(" "), /one-sided upper bounds|confidence level/);
});

test("TEST-SLO-006: mixed, mislabeled, or digest-unbound evidence stops", () => {
  const mixed = fixture();
  mixed.calibration.provenance.evidenceClass = "MEASURED";
  mixed.calibration.provenance.illustrative = false;
  mixed.calibration.provenance.sourceKind = "RUNTIME_MEASUREMENT";
  mixed.calibration.provenance.measurementEnvironment = "fixture-host";
  const mixedGate = gate(evaluateSloGates(mixed), "TEST-SLO-006");
  assert.equal(mixedGate.status, "STOP");
  assert.match(mixedGate.reasons.join(" "), /cannot be mixed/);

  const mislabeled = fixture();
  mislabeled.queue.provenance.illustrative = false;
  const mislabeledGate = gate(evaluateSloGates(mislabeled), "TEST-SLO-006");
  assert.equal(mislabeledGate.status, "STOP");
  assert.match(mislabeledGate.reasons.join(" "), /must be labeled illustrative/);

  const unbound = fixture();
  unbound.queue.payload.arrivalCount += 1;
  const unboundGate = gate(evaluateSloGates(unbound), "TEST-SLO-006");
  assert.equal(unboundGate.status, "STOP");
  assert.match(unboundGate.reasons.join(" "), /payload digest/);

  const nonCanonical = fixture();
  nonCanonical.queue.payload.arrivalCount = 1.5;
  const nonCanonicalGate = gate(evaluateSloGates(nonCanonical), "TEST-SLO-006");
  assert.equal(nonCanonicalGate.status, "STOP");
  assert.match(nonCanonicalGate.reasons.join(" "), /canonical safe-integer JSON/);
});

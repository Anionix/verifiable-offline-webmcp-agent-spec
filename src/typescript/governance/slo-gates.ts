// information_uuid_v5=b694cbe1-f6f9-5f0a-99a7-e042ee3d70d0
// event_uuid_v7=01a049a3-edb5-741c-961e-dfbb6c4b5c73
// state_transition=PROPOSED -> EXECUTING occurred_at=2026-08-28T18:31:15.125Z
// machine-contract: SYNTHETIC and MEASURED evidence never share one decision; malformed provenance stops its bound gate.
// machine-contract: SERVICE_RATE <= ARRIVAL_RATE, probability-mass error, or either chance-limit breach returns STOP without objective-score override.
// machine-contract: calibration reads model scores and validation labels only; llmSelfReportedConfidencePpm is retained as input evidence but never used.
import { createHash, timingSafeEqual } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { isUuidVersion, uuidV7EpochMs } from "../uuid.ts";

export const PARTS_PER_MILLION = 1_000_000;
export const PARTS_PER_BILLION = 1_000_000_000;
const SHA_256 = /^[0-9a-f]{64}$/;

export type EvidenceClass = "SYNTHETIC" | "MEASURED";
export type SloTestId =
  | "TEST-SLO-001"
  | "TEST-SLO-002"
  | "TEST-SLO-003"
  | "TEST-SLO-004"
  | "TEST-SLO-005"
  | "TEST-SLO-006";

export interface SloEvidenceProvenance {
  datasetId: string;
  eventId: string;
  observedAtEpochMs: number;
  evidenceClass: EvidenceClass;
  illustrative: boolean;
  sourceKind: "DETERMINISTIC_FIXTURE" | "RUNTIME_MEASUREMENT";
  measurementEnvironment?: string;
  payloadDigest: string;
}

export interface EvidenceSection<TPayload> {
  provenance: SloEvidenceProvenance;
  payload: TPayload;
}

export interface QueueGatePayload {
  observationDurationMs: number;
  arrivalCount: number;
  serviceBusyDurationMs: number;
  serviceCompletionCount: number;
  queueAreaItemMs: number;
  waitingTimeTotalMs: number;
  waitingSampleCount: number;
  maximumLittleLawRelativeErrorPpm: number;
}

export interface CalibrationSample {
  modelScorePpm: number;
  outcome: 0 | 1;
  llmSelfReportedConfidencePpm?: number;
}

export interface CalibrationGatePayload {
  datasetRole: "VALIDATION";
  binCount: number;
  maximumExpectedCalibrationErrorPpm: number;
  maximumBrierScorePpm: number;
  samples: CalibrationSample[];
}

export interface OutcomeMassPayload {
  qT: number;
  qB: number;
  qR: number;
  qH: number;
  scalePpm: number;
}

export interface ChanceConstraintPayload {
  probabilityBasis: "EXACT_SYNTHETIC" | "MEASURED_ONE_SIDED_UPPER_BOUND";
  confidenceLevelPpm?: number;
  badCommitUpperBoundNumerator: number;
  badCommitUpperBoundDenominator: number;
  duplicateEffectUpperBoundNumerator: number;
  duplicateEffectUpperBoundDenominator: number;
  maximumBadCommitPpb: number;
  maximumDuplicateEffectPpb: number;
  objectiveScoreMicroUnits: number;
}

export interface SloGateInput {
  schemaVersion: "1.0.0";
  evaluation: {
    reportUuidV5: string;
    eventUuidV7: string;
    evaluatedAtEpochMs: number;
  };
  queue: EvidenceSection<QueueGatePayload>;
  calibration: EvidenceSection<CalibrationGatePayload>;
  outcomeMass: EvidenceSection<OutcomeMassPayload>;
  chanceConstraints: EvidenceSection<ChanceConstraintPayload>;
  sourceRefs: readonly string[];
}

export interface SloGateResult {
  testId: SloTestId;
  status: "PASS" | "STOP";
  reasons: readonly string[];
  metrics: Readonly<Record<string, string | number | boolean>>;
}

export interface SloGateEvaluation {
  schemaVersion: "1.0.0";
  identity: {
    uuidV5: string;
    uuidV7: string;
  };
  temporal: {
    evaluatedAtEpochMs: number;
    evaluatedAt: string;
    timeZone: "UTC";
  };
  decision: "PASS" | "STOP";
  evidenceClass: EvidenceClass | "MIXED_OR_INVALID";
  gates: readonly SloGateResult[];
  selfReportedConfidenceUsed: false;
  sourceRefs: readonly string[];
}

interface ProvenanceAssessment {
  sectionErrors: Record<"queue" | "calibration" | "outcomeMass" | "chanceConstraints", readonly string[]>;
  commonErrors: readonly string[];
  evidenceClass: EvidenceClass | "MIXED_OR_INVALID";
}

function safeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function sameDigest(left: string, right: string): boolean {
  if (!SHA_256.test(left) || !SHA_256.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function sloPayloadDigest(payload: CanonicalValue): string {
  return createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex");
}

function scaledFloor(numerator: bigint, denominator: bigint, scale: bigint): number {
  if (denominator <= 0n) return 0;
  const value = numerator * scale / denominator;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
  return Number(value);
}

function gate(
  testId: SloTestId,
  reasons: readonly string[],
  metrics: Record<string, string | number | boolean>,
): SloGateResult {
  return Object.freeze({
    testId,
    status: reasons.length === 0 ? "PASS" : "STOP",
    reasons: Object.freeze([...reasons]),
    metrics: Object.freeze({ ...metrics }),
  });
}

function provenanceErrors(provenance: SloEvidenceProvenance, payload: CanonicalValue): string[] {
  const errors: string[] = [];
  if (!isUuidVersion(provenance.datasetId, 5)) errors.push("datasetId must be UUIDv5");
  if (
    !safeInteger(provenance.observedAtEpochMs)
    || !isUuidVersion(provenance.eventId, 7)
    || uuidV7EpochMs(provenance.eventId) !== provenance.observedAtEpochMs
  ) errors.push("event UUIDv7 must encode observedAtEpochMs");
  try {
    if (!sameDigest(provenance.payloadDigest, sloPayloadDigest(payload))) {
      errors.push("payload digest does not bind this evidence");
    }
  } catch {
    errors.push("payload must use canonical safe-integer JSON");
  }
  if (provenance.evidenceClass === "SYNTHETIC") {
    if (!provenance.illustrative) errors.push("synthetic evidence must be labeled illustrative");
    if (provenance.sourceKind !== "DETERMINISTIC_FIXTURE") errors.push("synthetic evidence must use deterministic-fixture provenance");
  } else if (provenance.evidenceClass === "MEASURED") {
    if (provenance.illustrative) errors.push("measured evidence cannot be labeled illustrative");
    if (provenance.sourceKind !== "RUNTIME_MEASUREMENT") errors.push("measured evidence must use runtime-measurement provenance");
    if (!provenance.measurementEnvironment?.trim()) errors.push("measured evidence requires a measurement environment");
  } else {
    errors.push("evidence class must be SYNTHETIC or MEASURED");
  }
  return errors;
}

function assessProvenance(input: SloGateInput): ProvenanceAssessment {
  const entries = {
    queue: input.queue,
    calibration: input.calibration,
    outcomeMass: input.outcomeMass,
    chanceConstraints: input.chanceConstraints,
  } as const;
  const sectionErrors = Object.fromEntries(
    Object.entries(entries).map(([name, section]) => [name, Object.freeze(provenanceErrors(section.provenance, section.payload as unknown as CanonicalValue))]),
  ) as ProvenanceAssessment["sectionErrors"];
  const classes = new Set(Object.values(entries).map((section) => section.provenance.evidenceClass));
  const commonErrors: string[] = [];
  if (classes.size !== 1) commonErrors.push("synthetic and measured evidence cannot be mixed in one decision");
  const onlyClass = classes.size === 1 ? [...classes][0] : undefined;
  const validClass = onlyClass === "SYNTHETIC" || onlyClass === "MEASURED" ? onlyClass : "MIXED_OR_INVALID";
  return { sectionErrors, commonErrors: Object.freeze(commonErrors), evidenceClass: validClass };
}

function evaluateCapacity(
  section: EvidenceSection<QueueGatePayload>,
  provenance: ProvenanceAssessment,
): readonly [SloGateResult, SloGateResult] {
  const value = section.payload;
  const inputErrors = [...provenance.sectionErrors.queue];
  if (!safeInteger(value.observationDurationMs, 1)) inputErrors.push("observationDurationMs must be positive");
  if (!safeInteger(value.arrivalCount, 1)) inputErrors.push("arrivalCount must be positive");
  if (!safeInteger(value.serviceBusyDurationMs, 1)) inputErrors.push("serviceBusyDurationMs must be positive");
  if (!safeInteger(value.serviceCompletionCount)) inputErrors.push("serviceCompletionCount must be non-negative");
  if (!safeInteger(value.queueAreaItemMs)) inputErrors.push("queueAreaItemMs must be non-negative");
  if (!safeInteger(value.waitingTimeTotalMs)) inputErrors.push("waitingTimeTotalMs must be non-negative");
  if (!safeInteger(value.waitingSampleCount, 1)) inputErrors.push("waitingSampleCount must be positive");
  if (!safeInteger(value.maximumLittleLawRelativeErrorPpm, 0, PARTS_PER_MILLION)) {
    inputErrors.push("Little-law tolerance must be 0..1,000,000 ppm");
  }

  const duration = safeInteger(value.observationDurationMs, 1) ? BigInt(value.observationDurationMs) : 1n;
  const arrivals = safeInteger(value.arrivalCount, 1) ? BigInt(value.arrivalCount) : 0n;
  const serviceDuration = safeInteger(value.serviceBusyDurationMs, 1) ? BigInt(value.serviceBusyDurationMs) : 1n;
  const completions = safeInteger(value.serviceCompletionCount) ? BigInt(value.serviceCompletionCount) : 0n;
  const arrivalRatePpmPerSecond = scaledFloor(arrivals * 1000n, duration, BigInt(PARTS_PER_MILLION));
  const serviceRatePpmPerSecond = scaledFloor(completions * 1000n, serviceDuration, BigInt(PARTS_PER_MILLION));
  const strictCapacityMargin = completions * duration > arrivals * serviceDuration;
  const capacityReasons = [...inputErrors];
  if (inputErrors.length === 0 && !strictCapacityMargin) {
    capacityReasons.push("average service rate must be greater than average arrival rate");
  }

  const littleReasons = [...inputErrors];
  if (inputErrors.length === 0 && value.waitingSampleCount !== value.arrivalCount) {
    littleReasons.push("waiting-time cohort must cover every arrival in this deterministic window");
  }
  const queueArea = safeInteger(value.queueAreaItemMs) ? BigInt(value.queueAreaItemMs) : 0n;
  const waitingTotal = safeInteger(value.waitingTimeTotalMs) ? BigInt(value.waitingTimeTotalMs) : 0n;
  const waitingCount = safeInteger(value.waitingSampleCount, 1) ? BigInt(value.waitingSampleCount) : 1n;
  const observedProduct = queueArea * waitingCount;
  const expectedProduct = arrivals * waitingTotal;
  const difference = observedProduct >= expectedProduct
    ? observedProduct - expectedProduct
    : expectedProduct - observedProduct;
  const littleLawRelativeErrorPpm = scaledFloor(difference, expectedProduct > 0n ? expectedProduct : 1n, BigInt(PARTS_PER_MILLION));
  if (
    littleReasons.length === 0
    && difference * BigInt(PARTS_PER_MILLION) > BigInt(value.maximumLittleLawRelativeErrorPpm) * expectedProduct
  ) littleReasons.push("observed queue length is inconsistent with arrival rate times waiting time");

  const observedMeanQueueLengthPpm = scaledFloor(queueArea, duration, BigInt(PARTS_PER_MILLION));
  const expectedMeanQueueLengthPpm = scaledFloor(expectedProduct, duration * waitingCount, BigInt(PARTS_PER_MILLION));
  return Object.freeze([
    gate("TEST-SLO-001", capacityReasons, {
      arrivalRatePpmPerSecond,
      serviceRatePpmPerSecond,
      strictCapacityMargin,
    }),
    gate("TEST-SLO-002", littleReasons, {
      observedMeanQueueLengthPpm,
      expectedMeanQueueLengthPpm,
      littleLawRelativeErrorPpm,
      maximumLittleLawRelativeErrorPpm: value.maximumLittleLawRelativeErrorPpm,
      completeWaitingCohort: value.waitingSampleCount === value.arrivalCount,
    }),
  ]);
}

function evaluateCalibration(
  section: EvidenceSection<CalibrationGatePayload>,
  provenance: ProvenanceAssessment,
): SloGateResult {
  const value = section.payload;
  const reasons = [...provenance.sectionErrors.calibration];
  if (value.datasetRole !== "VALIDATION") reasons.push("calibration data must have VALIDATION role");
  if (!safeInteger(value.binCount, 1, 100)) reasons.push("binCount must be 1..100");
  if (!safeInteger(value.maximumExpectedCalibrationErrorPpm, 0, PARTS_PER_MILLION)) reasons.push("invalid calibration-error limit");
  if (!safeInteger(value.maximumBrierScorePpm, 0, PARTS_PER_MILLION)) reasons.push("invalid Brier-score limit");
  if (!Array.isArray(value.samples) || value.samples.length === 0) reasons.push("validation samples are required");
  const validSamples = Array.isArray(value.samples) && value.samples.every((sample) =>
    safeInteger(sample.modelScorePpm, 0, PARTS_PER_MILLION) && (sample.outcome === 0 || sample.outcome === 1));
  if (!validSamples) reasons.push("model scores and validation labels are invalid");

  let expectedCalibrationErrorNumerator = 0n;
  let brierNumerator = 0n;
  if (validSamples && safeInteger(value.binCount, 1, 100)) {
    const bins = Array.from({ length: value.binCount }, () => ({ scoreTotal: 0n, positives: 0n }));
    for (const sample of value.samples) {
      const binIndex = Math.min(value.binCount - 1, Math.floor(sample.modelScorePpm * value.binCount / PARTS_PER_MILLION));
      bins[binIndex]!.scoreTotal += BigInt(sample.modelScorePpm);
      bins[binIndex]!.positives += BigInt(sample.outcome);
      const difference = BigInt(sample.modelScorePpm - sample.outcome * PARTS_PER_MILLION);
      brierNumerator += difference * difference;
    }
    expectedCalibrationErrorNumerator = bins.reduce((total, bin) => {
      const observedTotal = bin.positives * BigInt(PARTS_PER_MILLION);
      return total + (bin.scoreTotal >= observedTotal ? bin.scoreTotal - observedTotal : observedTotal - bin.scoreTotal);
    }, 0n);
  }
  const sampleCount = Array.isArray(value.samples) ? value.samples.length : 0;
  const denominator = BigInt(Math.max(sampleCount, 1));
  const expectedCalibrationErrorPpm = scaledFloor(expectedCalibrationErrorNumerator, denominator, 1n);
  const brierScorePpm = scaledFloor(brierNumerator, denominator * BigInt(PARTS_PER_MILLION), 1n);
  const calibrationInputsValid = reasons.length === 0;
  if (
    calibrationInputsValid
    && expectedCalibrationErrorNumerator > BigInt(value.maximumExpectedCalibrationErrorPpm) * denominator
  ) reasons.push("validation expected-calibration error exceeds the hard limit");
  if (
    calibrationInputsValid
    && brierNumerator > BigInt(value.maximumBrierScorePpm) * denominator * BigInt(PARTS_PER_MILLION)
  ) reasons.push("validation Brier score exceeds the hard limit");
  return gate("TEST-SLO-003", reasons, {
    datasetRole: String(value.datasetRole),
    validationSampleCount: sampleCount,
    binCount: value.binCount,
    expectedCalibrationErrorPpm,
    maximumExpectedCalibrationErrorPpm: value.maximumExpectedCalibrationErrorPpm,
    brierScorePpm,
    maximumBrierScorePpm: value.maximumBrierScorePpm,
    selfReportedConfidenceUsed: false,
  });
}

function evaluateOutcomeMass(
  section: EvidenceSection<OutcomeMassPayload>,
  provenance: ProvenanceAssessment,
): SloGateResult {
  const value = section.payload;
  const reasons = [...provenance.sectionErrors.outcomeMass];
  const components = [value.qT, value.qB, value.qR, value.qH];
  if (!components.every((item) => safeInteger(item))) reasons.push("all outcome masses must be non-negative safe integers");
  if (value.scalePpm !== PARTS_PER_MILLION) reasons.push("outcome scale must equal 1,000,000 ppm");
  const total = components.every((item) => safeInteger(item)) ? components.reduce((sum, item) => sum + item, 0) : -1;
  if (total !== value.scalePpm) reasons.push("qT, qB, qR, and qH must sum exactly to the declared scale");
  return gate("TEST-SLO-004", reasons, {
    qT: value.qT,
    qB: value.qB,
    qR: value.qR,
    qH: value.qH,
    totalPpm: total,
    scalePpm: value.scalePpm,
  });
}

function evaluateChanceConstraints(
  section: EvidenceSection<ChanceConstraintPayload>,
  provenance: ProvenanceAssessment,
): SloGateResult {
  const value = section.payload;
  const reasons = [...provenance.sectionErrors.chanceConstraints];
  const boundsValid = safeInteger(value.badCommitUpperBoundNumerator)
    && safeInteger(value.badCommitUpperBoundDenominator, 1)
    && safeInteger(value.duplicateEffectUpperBoundNumerator)
    && safeInteger(value.duplicateEffectUpperBoundDenominator, 1)
    && value.badCommitUpperBoundNumerator <= value.badCommitUpperBoundDenominator
    && value.duplicateEffectUpperBoundNumerator <= value.duplicateEffectUpperBoundDenominator;
  if (!boundsValid) reasons.push("chance-constraint upper-bound fractions are invalid");
  if (section.provenance.evidenceClass === "SYNTHETIC" && value.probabilityBasis !== "EXACT_SYNTHETIC") {
    reasons.push("synthetic probabilities must be labeled exact synthetic values");
  }
  if (section.provenance.evidenceClass === "MEASURED") {
    if (value.probabilityBasis !== "MEASURED_ONE_SIDED_UPPER_BOUND") {
      reasons.push("measured probabilities must be one-sided upper bounds");
    }
    if (!safeInteger(value.confidenceLevelPpm, 950_000, PARTS_PER_MILLION)) {
      reasons.push("measured upper bounds require confidence level of at least 950,000 ppm");
    }
  }
  if (!safeInteger(value.maximumBadCommitPpb, 0, PARTS_PER_BILLION)) reasons.push("invalid bad-commit limit");
  if (!safeInteger(value.maximumDuplicateEffectPpb, 0, PARTS_PER_BILLION)) reasons.push("invalid duplicate-effect limit");
  if (!safeInteger(value.objectiveScoreMicroUnits)) reasons.push("objective score must be a non-negative safe integer");

  const badNumerator = boundsValid ? BigInt(value.badCommitUpperBoundNumerator) : 0n;
  const badDenominator = boundsValid ? BigInt(value.badCommitUpperBoundDenominator) : 1n;
  const duplicateNumerator = boundsValid ? BigInt(value.duplicateEffectUpperBoundNumerator) : 0n;
  const duplicateDenominator = boundsValid ? BigInt(value.duplicateEffectUpperBoundDenominator) : 1n;
  const badCommitUpperBoundPpb = scaledFloor(badNumerator, badDenominator, BigInt(PARTS_PER_BILLION));
  const duplicateEffectUpperBoundPpb = scaledFloor(duplicateNumerator, duplicateDenominator, BigInt(PARTS_PER_BILLION));
  const chanceInputsValid = reasons.length === 0;
  if (
    chanceInputsValid
    && badNumerator * BigInt(PARTS_PER_BILLION) > BigInt(value.maximumBadCommitPpb) * badDenominator
  ) reasons.push("bad-commit probability exceeds its hard chance constraint");
  if (
    chanceInputsValid
    && duplicateNumerator * BigInt(PARTS_PER_BILLION) > BigInt(value.maximumDuplicateEffectPpb) * duplicateDenominator
  ) reasons.push("duplicate-effect probability exceeds its hard chance constraint");
  return gate("TEST-SLO-005", reasons, {
    probabilityBasis: String(value.probabilityBasis),
    confidenceLevelPpm: value.confidenceLevelPpm ?? 0,
    badCommitUpperBoundFraction: `${value.badCommitUpperBoundNumerator}/${value.badCommitUpperBoundDenominator}`,
    badCommitUpperBoundPpb,
    maximumBadCommitPpb: value.maximumBadCommitPpb,
    duplicateEffectUpperBoundFraction: `${value.duplicateEffectUpperBoundNumerator}/${value.duplicateEffectUpperBoundDenominator}`,
    duplicateEffectUpperBoundPpb,
    maximumDuplicateEffectPpb: value.maximumDuplicateEffectPpb,
    objectiveScoreMicroUnits: value.objectiveScoreMicroUnits,
    objectiveScoreUsedForSafetyDecision: false,
  });
}

function evaluateEvidenceClass(provenance: ProvenanceAssessment): SloGateResult {
  const reasons = [...provenance.commonErrors];
  for (const [section, errors] of Object.entries(provenance.sectionErrors)) {
    reasons.push(...errors.map((reason) => `${section}: ${reason}`));
  }
  return gate("TEST-SLO-006", reasons, {
    evidenceClass: provenance.evidenceClass,
    mixedEvidence: provenance.evidenceClass === "MIXED_OR_INVALID",
    syntheticExplicitlyIllustrative: provenance.evidenceClass === "SYNTHETIC" && reasons.length === 0,
    productionQualityMeasured: provenance.evidenceClass === "MEASURED" && reasons.length === 0,
  });
}

export function evaluateSloGates(input: SloGateInput): SloGateEvaluation {
  if (input.schemaVersion !== "1.0.0") throw new TypeError("unsupported SLO gate schema version");
  if (
    !isUuidVersion(input.evaluation.reportUuidV5, 5)
    || !safeInteger(input.evaluation.evaluatedAtEpochMs)
    || !isUuidVersion(input.evaluation.eventUuidV7, 7)
    || uuidV7EpochMs(input.evaluation.eventUuidV7) !== input.evaluation.evaluatedAtEpochMs
  ) throw new TypeError("SLO evaluation identity must be UUIDv5 plus time-matching UUIDv7");
  if (
    !Array.isArray(input.sourceRefs)
    || new Set(input.sourceRefs).size < 2
    || input.sourceRefs.some((source) => !/^SRC-[A-Z0-9-]+$/.test(source))
  ) {
    throw new TypeError("SLO evaluation requires at least two primary-source references");
  }
  const provenance = assessProvenance(input);
  const capacity = evaluateCapacity(input.queue, provenance);
  const gates = Object.freeze([
    ...capacity,
    evaluateCalibration(input.calibration, provenance),
    evaluateOutcomeMass(input.outcomeMass, provenance),
    evaluateChanceConstraints(input.chanceConstraints, provenance),
    evaluateEvidenceClass(provenance),
  ]);
  return Object.freeze({
    schemaVersion: "1.0.0",
    identity: Object.freeze({ uuidV5: input.evaluation.reportUuidV5, uuidV7: input.evaluation.eventUuidV7 }),
    temporal: Object.freeze({
      evaluatedAtEpochMs: input.evaluation.evaluatedAtEpochMs,
      evaluatedAt: new Date(input.evaluation.evaluatedAtEpochMs).toISOString(),
      timeZone: "UTC" as const,
    }),
    decision: gates.every((item) => item.status === "PASS") ? "PASS" : "STOP",
    evidenceClass: provenance.evidenceClass,
    gates,
    selfReportedConfidenceUsed: false,
    sourceRefs: Object.freeze([...input.sourceRefs]),
  });
}

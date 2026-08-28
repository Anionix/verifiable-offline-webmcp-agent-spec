// information_uuid_v5=b694cbe1-f6f9-5f0a-99a7-e042ee3d70d0
// event_uuid_v7=01a049a3-edbb-76f1-af65-5b3afd0e8015
// state_transition=EXECUTING -> VERIFIED occurred_at=2026-08-28T18:31:15.131Z
// machine-contract: only a six-gate PASS may write public evidence; synthetic evidence never claims measured production quality.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSloGates, type SloGateInput } from "../governance/slo-gates.ts";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../../..");
const inputPath = resolve(repositoryRoot, "data/slo-gate-input.synthetic.json");
const outputPath = resolve(repositoryRoot, "metadata/slo-gate-verification.json");
const relativePath = (path: string) => relative(repositoryRoot, path).replaceAll("\\", "/");

const inputBytes = readFileSync(inputPath);
const input = JSON.parse(inputBytes.toString("utf8")) as SloGateInput;
const evaluation = evaluateSloGates(input);
if (
  evaluation.decision !== "PASS"
  || evaluation.evidenceClass !== "SYNTHETIC"
  || evaluation.selfReportedConfidenceUsed
  || evaluation.gates.length !== 6
  || evaluation.gates.some((item) => item.status !== "PASS")
) throw new Error("SLO invariants failed; public evidence was not written");

const evidence = {
  schemaVersion: "1.0.0",
  id: "EVID-SLO-GATE-VERIFICATION-001",
  identity: evaluation.identity,
  temporal: evaluation.temporal,
  status: "VERIFIED_SYNTHETIC",
  evidenceState: {
    deterministicSyntheticFixture: "CONFIRMED",
    productionRuntimeQuality: "UNMEASURED",
    modelSelfReportedConfidenceUsed: false,
    syntheticMeasuredMixing: "CONFIRMED_ABSENT",
  },
  evaluation,
  scope: {
    actualRuntimeMeasurements: 0,
    actualExternalEffects: 0,
    actualExternalSpendYen: 0,
    localHardwareAndDevelopmentCost: "UNMEASURED",
  },
  artifacts: {
    input: relativePath(inputPath),
    inputSha256: createHash("sha256").update(inputBytes).digest("hex"),
    implementation: "src/typescript/governance/slo-gates.ts",
    tests: "src/typescript/test/slo-gates.test.ts",
  },
  testIds: evaluation.gates.map((item) => item.testId),
  requirements: ["REQ-SYNC-005", "REQ-SYNC-006", "REQ-VERIFY-002", "REQ-SLO-001", "REQ-SLO-002", "REQ-SLO-003"],
  sourceRefs: evaluation.sourceRefs,
  limitations: [
    "All published values in this evidence record are deterministic synthetic fixtures, not production measurements.",
    "Passing this fixture proves gate behavior and counterexample rejection; it does not establish production availability, latency, calibration, bad-commit rate, or duplicate rate.",
  ],
};
writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o644 });
console.log(`SLO gate evidence written: ${relativePath(outputPath)}`);

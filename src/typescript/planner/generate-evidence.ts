// information_uuid_v5=2f5571ca-93cf-549a-b13b-082691a9f31c
// event_uuid_v7=01a0493d-49b8-7cda-869b-c9a1eb0ee559
// machine-contract: VERIFIED_SCRIPTED_MATRIX -> PUBLIC_DIGESTED_EVIDENCE; generation aborts before writing if privacy, retry, authority, or external-effect invariants fail.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "./audit-log.ts";
import { runOnlinePlannerSimulation } from "./simulation.ts";
import { PLANNER_VERSION, type OnlinePlannerVerificationEvidence, type PlannerStopReason } from "./types.ts";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../../..");
const evidencePath = resolve(repositoryRoot, "metadata/online-planner-verification.json");
const auditPath = resolve(repositoryRoot, "data/audit/online-planner-events.ndjson");
const requestPath = resolve(repositoryRoot, "examples/online-planner-demo/request.sample.json");
const relativePath = (path: string) => relative(repositoryRoot, path).replaceAll("\\", "/");

const result = await runOnlinePlannerSimulation();
const expectedOutcomesMatched = result.scenarios.every(item => item.result.status === item.expected);
const accepted = result.scenarios.filter(item => item.result.status === "UNTRUSTED_PROPOSAL");
const disabledLocal = result.scenarios.some(item => item.name === "disabled" && item.result.status === "LOCAL_READY");
const offlineLocal = result.scenarios.some(item => item.name === "offline" && item.result.status === "LOCAL_READY");
const strictTools = result.sampleRequest.tools.every(tool => tool.strict && tool.parameters.additionalProperties === false);
const allowlistApplied = result.sampleRequest.tool_choice.type === "allowed_tools";
if (
  !expectedOutcomesMatched
  || !disabledLocal
  || !offlineLocal
  || !strictTools
  || !allowlistApplied
  || !result.auditValid
  || result.actualNetworkRequests !== 0
  || result.actualExternalSpendMicroUsd !== 0
  || result.authorizationCreated !== 0
  || result.externalEffectStarts !== 0
  || result.automaticRetries !== 0
  || result.privacyValuesExposed !== false
  || accepted.length !== 1
) throw new Error("planner invariants failed; public evidence was not written");

const auditBytes = Buffer.from(result.auditEvents.map(event => JSON.stringify(event)).join("\n") + "\n", "utf8");
const requestBytes = Buffer.from(JSON.stringify(result.sampleRequest, null, 2) + "\n", "utf8");
for (const path of [evidencePath, auditPath, requestPath]) mkdirSync(dirname(path), { recursive: true });
writeFileSync(auditPath, auditBytes, { mode: 0o644 });
writeFileSync(requestPath, requestBytes, { mode: 0o644 });

const stopReasons = [...new Set(result.scenarios
  .filter(item => item.result.status === "STOPPED")
  .map(item => item.result.reason as PlannerStopReason))].sort();
const evidence: OnlinePlannerVerificationEvidence = {
  schemaVersion: PLANNER_VERSION,
  identity: result.identity,
  temporal: { observedAt: result.observedAt, epochMs: result.observedAtEpochMs, timeZone: "UTC" },
  status: "VERIFIED",
  scope: {
    mode: "LOCAL_SCRIPTED_SIMULATION",
    actualNetworkRequests: result.actualNetworkRequests,
    actualExternalSpendMicroUsd: result.actualExternalSpendMicroUsd,
    authorizationCreated: result.authorizationCreated,
    externalEffectStarts: result.externalEffectStarts,
    localHardwareAndDevelopmentCost: "UNMEASURED",
  },
  observations: {
    scenarioCount: result.scenarios.length,
    expectedOutcomesMatched: true,
    localPathAvailableWhenDisabled: true,
    localPathAvailableWhenOffline: true,
    privacyValuesExposed: false,
    acceptedCandidateCount: 1,
    acceptedCandidateStatus: "UNTRUSTED_PROPOSAL",
    automaticRetries: 0,
    auditChainValid: true,
    stopReasons,
  },
  requestContract: {
    store: result.sampleRequest.store,
    background: result.sampleRequest.background,
    parallelToolCalls: result.sampleRequest.parallel_tool_calls,
    strictTools: true,
    allowlistApplied: true,
  },
  artifacts: {
    auditLedger: "data/audit/online-planner-events.ndjson",
    requestSample: "examples/online-planner-demo/request.sample.json",
    sha256: {
      [relativePath(auditPath)]: sha256Hex(auditBytes),
      [relativePath(requestPath)]: sha256Hex(requestBytes),
    },
  },
  requirements: ["REQ-PLAN-001", "REQ-PLAN-002", "REQ-PLAN-003", "REQ-OFFLINE-001", "REQ-POLICY-005", "REQ-SEC-006"],
  limitations: {
    liveResponsesApiConformance: "INCONCLUSIVE",
    currentProductionPricing: "UNMEASURED",
    productionQuality: "UNMEASURED",
  },
};
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o644 });
console.log(`online planner evidence written: ${relativePath(evidencePath)}`);

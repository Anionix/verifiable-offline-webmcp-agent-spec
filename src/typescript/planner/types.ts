// information_uuid_v5=899d504c-698c-5a48-850a-4dd2d83fc61e
// event_uuid_v7=01a0493d-49b3-7897-875e-2feb30033fdc
// machine-contract: LOCAL_READY -> PREFLIGHT -> UNTRUSTED_PROPOSAL | STOPPED; a planner can never create authorization or start an external effect.
import type { CanonicalValue } from "../canonical.ts";

export const PLANNER_VERSION = "0.5.0" as const;
export const PLANNER_UUID_NAMESPACE = "47f3e535-0e27-559a-9556-aa79a84f95eb";

export type DataClassification = "PUBLIC" | "PERSONAL" | "SECRET";

export interface PlannerContextField {
  key: string;
  value: string;
  classification: DataClassification;
}

export interface PlannerTask {
  taskId: string;
  taskKind: string;
  goal: PlannerContextField;
  context: readonly PlannerContextField[];
}

export type StrictScalarSchema =
  | { type: "string"; minLength?: number; maxLength?: number; enum?: readonly string[] }
  | { type: "integer"; minimum?: number; maximum?: number }
  | { type: "boolean" };

export interface StrictObjectSchema {
  type: "object";
  additionalProperties: false;
  properties: Readonly<Record<string, StrictSchema>>;
  required: readonly string[];
}

export type StrictSchema = StrictScalarSchema | StrictObjectSchema;

export interface PlannerToolContract {
  name: string;
  description: string;
  feasible: boolean;
  proposalOnly: true;
  createsAuthorization: false;
  startsExternalEffect: false;
  inputSchema: StrictObjectSchema;
}

export interface PlannerLimits {
  maxOutputTokens: number;
  maxLatencyMs: number;
  maxCostMicroUsd: number;
}

export interface PlannerRateCard {
  model: string;
  inputMicroUsdPerMillionTokens: number;
  outputMicroUsdPerMillionTokens: number;
  observedAt: string;
  validUntil: string;
  source: "OPERATOR_SUPPLIED" | "SIMULATED";
  trusted: boolean;
}

export interface PlannerPolicy {
  onlinePlanningEnabled: boolean;
  networkAvailable: boolean;
  model: string;
  allowedToolNames: readonly string[];
  allowedContextKeys: readonly string[];
  requiredContextKeys: readonly string[];
  limits: PlannerLimits;
  rateCard: PlannerRateCard | null;
}

export interface ResponsesFunctionTool {
  type: "function";
  name: string;
  description: string;
  parameters: StrictObjectSchema;
  strict: true;
}

export interface ResponsesPlannerRequest {
  model: string;
  input: readonly [{
    role: "user";
    content: readonly [{ type: "input_text"; text: string }];
  }];
  tools: readonly ResponsesFunctionTool[];
  tool_choice: {
    type: "allowed_tools";
    mode: "required";
    tools: readonly { type: "function"; name: string }[];
  };
  parallel_tool_calls: false;
  max_output_tokens: number;
  store: false;
  background: false;
  safety_identifier: string;
}

export interface ResponsesFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

export interface ResponsesPlannerResponse {
  status: string;
  output: readonly unknown[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface PlannerTransportContext {
  signal: AbortSignal;
}

export interface ResponsesPlannerTransport {
  readonly mode: "SIMULATED" | "PRODUCTION_BOUNDARY";
  send(request: Readonly<ResponsesPlannerRequest>, context: PlannerTransportContext): Promise<ResponsesPlannerResponse>;
}

export type PlannerStopReason =
  | "ONLINE_PLANNING_DISABLED"
  | "NETWORK_UNAVAILABLE"
  | "INVALID_TASK"
  | "NO_FEASIBLE_TOOLS"
  | "PRIVACY_REQUIRED_FIELD"
  | "SENSITIVE_VALUE_DETECTED"
  | "COST_UNMEASURED"
  | "COST_LIMIT_EXCEEDED"
  | "TIMEOUT"
  | "RESPONSE_LOST"
  | "TRANSPORT_FAILED"
  | "INCOMPLETE_RESPONSE"
  | "NO_TOOL_CALL"
  | "MULTIPLE_TOOL_CALLS"
  | "UNKNOWN_TOOL"
  | "INVALID_CALL_ID"
  | "INVALID_ARGUMENTS";

export interface PlannerCandidate {
  candidateId: string;
  status: "UNTRUSTED_PROPOSAL";
  toolName: string;
  callId: string;
  arguments: CanonicalValue;
  authorization: "NOT_CREATED";
  externalEffectStarts: 0;
}

export interface PlannerRunBase {
  runId: string;
  taskId: string;
  occurredAt: string;
  occurredAtEpochMs: number;
  mode: "LOCAL_ONLY" | "SIMULATED_REMOTE" | "PRODUCTION_BOUNDARY";
  transportAttempts: 0 | 1;
  automaticRetries: 0;
  authorizationCreated: 0;
  externalEffectStarts: 0;
  exposedToolNames: readonly string[];
  disclosedContextKeys: readonly string[];
  estimatedCostMicroUsd: number | null;
  observedCostMicroUsd: number | null;
  requestDigest: string | null;
}

export type PlannerRunResult =
  | (PlannerRunBase & { status: "LOCAL_READY"; reason: "ONLINE_PLANNING_DISABLED" | "NETWORK_UNAVAILABLE" })
  | (PlannerRunBase & { status: "STOPPED"; reason: Exclude<PlannerStopReason, "ONLINE_PLANNING_DISABLED" | "NETWORK_UNAVAILABLE"> })
  | (PlannerRunBase & { status: "UNTRUSTED_PROPOSAL"; reason: null; candidate: PlannerCandidate });

export type PlannerAuditKind =
  | "preflight-started"
  | "local-path-kept"
  | "preflight-stopped"
  | "request-started"
  | "response-stopped"
  | "candidate-recorded";

export interface PlannerAuditEventCore {
  version: typeof PLANNER_VERSION;
  eventId: string;
  occurredAt: string;
  occurredAtEpochMs: number;
  sequence: number;
  previousHash: string;
  runId: string;
  taskId: string;
  kind: PlannerAuditKind;
  fromState: string;
  toState: string;
  reason: PlannerStopReason | "CANDIDATE_ONLY" | null;
  inputDigest: string;
  requestDigest: string | null;
  disclosedContextKeys: readonly string[];
  exposedToolNames: readonly string[];
  transportAttempts: 0 | 1;
  automaticRetries: 0;
  authorizationCreated: 0;
  externalEffectStarts: 0;
}

export interface PlannerAuditEvent extends PlannerAuditEventCore {
  recordHash: string;
}

export interface PlannerScenarioSummary {
  name: string;
  expected: "LOCAL_READY" | "STOPPED" | "UNTRUSTED_PROPOSAL";
  result: PlannerRunResult;
}

export interface OnlinePlannerVerificationEvidence {
  schemaVersion: typeof PLANNER_VERSION;
  identity: { uuidV5: string; uuidV7: string; uuidNamespace: string };
  temporal: { observedAt: string; epochMs: number; timeZone: "UTC" };
  status: "VERIFIED";
  scope: {
    mode: "LOCAL_SCRIPTED_SIMULATION";
    actualNetworkRequests: 0;
    actualExternalSpendMicroUsd: 0;
    authorizationCreated: 0;
    externalEffectStarts: 0;
    localHardwareAndDevelopmentCost: "UNMEASURED";
  };
  observations: {
    scenarioCount: number;
    expectedOutcomesMatched: true;
    localPathAvailableWhenDisabled: true;
    localPathAvailableWhenOffline: true;
    privacyValuesExposed: false;
    acceptedCandidateCount: 1;
    acceptedCandidateStatus: "UNTRUSTED_PROPOSAL";
    automaticRetries: 0;
    auditChainValid: true;
    stopReasons: readonly PlannerStopReason[];
  };
  requestContract: {
    store: false;
    background: false;
    parallelToolCalls: false;
    strictTools: true;
    allowlistApplied: true;
  };
  artifacts: {
    auditLedger: "data/audit/online-planner-events.ndjson";
    requestSample: "examples/online-planner-demo/request.sample.json";
    sha256: Readonly<Record<string, string>>;
  };
  requirements: readonly ["REQ-PLAN-001", "REQ-PLAN-002", "REQ-PLAN-003", "REQ-OFFLINE-001", "REQ-POLICY-005", "REQ-SEC-006"];
  limitations: {
    liveResponsesApiConformance: "INCONCLUSIVE";
    currentProductionPricing: "UNMEASURED";
    productionQuality: "UNMEASURED";
  };
}

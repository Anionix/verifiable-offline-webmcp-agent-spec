// information_uuid_v5=e92eb6fd-3951-59fd-ba61-ad2f9e453596
// event_uuid_v7=01a0493d-49b7-7deb-8d62-58e9d61a61b0
// machine-contract: SCRIPTED_SCENARIOS -> LOCAL_READY | STOPPED | UNTRUSTED_PROPOSAL; simulated transport starts are observable but real network requests and external effects remain zero.
import type { CanonicalValue } from "../canonical.ts";
import { uuidV5 } from "../uuid.ts";
import { deterministicUuidV7, PlannerAuditLog } from "./audit-log.ts";
import { OptionalResponsesPlanner, PlannerTransportFailure } from "./responses-adapter.ts";
import {
  PLANNER_UUID_NAMESPACE,
  type PlannerAuditEvent,
  type PlannerPolicy,
  type PlannerScenarioSummary,
  type PlannerTask,
  type PlannerToolContract,
  type ResponsesPlannerRequest,
  type ResponsesPlannerResponse,
  type ResponsesPlannerTransport,
} from "./types.ts";

type Script =
  | { type: "response"; response: ResponsesPlannerResponse }
  | { type: "failure"; reason: "RESPONSE_LOST" | "TRANSPORT_FAILED" }
  | { type: "hang" };

export class ScriptedPlannerTransport implements ResponsesPlannerTransport {
  readonly mode = "SIMULATED" as const;
  readonly requests: ResponsesPlannerRequest[] = [];
  readonly script: Script;

  constructor(script: Script) {
    this.script = script;
  }

  async send(request: Readonly<ResponsesPlannerRequest>): Promise<ResponsesPlannerResponse> {
    this.requests.push(structuredClone(request));
    if (this.script.type === "failure") throw new PlannerTransportFailure(this.script.reason, this.script.reason);
    if (this.script.type === "hang") return await new Promise<ResponsesPlannerResponse>(() => {});
    return structuredClone(this.script.response);
  }
}

export const PREVIEW_TOOL: PlannerToolContract = {
  name: "draft_notification_preview",
  description: "Create an untrusted preview candidate without approval or notification delivery.",
  feasible: true,
  proposalOnly: true,
  createsAuthorization: false,
  startsExternalEffect: false,
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string", minLength: 1, maxLength: 120 },
      urgency: { type: "string", enum: ["low", "normal", "high"] },
    },
    required: ["summary", "urgency"],
  },
};

const START_EPOCH_MS = Date.UTC(2026, 7, 28, 16, 39, 8, 467);
const PRIVATE_SENTINEL = "private-customer-note-should-never-cross";
const SECRET_SENTINEL = "sk-secret-sentinel-should-never-cross";

function steppingClock(start = START_EPOCH_MS): () => number {
  let value = start;
  return () => value++;
}

function task(name: string, overrides: Partial<PlannerTask> = {}): PlannerTask {
  return {
    taskId: uuidV5(PLANNER_UUID_NAMESPACE, `planner-task/${name}`),
    taskKind: "notification-preview",
    goal: { key: "goal", value: "通知候補を一件だけ作る", classification: "PUBLIC" },
    context: [
      { key: "channel", value: "mac-local", classification: "PUBLIC" },
      { key: "customer-note", value: PRIVATE_SENTINEL, classification: "PERSONAL" },
      { key: "credential", value: SECRET_SENTINEL, classification: "SECRET" },
    ],
    ...overrides,
  };
}

function policy(overrides: Partial<PlannerPolicy> = {}): PlannerPolicy {
  return {
    onlinePlanningEnabled: true,
    networkAvailable: true,
    model: "simulated-planner-v1",
    allowedToolNames: [PREVIEW_TOOL.name],
    allowedContextKeys: ["goal", "channel"],
    requiredContextKeys: ["goal", "channel"],
    limits: { maxOutputTokens: 64, maxLatencyMs: 8, maxCostMicroUsd: 10 },
    rateCard: {
      model: "simulated-planner-v1",
      inputMicroUsdPerMillionTokens: 10_000,
      outputMicroUsdPerMillionTokens: 10_000,
      observedAt: "2026-08-28T16:39:08.467Z",
      validUntil: "2026-08-28T17:39:08.467Z",
      source: "SIMULATED",
      trusted: true,
    },
    ...overrides,
  };
}

function completedCall(name = PREVIEW_TOOL.name, args: CanonicalValue = { summary: "接続を確認しました", urgency: "normal" }): ResponsesPlannerResponse {
  return {
    status: "completed",
    output: [{ type: "function_call", call_id: "call_demo_01", name, arguments: JSON.stringify(args) }],
    usage: { input_tokens: 20, output_tokens: 10 },
  };
}

export interface OnlinePlannerSimulationResult {
  identity: { uuidV5: string; uuidV7: string; uuidNamespace: string };
  observedAt: string;
  observedAtEpochMs: number;
  scenarios: readonly PlannerScenarioSummary[];
  auditEvents: readonly PlannerAuditEvent[];
  sampleRequest: ResponsesPlannerRequest;
  auditValid: boolean;
  simulatedTransportStarts: number;
  actualNetworkRequests: 0;
  actualExternalSpendMicroUsd: 0;
  authorizationCreated: 0;
  externalEffectStarts: 0;
  automaticRetries: 0;
  privacyValuesExposed: false;
}

export async function runOnlinePlannerSimulation(): Promise<OnlinePlannerSimulationResult> {
  const now = steppingClock();
  const audit = new PlannerAuditLog({
    now,
    eventId: (epochMs, sequence) => deterministicUuidV7(epochMs, `planner-audit/${sequence}`),
  });
  const scenarios: PlannerScenarioSummary[] = [];
  const transports: ScriptedPlannerTransport[] = [];
  let sampleRequest: ResponsesPlannerRequest | null = null;

  async function run(
    name: string,
    expected: PlannerScenarioSummary["expected"],
    script: Script,
    plannerTask = task(name),
    plannerPolicy = policy(),
    tools: readonly PlannerToolContract[] = [PREVIEW_TOOL],
  ): Promise<void> {
    const transport = new ScriptedPlannerTransport(script);
    transports.push(transport);
    const planner = new OptionalResponsesPlanner({
      transport,
      audit,
      now,
      runId: epochMs => deterministicUuidV7(epochMs, `planner-run/${name}`),
    });
    const result = await planner.propose(plannerTask, plannerPolicy, tools);
    if (result.status !== expected) throw new Error(`${name}: expected ${expected}, got ${result.status}`);
    if (name === "healthy-candidate") sampleRequest = transport.requests[0] ? structuredClone(transport.requests[0]) : null;
    scenarios.push({ name, expected, result });
  }

  await run("disabled", "LOCAL_READY", { type: "response", response: completedCall() }, task("disabled"), policy({ onlinePlanningEnabled: false }));
  await run("offline", "LOCAL_READY", { type: "response", response: completedCall() }, task("offline"), policy({ networkAvailable: false }));
  await run(
    "privacy-required",
    "STOPPED",
    { type: "response", response: completedCall() },
    task("privacy-required"),
    policy({ allowedContextKeys: ["goal", "channel", "customer-note"], requiredContextKeys: ["goal", "customer-note"] }),
  );
  await run(
    "sensitive-public-value",
    "STOPPED",
    { type: "response", response: completedCall() },
    task("sensitive-public-value", { goal: { key: "goal", value: "連絡先 test@example.com に通知", classification: "PUBLIC" } }),
  );
  await run("cost-unmeasured", "STOPPED", { type: "response", response: completedCall() }, task("cost-unmeasured"), policy({ rateCard: null }));
  await run(
    "cost-limit",
    "STOPPED",
    { type: "response", response: completedCall() },
    task("cost-limit"),
    policy({ limits: { maxOutputTokens: 64, maxLatencyMs: 8, maxCostMicroUsd: 0 } }),
  );
  await run("healthy-candidate", "UNTRUSTED_PROPOSAL", { type: "response", response: completedCall() });
  await run("unknown-tool", "STOPPED", { type: "response", response: completedCall("unlisted_tool") });
  await run("invalid-arguments", "STOPPED", { type: "response", response: completedCall(PREVIEW_TOOL.name, { summary: "余分な値", urgency: "normal", extra: true }) });
  await run("timeout", "STOPPED", { type: "hang" });
  await run("response-lost", "STOPPED", { type: "failure", reason: "RESPONSE_LOST" });
  await run("incomplete", "STOPPED", { type: "response", response: { status: "incomplete", output: [] } });
  await run("multiple-calls", "STOPPED", {
    type: "response",
    response: { status: "completed", output: [completedCall().output[0], completedCall().output[0]] },
  });

  const serializedRequests = JSON.stringify(transports.flatMap(transport => transport.requests));
  if (serializedRequests.includes(PRIVATE_SENTINEL) || serializedRequests.includes(SECRET_SENTINEL)) {
    throw new Error("privacy sentinel crossed the planner boundary");
  }
  const auditEvents = audit.events();
  const serializedAudit = JSON.stringify(auditEvents);
  if (serializedAudit.includes(PRIVATE_SENTINEL) || serializedAudit.includes(SECRET_SENTINEL)) {
    throw new Error("privacy sentinel entered the audit log");
  }
  if (scenarios.some(item => item.result.authorizationCreated !== 0 || item.result.externalEffectStarts !== 0 || item.result.automaticRetries !== 0)) {
    throw new Error("planner simulation crossed an authority or effect boundary");
  }
  if (!sampleRequest) throw new Error("healthy sample request was not captured");
  const observedAtEpochMs = now();
  return {
    identity: {
      uuidV5: uuidV5(PLANNER_UUID_NAMESPACE, "evidence/online-planner-verification-0.5.0"),
      uuidV7: deterministicUuidV7(observedAtEpochMs, "evidence/online-planner-verification-0.5.0"),
      uuidNamespace: PLANNER_UUID_NAMESPACE,
    },
    observedAt: new Date(observedAtEpochMs).toISOString(),
    observedAtEpochMs,
    scenarios,
    auditEvents,
    sampleRequest,
    auditValid: audit.verify().valid,
    simulatedTransportStarts: transports.reduce((sum, transport) => sum + transport.requests.length, 0),
    actualNetworkRequests: 0,
    actualExternalSpendMicroUsd: 0,
    authorizationCreated: 0,
    externalEffectStarts: 0,
    automaticRetries: 0,
    privacyValuesExposed: false,
  };
}

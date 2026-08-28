// information_uuid_v5=f81e22b7-6a8d-5d6a-9757-4ffec856e891
// event_uuid_v7=01a0493d-49b6-745f-8cfd-fc3226590bfa
// machine-contract: PREFLIGHT -> ONE_BOUNDED_REQUEST -> UNTRUSTED_PROPOSAL | STOPPED; timeout, response loss, or malformed output never retries and never authorizes execution.
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { uuidV5, uuidV7 } from "../uuid.ts";
import { PlannerAuditLog, sha256Hex } from "./audit-log.ts";
import {
  estimateWorstCaseCostMicroUsd,
  observedCostMicroUsd,
  preflightPlanner,
  strictToolParameters,
  validateStrictValue,
} from "./policy.ts";
import {
  PLANNER_UUID_NAMESPACE,
  type PlannerCandidate,
  type PlannerPolicy,
  type PlannerRunBase,
  type PlannerRunResult,
  type PlannerStopReason,
  type PlannerTask,
  type PlannerToolContract,
  type ResponsesFunctionCall,
  type ResponsesPlannerRequest,
  type ResponsesPlannerResponse,
  type ResponsesPlannerTransport,
} from "./types.ts";

export class PlannerTransportFailure extends Error {
  readonly reason: "TIMEOUT" | "RESPONSE_LOST" | "TRANSPORT_FAILED";

  constructor(reason: "TIMEOUT" | "RESPONSE_LOST" | "TRANSPORT_FAILED", message: string) {
    super(message);
    this.name = "PlannerTransportFailure";
    this.reason = reason;
  }
}

function functionCall(value: unknown): ResponsesFunctionCall | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return record.type === "function_call"
    && typeof record.call_id === "string"
    && typeof record.name === "string"
    && typeof record.arguments === "string"
    ? { type: "function_call", call_id: record.call_id, name: record.name, arguments: record.arguments }
    : null;
}

function validCallId(value: string): boolean {
  return /^call_[A-Za-z0-9_-]{1,120}$/.test(value);
}

async function boundedSend(
  transport: ResponsesPlannerTransport,
  request: Readonly<ResponsesPlannerRequest>,
  maxLatencyMs: number,
): Promise<ResponsesPlannerResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new PlannerTransportFailure("TIMEOUT", `planner exceeded ${maxLatencyMs} ms`));
    }, maxLatencyMs);
  });
  try {
    return await Promise.race([transport.send(request, { signal: controller.signal }), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export class OptionalResponsesPlanner {
  readonly #transport: ResponsesPlannerTransport;
  readonly #audit: PlannerAuditLog;
  readonly #now: () => number;
  readonly #runId: (epochMs: number) => string;

  constructor(options: {
    transport: ResponsesPlannerTransport;
    audit: PlannerAuditLog;
    now?: () => number;
    runId?: (epochMs: number) => string;
  }) {
    this.#transport = options.transport;
    this.#audit = options.audit;
    this.#now = options.now ?? Date.now;
    this.#runId = options.runId ?? uuidV7;
  }

  async propose(task: PlannerTask, policy: PlannerPolicy, discoveredTools: readonly PlannerToolContract[]): Promise<PlannerRunResult> {
    const startedAt = this.#now();
    const runId = this.#runId(startedAt);
    const inputDigest = sha256Hex(canonicalJson(task as unknown as CanonicalValue));
    this.#audit.append({
      runId, taskId: task.taskId, kind: "preflight-started", fromState: "LOCAL_READY", toState: "PREFLIGHT",
      reason: null, inputDigest, requestDigest: null, disclosedContextKeys: [], exposedToolNames: [], transportAttempts: 0,
    });
    const preflight = preflightPlanner(task, policy, discoveredTools);
    if (!preflight.ok) {
      const local = preflight.reason === "ONLINE_PLANNING_DISABLED" || preflight.reason === "NETWORK_UNAVAILABLE";
      this.#audit.append({
        runId, taskId: task.taskId, kind: local ? "local-path-kept" : "preflight-stopped", fromState: "PREFLIGHT",
        toState: local ? "LOCAL_READY" : "STOPPED", reason: preflight.reason, inputDigest, requestDigest: null,
        disclosedContextKeys: preflight.disclosedContextKeys, exposedToolNames: preflight.exposedToolNames, transportAttempts: 0,
      });
      return {
        ...this.#base(runId, task.taskId, startedAt, "LOCAL_ONLY", 0, preflight.disclosedContextKeys, preflight.exposedToolNames, null, null, null),
        status: local ? "LOCAL_READY" : "STOPPED",
        reason: preflight.reason,
      } as PlannerRunResult;
    }

    const exposedToolNames = preflight.prepared.tools.map(tool => tool.name);
    const disclosedContextKeys = Object.keys(preflight.prepared.disclosedContext).sort();
    const request: ResponsesPlannerRequest = {
      model: policy.model,
      input: [{ role: "user", content: [{ type: "input_text", text: preflight.prepared.inputText }] }],
      tools: preflight.prepared.tools.map(tool => ({
        type: "function", name: tool.name, description: tool.description,
        parameters: strictToolParameters(tool.inputSchema), strict: true,
      })),
      tool_choice: {
        type: "allowed_tools", mode: "required",
        tools: exposedToolNames.map(name => ({ type: "function", name })),
      },
      parallel_tool_calls: false,
      max_output_tokens: policy.limits.maxOutputTokens,
      store: false,
      background: false,
      safety_identifier: task.taskId,
    };
    const requestDigest = sha256Hex(canonicalJson(request as unknown as CanonicalValue));
    const estimatedCost = estimateWorstCaseCostMicroUsd(request, policy.rateCard, startedAt);
    if (estimatedCost === null) {
      return this.#stopBeforeTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "COST_UNMEASURED", null);
    }
    if (estimatedCost > policy.limits.maxCostMicroUsd) {
      return this.#stopBeforeTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "COST_LIMIT_EXCEEDED", estimatedCost);
    }

    this.#audit.append({
      runId, taskId: task.taskId, kind: "request-started", fromState: "PREFLIGHT", toState: "TRANSPORT_PENDING",
      reason: null, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, transportAttempts: 1,
    });
    let response: ResponsesPlannerResponse;
    try {
      response = await boundedSend(this.#transport, request, policy.limits.maxLatencyMs);
    } catch (error) {
      const reason: PlannerStopReason = error instanceof PlannerTransportFailure ? error.reason : "TRANSPORT_FAILED";
      return this.#stopAfterTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, reason, estimatedCost, null);
    }

    const observedCost = response.usage && policy.rateCard
      ? observedCostMicroUsd(response.usage, policy.rateCard, startedAt)
      : null;
    if (response.usage && (observedCost === null || observedCost > policy.limits.maxCostMicroUsd)) {
      return this.#stopAfterTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "COST_LIMIT_EXCEEDED", estimatedCost, observedCost);
    }
    if (response.status !== "completed") {
      return this.#stopAfterTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "INCOMPLETE_RESPONSE", estimatedCost, observedCost);
    }
    const calls = response.output.map(functionCall).filter((call): call is ResponsesFunctionCall => call !== null);
    if (calls.length === 0) {
      return this.#stopAfterTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "NO_TOOL_CALL", estimatedCost, observedCost);
    }
    if (calls.length !== 1) {
      return this.#stopAfterTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "MULTIPLE_TOOL_CALLS", estimatedCost, observedCost);
    }
    const call = calls[0]!;
    const contract = preflight.prepared.tools.find(tool => tool.name === call.name);
    if (!contract) {
      return this.#stopAfterTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "UNKNOWN_TOOL", estimatedCost, observedCost);
    }
    if (!validCallId(call.call_id)) {
      return this.#stopAfterTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "INVALID_CALL_ID", estimatedCost, observedCost);
    }
    let argumentsValue: unknown;
    try { argumentsValue = JSON.parse(call.arguments); } catch { argumentsValue = null; }
    if (!validateStrictValue(contract.inputSchema, argumentsValue)) {
      return this.#stopAfterTransport(runId, task, startedAt, inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, "INVALID_ARGUMENTS", estimatedCost, observedCost);
    }
    const candidate: PlannerCandidate = {
      candidateId: uuidV5(PLANNER_UUID_NAMESPACE, `planner-candidate/${task.taskId}/${call.name}/${canonicalJson(argumentsValue)}`),
      status: "UNTRUSTED_PROPOSAL",
      toolName: call.name,
      callId: call.call_id,
      arguments: argumentsValue,
      authorization: "NOT_CREATED",
      externalEffectStarts: 0,
    };
    this.#audit.append({
      runId, taskId: task.taskId, kind: "candidate-recorded", fromState: "TRANSPORT_PENDING", toState: "UNTRUSTED_PROPOSAL",
      reason: "CANDIDATE_ONLY", inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, transportAttempts: 1,
    });
    return {
      ...this.#base(runId, task.taskId, startedAt, this.#mode(), 1, disclosedContextKeys, exposedToolNames, estimatedCost, observedCost, requestDigest),
      status: "UNTRUSTED_PROPOSAL", reason: null, candidate,
    };
  }

  #mode(): "SIMULATED_REMOTE" | "PRODUCTION_BOUNDARY" {
    return this.#transport.mode === "SIMULATED" ? "SIMULATED_REMOTE" : "PRODUCTION_BOUNDARY";
  }

  #base(
    runId: string, taskId: string, occurredAtEpochMs: number, mode: PlannerRunBase["mode"], transportAttempts: 0 | 1,
    disclosedContextKeys: readonly string[], exposedToolNames: readonly string[], estimatedCostMicroUsd: number | null,
    observedCostMicroUsdValue: number | null, requestDigest: string | null,
  ): PlannerRunBase {
    return {
      runId, taskId, occurredAt: new Date(occurredAtEpochMs).toISOString(), occurredAtEpochMs, mode, transportAttempts,
      automaticRetries: 0, authorizationCreated: 0, externalEffectStarts: 0,
      disclosedContextKeys: [...disclosedContextKeys], exposedToolNames: [...exposedToolNames],
      estimatedCostMicroUsd, observedCostMicroUsd: observedCostMicroUsdValue, requestDigest,
    };
  }

  #stopBeforeTransport(
    runId: string, task: PlannerTask, startedAt: number, inputDigest: string, requestDigest: string,
    disclosedContextKeys: readonly string[], exposedToolNames: readonly string[], reason: "COST_UNMEASURED" | "COST_LIMIT_EXCEEDED",
    estimatedCost: number | null,
  ): PlannerRunResult {
    this.#audit.append({
      runId, taskId: task.taskId, kind: "preflight-stopped", fromState: "PREFLIGHT", toState: "STOPPED", reason,
      inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, transportAttempts: 0,
    });
    return {
      ...this.#base(runId, task.taskId, startedAt, this.#mode(), 0, disclosedContextKeys, exposedToolNames, estimatedCost, null, requestDigest),
      status: "STOPPED", reason,
    };
  }

  #stopAfterTransport(
    runId: string, task: PlannerTask, startedAt: number, inputDigest: string, requestDigest: string,
    disclosedContextKeys: readonly string[], exposedToolNames: readonly string[], reason: Exclude<PlannerStopReason,
      "ONLINE_PLANNING_DISABLED" | "NETWORK_UNAVAILABLE" | "INVALID_TASK" | "NO_FEASIBLE_TOOLS" | "PRIVACY_REQUIRED_FIELD" |
      "SENSITIVE_VALUE_DETECTED" | "COST_UNMEASURED">,
    estimatedCost: number, observedCost: number | null,
  ): PlannerRunResult {
    this.#audit.append({
      runId, taskId: task.taskId, kind: "response-stopped", fromState: "TRANSPORT_PENDING", toState: "STOPPED", reason,
      inputDigest, requestDigest, disclosedContextKeys, exposedToolNames, transportAttempts: 1,
    });
    return {
      ...this.#base(runId, task.taskId, startedAt, this.#mode(), 1, disclosedContextKeys, exposedToolNames, estimatedCost, observedCost, requestDigest),
      status: "STOPPED", reason,
    };
  }
}

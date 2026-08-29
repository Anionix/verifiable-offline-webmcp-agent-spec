// information_uuid_v5=8d026687-0a78-5aa6-b884-34677a2a51df
// event_uuid_v7=01a0493d-49ba-7131-b0da-6644bc20907d
// machine-contract: every online-planner failure path ends STOPPED with zero retry, authorization, and external-effect starts.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../canonical.ts";
import { PlannerAuditLog } from "../planner/audit-log.ts";
import { preflightPlanner, validateStrictValue } from "../planner/policy.ts";
import { OptionalResponsesPlanner } from "../planner/responses-adapter.ts";
import { PREVIEW_TOOL, runOnlinePlannerSimulation, ScriptedPlannerTransport } from "../planner/simulation.ts";
import { PLANNER_UUID_NAMESPACE, type PlannerPolicy, type PlannerTask } from "../planner/types.ts";
import { uuidV5 } from "../uuid.ts";

// information_uuid_v5=d0df026b-55c2-53b2-8b98-8c4652df78b7
// event_uuid_v7=01a049ff-02a9-724e-b280-7b5029b74e33
// state_transition=DISCOVERED -> DRY_RUN occurred_at=2026-08-28T20:10:44.265Z
// machine-contract: overlong serialized input and any malformed function-call entry stop before a proposal is accepted.

const task: PlannerTask = {
  taskId: uuidV5(PLANNER_UUID_NAMESPACE, "test/planner/task"),
  taskKind: "notification-preview",
  goal: { key: "goal", value: "候補を作る", classification: "PUBLIC" },
  context: [
    { key: "channel", value: "mac-local", classification: "PUBLIC" },
    { key: "private-note", value: "never-send-me", classification: "PERSONAL" },
  ],
};

const policy: PlannerPolicy = {
  onlinePlanningEnabled: true,
  networkAvailable: true,
  model: "simulated-planner-v1",
  allowedToolNames: [PREVIEW_TOOL.name],
  allowedContextKeys: ["goal", "channel"],
  requiredContextKeys: ["goal"],
  limits: { maxOutputTokens: 32, maxLatencyMs: 20, maxCostMicroUsd: 20 },
  rateCard: {
    model: "simulated-planner-v1",
    inputMicroUsdPerMillionTokens: 10_000,
    outputMicroUsdPerMillionTokens: 10_000,
    observedAt: "2026-08-28T16:39:08.467Z",
    validUntil: "2100-01-01T00:00:00Z",
    source: "SIMULATED",
    trusted: true,
  },
};

test("preflight exposes only feasible allowlisted tools and public allowed context", () => {
  const result = preflightPlanner(task, policy, [PREVIEW_TOOL]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(Object.keys(result.prepared.disclosedContext), ["goal", "channel"]);
  assert.equal(result.prepared.inputText.includes("never-send-me"), false);
  assert.deepEqual(result.prepared.tools.map(tool => tool.name), [PREVIEW_TOOL.name]);
});

test("preflight rejects a serialized planner input above the request contract limit", () => {
  const oversized: PlannerTask = {
    ...task,
    taskId: uuidV5(PLANNER_UUID_NAMESPACE, "test/planner/oversized"),
    context: [{ key: "channel", value: "x".repeat(5_000), classification: "PUBLIC" }],
  };
  const result = preflightPlanner(oversized, policy, [PREVIEW_TOOL]);
  assert.deepEqual(result, {
    ok: false,
    reason: "INVALID_TASK",
    disclosedContextKeys: [],
    exposedToolNames: [PREVIEW_TOOL.name],
  });
});

test("strict tool arguments reject missing and extra fields", () => {
  assert.equal(validateStrictValue(PREVIEW_TOOL.inputSchema, { summary: "ok", urgency: "normal" }), true);
  assert.equal(validateStrictValue(PREVIEW_TOOL.inputSchema, { summary: "missing" }), false);
  assert.equal(validateStrictValue(PREVIEW_TOOL.inputSchema, { summary: "extra", urgency: "normal", send: true }), false);
});

test("healthy response remains an untrusted proposal and request is constrained", async () => {
  const transport = new ScriptedPlannerTransport({
    type: "response",
    response: {
      status: "completed",
      output: [{ type: "function_call", call_id: "call_test", name: PREVIEW_TOOL.name, arguments: '{"summary":"ok","urgency":"low"}' }],
      usage: { input_tokens: 3, output_tokens: 2 },
    },
  });
  const audit = new PlannerAuditLog();
  const result = await new OptionalResponsesPlanner({ transport, audit }).propose(task, policy, [PREVIEW_TOOL]);
  assert.equal(result.status, "UNTRUSTED_PROPOSAL");
  assert.equal(result.authorizationCreated, 0);
  assert.equal(result.externalEffectStarts, 0);
  assert.equal(result.automaticRetries, 0);
  assert.equal(transport.requests.length, 1);
  const request = transport.requests[0]!;
  assert.equal(request.store, false);
  assert.equal(request.background, false);
  assert.equal(request.parallel_tool_calls, false);
  assert.equal(request.tools.every(tool => tool.strict && tool.parameters.additionalProperties === false), true);
  assert.deepEqual(request.tool_choice.tools, [{ type: "function", name: PREVIEW_TOOL.name }]);
  assert.equal(canonicalJson(request as never).includes("never-send-me"), false);
  assert.equal(audit.verify().valid, true);
});

test("a malformed function-call entry cannot be discarded beside a valid call", async () => {
  const transport = new ScriptedPlannerTransport({
    type: "response",
    response: {
      status: "completed",
      output: [
        { type: "function_call", call_id: "call_valid", name: PREVIEW_TOOL.name, arguments: '{"summary":"ok","urgency":"low"}' },
        { type: "function_call", name: PREVIEW_TOOL.name, arguments: "{}" },
      ],
      usage: { input_tokens: 3, output_tokens: 2 },
    },
  });
  const result = await new OptionalResponsesPlanner({ transport, audit: new PlannerAuditLog() })
    .propose(task, policy, [PREVIEW_TOOL]);
  assert.equal(result.status, "STOPPED");
  assert.equal(result.reason, "INVALID_ARGUMENTS");
  assert.equal(result.authorizationCreated, 0);
  assert.equal(result.externalEffectStarts, 0);
});

test("the complete scripted matrix preserves local availability and stops failures", async () => {
  const first = await runOnlinePlannerSimulation();
  const second = await runOnlinePlannerSimulation();
  assert.equal(first.auditValid, true);
  assert.equal(first.scenarios.length, 13);
  assert.equal(first.scenarios.filter(item => item.result.status === "UNTRUSTED_PROPOSAL").length, 1);
  assert.equal(first.scenarios.filter(item => item.result.status === "LOCAL_READY").length, 2);
  assert.equal(first.scenarios.every(item => item.result.automaticRetries === 0), true);
  assert.equal(first.actualNetworkRequests, 0);
  assert.equal(first.authorizationCreated, 0);
  assert.equal(first.externalEffectStarts, 0);
  assert.equal(first.privacyValuesExposed, false);
  assert.deepEqual(first, second, "fixed simulation evidence must be reproducible byte-for-byte after serialization");
});

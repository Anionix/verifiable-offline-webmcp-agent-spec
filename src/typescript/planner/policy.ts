// information_uuid_v5=c2733a1c-ddf7-51f6-929e-3736349b8848
// event_uuid_v7=01a0493d-49b4-7b9f-ac17-fa44d9bab232
// machine-contract: DISCOVERED -> MINIMIZED -> COSTED | STOPPED_BEFORE_TRANSPORT; non-public or secret-looking values never cross the planner boundary.
// information_uuid_v5=d0df026b-55c2-53b2-8b98-8c4652df78b7
// event_uuid_v7=01a049ff-02a9-724e-b280-7b5029b74e33
// state_transition=DISCOVERED -> EXECUTING occurred_at=2026-08-28T20:10:44.265Z
// machine-contract: the final serialized planner input must satisfy the same 4096 Unicode-character ceiling published by its request schema.
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { isUuidVersion } from "../uuid.ts";
import type {
  PlannerPolicy,
  PlannerRateCard,
  PlannerStopReason,
  PlannerTask,
  PlannerToolContract,
  ResponsesPlannerRequest,
  StrictObjectSchema,
  StrictSchema,
} from "./types.ts";

const SHORT_SLUG = /^[a-z][a-z0-9._-]{0,63}$/;
const TOOL_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const PRIVATE_KEY_WORDS = "PRIVATE " + "KEY";
const SECRET_LIKE = new RegExp(
  `(?:\\bBearer\\s+[A-Za-z0-9._~+\\/-]+=*|\\bsk-[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*${PRIVATE_KEY_WORDS}-----|\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b|(?:\\+?\\d[\\d ()-]{8,}\\d))`,
  "i",
);

export interface PreparedPlannerInput {
  task: PlannerTask;
  tools: readonly PlannerToolContract[];
  disclosedContext: Readonly<Record<string, string>>;
  inputText: string;
}

export type PreflightResult =
  | { ok: true; prepared: PreparedPlannerInput }
  | { ok: false; reason: PlannerStopReason; disclosedContextKeys: readonly string[]; exposedToolNames: readonly string[] };

function isSafeInteger(value: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

export function isStrictSchema(schema: StrictSchema): boolean {
  if (schema.type === "object") {
    const keys = Object.keys(schema.properties);
    return schema.additionalProperties === false
      && new Set(schema.required).size === keys.length
      && keys.every(key => schema.required.includes(key) && SHORT_SLUG.test(key) && isStrictSchema(schema.properties[key]!));
  }
  if (schema.type === "string") {
    if (schema.minLength !== undefined && !isSafeInteger(schema.minLength, 0)) return false;
    if (schema.maxLength !== undefined && !isSafeInteger(schema.maxLength, schema.minLength ?? 0)) return false;
    return schema.enum === undefined || (schema.enum.length > 0 && new Set(schema.enum).size === schema.enum.length);
  }
  if (schema.type === "integer") {
    if (schema.minimum !== undefined && !Number.isSafeInteger(schema.minimum)) return false;
    if (schema.maximum !== undefined && !Number.isSafeInteger(schema.maximum)) return false;
    return schema.minimum === undefined || schema.maximum === undefined || schema.minimum <= schema.maximum;
  }
  return schema.type === "boolean";
}

export function validateStrictValue(schema: StrictSchema, value: unknown): value is CanonicalValue {
  if (schema.type === "object") {
    if (value === null || Array.isArray(value) || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    const actual = Object.keys(record).sort();
    const expected = Object.keys(schema.properties).sort();
    return JSON.stringify(actual) === JSON.stringify(expected)
      && expected.every(key => validateStrictValue(schema.properties[key]!, record[key]));
  }
  if (schema.type === "string") {
    if (typeof value !== "string") return false;
    if (schema.minLength !== undefined && value.length < schema.minLength) return false;
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return false;
    return schema.enum === undefined || schema.enum.includes(value);
  }
  if (schema.type === "integer") {
    return Number.isSafeInteger(value)
      && (schema.minimum === undefined || (value as number) >= schema.minimum)
      && (schema.maximum === undefined || (value as number) <= schema.maximum);
  }
  return typeof value === "boolean";
}

function validTool(tool: PlannerToolContract): boolean {
  return TOOL_NAME.test(tool.name)
    && tool.description.trim().length > 0
    && tool.description.length <= 240
    && tool.feasible
    && tool.proposalOnly === true
    && tool.createsAuthorization === false
    && tool.startsExternalEffect === false
    && isStrictSchema(tool.inputSchema);
}

function validLimits(policy: PlannerPolicy): boolean {
  return isSafeInteger(policy.limits.maxOutputTokens, 1, 16_384)
    && isSafeInteger(policy.limits.maxLatencyMs, 1, 300_000)
    && isSafeInteger(policy.limits.maxCostMicroUsd, 0);
}

export function preflightPlanner(task: PlannerTask, policy: PlannerPolicy, discoveredTools: readonly PlannerToolContract[]): PreflightResult {
  if (!policy.onlinePlanningEnabled) {
    return { ok: false, reason: "ONLINE_PLANNING_DISABLED", disclosedContextKeys: [], exposedToolNames: [] };
  }
  if (!policy.networkAvailable) {
    return { ok: false, reason: "NETWORK_UNAVAILABLE", disclosedContextKeys: [], exposedToolNames: [] };
  }
  if (
    !isUuidVersion(task.taskId, 5)
    || !SHORT_SLUG.test(task.taskKind)
    || task.goal.key !== "goal"
    || task.goal.value.trim() !== task.goal.value
    || task.goal.value.length < 1
    || task.goal.value.length > 500
    || !SHORT_SLUG.test(policy.model)
    || !validLimits(policy)
  ) return { ok: false, reason: "INVALID_TASK", disclosedContextKeys: [], exposedToolNames: [] };

  const allowedTools = new Set(policy.allowedToolNames);
  const tools = discoveredTools.filter(tool => allowedTools.has(tool.name) && validTool(tool));
  if (tools.length === 0) return { ok: false, reason: "NO_FEASIBLE_TOOLS", disclosedContextKeys: [], exposedToolNames: [] };

  const allowedKeys = new Set(policy.allowedContextKeys);
  const requiredKeys = new Set(policy.requiredContextKeys);
  const fields = [task.goal, ...task.context];
  const byKey = new Map<string, typeof fields[number]>();
  for (const field of fields) {
    if (!SHORT_SLUG.test(field.key) || byKey.has(field.key)) {
      return { ok: false, reason: "INVALID_TASK", disclosedContextKeys: [], exposedToolNames: tools.map(tool => tool.name) };
    }
    byKey.set(field.key, field);
  }
  for (const key of requiredKeys) {
    const field = byKey.get(key);
    if (!field || field.classification !== "PUBLIC" || !allowedKeys.has(key)) {
      return { ok: false, reason: "PRIVACY_REQUIRED_FIELD", disclosedContextKeys: [], exposedToolNames: tools.map(tool => tool.name) };
    }
  }
  const disclosed = fields.filter(field => allowedKeys.has(field.key) && field.classification === "PUBLIC");
  if (disclosed.some(field => SECRET_LIKE.test(field.value))) {
    return { ok: false, reason: "SENSITIVE_VALUE_DETECTED", disclosedContextKeys: [], exposedToolNames: tools.map(tool => tool.name) };
  }
  const disclosedContext = Object.fromEntries(disclosed.map(field => [field.key, field.value]));
  const inputText = canonicalJson({ taskKind: task.taskKind, context: disclosedContext } as CanonicalValue);
  if ([...inputText].length > 4_096) {
    return { ok: false, reason: "INVALID_TASK", disclosedContextKeys: [], exposedToolNames: tools.map(tool => tool.name) };
  }
  return {
    ok: true,
    prepared: {
      task,
      tools,
      disclosedContext,
      inputText,
    },
  };
}

function validRateCard(rateCard: PlannerRateCard | null, model: string, atEpochMs: number): rateCard is PlannerRateCard {
  const observedAt = rateCard ? Date.parse(rateCard.observedAt) : Number.NaN;
  const validUntil = rateCard ? Date.parse(rateCard.validUntil) : Number.NaN;
  return rateCard !== null
    && rateCard.trusted
    && rateCard.model === model
    && Number.isSafeInteger(observedAt)
    && Number.isSafeInteger(validUntil)
    && observedAt <= atEpochMs
    && atEpochMs <= validUntil
    && isSafeInteger(rateCard.inputMicroUsdPerMillionTokens, 0)
    && isSafeInteger(rateCard.outputMicroUsdPerMillionTokens, 0);
}

function ceilMillionProduct(tokens: number, rate: number): bigint {
  return (BigInt(tokens) * BigInt(rate) + 999_999n) / 1_000_000n;
}

export function estimateWorstCaseCostMicroUsd(request: ResponsesPlannerRequest, rateCard: PlannerRateCard | null, atEpochMs = Date.now()): number | null {
  if (!validRateCard(rateCard, request.model, atEpochMs)) return null;
  const inputTokenUpperBound = Buffer.byteLength(canonicalJson(request as unknown as CanonicalValue), "utf8");
  const total = ceilMillionProduct(inputTokenUpperBound, rateCard.inputMicroUsdPerMillionTokens)
    + ceilMillionProduct(request.max_output_tokens, rateCard.outputMicroUsdPerMillionTokens);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("estimated planner cost exceeds safe integer range");
  return Number(total);
}

export function observedCostMicroUsd(responseUsage: { input_tokens: number; output_tokens: number }, rateCard: PlannerRateCard, atEpochMs = Date.now()): number | null {
  if (!validRateCard(rateCard, rateCard.model, atEpochMs)) return null;
  if (!isSafeInteger(responseUsage.input_tokens, 0) || !isSafeInteger(responseUsage.output_tokens, 0)) return null;
  const total = ceilMillionProduct(responseUsage.input_tokens, rateCard.inputMicroUsdPerMillionTokens)
    + ceilMillionProduct(responseUsage.output_tokens, rateCard.outputMicroUsdPerMillionTokens);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}

export function strictToolParameters(schema: StrictObjectSchema): StrictObjectSchema {
  if (!isStrictSchema(schema)) throw new TypeError("tool schema is not strict and closed");
  return structuredClone(schema);
}

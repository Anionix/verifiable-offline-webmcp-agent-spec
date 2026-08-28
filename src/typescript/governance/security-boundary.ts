// information_uuid_v5=71753ddf-abb7-5460-9979-916ca501690b
// event_uuid_v7=01a04961-5917-787f-b8d8-1900d1f6ce10
// state_transition=PROPOSED -> EXECUTING occurred_at=2026-08-28T17:18:31.000Z
// machine-contract: DISCOVER -> LOOK_UP_CONTRACT -> PROJECT_CAPABILITIES -> CHECK_AUTHORITY -> PROPOSAL_ONLY; untrusted data can never add authority or expose a commit tool.
import { createHash, timingSafeEqual, type KeyObject } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { verifyBase64 } from "../sync/crypto.ts";
import { isUuidVersion } from "../uuid.ts";

export const WEBMCP_DRAFT_METADATA = Object.freeze({
  sourceId: "SRC-WEBMCP-2026",
  specificationUrl: "https://webmachinelearning.github.io/webmcp/",
  status: "DRAFT_COMMUNITY_GROUP_REPORT",
  observedSurface: "document.modelContext.registerTool",
  adapterModule: "src/typescript/webmcp/notification-adapter.js",
});

export type GovernedToolClass =
  | "read"
  | "write"
  | "messaging"
  | "identity"
  | "destructive"
  | "financial";

export interface GovernedToolContract {
  contractVersion: "0.1.0";
  tool: {
    id: string;
    class: GovernedToolClass;
    description: string;
  };
  semantics: {
    readSet: readonly string[];
    writeSet: readonly string[];
  };
  properties: {
    externalSideEffect: boolean;
  };
  policy: {
    humanApproval: "AUTO" | "CONDITIONAL" | "MANDATE_OR_HUMAN" | "HUMAN";
  };
  plannerSurface: "PROPOSAL_ONLY" | "COMMIT";
}

export interface PlannerDiscoveryResult {
  contractLookupPerformed: true;
  webMcpDraft: typeof WEBMCP_DRAFT_METADATA;
  executorCapabilities: readonly string[];
  plannerCapabilities: readonly string[];
  tools: readonly GovernedToolContract[];
}

export interface ApprovalSubject {
  toolId: string;
  normalizedArgs: CanonicalValue;
  target: CanonicalValue;
  content: CanonicalValue | null;
  amount: CanonicalValue | null;
}

export interface ApprovalBinding {
  toolId: string;
  normalizedArgsDigest: string;
  targetDigest: string;
  contentDigest: string;
  amountDigest: string;
  expiresAtEpochMs: number;
}

export interface SignedMandate {
  kind: "SIGNED_MANDATE";
  mandateId: string;
  authorityDigest: string;
  allowedToolIds: readonly string[];
  expiresAtEpochMs: number;
  signatureBase64: string;
}

export type AuthorityDecision = "ALLOW" | "DENY" | "HUMAN";
export type UntrustedSource = "TOOL_DESCRIPTION" | "TOOL_OUTPUT" | "PAGE_OBSERVATION";

export interface UntrustedData {
  trust: "UNTRUSTED_DATA";
  source: UntrustedSource;
  literal: string;
  instructionLike: boolean;
  authorityChangeAllowed: false;
}

const SHA_256 = /^[0-9a-f]{64}$/;
const SECRET_NAME = new RegExp([
  "password",
  "passphrase",
  "access[-_ ]?token",
  "api[-_ ]?key",
  ["private", "key"].join("[-_ ]?"),
].join("|"), "iu");
const SECRET_VALUE_MARKERS = [
  ["BEGIN", "PRIVATE", "KEY"].join(" "),
  "BEARER ",
];
const MANDATE_DOMAIN = Buffer.from("GOVERNED-MANDATE-v1\0", "utf8");

function digest(value: CanonicalValue): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function sameDigest(left: string, right: string): boolean {
  if (!SHA_256.test(left) || !SHA_256.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function uniqueSorted(values: readonly string[], label: string): readonly string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new TypeError(`${label} must contain non-empty strings`);
  }
  return Object.freeze([...new Set(values)].sort());
}

function isMutation(contract: GovernedToolContract): boolean {
  return contract.tool.class !== "read" || contract.properties.externalSideEffect;
}

function isCritical(contract: GovernedToolContract): boolean {
  return ["financial", "destructive", "identity"].includes(contract.tool.class);
}

export function validateGovernedToolContract(contract: GovernedToolContract): void {
  if (contract.contractVersion !== "0.1.0") throw new TypeError("unsupported contract version");
  if (!contract.tool.id || !contract.tool.description) throw new TypeError("tool identity and description are required");
  if (!Array.isArray(contract.semantics.readSet) || !Array.isArray(contract.semantics.writeSet)) {
    throw new TypeError("declared readSet and writeSet are required");
  }
  uniqueSorted(contract.semantics.readSet, "readSet");
  uniqueSorted(contract.semantics.writeSet, "writeSet");
  if (isMutation(contract) && contract.semantics.writeSet.length === 0) {
    throw new TypeError("mutation contract requires a non-empty writeSet");
  }
  if (isCritical(contract) && contract.policy.humanApproval === "AUTO") {
    throw new TypeError("critical tools cannot use automatic approval");
  }
  if (isCritical(contract) && contract.plannerSurface === "COMMIT") {
    throw new TypeError("critical commit tools cannot be exposed to a planner");
  }
}

export function discoverPlannerTools(options: {
  discoveredToolIds: readonly string[];
  contracts: ReadonlyMap<string, GovernedToolContract>;
  executorCapabilities: readonly string[];
  requestedPlannerCapabilities: readonly string[];
}): PlannerDiscoveryResult {
  const discovered = uniqueSorted(options.discoveredToolIds, "discoveredToolIds");
  const executor = uniqueSorted(options.executorCapabilities, "executorCapabilities");
  const requested = uniqueSorted(options.requestedPlannerCapabilities, "requestedPlannerCapabilities");
  const executorSet = new Set(executor);
  const discoveredSet = new Set(discovered);
  const planner = requested.filter((id) => executorSet.has(id) && discoveredSet.has(id));
  const tools = planner.map((id) => {
    const contract = options.contracts.get(id);
    if (!contract) throw new TypeError(`contract lookup failed for ${id}`);
    validateGovernedToolContract(contract);
    if (contract.plannerSurface !== "PROPOSAL_ONLY") {
      throw new TypeError(`planner tool ${id} is not proposal-only`);
    }
    return contract;
  });
  if (planner.some((id) => !executorSet.has(id))) throw new TypeError("planner capability exceeds executor capability");
  return Object.freeze({
    contractLookupPerformed: true,
    webMcpDraft: WEBMCP_DRAFT_METADATA,
    executorCapabilities: executor,
    plannerCapabilities: Object.freeze(planner),
    tools: Object.freeze(tools),
  });
}

export function createApprovalBinding(subject: ApprovalSubject, expiresAtEpochMs: number): ApprovalBinding {
  if (!Number.isSafeInteger(expiresAtEpochMs) || expiresAtEpochMs <= 0) {
    throw new TypeError("approval expiry must be a positive safe integer");
  }
  if (!subject.toolId) throw new TypeError("approval toolId is required");
  return Object.freeze({
    toolId: subject.toolId,
    normalizedArgsDigest: digest(subject.normalizedArgs),
    targetDigest: digest(subject.target),
    contentDigest: digest(subject.content),
    amountDigest: digest(subject.amount),
    expiresAtEpochMs,
  });
}

export function approvalMatches(binding: ApprovalBinding, subject: ApprovalSubject, nowEpochMs: number): boolean {
  if (!Number.isSafeInteger(nowEpochMs) || binding.expiresAtEpochMs <= nowEpochMs) return false;
  const candidate = createApprovalBinding(subject, binding.expiresAtEpochMs);
  return binding.toolId === candidate.toolId
    && sameDigest(binding.normalizedArgsDigest, candidate.normalizedArgsDigest)
    && sameDigest(binding.targetDigest, candidate.targetDigest)
    && sameDigest(binding.contentDigest, candidate.contentDigest)
    && sameDigest(binding.amountDigest, candidate.amountDigest);
}

export function criticalAuthorityDecision(
  contract: GovernedToolContract,
  mandate: SignedMandate | string | null,
  nowEpochMs: number,
  trustedPublicKey?: KeyObject | string,
): AuthorityDecision {
  validateGovernedToolContract(contract);
  if (!isCritical(contract)) return "ALLOW";
  if (typeof mandate === "string") {
    // machine-contract: UUIDv5 and UUIDv7 are trace identifiers only, never bearer authority.
    return isUuidVersion(mandate, 5) || isUuidVersion(mandate, 7) ? "HUMAN" : "DENY";
  }
  if (!mandate) return "HUMAN";
  if (
    mandate.kind !== "SIGNED_MANDATE"
    || !SHA_256.test(mandate.authorityDigest)
    || mandate.expiresAtEpochMs <= nowEpochMs
    || !mandate.allowedToolIds.includes(contract.tool.id)
    || !trustedPublicKey
    || !verifyBase64(trustedPublicKey, mandateSignatureMessage(mandate), mandate.signatureBase64)
  ) return "HUMAN";
  return "ALLOW";
}

export function mandateSignatureMessage(mandate: SignedMandate): Buffer {
  const allowedToolIds = uniqueSorted(mandate.allowedToolIds, "allowedToolIds");
  const payload = canonicalJson({
    allowedToolIds: [...allowedToolIds],
    authorityDigest: mandate.authorityDigest,
    expiresAtEpochMs: mandate.expiresAtEpochMs,
    kind: mandate.kind,
    mandateId: mandate.mandateId,
  });
  return Buffer.concat([MANDATE_DOMAIN, Buffer.from(payload, "utf8")]);
}

export function evaluateHostAuthority(input: {
  hostPolicyAllows: boolean;
  userConsentAllows: boolean;
  requestedCapabilities: readonly string[];
  baseCapabilities: readonly string[];
  evidenceSource: "TRUSTED_POLICY" | "LLM" | "TOOL_OUTPUT" | "WEB_CONTENT";
}): AuthorityDecision {
  if (!input.hostPolicyAllows || !input.userConsentAllows) return "DENY";
  const base = new Set(uniqueSorted(input.baseCapabilities, "baseCapabilities"));
  const requested = uniqueSorted(input.requestedCapabilities, "requestedCapabilities");
  if (requested.some((capability) => !base.has(capability))) return "DENY";
  if (input.evidenceSource !== "TRUSTED_POLICY" && requested.length > 0) return "DENY";
  return "ALLOW";
}

function inspectPlannerValue(value: unknown, path: string): void {
  if (typeof value === "string") {
    const upper = value.toLocaleUpperCase("en-US");
    if (SECRET_NAME.test(path) || SECRET_VALUE_MARKERS.some((marker) => upper.includes(marker))) {
      throw new TypeError(`secret-like planner value rejected at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPlannerValue(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_NAME.test(key)) throw new TypeError(`secret-like planner field rejected at ${path}.${key}`);
      inspectPlannerValue(item, `${path}.${key}`);
    }
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
    Object.freeze(value);
  }
  return value as Readonly<T>;
}

export function projectPlannerContext<T extends CanonicalValue>(value: T): Readonly<T> {
  const normalized = JSON.parse(canonicalJson(value)) as T;
  inspectPlannerValue(normalized, "context");
  return deepFreeze(normalized);
}

export function wrapUntrustedData(source: UntrustedSource, literal: string): Readonly<UntrustedData> {
  if (typeof literal !== "string" || literal.length > 20_000) throw new TypeError("untrusted literal is invalid");
  const instructionLike = /(?:ignore|override|system message|developer message|execute|run command)/iu.test(literal);
  return Object.freeze({
    trust: "UNTRUSTED_DATA",
    source,
    literal,
    instructionLike,
    authorityChangeAllowed: false,
  });
}

export function observeWebMcpSurface(runtime: unknown): Readonly<{
  status: "AVAILABLE" | "UNAVAILABLE";
  reason: "REGISTER_TOOL_PRESENT" | "MODEL_CONTEXT_ABSENT";
  draft: typeof WEBMCP_DRAFT_METADATA;
}> {
  const candidate = runtime as { document?: { modelContext?: { registerTool?: unknown } } } | null;
  const available = typeof candidate?.document?.modelContext?.registerTool === "function";
  return Object.freeze({
    status: available ? "AVAILABLE" : "UNAVAILABLE",
    reason: available ? "REGISTER_TOOL_PRESENT" : "MODEL_CONTEXT_ABSENT",
    draft: WEBMCP_DRAFT_METADATA,
  });
}

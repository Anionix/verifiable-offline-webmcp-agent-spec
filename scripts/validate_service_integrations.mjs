#!/usr/bin/env node
// information_uuid_v5=5467fd93-e0f2-59b0-bd0d-ede0efdd2aca
// event_uuid_v7=01a04b08-4f98-76e5-87e3-592f83ccae4e
// state_transition=UNRECORDED -> FOUR_AXIS_RECORDED occurred_at=2026-08-29T01:00:31.000Z
// machine-contract: installation, authentication, publication, and runtime evidence are validated independently; read success never grants write authority.
// information_uuid_v5=8b8c7cf0-5d25-5c08-8b3f-ef2fba0e1a91
// event_uuid_v7=01a052e1-7d4d-7c16-8b72-4d6e0d5c0189
// state_transition=PUBLIC_RECEIPT_RETAINED -> WORKTREE_CANDIDATE_SEPARATED occurred_at=2026-08-30T12:50:00.000Z
// machine-contract: a worktree candidate may differ from the historical public artifact; retain the public receipt and report the boundary instead of comparing unrelated bytes.
// event_uuid_v7=01a04b38-0e40-7595-81ae-fd2db303c4ae
// state_transition=FOUR_AXIS_RECORDED -> APPROVAL_GATES_ENFORCED occurred_at=2026-08-29T01:52:40.000Z
// machine-contract: external writes are allowed only when the exact service/action gate records plan or user authority.
// event_uuid_v7=01a04bb2-b8ef-7ea8-9b99-6a0ab5d36ec1
// state_transition=OWNER_ONLY_SITE_LIVE_VERIFIED -> PUBLIC_SITE_VERSION_4_VERIFIED occurred_at=2026-08-29T04:06:39.087Z
// machine-contract: the current Sites row must identify the same functional commit and digest as the Sites-specific hotel receipt.
// event_uuid_v7=01a04be5-0163-7a97-8904-c882da28add6
// state_transition=SITES_RECEIPT_BOUND_ONLY -> SITES_AND_VERCEL_RECEIPTS_BOUND occurred_at=2026-08-29T05:01:34.435Z
// machine-contract: the Vercel current-artifact row requires its own provider, HTTP, browser-flow, bounded-observability, and restored-notification receipt.
// event_uuid_v7=01a04c4c-89a7-749b-996b-8f35edaa0f3d
// state_transition=VERCEL_REDEPLOY_STAGED -> VERCEL_REDEPLOY_VERIFIED occurred_at=2026-08-29T06:54:39.527Z
// machine-contract: the current Vercel receipt binds a reachable provider Git commit, five anonymous remote hashes, carried fresh-storage proof only by identical functional digest, and recovery from an accidental notification-project deployment.
// event_uuid_v7=01a04c72-6ad0-75c6-9e90-10988cd6d33f
// state_transition=VERCEL_REDEPLOY_VERIFIED -> PUBLICATION_RECORD_REDEPLOY_VERIFIED occurred_at=2026-08-29T07:36:02.000Z
// machine-contract: the exact publication-record redeploy requires provider READY plus five matching public files; unchanged functional bytes carry the separately identified prior fresh-browser proof without claiming a new run.
// event_uuid_v7=01a04c90-5270-70a7-8d6b-5b519db83ceb
// state_transition=PUBLICATION_TIMELINE_AMBIGUOUS -> AGGREGATE_AFTER_ALL_PROVIDER_OBSERVATIONS occurred_at=2026-08-29T08:08:41.840Z
// machine-contract: the aggregate publication event cannot complete before the Sites observation or the latest Vercel readback it claims, and Devpost draft authority must match the schema-fixed plan approval.
// event_uuid_v7=01a04cd1-2d21-7be7-80ef-28439e6ddfa3
// state_transition=DYNAMIC_VALIDATOR_INPUTS -> FIXED_SECURITY_CONTRACTS occurred_at=2026-08-29T09:19:32.129Z
// machine-contract: JSON Schema patterns and UUIDv5 identities are fixed review-time contracts; unrecognized values fail closed and are never compiled or treated as cryptographic authority.
// information_uuid_v5=c2da2f0e-eb8c-577e-abdc-d29159355cca
// event_uuid_v7=01a04cfc-c4d6-71b3-8624-f9e37f1008f2
// state_transition=FIRST_APPROVAL_ARRAY_ACCEPTED -> EXACT_DEVPOST_CONDITION_REQUIRED occurred_at=2026-08-29T10:07:09.014Z
// machine-contract: exactly one allOf branch whose if.properties.serviceId.const is devpost must bind the fixed draft-update and final-submission gates; moved, duplicated, or missing branches fail closed.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = resolve(ROOT, "metadata/service-integration-registry.json");
const SCHEMA_PATH = resolve(ROOT, "schemas/service-integration-registry.schema.json");
const HOTEL_VERIFICATION_PATH = resolve(ROOT, "metadata/hotel-booking-verification.json");
const HOTEL_RELEASE_CANDIDATE_PATH = resolve(ROOT, "metadata/hotel-release-candidate.json");
const VERCEL_DEPLOYMENT_PATH = resolve(ROOT, "metadata/vercel-hotel-deployment.json");
const VERCEL_DEPLOYMENT_SCHEMA_PATH = resolve(ROOT, "schemas/vercel-hotel-deployment.schema.json");
const UUID_NAMESPACE = "47f3e535-0e27-559a-9556-aa79a84f95eb";

const EXPECTED_SERVICE_IDS = ["chatgpt-sites", "vercel", "cloudflare", "netlify", "render", "shopify", "google-chrome", "devpost"];

const EXPECTED_PLUGIN_REFS = {
  "chatgpt-sites": "sites@openai-bundled",
  vercel: "vercel@openai-curated-remote",
  cloudflare: "cloudflare@openai-curated-remote",
  netlify: "netlify@openai-curated-remote",
  render: "app-6a624c56bfe081918f7544f7d58f6faf@openai-curated-remote",
  shopify: "shopify@openai-curated-remote",
  "google-chrome": "chrome@openai-bundled",
  devpost: "app-6a330a7730c081919892632d5baaec58@openai-curated-remote",
};

const AXES = {
  pluginState: ["ACTIVE", "INSTALLED_INACTIVE", "NOT_INSTALLED", "NOT_APPLICABLE"],
  authenticationState: ["CONFIRMED", "UNVERIFIED", "REJECTED", "NOT_APPLICABLE"],
  publicationState: ["CURRENT_ARTIFACT", "BASELINE_ONLY", "NOT_PUBLISHED", "UNVERIFIED", "NOT_APPLICABLE"],
  runtimeState: ["CURRENT_ARTIFACT_VERIFIED", "BASELINE_ONLY", "INCONCLUSIVE", "NOT_RUN", "NOT_APPLICABLE"],
};

const APPROVAL_ACTIONS = ["OWNER_ONLY_DEPLOYMENT", "PUBLIC_DEPLOYMENT", "PRODUCTION_DEPLOYMENT", "DRAFT_UPDATE", "FINAL_SUBMISSION", "COMMERCE_WRITE"];

const APPROVAL_STATES = ["AUTHORIZED_BY_PLAN", "AUTHORIZED_BY_USER", "REQUIRES_SEPARATE_APPROVAL", "OUT_OF_SCOPE", "NOT_APPLICABLE"];

const EXPECTED_APPROVAL_GATES = {
  "chatgpt-sites": [
    { action: "OWNER_ONLY_DEPLOYMENT", state: "AUTHORIZED_BY_PLAN" },
    { action: "PUBLIC_DEPLOYMENT", state: "AUTHORIZED_BY_USER" },
  ],
  vercel: [{ action: "PRODUCTION_DEPLOYMENT", state: "AUTHORIZED_BY_USER" }],
  cloudflare: [{ action: "PUBLIC_DEPLOYMENT", state: "OUT_OF_SCOPE" }],
  netlify: [{ action: "PUBLIC_DEPLOYMENT", state: "OUT_OF_SCOPE" }],
  render: [{ action: "PUBLIC_DEPLOYMENT", state: "OUT_OF_SCOPE" }],
  shopify: [{ action: "COMMERCE_WRITE", state: "OUT_OF_SCOPE" }],
  "google-chrome": [{ action: "PUBLIC_DEPLOYMENT", state: "NOT_APPLICABLE" }],
  devpost: [
    { action: "DRAFT_UPDATE", state: "AUTHORIZED_BY_PLAN" },
    { action: "FINAL_SUBMISSION", state: "REQUIRES_SEPARATE_APPROVAL" },
  ],
};

const REQUIRED_ARTIFACTS = [
  "metadata/service-integration-registry.json",
  "schemas/service-integration-registry.schema.json",
  "metadata/vercel-hotel-deployment.json",
  "schemas/vercel-hotel-deployment.schema.json",
  "scripts/validate_service_integrations.mjs",
  "docs/22-service-integrations.ja.md",
];

const EXPECTED_VERCEL_PROVIDER = {
  name: "Vercel",
  teamId: "team_npJWoj9cpy54Q7B3fpGdBCCX",
};

const EXPECTED_VERCEL_ARTIFACT = {
  sourceCommit: "5ac1fe51a29800eb052f9a63e7311559b7c01e45",
  functionalDigest: "06a753e5cd240eebd0663c57031a0993e87cbb87c7d61401eb220dbacd91e132",
  functionalDigestScope: {
    algorithm: "SHA-256",
    root: "dist/client",
    canonicalization: "LEXICOGRAPHIC_RELATIVE_POSIX_PATH_NUL_FILE_BYTES_NUL",
    excludedPaths: [".assetsignore", "service-integrations.json"],
  },
};

const EXPECTED_VERCEL_DEPLOYMENT = {
  projectId: "prj_sfErclBd1NgXtkeA5PVntIoj6Q3X",
  projectName: "kyoto-booking-retry-proof",
  deploymentId: "dpl_ArJPwr1h3KqyxmRRfegcbX4YqTB2",
  sourceState: "PROVIDER_COMMIT_REACHABLE",
  providerGitCommit: "e3d3bb7ccc142a50a2a7af29dad4cd7bb449c4cb",
  providerGitCommitObservation: "e3d3bb7ccc142a50a2a7af29dad4cd7bb449c4cb",
  providerGitDirty: false,
  uniqueUrl: "https://kyoto-booking-retry-proof-kafikuvr2-aniotajp-1978s-projects.vercel.app",
  publicAlias: "https://kyoto-booking-retry-proof.vercel.app",
  state: "READY",
  target: "production",
  source: "cli",
  createdAtUnixMs: 1788010530590,
  createdAt: "2026-08-29T13:35:30.590Z",
  buildingAtUnixMs: 1788010531648,
  buildingAt: "2026-08-29T13:35:31.648Z",
  readyAtUnixMs: 1788010538108,
  readyAt: "2026-08-29T13:35:38.108Z",
  aliasError: null,
};

const EXPECTED_REMOTE_ARTIFACTS = [
  { name: "document", requestPath: "/", localPath: "dist/client/index.html" },
  { name: "application-script", requestPath: "/assets/app.js", localPath: "dist/client/assets/app.js" },
  { name: "application-style", requestPath: "/assets/index.css", localPath: "dist/client/assets/index.css" },
  { name: "service-worker", requestPath: "/service-worker.js", localPath: "dist/client/service-worker.js" },
  {
    name: "service-integration-registry",
    requestPath: "/service-integrations.json",
    localPath: "dist/client/service-integrations.json",
  },
];

const EXPECTED_VERCEL_HTTP = {
  entrypoint: {
    method: "GET",
    url: "https://kyoto-booking-retry-proof.vercel.app",
    statusCode: 200,
    authentication: "ANONYMOUS",
  },
  browserRequests: [
    { path: "/", statusCode: 200 },
    { path: "/assets/app.js", statusCode: 200 },
    { path: "/assets/index.css", statusCode: 200 },
    { path: "/service-integrations.json", statusCode: 200 },
  ],
  serviceWorker: {
    path: "/service-worker.js",
    statusCode: 200,
    serviceWorkerAllowed: "/",
  },
};

const EXPECTED_VERCEL_BROWSER_FLOW = {
  testedUrl: "https://kyoto-booking-retry-proof.vercel.app",
  deploymentId: "dpl_4uthDyjgSi1KxbssW9t5u18xJbLs",
  evidenceState: "CARRIED_FORWARD_BY_IDENTICAL_FUNCTIONAL_DIGEST",
  testedFunctionalDigest: "06a753e5cd240eebd0663c57031a0993e87cbb87c7d61401eb220dbacd91e132",
  appliesToDeploymentId: "dpl_ArJPwr1h3KqyxmRRfegcbX4YqTB2",
  appliesToFunctionalSourceCommit: "5ac1fe51a29800eb052f9a63e7311559b7c01e45",
  storageState: "FRESH",
  input: {
    checkIn: "2026-12-10",
    checkOut: "2026-12-12",
    adults: 2,
    rooms: 1,
    language: "en",
  },
  stateSequence: ["PREPARED", "COMMITTED", "RETRY_RECOGNIZED"],
  humanConfirmationRequired: true,
  attempts: 2,
  bookings: 1,
  effectStarts: 1,
  confirmationNumber: "FKR-7EF2A00FA2",
  reservationUuidV5: "64ccc2dc-0404-5566-b296-92d0eb7ed00f",
  latestEventUuidV7: "01a04cc6-a382-7274-9476-f8b9c37af3d7",
  auditEvents: 4,
  chainValid: true,
  chainHeadSha256: "2aa0854fdc8950698b1bb89c98076edd394c3074c7d70771b767975ed437a8b0",
  chainHeadPrefix: "2aa0854fdc89",
  reloadRestored: true,
  errors: 0,
  warnings: 0,
};

const EXPECTED_VERCEL_OBSERVABILITY = {
  projectId: "prj_sfErclBd1NgXtkeA5PVntIoj6Q3X",
  readyBoundaryDeploymentId: "dpl_ArJPwr1h3KqyxmRRfegcbX4YqTB2",
  environment: "production",
  queryMode: "READY_TO_QUERY_BOUNDED_MAX_ONE_HOUR",
  queryExecutedAt: "2026-08-29T13:37:06.000Z",
  windowStart: "2026-08-29T13:35:38.108Z",
  windowEnd: "2026-08-29T13:37:06.000Z",
  queriedLevels: ["error", "warning"],
  runtimeErrorClusters: 0,
  matchingLogEntries: 0,
  conclusion: "BOUNDED_READY_TO_QUERY_RETURNED_NO_RUNTIME_ERRORS_OR_WARNING_ERROR_LOGS",
};

const EXPECTED_RESTORED_NOTIFICATION_DEPLOYMENT = {
  projectId: "prj_4gaEpKhQ7MPkgovfw3wr1xdokMO6",
  projectName: "verifiable-offline-webmcp-agent-spec",
  deploymentId: "dpl_3KTHTtZ5h8quDhviMTRo5GxBuUuE",
  state: "READY",
  sourceCommit: "8e0191c3a9ea7b1e64a954cc20fd8e5e357f34d2",
  publicAlias: "https://verifiable-offline-webmcp-agent-spe.vercel.app",
  aliasState: "RESTORED_TO_DEPLOYMENT",
  recoveryReason: "ACCIDENTAL_HOTEL_DEPLOYMENT_TO_NOTIFICATION_PROJECT",
  restorationAction: "PROMOTE_SAVED_ORIGINAL_DEPLOYMENT_IMMEDIATELY",
  anonymousStatusCode: 200,
  verifiedContent: "NOTIFICATION_DEMO",
  recoveryObservedAt: "2026-08-29T07:36:02.000Z",
};

const VERCEL_EVIDENCE_SOURCE_NAMES = {
  VERCEL_PROVIDER_READBACK: "vercel-provider-readback",
  ANONYMOUS_HTTP_READBACK: "anonymous-http",
  BROWSER_RUNTIME_READBACK: "browser-runtime",
  VERCEL_OBSERVABILITY_READBACK: "vercel-observability-readback",
  RESTORED_NOTIFICATION_READBACK: "restored-notification-deployment",
};

const SCHEMA_PATTERN_MATCHERS = new Map([
  ["^(READ|WRITE):[a-z][a-z0-9_.:-]*$", /^(READ|WRITE):[a-z][a-z0-9_.:-]*$/u],
  ["^(metadata|schemas|scripts|docs)/[A-Za-z0-9._/-]+$", /^(metadata|schemas|scripts|docs)\/[A-Za-z0-9._/-]+$/u],
  ["^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$", /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u],
  ["^[0-9a-f]{40,64}$", /^[0-9a-f]{40,64}$/u],
  ["^[0-9a-f]{64}$", /^[0-9a-f]{64}$/u],
  ["^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u],
  ["^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u],
  ["^[A-Z][A-Z0-9_]*$", /^[A-Z][A-Z0-9_]*$/u],
  ["^[a-z0-9-]+@(?:openai-bundled|openai-curated-remote)$", /^[a-z0-9-]+@(?:openai-bundled|openai-curated-remote)$/u],
  ["^[a-z0-9-]+@(?:openai-bundled|openai-curated|openai-curated-remote)$", /^[a-z0-9-]+@(?:openai-bundled|openai-curated|openai-curated-remote)$/u],
  ["^[a-z][a-z0-9-]*$", /^[a-z][a-z0-9-]*$/u],
  ["^https://", /^https:\/\//u],
  ["^/[A-Za-z0-9._/-]*$", /^\/[A-Za-z0-9._/-]*$/u],
  ["^FKR-[0-9A-F]{10}$", /^FKR-[0-9A-F]{10}$/u],
  ["^[0-9a-f]{12}$", /^[0-9a-f]{12}$/u],
  ["^[0-9a-f]{40}$", /^[0-9a-f]{40}$/u],
  ["^(?:[0-9a-f]{40}|CHECKOUT_TREE|OFF_HISTORY)$", /^(?:[0-9a-f]{40}|CHECKOUT_TREE|OFF_HISTORY)$/u],
  ["^[a-z0-9][a-z0-9-]*$", /^[a-z0-9][a-z0-9-]*$/u],
  ["^dist/client/[A-Za-z0-9._/-]+$", /^dist\/client\/[A-Za-z0-9._/-]+$/u],
  ["^dpl_[A-Za-z0-9]+$", /^dpl_[A-Za-z0-9]+$/u],
  ["^https://[a-z0-9-]+\\.vercel\\.app$", /^https:\/\/[a-z0-9-]+\.vercel\.app$/u],
  ["^prj_[A-Za-z0-9]+$", /^prj_[A-Za-z0-9]+$/u],
  ["^team_[A-Za-z0-9]+$", /^team_[A-Za-z0-9]+$/u],
]);

const EXPECTED_UUID_V5_BY_NAME = new Map([
  ["deployment-receipt/vercel-hotel-deployment", "b5e254dc-08a3-59e9-a4dd-f2215b184964"],
  ["evidence-source/vercel-provider-readback", "3440768e-6dff-5619-a615-1e919cde6283"],
  ["evidence-source/anonymous-http", "b30fed6a-3f17-520f-bd0a-2b07cb8b03ee"],
  ["evidence-source/browser-runtime", "fa6c0704-ea54-5c17-91c2-3317ce95df4b"],
  ["evidence-source/vercel-observability-readback", "91ffbb3f-52e4-5e6b-bca1-e36c509dc2e3"],
  ["evidence-source/restored-notification-deployment", "c348ef3a-b26e-5291-aad2-0197fb55fdb6"],
  ["integration-surface/chatgpt-sites", "58dcb1cc-e3a8-5329-836d-11299b1ee1e7"],
  ["integration-surface/vercel", "55a56d54-713f-524f-98de-ac3da90e3310"],
  ["integration-surface/cloudflare", "09ea90ae-2124-5a5b-8785-32207039c516"],
  ["integration-surface/netlify", "51b6046b-7f07-5b65-8540-d485c604dd73"],
  ["integration-surface/render", "8b31e6c4-5e59-5c7a-9bb4-46e98effe450"],
  ["integration-surface/shopify", "8c25b751-b30b-5b44-9af6-be825955f1e6"],
  ["integration-surface/google-chrome", "7968f6bc-3ff9-5700-be56-7e1e04c3392d"],
  ["integration-surface/devpost", "3e8ffb12-0a3e-5c18-9dc4-81d59d91ef48"],
  ["registry/service-integration-registry", "db7888ed-01de-5679-a9bf-3cb0a124c18b"],
]);
// RFC 9562 UUIDv5 deliberately uses SHA-1, but these values are non-security identifiers, not authentication or integrity digests.
// This validator pins the finite reviewed identities instead of invoking a weak cryptographic primitive during validation.

const SOURCE_ALLOWLIST = {
  "chatgpt-sites": [/^https:\/\/learn\.chatgpt\.com\/docs\/sites\/?$/],
  vercel: [/^https:\/\/vercel\.com\/docs(?:\/[-a-z0-9/]+)?\/?$/],
  cloudflare: [/^https:\/\/developers\.cloudflare\.com\/workers\/vite-plugin\/?$/],
  netlify: [/^https:\/\/docs\.netlify\.com\/deploy\/create-deploys\/?$/],
  render: [/^https:\/\/render\.com\/docs\/static-sites\/?$/],
  shopify: [/^https:\/\/shopify\.dev\/docs\/api\/web-mcp\/?$/],
  "google-chrome": [/^https:\/\/developer\.chrome\.com\/docs\/ai\/webmcp\/?$/, /^https:\/\/developer\.chrome\.com\/docs\/devtools\/application\/webmcp\/?$/],
  devpost: [/^https:\/\/webmcp\.devpost\.com\/resources\/?$/],
};

const SECRET_PATTERNS = [
  /-{5}BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-{5}/u,
  /\b(?:sk|ghp|github_pat|xox[abprs])[-_][A-Za-z0-9_-]{16,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/i,
];

const errors = [];

function record(condition, message) {
  if (!condition) errors.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: cannot parse JSON: ${error.message}`);
    return null;
  }
}

function resolveLocalRef(schemaRoot, reference) {
  if (!reference.startsWith("#/")) {
    throw new Error(`only local JSON Schema references are supported: ${reference}`);
  }
  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, key) => value?.[key], schemaRoot);
}

function matchesType(value, expected) {
  switch (expected) {
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    default:
      return typeof value === expected;
  }
}

function validateFormat(value, format, path) {
  if (format === "date-time") {
    record(typeof value === "string" && Number.isFinite(Date.parse(value)), `${path}: invalid date-time`);
    return;
  }
  if (format === "uri") {
    try {
      new URL(value);
    } catch {
      errors.push(`${path}: invalid URI`);
    }
  }
}

function approvedSchemaPattern(pattern) {
  return SCHEMA_PATTERN_MATCHERS.get(pattern) ?? null;
}

function matchesApprovedSchemaPattern(value, pattern, path) {
  const matcher = approvedSchemaPattern(pattern);
  if (!matcher) {
    errors.push(`${path}: JSON Schema pattern is outside the fixed validator contract`);
    return false;
  }
  return matcher.test(value);
}

function schemaPatternContractErrors(value, path = "$schema") {
  const findings = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...schemaPatternContractErrors(item, `${path}[${index}]`)));
    return findings;
  }
  if (value === null || typeof value !== "object") return findings;

  if (Object.hasOwn(value, "pattern") && (typeof value.pattern !== "string" || !approvedSchemaPattern(value.pattern))) {
    findings.push(`${path}.pattern is outside the fixed validator contract`);
  }
  if (Object.hasOwn(value, "patternProperties")) {
    if (value.patternProperties === null || typeof value.patternProperties !== "object" || Array.isArray(value.patternProperties)) {
      findings.push(`${path}.patternProperties must be an object`);
    } else {
      for (const pattern of Object.keys(value.patternProperties)) {
        if (!approvedSchemaPattern(pattern)) findings.push(`${path}.patternProperties has an unreviewed key`);
      }
    }
  }
  for (const [key, child] of Object.entries(value)) {
    findings.push(...schemaPatternContractErrors(child, `${path}.${key}`));
  }
  return findings;
}

function validateWithSchema(value, rule, path, schemaRoot) {
  if (!rule || typeof rule !== "object") {
    errors.push(`${path}: invalid JSON Schema rule`);
    return;
  }

  if (rule.$ref) {
    const target = resolveLocalRef(schemaRoot, rule.$ref);
    if (!target) {
      errors.push(`${path}: unresolved JSON Schema reference ${rule.$ref}`);
      return;
    }
    validateWithSchema(value, target, path, schemaRoot);
    return;
  }

  if (Object.hasOwn(rule, "const")) {
    record(isDeepStrictEqual(value, rule.const), `${path}: value differs from JSON Schema const`);
  }
  if (rule.enum) {
    record(
      rule.enum.some((candidate) => isDeepStrictEqual(value, candidate)),
      `${path}: value is outside JSON Schema enum`,
    );
  }

  if (rule.type) {
    const expectedTypes = Array.isArray(rule.type) ? rule.type : [rule.type];
    if (!expectedTypes.some((expected) => matchesType(value, expected))) {
      errors.push(`${path}: expected JSON Schema type ${expectedTypes.join(" or ")}`);
      return;
    }
  }

  if (typeof value === "string") {
    if (rule.minLength !== undefined) record(value.length >= rule.minLength, `${path}: shorter than minLength`);
    if (rule.maxLength !== undefined) record(value.length <= rule.maxLength, `${path}: longer than maxLength`);
    if (rule.pattern !== undefined) record(matchesApprovedSchemaPattern(value, rule.pattern, path), `${path}: does not match pattern`);
    if (rule.format !== undefined) validateFormat(value, rule.format, path);
  }

  if (typeof value === "number") {
    if (rule.minimum !== undefined) record(value >= rule.minimum, `${path}: below minimum`);
    if (rule.maximum !== undefined) record(value <= rule.maximum, `${path}: above maximum`);
  }

  if (Array.isArray(value)) {
    if (rule.minItems !== undefined) record(value.length >= rule.minItems, `${path}: fewer than minItems`);
    if (rule.maxItems !== undefined) record(value.length <= rule.maxItems, `${path}: more than maxItems`);
    if (rule.uniqueItems) {
      const duplicates = value.some((item, index) => value.slice(0, index).some((prior) => isDeepStrictEqual(prior, item)));
      record(!duplicates, `${path}: duplicate array items`);
    }
    if (rule.items && typeof rule.items === "object") {
      value.forEach((item, index) => validateWithSchema(item, rule.items, `${path}[${index}]`, schemaRoot));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const properties = rule.properties ?? {};
    for (const required of rule.required ?? []) {
      record(Object.hasOwn(value, required), `${path}: missing required property ${required}`);
    }
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        record(Object.hasOwn(properties, key), `${path}: unexpected property ${key}`);
      }
    }
    for (const [key, childRule] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) validateWithSchema(value[key], childRule, `${path}.${key}`, schemaRoot);
    }
  }
}

function stableUuidV5(category, name) {
  const key = `${category.trim().toLowerCase()}/${name.trim().toLowerCase()}`;
  return EXPECTED_UUID_V5_BY_NAME.get(key) ?? null;
}

function uuidV7EpochMs(value) {
  const compact = value.replaceAll("-", "");
  if (!/^[0-9a-f]{12}7[0-9a-f]{3}[89ab][0-9a-f]{15}$/u.test(compact)) {
    throw new Error(`not an RFC 9562 UUIDv7: ${value}`);
  }
  return Number(BigInt(`0x${compact}`) >> 80n);
}

function checkUuidV7Time(eventId, observedAt, label) {
  try {
    const embedded = uuidV7EpochMs(eventId);
    const observed = Date.parse(observedAt);
    record(Number.isFinite(observed), `${label}: observedAt is invalid`);
    record(Math.abs(embedded - observed) <= 1000, `${label}: UUIDv7 timestamp differs from observedAt by more than 1000 ms`);
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
  }
}

function countAxis(services, field, allowed) {
  const counts = Object.fromEntries(allowed.map((state) => [state, 0]));
  for (const service of services) {
    const state = service?.[field];
    if (Object.hasOwn(counts, state)) counts[state] += 1;
  }
  return counts;
}

function devpostApprovalConditions(serviceSchema) {
  if (!Array.isArray(serviceSchema?.allOf)) return [];
  return serviceSchema.allOf.filter((condition) => condition?.if?.properties?.serviceId?.const === "devpost");
}

function hasExactDevpostApprovalContract(serviceSchema) {
  const conditions = devpostApprovalConditions(serviceSchema);
  return conditions.length === 1 && isDeepStrictEqual(conditions[0]?.then?.properties?.approvalGates?.const, EXPECTED_APPROVAL_GATES.devpost);
}

function safeArtifactPath(relativePath) {
  const absolute = resolve(ROOT, relativePath);
  record(absolute.startsWith(`${ROOT}${sep}`), `artifact path escapes repository: ${relativePath}`);
  return absolute;
}

function checkSecretFields(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkSecretFields(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (/(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|private[_-]?key|credential)/iu.test(key)) {
      record(child === null || child === "" || child === false, `${path}.${key}: credential-shaped field must be empty`);
    }
    checkSecretFields(child, `${path}.${key}`);
  }
}

const registry = readJson(REGISTRY_PATH);
const schema = readJson(SCHEMA_PATH);
const hotelVerification = readJson(HOTEL_VERIFICATION_PATH);
const hotelReleaseCandidate = readJson(HOTEL_RELEASE_CANDIDATE_PATH);
const vercelDeployment = readJson(VERCEL_DEPLOYMENT_PATH);
const vercelDeploymentSchema = readJson(VERCEL_DEPLOYMENT_SCHEMA_PATH);

record(
  schemaPatternContractErrors({ pattern: "^(a+)+$", patternProperties: { "^(.+)+$": {} } }).length === 2,
  "unreviewed JSON Schema value and property patterns must remain rejected",
);
record(stableUuidV5("unreviewed", "identity") === null, "unreviewed UUIDv5 identities must remain rejected without aborting error aggregation");
for (const [label, loadedSchema] of [
  ["service integration registry schema", schema],
  ["Vercel deployment schema", vercelDeploymentSchema],
]) {
  if (loadedSchema) {
    record(schemaPatternContractErrors(loadedSchema).length === 0, `${label} contains a pattern outside the fixed validator contract`);
  }
}

if (vercelDeployment && vercelDeploymentSchema) {
  validateWithSchema(vercelDeployment, vercelDeploymentSchema, "$vercelDeployment", vercelDeploymentSchema);

  // information_uuid_v5=0a9f796d-070b-5423-8d43-17007716714b
  // event_uuid_v7=01a05066-0020-77b4-8956-b8e42cd3be39
  // state_transition=SENTINEL_FUNCTIONAL_SOURCE -> HASH_ONLY_FUNCTIONAL_SOURCE -> VERIFIED occurred_at=2026-08-30T02:00:00.000Z
  // machine-contract: provider-only uncertainty sentinels never satisfy functional or recovery source-commit fields.
  for (const [label, path] of [
    ["artifact source", ["artifact", "sourceCommit"]],
    ["browser-flow source", ["browserFlow", "appliesToFunctionalSourceCommit"]],
    ["restored-deployment source", ["restoredNotificationDeployment", "sourceCommit"]],
    ["provider deployment source", ["deployment", "providerGitCommit"]],
  ]) {
    for (const sentinel of ["CHECKOUT_TREE", "OFF_HISTORY"]) {
      const candidate = structuredClone(vercelDeployment);
      let target = candidate;
      for (const key of path.slice(0, -1)) target = target[key];
      target[path.at(-1)] = sentinel;
      const beforeErrors = errors.length;
      validateWithSchema(candidate, vercelDeploymentSchema, "$vercelDeployment", vercelDeploymentSchema);
      const rejected = errors.length > beforeErrors;
      errors.length = beforeErrors;
      record(rejected, `${label} must reject ${sentinel} provider uncertainty sentinel`);
    }
  }

  const identity = vercelDeployment.identity ?? {};
  const stateTransition = vercelDeployment.stateTransition ?? {};
  record(
    identity.informationUuidV5 === stableUuidV5("deployment-receipt", "vercel-hotel-deployment"),
    "Vercel receipt informationUuidV5 is not the stable deployment-receipt identity",
  );
  record(identity.namespace === UUID_NAMESPACE, "Vercel receipt UUID namespace differs from the repository namespace");
  checkUuidV7Time(identity.observationUuidV7 ?? "", identity.observedAt ?? "", "Vercel receipt identity");
  record(stateTransition.eventId === identity.observationUuidV7, "Vercel receipt transition event differs from its observation event");
  record(stateTransition.occurredAt === identity.observedAt, "Vercel receipt transition time differs from its observation time");

  record(isDeepStrictEqual(vercelDeployment.provider, EXPECTED_VERCEL_PROVIDER), "Vercel receipt provider or team differs from deployment readback");
  record(
    isDeepStrictEqual(vercelDeployment.artifact, EXPECTED_VERCEL_ARTIFACT),
    "Vercel receipt source commit, digest, or digest scope differs from the deployed artifact",
  );
  record(
    isDeepStrictEqual(vercelDeployment.deployment, EXPECTED_VERCEL_DEPLOYMENT),
    "Vercel receipt project, deployment, URLs, state, source, or timestamps differ from provider readback",
  );
  record(
    vercelDeployment.deployment?.sourceState === "PROVIDER_COMMIT_REACHABLE" &&
      /^[0-9a-f]{40}$/u.test(vercelDeployment.deployment?.providerGitCommit ?? "") &&
      /^[0-9a-f]{40}$/u.test(vercelDeployment.deployment?.providerGitCommitObservation ?? ""),
    "Vercel provider commit must be a reachable commit when the reviewed history contains it",
  );
  const remoteArtifacts = vercelDeployment.remoteArtifacts ?? {};
  record(remoteArtifacts.deploymentId === vercelDeployment.deployment?.deploymentId, "Vercel remote artifacts differ from the deployment ID");
  record(remoteArtifacts.baseUrl === vercelDeployment.deployment?.publicAlias, "Vercel remote artifacts must use the anonymously accessible public alias");
  const remoteArtifactRows = Array.isArray(remoteArtifacts.artifacts) ? remoteArtifacts.artifacts : [];
  record(
    isDeepStrictEqual(
      remoteArtifactRows.map(({ name, requestPath, localPath }) => ({ name, requestPath, localPath })),
      EXPECTED_REMOTE_ARTIFACTS,
    ),
    "Vercel remote artifact names, request paths, local paths, or order differ from the fixed contract",
  );
  const candidateFunctionalDigest = hotelReleaseCandidate?.artifacts?.functionalClientSha256;
  const publicFunctionalDigest = vercelDeployment?.artifact?.functionalDigest;
  const candidateIsExplicitlyUnpublished =
    hotelReleaseCandidate?.source?.state === "WORKTREE_CANDIDATE" &&
    typeof candidateFunctionalDigest === "string" &&
    candidateFunctionalDigest !== publicFunctionalDigest;
  record(
    candidateIsExplicitlyUnpublished || candidateFunctionalDigest === publicFunctionalDigest,
    "the candidate must either match the public Vercel digest or explicitly remain an unpublished worktree candidate",
  );
  for (const remoteArtifact of remoteArtifactRows) {
    record(remoteArtifact.statusCode === 200, `Vercel remote artifact ${remoteArtifact.requestPath} is not HTTP 200`);
    const localPath = safeArtifactPath(remoteArtifact.localPath);
    record(existsSync(localPath), `Vercel remote artifact local file does not exist: ${remoteArtifact.localPath}`);
    if (existsSync(localPath) && !candidateIsExplicitlyUnpublished) {
      const localSha256 = createHash("sha256").update(readFileSync(localPath)).digest("hex");
      record(remoteArtifact.sha256 === localSha256, `Vercel remote artifact hash differs from ${remoteArtifact.localPath}`);
    } else if (candidateIsExplicitlyUnpublished) {
      record(
        /^[0-9a-f]{64}$/u.test(remoteArtifact.sha256 ?? ""),
        `Vercel historical remote artifact has an invalid SHA-256 value: ${remoteArtifact.requestPath}`,
      );
    }
  }
  if (remoteArtifacts.hashEvidenceState === "LOCAL_BUILD_HASHES_STAGED_FOR_REDEPLOY") {
    record(remoteArtifacts.remoteHashReadbackAt === null, "Staged Vercel hashes cannot claim a remote readback time");
  } else if (remoteArtifacts.hashEvidenceState === "REMOTE_HASHES_READ_BACK_AND_MATCHED") {
    record(
      Date.parse(remoteArtifacts.remoteHashReadbackAt) >= Date.parse(vercelDeployment.deployment?.readyAt),
      "Vercel remote hash readback predates deployment READY",
    );
  }
  record(
    isDeepStrictEqual(vercelDeployment.anonymousHttp, EXPECTED_VERCEL_HTTP),
    "Vercel receipt anonymous HTTP, browser request, or service-worker evidence differs from readback",
  );
  record(
    isDeepStrictEqual(vercelDeployment.browserFlow, EXPECTED_VERCEL_BROWSER_FLOW),
    "Vercel receipt browser flow differs from the verified retry sequence and counters",
  );
  record(
    vercelDeployment.browserFlow?.testedUrl === vercelDeployment.deployment?.publicAlias,
    "Vercel browser flow was not tested on the anonymously accessible public alias",
  );
  record(
    vercelDeployment.browserFlow?.deploymentId !== vercelDeployment.deployment?.deploymentId,
    "Carried Vercel browser evidence must retain the deployment that was actually tested",
  );
  record(
    vercelDeployment.browserFlow?.appliesToDeploymentId === vercelDeployment.deployment?.deploymentId,
    "Carried Vercel browser evidence does not name the current deployment",
  );
  record(
    vercelDeployment.browserFlow?.appliesToFunctionalSourceCommit === vercelDeployment.artifact?.sourceCommit,
    "Carried Vercel browser evidence does not name the functional source commit",
  );
  record(
    vercelDeployment.browserFlow?.testedFunctionalDigest === vercelDeployment.artifact?.functionalDigest,
    "Carried Vercel browser evidence and current functional artifact digests differ",
  );
  record(
    isDeepStrictEqual(vercelDeployment.postDeployObservability, EXPECTED_VERCEL_OBSERVABILITY),
    "Vercel receipt bounded post-deploy error scan differs from provider readback",
  );
  record(
    isDeepStrictEqual(vercelDeployment.restoredNotificationDeployment, EXPECTED_RESTORED_NOTIFICATION_DEPLOYMENT),
    "Vercel receipt restored notification deployment differs from provider readback",
  );

  const deployment = vercelDeployment.deployment ?? {};
  record(
    Number.isInteger(deployment.createdAtUnixMs) && new Date(deployment.createdAtUnixMs).toISOString() === deployment.createdAt,
    "Vercel receipt createdAt does not match the provider millisecond timestamp",
  );
  record(
    Number.isInteger(deployment.readyAtUnixMs) && new Date(deployment.readyAtUnixMs).toISOString() === deployment.readyAt,
    "Vercel receipt readyAt does not match the provider millisecond timestamp",
  );
  record(
    Number.isInteger(deployment.buildingAtUnixMs) && new Date(deployment.buildingAtUnixMs).toISOString() === deployment.buildingAt,
    "Vercel receipt buildingAt does not match the provider millisecond timestamp",
  );
  record(
    deployment.createdAtUnixMs <= deployment.buildingAtUnixMs && deployment.buildingAtUnixMs <= deployment.readyAtUnixMs,
    "Vercel receipt creation, build, and READY times are out of order",
  );
  record(
    vercelDeployment.browserFlow?.chainHeadPrefix === vercelDeployment.browserFlow?.chainHeadSha256?.slice(0, 12),
    "Vercel browser-flow chain prefix differs from its full SHA-256 head",
  );

  const observability = vercelDeployment.postDeployObservability ?? {};
  record(
    Date.parse(observability.windowEnd) > Date.parse(observability.windowStart) &&
      Date.parse(observability.windowEnd) - Date.parse(observability.windowStart) <= 60 * 60 * 1000,
    "Vercel receipt post-deploy observation window is not a positive period of at most one hour",
  );
  record(observability.windowEnd === observability.queryExecutedAt, "Vercel one-hour lookback must end when the query was executed");
  record(Date.parse(observability.queryExecutedAt) >= Date.parse(deployment.readyAt), "Vercel one-hour lookback query was executed before deployment READY");
  record(observability.windowStart === deployment.readyAt, "Vercel bounded observation does not start at the current deployment READY boundary");
  record(observability.readyBoundaryDeploymentId === deployment.deploymentId, "Vercel bounded observation is not anchored to the current deployment ID");

  const evidenceSources = Array.isArray(vercelDeployment.evidenceSources) ? vercelDeployment.evidenceSources : [];
  record(
    isDeepStrictEqual(
      evidenceSources.map((source) => source?.kind),
      Object.keys(VERCEL_EVIDENCE_SOURCE_NAMES),
    ),
    "Vercel receipt evidence source order or kinds differ from the machine contract",
  );
  const evidenceSourceIds = new Set();
  for (const source of evidenceSources) {
    const canonicalName = VERCEL_EVIDENCE_SOURCE_NAMES[source?.kind];
    record(typeof canonicalName === "string", `Vercel receipt has an unknown evidence source kind: ${source?.kind}`);
    if (typeof canonicalName === "string") {
      record(source.sourceId === stableUuidV5("evidence-source", canonicalName), `Vercel receipt ${source.kind} sourceId is not the stable UUIDv5`);
    }
    record(!evidenceSourceIds.has(source?.sourceId), `Vercel receipt duplicates evidence source ${source?.sourceId}`);
    evidenceSourceIds.add(source?.sourceId);
  }

  record(vercelDeployment.secretsIncluded === false, "Vercel receipt must state that no secrets are included");
  const serializedVercelDeployment = JSON.stringify(vercelDeployment);
  for (const pattern of SECRET_PATTERNS) {
    record(!pattern.test(serializedVercelDeployment), `Vercel receipt contains secret-shaped data matching ${pattern}`);
  }
  checkSecretFields(vercelDeployment, "$vercelDeployment");
}

if (hotelVerification && vercelDeployment) {
  const aggregateObservedAt = hotelVerification.observedAt;
  checkUuidV7Time(hotelVerification.identity?.observationUuidV7 ?? "", aggregateObservedAt ?? "", "hotel publication aggregate");
  const claimedProviderObservations = [hotelVerification.liveDeployment?.observedAt];
  // machine-contract: a newer standalone Vercel receipt is not retroactively
  // claimed by the older Sites aggregate while its vercelDeployment field is null.
  if (hotelVerification.vercelDeployment !== undefined && hotelVerification.vercelDeployment !== null) {
    claimedProviderObservations.push(
      vercelDeployment.identity?.observedAt,
      vercelDeployment.remoteArtifacts?.remoteHashReadbackAt,
      vercelDeployment.postDeployObservability?.queryExecutedAt,
      vercelDeployment.restoredNotificationDeployment?.recoveryObservedAt,
    );
  }
  const aggregateTime = Date.parse(aggregateObservedAt);
  record(Number.isFinite(aggregateTime), "hotel publication aggregate has an invalid observation time");
  for (const providerObservedAt of claimedProviderObservations) {
    const providerTime = Date.parse(providerObservedAt);
    record(Number.isFinite(providerTime), `claimed provider observation is invalid: ${providerObservedAt}`);
    record(aggregateTime >= providerTime, `hotel publication aggregate predates claimed provider observation ${providerObservedAt}`);
  }
}

if (registry && schema) {
  validateWithSchema(registry, schema, "$", schema);

  record(
    isDeepStrictEqual(Object.fromEntries(Object.keys(AXES).map((axis) => [axis, schema.$defs?.service?.properties?.[axis]?.enum])), AXES),
    "JSON Schema axis enums differ from the four-axis machine contract",
  );
  record(
    isDeepStrictEqual(schema.$defs?.approvalGate?.properties?.action?.enum, APPROVAL_ACTIONS),
    "JSON Schema approval action enum differs from the machine contract",
  );
  record(
    isDeepStrictEqual(schema.$defs?.approvalGate?.properties?.state?.enum, APPROVAL_STATES),
    "JSON Schema approval state enum differs from the machine contract",
  );
  const serviceSchema = schema.$defs?.service;
  const devpostConditions = devpostApprovalConditions(serviceSchema);
  record(devpostConditions.length === 1, "JSON Schema must contain exactly one approval-gate condition targeted to serviceId=devpost");
  record(
    hasExactDevpostApprovalContract(serviceSchema),
    "JSON Schema Devpost approval gates differ from the plan-authorized draft and separately approved final submission contract",
  );

  const validDevpostFixture = structuredClone(serviceSchema ?? {});
  record(hasExactDevpostApprovalContract(validDevpostFixture), "Devpost approval selector rejects its fixed positive control");

  const movedDevpostFixture = structuredClone(validDevpostFixture);
  for (const condition of devpostApprovalConditions(movedDevpostFixture)) condition.if.properties.serviceId.const = "shopify";
  record(!hasExactDevpostApprovalContract(movedDevpostFixture), "Devpost approval selector accepts gates moved to another service");

  const duplicatedDevpostFixture = structuredClone(validDevpostFixture);
  const duplicatedCondition = devpostApprovalConditions(duplicatedDevpostFixture)[0];
  if (duplicatedCondition) duplicatedDevpostFixture.allOf.push(structuredClone(duplicatedCondition));
  record(!hasExactDevpostApprovalContract(duplicatedDevpostFixture), "Devpost approval selector accepts duplicate Devpost conditions");

  const missingDevpostFixture = structuredClone(validDevpostFixture);
  missingDevpostFixture.allOf = (missingDevpostFixture.allOf ?? []).filter((condition) => condition?.if?.properties?.serviceId?.const !== "devpost");
  record(!hasExactDevpostApprovalContract(missingDevpostFixture), "Devpost approval selector accepts a missing Devpost condition");

  const services = Array.isArray(registry.services) ? registry.services : [];
  const actualServiceIds = services.map((service) => service?.serviceId);
  record(isDeepStrictEqual(actualServiceIds, EXPECTED_SERVICE_IDS), "service IDs or order differ from the exact eight-service contract");

  const evidenceEventIds = new Set();
  for (const service of services) {
    if (service === null || typeof service !== "object" || Array.isArray(service)) continue;
    if (typeof service.serviceId !== "string") {
      errors.push("service row cannot be checked without a string serviceId");
      continue;
    }
    record(
      service.integrationSurfaceId === stableUuidV5("integration-surface", service.serviceId),
      `${service.serviceId}: integrationSurfaceId is not the stable UUIDv5`,
    );
    record(service.pluginRef === EXPECTED_PLUGIN_REFS[service.serviceId], `${service.serviceId}: pluginRef differs from the registered surface`);
    checkUuidV7Time(service.evidenceEventId, service.observedAt, service.serviceId);
    record(!evidenceEventIds.has(service.evidenceEventId), `${service.serviceId}: evidenceEventId is duplicated`);
    evidenceEventIds.add(service.evidenceEventId);

    for (const [axis, allowed] of Object.entries(AXES)) {
      record(allowed.includes(service[axis]), `${service.serviceId}: invalid ${axis}`);
    }

    record(
      isDeepStrictEqual(service.approvalGates, EXPECTED_APPROVAL_GATES[service.serviceId]),
      `${service.serviceId}: approvalGates differ from the external-action authority contract`,
    );

    if (service.runtimeState === "CURRENT_ARTIFACT_VERIFIED") {
      record(
        service.publicationState === "CURRENT_ARTIFACT",
        `${service.serviceId}: current-artifact runtime evidence requires current-artifact publication evidence`,
      );
    }
    if (service.runtimeState === "BASELINE_ONLY") {
      record(service.publicationState === "BASELINE_ONLY", `${service.serviceId}: baseline runtime evidence requires baseline publication evidence`);
    }

    const installation = service.installationEvidence ?? {};
    record(installation.taskCallable === (service.pluginState === "ACTIVE"), `${service.serviceId}: ACTIVE must match taskCallable`);
    record(
      installation.taskCallable ? installation.callableToolCount > 0 : installation.callableToolCount === 0,
      `${service.serviceId}: callable tool count differs from taskCallable`,
    );
    const locallyInstalled = ["INSTALLED_ENABLED", "INSTALLED_DISABLED"].includes(installation.localPluginState);
    record(
      locallyInstalled === (typeof installation.localPluginRef === "string" && typeof installation.localPluginVersion === "string"),
      `${service.serviceId}: local plugin state differs from its reference or version`,
    );
    record(
      installation.restartState !== "REQUIRED_AFTER_INSTALL" || installation.localPluginState === "INSTALLED_ENABLED",
      `${service.serviceId}: restart can be pending only after an enabled local install`,
    );

    const currentArtifactClaim = service.publicationState === "CURRENT_ARTIFACT" || service.runtimeState === "CURRENT_ARTIFACT_VERIFIED";
    record(
      !currentArtifactClaim || (service.artifactCommit !== null && service.artifactSha256 !== null),
      `${service.serviceId}: current-artifact claim requires both artifactCommit and artifactSha256`,
    );

    if (service.authenticationState === "CONFIRMED") {
      record(
        Array.isArray(service.verifiedAuthOperations) && service.verifiedAuthOperations.length > 0,
        `${service.serviceId}: CONFIRMED authentication needs a directly verified operation`,
      );
    } else {
      record(
        Array.isArray(service.verifiedAuthOperations) && service.verifiedAuthOperations.length === 0,
        `${service.serviceId}: unconfirmed authentication cannot list verified operations`,
      );
    }
    if (service.pluginState === "NOT_INSTALLED" || service.pluginState === "NOT_APPLICABLE") {
      record(service.authenticationState !== "CONFIRMED", `${service.serviceId}: an unavailable plugin cannot claim confirmed authentication`);
    }

    for (const source of Array.isArray(service.sources) ? service.sources : []) {
      try {
        const url = new URL(source);
        record(url.protocol === "https:", `${service.serviceId}: source must use HTTPS`);
        record(!url.username && !url.password && !url.search && !url.hash, `${service.serviceId}: source URL cannot carry credentials, query, or fragment`);
      } catch {
        errors.push(`${service.serviceId}: source is not a URL`);
      }
      const allowed = SOURCE_ALLOWLIST[service.serviceId] ?? [];
      record(
        allowed.some((pattern) => pattern.test(source)),
        `${service.serviceId}: source is outside its official HTTPS allowlist`,
      );
    }
  }

  const identity = registry.identity ?? {};
  const stateTransition = registry.stateTransition ?? {};
  record(identity.registryId === stableUuidV5("registry", "service-integration-registry"), "registryId is not the stable UUIDv5");
  checkUuidV7Time(identity.evidenceEventId ?? "", identity.observedAt ?? "", "registry identity");
  record(stateTransition.eventId === identity.evidenceEventId, "state transition event differs from registry evidence event");
  record(stateTransition.occurredAt === identity.observedAt, "state transition time differs from registry observation time");

  const sites = services.find((service) => service?.serviceId === "chatgpt-sites");
  record(
    sites?.artifactCommit === hotelVerification?.liveDeployment?.functionalSourceCommit,
    "chatgpt-sites: artifactCommit differs from the live hotel deployment receipt",
  );
  record(
    sites?.artifactSha256 === hotelVerification?.liveDeployment?.functionalArtifactDigest,
    "chatgpt-sites: artifactSha256 differs from the live hotel deployment receipt",
  );

  const vercel = services.find((service) => service?.serviceId === "vercel");
  record(vercel?.publicationState === "CURRENT_ARTIFACT", "vercel: receipt requires CURRENT_ARTIFACT publication state");
  record(vercel?.runtimeState === "CURRENT_ARTIFACT_VERIFIED", "vercel: receipt requires CURRENT_ARTIFACT_VERIFIED runtime state");
  record(vercel?.reasonCode === "PUBLIC_HOTEL_ARTIFACT_VERIFIED", "vercel: reasonCode differs from the verified hotel deployment state");
  record(vercel?.artifactCommit === vercelDeployment?.artifact?.sourceCommit, "vercel: artifactCommit differs from the Vercel hotel deployment receipt");
  record(vercel?.artifactSha256 === vercelDeployment?.artifact?.functionalDigest, "vercel: artifactSha256 differs from the Vercel hotel deployment receipt");
  record(
    /^[0-9a-f]{40}$/u.test(hotelVerification?.sourceCommit ?? "") &&
      hotelVerification?.sourceProvenance?.providerCommitReachability === "REACHABLE" &&
      hotelVerification?.sourceProvenance?.reproducibilityBoundary === "FULL_SITES_PACKAGE_DIGEST",
    "hotel Sites receipt must state the reachable provider source and artifact reproducibility boundary",
  );
  record(
    vercelDeployment?.artifact?.functionalDigest === hotelVerification?.artifactDigest,
    "Vercel and Sites receipts differ on the shared functional client digest",
  );

  const computedSummary = {
    totalServices: services.length,
    ...Object.fromEntries(Object.entries(AXES).map(([axis, allowed]) => [axis, countAxis(services, axis, allowed)])),
  };
  record(isDeepStrictEqual(registry.summary, computedSummary), "summary counts do not match service rows");

  const artifacts = registry.artifacts ?? {};
  record(isDeepStrictEqual(artifacts.required, REQUIRED_ARTIFACTS), "required artifact list differs from the machine contract");
  for (const relativePath of Array.isArray(artifacts.required) ? artifacts.required : []) {
    const absolute = safeArtifactPath(relativePath);
    record(existsSync(absolute), `required artifact does not exist: ${relativePath}`);
    if (existsSync(absolute)) {
      const details = statSync(absolute);
      record(details.isFile(), `required artifact is not a file: ${relativePath}`);
      record(details.size > 0, `required artifact is empty: ${relativePath}`);
      record(realpathSync(absolute).startsWith(`${realpathSync(ROOT)}${sep}`), `required artifact resolves outside repository: ${relativePath}`);
    }
  }

  if (typeof artifacts.optionalClientCopy === "string") {
    const clientCopyPath = safeArtifactPath(artifacts.optionalClientCopy);
    if (existsSync(clientCopyPath)) {
      const clientCopy = readJson(clientCopyPath);
      if (clientCopy) record(isDeepStrictEqual(clientCopy, registry), "dist/client/service-integrations.json differs from the registry source");
    }
  }

  const serialized = JSON.stringify(registry);
  for (const pattern of SECRET_PATTERNS) {
    record(!pattern.test(serialized), `registry contains secret-shaped data matching ${pattern}`);
  }
  checkSecretFields(registry);

  const shopify = services.find((service) => service?.serviceId === "shopify");
  record(shopify?.publicationState === "NOT_APPLICABLE", "Shopify publication must remain NOT_APPLICABLE for the hotel boundary");
  record(shopify?.runtimeState === "NOT_APPLICABLE", "Shopify runtime must remain NOT_APPLICABLE for the hotel boundary");
}

if (errors.length > 0) {
  console.error(`service integration registry: FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const copyState = existsSync(resolve(ROOT, "dist/client/service-integrations.json")) ? "client copy matched" : "client copy not built";
  const candidateState =
    hotelReleaseCandidate?.source?.state === "WORKTREE_CANDIDATE"
      ? "historical public Vercel receipt retained; worktree candidate not published"
      : "candidate and public Vercel artifact boundary matched";
  console.log(
    `service integration registry: PASS (8 services; registry and Vercel receipt schemas, identities, states, approval gates, deployment and browser evidence, sources, artifacts, summary; ${copyState}; ${candidateState})`,
  );
}

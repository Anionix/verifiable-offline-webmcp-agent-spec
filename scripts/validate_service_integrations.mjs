#!/usr/bin/env node
// information_uuid_v5=5467fd93-e0f2-59b0-bd0d-ede0efdd2aca
// event_uuid_v7=01a04b08-4f98-76e5-87e3-592f83ccae4e
// state_transition=UNRECORDED -> FOUR_AXIS_RECORDED occurred_at=2026-08-29T01:00:31.000Z
// machine-contract: installation, authentication, publication, and runtime evidence are validated independently; read success never grants write authority.
// event_uuid_v7=01a04b38-0e40-7595-81ae-fd2db303c4ae
// state_transition=FOUR_AXIS_RECORDED -> APPROVAL_GATES_ENFORCED occurred_at=2026-08-29T01:52:40.000Z
// machine-contract: external writes are allowed only when the exact service/action gate records plan or user authority.
// event_uuid_v7=01a04bb2-b8ef-7ea8-9b99-6a0ab5d36ec1
// state_transition=OWNER_ONLY_SITE_LIVE_VERIFIED -> PUBLIC_SITE_VERSION_4_VERIFIED occurred_at=2026-08-29T04:06:39.087Z
// machine-contract: the current Sites row must identify the same functional commit and digest as the Sites-specific hotel receipt.
// event_uuid_v7=01a04be5-0163-7a97-8904-c882da28add6
// state_transition=SITES_RECEIPT_BOUND_ONLY -> SITES_AND_VERCEL_RECEIPTS_BOUND occurred_at=2026-08-29T05:01:34.435Z
// machine-contract: the Vercel current-artifact row requires its own provider, HTTP, browser-flow, bounded-observability, and restored-notification receipt.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = resolve(ROOT, "metadata/service-integration-registry.json");
const SCHEMA_PATH = resolve(ROOT, "schemas/service-integration-registry.schema.json");
const HOTEL_VERIFICATION_PATH = resolve(ROOT, "metadata/hotel-booking-verification.json");
const VERCEL_DEPLOYMENT_PATH = resolve(ROOT, "metadata/vercel-hotel-deployment.json");
const VERCEL_DEPLOYMENT_SCHEMA_PATH = resolve(ROOT, "schemas/vercel-hotel-deployment.schema.json");
const UUID_NAMESPACE = "47f3e535-0e27-559a-9556-aa79a84f95eb";

const EXPECTED_SERVICE_IDS = [
  "chatgpt-sites",
  "vercel",
  "cloudflare",
  "netlify",
  "render",
  "shopify",
  "google-chrome",
  "devpost",
];

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

const APPROVAL_ACTIONS = [
  "OWNER_ONLY_DEPLOYMENT",
  "PUBLIC_DEPLOYMENT",
  "PRODUCTION_DEPLOYMENT",
  "DRAFT_UPDATE",
  "FINAL_SUBMISSION",
  "COMMERCE_WRITE",
];

const APPROVAL_STATES = [
  "AUTHORIZED_BY_PLAN",
  "AUTHORIZED_BY_USER",
  "REQUIRES_SEPARATE_APPROVAL",
  "OUT_OF_SCOPE",
  "NOT_APPLICABLE",
];

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
  sourceCommit: "5ce64bc9a814200467d384bba9d9de364df6fcf6",
  functionalDigest: "0f8b2a68e99c4464198744f0e714c4f9348401905ec4cdaff350f2619f45e470",
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
  deploymentId: "dpl_CyYYwVhbugwfLWTKwYhizsNmQ41h",
  deployedSourceCommit: "5ce64bc9a814200467d384bba9d9de364df6fcf6",
  uniqueUrl: "https://kyoto-booking-retry-proof-pascji816-aniotajp-1978s-projects.vercel.app",
  publicAlias: "https://kyoto-booking-retry-proof.vercel.app",
  state: "READY",
  target: "production",
  source: "cli",
  createdAtUnixMs: 1787979546470,
  createdAt: "2026-08-29T04:59:06.470Z",
  readyAtUnixMs: 1787979557329,
  readyAt: "2026-08-29T04:59:17.329Z",
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
  testedUrl: "https://kyoto-booking-retry-proof-pascji816-aniotajp-1978s-projects.vercel.app",
  deploymentId: "dpl_CyYYwVhbugwfLWTKwYhizsNmQ41h",
  stateSequence: ["PREPARED", "COMMITTED", "RETRY_RECOGNIZED"],
  humanConfirmationRequired: true,
  attempts: 2,
  bookings: 1,
  effectStarts: 1,
  confirmationNumber: "FKR-1852E0269A",
  reservationUuidV5: "4181074b-ce92-5b97-9eef-964a6f8f064b",
  latestEventUuidV7: "01a04be3-c7cf-70bf-b76a-d870ee1ba2a3",
  auditEvents: 4,
  chainValid: true,
  chainHeadPrefix: "58fcb989f045",
  reloadRestored: true,
  errors: 0,
  warnings: 0,
};

const EXPECTED_VERCEL_OBSERVABILITY = {
  projectId: "prj_sfErclBd1NgXtkeA5PVntIoj6Q3X",
  environment: "production",
  queryMode: "ONE_HOUR_LOOKBACK_EXECUTED_AFTER_READY",
  queryExecutedAt: "2026-08-29T05:06:19.195Z",
  windowStart: "2026-08-29T04:06:19.195Z",
  windowEnd: "2026-08-29T05:06:19.195Z",
  queriedLevels: ["error", "warning"],
  runtimeErrorClusters: 0,
  matchingLogEntries: 0,
  conclusion: "ONE_HOUR_LOOKBACK_RETURNED_NO_RUNTIME_ERRORS_OR_WARNING_ERROR_LOGS",
};

const EXPECTED_RESTORED_NOTIFICATION_DEPLOYMENT = {
  projectId: "prj_4gaEpKhQ7MPkgovfw3wr1xdokMO6",
  projectName: "verifiable-offline-webmcp-agent-spec",
  deploymentId: "dpl_3KTHTtZ5h8quDhviMTRo5GxBuUuE",
  state: "READY",
  sourceCommit: "8e0191c3a9ea7b1e64a954cc20fd8e5e357f34d2",
  publicAlias: "https://verifiable-offline-webmcp-agent-spe.vercel.app",
  aliasState: "RESTORED_TO_DEPLOYMENT",
};

const VERCEL_EVIDENCE_SOURCE_NAMES = {
  VERCEL_PROVIDER_READBACK: "vercel-provider-readback",
  ANONYMOUS_HTTP_READBACK: "anonymous-http",
  BROWSER_RUNTIME_READBACK: "browser-runtime",
  VERCEL_OBSERVABILITY_READBACK: "vercel-observability-readback",
  RESTORED_NOTIFICATION_READBACK: "restored-notification-deployment",
};

const SOURCE_ALLOWLIST = {
  "chatgpt-sites": [/^https:\/\/learn\.chatgpt\.com\/docs\/sites\/?$/],
  vercel: [/^https:\/\/vercel\.com\/docs(?:\/[-a-z0-9/]+)?\/?$/],
  cloudflare: [/^https:\/\/developers\.cloudflare\.com\/workers\/vite-plugin\/?$/],
  netlify: [/^https:\/\/docs\.netlify\.com\/deploy\/create-deploys\/?$/],
  render: [/^https:\/\/render\.com\/docs\/static-sites\/?$/],
  shopify: [/^https:\/\/shopify\.dev\/docs\/api\/web-mcp\/?$/],
  "google-chrome": [
    /^https:\/\/developer\.chrome\.com\/docs\/ai\/webmcp\/?$/,
    /^https:\/\/developer\.chrome\.com\/docs\/devtools\/application\/webmcp\/?$/,
  ],
  devpost: [/^https:\/\/webmcp\.devpost\.com\/resources\/?$/],
};

const SECRET_PATTERNS = [
  new RegExp(`-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE ${"KEY"}-----`, "u"),
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
    record(rule.enum.some((candidate) => isDeepStrictEqual(value, candidate)), `${path}: value is outside JSON Schema enum`);
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
    if (rule.pattern !== undefined) record(new RegExp(rule.pattern, "u").test(value), `${path}: does not match pattern`);
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

function uuidBytes(value) {
  const hex = value.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/u.test(hex)) throw new Error(`invalid UUID: ${value}`);
  return Buffer.from(hex, "hex");
}

function formatUuid(bytes) {
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stableUuidV5(category, name) {
  const digest = createHash("sha1")
    .update(uuidBytes(UUID_NAMESPACE))
    .update(Buffer.from(`${category.trim().toLowerCase()}/${name.trim().toLowerCase()}`, "utf8"))
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  return formatUuid(digest);
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
const vercelDeployment = readJson(VERCEL_DEPLOYMENT_PATH);
const vercelDeploymentSchema = readJson(VERCEL_DEPLOYMENT_SCHEMA_PATH);

if (vercelDeployment && vercelDeploymentSchema) {
  validateWithSchema(vercelDeployment, vercelDeploymentSchema, "$vercelDeployment", vercelDeploymentSchema);

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
  record(isDeepStrictEqual(vercelDeployment.artifact, EXPECTED_VERCEL_ARTIFACT), "Vercel receipt source commit, digest, or digest scope differs from the deployed artifact");
  record(isDeepStrictEqual(vercelDeployment.deployment, EXPECTED_VERCEL_DEPLOYMENT), "Vercel receipt project, deployment, URLs, state, source, or timestamps differ from provider readback");
  const remoteArtifacts = vercelDeployment.remoteArtifacts ?? {};
  record(remoteArtifacts.deploymentId === vercelDeployment.deployment?.deploymentId, "Vercel remote artifacts differ from the deployment ID");
  record(remoteArtifacts.baseUrl === vercelDeployment.deployment?.uniqueUrl, "Vercel remote artifacts must use the unique deployment URL");
  const remoteArtifactRows = Array.isArray(remoteArtifacts.artifacts) ? remoteArtifacts.artifacts : [];
  record(
    isDeepStrictEqual(
      remoteArtifactRows.map(({ name, requestPath, localPath }) => ({ name, requestPath, localPath })),
      EXPECTED_REMOTE_ARTIFACTS,
    ),
    "Vercel remote artifact names, request paths, local paths, or order differ from the fixed contract",
  );
  for (const remoteArtifact of remoteArtifactRows) {
    record(remoteArtifact.statusCode === 200, `Vercel remote artifact ${remoteArtifact.requestPath} is not HTTP 200`);
    const localPath = safeArtifactPath(remoteArtifact.localPath);
    record(existsSync(localPath), `Vercel remote artifact local file does not exist: ${remoteArtifact.localPath}`);
    if (existsSync(localPath)) {
      const localSha256 = createHash("sha256").update(readFileSync(localPath)).digest("hex");
      record(remoteArtifact.sha256 === localSha256, `Vercel remote artifact hash differs from ${remoteArtifact.localPath}`);
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
  record(isDeepStrictEqual(vercelDeployment.anonymousHttp, EXPECTED_VERCEL_HTTP), "Vercel receipt anonymous HTTP, browser request, or service-worker evidence differs from readback");
  record(isDeepStrictEqual(vercelDeployment.browserFlow, EXPECTED_VERCEL_BROWSER_FLOW), "Vercel receipt browser flow differs from the verified retry sequence and counters");
  record(vercelDeployment.browserFlow?.testedUrl === vercelDeployment.deployment?.uniqueUrl, "Vercel browser flow was not tested on the unique deployment URL");
  record(vercelDeployment.browserFlow?.deploymentId === vercelDeployment.deployment?.deploymentId, "Vercel browser flow deployment ID differs from provider readback");
  record(isDeepStrictEqual(vercelDeployment.postDeployObservability, EXPECTED_VERCEL_OBSERVABILITY), "Vercel receipt bounded post-deploy error scan differs from provider readback");
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
  record(deployment.readyAtUnixMs >= deployment.createdAtUnixMs, "Vercel receipt READY time precedes creation time");

  const observability = vercelDeployment.postDeployObservability ?? {};
  record(
    Date.parse(observability.windowEnd) - Date.parse(observability.windowStart) === 60 * 60 * 1000,
    "Vercel receipt post-deploy observation window is not exactly one hour",
  );
  record(
    observability.windowEnd === observability.queryExecutedAt,
    "Vercel one-hour lookback must end when the query was executed",
  );
  record(
    Date.parse(observability.queryExecutedAt) >= Date.parse(deployment.readyAt),
    "Vercel one-hour lookback query was executed before deployment READY",
  );

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
      record(
        source.sourceId === stableUuidV5("evidence-source", canonicalName),
        `Vercel receipt ${source.kind} sourceId is not the stable UUIDv5`,
      );
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

if (registry && schema) {
  validateWithSchema(registry, schema, "$", schema);

  record(
    isDeepStrictEqual(
      Object.fromEntries(Object.keys(AXES).map((axis) => [axis, schema.$defs?.service?.properties?.[axis]?.enum])),
      AXES,
    ),
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
      record(
        service.publicationState === "BASELINE_ONLY",
        `${service.serviceId}: baseline runtime evidence requires baseline publication evidence`,
      );
    }

    const installation = service.installationEvidence ?? {};
    record(
      installation.taskCallable === (service.pluginState === "ACTIVE"),
      `${service.serviceId}: ACTIVE must match taskCallable`,
    );
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

    const currentArtifactClaim =
      service.publicationState === "CURRENT_ARTIFACT" || service.runtimeState === "CURRENT_ARTIFACT_VERIFIED";
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
      record(allowed.some((pattern) => pattern.test(source)), `${service.serviceId}: source is outside its official HTTPS allowlist`);
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
  record(
    vercel?.artifactCommit === vercelDeployment?.artifact?.sourceCommit,
    "vercel: artifactCommit differs from the Vercel hotel deployment receipt",
  );
  record(
    vercel?.artifactSha256 === vercelDeployment?.artifact?.functionalDigest,
    "vercel: artifactSha256 differs from the Vercel hotel deployment receipt",
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
  console.log(
    `service integration registry: PASS (8 services; registry and Vercel receipt schemas, identities, states, approval gates, deployment and browser evidence, sources, artifacts, summary; ${copyState})`,
  );
}

#!/usr/bin/env node
// information_uuid_v5=5467fd93-e0f2-59b0-bd0d-ede0efdd2aca
// event_uuid_v7=01a04a91-7583-7c2e-bb0e-614ddf2df43d
// state_transition=INTEGRATION_CATALOGUED -> INTEGRATION_CONTRACT_VERIFIED occurred_at=2026-08-28T22:50:41.000Z
// machine-contract: validation fails when a resource service is omitted, a status is overstated, an illustrative-not-observed duplicate scenario is missing, an identity is ambiguous, a hosting configuration diverges, a UI card disagrees, the public registry differs, or secret-shaped material enters the registry.

import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(repositoryRoot, "schemas/service-integration-registry.schema.json");
const registryPath = resolve(repositoryRoot, "metadata/service-integration-registry.json");
const publicRegistryPath = resolve(repositoryRoot, "dist/service-integrations.json");

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EXPECTED_STATES = Object.freeze({
  openai: "INCONCLUSIVE",
  cloudflare: "CONFIGURED",
  vercel: "CONFIGURED",
  shopify: "BOUNDARY_ONLY",
  "google-chrome": "INCONCLUSIVE",
  render: "CONFIGURED",
  netlify: "CONFIGURED",
  devpost: "RESOURCE_CONFIRMED",
});
const EXPECTED_STATUS_COUNTS = Object.freeze({
  VERIFIED: 0,
  CONFIGURED: 4,
  INCONCLUSIVE: 2,
  BOUNDARY_ONLY: 1,
  RESOURCE_CONFIRMED: 1,
});
const EXPECTED_OUTPUT_FILES = Object.freeze([
  "_headers",
  "app.js",
  "browser-store.js",
  "favicon.svg",
  "index.html",
  "input-projection.js",
  "service-integrations.json",
  "service-worker.js",
  "styles.css",
  "webmcp-adapter.js",
  "webmcp-evals.json",
]);
const REQUIRED_SECURITY_HEADERS = Object.freeze([
  "Content-Security-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
]);
const REQUIRED_SERVICE_WORKER_HEADERS = Object.freeze([
  "Cache-Control",
  "Service-Worker-Allowed",
]);
const REQUIRED_PRIMARY_SOURCES = Object.freeze({
  openai: [
    "https://webmcp.devpost.com/resources",
    "https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app",
    "https://learn.chatgpt.com/docs/sites",
  ],
  cloudflare: [
    "https://webmcp.devpost.com/resources",
    "https://developers.cloudflare.com/workers/static-assets/get-started/",
    "https://developers.cloudflare.com/browser-run/features/webmcp/",
  ],
  vercel: [
    "https://webmcp.devpost.com/resources",
    "https://vercel.com/docs/deployments/overview",
  ],
  shopify: [
    "https://webmcp.devpost.com/resources",
    "https://shopify.dev/docs/api/web-mcp",
  ],
  "google-chrome": [
    "https://webmcp.devpost.com/resources",
    "https://developer.chrome.com/docs/ai/webmcp",
  ],
  render: [
    "https://webmcp.devpost.com/resources",
    "https://render.com/docs/static-sites",
    "https://render.com/docs/workflows",
  ],
  netlify: [
    "https://webmcp.devpost.com/resources",
    "https://docs.netlify.com/build/configure-builds/file-based-configuration/",
    "https://docs.netlify.com/manage/forms/setup/",
  ],
  devpost: [
    "https://webmcp.devpost.com/resources",
  ],
});
const ALLOWED_SOURCE_HOSTS = Object.freeze({
  openai: new Set(["webmcp.devpost.com", "help.openai.com", "learn.chatgpt.com"]),
  cloudflare: new Set(["webmcp.devpost.com", "developers.cloudflare.com"]),
  vercel: new Set(["webmcp.devpost.com", "vercel.com"]),
  shopify: new Set(["webmcp.devpost.com", "shopify.dev"]),
  "google-chrome": new Set(["webmcp.devpost.com", "developer.chrome.com"]),
  render: new Set(["webmcp.devpost.com", "render.com"]),
  netlify: new Set(["webmcp.devpost.com", "docs.netlify.com"]),
  devpost: new Set(["webmcp.devpost.com"]),
});

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function printablePath(path) {
  return path || "$";
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equalJson(left, right) {
  try {
    assert.deepEqual(left, right);
    return true;
  } catch {
    return false;
  }
}

function uuidV7EpochMs(value) {
  return Number.parseInt(value.replaceAll("-", "").slice(0, 12), 16);
}

function resolveLocalReference(rootSchema, reference) {
  assert.match(reference, /^#\//, `only local schema references are supported: ${reference}`);
  return reference.slice(2).split("/").reduce((value, token) => {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    assert(isPlainObject(value) && Object.hasOwn(value, key), `unresolved schema reference: ${reference}`);
    return value[key];
  }, rootSchema);
}

function validateWithSchema(value, definition, rootSchema, path = "$") {
  if (definition === true) return;
  assert.notEqual(definition, false, `${printablePath(path)} is prohibited by the schema`);

  if (definition.$ref) {
    validateWithSchema(value, resolveLocalReference(rootSchema, definition.$ref), rootSchema, path);
  }
  for (const member of definition.allOf ?? []) {
    validateWithSchema(value, member, rootSchema, path);
  }

  if (Object.hasOwn(definition, "const")) {
    assert(equalJson(value, definition.const), `${printablePath(path)} must equal its schema constant`);
  }
  if (definition.enum) {
    assert(definition.enum.some((candidate) => equalJson(value, candidate)), `${printablePath(path)} is outside its schema enumeration`);
  }

  if (definition.type === "object") assert(isPlainObject(value), `${printablePath(path)} must be an object`);
  if (definition.type === "array") assert(Array.isArray(value), `${printablePath(path)} must be an array`);
  if (definition.type === "string") assert.equal(typeof value, "string", `${printablePath(path)} must be a string`);
  if (definition.type === "integer") assert(Number.isSafeInteger(value), `${printablePath(path)} must be a safe integer`);
  if (definition.type === "boolean") assert.equal(typeof value, "boolean", `${printablePath(path)} must be a boolean`);

  if (typeof value === "string") {
    if (definition.minLength !== undefined) assert(value.length >= definition.minLength, `${printablePath(path)} is too short`);
    if (definition.maxLength !== undefined) assert(value.length <= definition.maxLength, `${printablePath(path)} is too long`);
    if (definition.pattern) assert.match(value, new RegExp(definition.pattern), `${printablePath(path)} does not match its schema pattern`);
    if (definition.format === "date-time") {
      assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, `${printablePath(path)} must be a UTC date-time`);
      assert(Number.isFinite(Date.parse(value)), `${printablePath(path)} must be a valid date-time`);
    }
    if (definition.format === "uri") {
      const parsed = new URL(value);
      assert(parsed.protocol && parsed.hostname, `${printablePath(path)} must be an absolute URI`);
    }
  }

  if (Array.isArray(value)) {
    if (definition.minItems !== undefined) assert(value.length >= definition.minItems, `${printablePath(path)} has too few items`);
    if (definition.maxItems !== undefined) assert(value.length <= definition.maxItems, `${printablePath(path)} has too many items`);
    if (definition.uniqueItems) {
      const serialized = value.map((member) => JSON.stringify(member));
      assert.equal(new Set(serialized).size, serialized.length, `${printablePath(path)} must contain unique items`);
    }
    const prefixLength = definition.prefixItems?.length ?? 0;
    for (let index = 0; index < prefixLength && index < value.length; index += 1) {
      validateWithSchema(value[index], definition.prefixItems[index], rootSchema, `${path}[${index}]`);
    }
    if (definition.items === false) {
      assert(value.length <= prefixLength, `${printablePath(path)} contains an item beyond prefixItems`);
    } else if (definition.items) {
      const start = prefixLength > 0 ? prefixLength : 0;
      for (let index = start; index < value.length; index += 1) {
        validateWithSchema(value[index], definition.items, rootSchema, `${path}[${index}]`);
      }
    }
  }

  if (isPlainObject(value)) {
    for (const key of definition.required ?? []) {
      assert(Object.hasOwn(value, key), `${printablePath(path)} is missing required property ${key}`);
    }
    for (const [key, propertySchema] of Object.entries(definition.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateWithSchema(value[key], propertySchema, rootSchema, `${path}.${key}`);
    }
    if (definition.additionalProperties === false) {
      const declared = new Set(Object.keys(definition.properties ?? {}));
      const unknown = Object.keys(value).filter((key) => !declared.has(key));
      assert.deepEqual(unknown, [], `${printablePath(path)} has undeclared properties: ${unknown.join(", ")}`);
    }
  }
}

function stripJsonComments(text) {
  let result = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        result += character;
      }
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      } else if (character === "\n") {
        result += character;
      }
      continue;
    }
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
    } else if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
    } else if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
    } else {
      result += character;
    }
  }
  assert(!inString && !blockComment, "wrangler.jsonc contains an unterminated string or comment");
  return result;
}

function readAttribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escapedName}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2];
}

function normalizeTextContent(fragment) {
  return fragment
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function readClassText(card, className) {
  const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`<([a-z][a-z0-9-]*)\\b[^>]*\\bclass\\s*=\\s*(["'])[^"']*\\b${escapedClass}\\b[^"']*\\2[^>]*>([\\s\\S]*?)<\\/\\1>`, "i");
  const match = card.match(expression);
  return match ? normalizeTextContent(match[3]) : undefined;
}

function assertNoSecretShapedMaterial(value) {
  const serialized = JSON.stringify(value);
  const forbiddenValuePatterns = [
    new RegExp("-----BEGIN [A-Z ]*" + "PRIVATE" + "\\x20KEY-----"),
    /\bBearer\s+[A-Za-z0-9._~-]{16,}/i,
    /\bsk-[A-Za-z0-9_-]{16,}\b/,
    /\bghp_[A-Za-z0-9]{20,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/,
    /\bAKIA[A-Z0-9]{16}\b/,
  ];
  for (const pattern of forbiddenValuePatterns) {
    assert.doesNotMatch(serialized, pattern, `registry contains secret-shaped material matching ${pattern}`);
  }

  function visit(member, path) {
    if (Array.isArray(member)) {
      member.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (!isPlainObject(member)) return;
    for (const [key, child] of Object.entries(member)) {
      if (/(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|private[_-]?key|credential)/i.test(key)) {
        assert(child === null || child === "" || child === false, `${path}.${key} must not contain a credential-like value`);
      }
      visit(child, `${path}.${key}`);
    }
  }
  visit(value, "$");
}

async function assertArtifactExists(relativePath) {
  assert(!relativePath.startsWith("/"), `artifact path must be relative: ${relativePath}`);
  assert(!relativePath.split("/").includes(".."), `artifact path must not traverse upward: ${relativePath}`);
  const fullPath = resolve(repositoryRoot, relativePath);
  assert(fullPath.startsWith(`${repositoryRoot}${sep}`), `artifact escapes repository root: ${relativePath}`);
  const details = await stat(fullPath);
  assert(details.isFile() && details.size > 0, `artifact must be a non-empty file: ${relativePath}`);
}

const [schema, registry, publicRegistry, outputFiles] = await Promise.all([
  readJson(schemaPath),
  readJson(registryPath),
  readJson(publicRegistryPath),
  readdir(resolve(repositoryRoot, "dist")),
]);

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.additionalProperties, false);
assert.match(schema.$comment, /information_uuid_v5=78f60de4-89ae-56bc-8e72-8ab99654c911/);
assert.match(schema.$comment, /event_uuid_v7=01a04a91-750b-7fc7-9708-974b0c4f0c17/);
assert.equal(schema.properties.services.minItems, 8);
assert.equal(schema.properties.services.maxItems, 8);
assert.equal(schema.properties.services.prefixItems.length, 8);
assert.equal(schema.properties.services.items, false);
validateWithSchema(registry, schema, schema);

assert.deepEqual(publicRegistry, registry, "dist/service-integrations.json must exactly match the source registry");
assert.deepEqual(outputFiles.sort(), [...EXPECTED_OUTPUT_FILES], "dist must contain exactly the eleven allowlisted public files");
assert.deepEqual(registry.commonArtifact, {
  buildCommand: "npm run build:web",
  outputDirectory: "dist",
  sameOriginApiRequired: false,
  dynamicBackendIncluded: false,
  offlineAfterFirstVisit: true,
  toolName: "notify_once",
});
assert.equal(Date.parse(registry.temporal.observedAt), registry.temporal.epochMs);
assert.deepEqual(registry.localVerification, {
  identity: {
    informationUuidV5: "f7bf74af-23e0-5f55-aed0-b47702251250",
    eventUuidV7: "01a04aa6-0a41-749e-b9d0-dd06d3e9c665",
  },
  observedAt: "2026-08-28T23:13:10.721Z",
  stateTransition: "INTEGRATION_CATALOGUED -> LOCAL_DUPLICATE_CHECK_VERIFIED",
  environment: "Codex in-app browser at http://127.0.0.1:4178",
  toolName: "notify_once",
  toolCalls: 2,
  logicalOperationId: "browser-double-send-001",
  intentId: "25a2b087-84df-545f-b744-b177d12dab05",
  payloadDigest: "5a9e2240c5ecadd41476b3d130000f3badedb20a2b5150363db3b3a63b0e5fd6",
  sameIntent: true,
  controlState: "DRY_RUN",
  effectState: "NOT_STARTED",
  effectStartCount: 0,
  approvalButtonClicks: 0,
  serviceCardCount: 8,
  viewportWidth: 320,
  horizontalOverflow: false,
  browserWarningErrorCount: 0,
  pageModelContext: "ABSENT",
  nativeWebMcpConformance: "INCONCLUSIVE",
  unexpectedApiStatus: 404,
});
assert.match(registry.localVerification.identity.informationUuidV5, UUID_V5);
assert.match(registry.localVerification.identity.eventUuidV7, UUID_V7);
assert.equal(uuidV7EpochMs(registry.localVerification.identity.eventUuidV7), Date.parse(registry.localVerification.observedAt));

const servicesById = Object.fromEntries(registry.services.map((service) => [service.serviceId, service]));
assert.equal(Object.keys(servicesById).length, 8, "service identifiers must be unique");
assert.deepEqual(Object.fromEntries(registry.services.map((service) => [service.serviceId, service.status])), EXPECTED_STATES);

const actualStatusCounts = Object.fromEntries(Object.keys(EXPECTED_STATUS_COUNTS).map((status) => [
  status,
  registry.services.filter((service) => service.status === status).length,
]));
assert.deepEqual(actualStatusCounts, EXPECTED_STATUS_COUNTS);
assert.deepEqual(registry.summary.statusCounts, EXPECTED_STATUS_COUNTS);
assert.equal(registry.summary.totalServices, registry.services.length);

const identities = [
  registry.identity.informationUuidV5,
  registry.identity.eventUuidV7,
  registry.localVerification.identity.informationUuidV5,
  registry.localVerification.identity.eventUuidV7,
];
for (const service of registry.services) {
  assert.match(service.identity.informationUuidV5, UUID_V5, `${service.serviceId} information identity must be UUIDv5`);
  assert.match(service.identity.eventUuidV7, UUID_V7, `${service.serviceId} event identity must be UUIDv7`);
  assert.equal(service.scenarioStatus, "ILLUSTRATIVE_NOT_OBSERVED", `${service.serviceId} scenario must remain explicitly illustrative`);
  assert.equal(service.duplicateRisk, service.duplicateRisk.trim(), `${service.serviceId} duplicate risk must be trimmed`);
  assert.equal(service.preventedOutcome, service.preventedOutcome.trim(), `${service.serviceId} prevented outcome must be trimmed`);
  assert(service.duplicateRisk.startsWith("Illustrative, not observed:"), `${service.serviceId} duplicate risk must reject an observed-incident claim`);
  assert(service.duplicateRisk.length > "Illustrative, not observed:".length, `${service.serviceId} duplicate risk must describe a concrete retry accident`);
  assert(service.preventedOutcome.length > 0, `${service.serviceId} prevented outcome must describe a real-life harm reduction`);
  identities.push(service.identity.informationUuidV5, service.identity.eventUuidV7);

  const requiredSources = REQUIRED_PRIMARY_SOURCES[service.serviceId];
  assert.deepEqual(service.sources, requiredSources, `${service.serviceId} must use the reviewed primary-source set`);
  for (const source of service.sources) {
    const parsed = new URL(source);
    assert.equal(parsed.protocol, "https:", `${service.serviceId} source must use HTTPS`);
    assert.equal(parsed.username, "", `${service.serviceId} source must not contain credentials`);
    assert.equal(parsed.password, "", `${service.serviceId} source must not contain credentials`);
    assert(ALLOWED_SOURCE_HOSTS[service.serviceId].has(parsed.hostname), `${service.serviceId} source host is not allowlisted: ${parsed.hostname}`);
  }
  for (const artifact of service.artifacts) await assertArtifactExists(artifact);
  for (const evidence of service.evidence) {
    assert(Number.isFinite(Date.parse(evidence.observedAt)), `${service.serviceId} evidence time must be valid`);
    if (evidence.url) assert.equal(new URL(evidence.url).protocol, "https:");
    if (evidence.artifact) await assertArtifactExists(evidence.artifact);
  }
}
assert.equal(new Set(identities).size, identities.length, "all registry identities must be unique");
assert.match(registry.identity.informationUuidV5, UUID_V5);
assert.match(registry.identity.eventUuidV7, UUID_V7);

const servicesWithLiveUrl = registry.services.filter((service) => Object.hasOwn(service, "liveUrl"));
const servicesWithDeploymentId = registry.services.filter((service) => Object.hasOwn(service, "deploymentId"));
assert.deepEqual(servicesWithLiveUrl.map((service) => service.serviceId), ["vercel"], "only Vercel may claim a live URL");
assert.deepEqual(servicesWithDeploymentId.map((service) => service.serviceId), ["vercel"], "only Vercel may claim a deployment ID");
assert.equal(servicesById.vercel.liveUrl, "https://verifiable-offline-webmcp-agent-spe.vercel.app");
assert.equal(servicesById.vercel.deploymentId, "dpl_3KTHTtZ5h8quDhviMTRo5GxBuUuE");
assert(registry.services.every((service) => service.approvalRequired), "every pending external action must retain an approval boundary");
assert(servicesById.vercel.evidence.some((item) => item.kind === "DEPLOYMENT" && item.url === servicesById.vercel.liveUrl), "Vercel baseline requires deployment evidence");
assert(servicesById.vercel.evidence.some((item) => item.statement.includes("current registry-bearing build") && item.statement.includes("not been redeployed")), "Vercel CONFIGURED state must distinguish the live baseline from the pending build");
assert(servicesById.shopify.evidence.every((item) => item.kind === "BOUNDARY"), "Shopify must remain boundary-only");
assert(servicesById["google-chrome"].evidence.some((item) => item.statement.includes("document.modelContext")), "Chrome INCONCLUSIVE state needs the runtime observation");

assertNoSecretShapedMaterial(registry);

const [vercelConfig, wranglerText, renderText, netlifyText, portableHeaders, publicHeaders, html] = await Promise.all([
  readJson(resolve(repositoryRoot, "vercel.json")),
  readFile(resolve(repositoryRoot, "wrangler.jsonc"), "utf8"),
  readFile(resolve(repositoryRoot, "render.yaml"), "utf8"),
  readFile(resolve(repositoryRoot, "netlify.toml"), "utf8"),
  readFile(resolve(repositoryRoot, "examples/vercel-notification-demo/_headers"), "utf8"),
  readFile(resolve(repositoryRoot, "dist/_headers"), "utf8"),
  readFile(resolve(repositoryRoot, "examples/vercel-notification-demo/index.html"), "utf8"),
]);
const wranglerConfig = JSON.parse(stripJsonComments(wranglerText));

assert.equal(vercelConfig.buildCommand, registry.commonArtifact.buildCommand);
assert.equal(vercelConfig.outputDirectory, registry.commonArtifact.outputDirectory);
assert.equal(Object.hasOwn(vercelConfig, "rewrites"), false, "Vercel must not rewrite unknown paths to the page");
assert.equal(Object.hasOwn(vercelConfig, "redirects"), false, "Vercel must not add an unreviewed redirect lane");
const vercelGlobalHeaders = new Set(vercelConfig.headers
  .filter((entry) => entry.source === "/(.*)")
  .flatMap((entry) => entry.headers.map((header) => header.key)));
for (const header of REQUIRED_SECURITY_HEADERS) {
  assert(vercelGlobalHeaders.has(header), `Vercel must configure ${header}`);
}
const vercelServiceWorkerHeaders = new Set(vercelConfig.headers
  .filter((entry) => entry.source === "/service-worker.js")
  .flatMap((entry) => entry.headers.map((header) => header.key)));
for (const header of REQUIRED_SERVICE_WORKER_HEADERS) {
  assert(vercelServiceWorkerHeaders.has(header), `Vercel service worker must configure ${header}`);
}
assert(isPlainObject(wranglerConfig.assets), "wrangler.jsonc must define an assets object");
assert(["dist", "./dist"].includes(wranglerConfig.assets.directory), "Cloudflare assets.directory must point to dist");
assert.equal(Object.hasOwn(wranglerConfig, "main"), false, "the assets-only Cloudflare configuration must not claim a dynamic Worker");
assert.equal(wranglerConfig.assets.not_found_handling, "404-page", "Cloudflare must preserve missing-path failures");
assert.equal(publicHeaders, portableHeaders, "dist/_headers must exactly match the reviewed portable header source");
for (const header of REQUIRED_SECURITY_HEADERS) {
  assert(portableHeaders.includes(`${header}:`), `portable _headers must configure ${header}`);
  assert.match(renderText, new RegExp(`^\\s*name:\\s*${header}\\s*$`, "m"), `render.yaml must configure ${header}`);
  assert.match(netlifyText, new RegExp(`^${header.replaceAll("-", "\\-")}\\s*=`, "m"), `netlify.toml must configure ${header}`);
}
for (const header of REQUIRED_SERVICE_WORKER_HEADERS) {
  assert(portableHeaders.includes(`${header}:`), `portable service-worker headers must configure ${header}`);
  assert.match(renderText, new RegExp(`^\\s*name:\\s*${header}\\s*$`, "m"), `render.yaml service worker must configure ${header}`);
  assert.match(netlifyText, new RegExp(`^${header.replaceAll("-", "\\-")}\\s*=`, "m"), `netlify.toml service worker must configure ${header}`);
}
assert.match(renderText, /^\s*-\s+type:\s*web\s*$/m, "render.yaml must define a web service");
assert.match(renderText, /^\s*runtime:\s*static\s*$/m, "render.yaml must define a static runtime");
assert.match(renderText, /^\s*buildCommand:\s*["']?npm run build:web["']?\s*$/m, "render.yaml build command must match the registry");
assert.match(renderText, /^\s*staticPublishPath:\s*["']?(?:\.\/)?dist["']?\s*$/m, "render.yaml publish path must point to dist");
assert.doesNotMatch(renderText, /^\s*(?:routes|redirects|rewrites):/m, "Render must not hide missing paths behind a page rewrite");
assert.match(netlifyText, /^\s*\[build\]\s*$/m, "netlify.toml must define the build table");
assert.match(netlifyText, /^\s*command\s*=\s*["']npm run build:web["']\s*$/m, "netlify.toml build command must match the registry");
assert.match(netlifyText, /^\s*publish\s*=\s*["'](?:\.\/)?dist["']\s*$/m, "netlify.toml publish path must point to dist");
assert.doesNotMatch(netlifyText, /^\s*\[\[redirects\]\]\s*$/m, "Netlify must not hide missing paths behind a page rewrite");

const serviceCards = [...html.matchAll(/<article\b[^>]*\bdata-service-id\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/article>/gi)].map((match) => match[0]);
assert.equal(serviceCards.length, 8, "the public page must contain exactly eight service cards");
for (const [serviceId, expectedState] of Object.entries(EXPECTED_STATES)) {
  const matchingCards = serviceCards.filter((card) => readAttribute(card, "data-service-id") === serviceId);
  assert.equal(matchingCards.length, 1, `the public page must contain one ${serviceId} card`);
  const card = matchingCards[0];
  const service = servicesById[serviceId];
  assert.equal(readAttribute(card, "data-integration-state"), expectedState, `${serviceId} UI state must match the registry`);
  assert.equal(readAttribute(card, "data-scenario-status"), service.scenarioStatus, `${serviceId} UI scenario state must remain illustrative and not observed`);
  assert.equal(readClassText(card, "duplicate-risk"), service.duplicateRisk, `${serviceId} UI duplicate-risk summary must match the registry`);
  assert.equal(readClassText(card, "prevented-outcome"), service.preventedOutcome, `${serviceId} UI prevented-outcome summary must match the registry`);
}
const localVerificationTag = html.match(/<p\b[^>]*\bdata-local-verification\s*=\s*["']VERIFIED["'][^>]*>/i)?.[0];
assert(localVerificationTag, "the public page must expose the bounded local duplicate check");
assert.equal(readAttribute(localVerificationTag, "data-verification-event-id"), registry.localVerification.identity.eventUuidV7);
assert.equal(Number(readAttribute(localVerificationTag, "data-tool-calls")), registry.localVerification.toolCalls);
assert.equal(Number(readAttribute(localVerificationTag, "data-effect-start-count")), registry.localVerification.effectStartCount);

console.log("Service integration registry verified: 8 official resource services");
console.log("States: VERIFIED=0 CONFIGURED=4 INCONCLUSIVE=2 BOUNDARY_ONLY=1 RESOURCE_CONFIRMED=1");
console.log("Bounded local duplicate check: 2 tool calls -> 1 UUIDv5 intent -> 0 effect starts");
console.log("Public registry, hosting configurations, UI cards, illustrative duplicate scenarios, identities, sources, limits, and approval boundaries agree");

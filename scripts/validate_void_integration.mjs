#!/usr/bin/env node
// information_uuid_v5=a12ea2ae-bbd8-5954-8a36-9a699a3495c6
// event_uuid_v7=01a04c7f-4093-79a8-8ce7-7ee17670f4a7 state_transition=VOID_PACKAGE_PINNED -> PREBUILT_STATIC_ADAPTER_VALIDATED occurred_at=2026-08-29T07:50:03.000Z
// machine-contract: BUILD_CONFIGURED -> STATIC_ARTIFACT_READY -> AUTH_REQUIRED -> PROJECT_LINK_REQUIRED -> DEPLOY_REQUIRES_SEPARATE_ACTION
// machine-contract: this validator may execute only `void --version`; it never authenticates, links a project, or deploys.
// event_uuid_v7=01a04c82-7268-7de3-b005-ca9c6de8d65d state_transition=VOID_TRANSITIVE_PEER_CONFLICT -> VOID_COMPATIBILITY_SET_PINNED occurred_at=2026-08-29T07:53:32.520Z
// machine-contract: Void 0.10.12 must retain the Cloudflare plugin and Wrangler versions whose workers-types ranges intersect; force and legacy-peer bypasses are forbidden.

import { constants, accessSync, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_VERSION = "0.10.12";
const EXPECTED_VOID_CLOUDFLARE_PLUGIN_VERSION = "1.43.0";
const EXPECTED_VOID_WRANGLER_VERSION = "4.107.0";
const EXPECTED_VOID_WORKERS_TYPES_VERSION = "4.20260702.1";
const EXPECTED_SCHEMA_REF = "./node_modules/void/schema.json";
const EXPECTED_OUTPUT_DIR = "dist/client";
const EXPECTED_BUILD_COMMAND = "npm run build:web";
const EXPECTED_COMPATIBILITY_DATE = "2026-05-22";
const EXPECTED_INFORMATION_UUID_V5 = "22fa5437-e104-5ea2-acfe-fe57cc2553f2";
const EXPECTED_UUID_NAMESPACE = "47f3e535-0e27-559a-9556-aa79a84f95eb";
const EXPECTED_BINDINGS = ["ai", "db", "kv", "storage"];
const EXPECTED_PACKAGE_SCRIPTS = {
  "mcp:void": "void mcp",
  "validate:void": "node scripts/validate_void_integration.mjs",
  "build:void:static": "npm run build:web && npm run validate:void",
  "deploy:void:static": "npm run build:void:static && void deploy --dir dist/client",
};
const SAFE_SCRIPT_PATTERN = /^node scripts\/[a-z0-9_-]+\.mjs$/u;
const SECRET_KEY_PATTERN = /(?:^|[_-])(api[_-]?key|credential|password|private[_-]?key|secret|token)(?:$|[_-])/iu;
const SECRET_VALUE_PATTERNS = [
  new RegExp(["-{5}BEGIN [A-Z ]*", "PRIVATE", " KEY-{5}"].join(""), "u"),
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/u,
  /(?:password|secret|token)\s*[:=]\s*[^\s]+/iu,
  /https?:\/\/[^/@:\s]+:[^/@\s]+@/iu,
];

let checks = 0;

function record(condition, message) {
  if (!condition) {
    throw new Error(`VOID_INTEGRATION_VALIDATION_FAIL: ${message}`);
  }
  checks += 1;
}

function readJson(path, label) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`VOID_INTEGRATION_VALIDATION_FAIL: ${label} is not valid JSON: ${error.message}`, { cause: error });
  }
  record(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be a JSON object`);
  return value;
}

function jsonTypeMatches(value, expectedType) {
  switch (expectedType) {
    case "array":
      return Array.isArray(value);
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "null":
      return value === null;
    default:
      return typeof value === expectedType;
  }
}

function schemaErrors(value, schema, pointer = "$") {
  const errors = [];

  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((branch) => schemaErrors(value, branch, pointer).length === 0).length;
    if (matches !== 1) {
      errors.push(`${pointer} must match exactly one oneOf branch; matched ${matches}`);
      return errors;
    }
  }

  if (schema.type !== undefined) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowedTypes.some((type) => jsonTypeMatches(value, type))) {
      errors.push(`${pointer} must have type ${allowedTypes.join(" or ")}`);
      return errors;
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => isDeepStrictEqual(candidate, value))) {
    errors.push(`${pointer} must be one of ${schema.enum.map(String).join(", ")}`);
  }

  if (typeof value === "string" && typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) {
    errors.push(`${pointer} does not match ${schema.pattern}`);
  }

  if (typeof value === "number" && typeof schema.minimum === "number" && value < schema.minimum) {
    errors.push(`${pointer} must be at least ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push(`${pointer} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.uniqueItems === true) {
      for (let left = 0; left < value.length; left += 1) {
        for (let right = left + 1; right < value.length; right += 1) {
          if (isDeepStrictEqual(value[left], value[right])) {
            errors.push(`${pointer} contains duplicate items at ${left} and ${right}`);
          }
        }
      }
    }
    if (schema.items && typeof schema.items === "object") {
      value.forEach((item, index) => errors.push(...schemaErrors(item, schema.items, `${pointer}[${index}]`)));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    const patternProperties = Object.entries(schema.patternProperties ?? {}).map(([pattern, childSchema]) => [new RegExp(pattern, "u"), childSchema]);

    for (const requiredKey of schema.required ?? []) {
      if (!Object.hasOwn(value, requiredKey)) {
        errors.push(`${pointer}.${requiredKey} is required`);
      }
    }

    for (const [key, childValue] of Object.entries(value)) {
      let matched = false;
      if (Object.hasOwn(properties, key)) {
        matched = true;
        errors.push(...schemaErrors(childValue, properties[key], `${pointer}.${key}`));
      }
      for (const [pattern, childSchema] of patternProperties) {
        if (pattern.test(key)) {
          matched = true;
          errors.push(...schemaErrors(childValue, childSchema, `${pointer}.${key}`));
        }
      }
      if (!matched && schema.additionalProperties === false) {
        errors.push(`${pointer}.${key} is not allowed`);
      } else if (!matched && schema.additionalProperties && typeof schema.additionalProperties === "object") {
        errors.push(...schemaErrors(childValue, schema.additionalProperties, `${pointer}.${key}`));
      }
    }
  }

  return errors;
}

function isInside(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === "" || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== "..");
}

function findSecretMaterial(value, pointer = "$") {
  const findings = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...findSecretMaterial(item, `${pointer}[${index}]`)));
    return findings;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, childValue] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        findings.push(`${pointer}.${key}`);
      }
      findings.push(...findSecretMaterial(childValue, `${pointer}.${key}`));
    }
    return findings;
  }
  if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    findings.push(pointer);
  }
  return findings;
}

const configPath = resolve(ROOT, "void.json");
const packagePath = resolve(ROOT, "package.json");
const lockPath = resolve(ROOT, "package-lock.json");
const gitignorePath = resolve(ROOT, ".gitignore");
const viteConfigPath = resolve(ROOT, "vite.config.js");
const evidencePath = resolve(ROOT, "metadata/void-integration.json");
const evidenceSchemaPath = resolve(ROOT, "schemas/void-integration.schema.json");

const config = readJson(configPath, "void.json");
const packageJson = readJson(packagePath, "package.json");
const packageLock = readJson(lockPath, "package-lock.json");
const evidence = readJson(evidencePath, "Void integration evidence");
readJson(evidenceSchemaPath, "Void integration evidence schema");

record(config.$schema === EXPECTED_SCHEMA_REF, `void.json must reference ${EXPECTED_SCHEMA_REF}`);
const schemaPath = resolve(ROOT, config.$schema);
record(schemaPath === resolve(ROOT, EXPECTED_SCHEMA_REF), "Void JSON Schema must resolve to the installed package copy");
record(existsSync(schemaPath), "the Void package JSON Schema is missing");
const schema = readJson(schemaPath, "Void package JSON Schema");
record(schema.$schema === "http://json-schema.org/draft-07/schema#", "Void schema must declare JSON Schema draft 7");
const validationErrors = schemaErrors(config, schema);
record(validationErrors.length === 0, `void.json violates its package schema: ${validationErrors.join("; ")}`);

record(packageJson.devDependencies?.void === EXPECTED_VERSION, `package.json must pin void exactly to ${EXPECTED_VERSION}`);
record(packageLock.packages?.[""]?.devDependencies?.void === EXPECTED_VERSION, `package-lock.json root must pin void exactly to ${EXPECTED_VERSION}`);
record(packageLock.packages?.["node_modules/void"]?.version === EXPECTED_VERSION, `package-lock.json installed Void version must be ${EXPECTED_VERSION}`);
record(
  isDeepStrictEqual(packageJson.overrides?.[`void@${EXPECTED_VERSION}`], {
    "@cloudflare/vite-plugin": EXPECTED_VOID_CLOUDFLARE_PLUGIN_VERSION,
    wrangler: EXPECTED_VOID_WRANGLER_VERSION,
  }),
  "Void must pin the compatible Cloudflare plugin and Wrangler pair without force or legacy-peer bypasses",
);
record(
  packageLock.packages?.["node_modules/void/node_modules/@cloudflare/vite-plugin"]?.version === EXPECTED_VOID_CLOUDFLARE_PLUGIN_VERSION,
  `Void must resolve @cloudflare/vite-plugin ${EXPECTED_VOID_CLOUDFLARE_PLUGIN_VERSION}`,
);
record(
  packageLock.packages?.["node_modules/void/node_modules/wrangler"]?.version === EXPECTED_VOID_WRANGLER_VERSION,
  `Void must resolve Wrangler ${EXPECTED_VOID_WRANGLER_VERSION}`,
);
record(
  packageLock.packages?.["node_modules/@cloudflare/workers-types"]?.version === EXPECTED_VOID_WORKERS_TYPES_VERSION,
  `Void must resolve workers-types ${EXPECTED_VOID_WORKERS_TYPES_VERSION}`,
);
const installedPackage = readJson(resolve(ROOT, "node_modules/void/package.json"), "installed Void package");
record(installedPackage.version === EXPECTED_VERSION, `installed Void package must be ${EXPECTED_VERSION}`);

record(config.target === "cloudflare", "Void target must remain cloudflare");
record(config.output === "static", "Void output must be static");
record(config.inference?.appType === "static", "Void app type must be static");
record(config.inference?.build === EXPECTED_BUILD_COMMAND, `Void build command must be ${EXPECTED_BUILD_COMMAND}`);
record(config.inference?.outputDir === EXPECTED_OUTPUT_DIR, `Void output directory must be ${EXPECTED_OUTPUT_DIR}`);
record(config.worker?.compatibility_date === EXPECTED_COMPATIBILITY_DATE, `Void compatibility date must match wrangler.jsonc (${EXPECTED_COMPATIBILITY_DATE})`);

const configuredBindings = Object.keys(config.inference?.bindings ?? {}).sort();
record(isDeepStrictEqual(configuredBindings, EXPECTED_BINDINGS), "all four Void binding switches must be explicit");
record(
  EXPECTED_BINDINGS.every((binding) => config.inference.bindings[binding] === false),
  "database, key-value, storage, and artificial-intelligence bindings must all be false",
);
record(config.remote !== true, "remote bindings must remain disabled");
record(config.auth === undefined, "Void authentication must not be configured");
record(config.database === undefined, "Void database must not be configured");
record(config.ai === undefined, "Void artificial-intelligence gateway must not be configured");
record(config.worker?.vars === undefined, "Void worker variables must not carry credentials or secrets");
record(findSecretMaterial(config).length === 0, "void.json must not contain credential or secret material");

record(evidence.$schema === "../schemas/void-integration.schema.json", "Void evidence must name its repository schema");
record(evidence.identity?.informationUuidV5 === EXPECTED_INFORMATION_UUID_V5, "Void evidence information UUIDv5 differs from its stable identity");
record(evidence.identity?.namespace === EXPECTED_UUID_NAMESPACE, "Void evidence UUID namespace differs from the repository namespace");
record(evidence.identity?.observationUuidV7 === evidence.stateTransition?.eventId, "Void evidence transition event differs from its observation event");
record(evidence.identity?.observedAt === evidence.stateTransition?.occurredAt, "Void evidence transition time differs from its observation time");
const uuidTimestampHex = evidence.identity.observationUuidV7.replaceAll("-", "").slice(0, 12);
record(new Date(Number(BigInt(`0x${uuidTimestampHex}`))).toISOString() === evidence.identity.observedAt, "Void evidence UUIDv7 time differs from observedAt");
record(evidence.component?.version === EXPECTED_VERSION, "Void evidence component version differs from the installed package");
record(
  evidence.component?.packageIntegrity === packageLock.packages?.["node_modules/void"]?.integrity,
  "Void evidence package integrity differs from package-lock.json",
);
record(evidence.installation?.state === "CONFIRMED", "Void evidence must record the verified local installation");
record(evidence.codexMcp?.state === "REGISTERED_ENABLED_RESTART_REQUIRED", "Void evidence must preserve the Codex restart boundary");
record(isDeepStrictEqual(evidence.codexMcp?.args, ["-y", `void@${EXPECTED_VERSION}`, "mcp"]), "Void evidence MCP arguments must pin the installed version");
record(evidence.staticAdapter?.state === "VALIDATED_NOT_DEPLOYED", "Void static adapter must remain explicitly not deployed");
record(evidence.staticAdapter?.artifactDirectory === EXPECTED_OUTPUT_DIR, "Void evidence output directory differs from void.json");
record(evidence.staticAdapter?.voidPluginInExistingViteGraph === false, "Void evidence cannot claim plugin insertion into the current Vite graph");
record(evidence.providerState?.authentication === "NOT_ATTEMPTED", "Void provider authentication must remain unclaimed");
record(evidence.providerState?.projectLink === "NOT_CONFIGURED", "Void provider project link must remain unclaimed");
record(evidence.providerState?.publication === "NOT_PUBLISHED", "Void provider publication must remain unclaimed");
record(evidence.providerState?.runtime === "NOT_RUN", "Void provider runtime execution must remain unclaimed");
record(evidence.providerState?.deploymentExecutionCount === 0, "Void deployment execution count must remain zero");
record(
  evidence.dependencyCompatibility?.cloudflareVitePlugin === EXPECTED_VOID_CLOUDFLARE_PLUGIN_VERSION,
  "Void evidence Cloudflare plugin version differs from the compatibility pin",
);
record(evidence.dependencyCompatibility?.wrangler === EXPECTED_VOID_WRANGLER_VERSION, "Void evidence Wrangler version differs from the compatibility pin");
record(
  evidence.dependencyCompatibility?.workersTypes === EXPECTED_VOID_WORKERS_TYPES_VERSION,
  "Void evidence workers-types version differs from package-lock.json",
);
record(evidence.dependencyCompatibility?.forceInstallUsed === false, "Void evidence cannot allow force installation");
record(evidence.dependencyCompatibility?.legacyPeerDependenciesUsed === false, "Void evidence cannot allow legacy peer bypasses");
const audit = evidence.dependencyAudit ?? {};
record(audit.moderate + audit.high + audit.critical === audit.total, "Void recorded vulnerability counts do not sum to the total");
record(
  audit.status === "KNOWN_RISKS_REMAIN" && audit.automaticFixApplied === false,
  "Void dependency risks must remain explicit without an automatic breaking fix",
);
record(Array.isArray(evidence.sources) && evidence.sources.length === 4, "Void evidence must cite the four fixed primary sources");
record(
  evidence.sources.every((source) => source.url.startsWith("https://void.cloud/") || source.url === "https://registry.npmjs.org/void/0.10.12"),
  "Void evidence contains a non-primary source",
);
record(evidence.secretsIncluded === false, "Void evidence must not claim embedded secrets");

const buildScript = packageJson.scripts?.["build:web"];
record(typeof buildScript === "string" && SAFE_SCRIPT_PATTERN.test(buildScript), "build:web must be one direct local Node script");
record(!/[;&|`$<>\\\n\r]/u.test(buildScript), "build:web must not contain shell control or expansion characters");
for (const [scriptName, expectedCommand] of Object.entries(EXPECTED_PACKAGE_SCRIPTS)) {
  record(packageJson.scripts?.[scriptName] === expectedCommand, `${scriptName} must be exactly: ${expectedCommand}`);
}
const deployCommand = packageJson.scripts?.["deploy:void:static"] ?? "";
record(deployCommand.endsWith("void deploy --dir dist/client"), "Void deploy must use pre-built static directory mode");
record(
  !/(?:--project|--backend|--provision|--skip-build|--spa)\b/u.test(deployCommand),
  "Void deploy must not select a project, backend, provision bindings, skip the local build, or change routing mode",
);

const outputPath = resolve(ROOT, config.inference.outputDir);
const requiredOutputRoot = resolve(ROOT, EXPECTED_OUTPUT_DIR);
record(outputPath === requiredOutputRoot, "configured output must resolve exactly to dist/client");
record(isInside(ROOT, outputPath), "configured output must not escape the repository");
record(existsSync(outputPath) && statSync(outputPath).isDirectory(), "dist/client must exist; run npm run build:web first");
record(isInside(realpathSync(ROOT), realpathSync(outputPath)), "real dist/client path must remain inside the repository");
record(existsSync(resolve(outputPath, "index.html")), "dist/client/index.html must exist");

const gitignoreLines = readFileSync(gitignorePath, "utf8").split(/\r?\n/u);
record(gitignoreLines.includes(".void/"), ".gitignore must exclude .void/");
record(!gitignoreLines.includes("!.void/"), ".gitignore must not re-include .void/");

const viteConfig = readFileSync(viteConfigPath, "utf8");
record(/\bcloudflare\s*\(/u.test(viteConfig), "existing Cloudflare Vite integration must remain present");
record(/\bsites\s*\(/u.test(viteConfig), "existing ChatGPT Sites Vite integration must remain present");
record(!/\bvoidPlugin\b|from\s+["']void["']/u.test(viteConfig), "Void must not be layered into the existing Vite plugin graph");

const voidBinRelative = installedPackage.bin?.void;
record(voidBinRelative === "dist/cli/cli.mjs", "installed package must expose the expected Void command entry point");
const voidBinPath = resolve(ROOT, "node_modules/void", voidBinRelative);
record(existsSync(voidBinPath), "Void command entry point is missing");
accessSync(voidBinPath, constants.X_OK);
checks += 1;
const cliResult = spawnSync(voidBinPath, ["--version"], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, NO_COLOR: "1" },
  timeout: 10_000,
});
record(cliResult.error === undefined, `Void version command failed to start: ${cliResult.error?.message ?? "unknown error"}`);
record(cliResult.status === 0, `Void version command exited with ${cliResult.status}: ${cliResult.stderr.trim()}`);
record(cliResult.stdout.trim() === EXPECTED_VERSION, `Void command must report exactly ${EXPECTED_VERSION}`);

console.log(`VOID_INTEGRATION_VALIDATION_PASS checks=${checks} version=${EXPECTED_VERSION} artifact=${EXPECTED_OUTPUT_DIR} deployment=NOT_RUN`);

#!/usr/bin/env node
// information_uuid_v5=977e176d-04d1-5945-b8be-102c36b9d4d6
// event_uuid_v7=01a04cdc-3b33-770e-a586-a0de4a275d5d state_transition=SECURITY_EVIDENCE_UNCHECKED -> LOCAL_PATCH_VALIDATED_AWAITING_GITHUB_RESCAN occurred_at=2026-08-29T09:31:36.627Z
// machine-contract: exactly thirteen CodeQL alerts map to issues 91-103; local patch and audit evidence cannot become VERIFIED until a later main-branch CodeQL readback closes every alert.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_PATH = resolve(ROOT, "metadata/security-remediation.json");
const SCHEMA_PATH = resolve(ROOT, "schemas/security-remediation.schema.json");
const TYPESCRIPT_PACKAGE_PATH = resolve(ROOT, "src/typescript/package.json");
const TYPESCRIPT_LOCK_PATH = resolve(ROOT, "src/typescript/package-lock.json");
const NAMESPACE = "47f3e535-0e27-559a-9556-aa79a84f95eb";
const OBSERVED_AT = "2026-08-29T09:31:36.627Z";
const STATE = "LOCAL_PATCH_VALIDATED_AWAITING_GITHUB_RESCAN";
const UUID_INTEGRITY = "sha512-xZe/16rV4aa+HGSOCiY2YeLT1OybRLrrkL/Rqaq7p7GMVXjFh+6wN4oMYgjFmnSnhY8t6Xpdl2l9qmnHYuMHwQ==";
const UUID_V5_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ISO_MILLISECOND_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;

const ALERT_ROWS = [
  [
    1,
    91,
    "js/regex-injection",
    "HIGH",
    "scripts/validate_void_integration.mjs",
    102,
    "36fd7057-077a-5ee7-85b7-689b9fad63c0",
    "01a04cd2-7fd0-764c-95a9-71cf516a7846",
    "2026-08-29T09:20:58.920Z",
    "FIXED_SCHEMA_PATTERN_ALLOWLIST",
  ],
  [
    2,
    92,
    "js/regex-injection",
    "HIGH",
    "scripts/validate_service_integrations.mjs",
    360,
    "319859e9-0dff-5d5d-94ac-86e0d9e210a1",
    "01a04cd2-7fd0-764c-95a9-71d0301a2bda",
    "2026-08-29T09:20:59.990Z",
    "FIXED_SCHEMA_PATTERN_ALLOWLIST",
  ],
  [
    3,
    93,
    "js/command-line-injection",
    "CRITICAL",
    "scripts/validate_void_integration.mjs",
    338,
    "c183f0bb-4dd7-55c3-ab77-1623097ed401",
    "01a04cd2-7fd0-764c-95a9-71d1e1115af1",
    "2026-08-29T09:21:01.069Z",
    "FIXED_EXECUTABLE_ARGUMENT_BOUNDARY",
  ],
  [
    4,
    94,
    "js/path-injection",
    "HIGH",
    "src/typescript/notification/audit-log.ts",
    31,
    "bb8a27d6-b006-5943-bb8e-259944451de1",
    "01a04cd2-7fd0-764c-95a9-71d2a1abe2bf",
    "2026-08-29T09:21:02.149Z",
    "AUDIT_LOG_CONTAINED_NOFOLLOW_IO",
  ],
  [
    5,
    95,
    "js/path-injection",
    "HIGH",
    "src/typescript/notification/audit-log.ts",
    32,
    "4afc5ee0-5722-5874-9bd3-f4e77c6bdd85",
    "01a04cd2-7fd0-764c-95a9-71d3c5dccdaa",
    "2026-08-29T09:21:03.473Z",
    "AUDIT_LOG_CONTAINED_NOFOLLOW_IO",
  ],
  [
    6,
    96,
    "js/path-injection",
    "HIGH",
    "src/typescript/notification/audit-log.ts",
    37,
    "50aa665e-6eb3-50be-a14a-018f179aac95",
    "01a04cd2-7fd0-764c-95a9-71d4b755b26f",
    "2026-08-29T09:21:04.555Z",
    "AUDIT_LOG_CONTAINED_NOFOLLOW_IO",
  ],
  [
    7,
    97,
    "js/path-injection",
    "HIGH",
    "src/typescript/notification/audit-log.ts",
    40,
    "f6e4f0a9-4e95-567b-b8c6-0ddcfb93c417",
    "01a04cd2-7fd0-764c-95a9-71d569f59399",
    "2026-08-29T09:21:05.542Z",
    "AUDIT_LOG_CONTAINED_NOFOLLOW_IO",
  ],
  [
    8,
    98,
    "js/path-injection",
    "HIGH",
    "src/typescript/notification/audit-log.ts",
    56,
    "f906b2ac-9a95-5827-9825-06315f3c98ca",
    "01a04cd2-7fd0-764c-95a9-71d68a71a6ea",
    "2026-08-29T09:21:06.505Z",
    "AUDIT_LOG_CONTAINED_NOFOLLOW_IO",
  ],
  [
    9,
    99,
    "js/path-injection",
    "HIGH",
    "src/typescript/notification/audit-log.ts",
    57,
    "85d7dbce-6bc8-59bb-92d9-efbb62b9a1a2",
    "01a04cd2-7fd0-764c-95a9-71d7d6a0682e",
    "2026-08-29T09:21:07.529Z",
    "AUDIT_LOG_CONTAINED_NOFOLLOW_IO",
  ],
  [
    10,
    100,
    "js/path-injection",
    "HIGH",
    "src/typescript/notification/store.ts",
    81,
    "f8d08625-ae85-5e58-860f-6d1877e0a634",
    "01a04cd2-7fd0-764c-95a9-71d8b4cdd17a",
    "2026-08-29T09:21:08.896Z",
    "SQLITE_CONTAINED_PRIVATE_PATH",
  ],
  [
    11,
    101,
    "js/weak-cryptographic-algorithm",
    "HIGH",
    "scripts/validate_service_integrations.mjs",
    410,
    "b383496a-7da8-5182-814d-3ddbe242e277",
    "01a04cd2-7fd0-764c-95a9-71d94d6a6289",
    "2026-08-29T09:21:09.903Z",
    "FIXED_UUID_V5_IDENTITY_LEDGER",
  ],
  [
    12,
    102,
    "js/weak-cryptographic-algorithm",
    "HIGH",
    "src/typescript/uuid.ts",
    21,
    "539b6392-7e46-5d0f-a0aa-68d1e9c8696c",
    "01a04cd2-7fd0-764c-95a9-71da06442f13",
    "2026-08-29T09:21:10.972Z",
    "STANDARD_UUID_V5_LIBRARY_BOUNDARY",
  ],
  [
    13,
    103,
    "js/remote-property-injection",
    "HIGH",
    "src/typescript/test/evaluator.test.ts",
    39,
    "5533f41d-695d-55b9-8978-924a7fb6fe2a",
    "01a04cd2-7fd0-764c-95a9-71db5246131d",
    "2026-08-29T09:21:12.004Z",
    "FIXED_GATE_ASSIGNMENT_CASES",
  ],
];

const EXPECTED_ALERTS = ALERT_ROWS.map(([alert, issue, rule, severity, path, line, codeScanningAlertUuidV5, observationUuidV7, observedAt, fixCategory]) => ({
  alert,
  issue,
  rule,
  severity,
  path,
  line,
  codeScanningAlertUuidV5,
  observationUuidV7,
  observedAt,
  fixCategory,
  state: STATE,
}));

const EXPECTED_FIX_CATEGORIES = [
  { category: "FIXED_SCHEMA_PATTERN_ALLOWLIST", alerts: [1, 2] },
  { category: "FIXED_EXECUTABLE_ARGUMENT_BOUNDARY", alerts: [3] },
  { category: "AUDIT_LOG_CONTAINED_NOFOLLOW_IO", alerts: [4, 5, 6, 7, 8, 9] },
  { category: "SQLITE_CONTAINED_PRIVATE_PATH", alerts: [10] },
  { category: "FIXED_UUID_V5_IDENTITY_LEDGER", alerts: [11] },
  { category: "STANDARD_UUID_V5_LIBRARY_BOUNDARY", alerts: [12] },
  { category: "FIXED_GATE_ASSIGNMENT_CASES", alerts: [13] },
];

const EXPECTED_CONFIGURATION = {
  state: "configured",
  apiLanguageTokens: ["actions", "javascript", "javascript-typescript", "python", "typescript"],
  normalizedAnalysisLanguages: ["actions", "javascript-typescript", "python"],
  querySuite: "extended",
  threatModel: "remote_and_local",
  runnerType: "standard",
  runnerLabel: "",
  scanSchedule: null,
  scanScheduleState: "PROVIDER_DEFAULT_NOT_EXPLICIT_IN_API",
};

const EXPECTED_INITIAL_ANALYSIS = {
  informationUuidV5: "2e2ab483-f3f3-5a31-af2d-be1459b52e85",
  observationUuidV7: "01a04cc2-05b8-71bb-81bb-bed308926a82",
  observedAt: "2026-08-29T09:02:59.000Z",
  runId: 33244513119,
  runUrl: "https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/actions/runs/33244513119",
  name: "CodeQL Setup",
  event: "dynamic",
  ref: "refs/heads/main",
  commit: "586b566d96eff4762a91a0db488bb83b781ae591",
  status: "completed",
  conclusion: "success",
  createdAt: "2026-08-29T09:01:45.000Z",
  startedAt: "2026-08-29T09:01:45.000Z",
  updatedAt: "2026-08-29T09:02:59.000Z",
  analyses: [
    {
      analysisId: 1691323205,
      category: "/language:actions",
      createdAt: "2026-08-29T09:02:18.000Z",
      results: 0,
      rules: 23,
      tool: "CodeQL",
      toolVersion: "2.26.4",
    },
    {
      analysisId: 1691323562,
      category: "/language:python",
      createdAt: "2026-08-29T09:02:32.000Z",
      results: 0,
      rules: 50,
      tool: "CodeQL",
      toolVersion: "2.26.4",
    },
    {
      analysisId: 1691323967,
      category: "/language:javascript-typescript",
      createdAt: "2026-08-29T09:02:47.000Z",
      results: 13,
      rules: 103,
      tool: "CodeQL",
      toolVersion: "2.26.4",
    },
  ],
};

const EXPECTED_AUDITS = [
  {
    informationUuidV5: "2e660501-08a6-56e1-bb32-824eeec53e9e",
    observationUuidV7: "01a04cdc-3b33-73ff-8a0a-f7903b77087b",
    observedAt: OBSERVED_AT,
    scope: "ROOT_PACKAGE_LOCK_ENTIRE_DEPENDENCY_GRAPH",
    command: "npm audit --audit-level=low",
    status: "NO_KNOWN_VULNERABILITIES",
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
    automaticFixApplied: false,
  },
  {
    informationUuidV5: "3126c5ee-c0f2-519d-900a-4213e8880063",
    observationUuidV7: "01a04cdc-3b33-7416-84b6-0798e9757bf4",
    observedAt: OBSERVED_AT,
    scope: "SRC_TYPESCRIPT_PACKAGE_LOCK_ENTIRE_DEPENDENCY_GRAPH",
    command: "npm audit --prefix src/typescript --audit-level=low",
    status: "NO_KNOWN_VULNERABILITIES",
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
    automaticFixApplied: false,
  },
];

let checks = 0;

function record(condition, message) {
  if (!condition) throw new Error(`SECURITY_REMEDIATION_VALIDATION_FAIL: ${message}`);
  checks += 1;
}

function readJson(path, label) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`SECURITY_REMEDIATION_VALIDATION_FAIL: ${label} is not valid JSON: ${error.message}`, { cause: error });
  }
  record(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function uuidV7EpochMs(value) {
  return Number.parseInt(value.replaceAll("-", "").slice(0, 12), 16);
}

function assertObservation(uuid, observedAt, label, maximumLagMs = 0) {
  record(UUID_V7_PATTERN.test(uuid), `${label} must be UUIDv7`);
  record(ISO_MILLISECOND_PATTERN.test(observedAt) && Number.isFinite(Date.parse(observedAt)), `${label} must use an exact UTC millisecond timestamp`);
  const lag = Date.parse(observedAt) - uuidV7EpochMs(uuid);
  record(lag >= 0 && lag <= maximumLagMs, `${label} UUIDv7 timestamp must not follow its observation or exceed the allowed lag`);
}

function openSchemaObjects(value, pointer = "$schema") {
  const findings = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...openSchemaObjects(item, `${pointer}[${index}]`)));
    return findings;
  }
  if (value === null || typeof value !== "object") return findings;
  if (value.type === "object" && value.additionalProperties !== false) findings.push(pointer);
  for (const [key, child] of Object.entries(value)) findings.push(...openSchemaObjects(child, `${pointer}.${key}`));
  return findings;
}

const evidence = readJson(EVIDENCE_PATH, "security remediation evidence");
const schema = readJson(SCHEMA_PATH, "security remediation schema");
const typescriptPackage = readJson(TYPESCRIPT_PACKAGE_PATH, "TypeScript package manifest");
const typescriptLock = readJson(TYPESCRIPT_LOCK_PATH, "TypeScript package lock");

record(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "schema must use draft 2020-12");
record(schema.$defs?.alert !== undefined, "schema must define the alert contract");
record(schema.properties?.codeql?.properties?.alerts?.minItems === 13, "schema must require thirteen alerts");
record(schema.properties?.codeql?.properties?.alerts?.maxItems === 13, "schema must forbid more than thirteen alerts");
record(openSchemaObjects(schema).length === 0, `every typed schema object must fail closed: ${openSchemaObjects(schema).join(", ")}`);

record(evidence.$schema === "../schemas/security-remediation.schema.json", "evidence must reference its schema");
record(evidence.identity?.informationUuidV5 === "635084d9-008d-5c4a-a521-89614026e586", "ledger UUIDv5 differs from its fixed identity");
record(evidence.identity?.namespace === NAMESPACE, "ledger UUID namespace differs from the repository namespace");
record(evidence.identity?.observedAt === OBSERVED_AT, "ledger observation time differs from the fixed audit boundary");
assertObservation(evidence.identity?.observationUuidV7, evidence.identity?.observedAt, "ledger observation");
record(evidence.stateTransition?.eventId === evidence.identity?.observationUuidV7, "state transition event must equal the ledger observation UUIDv7");
record(evidence.stateTransition?.occurredAt === evidence.identity?.observedAt, "state transition time must equal the ledger observation time");
record(evidence.stateTransition?.to === STATE, "ledger must remain explicitly pending GitHub rescan");
record(
  evidence.stateTransition?.machineContract?.includes("later main-branch CodeQL analysis"),
  "machine contract must separate local validation from main readback",
);

record(isDeepStrictEqual(evidence.codeql?.configuration, EXPECTED_CONFIGURATION), "CodeQL default setup differs from official API readback");
record(isDeepStrictEqual(evidence.codeql?.initialAnalysis, EXPECTED_INITIAL_ANALYSIS), "initial CodeQL analysis differs from official API readback");
assertObservation(evidence.codeql.initialAnalysis.observationUuidV7, evidence.codeql.initialAnalysis.observedAt, "initial CodeQL analysis");
record(isDeepStrictEqual(evidence.codeql?.alerts, EXPECTED_ALERTS), "CodeQL alert-to-issue ledger differs from the fixed thirteen-entry report");
record(isDeepStrictEqual(evidence.codeql?.fixCategories, EXPECTED_FIX_CATEGORIES), "fix category coverage differs from the reviewed local patch");
record(
  isDeepStrictEqual(evidence.codeql?.mainRescan, {
    informationUuidV5: "130fcd5f-b7e0-59be-b739-cfba36b6de2e",
    state: "AWAITING_MAIN_BRANCH_ANALYSIS_AFTER_PATCH",
    ref: "refs/heads/main",
    latestVerifiedMainCommit: "586b566d96eff4762a91a0db488bb83b781ae591",
    patchCommit: null,
    requiredOutcome: "ALL_THIRTEEN_ALERTS_FIXED_OR_EXPLICITLY_DISMISSED_AND_READ_BACK",
    separateFromLocalValidation: true,
  }),
  "main rescan gate must remain pending and separate from local validation",
);

const alertNumbers = evidence.codeql.alerts.map((entry) => entry.alert);
const issueNumbers = evidence.codeql.alerts.map((entry) => entry.issue);
record(
  isDeepStrictEqual(
    alertNumbers,
    Array.from({ length: 13 }, (_, index) => index + 1),
  ),
  "alerts must be exactly 1 through 13",
);
record(
  isDeepStrictEqual(
    issueNumbers,
    Array.from({ length: 13 }, (_, index) => index + 91),
  ),
  "issues must be exactly 91 through 103",
);
record(new Set(alertNumbers).size === 13 && new Set(issueNumbers).size === 13, "alert and issue mappings must both be one-to-one");
record(evidence.codeql.alerts.filter((entry) => entry.severity === "CRITICAL").length === 1, "exactly one alert must be critical");
record(evidence.codeql.alerts.filter((entry) => entry.severity === "HIGH").length === 12, "exactly twelve alerts must be high severity");

let previousObservedAt = Date.parse(evidence.codeql.initialAnalysis.updatedAt);
let previousObservationUuidV7 = "";
for (const entry of evidence.codeql.alerts) {
  record(UUID_V5_PATTERN.test(entry.codeScanningAlertUuidV5), `alert ${entry.alert} identity must be UUIDv5`);
  assertObservation(entry.observationUuidV7, entry.observedAt, `alert ${entry.alert} observation`, 60_000);
  record(Date.parse(entry.observedAt) > previousObservedAt, `alert ${entry.alert} observation must follow the preceding security observation`);
  record(entry.observationUuidV7 > previousObservationUuidV7, `alert ${entry.alert} UUIDv7 must preserve issue-report order`);
  record(existsSync(resolve(ROOT, entry.path)), `alert ${entry.alert} source path is missing`);
  previousObservedAt = Date.parse(entry.observedAt);
  previousObservationUuidV7 = entry.observationUuidV7;
}
record(previousObservedAt <= Date.parse(evidence.identity.observedAt), "alert observations must not follow the audit boundary");

const categoryCoverage = evidence.codeql.fixCategories.flatMap((entry) => entry.alerts).sort((left, right) => left - right);
record(isDeepStrictEqual(categoryCoverage, alertNumbers), "fix categories must cover every alert exactly once");
record(
  isDeepStrictEqual(evidence.dependencyAudits, EXPECTED_AUDITS),
  "root and TypeScript dependency audits differ from their separate zero-result observations",
);
for (const audit of evidence.dependencyAudits) assertObservation(audit.observationUuidV7, audit.observedAt, audit.scope);
record(
  evidence.dependencyAudits[0].observationUuidV7 < evidence.dependencyAudits[1].observationUuidV7,
  "audit UUIDv7 order must preserve root then TypeScript scope",
);
record(evidence.dependencyAudits[1].observationUuidV7 < evidence.identity.observationUuidV7, "ledger event must follow both audit observations");

const uuidEntry = typescriptLock.packages?.["node_modules/uuid"];
record(typescriptPackage.dependencies?.uuid === "14.0.2", "TypeScript manifest must pin uuid 14.0.2");
record(typescriptLock.packages?.[""]?.dependencies?.uuid === "14.0.2", "TypeScript lock root must pin uuid 14.0.2");
record(uuidEntry?.version === "14.0.2", "TypeScript lock must resolve uuid 14.0.2");
record(uuidEntry?.resolved === "https://registry.npmjs.org/uuid/-/uuid-14.0.2.tgz", "uuid registry artifact differs from the reviewed lock entry");
record(uuidEntry?.integrity === UUID_INTEGRITY, "uuid lock integrity differs from the reviewed value");
record(!Object.hasOwn(uuidEntry ?? {}, "dependencies"), "uuid 14.0.2 must retain no transitive dependency declaration");
record(
  !Object.keys(typescriptLock.packages ?? {}).some((path) => path.startsWith("node_modules/uuid/node_modules/")),
  "uuid must not resolve nested transitive packages",
);
record(
  isDeepStrictEqual(evidence.uuidDependencyEvidence, {
    manifest: "src/typescript/package.json",
    lockfile: "src/typescript/package-lock.json",
    package: "uuid",
    requestedVersion: "14.0.2",
    resolvedVersion: "14.0.2",
    integrity: UUID_INTEGRITY,
    transitiveDependencyCount: 0,
    lockEntryHasDependenciesField: false,
    purpose: "RFC_9562_UUID_V5_NON_SECURITY_IDENTIFIERS_ONLY",
  }),
  "uuid dependency evidence differs from the manifest and lock contract",
);

record(Array.isArray(evidence.sources) && evidence.sources.length === 3, "three primary sources must support the ledger");
record(
  evidence.sources.every((source) => UUID_V5_PATTERN.test(source.sourceId) && source.url.startsWith("https://")),
  "every source needs a stable UUIDv5 and HTTPS URL",
);
record(evidence.secretsIncluded === false, "security evidence must declare that it contains no secrets");
const evidenceText = readFileSync(EVIDENCE_PATH, "utf8");
record(!/-{5}BEGIN [A-Z ]*PRIVATE KEY-{5}/u.test(evidenceText), "security evidence contains private-key material");
record(!/\b(?:gh[pousr]_|github_pat_|sk-)[A-Za-z0-9_-]{16,}\b/u.test(evidenceText), "security evidence contains a token-shaped value");

console.log(`SECURITY_REMEDIATION_VALIDATION_OK: ${checks} checks`);

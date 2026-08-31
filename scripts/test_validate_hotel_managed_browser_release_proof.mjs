#!/usr/bin/env node
// information_uuid_v5=a0fbdc59-0d0e-5134-89b8-1d30db405e5a
// event_uuid_v7=01a05439-6770-7ee3-a4cf-7ac7d7ea90ef
// state_transition=MANAGED_NATIVE_CAPABILITY_UNTESTED -> MANAGED_NATIVE_CAPABILITY_REGRESSION_GATES occurred_at=2026-08-30T19:50:43.312Z
// machine-contract: test-only managed evidence proves an executed native
// capability fetch and four-call retry ordering without creating a production
// synthetic status or changing the old Chrome proof.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  expectedCallPhases,
  expectedInteractionSequence,
  expectedTools,
  forbiddenTools,
  canonicalResultSummary,
  managedEvidenceProfile,
  sha256CanonicalResultSummary,
  validateManagedBrowserDiscovery,
} from "./hotel-managed-browser-release-proof.mjs";
import { browserObservationFrom, compareStable, validateNativeDiscovery } from "./validate_hotel_release_candidate.mjs";

const observedAt = "2026-08-30T19:50:43.312Z";
const confirmationNumber = "FKR-SYNTHETIC214";
const fingerprint = "01234567-89ab-5cde-8123-456789abcdef";
const bookingId = "fedcba98-7654-5cba-8123-fedcba987654";
const prepareEventChainHead = "d".repeat(64);
const beforeEventChainHead = "b".repeat(64);
const afterEventChainHead = "a".repeat(64);
const managedObservationUuidV7 = "01a05439-6770-7ee3-a4cf-7ac7d7ea90ef";
const managedRecordingSha256 = "c".repeat(64);
const correctedInteractionSequence = Object.freeze([
  "check_existing_hotel_booking",
  "prepare_hotel_booking",
  "visible_human_confirmation",
  "get_hotel_booking_status:before_retry",
  "visible_retry",
  "get_hotel_booking_status:after_retry",
]);
const legacyManagedFieldsByPhase = Object.freeze({
  statusCheck: Object.freeze({
    intentId: fingerprint,
    fingerprint,
    bookingId,
    eventCount: 3,
    eventChainHead: beforeEventChainHead,
  }),
  finalStatus: Object.freeze({
    intentId: fingerprint,
    fingerprint,
    bookingId,
    eventCount: 4,
    eventChainHead: afterEventChainHead,
  }),
});

const DRAFT_2020_12_REGISTRY_RUNNER = String.raw`
import json
import sys

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

payload = json.load(sys.stdin)
schemas = payload["schemas"]
registry = Registry().with_resources(
    (schema["$id"], Resource.from_contents(schema)) for schema in schemas.values()
)
results = []

def serialize_error(error):
    return {
        "path": list(error.path),
        "schemaPath": list(error.schema_path),
        "validator": error.validator,
        "message": error.message,
        "context": [serialize_error(child) for child in error.context],
    }

for case in payload["cases"]:
    schema = schemas[case["schemaName"]]
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, registry=registry, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(case["instance"]), key=lambda error: (list(error.path), list(error.schema_path)))
    results.append({
        "name": case["name"],
        "errors": [serialize_error(error) for error in errors],
    })
json.dump(results, sys.stdout, ensure_ascii=False, separators=(",", ":"))
`;

// Fixed test-only copy of the original measured Chrome proof. The production
// metadata may later become a managed record; this regression input must not.
const legacyChromeProof = {
  identity: {
    informationUuidV5: "1d4b92e2-85a9-5d03-a7b3-62c3d9ca4f83",
    observationUuidV7: "01a052f2-77e0-784c-a1c1-24e9f5378db4",
    observedAt: "2026-08-30T13:53:37.248Z",
  },
  status: "PASS",
  deployment: {
    provider: "Vercel",
    projectId: "prj_sfErclBd1NgXtkeA5PVntIoj6Q3X",
    projectName: "kyoto-booking-retry-proof",
    deploymentId: "dpl_AdzeHw7CgM3sbsZBVutZZbLLbeAK",
    target: "production",
    state: "READY",
    sourceCommit: "c8be388d8047472ef7d6ad69656255adb5903e37",
    publicUrl: "https://kyoto-booking-retry-proof.vercel.app/",
    uniqueUrl: "https://kyoto-booking-retry-proof-jnkzuh7r0-aniotajp-1978s-projects.vercel.app",
    readyAt: "2026-08-30T13:47:14.754Z",
    observedAt: "2026-08-30T13:56:24.118Z",
  },
  discovery: {
    status: "PASS",
    observedAt: "2026-08-30T13:48:25.335Z",
    browser: "HeadlessChrome/152.0.0.0",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36",
    secureContext: true,
    documentModelContext: "CONFIRMED_PRESENT",
    requiredChromeFlags: ["#devtools-webmcp-support", "#enable-webmcp-testing"],
    configuration: {
      launchArguments: ["--enable-features=WebMCP"],
      devtoolsWebmcpCategory: true,
      experimentalScreencast: true,
    },
    originTrialMetadataCount: 0,
    visibleToolNames: [...expectedTools],
    forbiddenToolNames: [...forbiddenTools],
    calledToolNames: [],
    discoveryEffectCounts: {
      bookingCount: 0,
      effectStartCount: 0,
      externalRequests: 0,
      permissionRequests: 0,
      notifications: 0,
    },
  },
  reconciliation: {
    status: "PASS",
    observedAt: "2026-08-30T13:53:37.248Z",
    flow: ["AMBIGUOUS_OUTCOME", "AGENT_WEBMCP_STATUS_CHECK", "EXISTING_RESULT_FOUND", "NO_DUPLICATE_EFFECT"],
    calledToolNames: ["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status"],
    statusCheck: {
      toolName: "get_hotel_booking_status",
      state: "COMMITTED",
      bookingExists: true,
      confirmationNumber: "FKR-08DFFA4C4F",
      attemptCount: 1,
      bookingCount: 1,
      effectStartCount: 1,
    },
    finalStatus: {
      state: "RETRY_RECOGNIZED",
      attemptCount: 2,
      bookingCount: 1,
      effectStartCount: 1,
      confirmationNumber: "FKR-08DFFA4C4F",
      sameConfirmation: true,
    },
    sameConfirmation: true,
    humanConfirmationBoundary: "visible_button_only",
    driverAction: "visible_button_exercised_by_browser_driver",
    agentExplanation: "The native status check found the existing booking with confirmation FKR-08DFFA4C4F, so the retry recognized it and did not start a second effect.",
  },
  recording: {
    status: "LOCAL_ARTIFACT",
    path: "/private/tmp/webmcp-issue-189/.local/native-webmcp-reconciliation-c8be388d.mp4",
    sha256: "d06ad515923154837747ae990b3178979e9e55b749aba3f8b2766b82039bd42b",
    durationSeconds: 157.866667,
  },
};

const legacyCandidateBrowserObservation = {
  url: "https://kyoto-booking-retry-proof.vercel.app/",
  origin: "https://kyoto-booking-retry-proof.vercel.app",
  observedAt: "2026-08-30T13:53:37.248Z",
  browser: "HeadlessChrome/152.0.0.0",
  secureContext: true,
  pageSourceCommit: "c8be388d8047472ef7d6ad69656255adb5903e37",
  candidateSourceCommit: "c8be388d8047472ef7d6ad69656255adb5903e37",
  documentModelContext: "CONFIRMED_PRESENT",
  requiredChromeFlags: ["#devtools-webmcp-support", "#enable-webmcp-testing"],
  configurationState: "VERIFIED",
  launchArguments: ["--enable-features=WebMCP"],
  devtoolsWebmcpCategory: true,
  originTrialMetadataCount: 0,
  visibleToolNames: [...expectedTools],
  forbiddenToolNames: [...forbiddenTools],
  calledToolNames: ["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status"],
  discoveryEffectCounts: {
    bookingCount: 0,
    effectStartCount: 0,
    externalRequests: 0,
    permissionRequests: 0,
    notifications: 0,
  },
  reconciliation: {
    status: "PASS",
    flow: ["AMBIGUOUS_OUTCOME", "AGENT_WEBMCP_STATUS_CHECK", "EXISTING_RESULT_FOUND", "NO_DUPLICATE_EFFECT"],
    statusCheck: {
      toolName: "get_hotel_booking_status",
      state: "COMMITTED",
      bookingExists: true,
      confirmationNumber: "FKR-08DFFA4C4F",
      attemptCount: 1,
      bookingCount: 1,
      effectStartCount: 1,
    },
    finalStatus: {
      state: "RETRY_RECOGNIZED",
      attemptCount: 2,
      bookingCount: 1,
      effectStartCount: 1,
      confirmationNumber: "FKR-08DFFA4C4F",
      sameConfirmation: true,
    },
    sameConfirmation: true,
    humanConfirmationBoundary: "visible_button_only",
    driverAction: "visible_button_exercised_by_browser_driver",
    agentExplanation: "The native status check found the existing booking with confirmation FKR-08DFFA4C4F, so the retry recognized it and did not start a second effect.",
  },
  recording: {
    status: "LOCAL_ARTIFACT",
    path: "/private/tmp/webmcp-issue-189/.local/native-webmcp-reconciliation-c8be388d.mp4",
    sha256: "d06ad515923154837747ae990b3178979e9e55b749aba3f8b2766b82039bd42b",
    durationSeconds: 157.866667,
  },
  status: "PASS",
};

function resultEvidence(summary, description) {
  return {
    sha256: sha256CanonicalResultSummary(summary),
    basis: "TEST_FIXTURE_SUMMARY",
    canonicalSummary: canonicalResultSummary(summary),
    scope: "EXPLICIT_SUMMARY_ONLY_NOT_RAW_ATTESTATION",
    description,
  };
}

function fetchResultSummary(call) {
  return {
    kind: "fetchTools",
    sequence: call.sequence,
    method: call.method,
    status: call.status,
    resultStatus: call.resultStatus,
    returnedToolNames: call.returnedToolNames,
    forbiddenToolNames: call.forbiddenToolNames,
  };
}

function toolCallResultSummary(call) {
  const summary = {
    kind: "toolCall",
    sequence: call.sequence,
    phase: call.phase,
    method: call.method,
    toolName: call.toolName,
    status: call.status,
    resultStatus: call.resultStatus,
  };
  if (Object.hasOwn(call, "resultObservation")) summary.resultObservation = call.resultObservation;
  return summary;
}

function toolCall(sequence, phase, toolName, resultObservation) {
  const call = {
    sequence,
    phase,
    method: "webmcp.capability.tool.call",
    toolName,
    status: "EXECUTED",
    resultStatus: "SUCCESS",
  };
  if (resultObservation) call.resultObservation = resultObservation;
  call.resultEvidence = resultEvidence(toolCallResultSummary(call), `Test-only summary for native ${phase} result.`);
  return call;
}

function refreshToolCallResultEvidence(call) {
  const summary = toolCallResultSummary(call);
  call.resultEvidence = {
    ...call.resultEvidence,
    canonicalSummary: canonicalResultSummary(summary),
    sha256: sha256CanonicalResultSummary(summary),
  };
}

const managedFixture = {
  profile: managedEvidenceProfile,
  status: "TEST_FIXTURE",
  observedAt,
  surface: "MANAGED_IAB_NATIVE_CAPABILITY",
  runBinding: {
    rootObservationUuidV7: managedObservationUuidV7,
    completedAt: observedAt,
    publicSourceCommit: "c8be388d8047472ef7d6ad69656255adb5903e37",
    deploymentId: "dpl_ManagedFixture214",
    publicUrl: "https://managed-fixture.example.test/",
    recordingSha256: managedRecordingSha256,
  },
  fetchToolsCall: {
    sequence: 1,
    method: "webmcp.capability.fetchTools().call",
    status: "EXECUTED",
    resultStatus: "SUCCESS",
    returnedToolNames: [...expectedTools],
    forbiddenToolNames: [...forbiddenTools],
    resultEvidence: resultEvidence(
      fetchResultSummary({
        sequence: 1,
        method: "webmcp.capability.fetchTools().call",
        status: "EXECUTED",
        resultStatus: "SUCCESS",
        returnedToolNames: [...expectedTools],
        forbiddenToolNames: [...forbiddenTools],
      }),
      "Test-only summary hash for the native fetch result.",
    ),
  },
  visibleToolNames: [...expectedTools],
  forbiddenToolNames: [...forbiddenTools],
  toolCalls: [
    toolCall(1, expectedCallPhases[0], expectedTools[0], {
      attemptCount: 0,
      bookingExists: false,
      effectStartCount: 0,
      eventCount: 0,
      fingerprint,
    }),
    toolCall(2, expectedCallPhases[1], expectedTools[1], {
      state: "PREPARED",
      attemptCount: 1,
      bookingExists: false,
      effectStartCount: 0,
      eventCount: 1,
      eventChainHead: prepareEventChainHead,
      intentId: fingerprint,
      fingerprint,
    }),
    toolCall(3, expectedCallPhases[2], expectedTools[2], {
      state: "COMMITTED",
      attemptCount: 1,
      bookingExists: true,
      effectStartCount: 1,
      eventCount: 3,
      eventChainHead: beforeEventChainHead,
      intentId: fingerprint,
      fingerprint,
      bookingId,
      confirmationNumber,
    }),
    toolCall(4, expectedCallPhases[3], expectedTools[2], {
      state: "RETRY_RECOGNIZED",
      attemptCount: 2,
      bookingExists: true,
      effectStartCount: 1,
      eventCount: 4,
      eventChainHead: afterEventChainHead,
      intentId: fingerprint,
      fingerprint,
      bookingId,
      confirmationNumber,
    }),
  ],
  interactionSequence: [...correctedInteractionSequence],
  effectObservation: {
    status: "LIMITED",
    scope: "NATIVE_CAPABILITY_RESULT_FIELDS_ONLY",
    observedFields: ["attemptCount", "bookingExists", "effectStartCount", "eventCount", "eventChainHead"],
    unmeasuredFields: ["externalRequests", "permissionRequests", "notifications"],
    reasonCode: "CDP_NETWORK_EVENTS_NOT_CAPTURED",
  },
  configurationObservation: {
    browserVersion: { status: "UNMEASURED", reasonCode: "CDP_METHOD_UNSUPPORTED_BY_CONNECTION" },
    launchArguments: { status: "UNMEASURED", reasonCode: "CDP_METHOD_UNSUPPORTED_BY_CONNECTION" },
    documentModelContext: { status: "UNMEASURED", reasonCode: "MANAGED_SURFACE_DOES_NOT_EXPOSE_PAGE_CONTEXT" },
    requiredChromeFlags: { status: "UNMEASURED", reasonCode: "NO_CONFIGURATION_READBACK" },
    devtoolsWebmcpCategory: { status: "UNMEASURED", reasonCode: "NO_CONFIGURATION_READBACK" },
  },
};

function productionShapedManagedFixture() {
  const record = structuredClone(managedFixture);
  record.status = "PASS";
  const evidences = [record.fetchToolsCall.resultEvidence, ...record.toolCalls.map((call) => call.resultEvidence)];
  for (const evidence of evidences) {
    evidence.basis = "EXPLICIT_SUMMARY_HASH";
    evidence.description = "Explicit test summary hash used only for candidate wiring coverage.";
  }
  return record;
}

function managedRootWithBoundReconciliation(oldChromeProof) {
  const managedRoot = structuredClone(oldChromeProof);
  managedRoot.discovery = productionShapedManagedFixture();
  managedRoot.identity = {
    ...managedRoot.identity,
    observationUuidV7: managedObservationUuidV7,
    observedAt: managedRoot.discovery.observedAt,
  };
  managedRoot.reconciliation = {
    ...managedRoot.reconciliation,
    observedAt: managedRoot.discovery.observedAt,
  };
  managedRoot.discovery.runBinding = {
    ...managedRoot.discovery.runBinding,
    rootObservationUuidV7: managedRoot.identity.observationUuidV7,
    completedAt: managedRoot.discovery.observedAt,
    publicSourceCommit: managedRoot.deployment.sourceCommit,
    deploymentId: managedRoot.deployment.deploymentId,
    publicUrl: managedRoot.deployment.publicUrl,
    recordingSha256: managedRoot.recording.sha256,
  };
  const before = managedRoot.discovery.toolCalls[2].resultObservation;
  const after = managedRoot.discovery.toolCalls[3].resultObservation;
  managedRoot.reconciliation = {
    ...managedRoot.reconciliation,
    calledToolNames: expectedTools.slice(0, 3),
    statusCheck: {
      ...managedRoot.reconciliation.statusCheck,
      intentId: before.intentId,
      fingerprint: before.fingerprint,
      bookingId: before.bookingId,
      eventCount: before.eventCount,
      eventChainHead: before.eventChainHead,
      confirmationNumber: before.confirmationNumber,
      attemptCount: before.attemptCount,
      bookingCount: 1,
      effectStartCount: before.effectStartCount,
    },
    finalStatus: {
      ...managedRoot.reconciliation.finalStatus,
      intentId: after.intentId,
      fingerprint: after.fingerprint,
      bookingId: after.bookingId,
      eventCount: after.eventCount,
      eventChainHead: after.eventChainHead,
      confirmationNumber: after.confirmationNumber,
      attemptCount: after.attemptCount,
      bookingCount: 1,
      effectStartCount: after.effectStartCount,
      sameConfirmation: before.confirmationNumber === after.confirmationNumber,
    },
    sameConfirmation: before.confirmationNumber === after.confirmationNumber,
    agentExplanation: "The managed status sequence stayed bound to one synthetic intent, booking, confirmation, and event chain.",
  };
  return managedRoot;
}

async function validateWithDraft202012Registry(cases) {
  const nativeSchema = JSON.parse(await readFile(new URL("../schemas/hotel-native-webmcp-reconciliation.schema.json", import.meta.url), "utf8"));
  const candidateSchema = JSON.parse(await readFile(new URL("../schemas/hotel-release-candidate.schema.json", import.meta.url), "utf8"));
  const candidateManagedObservationSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://example.invalid/managed-browser-observation-test.schema.json",
    $ref: `${candidateSchema.$id}#/$defs/managedBrowserObservation`,
  };
  const candidateLegacyObservationSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://example.invalid/legacy-browser-observation-test.schema.json",
    $ref: `${candidateSchema.$id}#/$defs/browserObservation`,
  };
  const result = spawnSync("uv", ["run", "--frozen", "python", "-c", DRAFT_2020_12_REGISTRY_RUNNER], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
    env: { ...process.env, UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? join(fileURLToPath(new URL("..", import.meta.url)), ".local/uv-cache") },
    input: JSON.stringify({
      schemas: {
        native: nativeSchema,
        candidate: candidateSchema,
        candidateManagedObservation: candidateManagedObservationSchema,
        candidateLegacyObservation: candidateLegacyObservationSchema,
      },
      cases,
    }),
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
  });
  assert.equal(result.error, undefined, `Draft 2020-12 registry validator failed to start: ${result.error?.message ?? "unknown error"}`);
  assert.equal(result.status, 0, `Draft 2020-12 registry validator failed:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function schemaErrorExists(error, validator, pathPart) {
  return (
    (error.validator === validator && (error.path.includes(pathPart) || error.message.includes(pathPart))) ||
    error.context?.some((child) => schemaErrorExists(child, validator, pathPart))
  );
}

test("accepts the test-only managed capability discovery shape", () => {
  const result = validateManagedBrowserDiscovery(managedFixture, { allowTestFixture: true });
  assert.deepEqual(result, {
    evidenceProfile: managedEvidenceProfile,
    status: "TEST_FIXTURE",
    executedToolCalls: 4,
    unmeasuredExternalEffects: ["externalRequests", "permissionRequests", "notifications"],
  });
});

test("does not allow the test-only status in production validation", () => {
  assert.throws(() => validateManagedBrowserDiscovery(managedFixture), /PASS outside tests/u);
});

test("keeps the old Chrome proof on its original contract", async () => {
  const oldChromeProof = structuredClone(legacyChromeProof);
  assert.throws(() => validateManagedBrowserDiscovery(oldChromeProof.discovery), /profile|unexpected|managed/u);
  assert.equal(oldChromeProof.discovery.documentModelContext, "CONFIRMED_PRESENT");
  assert.deepEqual(oldChromeProof.discovery.requiredChromeFlags, ["#devtools-webmcp-support", "#enable-webmcp-testing"]);
});

test("uses the existing native evidence root for the managed discovery branch", async () => {
  const oldChromeProof = structuredClone(legacyChromeProof);
  const managedRoot = structuredClone(oldChromeProof);
  managedRoot.discovery = { ...structuredClone(managedFixture), status: "PASS" };
  validateManagedBrowserDiscovery(managedRoot.discovery, { allowTestFixture: true });
  assert.deepEqual(managedRoot.deployment, oldChromeProof.deployment);
  assert.deepEqual(managedRoot.reconciliation, oldChromeProof.reconciliation);
  assert.deepEqual(managedRoot.recording, oldChromeProof.recording);
});

test("candidate build accepts managed discovery without requiring Chrome configuration", async () => {
  const oldChromeProof = structuredClone(legacyChromeProof);
  const managedRoot = managedRootWithBoundReconciliation(oldChromeProof);
  validateNativeDiscovery(managedRoot);
  const browserObservation = browserObservationFrom(managedRoot, oldChromeProof.deployment.sourceCommit);
  assert.equal(browserObservation.profile, managedEvidenceProfile);
  assert.deepEqual(browserObservation.managedDiscovery, managedRoot.discovery);
  assert.equal(Object.hasOwn(browserObservation, "requiredChromeFlags"), false);
  assert.deepEqual(browserObservation.visibleToolNames, expectedTools);
  assert.deepEqual(browserObservation.forbiddenToolNames, forbiddenTools);
});

test("candidate managed branch rejects a declaration-only discovery", async () => {
  const oldChromeProof = structuredClone(legacyChromeProof);
  const managedRoot = managedRootWithBoundReconciliation(oldChromeProof);
  delete managedRoot.discovery.toolCalls;
  assert.throws(() => validateNativeDiscovery(managedRoot), /toolCalls|missing/u);
});

test("requires measured states in both native retry status observations", () => {
  const valid = structuredClone(managedFixture);
  const phaseStates = [
    [2, "COMMITTED", "RETRY_RECOGNIZED"],
    [3, "RETRY_RECOGNIZED", "COMMITTED"],
  ];
  for (const [index, state] of phaseStates) {
    valid.toolCalls[index].resultObservation.state = state;
    refreshToolCallResultEvidence(valid.toolCalls[index]);
  }
  assert.doesNotThrow(() => validateManagedBrowserDiscovery(valid, { allowTestFixture: true }));

  for (const [index, , wrongState] of phaseStates) {
    const missing = structuredClone(valid);
    delete missing.toolCalls[index].resultObservation.state;
    refreshToolCallResultEvidence(missing.toolCalls[index]);
    assert.throws(() => validateManagedBrowserDiscovery(missing, { allowTestFixture: true }), /state|missing|unexpected/u, `missing state ${index}`);

    const wrong = structuredClone(valid);
    wrong.toolCalls[index].resultObservation.state = wrongState;
    refreshToolCallResultEvidence(wrong.toolCalls[index]);
    assert.throws(() => validateManagedBrowserDiscovery(wrong, { allowTestFixture: true }), /state|status|retry|committed/u, `wrong state ${index}`);
  }
});

test("rejects status-before-retry before visible confirmation", () => {
  const invalid = structuredClone(managedFixture);
  invalid.interactionSequence = [
    "check_existing_hotel_booking",
    "prepare_hotel_booking",
    "get_hotel_booking_status:before_retry",
    "visible_human_confirmation",
    "visible_retry",
    "get_hotel_booking_status:after_retry",
  ];
  assert.throws(() => validateManagedBrowserDiscovery(invalid, { allowTestFixture: true }), /interaction sequence|changed/u);
});

test("rejects a managed reconciliation that is not bound to the native status results", async () => {
  const oldChromeProof = structuredClone(legacyChromeProof);
  const mutations = [
    ["status-check state", (record) => { record.reconciliation.statusCheck.state = "RETRY_RECOGNIZED"; }],
    ["final-status state", (record) => { record.reconciliation.finalStatus.state = "COMMITTED"; }],
    ["status-check attempt", (record) => { record.reconciliation.statusCheck.attemptCount = 2; }],
    ["status-check confirmation", (record) => { record.reconciliation.statusCheck.confirmationNumber = "FKR-DIFFERENT"; }],
    ["final-status attempt", (record) => { record.reconciliation.finalStatus.attemptCount = 1; }],
    ["final-status booking key", (record) => { record.reconciliation.finalStatus.bookingId = "11111111-1111-5111-8111-111111111111"; }],
    [
      "prepare and status-before event chain",
      (record) => {
        const prepareCall = record.discovery.toolCalls[1];
        prepareCall.resultObservation.eventChainHead = record.discovery.toolCalls[2].resultObservation.eventChainHead;
        const summary = toolCallResultSummary(prepareCall);
        prepareCall.resultEvidence = {
          ...prepareCall.resultEvidence,
          canonicalSummary: canonicalResultSummary(summary),
          sha256: sha256CanonicalResultSummary(summary),
        };
      },
    ],
    ["shared tool sequence", (record) => { record.reconciliation.calledToolNames[1] = "get_hotel_booking_status"; }],
  ];
  for (const [name, mutate] of mutations) {
    const invalid = managedRootWithBoundReconciliation(oldChromeProof);
    mutate(invalid);
    assert.throws(() => validateNativeDiscovery(invalid), /bound|status|finalStatus|confirmation|booking|sequence|event|chain/u, name);
    assert.throws(() => browserObservationFrom(invalid, oldChromeProof.deployment.sourceCommit), /bound|status|finalStatus|confirmation|booking|sequence|event|chain/u, name);
  }
});

test("rejects a run binding whose UUIDv7 time differs from the recorded completion", () => {
  const invalid = managedRootWithBoundReconciliation(legacyChromeProof);
  const shiftedAt = "2026-08-30T19:50:43.313Z";
  invalid.identity.observedAt = shiftedAt;
  invalid.discovery.observedAt = shiftedAt;
  invalid.discovery.runBinding.completedAt = shiftedAt;
  invalid.reconciliation.observedAt = shiftedAt;
  assert.throws(() => validateNativeDiscovery(invalid), /UUID|timestamp|time/u);
});

test("candidate old branch keeps the strict Chrome configuration gate", async () => {
  const oldChromeProof = structuredClone(legacyChromeProof);
  oldChromeProof.discovery.requiredChromeFlags = ["#unmeasured-managed-profile"];
  assert.throws(() => validateNativeDiscovery(oldChromeProof), /browser flags/u);
});

test("candidate old browser observation remains unchanged", async () => {
  const oldChromeProof = structuredClone(legacyChromeProof);
  assert.deepEqual(browserObservationFrom(oldChromeProof, oldChromeProof.deployment.sourceCommit), legacyCandidateBrowserObservation);
});

// information_uuid_v5=a0fbdc59-0d0e-5134-89b8-1d30db405e5a
// event_uuid_v7=01a05559-c305-7e15-9f68-1fa524ea30bf
// state_transition=LIVE_CANDIDATE_BROWSER_OBSERVATION -> FROZEN_LEGACY_CANDIDATE_BROWSER_OBSERVATION occurred_at=2026-08-31T01:05:41.125Z
// machine-contract: legacy rejection stays pinned to the frozen legacy browser observation while the live candidate may be managed.
test("legacy Chrome rejects managed-only reconciliation fields", async () => {
  const storedCandidateEnvelope = JSON.parse(await readFile(new URL("../metadata/hotel-release-candidate.json", import.meta.url), "utf8"));
  for (const [phase, values] of Object.entries(legacyManagedFieldsByPhase)) {
    for (const [field, value] of Object.entries(values)) {
      const invalid = structuredClone(legacyChromeProof);
      invalid.reconciliation[phase][field] = value;
      assert.throws(() => validateNativeDiscovery(invalid), /legacy|unexpected|managed|reconciliation/u, `${phase}.${field}`);
      assert.throws(
        () => browserObservationFrom(invalid, legacyChromeProof.deployment.sourceCommit),
        /legacy|unexpected|managed|reconciliation/u,
        `candidate ${phase}.${field}`,
      );

      const candidateWithExtra = structuredClone(storedCandidateEnvelope);
      candidateWithExtra.browserObservation = structuredClone(legacyCandidateBrowserObservation);
      candidateWithExtra.browserObservation.reconciliation[phase][field] = value;
      assert.throws(
        () => compareStable(candidateWithExtra, candidateWithExtra),
        /legacy|unexpected|managed|reconciliation/u,
        `stored candidate ${phase}.${field}`,
      );
    }
  }
  assert.doesNotThrow(() => validateNativeDiscovery(legacyChromeProof));
  assert.deepEqual(browserObservationFrom(legacyChromeProof, legacyChromeProof.deployment.sourceCommit), legacyCandidateBrowserObservation);
});

test("the CLI comparison rejects stored managed candidates with unrelated reconciliation values", async () => {
  const expected = JSON.parse(await readFile(new URL("../metadata/hotel-release-candidate.json", import.meta.url), "utf8"));
  const nativeFixture = managedRootWithBoundReconciliation(legacyChromeProof);
  expected.browserObservation = browserObservationFrom(nativeFixture, expected.source.commit);
  assert.doesNotThrow(() => compareStable(structuredClone(expected), expected));
  const changedObservationTime = structuredClone(expected);
  changedObservationTime.observedAt = new Date(Date.parse(expected.observedAt) + 1).toISOString();
  assert.throws(() => compareStable(changedObservationTime, expected), /candidate observation time differs from native evidence/u);
  for (const location of ["statusCheck", "finalStatus"]) {
    for (const field of ["state", "intentId", "fingerprint", "bookingId", "eventCount", "eventChainHead"]) {
      const actual = structuredClone(expected);
      actual.browserObservation.reconciliation[location][field] = field === "state"
        ? location === "statusCheck" ? "RETRY_RECOGNIZED" : "COMMITTED"
        : field === "eventCount"
          ? 999
          : field === "eventChainHead" ? "e".repeat(64) : "11111111-1111-5111-8111-111111111111";
      assert.throws(() => compareStable(actual, expected), /native browser observation record drifted/u, `${location}.${field}`);
    }
  }
});

test("accepts managed native and candidate fixtures through the Draft 2020-12 registry", async () => {
  const nativePositive = managedRootWithBoundReconciliation(legacyChromeProof);
  nativePositive.$schema = "../schemas/hotel-native-webmcp-reconciliation.schema.json";
  const candidatePositive = browserObservationFrom(nativePositive, nativePositive.deployment.sourceCommit);
  const legacyNativePositive = structuredClone(legacyChromeProof);
  legacyNativePositive.$schema = "../schemas/hotel-native-webmcp-reconciliation.schema.json";
  const legacyCandidatePositive = structuredClone(legacyCandidateBrowserObservation);
  const nativeMissingBinding = structuredClone(nativePositive);
  delete nativeMissingBinding.discovery.runBinding;
  const candidateMissingPrepareObservation = structuredClone(candidatePositive);
  delete candidateMissingPrepareObservation.managedDiscovery.toolCalls[1].resultObservation;
  const phaseMismatchCases = [
    ["native-status-before-reconciliation-state", (record) => { record.reconciliation.statusCheck.state = "RETRY_RECOGNIZED"; }],
    ["native-status-after-reconciliation-state", (record) => { record.reconciliation.finalStatus.state = "COMMITTED"; }],
    ["native-status-before-observation-state", (record) => { record.discovery.toolCalls[2].resultObservation.state = "RETRY_RECOGNIZED"; }],
    ["native-status-before-observation-missing-state", (record) => { delete record.discovery.toolCalls[2].resultObservation.state; }],
    ["native-status-after-observation-state", (record) => { record.discovery.toolCalls[3].resultObservation.state = "COMMITTED"; }],
    ["native-status-after-observation-missing-state", (record) => { delete record.discovery.toolCalls[3].resultObservation.state; }],
    ["native-status-before-attempt-two", (record) => { record.discovery.toolCalls[2].resultObservation.attemptCount = 2; }],
    ["native-status-before-event-four", (record) => { record.discovery.toolCalls[2].resultObservation.eventCount = 4; }],
    ["native-status-after-attempt-one", (record) => { record.discovery.toolCalls[3].resultObservation.attemptCount = 1; }],
    ["native-status-after-event-one", (record) => { record.discovery.toolCalls[3].resultObservation.eventCount = 1; }],
  ];
  const managedReconciliationFields = ["state", "intentId", "fingerprint", "bookingId", "eventCount", "eventChainHead"];
  const managedBindingCases = [];
  const legacyFieldCases = [];
  for (const [phase, values] of Object.entries(legacyManagedFieldsByPhase)) {
    for (const [field, value] of Object.entries(values)) {
      const invalidNative = structuredClone(legacyNativePositive);
      invalidNative.reconciliation[phase][field] = value;
      legacyFieldCases.push({ name: `legacy-native-${phase}-${field}`, schemaName: "native", instance: invalidNative });
      const invalidCandidate = structuredClone(legacyCandidatePositive);
      invalidCandidate.reconciliation[phase][field] = value;
      legacyFieldCases.push({ name: `legacy-candidate-${phase}-${field}`, schemaName: "candidateLegacyObservation", instance: invalidCandidate });
    }
  }
  const candidateStateCases = ["statusCheck", "finalStatus"].map((location) => {
    const invalid = structuredClone(candidatePositive);
    invalid.reconciliation[location].state = location === "statusCheck" ? "RETRY_RECOGNIZED" : "COMMITTED";
    return { name: `candidate-managed-${location}-wrong-state`, schemaName: "candidateManagedObservation", instance: invalid };
  });
  for (const location of ["statusCheck", "finalStatus"]) {
    for (const field of managedReconciliationFields) {
      const nativeMissingField = structuredClone(nativePositive);
      delete nativeMissingField.reconciliation[location][field];
      managedBindingCases.push({
        name: `native-managed-${location}-missing-${field}`,
        schemaName: "native",
        instance: nativeMissingField,
        field,
      });
      const candidateMissingField = structuredClone(candidatePositive);
      delete candidateMissingField.reconciliation[location][field];
      managedBindingCases.push({
        name: `candidate-managed-${location}-missing-${field}`,
        schemaName: "candidateManagedObservation",
        instance: candidateMissingField,
        field,
      });
    }
  }

  const results = await validateWithDraft202012Registry([
    { name: "native-positive", schemaName: "native", instance: nativePositive },
    { name: "candidate-positive", schemaName: "candidateManagedObservation", instance: candidatePositive },
    { name: "legacy-native-positive", schemaName: "native", instance: legacyNativePositive },
    { name: "legacy-candidate-positive", schemaName: "candidateLegacyObservation", instance: legacyCandidatePositive },
    { name: "native-missing-run-binding", schemaName: "native", instance: nativeMissingBinding },
    { name: "candidate-missing-prepare-observation", schemaName: "candidateManagedObservation", instance: candidateMissingPrepareObservation },
    ...phaseMismatchCases.map(([name, mutate]) => {
      const invalid = structuredClone(nativePositive);
      mutate(invalid);
      return { name, schemaName: "native", instance: invalid };
    }),
    ...managedBindingCases,
    ...legacyFieldCases,
    ...candidateStateCases,
  ]);
  const byName = new Map(results.map((result) => [result.name, result]));
  assert.deepEqual(byName.get("native-positive")?.errors, []);
  assert.deepEqual(byName.get("candidate-positive")?.errors, []);
  assert.deepEqual(byName.get("legacy-native-positive")?.errors, []);
  assert.deepEqual(byName.get("legacy-candidate-positive")?.errors, []);
  assert(byName.get("native-missing-run-binding")?.errors.some((error) => schemaErrorExists(error, "required", "runBinding")));
  assert(
    byName.get("candidate-missing-prepare-observation")?.errors.some((error) => schemaErrorExists(error, "required", "resultObservation")),
  );
  for (const [name] of phaseMismatchCases) {
    assert(byName.get(name)?.errors.length > 0, `${name} unexpectedly passed the native schema`);
  }
  for (const { name } of candidateStateCases) {
    assert(byName.get(name)?.errors.some((error) => schemaErrorExists(error, "const", "state")), `${name} unexpectedly passed the candidate schema`);
  }
  for (const { name, field } of managedBindingCases) {
    assert(
      byName.get(name)?.errors.some((error) => schemaErrorExists(error, "required", field)),
      `${name} unexpectedly passed the managed reconciliation schema`,
    );
  }
  for (const { name } of legacyFieldCases) {
    assert(byName.get(name)?.errors.length > 0, `${name} unexpectedly passed the legacy schema`);
  }
});

const rejectingCases = [
  ["requires an observed initial check state", (record) => delete record.toolCalls[0].resultObservation, /check|resultObservation|missing/u],
  [
    "rejects a non-empty initial check state",
    (record) => {
      record.toolCalls[0].resultObservation.bookingExists = true;
    },
    /initial|booking|empty/u,
  ],
  ["requires an executed fetchTools call", (record) => delete record.fetchToolsCall, /fetchTools|unexpected|missing/u],
  ["rejects a declaration-only tool list", (record) => delete record.toolCalls, /toolCalls|unexpected|missing/u],
  ["rejects duplicate tools", (record) => record.fetchToolsCall.returnedToolNames.push("prepare_hotel_booking"), /changed|tool/u],
  [
    "rejects a forbidden tool",
    (record) => {
      record.toolCalls[0].toolName = "confirm_hotel_booking";
    },
    /tool|forbidden/u,
  ],
  [
    "rejects a failed native result",
    (record) => {
      record.toolCalls[0].resultStatus = "FAILED";
    },
    /succeed|SUCCESS/u,
  ],
  ["rejects a missing status-before-retry observation", (record) => delete record.toolCalls[2].resultObservation, /unexpected|missing|status/u],
  [
    "requires an observed prepare state",
    (record) => delete record.toolCalls[1].resultObservation,
    /prepare|resultObservation|missing/u,
  ],
  [
    "rejects a preparation bound to a different intent",
    (record) => {
      record.toolCalls[1].resultObservation.intentId = "11111111-1111-5111-8111-111111111111";
    },
    /prepare|intent|fingerprint|bound/u,
  ],
  [
    "rejects a different confirmation number",
    (record) => {
      record.toolCalls[3].resultObservation.confirmationNumber = "FKR-DIFFERENT";
    },
    /confirmation/u,
  ],
  [
    "rejects an additional effect",
    (record) => {
      record.toolCalls[3].resultObservation.effectStartCount = 2;
    },
    /effectStartCount|one/u,
  ],
  [
    "rejects a guessed browser version",
    (record) => {
      record.configurationObservation.browserVersion.status = "PASS";
    },
    /UNMEASURED|browserVersion|configuration/u,
  ],
  [
    "rejects a guessed document model context",
    (record) => {
      record.configurationObservation.documentModelContext.status = "PASS";
    },
    /UNMEASURED|documentModelContext|configuration/u,
  ],
  [
    "rejects Chrome fields copied into the managed proof",
    (record) => {
      record.configurationObservation.chromeFlags = ["#devtools-webmcp-support"];
    },
    /configuration|unexpected|Chrome/u,
  ],
  [
    "rejects a guessed zero for an unmeasured external effect",
    (record) => {
      record.effectObservation.unmeasuredFields = ["permissionRequests", "notifications"];
    },
    /unmeasured|external/u,
  ],
  [
    "rejects a digest without an explicit basis",
    (record) => {
      record.fetchToolsCall.resultEvidence.basis = "EXPECTED_TOOL_NAMES_JSON";
    },
    /basis|digest/u,
  ],
  [
    "rejects a stale canonical result summary",
    (record) => {
      record.fetchToolsCall.resultEvidence.canonicalSummary = "{}";
    },
    /canonicalSummary|observed result/u,
  ],
  [
    "rejects a stale canonical result digest",
    (record) => {
      record.fetchToolsCall.resultEvidence.sha256 = "f".repeat(64);
    },
    /sha256|canonicalSummary/u,
  ],
  [
    "rejects an unsupported raw result attestation basis",
    (record) => {
      record.fetchToolsCall.resultEvidence.basis = "NATIVE_FETCH_RESULT_CANONICAL_BYTES";
    },
    /basis|digest/u,
  ],
];

for (const [name, mutate, errorPattern] of rejectingCases) {
  test(name, () => {
    const invalid = structuredClone(managedFixture);
    mutate(invalid);
    assert.throws(() => validateManagedBrowserDiscovery(invalid, { allowTestFixture: true }), errorPattern);
  });
}

assert.deepEqual(
  managedFixture.toolCalls.map((call) => call.phase),
  expectedCallPhases,
);
assert.deepEqual(managedFixture.interactionSequence, expectedInteractionSequence);

test("executes the candidate validator through a symlink", async () => {
  const testRoot = await mkdtemp(join(tmpdir(), "hotel-candidate-entrypoint-"));
  const link = join(testRoot, "validate-candidate.mjs");
  const target = fileURLToPath(new URL("./validate_hotel_release_candidate.mjs", import.meta.url));
  try {
    await symlink(target, link);
    const result = spawnSync(process.execPath, [link, "--symlink-entrypoint-check"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.error, undefined, `symlink candidate process failed to start: ${result.error?.message ?? "unknown error"}`);
    assert.equal(result.signal, null, "symlink candidate process exceeded its timeout");
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.notEqual(result.status, 0, "a symlink invocation must enter the candidate CLI guard");
    assert.match(output, /use --write or --check/u);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

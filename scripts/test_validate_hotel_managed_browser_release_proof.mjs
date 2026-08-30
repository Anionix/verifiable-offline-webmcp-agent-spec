#!/usr/bin/env node
// information_uuid_v5=a0fbdc59-0d0e-5134-89b8-1d30db405e5a
// event_uuid_v7=01a05439-6770-7ee3-a4cf-7ac7d7ea90ef
// state_transition=MANAGED_NATIVE_CAPABILITY_UNTESTED -> MANAGED_NATIVE_CAPABILITY_REGRESSION_GATES occurred_at=2026-08-30T19:50:43.312Z
// machine-contract: test-only managed evidence proves an executed native
// capability fetch and four-call retry ordering without creating a production
// synthetic status or changing the old Chrome proof.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  expectedCallPhases,
  expectedInteractionSequence,
  expectedTools,
  forbiddenTools,
  managedEvidenceProfile,
  validateManagedBrowserDiscovery,
} from "./hotel-managed-browser-release-proof.mjs";
import { browserObservationFrom, validateNativeDiscovery } from "./validate_hotel_release_candidate.mjs";

const observedAt = "2026-08-30T19:50:43.312Z";
const confirmationNumber = "FKR-SYNTHETIC214";
const summaryHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function resultEvidence(description) {
  return {
    sha256: summaryHash,
    basis: "TEST_FIXTURE_SUMMARY",
    description,
  };
}

function toolCall(sequence, phase, toolName, resultObservation) {
  const call = {
    sequence,
    phase,
    method: "webmcp.capability.tool.call",
    toolName,
    status: "EXECUTED",
    resultStatus: "SUCCESS",
    resultEvidence: resultEvidence(`Test-only summary for native ${phase} result.`),
  };
  if (resultObservation) call.resultObservation = resultObservation;
  return call;
}

const managedFixture = {
  profile: managedEvidenceProfile,
  status: "TEST_FIXTURE",
  observedAt,
  surface: "MANAGED_IAB_NATIVE_CAPABILITY",
  fetchToolsCall: {
    sequence: 1,
    method: "webmcp.capability.fetchTools().call",
    status: "EXECUTED",
    resultStatus: "SUCCESS",
    returnedToolNames: [...expectedTools],
    forbiddenToolNames: [...forbiddenTools],
    resultEvidence: resultEvidence("Test-only summary hash for the native fetch result."),
  },
  visibleToolNames: [...expectedTools],
  forbiddenToolNames: [...forbiddenTools],
  toolCalls: [
    toolCall(1, expectedCallPhases[0], expectedTools[0]),
    toolCall(2, expectedCallPhases[1], expectedTools[1]),
    toolCall(3, expectedCallPhases[2], expectedTools[2], {
      attemptCount: 1,
      bookingExists: true,
      effectStartCount: 1,
      events: ["STATUS_READ", "EXISTING_RESULT_FOUND"],
      confirmationNumber,
    }),
    toolCall(4, expectedCallPhases[3], expectedTools[2], {
      attemptCount: 2,
      bookingExists: true,
      effectStartCount: 1,
      events: ["RETRY_RECOGNIZED"],
      confirmationNumber,
    }),
  ],
  interactionSequence: [...expectedInteractionSequence],
  effectObservation: {
    status: "LIMITED",
    scope: "NATIVE_CAPABILITY_RESULT_FIELDS_ONLY",
    observedFields: ["attemptCount", "bookingExists", "effectStartCount", "events"],
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
  const oldChromeProof = JSON.parse(await readFile(new URL("../metadata/hotel-native-webmcp-reconciliation.json", import.meta.url), "utf8"));
  assert.throws(() => validateManagedBrowserDiscovery(oldChromeProof.discovery), /profile|unexpected|managed/u);
  assert.equal(oldChromeProof.discovery.documentModelContext, "CONFIRMED_PRESENT");
  assert.deepEqual(oldChromeProof.discovery.requiredChromeFlags, ["#devtools-webmcp-support", "#enable-webmcp-testing"]);
});

test("uses the existing native evidence root for the managed discovery branch", async () => {
  const oldChromeProof = JSON.parse(await readFile(new URL("../metadata/hotel-native-webmcp-reconciliation.json", import.meta.url), "utf8"));
  const managedRoot = structuredClone(oldChromeProof);
  managedRoot.discovery = { ...structuredClone(managedFixture), status: "PASS" };
  validateManagedBrowserDiscovery(managedRoot.discovery, { allowTestFixture: true });
  assert.deepEqual(managedRoot.deployment, oldChromeProof.deployment);
  assert.deepEqual(managedRoot.reconciliation, oldChromeProof.reconciliation);
  assert.deepEqual(managedRoot.recording, oldChromeProof.recording);
});

test("candidate build accepts managed discovery without requiring Chrome configuration", async () => {
  const oldChromeProof = JSON.parse(await readFile(new URL("../metadata/hotel-native-webmcp-reconciliation.json", import.meta.url), "utf8"));
  const managedRoot = structuredClone(oldChromeProof);
  managedRoot.discovery = productionShapedManagedFixture();
  validateNativeDiscovery(managedRoot);
  const browserObservation = browserObservationFrom(managedRoot, oldChromeProof.deployment.sourceCommit);
  assert.equal(browserObservation.profile, managedEvidenceProfile);
  assert.deepEqual(browserObservation.managedDiscovery, managedRoot.discovery);
  assert.equal(Object.hasOwn(browserObservation, "requiredChromeFlags"), false);
  assert.deepEqual(browserObservation.visibleToolNames, expectedTools);
  assert.deepEqual(browserObservation.forbiddenToolNames, forbiddenTools);
});

test("candidate managed branch rejects a declaration-only discovery", async () => {
  const oldChromeProof = JSON.parse(await readFile(new URL("../metadata/hotel-native-webmcp-reconciliation.json", import.meta.url), "utf8"));
  const managedRoot = structuredClone(oldChromeProof);
  managedRoot.discovery = productionShapedManagedFixture();
  delete managedRoot.discovery.toolCalls;
  assert.throws(() => validateNativeDiscovery(managedRoot), /toolCalls|missing/u);
});

test("candidate old branch keeps the strict Chrome configuration gate", async () => {
  const oldChromeProof = JSON.parse(await readFile(new URL("../metadata/hotel-native-webmcp-reconciliation.json", import.meta.url), "utf8"));
  oldChromeProof.discovery.requiredChromeFlags = ["#unmeasured-managed-profile"];
  assert.throws(() => validateNativeDiscovery(oldChromeProof), /browser flags/u);
});

test("candidate old browser observation remains unchanged", async () => {
  const oldChromeProof = JSON.parse(await readFile(new URL("../metadata/hotel-native-webmcp-reconciliation.json", import.meta.url), "utf8"));
  const candidate = JSON.parse(await readFile(new URL("../metadata/hotel-release-candidate.json", import.meta.url), "utf8"));
  assert.deepEqual(browserObservationFrom(oldChromeProof, candidate.source.commit), candidate.browserObservation);
});

const rejectingCases = [
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

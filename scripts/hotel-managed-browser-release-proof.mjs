#!/usr/bin/env node
// information_uuid_v5=a0fbdc59-0d0e-5134-89b8-1d30db405e5a
// event_uuid_v7=01a05439-6770-7ee3-a4cf-7ac7d7ea90ef
// state_transition=MANAGED_NATIVE_CAPABILITY_UNTESTED -> MANAGED_NATIVE_CAPABILITY_VALIDATED occurred_at=2026-08-30T19:50:43.312Z
// machine-contract: validate only the managed discovery branch; source, release,
// reconciliation, recording, and digest gates remain owned by existing validators.

import assert from "node:assert/strict";

export const managedEvidenceProfile = "MANAGED_IAB_NATIVE_CAPABILITY_V1";
export const expectedTools = Object.freeze(["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status", "preview_hotel_cancellation"]);
export const forbiddenTools = Object.freeze(["confirm_hotel_booking", "pay_for_hotel_booking", "cancel_hotel_booking"]);
export const expectedCallPhases = Object.freeze(["check", "prepare", "status_before_retry", "status_after_retry"]);
export const unmeasuredExternalEffects = Object.freeze(["externalRequests", "permissionRequests", "notifications"]);
export const observedCapabilityResultFields = Object.freeze(["attemptCount", "bookingExists", "effectStartCount", "events"]);
export const expectedInteractionSequence = Object.freeze([
  "check_existing_hotel_booking",
  "prepare_hotel_booking",
  "get_hotel_booking_status:before_retry",
  "visible_human_confirmation",
  "visible_retry",
  "get_hotel_booking_status:after_retry",
]);

const nativeFetchMethod = "webmcp.capability.fetchTools().call";
const configurationKeys = Object.freeze(["browserVersion", "launchArguments", "documentModelContext", "requiredChromeFlags", "devtoolsWebmcpCategory"]);
const productionSummaryHashBases = new Set(["NATIVE_FETCH_RESULT_CANONICAL_BYTES", "EXPLICIT_SUMMARY_HASH"]);

function assertExactKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} has an unexpected or missing field`);
}

function assertExactArray(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} changed`);
}

function assertSha256(value, label) {
  assert.match(value, /^[0-9a-f]{64}$/u, `${label} must be a SHA-256 digest`);
}

function assertObservedAt(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u, "managed discovery observedAt must use UTC milliseconds");
  assert(Number.isFinite(Date.parse(value)), "managed discovery observedAt must be a date");
}

function assertResultEvidence(value, label, allowTestFixture) {
  assertExactKeys(value, ["sha256", "basis", "description"], label);
  assertSha256(value.sha256, `${label}.sha256`);
  const allowedBases = allowTestFixture ? new Set([...productionSummaryHashBases, "TEST_FIXTURE_SUMMARY"]) : productionSummaryHashBases;
  assert(allowedBases.has(value.basis), `${label}.basis must identify measured result bytes or an explicit summary hash`);
  assert(typeof value.description === "string" && value.description.length >= 20, `${label}.description must explain the digest basis`);
}

function assertConfigurationObservation(value) {
  assertExactKeys(value, configurationKeys, "managed discovery configurationObservation");
  for (const key of configurationKeys) {
    assertExactKeys(value[key], ["status", "reasonCode"], `configurationObservation.${key}`);
    assert.equal(value[key].status, "UNMEASURED", `configurationObservation.${key} must remain UNMEASURED`);
    assert.match(value[key].reasonCode, /^[A-Z][A-Z0-9_]+$/u, `configurationObservation.${key}.reasonCode must be explicit`);
  }
}

function assertEffectObservation(value) {
  assertExactKeys(value, ["status", "scope", "observedFields", "unmeasuredFields", "reasonCode"], "managed discovery effectObservation");
  assert.equal(value.status, "LIMITED");
  assert.equal(value.scope, "NATIVE_CAPABILITY_RESULT_FIELDS_ONLY");
  assertExactArray(value.observedFields, observedCapabilityResultFields, "managed capability observed result fields");
  assertExactArray(value.unmeasuredFields, unmeasuredExternalEffects, "managed capability unmeasured external effects");
  assert.equal(value.reasonCode, "CDP_NETWORK_EVENTS_NOT_CAPTURED");
}

function assertStatusObservation(value, expectedAttemptCount, expectedConfirmation, label) {
  assertExactKeys(value, ["attemptCount", "bookingExists", "effectStartCount", "events", "confirmationNumber"], label);
  assert.equal(value.attemptCount, expectedAttemptCount, `${label}.attemptCount changed`);
  assert.equal(value.bookingExists, true, `${label}.bookingExists must be true`);
  assert.equal(value.effectStartCount, 1, `${label}.effectStartCount must remain one`);
  assert(Array.isArray(value.events) && value.events.length > 0, `${label}.events must be recorded`);
  for (const event of value.events) assert(typeof event === "string" && event.length > 0, `${label}.events must contain names`);
  assert.match(value.confirmationNumber, /^FKR-[A-Z0-9]+$/u, `${label}.confirmationNumber is invalid`);
  assert.equal(value.confirmationNumber, expectedConfirmation, `${label}.confirmationNumber differs from the shared result`);
}

function assertToolCalls(value, allowTestFixture) {
  assert(Array.isArray(value) && value.length === expectedCallPhases.length, "managed discovery must record four native tool calls");
  const actualPhases = value.map((call) => call.phase);
  assertExactArray(actualPhases, expectedCallPhases, "managed discovery call phases");
  for (const [index, call] of value.entries()) {
    const requiredKeys = ["sequence", "phase", "method", "toolName", "status", "resultStatus", "resultEvidence"];
    if (call.phase === "status_before_retry" || call.phase === "status_after_retry") requiredKeys.push("resultObservation");
    assertExactKeys(call, requiredKeys, `managed discovery toolCalls[${index}]`);
    assert.equal(call.sequence, index + 1, `managed discovery toolCalls[${index}].sequence changed`);
    assert.equal(call.method, "webmcp.capability.tool.call", `managed discovery toolCalls[${index}].method changed`);
    const expectedName = call.phase === "check" ? expectedTools[0] : call.phase === "prepare" ? expectedTools[1] : expectedTools[2];
    assert.equal(call.toolName, expectedName, `managed discovery toolCalls[${index}].toolName changed`);
    assert(!forbiddenTools.includes(call.toolName), `managed discovery called forbidden tool ${call.toolName}`);
    assert.equal(call.status, "EXECUTED", `managed discovery toolCalls[${index}] was not executed`);
    assert.equal(call.resultStatus, "SUCCESS", `managed discovery toolCalls[${index}] did not succeed`);
    assertResultEvidence(call.resultEvidence, `managed discovery toolCalls[${index}].resultEvidence`, allowTestFixture);
    if (call.phase === "status_before_retry") {
      assertStatusObservation(call.resultObservation, 1, value[2].resultObservation.confirmationNumber, "status_before_retry.resultObservation");
    }
    if (call.phase === "status_after_retry") {
      assertStatusObservation(call.resultObservation, 2, value[2].resultObservation.confirmationNumber, "status_after_retry.resultObservation");
    }
  }
}

export function validateManagedBrowserDiscovery(discovery, { allowTestFixture = false } = {}) {
  assertExactKeys(
    discovery,
    [
      "profile",
      "status",
      "observedAt",
      "surface",
      "fetchToolsCall",
      "visibleToolNames",
      "forbiddenToolNames",
      "toolCalls",
      "interactionSequence",
      "effectObservation",
      "configurationObservation",
    ],
    "managed browser discovery",
  );
  assert.equal(discovery.profile, managedEvidenceProfile);
  const allowedStatuses = allowTestFixture ? new Set(["PASS", "TEST_FIXTURE"]) : new Set(["PASS"]);
  assert(allowedStatuses.has(discovery.status), "managed discovery status must be PASS outside tests");
  assertObservedAt(discovery.observedAt);
  assert.equal(discovery.surface, "MANAGED_IAB_NATIVE_CAPABILITY");
  assertExactArray(discovery.visibleToolNames, expectedTools, "managed discovery visible tools");
  assertExactArray(discovery.forbiddenToolNames, forbiddenTools, "managed discovery forbidden tools");
  assertExactArray(discovery.interactionSequence, expectedInteractionSequence, "managed discovery interaction sequence");
  assertExactKeys(
    discovery.fetchToolsCall,
    ["sequence", "method", "status", "resultStatus", "returnedToolNames", "forbiddenToolNames", "resultEvidence"],
    "managed discovery fetchToolsCall",
  );
  assert.equal(discovery.fetchToolsCall.sequence, 1);
  assert.equal(discovery.fetchToolsCall.method, nativeFetchMethod);
  assert.equal(discovery.fetchToolsCall.status, "EXECUTED");
  assert.equal(discovery.fetchToolsCall.resultStatus, "SUCCESS");
  assertExactArray(discovery.fetchToolsCall.returnedToolNames, expectedTools, "managed fetchTools returned tools");
  assertExactArray(discovery.fetchToolsCall.forbiddenToolNames, forbiddenTools, "managed fetchTools forbidden tools");
  assertResultEvidence(discovery.fetchToolsCall.resultEvidence, "managed discovery fetchToolsCall.resultEvidence", allowTestFixture);
  assertToolCalls(discovery.toolCalls, allowTestFixture);
  assertEffectObservation(discovery.effectObservation);
  assertConfigurationObservation(discovery.configurationObservation);
  const before = discovery.toolCalls[2].resultObservation;
  const after = discovery.toolCalls[3].resultObservation;
  assert.equal(before.confirmationNumber, after.confirmationNumber, "status-before and status-after confirmation numbers differ");
  return {
    evidenceProfile: discovery.profile,
    status: discovery.status,
    executedToolCalls: discovery.toolCalls.length,
    unmeasuredExternalEffects: [...discovery.effectObservation.unmeasuredFields],
  };
}

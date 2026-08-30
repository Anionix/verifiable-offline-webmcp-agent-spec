#!/usr/bin/env node
// information_uuid_v5=a0fbdc59-0d0e-5134-89b8-1d30db405e5a
// event_uuid_v7=01a05439-6770-7ee3-a4cf-7ac7d7ea90ef
// state_transition=MANAGED_NATIVE_CAPABILITY_UNTESTED -> MANAGED_NATIVE_CAPABILITY_VALIDATED occurred_at=2026-08-30T19:50:43.312Z
// machine-contract: validate only the managed discovery branch; source, release,
// reconciliation, recording, and digest gates remain owned by existing validators.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const managedEvidenceProfile = "MANAGED_IAB_NATIVE_CAPABILITY_V1";
export const expectedTools = Object.freeze(["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status", "preview_hotel_cancellation"]);
export const forbiddenTools = Object.freeze(["confirm_hotel_booking", "pay_for_hotel_booking", "cancel_hotel_booking"]);
export const expectedCallPhases = Object.freeze(["check", "prepare", "status_before_retry", "status_after_retry"]);
export const unmeasuredExternalEffects = Object.freeze(["externalRequests", "permissionRequests", "notifications"]);
export const observedCapabilityResultFields = Object.freeze(["attemptCount", "bookingExists", "effectStartCount", "eventCount", "eventChainHead"]);
export const expectedInteractionSequence = Object.freeze([
  "check_existing_hotel_booking",
  "prepare_hotel_booking",
  "visible_human_confirmation",
  "get_hotel_booking_status:before_retry",
  "visible_retry",
  "get_hotel_booking_status:after_retry",
]);

const nativeFetchMethod = "webmcp.capability.fetchTools().call";
const configurationKeys = Object.freeze(["browserVersion", "launchArguments", "documentModelContext", "requiredChromeFlags", "devtoolsWebmcpCategory"]);
const productionSummaryHashBases = new Set(["EXPLICIT_SUMMARY_HASH"]);

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortForCanonicalJson(value[key])]));
  }
  return value;
}

export function canonicalResultSummary(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

export function sha256CanonicalResultSummary(value) {
  return createHash("sha256").update(canonicalResultSummary(value), "utf8").digest("hex");
}

function sha256CanonicalString(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

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

function assertUuidV5(value, label) {
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u, `${label} must be a UUIDv5`);
}

function assertUuidV7(value, label) {
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u, `${label} must be a UUIDv7`);
}

function uuidV7Timestamp(value) {
  return Number.parseInt(value.replaceAll("-", "").slice(0, 12), 16);
}

function assertObservedAt(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u, "managed discovery observedAt must use UTC milliseconds");
  assert(Number.isFinite(Date.parse(value)), "managed discovery observedAt must be a date");
}

function assertResultEvidence(value, expectedSummary, label, allowTestFixture) {
  assertExactKeys(value, ["sha256", "basis", "canonicalSummary", "scope", "description"], label);
  assertSha256(value.sha256, `${label}.sha256`);
  const allowedBases = allowTestFixture ? new Set([...productionSummaryHashBases, "TEST_FIXTURE_SUMMARY"]) : productionSummaryHashBases;
  assert(allowedBases.has(value.basis), `${label}.basis must identify measured result bytes or an explicit summary hash`);
  assert.equal(value.scope, "EXPLICIT_SUMMARY_ONLY_NOT_RAW_ATTESTATION", `${label}.scope must not claim raw native attestation`);
  assert.equal(value.canonicalSummary, canonicalResultSummary(expectedSummary), `${label}.canonicalSummary does not match the observed result`);
  assert.equal(value.sha256, sha256CanonicalString(value.canonicalSummary), `${label}.sha256 does not match canonicalSummary`);
  assert(typeof value.description === "string" && value.description.length >= 20, `${label}.description must explain the digest basis`);
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

function assertConfigurationObservation(value) {
  assertExactKeys(value, configurationKeys, "managed discovery configurationObservation");
  for (const key of configurationKeys) {
    assertExactKeys(value[key], ["status", "reasonCode"], `configurationObservation.${key}`);
    assert.equal(value[key].status, "UNMEASURED", `configurationObservation.${key} must remain UNMEASURED`);
    assert.match(value[key].reasonCode, /^[A-Z][A-Z0-9_]+$/u, `configurationObservation.${key}.reasonCode must be explicit`);
  }
}

function assertRunBinding(value, observedAt) {
  assertExactKeys(value, ["rootObservationUuidV7", "completedAt", "publicSourceCommit", "deploymentId", "publicUrl", "recordingSha256"], "managed discovery runBinding");
  assertUuidV7(value.rootObservationUuidV7, "managed discovery runBinding.rootObservationUuidV7");
  assertObservedAt(value.completedAt);
  assert.equal(value.completedAt, observedAt, "managed discovery runBinding.completedAt differs from discovery.observedAt");
  assert.equal(
    uuidV7Timestamp(value.rootObservationUuidV7),
    Date.parse(value.completedAt),
    "managed discovery runBinding UUIDv7 time differs from completedAt",
  );
  assert.match(value.publicSourceCommit, /^[0-9a-f]{40}$/u, "managed discovery runBinding.publicSourceCommit must be a commit");
  assert.match(value.deploymentId, /^dpl_[A-Za-z0-9]+$/u, "managed discovery runBinding.deploymentId is invalid");
  assert.match(value.publicUrl, /^https:\/\/[^\s]+$/u, "managed discovery runBinding.publicUrl must be HTTPS");
  assertSha256(value.recordingSha256, "managed discovery runBinding.recordingSha256");
}

function assertEffectObservation(value) {
  assertExactKeys(value, ["status", "scope", "observedFields", "unmeasuredFields", "reasonCode"], "managed discovery effectObservation");
  assert.equal(value.status, "LIMITED");
  assert.equal(value.scope, "NATIVE_CAPABILITY_RESULT_FIELDS_ONLY");
  assertExactArray(value.observedFields, observedCapabilityResultFields, "managed capability observed result fields");
  assertExactArray(value.unmeasuredFields, unmeasuredExternalEffects, "managed capability unmeasured external effects");
  assert.equal(value.reasonCode, "CDP_NETWORK_EVENTS_NOT_CAPTURED");
}

function assertInitialCheckObservation(value) {
  assertExactKeys(value, ["attemptCount", "bookingExists", "effectStartCount", "eventCount", "fingerprint"], "managed initial check resultObservation");
  assert.equal(value.attemptCount, 0, "managed initial check attemptCount must be zero");
  assert.equal(value.bookingExists, false, "managed initial check must find no booking");
  assert.equal(value.effectStartCount, 0, "managed initial check must have no effect start");
  assert.equal(value.eventCount, 0, "managed initial check must have no events");
  assertUuidV5(value.fingerprint, "managed initial check fingerprint");
}

function assertPrepareObservation(value) {
  assertExactKeys(
    value,
    ["state", "attemptCount", "bookingExists", "effectStartCount", "eventCount", "eventChainHead", "intentId", "fingerprint"],
    "managed prepare resultObservation",
  );
  assert.equal(value.state, "PREPARED", "managed prepare state must be PREPARED");
  assert.equal(value.attemptCount, 1, "managed prepare attemptCount must be one");
  assert.equal(value.bookingExists, false, "managed prepare must not report a booking");
  assert.equal(value.effectStartCount, 0, "managed prepare must not start an effect");
  assert.equal(value.eventCount, 1, "managed prepare must record its preparation event");
  assertSha256(value.eventChainHead, "managed prepare eventChainHead");
  assertUuidV5(value.intentId, "managed prepare intentId");
  assertUuidV5(value.fingerprint, "managed prepare fingerprint");
  assert.equal(value.intentId, value.fingerprint, "managed prepare intentId and fingerprint differ");
}

function assertStatusObservation(value, expectedAttemptCount, expectedEventCount, label) {
  assertExactKeys(
    value,
    ["attemptCount", "bookingExists", "effectStartCount", "eventCount", "eventChainHead", "intentId", "fingerprint", "bookingId", "confirmationNumber"],
    label,
  );
  assert.equal(value.attemptCount, expectedAttemptCount, `${label}.attemptCount changed`);
  assert.equal(value.bookingExists, true, `${label}.bookingExists must be true`);
  assert.equal(value.effectStartCount, 1, `${label}.effectStartCount must remain one`);
  assert.equal(value.eventCount, expectedEventCount, `${label}.eventCount changed`);
  assertSha256(value.eventChainHead, `${label}.eventChainHead`);
  assertUuidV5(value.intentId, `${label}.intentId`);
  assertUuidV5(value.fingerprint, `${label}.fingerprint`);
  assert.equal(value.intentId, value.fingerprint, `${label}.intentId and fingerprint differ`);
  assertUuidV5(value.bookingId, `${label}.bookingId`);
  assert.match(value.confirmationNumber, /^FKR-[A-Z0-9]+$/u, `${label}.confirmationNumber is invalid`);
}

function assertToolCalls(value, allowTestFixture) {
  assert(Array.isArray(value) && value.length === expectedCallPhases.length, "managed discovery must record four native tool calls");
  const actualPhases = value.map((call) => call.phase);
  assertExactArray(actualPhases, expectedCallPhases, "managed discovery call phases");
  for (const [index, call] of value.entries()) {
    const requiredKeys = ["sequence", "phase", "method", "toolName", "status", "resultStatus", "resultEvidence"];
    if (call.phase === "check" || call.phase === "prepare") requiredKeys.push("resultObservation");
    if (call.phase === "status_before_retry" || call.phase === "status_after_retry") requiredKeys.push("resultObservation");
    assertExactKeys(call, requiredKeys, `managed discovery toolCalls[${index}]`);
    assert.equal(call.sequence, index + 1, `managed discovery toolCalls[${index}].sequence changed`);
    assert.equal(call.method, "webmcp.capability.tool.call", `managed discovery toolCalls[${index}].method changed`);
    const expectedName = call.phase === "check" ? expectedTools[0] : call.phase === "prepare" ? expectedTools[1] : expectedTools[2];
    assert.equal(call.toolName, expectedName, `managed discovery toolCalls[${index}].toolName changed`);
    assert(!forbiddenTools.includes(call.toolName), `managed discovery called forbidden tool ${call.toolName}`);
    assert.equal(call.status, "EXECUTED", `managed discovery toolCalls[${index}] was not executed`);
    assert.equal(call.resultStatus, "SUCCESS", `managed discovery toolCalls[${index}] did not succeed`);
    assertResultEvidence(call.resultEvidence, toolCallResultSummary(call), `managed discovery toolCalls[${index}].resultEvidence`, allowTestFixture);
    if (call.phase === "check") assertInitialCheckObservation(call.resultObservation);
    if (call.phase === "prepare") assertPrepareObservation(call.resultObservation);
    if (call.phase === "status_before_retry") assertStatusObservation(call.resultObservation, 1, 3, "status_before_retry.resultObservation");
    if (call.phase === "status_after_retry") assertStatusObservation(call.resultObservation, 2, 4, "status_after_retry.resultObservation");
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
      "runBinding",
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
  assertRunBinding(discovery.runBinding, discovery.observedAt);
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
  assertResultEvidence(
    discovery.fetchToolsCall.resultEvidence,
    fetchResultSummary(discovery.fetchToolsCall),
    "managed discovery fetchToolsCall.resultEvidence",
    allowTestFixture,
  );
  assertToolCalls(discovery.toolCalls, allowTestFixture);
  assertEffectObservation(discovery.effectObservation);
  assertConfigurationObservation(discovery.configurationObservation);
  const initial = discovery.toolCalls[0].resultObservation;
  const prepare = discovery.toolCalls[1].resultObservation;
  const before = discovery.toolCalls[2].resultObservation;
  const after = discovery.toolCalls[3].resultObservation;
  assert.equal(initial.fingerprint, before.fingerprint, "initial check and status-before fingerprints differ");
  assert.equal(initial.fingerprint, prepare.fingerprint, "initial check and prepare fingerprints differ");
  assert.equal(initial.fingerprint, prepare.intentId, "initial check fingerprint and prepare intent IDs differ");
  assert.equal(prepare.intentId, before.intentId, "prepare and status-before intent IDs differ");
  assert.equal(prepare.fingerprint, before.fingerprint, "prepare and status-before fingerprints differ");
  assert.equal(before.intentId, after.intentId, "status-before and status-after intent IDs differ");
  assert.equal(before.fingerprint, after.fingerprint, "status-before and status-after fingerprints differ");
  assert.equal(before.bookingId, after.bookingId, "status-before and status-after booking IDs differ");
  assert.equal(before.confirmationNumber, after.confirmationNumber, "status-before and status-after confirmation numbers differ");
  assert.notEqual(before.eventChainHead, after.eventChainHead, "status-before and status-after event heads must advance");
  return {
    evidenceProfile: discovery.profile,
    status: discovery.status,
    executedToolCalls: discovery.toolCalls.length,
    unmeasuredExternalEffects: [...discovery.effectObservation.unmeasuredFields],
  };
}

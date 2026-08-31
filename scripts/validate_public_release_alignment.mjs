#!/usr/bin/env node
// information_uuid_v5=bded1f61-139c-50b9-a0a1-d5f7901c2915
// event_uuid_v7=01a0576f-4c85-7731-b4b3-3833d8af4a2f
// state_transition=PUBLIC_TARGETS_WITH_STALE_DESCRIPTION -> PUBLIC_TARGETS_AND_DESCRIPTION_ALIGNED occurred_at=2026-08-31T10:48:27.013Z
// machine-contract: validate the Sites, Vercel, and Devpost readbacks independently before allowing one alignment result.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { formatDraft202012Errors, validateDraft202012 } from "./public-release-alignment-schema.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const ALIGNMENT_PATH = resolve(ROOT, "metadata/public-release-alignment-readback.json");
const VERCEL_READBACK_PATH = resolve(ROOT, "metadata/hotel-public-release-readback.json");
const ALIGNMENT_SCHEMA_PATH = resolve(ROOT, "schemas/public-release-alignment-readback.schema.json");

const alignment = JSON.parse(readFileSync(ALIGNMENT_PATH, "utf8"));
const vercelReadback = JSON.parse(readFileSync(VERCEL_READBACK_PATH, "utf8"));
const schema = JSON.parse(readFileSync(ALIGNMENT_SCHEMA_PATH, "utf8"));
const expectedTools = ["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status", "preview_hotel_cancellation"];
const expectedForbiddenTools = ["confirm_hotel_booking", "pay_for_hotel_booking", "cancel_hotel_booking"];
const expectedSitesSource = "2fbbf1b714ca660ef1681239b638205a9835f7c5";
const expectedSitesVersionId = "appgprj_6a923239002081918896546134a7dc8f~appgver_8543952287588191bce7d9d5ca0593ae";
const expectedVercelSource = "2d5abd679893ec7dff36758925477999424c3cc7";
const expectedDeployment = "dpl_HWJVg4uCgFEaq9N2f5kvXwLjvK2E";
const expectedDevpostUpdatedAt = "2026-08-31T10:48:27.013Z";

const schemaResult = validateDraft202012(alignment, schema);
assert.equal(
  schemaResult.errors.length,
  0,
  `metadata/public-release-alignment-readback.json violates Draft 2020-12: ${formatDraft202012Errors(schemaResult, "metadata/public-release-alignment-readback.json")}`,
);

function uuidVersion(value, version, label) {
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u, `${label} is not a UUID`);
  assert.equal(value[14], String(version), `${label} is not UUIDv${version}`);
}

function uuid7Milliseconds(value, label) {
  uuidVersion(value, 7, label);
  return Number(BigInt(`0x${value.replaceAll("-", "").slice(0, 12)}`));
}

function assertUuid7MatchesTime(value, observedAt, label) {
  const difference = Math.abs(uuid7Milliseconds(value, label) - Date.parse(observedAt));
  assert.ok(difference <= 1000, `${label} differs from ${observedAt} by ${difference}ms`);
}

function assertEvaluation(target, label) {
  assert.equal(target.statusCode, 200, `${label} did not return HTTP 200`);
  assert.equal(target.authentication, "ANONYMOUS", `${label} was not anonymously read`);
  assert.equal(target.evaluation.measurementStatus, "CONTRACT_READY", `${label} is not contract-ready`);
  assert.equal(target.evaluation.releaseEvidence.status, "PASS", `${label} release evidence failed`);
  assert.equal(target.evaluation.releaseEvidence.testCount, 194, `${label} test count differs`);
  assert.deepEqual(target.evaluation.toolNames, expectedTools, `${label} tool names differ`);
  assert.deepEqual(target.evaluation.forbiddenToolNames, expectedForbiddenTools, `${label} forbidden tool names differ`);
  assert.deepEqual(
    target.evaluation.reconciliation,
    {
      status: "REPRODUCIBLE_PATH",
      attemptCount: 2,
      bookingCount: 1,
      effectStartCount: 1,
      sameConfirmation: true,
    },
    `${label} reconciliation contract differs`,
  );
}

assert.equal(alignment.$schema, "../schemas/public-release-alignment-readback.schema.json");
assert.equal(schema.$id, "https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/schemas/public-release-alignment-readback.schema.json");
uuidVersion(alignment.identity.namespaceUuidV5, 5, "alignment namespace");
uuidVersion(alignment.identity.informationUuidV5, 5, "alignment information");
assertUuid7MatchesTime(alignment.identity.observationUuidV7, alignment.identity.observedAt, "alignment observation");
assert.equal(alignment.identity.observationUuidV7, alignment.machineContract.stateTransition.eventUuidV7);
assert.equal(alignment.identity.observedAt, alignment.machineContract.stateTransition.occurredAt);
assert.equal(alignment.machineContract.stateTransition.from, "PUBLIC_TARGETS_WITH_STALE_DESCRIPTION");
assert.equal(alignment.machineContract.stateTransition.to, "PUBLIC_TARGETS_AND_DESCRIPTION_ALIGNED");
assert.equal(alignment.authorization.state, "IMPLEMENTATION_AND_RELEASE_AUTHORIZED");
assert.equal(alignment.authorization.sourceIssue, "https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/issues/196");
uuidVersion(alignment.authorization.eventUuidV7, 7, "authorization event");
assert.equal(alignment.previousRecord.treatment, "RETAINED_HISTORICAL_NOT_CURRENT");
assert.equal(alignment.previousRecord.version, 11);

const { sites, vercel, devpost } = alignment.targets;
uuidVersion(sites.targetInformationUuidV5, 5, "Sites target information");
assert.equal(sites.url, "https://kyoto-booking-retry-proof.anionix.chatgpt.site/");
assert.equal(sites.evaluationUrl, "https://kyoto-booking-retry-proof.anionix.chatgpt.site/webmcp-evals.json");
assert.equal(sites.versionNumber, 14);
assert.equal(sites.versionId, expectedSitesVersionId);
assert.equal(sites.sourceCommit, expectedSitesSource);
assert.equal(sites.providerState, "active");
assertEvaluation(sites, "ChatGPT Site");

uuidVersion(vercel.targetInformationUuidV5, 5, "Vercel target information");
assert.equal(vercel.url, "https://kyoto-booking-retry-proof.vercel.app/");
assert.equal(vercel.evaluationUrl, "https://kyoto-booking-retry-proof.vercel.app/webmcp-evals.json");
assert.equal(vercel.deploymentId, expectedDeployment);
assert.equal(vercel.sourceCommit, expectedVercelSource);
assertEvaluation(vercel, "Vercel");
assert.equal(vercel.deploymentId, vercelReadback.deployment.deploymentId);
assert.equal(vercel.sourceCommit, vercelReadback.deployment.sourceCommit);
assert.equal(vercel.evaluation.releaseEvidence.testCount, vercelReadback.anonymousReadback.releaseEvidence.testCount);

uuidVersion(devpost.targetInformationUuidV5, 5, "Devpost target information");
assert.equal(devpost.url, "https://devpost.com/software/project-y79pb23hj1mz");
assert.equal(devpost.projectId, "1405191");
assert.equal(devpost.projectSlug, "project-y79pb23hj1mz");
assert.equal(devpost.state, "published");
assert.equal(devpost.projectVersion, 16);
assert.equal(devpost.updatedAt, expectedDevpostUpdatedAt);
assert.equal(devpost.websiteUrl, "https://kyoto-booking-retry-proof.anionix.chatgpt.site");
assert.equal(devpost.submission.submissionId, 1158722);
assert.equal(devpost.submission.status, "Submitted");
for (const [field, value] of Object.entries(devpost.descriptionMarkers)) assert.equal(value, true, `Devpost marker ${field} is not true`);

assert.equal(alignment.alignment.status, "PASS");
assert.equal(alignment.alignment.checks.length, 5);
for (const check of alignment.alignment.checks) {
  uuidVersion(check.checkIdUuidV5, 5, "alignment check");
  assert.equal(check.status, "PASS");
}

assert.match(alignment.identity.repositoryCommit, /^[0-9a-f]{40}$/u);
execFileSync("git", ["cat-file", "-e", `${alignment.identity.repositoryCommit}^{commit}`], { cwd: ROOT, stdio: "ignore" });
const serialized = JSON.stringify(alignment);
assert.equal(serialized.includes("192 Node tests"), false, "current alignment record contains stale 192-test text");
assert.equal(serialized.includes("c8be388d8047472ef7d6ad69656255adb5903e37"), false, "current alignment record contains stale source text");
assert.equal(serialized.includes("Bearer"), false, "current alignment record contains a bearer credential");

console.log("public release alignment: PASS (Sites v14, Vercel HTTP 200 after READY, Devpost v16, exact four-tool contract, 194 tests)");

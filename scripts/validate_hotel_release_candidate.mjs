#!/usr/bin/env node
// information_uuid_v5=f2da6444-7447-5120-a39d-446adda200ca
// event_uuid_v7=01a052db-1fd7-7f69-a40f-540e4dc061a8
// state_transition=HOTEL_LIVENESS_FIXED -> PUBLIC_WEBMCP_RELEASE_EVIDENCE_BOUND
// machine-contract: derive the local test count, public HTTP readback, native
// WebMCP run, and release digests into one deterministic hard-gate receipt.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  clientRoot,
  digestTree,
  functionalDigestScope,
  fullClientDigestScope,
  fullSitesPackageDigestScope,
  sitesPackageRoot,
} from "./hotel-validator-common.mjs";
import { managedEvidenceProfile, validateManagedBrowserDiscovery } from "./hotel-managed-browser-release-proof.mjs";
import { validateReleaseContext } from "./release-validation-context.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const candidatePath = resolve(repositoryRoot, "metadata/hotel-release-candidate.json");
const sourceTestDirectory = resolve(repositoryRoot, "src/typescript");
const publicReadbackPath = "metadata/hotel-public-release-readback.json";
const nativeEvidencePath = "metadata/hotel-native-webmcp-reconciliation.json";
const publicEvaluationsPath = "examples/hotel-booking-demo/public/webmcp-evals.json";
const informationUuidV5 = "f2da6444-7447-5120-a39d-446adda200ca";
const expectedTools = Object.freeze(["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status", "preview_hotel_cancellation"]);
const forbiddenTools = Object.freeze(["confirm_hotel_booking", "pay_for_hotel_booking", "cancel_hotel_booking"]);
const requiredChromeFlags = Object.freeze(["#devtools-webmcp-support", "#enable-webmcp-testing"]);

// information_uuid_v5=c6b2a8f7-1d4e-5b90-8c3a-7e6f4d2b1a09
// event_uuid_v7=01a0565a-3b8e-7d14-9c20-6f5a4b3d2e10
// state_transition=HISTORICAL_NATIVE_OBSERVATION -> FRESH_WORKTREE_CANDIDATE_OBSERVATION occurred_at=2026-08-31T06:05:00.000Z
// machine-contract: an unpublished candidate gets a fresh observation clock and an identity derived from its measured artifact digests.

// information_uuid_v5=2e51f3c1-4fa3-5a2f-8f2e-31c3b07b4f89
// event_uuid_v7=01a056b7-6c2d-7f41-8a90-1234567890ab
// state_transition=PRE_READY_NATIVE_RUN_ACCEPTED -> PUBLIC_READY_TIME_GATED occurred_at=2026-08-31T06:20:00.000Z
// machine-contract: a native run is current evidence only when its completion is
// at or after the public deployment READY boundary; the error keeps both IDs and
// both times visible for a small, mechanical review.

function deterministicUuid7(observedAt, seed) {
  const epochMs = Date.parse(observedAt);
  assert(Number.isSafeInteger(epochMs), `invalid observation time: ${observedAt}`);
  const hash = createHash("sha256").update(seed).digest("hex");
  const randomA = Number.parseInt(hash.slice(0, 4), 16) & 0x0fff;
  const randomB = BigInt(`0x${hash.slice(4, 20)}`) & ((1n << 62n) - 1n);
  const value = (BigInt(epochMs) << 80n) | (7n << 76n) | (BigInt(randomA) << 64n) | (2n << 62n) | randomB;
  const hex = value.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function candidateObservationSeed(sourceCommit, testCount, artifacts) {
  return [informationUuidV5, sourceCommit, testCount, artifacts.functionalClientSha256, artifacts.fullClientSha256, artifacts.fullSitesPackageSha256].join(
    "\0",
  );
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function runTests() {
  const result = spawnSync("npm", ["test"], { cwd: sourceTestDirectory, encoding: "utf8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const read = (name) => {
    const match = output.match(new RegExp(`^\\s*ℹ ${name} (\\d+)\\s*$`, "m"));
    assert(match, `npm test output does not contain the ${name} summary`);
    return Number(match[1]);
  };
  assert.equal(result.status, 0, `npm test failed:\n${output.slice(-4000)}`);
  const summary = { passed: read("pass"), failed: read("fail"), skipped: read("skipped"), total: read("tests") };
  assert.equal(summary.passed, summary.total, "the candidate test run contains a non-passing test");
  assert.equal(summary.failed, 0, "the candidate test run reports a failed test");
  assert.equal(summary.skipped, 0, "the candidate test run reports a skipped test");
  assert.match(output, /approval at 120 seconds expires without a booking effect/u);
  assert.match(output, /concurrent re-preparation after expiry records one renewal event/u);
  return summary;
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8"));
}

function assertExactArray(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} changed`);
}

function assertExactKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} has an unexpected or missing field`);
}

const legacyStatusCheckKeys = Object.freeze(["toolName", "state", "bookingExists", "confirmationNumber", "attemptCount", "bookingCount", "effectStartCount"]);
const legacyFinalStatusKeys = Object.freeze(["state", "attemptCount", "bookingCount", "effectStartCount", "confirmationNumber", "sameConfirmation"]);

function assertLegacyReconciliation(reconciliation, label) {
  assertExactKeys(reconciliation.statusCheck, legacyStatusCheckKeys, `${label}.statusCheck`);
  assertExactKeys(reconciliation.finalStatus, legacyFinalStatusKeys, `${label}.finalStatus`);
}

function assertManagedRunBinding(nativeEvidence) {
  const { identity, deployment, discovery, reconciliation, recording } = nativeEvidence;
  const binding = discovery.runBinding;
  assert.equal(binding.rootObservationUuidV7, identity.observationUuidV7, "managed run binding root observation differs");
  assert.equal(binding.completedAt, discovery.observedAt, "managed run binding completion differs from discovery");
  assert.equal(binding.completedAt, identity.observedAt, "managed run binding completion differs from root identity");
  assert.equal(binding.completedAt, reconciliation.observedAt, "managed run binding completion differs from reconciliation");
  assert.equal(binding.publicSourceCommit, deployment.sourceCommit, "managed run binding source commit differs");
  assert.equal(binding.deploymentId, deployment.deploymentId, "managed run binding deployment differs");
  assert.equal(binding.publicUrl, deployment.publicUrl, "managed run binding URL differs");
  assert.equal(binding.recordingSha256, recording.sha256, "managed run binding recording differs");
}

function assertManagedReconciliationBinding(nativeEvidence) {
  // information_uuid_v5=f2da6444-7447-5120-a39d-446adda200ca
  // event_uuid_v7=01a054ba-6716-75c6-95a6-a74f26b67944 occurred_at=2026-08-30T22:11:37.366Z
  // state_transition=MANAGED_COUNTS_BOUND -> MANAGED_PHASE_STATES_BOUND
  // machine-contract: before retry is COMMITTED; only the later retry is RETRY_RECOGNIZED.
  const { discovery, reconciliation } = nativeEvidence;
  const [checkCall, prepareCall, beforeCall, afterCall] = discovery.toolCalls;
  const initial = checkCall.resultObservation;
  const prepare = prepareCall.resultObservation;
  const before = beforeCall.resultObservation;
  const after = afterCall.resultObservation;
  assert.equal(reconciliation.statusCheck.state, "COMMITTED", "managed reconciliation statusCheck.state must be COMMITTED");
  assert.equal(reconciliation.finalStatus.state, "RETRY_RECOGNIZED", "managed reconciliation finalStatus.state must be RETRY_RECOGNIZED");

  assertExactArray(reconciliation.calledToolNames, [checkCall.toolName, prepareCall.toolName, beforeCall.toolName], "managed reconciliation called tools");
  assert.equal(initial.fingerprint, prepare.intentId, "managed preparation is not bound to the initial fingerprint");
  assert.equal(prepare.intentId, before.intentId, "managed status-before is not bound to the preparation intent");
  assert.equal(prepare.intentId, after.intentId, "managed status-after is not bound to the preparation intent");
  assert.equal(prepare.fingerprint, before.fingerprint, "managed status-before fingerprint differs from preparation");
  assert.equal(prepare.fingerprint, after.fingerprint, "managed status-after fingerprint differs from preparation");

  const assertStatusBinding = (status, observation, label) => {
    for (const field of [
      "state",
      "intentId",
      "fingerprint",
      "bookingId",
      "confirmationNumber",
      "attemptCount",
      "effectStartCount",
      "eventCount",
      "eventChainHead",
    ]) {
      assert.equal(status[field], observation[field], `managed reconciliation ${label}.${field} differs from the native result`);
    }
    if (Object.hasOwn(status, "bookingExists")) {
      assert.equal(status.bookingExists, observation.bookingExists, `managed reconciliation ${label}.bookingExists differs from the native result`);
    }
    assert.equal(status.bookingCount, observation.bookingExists ? 1 : 0, `managed reconciliation ${label}.bookingCount differs from the native result`);
  };
  assertStatusBinding(reconciliation.statusCheck, before, "statusCheck");
  assertStatusBinding(reconciliation.finalStatus, after, "finalStatus");
  assert.equal(reconciliation.sameConfirmation, before.confirmationNumber === after.confirmationNumber, "managed reconciliation confirmation binding differs");
  assert.equal(reconciliation.finalStatus.sameConfirmation, reconciliation.sameConfirmation, "managed final confirmation binding differs");
}

export function assertNativeRunAfterDeploymentReady(nativeEvidence, publicDeployment = nativeEvidence?.deployment) {
  const { deployment, discovery, reconciliation } = nativeEvidence;
  const publicSourceCommit = publicDeployment?.sourceCommit ?? deployment?.sourceCommit ?? "UNMEASURED";
  const deploymentId = publicDeployment?.deploymentId ?? deployment?.deploymentId ?? "UNMEASURED";
  const recordedReadyAt = deployment?.readyAt;
  const publicReadyAt = publicDeployment?.readyAt;
  const runAt = discovery?.profile === managedEvidenceProfile ? discovery?.runBinding?.completedAt : reconciliation?.observedAt;
  const details = `publicSourceCommit=${publicSourceCommit} deploymentId=${deploymentId} recordedReadyAt=${recordedReadyAt ?? "UNMEASURED"} publicReadyAt=${publicReadyAt ?? "UNMEASURED"} runAt=${runAt ?? "UNMEASURED"}`;
  assert(
    Number.isFinite(Date.parse(recordedReadyAt)) && Number.isFinite(Date.parse(publicReadyAt)) && Number.isFinite(Date.parse(runAt)),
    `native run freshness timestamps are invalid: ${details}`,
  );
  assert.equal(recordedReadyAt, publicReadyAt, `native evidence READY time differs from public readback: ${details}`);
  assert(Date.parse(runAt) >= Date.parse(publicReadyAt), `native run completed before public deployment READY: ${details}`);
}

export function validateNativeDiscovery(nativeEvidence) {
  assert.equal(nativeEvidence.status, "PASS");
  const { discovery, reconciliation } = nativeEvidence;
  assert.equal(discovery.status, "PASS");
  assertExactArray(discovery.visibleToolNames, expectedTools, "native visible tools");
  assertExactArray(discovery.forbiddenToolNames, forbiddenTools, "native forbidden tools");
  if (discovery.profile === managedEvidenceProfile) {
    validateManagedBrowserDiscovery(discovery);
    assertManagedRunBinding(nativeEvidence);
    assertManagedReconciliationBinding(nativeEvidence);
  } else {
    assertExactArray(discovery.requiredChromeFlags, requiredChromeFlags, "native browser flags");
    assert.equal(discovery.documentModelContext, "CONFIRMED_PRESENT");
    assert.equal(discovery.secureContext, true);
    assert.equal(discovery.discoveryEffectCounts.bookingCount, 0);
    assert.equal(discovery.discoveryEffectCounts.effectStartCount, 0);
    assertLegacyReconciliation(reconciliation, "legacy native reconciliation");
  }
  assert.equal(reconciliation.status, "PASS");
  assert.equal(reconciliation.sameConfirmation, true);
  assert.equal(reconciliation.finalStatus.attemptCount, 2);
  assert.equal(reconciliation.finalStatus.bookingCount, 1);
  assert.equal(reconciliation.finalStatus.effectStartCount, 1);
  assert.equal(reconciliation.finalStatus.sameConfirmation, true);
  assertExactArray(
    reconciliation.calledToolNames,
    ["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status"],
    "native called tools",
  );
}

function browserReconciliationFrom(reconciliation) {
  return {
    status: reconciliation.status,
    flow: reconciliation.flow,
    statusCheck: reconciliation.statusCheck,
    finalStatus: reconciliation.finalStatus,
    sameConfirmation: reconciliation.sameConfirmation,
    humanConfirmationBoundary: reconciliation.humanConfirmationBoundary,
    driverAction: reconciliation.driverAction,
    agentExplanation: reconciliation.agentExplanation,
  };
}

export function browserObservationFrom(nativeEvidence, sourceCommit) {
  validateNativeDiscovery(nativeEvidence);
  const discovery = nativeEvidence.discovery;
  const reconciliation = nativeEvidence.reconciliation;
  const deployment = nativeEvidence.deployment;
  const origin = new URL(deployment.publicUrl).origin;
  const common = {
    url: deployment.publicUrl,
    origin,
    observedAt: reconciliation.observedAt,
    pageSourceCommit: deployment.sourceCommit,
    candidateSourceCommit: sourceCommit,
    visibleToolNames: discovery.visibleToolNames,
    forbiddenToolNames: discovery.forbiddenToolNames,
    reconciliation: browserReconciliationFrom(reconciliation),
    recording: nativeEvidence.recording,
    status: "PASS",
  };
  if (discovery.profile === managedEvidenceProfile) {
    return { ...common, profile: discovery.profile, managedDiscovery: discovery };
  }
  return {
    ...common,
    browser: discovery.browser,
    secureContext: discovery.secureContext,
    documentModelContext: discovery.documentModelContext,
    requiredChromeFlags: discovery.requiredChromeFlags,
    configurationState: "VERIFIED",
    launchArguments: discovery.configuration.launchArguments,
    devtoolsWebmcpCategory: discovery.configuration.devtoolsWebmcpCategory,
    originTrialMetadataCount: discovery.originTrialMetadataCount,
    calledToolNames: reconciliation.calledToolNames,
    discoveryEffectCounts: discovery.discoveryEffectCounts,
  };
}

async function buildCandidate(mode = "--check") {
  assert.ok(mode === "--write" || mode === "--check", "candidate build mode must be --write or --check");
  const testRun = runTests();
  const publicReadback = await readJson(publicReadbackPath);
  const nativeEvidence = await readJson(nativeEvidencePath);
  const publicEvaluations = await readJson(publicEvaluationsPath);
  const sourceCommit = publicReadback.release.sourceCommit;
  const baseCommit = publicReadback.release.baseCommit;
  const branch = publicReadback.release.branch;
  const managedDiscovery = nativeEvidence.discovery.profile === managedEvidenceProfile;
  assert.equal(publicReadback.release.status, "COMMITTED_RELEASE");
  assert.equal(publicReadback.release.testRun.testCount, testRun.total, "public release test count differs from npm test");
  assert.equal(publicReadback.release.testRun.passed, testRun.passed, "public release passed count differs from npm test");
  assert.equal(publicReadback.release.testRun.failed, 0, "public release reports failed tests");
  assert.equal(publicReadback.release.testRun.skipped, 0, "public release reports skipped tests");
  assert.equal(publicReadback.anonymousReadback.statusCode, 200, "public release evidence was not read with HTTP 200");
  assert.equal(publicReadback.anonymousReadback.authentication, "ANONYMOUS");
  assert.equal(publicReadback.anonymousReadback.releaseEvidence.testCount, testRun.total, "anonymous public test count differs from npm test");
  assert.equal(publicReadback.anonymousReadback.releaseEvidence.status, "PASS");
  assert.equal(publicEvaluations.releaseEvidence.testCount, testRun.total, "public WebMCP file test count differs from npm test");
  assert.equal(publicEvaluations.releaseEvidence.status, "PASS");
  assert.deepEqual(
    publicEvaluations.applicationState.map((entry) => entry.name),
    expectedTools,
  );
  assertExactArray(publicEvaluations.forbiddenTools, forbiddenTools, "public forbidden tool contract");

  validateNativeDiscovery(nativeEvidence);
  assert.equal(nativeEvidence.deployment.sourceCommit, sourceCommit, "native evidence source commit differs from release");
  assert.equal(nativeEvidence.deployment.publicUrl, publicReadback.deployment.publicUrl, "native evidence URL differs from public readback");
  assert.equal(nativeEvidence.deployment.deploymentId, publicReadback.deployment.deploymentId, "native evidence deployment differs from public readback");
  assert(nativeEvidence.recording.path.startsWith("/"), "recording path must be absolute");
  // machine-contract: the native recording is a local artifact excluded from
  // the repository; verify its bytes when this checkout has them, otherwise
  // retain the recorded digest as an external observation for clean CI.
  if (existsSync(nativeEvidence.recording.path)) {
    const recordingBytes = await readFile(nativeEvidence.recording.path);
    assert.equal(sha256(recordingBytes), nativeEvidence.recording.sha256, "recording hash changed");
  } else {
    assert.equal(nativeEvidence.recording.status, "LOCAL_ARTIFACT", "missing recording must remain a declared local artifact");
  }

  const artifacts = {
    functionalClientSha256: await digestTree(clientRoot, functionalDigestScope.excludedPaths),
    functionalClientScope: functionalDigestScope,
    fullClientSha256: await digestTree(clientRoot, fullClientDigestScope.excludedPaths),
    fullClientScope: fullClientDigestScope,
    fullSitesPackageSha256: await digestTree(sitesPackageRoot, fullSitesPackageDigestScope.excludedPaths),
    fullSitesScope: fullSitesPackageDigestScope,
  };
  const artifactsMatchPublicRelease =
    artifacts.functionalClientSha256 === publicReadback.release.artifacts.functionalClientSha256 &&
    artifacts.fullClientSha256 === publicReadback.release.artifacts.fullClientSha256 &&
    artifacts.fullSitesPackageSha256 === publicReadback.release.artifacts.fullSitesPackageSha256;
  if (artifactsMatchPublicRelease) {
    // machine-contract: only a candidate whose bytes equal the public release
    // may promote the native run from historical context to current evidence.
    assertNativeRunAfterDeploymentReady(nativeEvidence, publicReadback.deployment);
  }
  validateReleaseContext({
    repositoryRoot,
    baseCommit,
    sourceCommit,
    allowCurrentCheckoutDivergence: !artifactsMatchPublicRelease,
  });
  // machine-contract: a changed local client is a worktree candidate until a
  // later deployment and public readback bind these new bytes; it never
  // rewrites the historical public release receipt.

  const storedCandidate = !artifactsMatchPublicRelease && mode === "--check" ? await readJson("metadata/hotel-release-candidate.json") : null;
  const observedAt = artifactsMatchPublicRelease
    ? nativeEvidence.reconciliation.observedAt
    : mode === "--write"
      ? new Date().toISOString()
      : storedCandidate?.observedAt;
  assert.equal(typeof observedAt, "string", "worktree candidate observation time is missing");
  if (!artifactsMatchPublicRelease) {
    assert.ok(
      Date.parse(observedAt) > Date.parse(nativeEvidence.reconciliation.observedAt),
      "worktree candidate observation must be later than the historical native run",
    );
  }
  const browserObservation = browserObservationFrom(nativeEvidence, sourceCommit);
  if (!artifactsMatchPublicRelease) {
    // machine-contract: the worktree candidate keeps the historical native
    // run as history and describes only the measured artifact boundary.
    browserObservation.reconciliation = {
      ...browserObservation.reconciliation,
      agentExplanation: `${browserObservation.reconciliation.agentExplanation} The local worktree artifact digests differ from the historical public release; no fresh public native run is claimed for this candidate.`,
    };
  }
  const publicReadbackTestCount = publicReadback.anonymousReadback.releaseEvidence.testCount;
  // information_uuid_v5=9b9e2d43-6c71-5f2a-9b8e-4d0a7c1f6e25
  // event_uuid_v7=01a0564c-4c2a-7f21-9a80-5e8d2b7c1f30
  // state_transition=PUBLIC_ARTIFACT_MISMATCH -> FINAL_GATE_NOT_READY occurred_at=2026-08-31T06:00:00.000Z
  // machine-contract: a worktree candidate may be locally valid, but exact public artifact equality is a separate required gate.
  const finalGateReady = artifactsMatchPublicRelease;
  const candidate = {
    $schema: "../schemas/hotel-release-candidate.schema.json",
    identity: {
      informationUuidV5,
      observationUuidV7: deterministicUuid7(observedAt, candidateObservationSeed(sourceCommit, testRun.total, artifacts)),
    },
    observedAt,
    source: {
      commit: sourceCommit,
      state: artifactsMatchPublicRelease ? "COMMITTED_CANDIDATE" : "WORKTREE_CANDIDATE",
      branch,
      baseCommit,
    },
    testRun: { command: "npm test", directory: "src/typescript", ...testRun, derivedFrom: "node-test-summary" },
    localLiveness: {
      status: "PASS",
      stateSequence: ["PREPARED", "EXPIRED", "PREPARED", "HUMAN_APPROVED", "COMMITTED"],
      sameIntent: true,
      physicalBookingRows: 1,
      effectStartCount: 1,
      approvalDigestRenewed: true,
    },
    artifacts,
    publicClaims: {
      candidateTestCount: testRun.total,
      publicReadbackTestCount,
      status: artifactsMatchPublicRelease ? "MATCH" : "PUBLIC_READBACK_TEST_COUNT_MATCH_ARTIFACTS_UNPUBLISHED",
      source: publicReadbackPath,
      releaseCommit: sourceCommit,
      deploymentId: publicReadback.deployment.deploymentId,
      publicUrl: publicReadback.deployment.publicUrl,
    },
    browserObservation,
    issueReadiness: [
      {
        issue: 189,
        status: "PASS",
        reason:
          "The focused hotel tests prove EXPIRED -> PREPARED with the same semantic booking, a fresh approval window, one physical booking row, one effect start, and a valid event chain.",
      },
      {
        issue: 190,
        status: "PASS",
        reason: `The executable npm test summary and the anonymous public WebMCP release record both report ${testRun.total} passed tests for release commit ${sourceCommit}.`,
      },
      {
        issue: 191,
        status: "PASS",
        reason: managedDiscovery
          ? "The managed IAB native capability returned exactly the four intended tools and the required calls; browser configuration and external effects remain explicitly unmeasured."
          : "A fresh HTTPS browser session exposed document.modelContext and exactly the four intended tools; discovery reported zero booking and effect starts.",
      },
      {
        issue: 192,
        status: "PASS",
        reason: `The native get_hotel_booking_status result found confirmation ${nativeEvidence.reconciliation.statusCheck.confirmationNumber}; retry ended with attempts 2, bookings 1, effect starts 1, and the same confirmation without a second effect.`,
      },
      {
        issue: 193,
        status: finalGateReady ? "PASS" : "NOT_READY_PUBLIC_ARTIFACT_MISMATCH",
        reason: finalGateReady
          ? "All five hard gates point to the same committed source, production deployment, executable test count, native tool enumeration, and read-before-retry result."
          : "The local worktree artifacts differ from the historical public release; exact public artifact equality is not established, so issue 193 remains not ready until a later deployment and public readback bind these bytes.",
      },
    ],
    finalGate: {
      formula: "S AND L AND F_exact AND W AND E",
      status: finalGateReady ? "PASS" : "NOT_READY_PUBLIC_ARTIFACT_MISMATCH",
      ready: finalGateReady,
      components: {
        S: "PASS",
        L: "PASS",
        F_exact: finalGateReady ? "PASS" : "FAIL",
        W: "PASS",
        E: "PASS",
      },
    },
  };
  return candidate;
}

// machine-contract: expected is built from separately loaded and validated native
// evidence; schema validation alone cannot establish equality of duplicated values.
export function compareStable(actual, expected) {
  assert.equal(actual.observedAt, expected.observedAt, "candidate observation time differs from expected candidate evidence");
  assert.deepEqual(actual.testRun, expected.testRun, "candidate test summary is stale");
  assert.deepEqual(actual.localLiveness, expected.localLiveness, "candidate liveness evidence drifted");
  assert.deepEqual(actual.artifacts, expected.artifacts, "candidate artifact digest is stale");
  assert.deepEqual(actual.publicClaims, expected.publicClaims, "candidate public-claim record is stale");
  if (actual.browserObservation.profile !== managedEvidenceProfile) {
    assertLegacyReconciliation(actual.browserObservation.reconciliation, "legacy browser observation reconciliation");
  }
  assert.deepEqual(actual.browserObservation, expected.browserObservation, "native browser observation record drifted");
  assert.deepEqual(actual.issueReadiness, expected.issueReadiness, "issue readiness record drifted");
  assert.deepEqual(actual.finalGate, expected.finalGate, "final gate record drifted");
  assert.deepEqual(actual.source, expected.source, "candidate source boundary changed");
  assert.equal(actual.identity.informationUuidV5, informationUuidV5, "candidate information identity changed");
  assert.equal(
    actual.identity.observationUuidV7,
    deterministicUuid7(actual.observedAt, candidateObservationSeed(actual.source.commit, actual.testRun.total, actual.artifacts)),
    "candidate observation identity is not reproducible from its recorded inputs",
  );
}

if (import.meta.main) {
  const mode = process.argv[2] ?? "--check";
  assert.ok(mode === "--write" || mode === "--check", "use --write or --check");
  const candidate = await buildCandidate(mode);
  if (mode === "--write") {
    await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
    console.log(
      JSON.stringify({
        receipt: "HOTEL_RELEASE_CANDIDATE_WRITTEN",
        path: "metadata/hotel-release-candidate.json",
        sourceCommit: candidate.source.commit,
        testCount: candidate.testRun.total,
        deploymentId: candidate.publicClaims.deploymentId,
        finalGate: candidate.finalGate.status,
      }),
    );
  } else {
    const actual = await readJson("metadata/hotel-release-candidate.json");
    compareStable(actual, candidate);
    console.log(
      JSON.stringify({
        receipt: "HOTEL_RELEASE_CANDIDATE_VALIDATION_PASS",
        sourceCommit: actual.source.commit,
        testCount: actual.testRun.total,
        publicClaimStatus: actual.publicClaims.status,
        finalGate: actual.finalGate.status,
      }),
    );
  }
}

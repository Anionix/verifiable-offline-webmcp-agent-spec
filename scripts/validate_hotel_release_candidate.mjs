#!/usr/bin/env node
// information_uuid_v5=f2da6444-7447-5120-a39d-446adda200ca
// event_uuid_v7=01a052ac-2ad0-7a33-a496-f0f93b6a383f
// state_transition=HOTEL_LIVENESS_FIXED -> RELEASE_EVIDENCE_BOUND
// machine-contract: derive the local test count from the Node summary and compare
// it with built digests and the separately observed public claim; unknown gates stay unknown.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const candidatePath = resolve(repositoryRoot, "metadata/hotel-release-candidate.json");
const sourceTestDirectory = resolve(repositoryRoot, "src/typescript");
const informationUuidV5 = "f2da6444-7447-5120-a39d-446adda200ca";
const browserObservation = Object.freeze({
  url: "https://kyoto-booking-retry-proof.anionix.chatgpt.site/",
  origin: "https://kyoto-booking-retry-proof.anionix.chatgpt.site",
  observedAt: "2026-08-30T12:32:54.095Z",
  browser: "HeadlessChrome/152.0.0.0",
  secureContext: true,
  pageSourceCommit: "f832cc611ed43613035a8735ca97d4bc1a0a8efc",
  candidateSourceCommit: "NOT_PROVEN",
  documentModelContext: "CONFIRMED_ABSENT",
  requiredChromeFlags: ["#devtools-webmcp-support", "#enable-webmcp-testing"],
  configurationState: "NOT_VERIFIED",
  originTrialMetadataCount: 0,
  visibleToolNames: ["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status", "preview_hotel_cancellation"],
  forbiddenToolNames: ["confirm_hotel_booking", "pay_for_hotel_booking", "cancel_hotel_booking"],
  calledToolNames: [],
  effectCounts: {
    intentRows: 0,
    attemptRows: 0,
    effectRows: 0,
    auditEvents: 0,
    externalRequests: 0,
    permissionRequests: 0,
    notifications: 0,
  },
  status: "INCONCLUSIVE",
});

function command(name, args, cwd = repositoryRoot) {
  return execFileSync(name, args, { cwd, encoding: "utf8" }).trim();
}

function deterministicUuid7(observedAt, seed) {
  const epochMs = Date.parse(observedAt);
  const hash = createHash("sha256").update(seed).digest("hex");
  const randomA = Number.parseInt(hash.slice(0, 4), 16) & 0x0fff;
  const randomB = BigInt(`0x${hash.slice(4, 20)}`) & ((1n << 62n) - 1n);
  const value = (BigInt(epochMs) << 80n) | (7n << 76n) | (BigInt(randomA) << 64n) | (2n << 62n) | randomB;
  const hex = value.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

async function buildCandidate() {
  const testRun = runTests();
  const observedAt = new Date().toISOString();
  const baseCommit = command("git", ["rev-parse", "HEAD"]);
  const branch = command("git", ["branch", "--show-current"]);
  const publicReadback = await readJson("metadata/devpost-public-readback.json");
  const candidateTestCount = testRun.total;
  const publicReadbackTestCount = publicReadback.anonymousPublicHtml.visibleEvidence.nodeTestCount;
  const candidate = {
    $schema: "../schemas/hotel-release-candidate.schema.json",
    identity: {
      informationUuidV5,
      observationUuidV7: deterministicUuid7(observedAt, `${informationUuidV5}\0${baseCommit}\0${candidateTestCount}`),
    },
    observedAt,
    source: { commit: "WORKTREE", state: "WORKTREE_CANDIDATE", branch, baseCommit },
    testRun: { command: "npm test", directory: "src/typescript", ...testRun, derivedFrom: "node-test-summary" },
    localLiveness: {
      status: "PASS",
      stateSequence: ["PREPARED", "EXPIRED", "PREPARED", "HUMAN_APPROVED", "COMMITTED"],
      sameIntent: true,
      physicalBookingRows: 1,
      effectStartCount: 1,
      approvalDigestRenewed: true,
    },
    artifacts: {
      functionalClientSha256: await digestTree(clientRoot, functionalDigestScope.excludedPaths),
      functionalClientScope: functionalDigestScope,
      fullClientSha256: await digestTree(clientRoot, fullClientDigestScope.excludedPaths),
      fullClientScope: fullClientDigestScope,
      fullSitesPackageSha256: await digestTree(sitesPackageRoot, fullSitesPackageDigestScope.excludedPaths),
      fullSitesScope: fullSitesPackageDigestScope,
    },
    publicClaims: {
      candidateTestCount,
      publicReadbackTestCount,
      status: candidateTestCount === publicReadbackTestCount ? "MATCH" : "MISMATCH_OBSERVED",
      source: "metadata/devpost-public-readback.json",
    },
    browserObservation,
    issueReadiness: [
      {
        issue: 189,
        status: "PASS",
        reason:
          "Local expiry recovery tests prove EXPIRED -> PREPARED, one semantic intent, one physical booking row, and one effect start after fresh human approval.",
      },
      {
        issue: 190,
        status: "INCONCLUSIVE",
        reason: `The candidate count is ${candidateTestCount}, while the separately read public Devpost record still claims ${publicReadbackTestCount}; exact public agreement is not established.`,
      },
      {
        issue: 191,
        status: "INCONCLUSIVE",
        reason:
          "The public HTTPS page shows exactly four safe names, but document.modelContext is absent and WebMCP testing or origin-trial configuration was not verified.",
      },
      {
        issue: 192,
        status: "INCONCLUSIVE",
        reason:
          "No native WebMCP agent invocation was observed, so the lost-response recovery cannot be promoted from a local test to an agent-first public proof.",
      },
      {
        issue: 193,
        status: "INCONCLUSIVE",
        reason:
          "S AND L AND F_exact AND W AND E cannot be true while source freeze, exact public evidence, native WebMCP, and agent-first execution remain unknown.",
      },
    ],
    finalGate: {
      formula: "S AND L AND F_exact AND W AND E",
      status: "INCONCLUSIVE",
      ready: null,
      components: { S: "INCONCLUSIVE", L: "PASS", F_exact: "INCONCLUSIVE", W: "INCONCLUSIVE", E: "INCONCLUSIVE" },
    },
  };
  return candidate;
}

function compareStable(actual, expected) {
  assert.deepEqual(actual.testRun, expected.testRun, "candidate test summary is stale");
  assert.deepEqual(actual.localLiveness, expected.localLiveness, "candidate liveness evidence drifted");
  assert.deepEqual(actual.artifacts, expected.artifacts, "candidate artifact digest is stale");
  assert.deepEqual(actual.publicClaims, expected.publicClaims, "candidate public-claim comparison is stale");
  assert.deepEqual(actual.browserObservation, expected.browserObservation, "browser observation record drifted");
  assert.deepEqual(actual.issueReadiness, expected.issueReadiness, "issue readiness record drifted");
  assert.deepEqual(actual.finalGate, expected.finalGate, "final gate record drifted");
  assert.equal(actual.source.commit, "WORKTREE", "the candidate must not claim a frozen source commit");
  assert.equal(actual.source.state, "WORKTREE_CANDIDATE", "the candidate source state must remain explicit");
  assert.equal(actual.source.branch, expected.source.branch, "candidate branch changed");
  assert.equal(actual.source.baseCommit, expected.source.baseCommit, "candidate base commit changed");
  assert.equal(actual.identity.informationUuidV5, informationUuidV5, "candidate information identity changed");
  assert.equal(
    actual.identity.observationUuidV7,
    deterministicUuid7(actual.observedAt, `${informationUuidV5}\0${actual.source.baseCommit}\0${actual.testRun.total}`),
    "candidate observation identity is not reproducible from its recorded inputs",
  );
  assert.match(actual.observedAt, /^2026-08-30T/u, "candidate observation must belong to the current run date");
}

const mode = process.argv[2] ?? "--check";
assert.ok(mode === "--write" || mode === "--check", "use --write or --check");
const candidate = await buildCandidate();
if (mode === "--write") {
  await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
  console.log(
    JSON.stringify({
      receipt: "HOTEL_RELEASE_CANDIDATE_WRITTEN",
      path: "metadata/hotel-release-candidate.json",
      testCount: candidate.testRun.total,
      artifacts: candidate.artifacts,
    }),
  );
} else {
  const actual = await readJson("metadata/hotel-release-candidate.json");
  compareStable(actual, candidate);
  console.log(
    JSON.stringify({
      receipt: "HOTEL_RELEASE_CANDIDATE_VALIDATION_PASS",
      testCount: actual.testRun.total,
      publicClaimStatus: actual.publicClaims.status,
      finalGate: actual.finalGate.status,
    }),
  );
}

#!/usr/bin/env node
// information_uuid_v5=86d5af84-847b-5654-b6ce-fb47627360c5
// event_uuid_v7=01a04b41-fd38-7f10-973a-b6ecdd1b71b4
// state_transition=COMBINED_HOST_VALIDATION -> PORTABLE_CLIENT_RECEIPT occurred_at=2026-08-29T02:03:31.000Z
// machine-contract: this validator proves only the complete portable client allowlist, bounded UI and tools, offline shell, local host configuration syntax, and its two scoped digests.
// information_uuid_v5=35895cab-fd9e-5106-8047-9be7177bbe27
// event_uuid_v7=01a052db-1fd7-7f69-a40f-540e4dc061a8
// state_transition=NATIVE_WEBMCP_RECIPE_DECLARED -> PUBLIC_RUNTIME_PROOF_RECORDED occurred_at=2026-08-30T13:28:07.383Z
// machine-contract: the public WebMCP file separates zero-effect native discovery,
// the executable test count, and the later fictional human-confirmation retry.

import assert from "node:assert/strict";
import { resolve } from "node:path";

import {
  assertDigestScope,
  assertExactFiles,
  clientRoot,
  digestTree,
  fullClientDigestScope,
  functionalDigestScope,
  readJson,
  readText,
  repositoryRoot,
  requireNonEmptyFile,
} from "./hotel-validator-common.mjs";

const expectedClientFiles = Object.freeze([
  ".assetsignore",
  "_headers",
  "assets/app.js",
  "assets/index.css",
  "favicon.svg",
  "index.html",
  "service-integrations.json",
  "service-worker.js",
  "webmcp-evals.json",
]);

const expectedTools = Object.freeze(["check_existing_hotel_booking", "prepare_hotel_booking", "get_hotel_booking_status", "preview_hotel_cancellation"]);

const forbiddenTools = Object.freeze(["confirm_hotel_booking", "pay_for_hotel_booking", "cancel_hotel_booking"]);

const expectedRecordingRecipe = Object.freeze({
  recipeId: "35895cab-fd9e-5106-8047-9be7177bbe27",
  status: "READY",
  purpose: "Reproduce native WebMCP discovery and the fictional lost-response reconciliation on the public HTTPS page.",
  target: {
    url: "https://kyoto-booking-retry-proof.vercel.app/",
    requiresSecureContext: true,
    requiredChromeFlags: ["#devtools-webmcp-support", "#enable-webmcp-testing"],
  },
  steps: [
    { stepId: "open-public-https", action: "navigate", expect: "secureContext=true" },
    { stepId: "discover-model-context", action: "read", surface: "document.modelContext.getTools", expect: "present" },
    {
      stepId: "assert-tool-boundary",
      action: "read",
      expectedToolNames: expectedTools,
      forbiddenToolNames: forbiddenTools,
    },
    {
      stepId: "assert-zero-effects",
      action: "read",
      expect: "discovery creates no booking, effect, external request, permission request, or notification",
    },
    {
      stepId: "prepare-and-human-confirm",
      action: "visible-human-button",
      expect: "COMMITTED with the success response hidden",
    },
    {
      stepId: "reconcile-before-retry",
      action: "execute-native-tool",
      toolName: "get_hotel_booking_status",
      expect: "existing result found before retry",
    },
    {
      stepId: "retry-same-intent",
      action: "visible-retry-button",
      expect: "RETRY_RECOGNIZED, attempts=2, bookings=1, effectStartCount=1",
    },
  ],
});

const expectedReleaseEvidence = Object.freeze({
  status: "PASS",
  testCommand: "npm test",
  testDirectory: "src/typescript",
  testCount: 192,
  countSource: "node-test-summary",
});

const expectedNativeRuntimeContract = Object.freeze({
  status: "REPRODUCIBLE_PATH",
  targetUrl: "https://kyoto-booking-retry-proof.vercel.app/",
  requiresSecureContext: true,
  requiredChromeFlags: ["#devtools-webmcp-support", "#enable-webmcp-testing"],
  requiredSurface: "document.modelContext.getTools",
  expectedToolNames: expectedTools,
  forbiddenToolNames: forbiddenTools,
  discoveryMustHaveZeroEffects: true,
});

const expectedAgentReconciliationContract = Object.freeze({
  status: "REPRODUCIBLE_PATH",
  flow: ["AMBIGUOUS_OUTCOME", "AGENT_WEBMCP_STATUS_CHECK", "EXISTING_RESULT_FOUND", "NO_DUPLICATE_EFFECT"],
  requiredReadTool: "get_hotel_booking_status",
  humanConfirmationBoundary: "visible_button_only",
  resultInvariant: {
    attemptCount: 2,
    bookingCount: 1,
    effectStartCount: 1,
    sameConfirmation: true,
  },
});

const requiredSecurityHeaders = Object.freeze([
  "Content-Security-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
]);

await assertExactFiles(clientRoot, expectedClientFiles, "dist/client");
for (const name of expectedClientFiles) await requireNonEmptyFile(resolve(clientRoot, name));

const [
  html,
  clientBundle,
  serviceWorker,
  sourceAdapter,
  sourceApplication,
  evaluations,
  builtRegistry,
  sourceRegistry,
  assetsIgnore,
  portableHeaders,
  vercel,
  netlifyText,
  renderText,
  verification,
] = await Promise.all([
  readText(resolve(clientRoot, "index.html")),
  readText(resolve(clientRoot, "assets/app.js")),
  readText(resolve(clientRoot, "service-worker.js")),
  readText(resolve(repositoryRoot, "src/typescript/hotel/webmcp-adapter.js")),
  readText(resolve(repositoryRoot, "examples/hotel-booking-demo/app.js")),
  readJson(resolve(clientRoot, "webmcp-evals.json")),
  readJson(resolve(clientRoot, "service-integrations.json")),
  readJson(resolve(repositoryRoot, "metadata/service-integration-registry.json")),
  readText(resolve(clientRoot, ".assetsignore")),
  readText(resolve(clientRoot, "_headers")),
  readJson(resolve(repositoryRoot, "vercel.json")),
  readText(resolve(repositoryRoot, "netlify.toml")),
  readText(resolve(repositoryRoot, "render.yaml")),
  readJson(resolve(repositoryRoot, "metadata/hotel-release-candidate.json")),
]);

assert.match(html, /Did my hotel booking go through\?/);
assert.match(html, /Fictional Kyoto Ryokan/);
assert.match(html, /Confirm booking — human action only/);
assert.match(html, /No WebMCP tool can confirm, pay for, or cancel a booking/);
assert.match(html, /This device \+ this deployment only/);
assert.doesNotMatch(html, /real booking|credit card|email address/i);

for (const tool of expectedTools) {
  assert(sourceAdapter.includes(`"${tool}"`), `${tool} must be registered by the source adapter`);
  assert(clientBundle.includes(tool), `${tool} must be present in the portable client`);
}
for (const tool of forbiddenTools) {
  assert(!sourceAdapter.includes(`name: "${tool}"`), `${tool} must not be registered`);
}
assert.doesNotMatch(sourceAdapter, /humanApproveAndCommit|requestPayment|cancelBooking/);
assert.match(sourceApplication, /humanApproveAndCommit/);
assert.match(sourceApplication, /elements\.approve\.addEventListener/);
assert.match(sourceApplication, /ACTIVE_INTENT_STORAGE_KEY/);
assert.match(sourceApplication, /onResult: reflectSafeToolResult/);
assert.match(sourceApplication, /fetch\("\/service-integrations\.json"/);
assert.doesNotMatch(sourceApplication, /import serviceRegistry/);
assert.match(sourceApplication, /2 attempts → 1 simulated booking → 1 confirmation number/);

assert.match(serviceWorker, /cache\.addAll\(ASSETS\)/);
for (const asset of ["/", "/assets/app.js", "/assets/index.css", "/favicon.svg", "/webmcp-evals.json", "/service-integrations.json"]) {
  assert(serviceWorker.includes(`"${asset}"`), `${asset} must be available to the offline shell`);
}
assert.doesNotMatch(serviceWorker, /addEventListener\(["'](?:sync|periodicsync)["']/i);
assert.doesNotMatch(serviceWorker, /humanApproveAndCommit|requestPayment|cancelBooking/);

assert.equal(evaluations.measurementStatus, "CONTRACT_READY");
assert.deepEqual(
  evaluations.applicationState.map((entry) => entry.name),
  expectedTools,
);
assert.deepEqual(evaluations.forbiddenTools, forbiddenTools);
assert.deepEqual(evaluations.releaseEvidence, expectedReleaseEvidence);
assert.deepEqual(evaluations.nativeRuntimeContract, expectedNativeRuntimeContract);
assert.deepEqual(evaluations.agentReconciliationContract, expectedAgentReconciliationContract);
assert.deepEqual(evaluations.recordingRecipe, expectedRecordingRecipe);
assert.deepEqual(builtRegistry, sourceRegistry, "portable service registry must exactly match its repository source");
assert.deepEqual(assetsIgnore.trim().split(/\r?\n/u), ["wrangler.json", ".dev.vars"]);

for (const header of requiredSecurityHeaders) {
  assert(portableHeaders.includes(`${header}:`), `portable _headers must configure ${header}`);
}
assert.match(portableHeaders, /\/service-worker\.js[\s\S]*Cache-Control: no-cache/);
assert.match(portableHeaders, /\/service-worker\.js[\s\S]*Service-Worker-Allowed: \//);

assert.equal(vercel.buildCommand, "npm run build:web");
assert.equal(vercel.outputDirectory, "dist/client");
assert.equal(vercel.cleanUrls, true);
assert.equal(vercel.trailingSlash, false);
assert.equal(Object.hasOwn(vercel, "rewrites"), false, "Vercel must not hide missing paths behind rewrites");
assert.equal(Object.hasOwn(vercel, "redirects"), false, "Vercel must not add an unreviewed redirect lane");
const vercelGlobalHeaders = new Map(vercel.headers.find((entry) => entry.source === "/(.*)")?.headers.map((header) => [header.key, header.value]) ?? []);
for (const header of requiredSecurityHeaders) {
  assert(vercelGlobalHeaders.has(header), `Vercel configuration must include ${header}`);
}
const vercelWorkerHeaders = new Map(
  vercel.headers.find((entry) => entry.source === "/service-worker.js")?.headers.map((header) => [header.key, header.value]) ?? [],
);
assert.equal(vercelWorkerHeaders.get("Service-Worker-Allowed"), "/");
assert.match(vercelWorkerHeaders.get("Cache-Control") ?? "", /max-age=0|no-cache/);

// These are bounded repository syntax checks, not provider-side deploy checks.
assert.match(netlifyText, /^\s*\[build\]\s*$/m);
assert.match(netlifyText, /^\s*command\s*=\s*["']npm run build:web["']\s*$/m);
assert.match(netlifyText, /^\s*publish\s*=\s*["']dist\/client["']\s*$/m);
assert.doesNotMatch(netlifyText, /^\s*\[\[redirects\]\]\s*$/m);
for (const header of requiredSecurityHeaders) {
  assert.match(netlifyText, new RegExp(`^${header.replaceAll("-", "\\-")}\\s*=`, "m"));
}

assert.match(renderText, /^\s*-\s+type:\s*web\s*$/m);
assert.match(renderText, /^\s*runtime:\s*static\s*$/m);
assert.match(renderText, /^\s*buildCommand:\s*["']?npm run build:web["']?\s*$/m);
assert.match(renderText, /^\s*staticPublishPath:\s*["']?\.\/dist\/client["']?\s*$/m);
assert.doesNotMatch(renderText, /^\s*(?:routes|redirects|rewrites):/m);
for (const header of requiredSecurityHeaders) {
  assert.match(renderText, new RegExp(`^\\s*name:\\s*${header}\\s*$`, "m"));
}

assertDigestScope(verification.artifacts.functionalClientScope, functionalDigestScope, "functional client");
assertDigestScope(verification.artifacts.fullClientScope, fullClientDigestScope, "full client");
const functionalDigest = await digestTree(clientRoot, functionalDigestScope.excludedPaths);
const fullClientDigest = await digestTree(clientRoot, fullClientDigestScope.excludedPaths);
assert.equal(verification.artifacts.functionalClientSha256, functionalDigest, "functional client digest differs from its scoped receipt");
assert.equal(verification.artifacts.fullClientSha256, fullClientDigest, "full client digest differs from its scoped receipt");

console.log(
  JSON.stringify({
    receipt: "HOTEL_PORTABLE_CLIENT_VALIDATION_PASS",
    functionalArtifactSha256: functionalDigest,
    fullClientArtifactSha256: fullClientDigest,
    vercelConfiguration: "LOCAL_CONFIGURATION_PASS",
    netlifyConfiguration: "REPOSITORY_SYNTAX_ONLY_PASS",
    renderConfiguration: "REPOSITORY_SYNTAX_ONLY_PASS",
  }),
);

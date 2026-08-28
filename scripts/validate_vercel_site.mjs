#!/usr/bin/env node
// information_uuid_v5=ac397ed8-9f18-59a5-9474-5232d8c63acd
// event_uuid_v7=01a04a5f-5131-7800-a0bc-b98b6dfc71c3
// event_uuid_v7=01a04a69-2b0a-718c-a79d-4632bb874fc7 state_transition=EVALUATION_ASSET_ALLOWLISTED -> EVALUATION_CONTRACT_VERIFIED occurred_at=2026-08-28T22:06:43Z
// state_transition=STATIC_OUTPUT -> LOCALLY_VERIFIED occurred_at=2026-08-28T22:05:45.777Z
// machine-contract: validation fails if the public output lacks WebMCP registration, strict projection, IndexedDB persistence, human-only permission, offline caching, or restrictive Vercel headers.

import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repositoryRoot, "dist");
const expectedFiles = Object.freeze([
  "index.html",
  "favicon.svg",
  "styles.css",
  "app.js",
  "browser-store.js",
  "webmcp-adapter.js",
  "service-worker.js",
  "webmcp-evals.json",
  "input-projection.js",
]);

for (const file of expectedFiles) {
  const details = await stat(resolve(outputRoot, file));
  assert(details.isFile() && details.size > 0, `${file} must be a non-empty file`);
}

const [html, app, adapter, store, worker, projection, evaluationsText, configText] = await Promise.all([
  readFile(resolve(outputRoot, "index.html"), "utf8"),
  readFile(resolve(outputRoot, "app.js"), "utf8"),
  readFile(resolve(outputRoot, "webmcp-adapter.js"), "utf8"),
  readFile(resolve(outputRoot, "browser-store.js"), "utf8"),
  readFile(resolve(outputRoot, "service-worker.js"), "utf8"),
  readFile(resolve(outputRoot, "input-projection.js"), "utf8"),
  readFile(resolve(outputRoot, "webmcp-evals.json"), "utf8"),
  readFile(resolve(repositoryRoot, "vercel.json"), "utf8"),
]);
const config = JSON.parse(configText);
const evaluations = JSON.parse(evaluationsText);

assert.match(html, /id="approve"[^>]*disabled/);
assert.match(html, /id="tool-status"/);
assert.match(html, /href="\/favicon\.svg"/);
assert.match(html, /≤ 1 effect/);
assert.match(html, /webmcp-evals\.json/);
assert.doesNotMatch(html, /\.local\/|SQLite・監査/);
assert.match(app, /Notification\.requestPermission\(\)/);
assert.match(app, /elements\.approve\.addEventListener/);
assert.match(app, /createOrReadDryRun/);
assert.doesNotMatch(app, /fetch\(["'`]\/api\//);
assert.match(adapter, /document\?\.modelContext|document\.modelContext/);
assert.match(adapter, /registerTool/);
assert.match(adapter, /projectNotificationToolInput\(input\)/);
assert.doesNotMatch(adapter, /Notification\.requestPermission|showNotification/);
assert.match(store, /indexedDB\.open/);
assert.match(store, /deriveIntentId/);
assert.match(store, /createUuidV7/);
assert.match(store, /effectStartCount cannot decrease/);
assert.match(worker, /cache\.addAll\(ASSETS\)/);
assert.doesNotMatch(worker, /sync|periodicSync/i);
assert.match(projection, /additionalProperties: false/);
assert.match(projection, /Stable caller-chosen ID/);
assert.equal(evaluations.measurementStatus, "UNMEASURED");
assert.equal(evaluations.applicationState.length, 1);
assert.equal(evaluations.applicationState[0].name, "notify_once");
assert.equal(evaluations.modelSelectionCases.length, 2);
assert(evaluations.modelSelectionCases.every((testCase) => {
  return testCase.expectedCall.length === 1
    && testCase.expectedCall[0].functionName === "notify_once"
    && testCase.expectedCall[0].arguments.logicalOperationId === "judge-demo-001";
}), "each model-selection case must select notify_once with the stable operation ID");
assert.deepEqual(evaluations.deterministicContractCases[0].expected, {
  controlState: "DRY_RUN",
  effectState: "NOT_STARTED",
  effectStartCount: 0,
  humanApprovalRequired: true,
});
assert.equal(config.buildCommand, "npm run build:web");
assert.equal(config.outputDirectory, "dist");
assert(config.headers.some((entry) => entry.headers.some((header) => {
  return header.key === "Content-Security-Policy" && header.value.includes("default-src 'self'");
})), "Content-Security-Policy must be configured");

const storeModule = await import(`${pathToFileURL(resolve(outputRoot, "browser-store.js")).href}?validation=1`);
const firstId = await storeModule.deriveIntentId("judge-demo-001");
const secondId = await storeModule.deriveIntentId("judge-demo-001");
assert.equal(firstId, secondId);
assert.match(firstId, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.match(storeModule.createUuidV7(1787954745777), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.match(await storeModule.digestPayload({
  logicalOperationId: "judge-demo-001",
  title: "Review ready",
  body: "The evidence is ready to inspect.",
}), /^[0-9a-f]{64}$/);

console.log(`Vercel public demo verified: ${expectedFiles.length} files`);
console.log(`Deterministic intent ID: ${firstId}`);

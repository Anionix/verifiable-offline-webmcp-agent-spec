#!/usr/bin/env node
// information_uuid_v5=6cea303b-7671-5332-b4aa-9cb3866937c8
// event_uuid_v7=01a04b41-fd38-77df-b156-c8f60d3c0ab8
// state_transition=COMBINED_HOST_VALIDATION -> SITES_PACKAGE_RECEIPT occurred_at=2026-08-29T02:03:31.000Z
// machine-contract: this validator proves only the Sites package roots, worker boundary, hosting identity copy, checkout-path absence, and the complete dist digest.

import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertDigestScope,
  assertExactFiles,
  digestTree,
  fullSitesPackageDigestScope,
  readJson,
  readText,
  repositoryRoot,
  requireNonEmptyFile,
  serverRoot,
  sitesPackageRoot,
} from "./hotel-validator-common.mjs";

const expectedServerFiles = Object.freeze([".vite/manifest.json", "index.js", "wrangler.json"]);
const expectedHostingFiles = Object.freeze(["hosting.json"]);
const hostingRoot = resolve(sitesPackageRoot, ".openai");

const packageEntries = (await readdir(sitesPackageRoot, { withFileTypes: true }))
  .map((entry) => `${entry.isDirectory() ? "directory" : "non-directory"}:${entry.name}`)
  .sort();
assert.deepEqual(
  packageEntries,
  ["directory:.openai", "directory:client", "directory:server"],
  "Sites package must contain only dist/.openai, dist/client, and dist/server",
);

await assertExactFiles(serverRoot, expectedServerFiles, "dist/server");
await assertExactFiles(hostingRoot, expectedHostingFiles, "dist/.openai");
for (const name of expectedServerFiles) await requireNonEmptyFile(resolve(serverRoot, name));
await requireNonEmptyFile(resolve(hostingRoot, "hosting.json"));

const [
  workerBundle,
  generatedManifest,
  generatedWrangler,
  sourceWranglerText,
  rootHostingText,
  builtHostingText,
  verification,
] = await Promise.all([
  readText(resolve(serverRoot, "index.js")),
  readJson(resolve(serverRoot, ".vite/manifest.json")),
  readJson(resolve(serverRoot, "wrangler.json")),
  readText(resolve(repositoryRoot, "wrangler.jsonc")),
  readText(resolve(repositoryRoot, ".openai/hosting.json")),
  readText(resolve(hostingRoot, "hosting.json")),
  readJson(resolve(repositoryRoot, "metadata/hotel-release-candidate.json")),
]);

assert.match(workerBundle, /ASSETS\.fetch/);
assert.doesNotMatch(workerBundle, /D1Database|R2Bucket|OPENAI_API_KEY/);

const workerManifest = generatedManifest["virtual:cloudflare/worker-entry"];
assert.equal(workerManifest?.file, "index.js");
assert.equal(workerManifest?.isEntry, true);

assert.equal(Object.hasOwn(generatedWrangler, "configPath"), false, "Sites package must not contain the local Wrangler configPath");
assert.equal(Object.hasOwn(generatedWrangler, "userConfigPath"), false, "Sites package must not contain the local Wrangler userConfigPath");
assert.equal(generatedWrangler.main, "index.js");
assert.equal(generatedWrangler.no_bundle, true);
assert.equal(generatedWrangler.assets?.binding, "ASSETS");
assert.equal(generatedWrangler.assets?.directory, "../client");
assert.deepEqual(generatedWrangler.vars, {}, "Sites package must not embed environment variables");

function findAbsolutePaths(value, path = "$") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findAbsolutePaths(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => findAbsolutePaths(child, `${path}.${key}`));
  }
  if (typeof value === "string" && (/^\/.+/u.test(value) || /^[A-Za-z]:[\\/]/u.test(value))) {
    return [`${path}=${value}`];
  }
  return [];
}

assert.deepEqual(findAbsolutePaths(generatedWrangler), [], "Sites package must not contain checkout-specific absolute paths");
assert.match(sourceWranglerText, /"main": "\.\/examples\/hotel-booking-demo\/worker\.js"/);
assert.match(sourceWranglerText, /"binding": "ASSETS"/);
assert.doesNotMatch(sourceWranglerText, /"directory"\s*:/);

assert.equal(builtHostingText, rootHostingText, "Sites hosting identity must be copied byte-for-byte");
const hosting = JSON.parse(builtHostingText);
assert.deepEqual(Object.keys(hosting), ["project_id"], "Sites hosting identity must contain only project_id");
assert.equal(typeof hosting.project_id, "string");
assert(hosting.project_id.length > 0, "Sites project_id must be persisted");

assertDigestScope(verification.artifacts.fullSitesScope, fullSitesPackageDigestScope, "full Sites package");
const fullSitesPackageDigest = await digestTree(sitesPackageRoot, fullSitesPackageDigestScope.excludedPaths);
assert.equal(
  verification.artifacts.fullSitesPackageSha256,
  fullSitesPackageDigest,
  "full Sites package digest differs from its scoped receipt",
);

console.log(JSON.stringify({
  receipt: "HOTEL_SITES_PACKAGE_VALIDATION_PASS",
  fullSitesPackageSha256: fullSitesPackageDigest,
  packageRoots: ["dist/.openai", "dist/client", "dist/server"],
  hostingIdentity: "PROJECT_ID_ONLY",
  checkoutAbsolutePaths: "ABSENT",
}));

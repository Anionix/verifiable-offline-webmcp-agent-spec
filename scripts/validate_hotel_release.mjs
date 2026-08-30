#!/usr/bin/env node
// information_uuid_v5=4f18aaff-864b-5bbd-a2ce-1c33f0add5f2
// event_uuid_v7=01a050c7-34b7-7168-8c64-9443fbe87f36 state_transition=RELEASE_DIRECTORY_READY -> RELEASE_DIRECTORY_READBACK_VERIFIED occurred_at=2026-08-30T04:20:00.000Z
// event_uuid_v7=01a05389-207c-70de-bf85-38e4f8931ecb state_transition=RELEASE_DIRECTORY_READBACK_VERIFIED -> RELEASE_FILE_SET_READBACK_VERIFIED occurred_at=2026-08-30T16:38:10.812Z
// machine-contract: the release manifest, presentation documents, and sorted SHA-256 list must all describe the same ignored release directory without video binaries, credentials, or environment files.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultReleaseRoot = resolve(repositoryRoot, "release/kyoto-booking-retry-proof");

function releaseRootFromArguments() {
  const optionIndex = process.argv.indexOf("--release-root");
  if (optionIndex === -1) return defaultReleaseRoot;
  const optionValue = process.argv[optionIndex + 1];
  assert.ok(optionValue && !optionValue.startsWith("--"), "--release-root requires a directory");
  return resolve(optionValue);
}

const releaseRoot = releaseRootFromArguments();
const requiredFiles = [
  "README.md",
  "DEVPOST_VISUAL_GUIDE.md",
  "DEVPOST_VISUAL_GUIDE_JA.md",
  "RELEASE_GUIDE.md",
  "LICENSE",
  "release-manifest.json",
  "SHA256SUMS",
];
const forbiddenExtensions = new Set([".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"]);

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function textFile(relativePath) {
  return readFile(resolve(releaseRoot, relativePath), "utf8");
}

async function regularFiles(relativeDirectory = "") {
  const absoluteDirectory = resolve(releaseRoot, relativeDirectory);
  const directory = await lstat(absoluteDirectory);
  if (directory.isSymbolicLink()) assert.fail(`${relativeDirectory || "release root"} must not be a symbolic link`);
  assert.ok(directory.isDirectory(), `${relativeDirectory || "release root"} must be a directory`);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) assert.fail(`${relativePath} must not be a symbolic link`);
    if (entry.isDirectory()) files.push(...(await regularFiles(relativePath)));
    else if (entry.isFile()) files.push(relativePath);
    else assert.fail(`${relativePath} must be a regular file`);
  }
  return files;
}

const actualPaths = await regularFiles();
const manifest = JSON.parse(await textFile("release-manifest.json"));
assert.equal(manifest.presentation?.primaryReadme, "README.md", "manifest primary README is not bound");
assert.equal(manifest.presentation?.visualGuideEnglish, "DEVPOST_VISUAL_GUIDE.md", "manifest English visual guide is not bound");
assert.equal(manifest.presentation?.visualGuideJapanese, "DEVPOST_VISUAL_GUIDE_JA.md", "manifest Japanese visual guide is not bound");
assert.equal(manifest.presentation?.releaseGuide, "RELEASE_GUIDE.md", "manifest release guide is not bound");
assert.match(manifest.source?.commit ?? "", /^[0-9a-f]{40}$/u, "manifest source commit is not a full hash");

const readme = await textFile("README.md");
assert.match(readme, /Kyoto Booking Retry Proof/u);
assert.match(readme, /2 attempts → 1 simulated booking → 1 confirmation number/u);
assert.match(readme, /check_existing_hotel_booking/u);
const guide = await textFile("DEVPOST_VISUAL_GUIDE.md");
assert.match(guide, /01-hero-empty/u);
assert.match(guide, /05-retry-recognized/u);
assert.match(guide, /AI-generated dramatization \/ Fictional booking/u);
assert.match(await textFile("DEVPOST_VISUAL_GUIDE_JA.md"), /60秒/u);
assert.match(await textFile("RELEASE_GUIDE.md"), /shasum -a 256 -c SHA256SUMS/u);

const checksumLines = (await textFile("SHA256SUMS")).trim().split("\n").filter(Boolean);
assert.ok(checksumLines.length > requiredFiles.length, "checksum list is unexpectedly empty");
const checksumPaths = new Set();
const checksumRecords = [];
for (const line of checksumLines) {
  const match = /^(?<sha>[0-9a-f]{64})  (?<path>[^\n]+)$/u.exec(line);
  assert.ok(match?.groups, `invalid checksum line: ${line}`);
  const relativePath = match.groups.path;
  assert.ok(!checksumPaths.has(relativePath), `duplicate checksum path: ${relativePath}`);
  checksumPaths.add(relativePath);
  checksumRecords.push(match.groups);
}
const actualPathSet = new Set(actualPaths);
const unlistedPaths = actualPaths.filter((relativePath) => relativePath !== "SHA256SUMS" && !checksumPaths.has(relativePath)).sort();
assert.deepEqual(unlistedPaths, [], `unlisted release files: ${unlistedPaths.join(", ")}`);
const missingPaths = [...checksumPaths].filter((relativePath) => relativePath !== "SHA256SUMS" && !actualPathSet.has(relativePath)).sort();
assert.deepEqual(missingPaths, [], `checksum-listed files missing: ${missingPaths.join(", ")}`);
for (const { sha, path: relativePath } of checksumRecords) {
  const extension = relativePath.includes(".") ? relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase() : "";
  assert.ok(!forbiddenExtensions.has(extension), `${relativePath} must not contain a video binary`);
  assert.ok(!/(?:^|\/)\.env(?:\.|$)/u.test(relativePath), `${relativePath} must not contain an environment file`);
  const absolutePath = resolve(releaseRoot, relativePath);
  assert.ok(absolutePath === releaseRoot || absolutePath.startsWith(`${releaseRoot}${sep}`), `${relativePath} escapes the release root`);
  const bytes = await readFile(absolutePath);
  assert.equal(digest(bytes), sha, `${relativePath} digest differs from SHA256SUMS`);
}
assert.ok(!checksumPaths.has("SHA256SUMS"), "checksum file must not self-reference");
for (const relativePath of requiredFiles.filter((path) => path !== "SHA256SUMS")) assert.ok(checksumPaths.has(relativePath), `${relativePath} is not recorded`);

console.log(JSON.stringify({ receipt: "HOTEL_RELEASE_READBACK_PASS", directory: "release/kyoto-booking-retry-proof", files: checksumLines.length }));

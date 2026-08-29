#!/usr/bin/env node
// information_uuid_v5=f26c8714-a704-5f83-a2af-c7231c73c28c
// event_uuid_v7=01a04dbb-0fa0-71e1-93a4-f4100e947b72 state_transition=UNPACKAGED_HOTEL_ARTIFACT -> REPRODUCIBLE_RELEASE_CONTRACT_IMPLEMENTED occurred_at=2026-08-29T13:35:00.000Z
// machine-contract: one clean commit produces an allowlisted release directory plus stable JSON and SHA-256 file receipts; video, environment files, and credentials are excluded.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  clientRoot,
  digestTree,
  fullClientDigestScope,
  fullSitesPackageDigestScope,
  functionalDigestScope,
  sitesPackageRoot,
} from "./hotel-validator-common.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = resolve(repositoryRoot, "release/kyoto-booking-retry-proof");
const namespaceUuidV5 = "47f3e535-0e27-559a-9556-aa79a84f95eb";
const informationUuidV5 = "55e8dd64-ba47-5c26-897d-aa6893eb5ec5";
const forbiddenExtensions = new Set([".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"]);

function command(name, args) {
  return execFileSync(name, args, { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

function assertCleanSource(sourceCommit) {
  assert.equal(command("git", ["status", "--porcelain=v1", "--untracked-files=all"]), "", "release requires a clean committed source");
  assert.equal(command("git", ["rev-parse", "HEAD"]), sourceCommit, "release source commit changed during generation");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function posix(root, path) {
  return relative(root, path).split(sep).join("/");
}

async function filesUnder(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`${posix(repositoryRoot, path)} must not be a link or special file`);
  }
  return files.sort((left, right) => posix(root, left).localeCompare(posix(root, right), "en"));
}

function deterministicUuidV7(epochMs, seed) {
  const random = createHash("sha256").update(seed).digest();
  const value =
    ((BigInt(epochMs) & ((1n << 48n) - 1n)) << 80n) |
    (7n << 76n) |
    (BigInt(random.readUInt16BE(0) & 0x0fff) << 64n) |
    (2n << 62n) |
    (BigInt(`0x${random.subarray(2, 10).toString("hex")}`) & ((1n << 62n) - 1n));
  const hex = value.toString(16).padStart(32, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireHttps(value, label) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", `${label} must use HTTPS`);
  assert.equal(url.username, "", `${label} must not contain credentials`);
  assert.equal(url.password, "", `${label} must not contain credentials`);
  return value;
}

async function json(path) {
  return JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8"));
}

async function fileReceipt(path) {
  const bytes = await readFile(path);
  const relativePath = posix(releaseRoot, path);
  const extension = relativePath.includes(".") ? relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase() : "";
  assert(!forbiddenExtensions.has(extension), `${relativePath} must not contain a video binary`);
  assert(!/(?:^|\/)\.env(?:\.|$)/u.test(relativePath), `${relativePath} must not contain an environment file`);
  return { path: relativePath, bytes: bytes.length, sha256: sha256(bytes) };
}

const sourceCommit = command("git", ["rev-parse", "HEAD"]);
assert.match(sourceCommit, /^[0-9a-f]{40}$/u);
assertCleanSource(sourceCommit);
const commitSeconds = Number(command("git", ["show", "-s", "--format=%ct", sourceCommit]));
assert(Number.isSafeInteger(commitSeconds), "source commit time is invalid");
const occurredAt = new Date(commitSeconds * 1000).toISOString();

command(process.execPath, ["scripts/build_web_site.mjs"]);
command(process.execPath, ["scripts/validate_hotel_portable_validator.mjs"]);
command(process.execPath, ["scripts/validate_hotel_sites_validator.mjs"]);

const [verification, vercel, video, devpost] = await Promise.all([
  json("metadata/hotel-booking-verification.json"),
  json("metadata/vercel-hotel-deployment.json"),
  json("metadata/demo-video-production.json"),
  json("metadata/devpost-public-readback.json"),
]);
const functionalDigest = await digestTree(clientRoot, functionalDigestScope.excludedPaths);
const fullClientDigest = await digestTree(clientRoot, fullClientDigestScope.excludedPaths);
const fullSitesDigest = await digestTree(sitesPackageRoot, fullSitesPackageDigestScope.excludedPaths);
assert.equal(verification.artifactDigest, functionalDigest);
assert.equal(verification.fullClientArtifactDigest, fullClientDigest);
assert.equal(verification.fullSitesPackageDigest, fullSitesDigest);

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(resolve(releaseRoot, "dist"), { recursive: true });
await Promise.all([
  cp(resolve(repositoryRoot, "dist/client"), resolve(releaseRoot, "dist/client"), { recursive: true }),
  cp(resolve(repositoryRoot, "dist/server"), resolve(releaseRoot, "dist/server"), { recursive: true }),
  cp(resolve(repositoryRoot, "dist/.openai"), resolve(releaseRoot, "dist/.openai"), { recursive: true }),
  cp(resolve(repositoryRoot, "README.md"), resolve(releaseRoot, "README.md")),
  cp(resolve(repositoryRoot, "LICENSE"), resolve(releaseRoot, "LICENSE")),
]);

const payloadReceipts = await Promise.all((await filesUnder(releaseRoot)).map(fileReceipt));
const eventUuidV7 = deterministicUuidV7(commitSeconds * 1000, `${sourceCommit}\0${functionalDigest}\0${fullSitesDigest}`);
const manifest = {
  format: { name: "OpenKnowledgeFormat-inspired hotel release", version: "1.0" },
  identity: { namespaceUuidV5, informationUuidV5, eventUuidV7 },
  stateTransition: {
    from: "COMMITTED_SOURCE",
    to: "REPRODUCIBLE_RELEASE_DIRECTORY_READY",
    occurredAt,
    eventUuidV7,
    machineContract: "The sorted SHA-256 file list binds the allowlisted release directory to one source commit.",
  },
  source: { commit: sourceCommit, committedAt: occurredAt },
  digests: {
    functionalClientSha256: functionalDigest,
    fullClientSha256: fullClientDigest,
    fullSitesPackageSha256: fullSitesDigest,
  },
  publicLinks: {
    chatGptSite: requireHttps(verification.liveDeployment.url, "ChatGPT Site URL"),
    devpost: requireHttps(devpost.anonymousPublicHtml.url, "Devpost URL"),
    sourceRepository: "https://github.com/Anionix/verifiable-offline-webmcp-agent-spec",
    vercelFallback: requireHttps(vercel.deployment.publicAlias, "Vercel URL"),
    youtubeVideo: requireHttps(video.publication.youtubeUrl, "YouTube URL"),
  },
  quickStart60Seconds: [
    "Select 1. Check and prepare.",
    "Verify PREPARED, then select 2. Confirm booking — human action only.",
    "Select Retry the same booking.",
    "Verify RETRY_RECOGNIZED, attempts 2, bookings 1, effect starts 1, and the same confirmation number.",
  ],
  license: { spdx: "Apache-2.0", path: "LICENSE" },
  boundaries: {
    booking: "Fictional device-local demonstration; no real booking, payment, email, or cancellation.",
    excluded: ["video binaries", "credentials", "environment files", "personal information"],
    receiptScope: "files lists every release item except release-manifest.json and SHA256SUMS to avoid self-reference.",
  },
  files: payloadReceipts,
};
await writeFile(resolve(releaseRoot, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const allReceipts = await Promise.all((await filesUnder(releaseRoot)).map(fileReceipt));
await writeFile(resolve(releaseRoot, "SHA256SUMS"), `${allReceipts.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n")}\n`);
command("gitleaks", ["dir", releaseRoot, "--redact", "--no-banner"]);
assertCleanSource(sourceCommit);

console.log(
  JSON.stringify({
    receipt: "HOTEL_RELEASE_DIRECTORY_CREATED",
    directory: posix(repositoryRoot, releaseRoot),
    sourceCommit,
    functionalDigest,
    fullClientDigest,
    fullSitesDigest,
    fileCount: allReceipts.length + 1,
    sha256Sums: "release/kyoto-booking-retry-proof/SHA256SUMS",
  }),
);

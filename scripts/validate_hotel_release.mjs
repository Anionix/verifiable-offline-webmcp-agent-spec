#!/usr/bin/env node
// information_uuid_v5=4f18aaff-864b-5bbd-a2ce-1c33f0add5f2
// event_uuid_v7=01a050c7-34b7-7168-8c64-9443fbe87f36 state_transition=RELEASE_DIRECTORY_READY -> RELEASE_DIRECTORY_READBACK_VERIFIED occurred_at=2026-08-30T04:20:00.000Z
// event_uuid_v7=01a05389-207c-70de-bf85-38e4f8931ecb state_transition=RELEASE_DIRECTORY_READBACK_VERIFIED -> RELEASE_FILE_SET_READBACK_VERIFIED occurred_at=2026-08-30T16:38:10.812Z
// event_uuid_v7=01a053b4-8051-7707-9492-e22d539ff62d state_transition=PATH_SNAPSHOT_UNBOUND -> DESCRIPTOR_IDENTITY_BOUND_READ occurred_at=2026-08-30T17:25:33.393Z
// event_uuid_v7=01a0545f-a323-7754-9efb-891d12216f19 state_transition=RELEASE_FILE_SET_READBACK_VERIFIED -> RELEASE_FILE_SET_FINAL_ENUMERATION_VERIFIED occurred_at=2026-08-30T20:32:28.963Z
// event_uuid_v7=01a05466-11dc-7121-b1fd-4a8017c96aa5 state_transition=CLI_PATH_GUARD_UNRESOLVED -> CLI_MAIN_ENTRYPOINT_VERIFIED occurred_at=2026-08-30T20:39:30.524Z
// event_uuid_v7=01a05471-12e1-7902-81e5-896ed0c6aff4 state_transition=WINDOWS_RELEASE_VALIDATION_UNSUPPORTED -> WINDOWS_RELEASE_VALIDATION_FAIL_CLOSED occurred_at=2026-08-30T20:51:31.681Z
// event_uuid_v7=01a05478-ac4b-704b-aca2-769202026762 state_transition=RELEASE_BYTES_INITIAL_HASHED -> RELEASE_BYTES_FINAL_HASH_VERIFIED occurred_at=2026-08-30T20:59:49.707Z
// event_uuid_v7=01a05490-b710-7496-8f7c-77058578081e state_transition=RELEASE_BYTES_FINAL_HASH_VERIFIED -> RELEASE_FILE_SET_FINAL_ENUMERATION_VERIFIED occurred_at=2026-08-30T21:26:05.328Z
// event_uuid_v7=01a05499-4fe4-7433-9cef-be33da14a776 state_transition=RELEASE_ANCESTOR_CHAIN_UNVERIFIED -> RELEASE_ANCESTOR_CHAIN_VERIFIED occurred_at=2026-08-30T21:35:28.740Z
// machine-contract: the release manifest, presentation documents, and sorted SHA-256 list must all describe the same ignored release directory without video binaries, credentials, or environment files.
// machine-contract: directory and file identities are captured with lstat, checked again around enumeration, and bound to a non-following nonblocking descriptor before any bytes are read.
// machine-contract: the final release-tree enumeration must match the initial snapshot's paths and lstat identities; this detects races but does not promise an atomic snapshot.
// machine-contract: a second final release-tree enumeration follows the final hash reads to detect path-set or identity races at that boundary; this remains a bounded race check, not an atomic snapshot.
// machine-contract: the Node 24.15 CLI entrypoint check must not depend on the spelling or realpath of a filesystem symlink.
// machine-contract: Windows fails before any release file operation because this validator cannot guarantee a safe non-following open there; no override flag exists.
// machine-contract: every initial snapshot byte stream is hashed and each final non-following descriptor read must reproduce that hash; this detects same-inode rewrites but does not promise an atomic snapshot or prohibit later writes.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultReleaseRoot = resolve(repositoryRoot, "release/kyoto-booking-retry-proof");
const safeFileOpenFlags = constants.O_RDONLY | constants.O_NONBLOCK | (process.platform === "win32" ? 0 : constants.O_NOFOLLOW);
const unsupportedPlatformError = "hotel release validation is unsupported on Windows: safe non-following file opens cannot be guaranteed";

function releaseRootFromArguments() {
  const optionIndex = process.argv.indexOf("--release-root");
  if (optionIndex === -1) return defaultReleaseRoot;
  const optionValue = process.argv[optionIndex + 1];
  assert.ok(optionValue && !optionValue.startsWith("--"), "--release-root requires a directory");
  return resolve(optionValue);
}

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

function fileType(stats) {
  if (stats.isFile()) return "file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic link";
  return "special file";
}

function identity(stats) {
  return { dev: stats.dev, ino: stats.ino, type: fileType(stats) };
}

function assertIdentity(expected, actual, subject) {
  assert.equal(actual.type, expected.type, `${subject} type changed during validation`);
  assert.equal(actual.dev, expected.dev, `${subject} device changed during validation`);
  assert.equal(actual.ino, expected.ino, `${subject} inode changed during validation`);
}

function assertSameAncestorChain(initialSnapshot, finalSnapshot) {
  const initialAncestors = initialSnapshot.ancestorDirectories;
  const finalAncestors = finalSnapshot.ancestorDirectories;
  assert.equal(finalAncestors.length, initialAncestors.length, `${initialSnapshot.relativePath} ancestor chain length changed after final enumeration`);
  for (let index = 0; index < initialAncestors.length; index += 1) {
    const initialAncestor = initialAncestors[index];
    const finalAncestor = finalAncestors[index];
    assert.equal(finalAncestor.relativePath, initialAncestor.relativePath, `${initialSnapshot.relativePath} ancestor path changed after final enumeration`);
    assertIdentity(
      initialAncestor.identity,
      finalAncestor.identity,
      `${initialSnapshot.relativePath} ancestor ${directoryLabel(initialAncestor.relativePath)} changed after final enumeration`,
    );
  }
}

function directoryLabel(relativeDirectory) {
  return relativeDirectory || "release root";
}

async function assertCurrentDirectory(absoluteDirectory, expectedIdentity, relativeDirectory) {
  const current = await lstat(absoluteDirectory, { bigint: true });
  const label = directoryLabel(relativeDirectory);
  if (current.isSymbolicLink()) assert.fail(`${label} must not be a symbolic link`);
  assert.ok(current.isDirectory(), `${label} must be a directory`);
  assertIdentity(expectedIdentity, identity(current), `${label} changed`);
}

async function assertCurrentFile(snapshot, phase) {
  for (const ancestor of snapshot.ancestorDirectories) await assertCurrentDirectory(ancestor.absolutePath, ancestor.identity, ancestor.relativePath);
  const current = await lstat(snapshot.absolutePath, { bigint: true });
  if (current.isSymbolicLink()) assert.fail(`${snapshot.relativePath} must not be a symbolic link`);
  assert.ok(current.isFile(), `${snapshot.relativePath} must be a regular file`);
  assertIdentity(snapshot.identity, identity(current), `${snapshot.relativePath} changed ${phase}`);
}

async function regularFiles(releaseRoot, relativeDirectory = "", expectedIdentity = null, ancestorDirectories = []) {
  const absoluteDirectory = resolve(releaseRoot, relativeDirectory);
  const label = directoryLabel(relativeDirectory);
  const before = await lstat(absoluteDirectory, { bigint: true });
  if (before.isSymbolicLink()) assert.fail(`${label} must not be a symbolic link`);
  assert.ok(before.isDirectory(), `${label} must be a directory`);
  const beforeIdentity = identity(before);
  if (expectedIdentity) assertIdentity(expectedIdentity, beforeIdentity, label);

  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const after = await lstat(absoluteDirectory, { bigint: true });
  if (after.isSymbolicLink()) assert.fail(`${label} must not be a symbolic link`);
  assert.ok(after.isDirectory(), `${label} must be a directory`);
  const directoryIdentity = identity(after);
  assertIdentity(beforeIdentity, directoryIdentity, `${label} changed while enumerating`);
  const currentDirectory = { absolutePath: absoluteDirectory, relativePath: relativeDirectory, identity: directoryIdentity };
  const allAncestorDirectories = [...ancestorDirectories, currentDirectory];

  const files = [];
  for (const entry of entries) {
    await assertCurrentDirectory(absoluteDirectory, directoryIdentity, relativeDirectory);
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const absolutePath = resolve(releaseRoot, relativePath);
    const entryStats = await lstat(absolutePath, { bigint: true });
    if (entryStats.isSymbolicLink()) assert.fail(`${relativePath} must not be a symbolic link`);
    const entryIdentity = identity(entryStats);
    if (entryStats.isDirectory()) {
      files.push(...(await regularFiles(releaseRoot, relativePath, entryIdentity, allAncestorDirectories)));
    } else if (entryStats.isFile()) {
      files.push({
        relativePath,
        absolutePath,
        identity: entryIdentity,
        ancestorDirectories: allAncestorDirectories,
      });
    } else assert.fail(`${relativePath} must be a regular file`);
    await assertCurrentDirectory(absoluteDirectory, directoryIdentity, relativeDirectory);
  }
  return files;
}

async function readSnapshot(snapshot) {
  await assertCurrentFile(snapshot, "before opening");
  let descriptor;
  try {
    descriptor = await open(snapshot.absolutePath, safeFileOpenFlags);
  } catch (error) {
    if (error?.code === "ELOOP") assert.fail(`${snapshot.relativePath} must not be a symbolic link`);
    throw error;
  }
  try {
    await assertCurrentFile(snapshot, "after opening");
    const opened = await descriptor.stat({ bigint: true });
    assert.ok(opened.isFile(), `${snapshot.relativePath} must be a regular file`);
    assertIdentity(snapshot.identity, identity(opened), `${snapshot.relativePath} changed before reading`);
    await assertCurrentFile(snapshot, "before reading");
    const bytes = await descriptor.readFile();
    await assertCurrentFile(snapshot, "after reading");
    return bytes;
  } finally {
    await descriptor.close();
  }
}

function assertSameSnapshot(initialSnapshots, finalSnapshots) {
  const initialByPath = new Map(initialSnapshots.map((snapshot) => [snapshot.relativePath, snapshot]));
  const finalByPath = new Map(finalSnapshots.map((snapshot) => [snapshot.relativePath, snapshot]));
  const initialPaths = [...initialByPath.keys()].sort();
  const finalPaths = [...finalByPath.keys()].sort();
  const addedPaths = finalPaths.filter((relativePath) => !initialByPath.has(relativePath));
  const removedPaths = initialPaths.filter((relativePath) => !finalByPath.has(relativePath));
  assert.deepEqual(
    { added: addedPaths, removed: removedPaths },
    { added: [], removed: [] },
    `release file set changed after snapshot: added=${addedPaths.join(", ")}; removed=${removedPaths.join(", ")}`,
  );
  for (const relativePath of initialPaths) {
    const initialSnapshot = initialByPath.get(relativePath);
    const finalSnapshot = finalByPath.get(relativePath);
    assertIdentity(initialSnapshot.identity, finalSnapshot.identity, `${relativePath} changed after final enumeration`);
    assertSameAncestorChain(initialSnapshot, finalSnapshot);
  }
}

async function assertSameSnapshotBytes(snapshots, initialDigests) {
  assert.equal(initialDigests.size, snapshots.length, "not every release snapshot has an initial digest");
  for (const snapshot of snapshots) {
    const initialDigest = initialDigests.get(snapshot.relativePath);
    assert.ok(initialDigest, `${snapshot.relativePath} has no initial digest`);
    const bytes = await readSnapshot(snapshot);
    assert.equal(digest(bytes), initialDigest, `${snapshot.relativePath} content changed after initial read`);
  }
}

export async function validateRelease(releaseRoot = defaultReleaseRoot, { afterSnapshot, afterInitialRead, afterFinalRead } = {}) {
  if (process.platform === "win32") throw new Error(unsupportedPlatformError);
  const resolvedReleaseRoot = resolve(releaseRoot);
  const snapshots = await regularFiles(resolvedReleaseRoot);
  const snapshotByPath = new Map(snapshots.map((snapshot) => [snapshot.relativePath, snapshot]));
  // These callbacks are in-process test seams; the command-line validator never supplies them.
  await afterSnapshot?.(snapshots);
  const initialDigests = new Map();

  async function readInitialSnapshot(snapshot) {
    const bytes = await readSnapshot(snapshot);
    const currentDigest = digest(bytes);
    const initialDigest = initialDigests.get(snapshot.relativePath);
    if (initialDigest === undefined) initialDigests.set(snapshot.relativePath, currentDigest);
    else assert.equal(currentDigest, initialDigest, `${snapshot.relativePath} content changed during initial validation`);
    return bytes;
  }

  async function textFile(relativePath) {
    const snapshot = snapshotByPath.get(relativePath);
    assert.ok(snapshot, `${relativePath} is missing from the release snapshot`);
    return (await readInitialSnapshot(snapshot)).toString("utf8");
  }

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
  const actualPaths = snapshots.map((snapshot) => snapshot.relativePath);
  const actualPathSet = new Set(actualPaths);
  const unlistedPaths = actualPaths.filter((relativePath) => relativePath !== "SHA256SUMS" && !checksumPaths.has(relativePath)).sort();
  assert.deepEqual(unlistedPaths, [], `unlisted release files: ${unlistedPaths.join(", ")}`);
  const missingPaths = [...checksumPaths].filter((relativePath) => relativePath !== "SHA256SUMS" && !actualPathSet.has(relativePath)).sort();
  assert.deepEqual(missingPaths, [], `checksum-listed files missing: ${missingPaths.join(", ")}`);
  for (const { sha, path: relativePath } of checksumRecords) {
    const extension = relativePath.includes(".") ? relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase() : "";
    assert.ok(!forbiddenExtensions.has(extension), `${relativePath} must not contain a video binary`);
    assert.ok(!/(?:^|\/)\.env(?:\.|$)/u.test(relativePath), `${relativePath} must not contain an environment file`);
    const absolutePath = resolve(resolvedReleaseRoot, relativePath);
    assert.ok(absolutePath === resolvedReleaseRoot || absolutePath.startsWith(`${resolvedReleaseRoot}${sep}`), `${relativePath} escapes the release root`);
    const snapshot = snapshotByPath.get(relativePath);
    assert.ok(snapshot, `${relativePath} is missing from the release snapshot`);
    const bytes = await readInitialSnapshot(snapshot);
    assert.equal(digest(bytes), sha, `${relativePath} digest differs from SHA256SUMS`);
  }
  assert.ok(!checksumPaths.has("SHA256SUMS"), "checksum file must not self-reference");
  for (const relativePath of requiredFiles.filter((path) => path !== "SHA256SUMS"))
    assert.ok(checksumPaths.has(relativePath), `${relativePath} is not recorded`);

  await afterInitialRead?.(snapshots);
  const finalSnapshots = await regularFiles(resolvedReleaseRoot);
  assertSameSnapshot(snapshots, finalSnapshots);
  await assertSameSnapshotBytes(finalSnapshots, initialDigests);
  await afterFinalRead?.(finalSnapshots);
  assertSameSnapshot(snapshots, await regularFiles(resolvedReleaseRoot));

  return {
    receipt: "HOTEL_RELEASE_READBACK_PASS",
    directory: resolvedReleaseRoot === defaultReleaseRoot ? "release/kyoto-booking-retry-proof" : resolvedReleaseRoot,
    files: checksumLines.length,
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(await validateRelease(releaseRootFromArguments())));
}

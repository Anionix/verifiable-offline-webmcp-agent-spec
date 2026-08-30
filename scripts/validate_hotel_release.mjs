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
// event_uuid_v7=01a054a4-27a9-75a2-8762-c0fd4bcb86f0 state_transition=RELEASE_DIRECTORY_ENUMERATION_UNBOUND -> RELEASE_DIRECTORY_FD3_ENUMERATION_VERIFIED occurred_at=2026-08-30T21:47:19.337Z
// event_uuid_v7=01a054bb-6f17-785d-aa07-2420c4ff811e state_transition=RELEASE_ROOT_DESCRIPTOR_UNBOUND -> RELEASE_ROOT_DESCRIPTOR_HELD occurred_at=2026-08-30T22:12:44.951Z
// event_uuid_v7=01a054d4-db72-7bfb-9cef-252977d955c6 state_transition=RELEASE_ROOT_PATH_CHECK_USE_UNVERIFIED -> RELEASE_ROOT_DESCRIPTOR_FIRST_OPEN_VERIFIED occurred_at=2026-08-30T22:40:31.090Z
// machine-contract: the release manifest, presentation documents, and sorted SHA-256 list must all describe the same ignored release directory without video binaries, credentials, or environment files.
// machine-contract: the resolved release-root entry is checked by Node, while all nested directory names, identities, and file bytes are resolved relative to one held root descriptor.
// machine-contract: each helper request receives only root fd 3 and strict relative components; the helper opens every directory ancestor with O_NOFOLLOW|O_DIRECTORY and fstat-checks expected identities.
// machine-contract: root ancestors above the resolved release-root entry are trusted and are not descriptor-bound because Node 24.15 has no openat-style directory API; the root entry itself is checked before and after validation.
// machine-contract: nested stat and file reads never use absolute paths; regular files use O_RDONLY|O_NONBLOCK|O_NOFOLLOW, expected identity checks, bounded bytes, and descriptor close.
// machine-contract: timeout, output-limit, and stdio errors kill a spawned helper and settle only after close; spawn-before errors have no child to reap, and validateRelease keeps root fd 3 until finally closes it.
// machine-contract: each directory list and each complete release-tree enumeration has a finite entry limit; one validation also has a finite deadline to bound helper-process work.
// machine-contract: the final release-tree enumeration must match the initial snapshot's paths and lstat identities; this detects races but does not promise an atomic snapshot.
// machine-contract: a second final release-tree enumeration follows the final hash reads to detect path-set or identity races at that boundary; this remains a bounded race check, not an atomic snapshot.
// machine-contract: the Node 24.15 CLI entrypoint check must not depend on the spelling or realpath of a filesystem symlink.
// machine-contract: Windows fails before any release file operation because this validator cannot guarantee a safe non-following open there; no override flag exists.
// machine-contract: every initial snapshot byte stream is hashed and each final non-following descriptor read must reproduce that hash; this detects same-inode rewrites but does not promise an atomic snapshot or prohibit later writes.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultReleaseRoot = resolve(repositoryRoot, "release/kyoto-booking-retry-proof");
const safeDirectoryOpenFlags = constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (process.platform === "win32" ? 0 : (constants.O_NOFOLLOW ?? 0));
const boundRootHelperPath = resolve(repositoryRoot, "scripts/list_directory_fd.py");
const boundRootHelperTimeoutMs = 5_000;
const boundRootHelperRequestMaxBytes = 128 * 1024;
const boundRootHelperFileMaxBytes = 8 * 1024 * 1024;
const boundRootHelperOutputMaxBytes = boundRootHelperFileMaxBytes + 64 * 1024;
const boundRootHelperStderrMaxBytes = 64 * 1024;
const boundRootHelperMaxEntries = 4_096;
const releaseSnapshotMaxEntries = 4_096;
const releaseValidationTimeoutMs = 30_000;
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

function strictComponent(component, label) {
  assert.equal(typeof component, "string", `${label} must be a string component`);
  assert.ok(component.length > 0, `${label} must not be empty`);
  assert.notEqual(component, ".", `${label} must not be .`);
  assert.notEqual(component, "..", `${label} must not be ..`);
  assert.ok(!component.includes("/"), `${label} must not contain /`);
  assert.ok(!component.includes("\\"), `${label} must not contain \\`);
  assert.ok(!component.includes("\0"), `${label} must not contain a null byte`);
  return component;
}

function relativeComponents(relativePath) {
  if (relativePath === "") return [];
  return relativePath.split("/").map((component, index) => strictComponent(component, `relative component ${index}`));
}

function relativePathOf(components) {
  return components.join("/");
}

function wireIdentity(value) {
  return { dev: value.dev.toString(), ino: value.ino.toString(), type: value.type };
}

function parseWireIdentity(value, label) {
  assert.ok(value && typeof value === "object", `${label} must be an identity object`);
  assert.equal(typeof value.dev, "string", `${label}.dev must be a decimal string`);
  assert.equal(typeof value.ino, "string", `${label}.ino must be a decimal string`);
  assert.match(value.dev, /^\d+$/u, `${label}.dev must be a decimal string`);
  assert.match(value.ino, /^\d+$/u, `${label}.ino must be a decimal string`);
  assert.ok(["file", "directory", "symbolic link", "special file"].includes(value.type), `${label}.type is invalid`);
  return { dev: BigInt(value.dev), ino: BigInt(value.ino), type: value.type };
}

async function assertRootLocation(context, phase) {
  assertValidationTime(context, `${phase} root check`);
  let current;
  try {
    current = await lstat(context.resolvedReleaseRoot, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") assert.fail(`release root changed ${phase}`);
    throw error;
  }
  if (current.isSymbolicLink()) assert.fail(`release root must not be a symbolic link ${phase}`);
  assert.ok(current.isDirectory(), `release root must be a directory ${phase}`);
  assertIdentity(context.rootIdentity, identity(current), `release root changed ${phase}`);
}

function assertValidationTime(context, label) {
  const remainingMs = context.deadlineAt - Date.now();
  assert.ok(remainingMs > 0, `release validation exceeded its total deadline at ${label}`);
  return remainingMs;
}

function expectedDirectoryChain(context, ancestors, target = null) {
  const chain = [{ components: [], identity: context.rootIdentity }];
  for (const directory of ancestors) {
    if (directory.components.length > 0) chain.push({ components: directory.components, identity: directory.identity });
  }
  if (target && target.components.length > 0) chain.push(target);
  return chain.map((directory) => ({ components: directory.components, identity: wireIdentity(directory.identity) }));
}

async function runBoundRootHelper(context, request, label) {
  const requestBytes = Buffer.from(`${JSON.stringify(request)}\n`, "utf8");
  assert.ok(requestBytes.length <= boundRootHelperRequestMaxBytes, `${label} helper request exceeded its byte limit`);
  const remainingMs = assertValidationTime(context, `${label} helper start`);
  const child = spawn("python3", ["-I", boundRootHelperPath], {
    cwd: repositoryRoot,
    shell: false,
    stdio: ["pipe", "pipe", "pipe", context.rootHandle.fd],
  });
  const stdout = [];
  const stderr = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let termination = null;

  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let spawned = false;
    let timer;
    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(error);
    };
    const settleResolve = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(value);
    };
    const stop = (reason) => {
      if (settled || termination) return;
      termination = reason;
      child.stdin.destroy();
      child.kill("SIGKILL");
    };
    const timerReason = () =>
      new Error(remainingMs <= boundRootHelperTimeoutMs ? `${label} helper reached the release validation deadline` : `${label} helper timed out`);
    timer = setTimeout(() => stop(timerReason()), Math.min(boundRootHelperTimeoutMs, remainingMs));
    const collect = (chunks, stream) => (chunk) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (stream === "stdout") stdoutBytes += bytes.length;
      else stderrBytes += bytes.length;
      const limit = stream === "stdout" ? boundRootHelperOutputMaxBytes : boundRootHelperStderrMaxBytes;
      if ((stream === "stdout" ? stdoutBytes : stderrBytes) > limit) {
        stop(new Error(`${label} helper ${stream} exceeded its byte limit`));
        return;
      }
      chunks.push(bytes);
    };
    child.stdout.on("data", collect(stdout, "stdout"));
    child.stderr.on("data", collect(stderr, "stderr"));
    const stopForStreamError = (stream, error) => {
      if (!settled && !termination) stop(new Error(`${label} helper ${stream} failed`, { cause: error }));
    };
    child.stdin.once("error", (error) => stopForStreamError("stdin", error));
    child.stdout.once("error", (error) => stopForStreamError("stdout", error));
    child.stderr.once("error", (error) => stopForStreamError("stderr", error));
    child.once("spawn", () => {
      spawned = true;
      if (termination) child.kill("SIGKILL");
    });
    child.once("error", (error) => {
      if (!spawned) {
        settleReject(new Error(`${label} helper failed to spawn`, { cause: error }));
      } else if (!termination) {
        stop(new Error(`${label} helper process failed`, { cause: error }));
      }
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      if (termination) {
        settleReject(termination);
        return;
      }
      if (status !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").trim();
        settleReject(new Error(`${label} helper failed${signal ? ` with ${signal}` : ""}${detail ? `: ${detail}` : ""}`));
        return;
      }
      settleResolve(Buffer.concat(stdout));
    });
    try {
      child.stdin.end(requestBytes);
    } catch (error) {
      if (spawned) stop(new Error(`${label} helper stdin failed`, { cause: error }));
      else settleReject(new Error(`${label} helper failed to start`, { cause: error }));
    }
  });
}

function decodeBoundRootResponse(bytes, operation, label) {
  const separator = bytes.indexOf(10);
  assert.ok(separator > 0, `${label} helper response has no header`);
  let header;
  try {
    header = JSON.parse(bytes.subarray(0, separator).toString("utf8"));
  } catch (error) {
    throw new Error(`${label} helper returned invalid JSON`, { cause: error });
  }
  assert.equal(header?.operation, operation, `${label} helper returned the wrong operation`);
  return { header, payload: bytes.subarray(separator + 1) };
}

async function boundDirectoryList(context, components, expectedAncestors, expectedIdentity, label) {
  const bytes = await runBoundRootHelper(
    context,
    { operation: "list", components, expectedAncestors, expectedIdentity: wireIdentity(expectedIdentity) },
    label,
  );
  const { header, payload } = decodeBoundRootResponse(bytes, "list", label);
  assert.equal(payload.length, 0, `${label} helper returned an unexpected payload`);
  assert.equal(header.bytes, 0, `${label} helper returned an unexpected byte count`);
  const entries = header.entries;
  assert.ok(Array.isArray(entries), `${label} helper must return an entry array`);
  assert.ok(entries.length <= boundRootHelperMaxEntries, `${label} directory entry count exceeded its limit`);
  const checkedEntries = entries.map((entry, index) => strictComponent(entry, `${label} entry ${index}`));
  assert.equal(new Set(checkedEntries).size, checkedEntries.length, `${label} helper returned duplicate entries`);
  const actualIdentity = parseWireIdentity(header.identity, `${label} identity`);
  assertIdentity(expectedIdentity, actualIdentity, `${label} changed during enumeration`);
  return { entries: checkedEntries, directoryIdentity: actualIdentity };
}

async function boundStat(context, components, expectedAncestors, expectedIdentity, label) {
  const bytes = await runBoundRootHelper(
    context,
    { operation: "stat", components, expectedAncestors, expectedIdentity: expectedIdentity ? wireIdentity(expectedIdentity) : null },
    label,
  );
  const { header, payload } = decodeBoundRootResponse(bytes, "stat", label);
  assert.equal(payload.length, 0, `${label} helper returned an unexpected payload`);
  assert.equal(header.bytes, 0, `${label} helper returned an unexpected byte count`);
  const actualIdentity = parseWireIdentity(header.identity, `${label} identity`);
  if (expectedIdentity) assertIdentity(expectedIdentity, actualIdentity, `${label} changed`);
  return actualIdentity;
}

async function boundRead(context, snapshot) {
  const label = snapshot.relativePath;
  let bytes;
  try {
    bytes = await runBoundRootHelper(
      context,
      {
        operation: "read",
        components: snapshot.components,
        expectedAncestors: expectedDirectoryChain(context, snapshot.ancestorDirectories),
        expectedIdentity: wireIdentity(snapshot.identity),
      },
      label,
    );
  } catch (error) {
    const message = error?.message ?? "";
    const ancestorMatch = /ancestor (\d+) component/u.exec(message);
    if (ancestorMatch) {
      const ancestor = snapshot.ancestorDirectories[Number(ancestorMatch[1])];
      assert.fail(`${ancestor?.relativePath ?? label} must not be a symbolic link`);
    }
    if (/symbolic link|symbolic links|too many levels/u.test(message)) assert.fail(`${label} must not be a symbolic link`);
    if (/file must be regular/u.test(message)) assert.fail(`${label} must be a regular file`);
    throw error;
  }
  const { header, payload } = decodeBoundRootResponse(bytes, "read", label);
  const declaredBytes = header.bytes;
  assert.ok(
    Number.isSafeInteger(declaredBytes) && declaredBytes >= 0 && declaredBytes <= boundRootHelperFileMaxBytes,
    `${label} helper returned an invalid byte count`,
  );
  assert.equal(payload.length, declaredBytes, `${label} helper payload length changed`);
  assert.equal(payload.length <= boundRootHelperFileMaxBytes, true, `${label} helper payload exceeded its byte limit`);
  const actualIdentity = parseWireIdentity(header.identity, `${label} identity`);
  assert.equal(actualIdentity.type, "file", `${label} must be a regular file`);
  assertIdentity(snapshot.identity, actualIdentity, `${label} changed before or during reading`);
  return payload;
}

async function assertCurrentDirectory(context, directory, phase) {
  if (directory.components.length === 0) {
    const current = await context.rootHandle.stat({ bigint: true });
    assert.ok(current.isDirectory(), `${directory.relativePath || "release root"} must be a directory`);
    assertIdentity(directory.identity, identity(current), `${directory.relativePath || "release root"} changed ${phase}`);
  } else {
    const current = await boundStat(
      context,
      directory.components,
      expectedDirectoryChain(context, directory.ancestors),
      directory.identity,
      directory.relativePath,
    );
    assertIdentity(directory.identity, current, `${directory.relativePath} changed ${phase}`);
  }
  await assertRootLocation(context, `${directory.relativePath || "release root"} ${phase}`);
}

async function regularFiles(context, components = [], expectedIdentity = null, ancestorDirectories = [], afterDirectoryLstat, entryCounter = { count: 0 }) {
  const relativeDirectory = relativePathOf(components);
  const label = directoryLabel(relativeDirectory);
  const directoryExpectedIdentity = expectedIdentity ?? context.rootIdentity;
  const targetDirectory = { components, identity: directoryExpectedIdentity };
  await assertRootLocation(context, `${label} before directory enumeration`);
  await afterDirectoryLstat?.(relativeDirectory);
  const { entries, directoryIdentity } = await boundDirectoryList(
    context,
    components,
    expectedDirectoryChain(context, ancestorDirectories, targetDirectory),
    directoryExpectedIdentity,
    label,
  );
  assertIdentity(directoryExpectedIdentity, directoryIdentity, `${label} changed after descriptor enumeration`);
  await assertRootLocation(context, `${label} after directory enumeration`);
  entryCounter.count += entries.length;
  assert.ok(entryCounter.count <= releaseSnapshotMaxEntries, `release snapshot entry count exceeded its limit at ${label}`);
  const currentDirectory = { components, relativePath: relativeDirectory, identity: directoryIdentity, ancestors: ancestorDirectories };
  const allAncestorDirectories = [...ancestorDirectories, currentDirectory];

  const files = [];
  for (const name of entries) {
    await assertCurrentDirectory(context, currentDirectory, "before entry");
    const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
    const entryComponents = [...components, name];
    const entryIdentity = await boundStat(context, entryComponents, expectedDirectoryChain(context, allAncestorDirectories), null, relativePath);
    if (entryIdentity.type === "symbolic link") assert.fail(`${relativePath} must not be a symbolic link`);
    if (entryIdentity.type === "directory") {
      files.push(...(await regularFiles(context, entryComponents, entryIdentity, allAncestorDirectories, afterDirectoryLstat, entryCounter)));
    } else if (entryIdentity.type === "file") {
      files.push({
        components: entryComponents,
        relativePath,
        identity: entryIdentity,
        ancestorDirectories: allAncestorDirectories,
      });
    } else assert.fail(`${relativePath} must be a regular file`);
    await assertCurrentDirectory(context, currentDirectory, "after entry");
  }
  return files;
}

async function readSnapshot(context, snapshot) {
  assertValidationTime(context, `${snapshot.relativePath} before file read`);
  await assertRootLocation(context, `${snapshot.relativePath} before file read`);
  await context.beforeFileRead?.(snapshot);
  const bytes = await boundRead(context, snapshot);
  await assertRootLocation(context, `${snapshot.relativePath} after file read`);
  return bytes;
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

async function assertSameSnapshotBytes(context, snapshots, initialDigests) {
  assert.equal(initialDigests.size, snapshots.length, "not every release snapshot has an initial digest");
  for (const snapshot of snapshots) {
    const initialDigest = initialDigests.get(snapshot.relativePath);
    assert.ok(initialDigest, `${snapshot.relativePath} has no initial digest`);
    const bytes = await readSnapshot(context, snapshot);
    assert.equal(digest(bytes), initialDigest, `${snapshot.relativePath} content changed after initial read`);
  }
}

async function openReleaseRoot(resolvedReleaseRoot) {
  try {
    return await open(resolvedReleaseRoot, safeDirectoryOpenFlags);
  } catch (error) {
    if (error?.code !== "ELOOP" && error?.code !== "ENOTDIR") throw error;
    // This lstat only explains an already-failed open; it never authorizes a file operation.
    let current;
    try {
      current = await lstat(resolvedReleaseRoot, { bigint: true });
    } catch {
      throw error;
    }
    if (current.isSymbolicLink()) assert.fail("release root must not be a symbolic link before opening");
    if (!current.isDirectory()) assert.fail("release root must be a directory before opening");
    throw error;
  }
}

export async function validateRelease(
  releaseRoot = defaultReleaseRoot,
  { afterSnapshot, afterInitialRead, afterFinalRead, afterDirectoryLstat, beforeFileRead } = {},
) {
  if (process.platform === "win32") throw new Error(unsupportedPlatformError);
  assert.ok(
    Number.isInteger(constants.O_DIRECTORY) && Number.isInteger(constants.O_NOFOLLOW),
    "hotel release validation requires POSIX O_DIRECTORY and O_NOFOLLOW",
  );
  const deadlineAt = Date.now() + releaseValidationTimeoutMs;
  const resolvedReleaseRoot = resolve(releaseRoot);
  const rootHandle = await openReleaseRoot(resolvedReleaseRoot);
  try {
    const openedRoot = await rootHandle.stat({ bigint: true });
    assert.ok(openedRoot.isDirectory(), "release root must be a directory after opening");
    const rootIdentity = identity(openedRoot);
    const context = { resolvedReleaseRoot, rootHandle, rootIdentity, beforeFileRead, deadlineAt };
    await assertRootLocation(context, "before validation");
    const snapshots = await regularFiles(context, [], null, [], afterDirectoryLstat);
    const snapshotByPath = new Map(snapshots.map((snapshot) => [snapshot.relativePath, snapshot]));
    // These callbacks are in-process test seams; the command-line validator never supplies them.
    await afterSnapshot?.(snapshots);
    const initialDigests = new Map();

    async function readInitialSnapshot(snapshot) {
      const bytes = await readSnapshot(context, snapshot);
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
      relativeComponents(relativePath);
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
      const snapshot = snapshotByPath.get(relativePath);
      assert.ok(snapshot, `${relativePath} is missing from the release snapshot`);
      const bytes = await readInitialSnapshot(snapshot);
      assert.equal(digest(bytes), sha, `${relativePath} digest differs from SHA256SUMS`);
    }
    assert.ok(!checksumPaths.has("SHA256SUMS"), "checksum file must not self-reference");
    for (const relativePath of requiredFiles.filter((path) => path !== "SHA256SUMS"))
      assert.ok(checksumPaths.has(relativePath), `${relativePath} is not recorded`);

    await afterInitialRead?.(snapshots);
    await assertRootLocation(context, "before final enumeration");
    const finalSnapshots = await regularFiles(context, [], null, [], afterDirectoryLstat);
    assertSameSnapshot(snapshots, finalSnapshots);
    await assertSameSnapshotBytes(context, finalSnapshots, initialDigests);
    await afterFinalRead?.(finalSnapshots);
    await assertRootLocation(context, "before final readback enumeration");
    assertSameSnapshot(snapshots, await regularFiles(context, [], null, [], afterDirectoryLstat));

    return {
      receipt: "HOTEL_RELEASE_READBACK_PASS",
      directory: resolvedReleaseRoot === defaultReleaseRoot ? "release/kyoto-booking-retry-proof" : resolvedReleaseRoot,
      files: checksumLines.length,
    };
  } finally {
    await rootHandle.close();
  }
}

if (import.meta.main) {
  console.log(JSON.stringify(await validateRelease(releaseRootFromArguments())));
}

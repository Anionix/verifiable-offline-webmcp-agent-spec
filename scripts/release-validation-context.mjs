#!/usr/bin/env node
// information_uuid_v5=f2da6444-7447-5120-a39d-446adda200ca
// event_uuid_v7=01a0538f-f73f-753a-9f64-7e4fec9cb6fe state=LEGACY_CONTEXT_EXTRACTED->SQUASH_CONTEXT_CONTENT_BOUND occurred_at=2026-08-30T16:45:39.007Z
// machine-contract: validate the recorded release context without changing the recorded evidence; squash comparison covers the full base-to-source range within the hotel build-input boundary.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// machine-contract: the positive boundary covers Vite publicDir, hotel runtime and test source, build entry configuration, and the package inputs used to run and build the candidate. Documentation, metadata, and validation control remain under their own checks.
const squashValidationInputPrefixes = Object.freeze([
  "examples/hotel-booking-demo/",
  "src/typescript/hotel/",
  "src/typescript/test/",
]);
const squashValidationInputPaths = Object.freeze([
  "index.html",
  "package.json",
  "package-lock.json",
  "scripts/build_web_site.mjs",
  "src/typescript/package.json",
  "src/typescript/package-lock.json",
  "vite.config.js",
]);
const squashValidationDocumentationPaths = Object.freeze([
  "examples/hotel-booking-demo/README.md",
]);

function gitResult(repositoryRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

function gitText(repositoryRoot, args) {
  const result = gitResult(repositoryRoot, args);
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

function assertCommit(repositoryRoot, value, label) {
  assert.match(value ?? "", /^[0-9a-f]{40}$/u, `${label} must be a full commit hash`);
  const result = gitResult(repositoryRoot, ["cat-file", "-t", value]);
  assert.equal(result.status, 0, `${label} must be an existing commit`);
  assert.equal(result.stdout.trim(), "commit", `${label} must be an existing commit`);
}

function isAncestor(repositoryRoot, ancestor, descendant) {
  const result = gitResult(repositoryRoot, ["merge-base", "--is-ancestor", ancestor, descendant]);
  assert.ok(result.status === 0 || result.status === 1, `cannot inspect commit ancestry\n${result.stderr}`);
  return result.status === 0;
}

function assertAncestor(repositoryRoot, ancestor, descendant, message) {
  assert.equal(isAncestor(repositoryRoot, ancestor, descendant), true, message);
}

function mergeBase(repositoryRoot, left, right) {
  const result = gitResult(repositoryRoot, ["merge-base", left, right]);
  assert.ok(result.status === 0 || result.status === 1, `cannot inspect commit history\n${result.stderr}`);
  return result.status === 0 ? result.stdout.trim() : null;
}

function changedPaths(repositoryRoot, baseCommit, sourceCommit) {
  return gitText(repositoryRoot, [
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    baseCommit,
    sourceCommit,
  ])
    .split("\0")
    .filter(Boolean);
}

function isSquashValidationInput(path) {
  return (
    !squashValidationDocumentationPaths.includes(path) &&
    (squashValidationInputPaths.includes(path) || squashValidationInputPrefixes.some((prefix) => path.startsWith(prefix)))
  );
}

function treeEntry(repositoryRoot, commit, path) {
  const result = gitResult(repositoryRoot, ["ls-tree", "-r", "-z", "--full-tree", commit, "--", path]);
  assert.equal(result.status, 0, `cannot inspect ${path} in ${commit}`);
  const entry = result.stdout.split("\0").find((value) => value.endsWith(`\t${path}`));
  return entry ? entry.slice(0, entry.indexOf("\t")) : null;
}

function assertSquashContent(repositoryRoot, baseCommit, sourceCommit, currentRef) {
  const commonAncestor = mergeBase(repositoryRoot, sourceCommit, currentRef);
  assert(commonAncestor, "release source commit has no common ancestor with the current checkout");
  assertAncestor(
    repositoryRoot,
    commonAncestor,
    baseCommit,
    "release source common history must be an ancestor of the recorded base commit",
  );
  const paths = changedPaths(repositoryRoot, baseCommit, sourceCommit).filter(
    (path) => isSquashValidationInput(path),
  );
  assert(paths.length > 0, "release source squash has no comparable file entries");
  for (const path of paths) {
    assert.equal(
      treeEntry(repositoryRoot, sourceCommit, path),
      treeEntry(repositoryRoot, currentRef, path),
      `release source file entry differs after squash: ${path}`,
    );
  }
}

export function validateReleaseContext({
  repositoryRoot,
  baseCommit,
  sourceCommit,
  currentRef = "HEAD",
}) {
  assertCommit(repositoryRoot, sourceCommit, "release source commit");
  assertCommit(repositoryRoot, baseCommit, "release base commit");
  assertAncestor(
    repositoryRoot,
    baseCommit,
    sourceCommit,
    "release base commit must be an ancestor of the source commit",
  );
  if (isAncestor(repositoryRoot, sourceCommit, currentRef)) {
    return { mode: "SOURCE_ANCESTOR", baseCommit, sourceCommit };
  }
  assertSquashContent(repositoryRoot, baseCommit, sourceCommit, currentRef);
  return { mode: "SQUASH_CONTENT_MATCH", baseCommit, sourceCommit };
}

function argument(args, name, required = true) {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    if (required) throw new Error(`${name} is required`);
    return undefined;
  }
  return args[index + 1];
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = process.argv.slice(2);
    const result = validateReleaseContext({
      repositoryRoot: resolve(argument(args, "--repository-root")),
      baseCommit: argument(args, "--base"),
      sourceCommit: argument(args, "--source"),
      currentRef: argument(args, "--current", false),
    });
    console.log(JSON.stringify({ receipt: "HOTEL_RELEASE_CONTEXT_VALIDATION_PASS", ...result }));
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}

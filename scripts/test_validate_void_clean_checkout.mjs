#!/usr/bin/env node
// information_uuid_v5=59aace12-7f9d-59bb-9b87-55c42e4f5c53
// event_uuid_v7=01a04cfc-c4d4-7d80-af61-0a7e1146082b state_transition=DIST_ASSUMED_PRESENT -> CLEAN_CHECKOUT_BUILDS_BEFORE_VOID_VALIDATION occurred_at=2026-08-29T10:07:09.012Z
// machine-contract: TRACKED_SOURCE_WITHOUT_DIST -> NPM_VALIDATE_VOID -> DETERMINISTIC_BUILD -> VOID_VALIDATION_PASS; installed dependencies may be shared read-only, but ignored artifacts may not be copied.

import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkout = mkdtempSync(join(tmpdir(), "void-clean-checkout-"));

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NO_COLOR: "1" },
    shell: false,
    timeout: 120_000,
  });
}

try {
  const tracked = run("git", ["ls-files", "-z"], ROOT);
  if (tracked.error || tracked.status !== 0) {
    throw new Error(`git ls-files failed: ${tracked.error?.message ?? tracked.stderr.trim()}`);
  }

  const releaseFiles = new Set(tracked.stdout.split("\0").filter(Boolean));
  // The test must be runnable before its first commit as well as after it becomes a tracked release file.
  releaseFiles.add("scripts/test_validate_void_clean_checkout.mjs");

  for (const relativePath of releaseFiles) {
    const source = resolve(ROOT, relativePath);
    const destination = resolve(checkout, relativePath);
    if (!existsSync(source)) throw new Error(`tracked source is missing: ${relativePath}`);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { dereference: false, preserveTimestamps: true });
  }

  if (existsSync(resolve(checkout, "dist"))) {
    throw new Error("clean-checkout fixture unexpectedly contains dist");
  }
  symlinkSync(resolve(ROOT, "node_modules"), resolve(checkout, "node_modules"), "dir");

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const validation = run(npm, ["run", "validate:void"], checkout);
  if (validation.error || validation.status !== 0) {
    throw new Error(
      [
        `npm run validate:void failed from the clean-checkout fixture: ${validation.error?.message ?? `exit ${validation.status}`}`,
        validation.stdout.trim(),
        validation.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (!existsSync(resolve(checkout, "dist/client/index.html"))) {
    throw new Error("standalone Void validation did not build dist/client/index.html");
  }
  if (!validation.stdout.includes("VOID_INTEGRATION_VALIDATION_PASS")) {
    throw new Error("standalone Void validation did not report its validator receipt");
  }

  console.log("VOID_CLEAN_CHECKOUT_VALIDATION_PASS dist=created command=npm_run_validate_void");
} finally {
  rmSync(checkout, { recursive: true, force: true });
}

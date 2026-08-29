// information_uuid_v5=bf5f3cfb-4add-5274-bd53-4fe165bfe985
// event_uuid_v7=01a04b93-947d-7143-8e2a-4ef233e51598
// state_transition=SOURCE_QUALITY_UNMEASURED -> BOUNDED_SOURCE_QUALITY_GATE occurred_at=2026-08-29T03:32:38.141Z
// machine-contract: exact package, lockfile, executable version, license, and language-server entry-point evidence must agree before source checks run.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(resolve(repositoryRoot, "package-lock.json"), "utf8"));

const tools = Object.freeze([
  Object.freeze({ packageName: "@biomejs/biome", executable: "biome", version: "2.5.11", license: "MIT OR Apache-2.0", languageServerMarker: "lsp-proxy" }),
  Object.freeze({ packageName: "oxlint", executable: "oxlint", version: "1.80.0", license: "MIT", languageServerMarker: "--lsp" }),
  Object.freeze({ packageName: "oxfmt", executable: "oxfmt", version: "0.65.0", license: "MIT", languageServerMarker: "--lsp" }),
]);

function runExecutable(executable, argument) {
  const platformExecutable = process.platform === "win32" ? `${executable}.cmd` : executable;
  const result = spawnSync(resolve(repositoryRoot, "node_modules/.bin", platformExecutable), [argument], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${executable} ${argument} failed: ${result.stderr}`);
  return `${result.stdout}\n${result.stderr}`;
}

for (const tool of tools) {
  assert.equal(packageJson.devDependencies[tool.packageName], tool.version, `${tool.packageName} package.json version differs`);
  assert.equal(packageLock.packages[""].devDependencies[tool.packageName], tool.version, `${tool.packageName} lock root version differs`);
  const locked = packageLock.packages[`node_modules/${tool.packageName}`];
  assert.equal(locked?.version, tool.version, `${tool.packageName} installed lock version differs`);
  assert.equal(locked?.license, tool.license, `${tool.packageName} lock license differs`);
  assert.match(
    runExecutable(tool.executable, "--version"),
    new RegExp(`Version: ${tool.version.replaceAll(".", "\\.")}`),
    `${tool.executable} executable version differs`,
  );
  assert.ok(runExecutable(tool.executable, "--help").includes(tool.languageServerMarker), `${tool.executable} language-server entry point is unavailable`);
}

console.log(
  JSON.stringify({
    receipt: "SOURCE_QUALITY_TOOLCHAIN_VALIDATION_PASS",
    tools: tools.map(({ packageName, executable, version, license }) => ({ packageName, executable, version, license })),
  }),
);

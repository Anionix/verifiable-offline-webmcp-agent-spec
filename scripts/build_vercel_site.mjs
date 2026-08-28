#!/usr/bin/env node
// information_uuid_v5=206722a5-4b79-58c3-b10e-c01639d22d4e
// event_uuid_v7=01a04a5f-5112-74f4-9183-f16e97883007
// event_uuid_v7=01a04a69-2b09-76ce-9f0d-e4f3c4c08549 state_transition=RESOURCE_REVIEWED -> EVALUATION_ASSET_ALLOWLISTED occurred_at=2026-08-28T22:06:43Z
// state_transition=SOURCE_VERIFIED -> STATIC_OUTPUT occurred_at=2026-08-28T22:05:45.746Z
// machine-contract: the Vercel output is rebuilt from an explicit allowlist; local databases, logs, credentials, and repository-only evidence are never copied.

import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(repositoryRoot, "examples/vercel-notification-demo");
const outputRoot = resolve(repositoryRoot, "dist");

const files = Object.freeze([
  [resolve(sourceRoot, "index.html"), resolve(outputRoot, "index.html")],
  [resolve(sourceRoot, "favicon.svg"), resolve(outputRoot, "favicon.svg")],
  [resolve(sourceRoot, "styles.css"), resolve(outputRoot, "styles.css")],
  [resolve(sourceRoot, "app.js"), resolve(outputRoot, "app.js")],
  [resolve(sourceRoot, "browser-store.js"), resolve(outputRoot, "browser-store.js")],
  [resolve(sourceRoot, "webmcp-adapter.js"), resolve(outputRoot, "webmcp-adapter.js")],
  [resolve(sourceRoot, "service-worker.js"), resolve(outputRoot, "service-worker.js")],
  [resolve(sourceRoot, "webmcp-evals.json"), resolve(outputRoot, "webmcp-evals.json")],
  [resolve(repositoryRoot, "src/typescript/notification/input-projection.js"), resolve(outputRoot, "input-projection.js")],
]);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const [source, destination] of files) await cp(source, destination);

console.log(`Vercel static output: ${outputRoot}`);
console.log(`Allowlisted files: ${files.length}`);

#!/usr/bin/env node
// information_uuid_v5=354ee591-d5e5-5de8-b378-e580ca2b7b60
// event_uuid_v7=01a04a91-754a-7b1d-8136-07a9aead382a state_transition=HOST_SPECIFIC_BUILD -> PORTABLE_STATIC_BUILD occurred_at=2026-08-28T22:50:41Z
// machine-contract: rebuild dist from this explicit allowlist only; never copy repository-wide data, local state, credentials, logs, or databases.

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
  [resolve(sourceRoot, "_headers"), resolve(outputRoot, "_headers")],
  [resolve(repositoryRoot, "src/typescript/notification/input-projection.js"), resolve(outputRoot, "input-projection.js")],
  [resolve(repositoryRoot, "metadata/service-integration-registry.json"), resolve(outputRoot, "service-integrations.json")],
]);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const [source, destination] of files) await cp(source, destination);

console.log(`Portable static output: ${outputRoot}`);
console.log(`Allowlisted files: ${files.length}`);

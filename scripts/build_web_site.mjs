#!/usr/bin/env node
// information_uuid_v5=354ee591-d5e5-5de8-b378-e580ca2b7b60
// event_uuid_v7=01a04bd0-b895-73f7-858c-e725d62b4283 state_transition=PORTABLE_COPY_BUILD -> VITE_SITES_BUILD occurred_at=2026-08-29T01:00:00Z
// machine-contract: Vite builds the hotel demo into dist/client and the Cloudflare worker into dist/server; Sites metadata is copied to dist/.openai.

import { createBuilder } from "vite";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(resolve(repositoryRoot, ".local"), { recursive: true });
process.env.WRANGLER_LOG_PATH = resolve(repositoryRoot, ".local/wrangler.log");
await rm(resolve(repositoryRoot, "dist"), { recursive: true, force: true });
const builder = await createBuilder();
await builder.buildApp();

// machine-contract: generated deployment metadata must not reveal or bind the
// package to this checkout's absolute path. These two Wrangler fields are
// local build provenance only and are not needed by the saved Sites artifact.
const generatedWranglerPath = resolve(repositoryRoot, "dist/server/wrangler.json");
const generatedWrangler = JSON.parse(await readFile(generatedWranglerPath, "utf8"));
delete generatedWrangler.configPath;
delete generatedWrangler.userConfigPath;
await writeFile(generatedWranglerPath, `${JSON.stringify(generatedWrangler)}\n`, "utf8");
console.log("Hotel demo built: dist/client, dist/server, dist/.openai");

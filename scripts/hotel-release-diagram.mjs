#!/usr/bin/env node
// information_uuid_v5=17898066-d1e0-50f3-96c7-e30c23316f5a
// event_uuid_v7=01a054a4-ed85-7699-bfe4-e5a61ca71e46 state_transition=SOURCE_DIAGRAM -> PACKAGED_DIAGRAM_READY occurred_at=2026-08-30T21:48:09.989Z
// event_uuid_v7=01a0552a-991d-7f40-84cb-fc5419e0f11e state_transition=SOURCE_COPY_HASH_ONLY -> SOURCE_BYTES_AND_CURRENT_PROVENANCE_BOUND occurred_at=2026-08-31T00:14:10.205Z
// machine-contract: source bytes, metadata path and hashes, and packaged README provenance are checked before copying; historical comments do not authorize a stale diagram.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const HOTEL_RETRY_DIAGRAM_SOURCE = "docs/assets/hotel-retry-explained.png";
export const HOTEL_RETRY_DIAGRAM_TARGET = "docs/assets/hotel-retry-explained.png";
export const HOTEL_RETRY_DIAGRAM_METADATA = "metadata/hotel-retry-diagram.json";
export const HOTEL_RETRY_SOURCE_README_LINK = "../../docs/assets/hotel-retry-explained.png";
export const HOTEL_RETRY_PACKAGED_README_LINK = "docs/assets/hotel-retry-explained.png";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertCurrentDiagramProvenance(metadata, sourceDigest) {
  assert.equal(metadata?.repository_copy?.path, HOTEL_RETRY_DIAGRAM_SOURCE, "diagram provenance path is not bound to the source PNG");
  assert.equal(metadata?.repository_copy?.sha256, sourceDigest, "source PNG digest differs from repository provenance");
  assert.equal(metadata?.generation?.source_sha256, sourceDigest, "source PNG digest differs from generation provenance");
  assert.equal(typeof metadata?.identity?.uuid_v7, "string", "diagram provenance event UUIDv7 is missing");
  assert.match(
    metadata.identity.uuid_v7,
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    "diagram provenance event must be a UUIDv7",
  );
  const eventTime = Number.parseInt(metadata.identity.uuid_v7.replaceAll("-", "").slice(0, 12), 16);
  assert.equal(eventTime, Date.parse(metadata.occurred_at), "diagram provenance event time differs from occurred_at");
  return metadata.identity.uuid_v7;
}

function assertCurrentPackagedReadme(packagedReadme, eventUuidV7, sourceDigest) {
  const lines = packagedReadme.split("\n");
  const eventLineIndex = lines.findIndex((line) => line.split(/[;\s]+/u).includes(`event_uuid_v7=${eventUuidV7}`));
  assert.ok(eventLineIndex >= 0, "packaged README is not bound to the current diagram provenance event");
  const provenanceBlock = lines.slice(eventLineIndex, eventLineIndex + 2).join("\n");
  assert.ok(provenanceBlock.split(/[;\s]+/u).includes(`source_sha256=${sourceDigest}`), "packaged README is not bound to the current diagram provenance hash");
}

export async function packageHotelRetryDiagram({ sourceRoot, packageRoot }) {
  const sourceDiagram = resolve(sourceRoot, HOTEL_RETRY_DIAGRAM_SOURCE);
  const sourceBytes = await readFile(sourceDiagram);
  const sourceDigest = sha256(sourceBytes);
  const metadataPath = resolve(sourceRoot, HOTEL_RETRY_DIAGRAM_METADATA);
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const eventUuidV7 = assertCurrentDiagramProvenance(metadata, sourceDigest);
  const packagedReadmePath = resolve(packageRoot, "README.md");
  let packagedReadme = await readFile(packagedReadmePath, "utf8");
  assertCurrentPackagedReadme(packagedReadme, eventUuidV7, sourceDigest);
  assert.ok(packagedReadme.includes(HOTEL_RETRY_SOURCE_README_LINK), "source README diagram link is missing from the release copy");

  const packagedDiagram = resolve(packageRoot, HOTEL_RETRY_DIAGRAM_TARGET);
  await mkdir(dirname(packagedDiagram), { recursive: true });
  await writeFile(packagedDiagram, sourceBytes);
  packagedReadme = packagedReadme.replaceAll(HOTEL_RETRY_SOURCE_README_LINK, HOTEL_RETRY_PACKAGED_README_LINK);
  assert.ok(!packagedReadme.includes(HOTEL_RETRY_SOURCE_README_LINK), "release README must not escape the release root for its diagram");
  await writeFile(packagedReadmePath, packagedReadme);

  return { packagedDiagram, packagedReadmePath };
}

#!/usr/bin/env node
// information_uuid_v5=17898066-d1e0-50f3-96c7-e30c23316f5a
// event_uuid_v7=01a054a4-ed85-7699-bfe4-e5a61ca71e46 state_transition=SOURCE_DIAGRAM -> PACKAGED_DIAGRAM_READY occurred_at=2026-08-30T21:48:09.989Z
// machine-contract: the release builder copies the explanatory diagram and rewrites only the packaged README link; the source README remains repository-relative.

import assert from "node:assert/strict";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const HOTEL_RETRY_DIAGRAM_SOURCE = "docs/assets/hotel-retry-explained.png";
export const HOTEL_RETRY_DIAGRAM_TARGET = "docs/assets/hotel-retry-explained.png";
export const HOTEL_RETRY_SOURCE_README_LINK = "../../docs/assets/hotel-retry-explained.png";
export const HOTEL_RETRY_PACKAGED_README_LINK = "docs/assets/hotel-retry-explained.png";

export async function packageHotelRetryDiagram({ sourceRoot, packageRoot }) {
  const sourceDiagram = resolve(sourceRoot, HOTEL_RETRY_DIAGRAM_SOURCE);
  const packagedDiagram = resolve(packageRoot, HOTEL_RETRY_DIAGRAM_TARGET);
  await mkdir(dirname(packagedDiagram), { recursive: true });
  await cp(sourceDiagram, packagedDiagram);

  const packagedReadmePath = resolve(packageRoot, "README.md");
  let packagedReadme = await readFile(packagedReadmePath, "utf8");
  assert.ok(packagedReadme.includes(HOTEL_RETRY_SOURCE_README_LINK), "source README diagram link is missing from the release copy");
  packagedReadme = packagedReadme.replaceAll(HOTEL_RETRY_SOURCE_README_LINK, HOTEL_RETRY_PACKAGED_README_LINK);
  assert.ok(!packagedReadme.includes(HOTEL_RETRY_SOURCE_README_LINK), "release README must not escape the release root for its diagram");
  await writeFile(packagedReadmePath, packagedReadme);

  return { packagedDiagram, packagedReadmePath };
}

#!/usr/bin/env node
// information_uuid_v5=17898066-d1e0-50f3-96c7-e30c23316f5a
// event_uuid_v7=01a054a6-7a5e-7665-beef-0b7a2e581fe9 state_transition=SOURCE_FIXTURE_READY -> DETACHED_DIAGRAM_LINK_AND_HASH_VERIFIED occurred_at=2026-08-30T21:49:51.582Z
// machine-contract: this helper-only regression owns both temporary fixture roots; it does not invoke the release builder, require a clean git checkout, require Gitleaks, or mutate release/.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  HOTEL_RETRY_DIAGRAM_SOURCE,
  HOTEL_RETRY_DIAGRAM_TARGET,
  HOTEL_RETRY_PACKAGED_README_LINK,
  HOTEL_RETRY_SOURCE_README_LINK,
  packageHotelRetryDiagram,
} from "./hotel-release-diagram.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("packages the hotel retry diagram in an owned fixture", async () => {
  const fixtureParent = await mkdtemp(join(tmpdir(), "hotel-release-diagram-fixture-"));
  const sourceRoot = join(fixtureParent, "source");
  const packageRoot = join(fixtureParent, "package");
  try {
    await mkdir(join(sourceRoot, "docs/assets"), { recursive: true });
    await mkdir(packageRoot, { recursive: true });
    await cp(resolve(repositoryRoot, HOTEL_RETRY_DIAGRAM_SOURCE), resolve(sourceRoot, HOTEL_RETRY_DIAGRAM_SOURCE));
    await writeFile(resolve(sourceRoot, "README.md"), `# Fixture\n\n![Hotel retry diagram](${HOTEL_RETRY_SOURCE_README_LINK})\n`);
    await cp(resolve(sourceRoot, "README.md"), resolve(packageRoot, "README.md"));

    await packageHotelRetryDiagram({ sourceRoot, packageRoot });

    const sourceReadme = await readFile(resolve(sourceRoot, "README.md"), "utf8");
    const packagedReadme = await readFile(resolve(packageRoot, "README.md"), "utf8");
    assert.ok(sourceReadme.includes(`](${HOTEL_RETRY_SOURCE_README_LINK})`), "source README must retain its repository-relative link");
    assert.ok(packagedReadme.includes(`](${HOTEL_RETRY_PACKAGED_README_LINK})`), "package README must use its self-contained link");
    assert.ok(!packagedReadme.includes(`](${HOTEL_RETRY_SOURCE_README_LINK})`), "package README must not escape its root");

    const sourceDiagram = await readFile(resolve(sourceRoot, HOTEL_RETRY_DIAGRAM_SOURCE));
    const packagedDiagram = await readFile(resolve(packageRoot, HOTEL_RETRY_DIAGRAM_TARGET));
    assert.equal(digest(packagedDiagram), digest(sourceDiagram), "packaged diagram differs from the source PNG");
  } finally {
    await rm(fixtureParent, { recursive: true, force: true });
  }
});

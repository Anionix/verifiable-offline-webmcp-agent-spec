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
  HOTEL_RETRY_DIAGRAM_METADATA,
  HOTEL_RETRY_DIAGRAM_SOURCE,
  HOTEL_RETRY_DIAGRAM_TARGET,
  HOTEL_RETRY_PACKAGED_README_LINK,
  HOTEL_RETRY_SOURCE_README_LINK,
  packageHotelRetryDiagram,
} from "./hotel-release-diagram.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function fixtureReadme(metadata) {
  const eventUuidV7 = metadata.identity.uuid_v7;
  const sourceSha256 = metadata.repository_copy.sha256;
  return `# Fixture\n\n<!-- event_uuid_v7=${eventUuidV7} state_transition=IMAGE_EDITED_FOR_RETRY_ACTION -> SOURCE_SHA256_CAPTURED -> README_ASSET_COPIED -->\n<!-- machine-contract=fixture provenance source_sha256=${sourceSha256}; historical_events=RETAINED. -->\n![Hotel retry diagram](${HOTEL_RETRY_SOURCE_README_LINK})\n`;
}

function cloneMetadata(metadata) {
  return JSON.parse(JSON.stringify(metadata));
}

async function writeDiagramFixture({ sourceRoot, packageRoot, diagramBytes, metadata, packagedReadme }) {
  await mkdir(resolve(sourceRoot, "docs/assets"), { recursive: true });
  await mkdir(resolve(sourceRoot, "metadata"), { recursive: true });
  await mkdir(packageRoot, { recursive: true });
  await writeFile(resolve(sourceRoot, HOTEL_RETRY_DIAGRAM_SOURCE), diagramBytes);
  await writeFile(resolve(sourceRoot, HOTEL_RETRY_DIAGRAM_METADATA), `${JSON.stringify(metadata)}\n`);
  await writeFile(resolve(sourceRoot, "README.md"), fixtureReadme(metadata));
  await cp(resolve(sourceRoot, "README.md"), resolve(packageRoot, "README.md"));
  if (packagedReadme !== undefined) await writeFile(resolve(packageRoot, "README.md"), packagedReadme);
}

async function assertNotCopied(packageRoot) {
  await assert.rejects(() => readFile(resolve(packageRoot, HOTEL_RETRY_DIAGRAM_TARGET)), { code: "ENOENT" });
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("packages the hotel retry diagram in an owned fixture", async () => {
  const fixtureParent = await mkdtemp(join(tmpdir(), "hotel-release-diagram-fixture-"));
  const sourceRoot = join(fixtureParent, "source");
  const packageRoot = join(fixtureParent, "package");
  try {
    const diagramBytes = await readFile(resolve(repositoryRoot, HOTEL_RETRY_DIAGRAM_SOURCE));
    const metadata = JSON.parse(await readFile(resolve(repositoryRoot, HOTEL_RETRY_DIAGRAM_METADATA), "utf8"));
    await writeDiagramFixture({ sourceRoot, packageRoot, diagramBytes, metadata });

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

test("rejects stale diagram provenance before copying the PNG", async () => {
  const fixtureParent = await mkdtemp(join(tmpdir(), "hotel-release-diagram-provenance-"));
  try {
    const currentDiagramBytes = await readFile(resolve(repositoryRoot, HOTEL_RETRY_DIAGRAM_SOURCE));
    const alternateDiagramBytes = await readFile(resolve(repositoryRoot, "docs/assets/devpost-hotel-thumbnail.png"));
    const currentMetadata = JSON.parse(await readFile(resolve(repositoryRoot, HOTEL_RETRY_DIAGRAM_METADATA), "utf8"));
    const legacyMetadata = cloneMetadata(currentMetadata);
    const legacyEvent = legacyMetadata.history[0];
    legacyMetadata.identity.uuid_v7 = legacyEvent.event_uuid_v7;
    legacyMetadata.occurred_at = legacyEvent.occurred_at;
    legacyMetadata.generation.source_sha256 = legacyEvent.source_sha256;
    legacyMetadata.generation.generated_image_file = legacyEvent.generated_image_file;
    legacyMetadata.repository_copy.sha256 = legacyEvent.source_sha256;

    const cases = [
      {
        label: "legacy provenance with new PNG",
        diagramBytes: currentDiagramBytes,
        metadata: legacyMetadata,
        expected: /source PNG digest differs from/u,
      },
      {
        label: "current provenance with old PNG",
        diagramBytes: alternateDiagramBytes,
        metadata: currentMetadata,
        expected: /source PNG digest differs from/u,
      },
      {
        label: "stale packaged README provenance",
        diagramBytes: currentDiagramBytes,
        metadata: currentMetadata,
        packagedReadme: fixtureReadme(legacyMetadata),
        expected: /packaged README is not bound to the current diagram provenance/u,
      },
      {
        label: "current digest appears only in previous hash field",
        diagramBytes: currentDiagramBytes,
        metadata: currentMetadata,
        packagedReadme: fixtureReadme(currentMetadata).replace(
          `source_sha256=${currentMetadata.repository_copy.sha256};`,
          `source_sha256=${"0".repeat(64)}; previous_source_sha256=${currentMetadata.repository_copy.sha256};`,
        ),
        expected: /packaged README is not bound to the current diagram provenance hash/u,
      },
    ];

    for (const { label, diagramBytes, metadata, packagedReadme, expected } of cases) {
      const sourceRoot = join(fixtureParent, `${label}-source`);
      const packageRoot = join(fixtureParent, `${label}-package`);
      await writeDiagramFixture({ sourceRoot, packageRoot, diagramBytes, metadata, packagedReadme });
      await assert.rejects(() => packageHotelRetryDiagram({ sourceRoot, packageRoot }), expected, `${label} was accepted`);
      await assertNotCopied(packageRoot);
    }
  } finally {
    await rm(fixtureParent, { recursive: true, force: true });
  }
});

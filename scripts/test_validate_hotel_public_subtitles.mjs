#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  compareSubtitleFiles,
  compareSubtitleTexts,
  productionMetadataPath,
  publicSubtitlePath,
  sourceSubtitlePath,
} from "./validate_hotel_public_subtitles.mjs";

const publicSubtitleValidatorPath = fileURLToPath(new URL("./validate_hotel_public_subtitles.mjs", import.meta.url));

test("accepts the retained public VTT when all authored cues match", async () => {
  const result = await compareSubtitleFiles(sourceSubtitlePath, publicSubtitlePath);
  assert.deepEqual(result, {
    inputCueCount: 184,
    publicCueCount: 184,
    textComparison: "MATCH_AFTER_WHITESPACE_NORMALIZATION",
    timingComparison: "MATCH_EXACT_INTEGER_MILLISECONDS",
    lastCueEndMilliseconds: 147760,
    result: "PASS",
    sourceSha256: "4c7cc11986a256bd4b1dd4769a9d6ae4c8b110dc65affbbb2b7efcc4b8d4b56f",
    publicVttSha256: "34150342efb88ed37d5c2d0d8b55f0041d8d49850cb6e5701ba3d31ecdbeb5ac",
  });
});

test("rejects a public VTT when one cue timestamp changes", async () => {
  const [sourceText, publicText] = await Promise.all([readFile(sourceSubtitlePath, "utf8"), readFile(publicSubtitlePath, "utf8")]);
  const changedPublicText = publicText.replace("00:00:00.000 --> 00:00:00.700", "00:00:00.001 --> 00:00:00.700");
  assert.notEqual(changedPublicText, publicText);
  assert.throws(() => compareSubtitleTexts(sourceText, changedPublicText), /public subtitle text or timestamps differ/u);
});

test("rejects metadata when a recorded subtitle digest differs", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "hotel-public-subtitles-"));
  try {
    const metadata = JSON.parse(await readFile(productionMetadataPath, "utf8"));
    metadata.publication.subtitleAnonymousReadbacks[0].publicVtt.sha256 = "0".repeat(64);
    const metadataFixturePath = resolve(temporaryDirectory, "demo-video-production.json");
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");
    await assert.rejects(() => compareSubtitleFiles(sourceSubtitlePath, publicSubtitlePath, metadataFixturePath), /metadata public VTT SHA-256 differs/u);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("runs and propagates failures when invoked through a symlink", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "hotel-public-subtitles-cli-"));
  const symlinkPath = resolve(temporaryDirectory, "run-public-subtitles.mjs");
  try {
    await symlink(publicSubtitleValidatorPath, symlinkPath);
    const successfulRun = spawnSync(process.execPath, [symlinkPath], { encoding: "utf8" });
    assert.equal(successfulRun.status, 0, successfulRun.stderr);
    assert.match(successfulRun.stdout, /HOTEL_PUBLIC_SUBTITLE_COMPARISON_PASS/u);

    const failingRun = spawnSync(process.execPath, ["--preserve-symlinks-main", symlinkPath], { encoding: "utf8" });
    assert.ok(typeof failingRun.status === "number" && failingRun.status !== 0, "symlink failure must exit non-zero");
    assert.doesNotMatch(failingRun.stdout, /HOTEL_PUBLIC_SUBTITLE_COMPARISON_PASS/u);
    assert.notEqual(failingRun.stderr, "");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

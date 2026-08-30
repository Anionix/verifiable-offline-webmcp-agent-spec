#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
  validateSubtitleHistory,
} from "./validate_hotel_public_subtitles.mjs";

const publicSubtitleValidatorPath = fileURLToPath(new URL("./validate_hotel_public_subtitles.mjs", import.meta.url));
const mismatchedSubtitleStateTransition =
  "PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_VTT_DOWNLOADED -> ENGLISH_VTT_TEXT_OR_CUE_TIMES_MISMATCHED_UI_TRACK_SELECTION_UNMEASURED";

function uuidV7ForMilliseconds(epochMilliseconds) {
  const timestamp = BigInt(epochMilliseconds).toString(16).padStart(12, "0");
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7abc-8def-0123456789ab`;
}

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
  assert.deepEqual(await validateSubtitleHistory(), { readbackCount: 1, validationResult: "PASS" });
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

test("rehashes every retained VTT and records a later mismatch instead of a false PASS", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "hotel-public-subtitle-history-"));
  try {
    const mediaDirectory = resolve(temporaryDirectory, "media/demo-video");
    await mkdir(mediaDirectory, { recursive: true });
    await copyFile(sourceSubtitlePath, resolve(mediaDirectory, "subtitles.en.srt"));
    await copyFile(publicSubtitlePath, resolve(mediaDirectory, "youtube-public-201.en.vtt"));
    const publicText = await readFile(publicSubtitlePath, "utf8");
    const changedPublicText = publicText.replace("00:00:00.000 --> 00:00:00.700", "00:00:00.001 --> 00:00:00.700");
    assert.notEqual(changedPublicText, publicText);
    const changedPublicPath = resolve(mediaDirectory, "changed.en.vtt");
    await writeFile(changedPublicPath, changedPublicText, "utf8");

    const metadata = JSON.parse(await readFile(productionMetadataPath, "utf8"));
    const originalReadback = structuredClone(metadata.publication.subtitleAnonymousReadbacks[0]);
    const readback = structuredClone(originalReadback);
    const previousRootUpdatedAt = metadata.updatedAt;
    const futureMeasuredMilliseconds = Date.parse(previousRootUpdatedAt);
    const futureRecordedMilliseconds = futureMeasuredMilliseconds + 1;
    const futureRootMilliseconds = futureMeasuredMilliseconds + 2;
    readback.observationUuidV7 = uuidV7ForMilliseconds(futureRecordedMilliseconds);
    readback.measuredAt = new Date(futureMeasuredMilliseconds).toISOString();
    readback.recordedAt = new Date(futureRecordedMilliseconds).toISOString();
    readback.stateTransition = mismatchedSubtitleStateTransition;
    readback.availableSubtitleCatalog.captureTiming = {
      precision: "EXACT",
      lowerBound: readback.measuredAt,
      upperBound: readback.measuredAt,
      description: "synthetic mismatch history fixture capture time",
    };
    readback.publicVtt.path = "media/demo-video/changed.en.vtt";
    readback.publicVtt.fileName = "changed.en.vtt";
    readback.download.fileName = "changed.en.vtt";
    readback.publicVtt.sha256 = createHash("sha256").update(changedPublicText).digest("hex");
    readback.comparison.timing = "MISMATCH";
    readback.comparison.result = "FAIL";
    metadata.publication.subtitleAnonymousReadbacks = [originalReadback, readback];
    metadata.previousDocumentObservation = {
      informationUuidV5: metadata.identity.informationUuidV5,
      observationUuidV7: metadata.identity.observationUuidV7,
      updatedAt: previousRootUpdatedAt,
      stateTransition: metadata.stateTransition,
    };
    metadata.identity.observationUuidV7 = uuidV7ForMilliseconds(futureRootMilliseconds);
    metadata.updatedAt = new Date(futureRootMilliseconds).toISOString();
    metadata.stateTransition = `${metadata.stateTransition} -> PUBLIC_SUBTITLE_ANONYMOUS_VTT_COMPARISON_MISMATCH_RECORDED_UI_TRACK_SELECTION_UNMEASURED`;
    const metadataFixturePath = resolve(temporaryDirectory, "demo-video-production.json");
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");

    assert.deepEqual(await validateSubtitleHistory(metadataFixturePath, temporaryDirectory), { readbackCount: 2, validationResult: "PASS" });
    assert.equal((await compareSubtitleFiles(sourceSubtitlePath, publicSubtitlePath, metadataFixturePath)).result, "PASS");

    readback.stateTransition = originalReadback.stateTransition;
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");
    await assert.rejects(() => validateSubtitleHistory(metadataFixturePath, temporaryDirectory), /state transition differs/u);

    readback.stateTransition = mismatchedSubtitleStateTransition;
    readback.comparison.timing = "MATCH_EXACT_INTEGER_MILLISECONDS";
    readback.comparison.result = "PASS";
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");
    await assert.rejects(() => validateSubtitleHistory(metadataFixturePath, temporaryDirectory), /comparison timing status differs/u);

    readback.publicVtt.path = "../outside.vtt";
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");
    await assert.rejects(() => validateSubtitleHistory(metadataFixturePath, temporaryDirectory), /safe repository-relative path/u);
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

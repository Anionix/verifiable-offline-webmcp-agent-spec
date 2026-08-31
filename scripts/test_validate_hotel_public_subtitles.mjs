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
  compareSubtitleHistoryTexts,
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

function replaceFirstUtf8Sequence(bytes, needle, replacementBytes) {
  const needleBytes = Buffer.from(needle, "utf8");
  const offset = bytes.indexOf(needleBytes);
  assert.notEqual(offset, -1, `fixture text is missing: ${needle}`);
  return Buffer.concat([bytes.subarray(0, offset), Buffer.from(replacementBytes), bytes.subarray(offset + needleBytes.length)]);
}

async function createSubtitleHistoryFixture(sourceBytes, publicBytes, prefix) {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), prefix));
  const mediaDirectory = resolve(temporaryDirectory, "media/demo-video");
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(resolve(mediaDirectory, "subtitles.en.srt"), sourceBytes);
  await writeFile(resolve(mediaDirectory, "youtube-public-201.en.vtt"), publicBytes);
  const metadata = JSON.parse(await readFile(productionMetadataPath, "utf8"));
  const readback = structuredClone(metadata.publication.subtitleAnonymousReadbacks[0]);
  readback.inputSubtitle.sha256 = createHash("sha256").update(sourceBytes).digest("hex");
  readback.publicVtt.sha256 = createHash("sha256").update(publicBytes).digest("hex");
  metadata.publication.subtitleAnonymousReadbacks = [readback];
  const metadataFixturePath = resolve(temporaryDirectory, "demo-video-production.json");
  await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");
  return { temporaryDirectory, metadataFixturePath };
}

async function assertRejectsInvalidUtf8(sourceBytes, publicBytes, prefix) {
  const fixture = await createSubtitleHistoryFixture(sourceBytes, publicBytes, prefix);
  try {
    await assert.rejects(() => validateSubtitleHistory(fixture.metadataFixturePath, fixture.temporaryDirectory), TypeError);
  } finally {
    await rm(fixture.temporaryDirectory, { recursive: true, force: true });
  }
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
  assert.deepEqual(await validateSubtitleHistory(), {
    readbackCount: 1,
    comparisonReadbackCount: 1,
    unavailableReadbackCount: 0,
    validationResult: "PASS",
  });
});

test("rejects different invalid UTF-8 bytes in the SRT and VTT", async () => {
  const [sourceBytes, publicBytes] = await Promise.all([readFile(sourceSubtitlePath), readFile(publicSubtitlePath)]);
  const brokenSourceBytes = replaceFirstUtf8Sequence(sourceBytes, "submits a", [0xff]);
  const brokenPublicBytes = replaceFirstUtf8Sequence(publicBytes, "submits a", [0xfe]);
  await assertRejectsInvalidUtf8(brokenSourceBytes, brokenPublicBytes, "hotel-public-subtitles-invalid-both-");
});

test("rejects invalid UTF-8 in the SRT only", async () => {
  const [sourceBytes, publicBytes] = await Promise.all([readFile(sourceSubtitlePath), readFile(publicSubtitlePath)]);
  const brokenSourceBytes = replaceFirstUtf8Sequence(sourceBytes, "submits a", [0xff]);
  await assertRejectsInvalidUtf8(brokenSourceBytes, publicBytes, "hotel-public-subtitles-invalid-srt-");
});

test("rejects invalid UTF-8 in the VTT only", async () => {
  const [sourceBytes, publicBytes] = await Promise.all([readFile(sourceSubtitlePath), readFile(publicSubtitlePath)]);
  const brokenPublicBytes = replaceFirstUtf8Sequence(publicBytes, "submits a", [0xfe]);
  await assertRejectsInvalidUtf8(sourceBytes, brokenPublicBytes, "hotel-public-subtitles-invalid-vtt-");
});

test("accepts a correctly encoded U+FFFD subtitle character", async () => {
  const [sourceBytes, publicBytes] = await Promise.all([readFile(sourceSubtitlePath), readFile(publicSubtitlePath)]);
  const replacementCharacter = Buffer.from("\uFFFD", "utf8");
  const validSourceBytes = replaceFirstUtf8Sequence(sourceBytes, "submits a", replacementCharacter);
  const validPublicBytes = replaceFirstUtf8Sequence(publicBytes, "submits a", replacementCharacter);
  const fixture = await createSubtitleHistoryFixture(validSourceBytes, validPublicBytes, "hotel-public-subtitles-valid-replacement-");
  try {
    assert.deepEqual(await validateSubtitleHistory(fixture.metadataFixturePath, fixture.temporaryDirectory), {
      readbackCount: 1,
      comparisonReadbackCount: 1,
      unavailableReadbackCount: 0,
      validationResult: "PASS",
    });
  } finally {
    await rm(fixture.temporaryDirectory, { recursive: true, force: true });
  }
});

test("rejects a WebVTT header containing the cue separator", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\nKind: subtitles --> invalid\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /header cannot contain -->/u);
});

test("requires declared WebVTT track metadata to describe English captions", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  for (const declaration of ["Kind: subtitles", "Language: ja"]) {
    const publicText = "WEBVTT\n" + declaration + "\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
    assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /English captions/u);
  }
});

test("rejects duplicate WebVTT Kind or Language declarations", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  for (const declarations of ["Kind: captions\nKind: captions", "Language: en\nLanguage: en"]) {
    const publicText = "WEBVTT\n" + declarations + "\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
    assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /duplicate/u);
  }
});

test("allows a WebVTT header without optional track metadata", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.equal(compareSubtitleHistoryTexts(sourceText, publicText).result, "PASS");
});

test("rejects WebVTT cue settings as unsupported by this comparator", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000 align:start\nHello\n";
  assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /unrecognized WebVTT block/u);
});

test("accepts an arbitrary WebVTT cue identifier without the forbidden separator", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\nany identifier 日本語\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.equal(compareSubtitleHistoryTexts(sourceText, publicText).result, "PASS");
});

test("rejects a WebVTT cue identifier containing the cue separator", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\nbad --> identifier\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /cue identifier cannot contain -->/u);
});

test("rejects a WebVTT cue payload containing the cue separator", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello --> world\n";
  const publicText = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello --> world\n";
  assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /cue payload cannot contain -->/u);
});

for (const location of ["SRT", "VTT"]) {
  test("rejects a NUL in the " + location + " cue payload", () => {
    const sourceText = location === "SRT" ? "1\n00:00:00,000 --> 00:00:01,000\nHello\u0000\n" : "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
    const publicText = location === "VTT" ? "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\u0000\n" : "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
    assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /NUL/u);
  });
}

test("rejects a later readback when a malformed SRT cue and its VTT cue are both absent", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "hotel-public-subtitle-missing-cue-"));
  try {
    const mediaDirectory = resolve(temporaryDirectory, "media/demo-video");
    await mkdir(mediaDirectory, { recursive: true });
    await copyFile(sourceSubtitlePath, resolve(mediaDirectory, "subtitles.en.srt"));
    await copyFile(publicSubtitlePath, resolve(mediaDirectory, "youtube-public-201.en.vtt"));
    const [sourceText, publicText] = await Promise.all([readFile(sourceSubtitlePath, "utf8"), readFile(publicSubtitlePath, "utf8")]);
    const brokenSourceText = sourceText.replace("2\n00:00:00,700 --> 00:00:01,620\nsubmits a", "2\nBROKEN SRT CUE\nsubmits a");
    const missingPublicText = publicText.replace("\n00:00:00.700 --> 00:00:01.620\nsubmits a\n", "\n");
    assert.notEqual(brokenSourceText, sourceText);
    assert.notEqual(missingPublicText, publicText);
    await writeFile(resolve(mediaDirectory, "broken.en.srt"), brokenSourceText, "utf8");
    await writeFile(resolve(mediaDirectory, "missing-cue.en.vtt"), missingPublicText, "utf8");

    const metadata = JSON.parse(await readFile(productionMetadataPath, "utf8"));
    const originalReadback = structuredClone(metadata.publication.subtitleAnonymousReadbacks[0]);
    const readback = structuredClone(originalReadback);
    readback.inputSubtitle.path = "media/demo-video/broken.en.srt";
    readback.inputSubtitle.sha256 = createHash("sha256").update(brokenSourceText).digest("hex");
    readback.inputSubtitle.cueCount = 183;
    readback.publicVtt.path = "media/demo-video/missing-cue.en.vtt";
    readback.publicVtt.fileName = "missing-cue.en.vtt";
    readback.publicVtt.sha256 = createHash("sha256").update(missingPublicText).digest("hex");
    readback.publicVtt.cueCount = 183;
    readback.download.fileName = "missing-cue.en.vtt";
    readback.comparison.scope = "FULL_183_CUE_COMPARISON";
    readback.comparison.inputCueCount = 183;
    readback.comparison.publicCueCount = 183;
    metadata.publication.subtitleAnonymousReadbacks = [originalReadback, readback];
    const metadataFixturePath = resolve(temporaryDirectory, "demo-video-production.json");
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");

    await assert.rejects(() => validateSubtitleHistory(metadataFixturePath, temporaryDirectory), /unparsed SubRip cue block/u);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("accepts an explicitly allowed WebVTT NOTE block", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\nNOTE\ntranscriber note\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.equal(compareSubtitleHistoryTexts(sourceText, publicText).result, "PASS");
});

test("accepts a WebVTT NOTE block containing --!>", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\nNOTE\nplain --!> note\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.equal(compareSubtitleHistoryTexts(sourceText, publicText).result, "PASS");
});

test("rejects a WebVTT NOTE block containing a cue separator", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\nNOTE\nmalformed --> note\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /NOTE block cannot contain/u);
});

for (const blockType of ["STYLE", "REGION"]) {
  test("rejects an unsupported WebVTT " + blockType + " block", () => {
    const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
    const publicText = "WEBVTT\n\n" + blockType + "\nunsupported payload\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
    assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), new RegExp("unsupported WebVTT " + blockType + " block", "u"));
  });
}

test("rejects an unrecognized WebVTT noncue block", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\nUNDECLARED metadata\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /unrecognized WebVTT block/u);
});

for (const scenario of [
  {
    name: "a reversed cue",
    srtTiming: "00:00:02,000 --> 00:00:01,000",
    vttTiming: "00:00:02.000 --> 00:00:01.000",
  },
  {
    name: "a zero-length cue",
    srtTiming: "00:00:01,000 --> 00:00:01,000",
    vttTiming: "00:00:01.000 --> 00:00:01.000",
  },
]) {
  test("rejects " + scenario.name + " when both files agree", () => {
    const sourceText = "1\n" + scenario.srtTiming + "\nHello\n";
    const publicText = "WEBVTT\n\n" + scenario.vttTiming + "\nHello\n";
    assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /positive length/u);
    const validSourceText = "1\n00:00:00,000 --> 00:00:03,000\nHello\n";
    assert.throws(() => compareSubtitleHistoryTexts(validSourceText, publicText), /positive length/u);
  });
}

test("rejects overlapping cues when both files agree", () => {
  const sourceText = "1\n00:00:00,000 --> 00:00:02,000\nFirst\n\n2\n00:00:01,000 --> 00:00:03,000\nSecond\n";
  const publicText = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nFirst\n\n00:00:01.000 --> 00:00:03.000\nSecond\n";
  assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /overlaps at cue 2/u);
  const validSourceText = "1\n00:00:00,000 --> 00:00:03,000\nFirst\n";
  assert.throws(() => compareSubtitleHistoryTexts(validSourceText, publicText), /WebVTT overlaps at cue 2/u);
});

test("rejects a non-sequential SubRip cue", () => {
  const sourceText = "2\n00:00:00,000 --> 00:00:01,000\nHello\n";
  const publicText = "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n";
  assert.throws(() => compareSubtitleHistoryTexts(sourceText, publicText), /non-sequential SubRip cue/u);
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

    assert.deepEqual(await validateSubtitleHistory(metadataFixturePath, temporaryDirectory), {
      readbackCount: 2,
      comparisonReadbackCount: 2,
      unavailableReadbackCount: 0,
      validationResult: "PASS",
    });
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

test("accepts a schema-valid anonymous track-unavailable readback in history", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "hotel-public-subtitle-unavailable-"));
  try {
    const mediaDirectory = resolve(temporaryDirectory, "media/demo-video");
    await mkdir(mediaDirectory, { recursive: true });
    await copyFile(sourceSubtitlePath, resolve(mediaDirectory, "subtitles.en.srt"));
    await copyFile(publicSubtitlePath, resolve(mediaDirectory, "youtube-public-201.en.vtt"));

    const metadata = JSON.parse(await readFile(productionMetadataPath, "utf8"));
    const originalReadback = structuredClone(metadata.publication.subtitleAnonymousReadbacks[0]);
    const recordedMilliseconds = Date.parse(metadata.updatedAt) + 1_000;
    const unavailableReadback = {
      informationUuidV5: originalReadback.informationUuidV5,
      observationUuidV7: uuidV7ForMilliseconds(recordedMilliseconds),
      measuredAt: new Date(recordedMilliseconds - 2).toISOString(),
      recordedAt: new Date(recordedMilliseconds).toISOString(),
      stateTransition: "PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_AUTHORED_TRACK_UNAVAILABLE",
      videoId: originalReadback.videoId,
      watchUrl: originalReadback.watchUrl,
      track: "ENGLISH_AUTHORED_TRACK",
      availableSubtitleCatalog: {
        source: "ANONYMOUS_YOUTUBE_PLAYER_METADATA",
        command: "uvx yt-dlp --skip-download --list-subs --no-cache-dir",
        authentication: "NONE",
        capturedAfterComparison: false,
        captureTiming: {
          precision: "EXACT",
          lowerBound: new Date(recordedMilliseconds - 1).toISOString(),
          upperBound: new Date(recordedMilliseconds - 1).toISOString(),
          description: "synthetic unavailable-track catalog capture time",
        },
        languages: ["ja"],
        trackClass: "MANUAL_SUBTITLES",
        automaticCaptionsSeparate: true,
        authoredEnglishConfirmed: false,
      },
      failure: { result: "FAIL", reason: "AUTHORED_ENGLISH_TRACK_UNAVAILABLE" },
    };
    assert.equal("download" in unavailableReadback, false);
    assert.equal("inputSubtitle" in unavailableReadback, false);
    assert.equal("publicVtt" in unavailableReadback, false);
    assert.equal("comparison" in unavailableReadback, false);
    metadata.publication.subtitleAnonymousReadbacks = [originalReadback, unavailableReadback];
    const metadataFixturePath = resolve(temporaryDirectory, "demo-video-production.json");
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");

    assert.deepEqual(await validateSubtitleHistory(metadataFixturePath, temporaryDirectory), {
      readbackCount: 2,
      comparisonReadbackCount: 1,
      unavailableReadbackCount: 1,
      validationResult: "PASS",
    });

    const invalidUnavailableCases = [
      ["non-FAIL result", (record) => (record.failure.result = "PASS"), /failure result must be FAIL/u],
      ["wrong failure reason", (record) => (record.failure.reason = "OTHER"), /failure reason differs/u],
      ["comparison state", (record) => (record.stateTransition = mismatchedSubtitleStateTransition), /state transition differs/u],
      ["comparison catalog", (record) => (record.availableSubtitleCatalog.capturedAfterComparison = true), /must not claim a comparison/u],
      ["English catalog", (record) => (record.availableSubtitleCatalog.languages = ["en"]), /must not include English/u],
      ["confirmed English catalog", (record) => (record.availableSubtitleCatalog.authoredEnglishConfirmed = true), /must not confirm English/u],
      ...["download", "inputSubtitle", "publicVtt", "comparison"].map((field) => [
        `extra ${field}`,
        (record) => (record[field] = {}),
        /must not contain download/u,
      ]),
    ];
    for (const [, mutate, expectedError] of invalidUnavailableCases) {
      const invalidMetadata = structuredClone(metadata);
      mutate(invalidMetadata.publication.subtitleAnonymousReadbacks[1]);
      await writeFile(metadataFixturePath, `${JSON.stringify(invalidMetadata)}\n`, "utf8");
      await assert.rejects(() => validateSubtitleHistory(metadataFixturePath, temporaryDirectory), expectedError);
    }

    const incompleteSuccessMetadata = structuredClone(metadata);
    delete incompleteSuccessMetadata.publication.subtitleAnonymousReadbacks[0].publicVtt;
    await writeFile(metadataFixturePath, `${JSON.stringify(incompleteSuccessMetadata)}\n`, "utf8");
    await assert.rejects(() => validateSubtitleHistory(metadataFixturePath, temporaryDirectory), /publicVtt\.path must be a string/u);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("rejects a readback that retains the authored SRT as its public VTT", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "hotel-public-subtitle-self-compare-"));
  try {
    const mediaDirectory = resolve(temporaryDirectory, "media/demo-video");
    await mkdir(mediaDirectory, { recursive: true });
    const retainedSourcePath = resolve(mediaDirectory, "subtitles.en.srt");
    await copyFile(sourceSubtitlePath, retainedSourcePath);
    await copyFile(publicSubtitlePath, resolve(mediaDirectory, "youtube-public-201.en.vtt"));

    const metadata = JSON.parse(await readFile(productionMetadataPath, "utf8"));
    const originalReadback = structuredClone(metadata.publication.subtitleAnonymousReadbacks[0]);
    const readback = structuredClone(originalReadback);
    readback.publicVtt.path = "media/demo-video/subtitles.en.srt";
    readback.publicVtt.fileName = "subtitles.en.srt";
    readback.download.fileName = "subtitles.en.srt";
    readback.publicVtt.sha256 = createHash("sha256")
      .update(await readFile(retainedSourcePath))
      .digest("hex");
    metadata.publication.subtitleAnonymousReadbacks = [originalReadback, readback];
    const metadataFixturePath = resolve(temporaryDirectory, "demo-video-production.json");
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");

    await assert.rejects(() => validateSubtitleHistory(metadataFixturePath, temporaryDirectory), /input and public retained paths must differ/u);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("rejects a retained VTT without a WEBVTT header", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "hotel-public-subtitle-header-"));
  try {
    const mediaDirectory = resolve(temporaryDirectory, "media/demo-video");
    await mkdir(mediaDirectory, { recursive: true });
    await copyFile(sourceSubtitlePath, resolve(mediaDirectory, "subtitles.en.srt"));
    await copyFile(publicSubtitlePath, resolve(mediaDirectory, "youtube-public-201.en.vtt"));
    const publicText = await readFile(publicSubtitlePath, "utf8");
    const headerlessPublicText = publicText.replace(/^WEBVTT\r?\n/u, "");
    assert.notEqual(headerlessPublicText, publicText);
    const retainedPublicPath = resolve(mediaDirectory, "headerless.en.vtt");
    await writeFile(retainedPublicPath, headerlessPublicText, "utf8");

    const metadata = JSON.parse(await readFile(productionMetadataPath, "utf8"));
    const originalReadback = structuredClone(metadata.publication.subtitleAnonymousReadbacks[0]);
    const readback = structuredClone(originalReadback);
    readback.publicVtt.path = "media/demo-video/headerless.en.vtt";
    readback.publicVtt.fileName = "headerless.en.vtt";
    readback.download.fileName = "headerless.en.vtt";
    readback.publicVtt.sha256 = createHash("sha256").update(headerlessPublicText).digest("hex");
    metadata.publication.subtitleAnonymousReadbacks = [originalReadback, readback];
    const metadataFixturePath = resolve(temporaryDirectory, "demo-video-production.json");
    await writeFile(metadataFixturePath, `${JSON.stringify(metadata)}\n`, "utf8");

    await assert.rejects(() => validateSubtitleHistory(metadataFixturePath, temporaryDirectory), /WEBVTT header is missing/u);
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
    assert.match(successfulRun.stdout, /"historyComparisonReadbackCount":1/u);
    assert.match(successfulRun.stdout, /"historyUnavailableReadbackCount":0/u);

    const failingRun = spawnSync(process.execPath, ["--preserve-symlinks-main", symlinkPath], { encoding: "utf8" });
    assert.ok(typeof failingRun.status === "number" && failingRun.status !== 0, "symlink failure must exit non-zero");
    assert.doesNotMatch(failingRun.stdout, /HOTEL_PUBLIC_SUBTITLE_COMPARISON_PASS/u);
    assert.notEqual(failingRun.stderr, "");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

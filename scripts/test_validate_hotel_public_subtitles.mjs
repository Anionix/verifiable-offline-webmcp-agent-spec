#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { compareSubtitleFiles, compareSubtitleTexts, publicSubtitlePath, sourceSubtitlePath } from "./validate_hotel_public_subtitles.mjs";

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

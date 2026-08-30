#!/usr/bin/env node
// information_uuid_v5=adeb6009-db9e-51be-8555-da27f170ca95
// event_uuid_v7=01a053d0-3297-722c-b7f8-5ff273c9b729 state_transition=PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_VTT_DOWNLOADED -> ENGLISH_VTT_TEXT_AND_CUE_TIMES_MATCHED_UI_TRACK_SELECTION_UNMEASURED
// machine-contract: compare every authored cue and both timestamps; no video-file identity is inferred.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const sourceSubtitlePath = resolve(repositoryRoot, "media/demo-video/subtitles.en.srt");
export const publicSubtitlePath = resolve(repositoryRoot, "media/demo-video/youtube-public-201.en.vtt");

const EXPECTED_CUE_COUNT = 184;
const EXPECTED_LAST_CUE_END_MS = 147760;

function normalizeText(text) {
  return text.replace(/\s+/gu, " ").trim();
}

function timestampToMilliseconds(timestamp) {
  const match = /^(?<hours>\d{2}):(?<minutes>\d{2}):(?<seconds>\d{2})[.,](?<milliseconds>\d{3})$/u.exec(timestamp);
  assert.ok(match?.groups, `invalid subtitle timestamp: ${timestamp}`);
  const minutes = Number(match.groups.minutes);
  const seconds = Number(match.groups.seconds);
  assert.ok(minutes < 60 && seconds < 60, `out-of-range subtitle timestamp: ${timestamp}`);
  return Number(match.groups.hours) * 3_600_000 + minutes * 60_000 + seconds * 1_000 + Number(match.groups.milliseconds);
}

export function parseSubtitleCues(text) {
  const blocks = text
    .replace(/\r\n/gu, "\n")
    .trim()
    .split(/\n\s*\n/u)
    .filter(Boolean);
  return blocks.flatMap((block) => {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes(" --> "));
    if (timingIndex === -1) return [];
    const match = /^(?<start>\d{2}:\d{2}:\d{2}[.,]\d{3}) --> (?<end>\d{2}:\d{2}:\d{2}[.,]\d{3})(?: .*)?$/u.exec(lines[timingIndex]);
    assert.ok(match?.groups, `unexpected cue timing syntax: ${lines[timingIndex]}`);
    return [
      {
        startMs: timestampToMilliseconds(match.groups.start),
        endMs: timestampToMilliseconds(match.groups.end),
        text: normalizeText(lines.slice(timingIndex + 1).join("\n")),
      },
    ];
  });
}

export function compareSubtitleTexts(sourceText, publicText) {
  const sourceCues = parseSubtitleCues(sourceText);
  const publicCues = parseSubtitleCues(publicText);
  assert.equal(sourceCues.length, EXPECTED_CUE_COUNT, "authored subtitle cue count changed");
  assert.equal(publicCues.length, sourceCues.length, "public subtitle cue count differs");
  assert.deepEqual(publicCues, sourceCues, "public subtitle text or timestamps differ");
  assert.equal(sourceCues.at(-1)?.endMs, EXPECTED_LAST_CUE_END_MS, "authored subtitle ending changed");
  return {
    inputCueCount: sourceCues.length,
    publicCueCount: publicCues.length,
    textComparison: "MATCH_AFTER_WHITESPACE_NORMALIZATION",
    timingComparison: "MATCH_EXACT_INTEGER_MILLISECONDS",
    lastCueEndMilliseconds: sourceCues.at(-1).endMs,
    result: "PASS",
  };
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

export async function compareSubtitleFiles(sourcePath = sourceSubtitlePath, publicPath = publicSubtitlePath) {
  const [sourceText, publicText] = await Promise.all([readFile(sourcePath, "utf8"), readFile(publicPath, "utf8")]);
  return {
    ...compareSubtitleTexts(sourceText, publicText),
    sourceSha256: digest(sourceText),
    publicVttSha256: digest(publicText),
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const comparison = await compareSubtitleFiles();
  console.log(
    JSON.stringify({
      receipt: "HOTEL_PUBLIC_SUBTITLE_COMPARISON_PASS",
      ...comparison,
      authentication: "NO_COOKIES_OR_CREDENTIALS_SUPPLIED",
      videoFileIdentity: "UNMEASURED",
    }),
  );
}

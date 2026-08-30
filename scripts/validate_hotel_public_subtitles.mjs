#!/usr/bin/env node
// information_uuid_v5=adeb6009-db9e-51be-8555-da27f170ca95
// event_uuid_v7=01a053d0-3297-722c-b7f8-5ff273c9b729 state_transition=PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_VTT_DOWNLOADED -> ENGLISH_VTT_TEXT_AND_CUE_TIMES_MATCHED_UI_TRACK_SELECTION_UNMEASURED
// machine-contract: compare every authored cue and both timestamps; no video-file identity is inferred.
// machine-contract: a PASS comparison uses the MATCHED transition; any text or cue-time mismatch uses the MISMATCHED transition.
// machine-contract: history compares a distinct retained SubRip input file with a retained WebVTT output file, with positive ordered non-overlapping cues, before binding bytes to a state.
// machine-contract: every non-empty block is a cue or an explicit WebVTT header, NOTE, STYLE, or REGION block; unknown blocks fail closed.
// machine-contract: importing this module is inert; import.meta.main runs the CLI through symlinks and leaves processing errors uncaught.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const sourceSubtitlePath = resolve(repositoryRoot, "media/demo-video/subtitles.en.srt");
export const publicSubtitlePath = resolve(repositoryRoot, "media/demo-video/youtube-public-201.en.vtt");
export const productionMetadataPath = resolve(repositoryRoot, "metadata/demo-video-production.json");
export const MATCHED_SUBTITLE_STATE_TRANSITION =
  "PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_VTT_DOWNLOADED -> ENGLISH_VTT_TEXT_AND_CUE_TIMES_MATCHED_UI_TRACK_SELECTION_UNMEASURED";
export const MISMATCHED_SUBTITLE_STATE_TRANSITION =
  "PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_VTT_DOWNLOADED -> ENGLISH_VTT_TEXT_OR_CUE_TIMES_MISMATCHED_UI_TRACK_SELECTION_UNMEASURED";

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

const SUBRIP_TIMING_PATTERN = /^(?<start>\d{2}:\d{2}:\d{2},\d{3}) --> (?<end>\d{2}:\d{2}:\d{2},\d{3})$/u;
const WEBVTT_HEADER_PATTERN = /^\uFEFF?WEBVTT(?:[ \t].*)?$/u;
const WEBVTT_TIMING_PATTERN = /^(?<start>\d{2}:\d{2}:\d{2}\.\d{3}) --> (?<end>\d{2}:\d{2}:\d{2}\.\d{3})(?:[ \t].*)?$/u;

function subtitleBlocks(text) {
  const normalized = text.replace(/\r\n?/gu, "\n").trim();
  return normalized === "" ? [] : normalized.split(/\n\s*\n/u).filter((block) => block.trim() !== "");
}

function parseSubRipCueBlock(block, index) {
  const lines = block.split("\n");
  const timingMatch = SUBRIP_TIMING_PATTERN.exec(lines[1] ?? "");
  const cueText = normalizeText(lines.slice(2).join("\n"));
  assert.equal(lines[0], String(index + 1), "SubRip block " + (index + 1) + " has a missing or non-sequential SubRip cue");
  assert.ok(
    timingMatch?.groups && cueText !== "" && !lines.slice(2).some((line) => SUBRIP_TIMING_PATTERN.test(line)),
    "SubRip block " + (index + 1) + " is an unparsed SubRip cue block",
  );
  return {
    startMs: timestampToMilliseconds(timingMatch.groups.start),
    endMs: timestampToMilliseconds(timingMatch.groups.end),
    text: cueText,
  };
}

function parseWebVttCueBlock(block, index) {
  const lines = block.split("\n");
  const directTimingMatch = WEBVTT_TIMING_PATTERN.exec(lines[0] ?? "");
  const identifiedTimingMatch = directTimingMatch ? null : WEBVTT_TIMING_PATTERN.exec(lines[1] ?? "");
  const timingMatch = directTimingMatch ?? identifiedTimingMatch;
  const timingIndex = directTimingMatch ? 0 : identifiedTimingMatch ? 1 : -1;
  const cueText = normalizeText(lines.slice(timingIndex + 1).join("\n"));
  assert.ok(timingMatch?.groups && cueText !== "", "WebVTT block " + (index + 1) + " is an unrecognized WebVTT block");
  return {
    startMs: timestampToMilliseconds(timingMatch.groups.start),
    endMs: timestampToMilliseconds(timingMatch.groups.end),
    text: cueText,
  };
}

function isAllowedWebVttNonCueBlock(block) {
  const firstLine = block.split("\n", 1)[0] ?? "";
  return /^(?:NOTE(?:[ \t].*)?|STYLE|REGION)$/u.test(firstLine);
}

function parseWebVttHeader(block) {
  const lines = block.split("\n");
  assert.ok(WEBVTT_HEADER_PATTERN.test(lines[0] ?? ""), "WebVTT header is missing");
  assert.ok(
    lines.slice(1).every((line) => /^(?:Kind|Language):[ \t].*$/u.test(line)),
    "WebVTT header contains an unrecognized line",
  );
}

function validateCueTimeline(cues, format) {
  let previousEnd = 0;
  const label = format === "srt" ? "SubRip" : "WebVTT";
  for (const [index, cue] of cues.entries()) {
    assert.ok(cue.startMs < cue.endMs, label + " cue " + (index + 1) + " must have positive length");
    assert.ok(cue.startMs >= previousEnd, label + " overlaps at cue " + (index + 1));
    previousEnd = cue.endMs;
  }
}

export function parseSubtitleCues(text, format) {
  const resolvedFormat = format ?? (/^\uFEFF?WEBVTT(?:[ \t].*)?(?:\r?\n|$)/u.test(text) ? "vtt" : "srt");
  assert.ok(resolvedFormat === "srt" || resolvedFormat === "vtt", "subtitle format must be srt or vtt");
  const blocks = subtitleBlocks(text);
  if (resolvedFormat === "srt") {
    const cues = blocks.map(parseSubRipCueBlock);
    validateCueTimeline(cues, resolvedFormat);
    return cues;
  }
  assert.ok(blocks.length > 0, "WebVTT header is missing");
  parseWebVttHeader(blocks[0]);
  const cues = blocks.slice(1).flatMap((block, index) => {
    if (isAllowedWebVttNonCueBlock(block)) return [];
    return [parseWebVttCueBlock(block, index)];
  });
  validateCueTimeline(cues, resolvedFormat);
  return cues;
}

export function compareSubtitleHistoryTexts(sourceText, publicText) {
  const sourceCues = parseSubtitleCues(sourceText, "srt");
  const publicCues = parseSubtitleCues(publicText, "vtt");
  const comparable = sourceCues.length > 0 && sourceCues.length === publicCues.length;
  const textMatches = comparable && sourceCues.every((cue, index) => cue.text === publicCues[index].text);
  const timingMatches = comparable && sourceCues.every((cue, index) => cue.startMs === publicCues[index].startMs && cue.endMs === publicCues[index].endMs);
  return {
    inputCueCount: sourceCues.length,
    publicCueCount: publicCues.length,
    sourceLastCueEndMilliseconds: sourceCues.at(-1)?.endMs ?? 0,
    publicLastCueEndMilliseconds: publicCues.at(-1)?.endMs ?? 0,
    text: textMatches ? "MATCH_AFTER_WHITESPACE_NORMALIZATION" : "MISMATCH",
    timing: timingMatches ? "MATCH_EXACT_INTEGER_MILLISECONDS" : "MISMATCH",
    result: textMatches && timingMatches ? "PASS" : "FAIL",
    stateTransition: textMatches && timingMatches ? MATCHED_SUBTITLE_STATE_TRANSITION : MISMATCHED_SUBTITLE_STATE_TRANSITION,
  };
}

export function compareSubtitleTexts(sourceText, publicText) {
  const comparison = compareSubtitleHistoryTexts(sourceText, publicText);
  assert.equal(comparison.inputCueCount, EXPECTED_CUE_COUNT, "authored subtitle cue count changed");
  assert.equal(comparison.publicCueCount, comparison.inputCueCount, "public subtitle cue count differs");
  assert.equal(comparison.result, "PASS", "public subtitle text or timestamps differ");
  assert.equal(comparison.sourceLastCueEndMilliseconds, EXPECTED_LAST_CUE_END_MS, "authored subtitle ending changed");
  assert.equal(comparison.publicLastCueEndMilliseconds, EXPECTED_LAST_CUE_END_MS, "public subtitle ending changed");
  return {
    inputCueCount: comparison.inputCueCount,
    publicCueCount: comparison.publicCueCount,
    textComparison: comparison.text,
    timingComparison: comparison.timing,
    lastCueEndMilliseconds: comparison.sourceLastCueEndMilliseconds,
    result: "PASS",
  };
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

function retainedSubtitlePath(value, label, root = repositoryRoot) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.match(value, /^media\/demo-video\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/u, `${label} must be a safe repository-relative path`);
  return resolve(root, value);
}

function assertSubtitlePathExtension(value, label, extension) {
  assert.match(value, extension === "srt" ? /\.srt$/u : /\.vtt$/u, `${label} must use .${extension}`);
}

function assertSubRipText(text, label) {
  assert.doesNotMatch(text, /^\uFEFF?WEBVTT(?:[ \t].*)?(?:\r?\n|$)/u, `${label} must be SubRip, not WebVTT`);
  assert.match(text, /(?:^|\r?\n)\s*\d+\r?\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}(?:\r?\n|$)/u, `${label} is not a SubRip file`);
}

function assertWebVttText(text, label) {
  assert.match(text, /^\uFEFF?WEBVTT(?:[ \t].*)?(?:\r?\n|$)/u, `${label} WEBVTT header is missing`);
  assert.doesNotMatch(text, /(?:^|\r?\n)\d{2}:\d{2}:\d{2},\d{3} --> /u, `${label} must use WebVTT timestamps`);
}

export async function compareSubtitleFiles(sourcePath = sourceSubtitlePath, publicPath = publicSubtitlePath, metadataPath = productionMetadataPath) {
  assert.notEqual(resolve(sourcePath), resolve(publicPath), "input and public retained paths must differ");
  assertSubtitlePathExtension(sourcePath, "input subtitle path", "srt");
  assertSubtitlePathExtension(publicPath, "public VTT path", "vtt");
  const [sourceBytes, publicBytes, metadataText] = await Promise.all([readFile(sourcePath), readFile(publicPath), readFile(metadataPath, "utf8")]);
  const sourceText = sourceBytes.toString("utf8");
  const publicText = publicBytes.toString("utf8");
  assertSubRipText(sourceText, "input subtitle");
  assertWebVttText(publicText, "public VTT");
  const sourceSha256 = digest(sourceBytes);
  const publicVttSha256 = digest(publicBytes);
  const metadata = JSON.parse(metadataText);
  const currentPublicPath = `media/demo-video/${basename(publicPath)}`;
  const matchingReadbacks = metadata?.publication?.subtitleAnonymousReadbacks?.filter((record) => record?.publicVtt?.path === currentPublicPath);
  assert.ok(matchingReadbacks?.length, "metadata subtitle readback for the public VTT is missing");
  for (const [index, record] of matchingReadbacks.entries()) {
    assert.equal(record.inputSubtitle?.sha256, sourceSha256, `metadata source subtitle SHA-256 differs at readback ${index + 1}`);
    assert.equal(record.publicVtt?.sha256, publicVttSha256, `metadata public VTT SHA-256 differs at readback ${index + 1}`);
  }
  return {
    ...compareSubtitleTexts(sourceText, publicText),
    sourceSha256,
    publicVttSha256,
  };
}

export async function validateSubtitleHistory(metadataPath = productionMetadataPath, root = repositoryRoot) {
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const records = metadata?.publication?.subtitleAnonymousReadbacks;
  assert.ok(Array.isArray(records) && records.length > 0, "metadata subtitle readback history is missing");
  for (const [index, record] of records.entries()) {
    const label = `subtitle readback ${index + 1}`;
    const inputPath = retainedSubtitlePath(record?.inputSubtitle?.path, `${label} inputSubtitle.path`, root);
    const publicPath = retainedSubtitlePath(record?.publicVtt?.path, `${label} publicVtt.path`, root);
    assert.notEqual(inputPath, publicPath, `${label} input and public retained paths must differ`);
    assertSubtitlePathExtension(record.inputSubtitle.path, `${label} inputSubtitle.path`, "srt");
    assertSubtitlePathExtension(record.publicVtt.path, `${label} publicVtt.path`, "vtt");
    assert.equal(record?.publicVtt?.fileName, basename(publicPath), `${label} publicVtt.fileName differs from its retained path`);
    assert.equal(record?.download?.fileName, basename(publicPath), `${label} download.fileName differs from its retained path`);
    const [sourceBytes, publicBytes] = await Promise.all([readFile(inputPath), readFile(publicPath)]);
    const sourceText = sourceBytes.toString("utf8");
    const publicText = publicBytes.toString("utf8");
    assertSubRipText(sourceText, `${label} input subtitle`);
    assertWebVttText(publicText, `${label} public VTT`);
    const sourceSha256 = digest(sourceBytes);
    const publicVttSha256 = digest(publicBytes);
    assert.equal(record?.inputSubtitle?.sha256, sourceSha256, `${label} input subtitle SHA-256 differs from its retained file`);
    assert.equal(record?.publicVtt?.sha256, publicVttSha256, `${label} public VTT SHA-256 differs from its retained file`);
    const comparison = compareSubtitleHistoryTexts(sourceText, publicText);
    assert.equal(record?.stateTransition, comparison.stateTransition, `${label} state transition differs from its byte comparison`);
    assert.equal(record?.inputSubtitle?.cueCount, comparison.inputCueCount, `${label} input cue count differs from its retained file`);
    assert.equal(
      record?.inputSubtitle?.lastCueEndMilliseconds,
      comparison.sourceLastCueEndMilliseconds,
      `${label} input ending differs from its retained file`,
    );
    assert.equal(record?.publicVtt?.cueCount, comparison.publicCueCount, `${label} public cue count differs from its retained file`);
    assert.equal(record?.publicVtt?.lastCueEndMilliseconds, comparison.publicLastCueEndMilliseconds, `${label} public ending differs from its retained file`);
    assert.equal(record?.comparison?.scope, `FULL_${comparison.inputCueCount}_CUE_COMPARISON`, `${label} comparison scope differs`);
    assert.equal(record?.comparison?.inputCueCount, comparison.inputCueCount, `${label} comparison input count differs`);
    assert.equal(record?.comparison?.publicCueCount, comparison.publicCueCount, `${label} comparison public count differs`);
    assert.equal(record?.comparison?.text, comparison.text, `${label} comparison text status differs`);
    assert.equal(record?.comparison?.timing, comparison.timing, `${label} comparison timing status differs`);
    assert.equal(record?.comparison?.lastCueEndMilliseconds, comparison.publicLastCueEndMilliseconds, `${label} comparison ending differs`);
    assert.equal(record?.comparison?.result, comparison.result, `${label} comparison result differs`);
  }
  return { readbackCount: records.length, validationResult: "PASS" };
}

if (import.meta.main) {
  const comparison = await compareSubtitleFiles();
  const history = await validateSubtitleHistory();
  console.log(
    JSON.stringify({
      receipt: "HOTEL_PUBLIC_SUBTITLE_COMPARISON_PASS",
      ...comparison,
      historyReadbackCount: history.readbackCount,
      historyValidationResult: history.validationResult,
      authentication: "NO_COOKIES_OR_CREDENTIALS_SUPPLIED",
      videoFileIdentity: "UNMEASURED",
    }),
  );
}

#!/usr/bin/env node
// information_uuid_v5=adeb6009-db9e-51be-8555-da27f170ca95
// event_uuid_v7=01a053d0-3297-722c-b7f8-5ff273c9b729 state_transition=PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_VTT_DOWNLOADED -> ENGLISH_VTT_TEXT_AND_CUE_TIMES_MATCHED_UI_TRACK_SELECTION_UNMEASURED
// machine-contract: compare every authored cue and both timestamps; no video-file identity is inferred.
// machine-contract: a PASS comparison uses the MATCHED transition; any text or cue-time mismatch uses the MISMATCHED transition.
// machine-contract: history compares a distinct retained SubRip input file with a retained WebVTT output file, with positive ordered non-overlapping cues, before binding bytes to a state.
// machine-contract: every non-empty block is a cue or an explicit WebVTT header/NOTE block; unsupported STYLE/REGION and unknown blocks fail closed.
// machine-contract: cue settings, NUL characters, and the WebVTT cue separator in headers, identifiers, or payloads are unsupported and fail closed.
// machine-contract: importing this module is inert; import.meta.main runs the CLI through symlinks and leaves processing errors uncaught.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const sourceSubtitlePath = resolve(repositoryRoot, "media/demo-video/subtitles.en.srt");
export const publicSubtitlePath = resolve(repositoryRoot, "media/demo-video/youtube-public-201.en.vtt");
export const productionMetadataPath = resolve(repositoryRoot, "metadata/demo-video-production.json");
export const MATCHED_SUBTITLE_STATE_TRANSITION =
  "PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_VTT_DOWNLOADED -> ENGLISH_VTT_TEXT_AND_CUE_TIMES_MATCHED_UI_TRACK_SELECTION_UNMEASURED";
export const MISMATCHED_SUBTITLE_STATE_TRANSITION =
  "PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_VTT_DOWNLOADED -> ENGLISH_VTT_TEXT_OR_CUE_TIMES_MISMATCHED_UI_TRACK_SELECTION_UNMEASURED";
export const UNAVAILABLE_SUBTITLE_STATE_TRANSITION =
  "PUBLIC_SUBTITLE_ANONYMOUS_READBACK_UNMEASURED -> ANONYMOUS_ENGLISH_AUTHORED_TRACK_UNAVAILABLE";
const UNAVAILABLE_SUBTITLE_FAILURE_REASON = "AUTHORED_ENGLISH_TRACK_UNAVAILABLE";
const SUBTITLE_WATCH_URL = "https://www.youtube.com/watch?v=tdSvJw4ghX8";
const HISTORICAL_SUBTITLE_LANGUAGE_SELECTOR = "en.*";
const HISTORICAL_DOWNLOAD_COMMAND = `uvx yt-dlp --skip-download --write-subs --sub-langs "${HISTORICAL_SUBTITLE_LANGUAGE_SELECTOR}" --sub-format vtt --no-write-auto-subs --no-cache-dir`;
const HISTORICAL_CATALOG_COMMAND = "uvx yt-dlp --skip-download --list-subs --no-cache-dir";
const REPRODUCTION_ONLY_COMMAND_STATUS = "REPRODUCTION_ONLY";
const SUBTITLE_LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;

const EXPECTED_CUE_COUNT = 184;
const EXPECTED_LAST_CUE_END_MS = 147760;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

function decodeUtf8(bytes) {
  return UTF8_DECODER.decode(bytes);
}

export function renderYtDlpSubtitleFileName(outputTemplate, infoLanguage, requestedLanguage, extension) {
  const preparedFileName = outputTemplate.replace("%(language)s", infoLanguage).replace("%(ext)s", extension);
  const extensionSuffix = `.${extension}`;
  assert.ok(preparedFileName.endsWith(extensionSuffix), "yt-dlp subtitle output template must end with its extension");
  const baseFileName = preparedFileName.slice(0, -extensionSuffix.length);
  return `${baseFileName}.${requestedLanguage}${extensionSuffix}`;
}

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
const WEBVTT_TIMING_PATTERN = /^(?<start>\d{2}:\d{2}:\d{2}\.\d{3}) --> (?<end>\d{2}:\d{2}:\d{2}\.\d{3})$/u;

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
  assert.ok(timingMatch?.groups, "WebVTT block " + (index + 1) + " is an unrecognized WebVTT block");
  if (!directTimingMatch) {
    assert.ok(!lines[0].includes("-->"), "WebVTT cue identifier cannot contain -->");
  }
  const payload = lines.slice(timingIndex + 1).join("\n");
  assert.ok(!payload.includes("-->"), "WebVTT cue payload cannot contain -->");
  const cueText = normalizeText(payload);
  assert.ok(cueText !== "", "WebVTT block " + (index + 1) + " is an unrecognized WebVTT block");
  return {
    startMs: timestampToMilliseconds(timingMatch.groups.start),
    endMs: timestampToMilliseconds(timingMatch.groups.end),
    text: cueText,
  };
}

function webVttNonCueBlockKind(block) {
  const firstLine = block.split("\n", 1)[0] ?? "";
  if (/^NOTE(?:[ \t].*)?$/u.test(firstLine)) return "NOTE";
  if (/^STYLE$/u.test(firstLine)) return "STYLE";
  if (/^REGION$/u.test(firstLine)) return "REGION";
  return null;
}

function isAllowedWebVttNonCueBlock(block) {
  const kind = webVttNonCueBlockKind(block);
  if (kind === "NOTE") {
    assert.ok(!block.includes("-->"), "WebVTT NOTE block cannot contain -->");
    return true;
  }
  if (kind === "STYLE" || kind === "REGION") {
    assert.fail(`unsupported WebVTT ${kind} block`);
  }
  return false;
}

function parseWebVttHeader(block) {
  const lines = block.split("\n");
  assert.ok(!block.includes("-->"), "WebVTT header cannot contain -->");
  assert.ok(WEBVTT_HEADER_PATTERN.test(lines[0] ?? ""), "WebVTT header is missing");
  const declarations = new Map();
  for (const line of lines.slice(1)) {
    const declaration = /^(?<name>Kind|Language):[ \t](?<value>.*)$/u.exec(line);
    assert.ok(declaration?.groups, "WebVTT header contains an unrecognized line");
    const { name, value } = declaration.groups;
    assert.ok(!declarations.has(name), `WebVTT header contains duplicate ${name}`);
    declarations.set(name, value);
  }
  if (declarations.has("Kind")) {
    assert.equal(declarations.get("Kind"), "captions", "WebVTT header Kind must be captions for English captions");
  }
  if (declarations.has("Language")) {
    assert.equal(declarations.get("Language"), "en", "WebVTT header Language must be en for English captions");
  }
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
  assert.ok(!text.includes("\u0000"), `${resolvedFormat} subtitle contains NUL`);
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

function isUnavailableSubtitleReadback(record) {
  return record?.failure !== undefined || record?.stateTransition === UNAVAILABLE_SUBTITLE_STATE_TRANSITION;
}

function validateSubtitleCommand(command, label, watchUrl, outputFileName = null) {
  assert.ok(command && typeof command === "object", `${label} command evidence is missing`);
  assert.equal(command.commandStatus, REPRODUCTION_ONLY_COMMAND_STATUS, `${label} command status differs`);
  assert.equal(watchUrl, SUBTITLE_WATCH_URL, `${label} watch URL differs`);
  const historicalCommand = outputFileName === null ? HISTORICAL_CATALOG_COMMAND : HISTORICAL_DOWNLOAD_COMMAND;
  assert.equal(command.observedCommand, historicalCommand, `${label} historical command differs`);
  if (outputFileName !== null) {
    assert.equal(command.requestedLanguage, HISTORICAL_SUBTITLE_LANGUAGE_SELECTOR, `${label} language selector differs`);
    assert.equal(typeof command.outputTemplate, "string", `${label} output template is missing`);
    assert.match(command.outputTemplate, /^media\/demo-video\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.%\(ext\)s$/u, `${label} output template is unsafe`);
    const renderedOutputName = basename(renderYtDlpSubtitleFileName(command.outputTemplate, "NA", "en", "vtt"));
    assert.equal(renderedOutputName, outputFileName, `${label} output template does not name its retained file`);
    assert.equal(
      command.command,
      `${historicalCommand} --output "${command.outputTemplate}" "${watchUrl}"`,
      `${label} reproduction command differs`,
    );
  } else {
    assert.equal(command.command, `${historicalCommand} "${watchUrl}"`, `${label} reproduction command differs`);
  }
}

function validateSubtitleCatalogLanguages(catalog, label, englishExpected) {
  assert.ok(Array.isArray(catalog?.languages), `${label} catalog languages must be an array`);
  assert.equal(new Set(catalog.languages).size, catalog.languages.length, `${label} catalog languages must be unique`);
  assert.ok(catalog.languages.every((language) => typeof language === "string" && SUBTITLE_LANGUAGE_PATTERN.test(language)), `${label} catalog has an invalid language code`);
  const hasEnglishLanguage = catalog.languages.some((language) => language.split("-", 1)[0].toLowerCase() === "en");
  assert.equal(hasEnglishLanguage, englishExpected, englishExpected ? `${label} catalog must include English` : `${label} catalog must not include English`);
  assert.equal(catalog.authoredEnglishConfirmed, englishExpected, englishExpected ? `${label} catalog must confirm English` : `${label} catalog must not confirm English`);
}

function validateUnavailableSubtitleReadback(record, label) {
  assert.deepEqual(
    Object.keys(record).sort(),
    [
      "availableSubtitleCatalog",
      "failure",
      "informationUuidV5",
      "measuredAt",
      "observationUuidV7",
      "recordedAt",
      "stateTransition",
      "track",
      "videoId",
      "watchUrl",
    ].sort(),
    `${label} unavailable readback must not contain download, inputSubtitle, publicVtt, or comparison`,
  );
  assert.equal(record.informationUuidV5, "adeb6009-db9e-51be-8555-da27f170ca95", `${label} information UUID differs`);
  assert.equal(record.stateTransition, UNAVAILABLE_SUBTITLE_STATE_TRANSITION, `${label} state transition differs`);
  assert.equal(record.track, "ENGLISH_AUTHORED_TRACK", `${label} track differs`);
  assert.equal(record.videoId, "tdSvJw4ghX8", `${label} video ID differs`);
  assert.equal(record.watchUrl, "https://www.youtube.com/watch?v=tdSvJw4ghX8", `${label} watch URL differs`);
  assert.deepEqual(Object.keys(record.failure ?? {}).sort(), ["reason", "result"], `${label} failure fields differ`);
  assert.equal(record.failure.result, "FAIL", `${label} unavailable failure result must be FAIL`);
  assert.equal(record.failure.reason, UNAVAILABLE_SUBTITLE_FAILURE_REASON, `${label} unavailable failure reason differs`);
  assert.equal(record.watchUrl, SUBTITLE_WATCH_URL, `${label} watch URL differs`);
  const catalog = record.availableSubtitleCatalog;
  assert.deepEqual(
    Object.keys(catalog ?? {}).sort(),
    [
      "authentication",
      "automaticCaptionsSeparate",
      "authoredEnglishConfirmed",
      "captureTiming",
      "capturedAfterComparison",
      "command",
      "commandStatus",
      "languages",
      "observedCommand",
      "source",
      "trackClass",
    ].sort(),
    `${label} unavailable catalog fields differ`,
  );
  assert.equal(catalog.source, "ANONYMOUS_YOUTUBE_PLAYER_METADATA", `${label} catalog source differs`);
  validateSubtitleCommand(catalog, `${label} catalog`, record.watchUrl);
  assert.equal(catalog.authentication, "NONE", `${label} catalog authentication differs`);
  assert.equal(catalog.capturedAfterComparison, false, `${label} unavailable catalog must not claim a comparison`);
  validateSubtitleCatalogLanguages(catalog, `${label} unavailable`, false);
  assert.equal(catalog.trackClass, "MANUAL_SUBTITLES", `${label} catalog track class differs`);
  assert.equal(catalog.automaticCaptionsSeparate, true, `${label} catalog automatic-caption separation differs`);
  assert.ok(catalog.captureTiming && typeof catalog.captureTiming === "object", `${label} catalog capture timing is missing`);
}

export async function compareSubtitleFiles(sourcePath = sourceSubtitlePath, publicPath = publicSubtitlePath, metadataPath = productionMetadataPath) {
  assert.notEqual(resolve(sourcePath), resolve(publicPath), "input and public retained paths must differ");
  assertSubtitlePathExtension(sourcePath, "input subtitle path", "srt");
  assertSubtitlePathExtension(publicPath, "public VTT path", "vtt");
  const [sourceBytes, publicBytes, metadataText] = await Promise.all([readFile(sourcePath), readFile(publicPath), readFile(metadataPath, "utf8")]);
  const sourceText = decodeUtf8(sourceBytes);
  const publicText = decodeUtf8(publicBytes);
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
  let comparisonReadbackCount = 0;
  let unavailableReadbackCount = 0;
  for (const [index, record] of records.entries()) {
    const label = `subtitle readback ${index + 1}`;
    if (isUnavailableSubtitleReadback(record)) {
      validateUnavailableSubtitleReadback(record, label);
      unavailableReadbackCount += 1;
      continue;
    }
    comparisonReadbackCount += 1;
    const inputPath = retainedSubtitlePath(record?.inputSubtitle?.path, `${label} inputSubtitle.path`, root);
    const publicPath = retainedSubtitlePath(record?.publicVtt?.path, `${label} publicVtt.path`, root);
    assert.notEqual(inputPath, publicPath, `${label} input and public retained paths must differ`);
    assertSubtitlePathExtension(record.inputSubtitle.path, `${label} inputSubtitle.path`, "srt");
    assertSubtitlePathExtension(record.publicVtt.path, `${label} publicVtt.path`, "vtt");
    assert.equal(record?.publicVtt?.fileName, basename(publicPath), `${label} publicVtt.fileName differs from its retained path`);
    assert.equal(record?.download?.fileName, basename(publicPath), `${label} download.fileName differs from its retained path`);
    validateSubtitleCommand(
      record?.download,
      `${label} download`,
      record?.watchUrl,
      record?.download?.fileName,
    );
    validateSubtitleCommand(record?.availableSubtitleCatalog, `${label} catalog`, record?.watchUrl);
    validateSubtitleCatalogLanguages(record?.availableSubtitleCatalog, `${label} catalog`, true);
    const [sourceBytes, publicBytes] = await Promise.all([readFile(inputPath), readFile(publicPath)]);
    const sourceText = decodeUtf8(sourceBytes);
    const publicText = decodeUtf8(publicBytes);
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
  return { readbackCount: records.length, comparisonReadbackCount, unavailableReadbackCount, validationResult: "PASS" };
}

if (import.meta.main) {
  const comparison = await compareSubtitleFiles();
  const history = await validateSubtitleHistory();
  console.log(
    JSON.stringify({
      receipt: "HOTEL_PUBLIC_SUBTITLE_COMPARISON_PASS",
      ...comparison,
      historyReadbackCount: history.readbackCount,
      historyComparisonReadbackCount: history.comparisonReadbackCount,
      historyUnavailableReadbackCount: history.unavailableReadbackCount,
      historyValidationResult: history.validationResult,
      authentication: "NO_COOKIES_OR_CREDENTIALS_SUPPLIED",
      videoFileIdentity: "UNMEASURED",
    }),
  );
}

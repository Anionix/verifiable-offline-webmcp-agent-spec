#!/usr/bin/env node
// information_uuid_v5=9adde648-42dc-5cc8-af8f-7aa910cab9ca
// event_uuid_v7=01a04cfc-2b4f-718a-83a2-c74468300f07
// state_transition=ISSUE_TRACKING_NARRATIVE -> EXACT_COMMENT_ISSUE_LEDGER occurred_at=2026-08-29T10:06:29.711Z
// machine-contract: all 53 observed unresolved review threads have one unique issue, and the nine current fixes are distinguished from 44 fixes already preserved on main.
// information_uuid_v5=b73de7b4-0acd-510f-a0a5-a1d270aced91
// event_uuid_v7=01a04d0b-9cbd-7199-aa22-33405aca5d6d
// state_transition=SCHEMA_DECLARED_ONLY -> DRAFT_2020_12_EXECUTED occurred_at=2026-08-29T10:23:21.789Z
// machine-contract: the pinned Python Draft 2020-12 validator and format checker must accept the ledger and reject an invalid merge time, line zero, and an additional root property.
// information_uuid_v5=da8cc2f8-6296-5c0b-926d-cb3f03efc314
// event_uuid_v7=01a04d0b-9cbe-7d37-8316-cc704b507bf0
// state_transition=NEW_VALIDATOR_OUTSIDE_QUALITY_GATE -> OXLINT_AND_OXFMT_GOVERNED occurred_at=2026-08-29T10:23:21.790Z
// machine-contract: the executable validator is checked by Oxlint and Oxfmt, and its Draft 2020-12 schema is checked by Oxfmt, before the repository gate can pass.
import { isDeepStrictEqual } from "node:util";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ledger = JSON.parse(readFileSync(join(root, "metadata/review-comment-issue-ledger.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(root, "schemas/review-comment-issue-ledger.schema.json"), "utf8"));
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REVIEW_URL = /^https:\/\/github\.com\/Anionix\/verifiable-offline-webmcp-agent-spec\/pull\/(\d+)#discussion_r(\d+)$/;
const DRAFT_2020_12_RUNNER = String.raw`
import json
import sys

from jsonschema import Draft202012Validator, FormatChecker

payload = json.load(sys.stdin)
Draft202012Validator.check_schema(payload["schema"])
validator = Draft202012Validator(payload["schema"], format_checker=FormatChecker())
results = []
for case in payload["cases"]:
    errors = sorted(validator.iter_errors(case["instance"]), key=lambda error: (list(error.path), list(error.schema_path)))
    results.append({
        "name": case["name"],
        "errors": [
            {
                "path": list(error.path),
                "schemaPath": list(error.schema_path),
                "validator": error.validator,
                "message": error.message,
            }
            for error in errors
        ],
    })
json.dump(results, sys.stdout, ensure_ascii=False, separators=(",", ":"))
`;
const ENTRY_FIELDS = [
  "informationUuidV5",
  "issueObservationUuidV7",
  "sourcePullRequest",
  "sourcePullRequestState",
  "sourceMergedAt",
  "sourceThreadId",
  "sourceCommentId",
  "sourceReviewUrl",
  "path",
  "line",
  "severity",
  "title",
  "outdatedAtObservation",
  "threadStateAtObservation",
  "issueNumber",
  "issueUrl",
  "issueStateAtObservation",
  "issueStateReasonAtObservation",
  "trackingDisposition",
  "fixDisposition",
];
const EXPECTED_COMMENT_ISSUES = new Map([
  [3881069522, 114],
  [3881453910, 115],
  [3881453919, 121],
  [3881745433, 116],
  [3882005648, 119],
  [3882287954, 118],
  [3882524151, 117],
  [3882524159, 120],
  [3882524168, 123],
  [3882696229, 129],
  [3882696235, 126],
  [3882696241, 127],
  [3882696250, 124],
  [3883049431, 122],
  [3883895232, 128],
  [3883895237, 125],
  [3883895242, 130],
  [3883919859, 133],
  [3883919868, 131],
  [3883919879, 134],
  [3883994468, 135],
  [3883994475, 132],
  [3884100007, 136],
  [3884100021, 137],
  [3884199393, 140],
  [3884199397, 141],
  [3884199399, 138],
  [3884278221, 139],
  [3884278228, 145],
  [3884278232, 142],
  [3884301859, 144],
  [3884378506, 60],
  [3884425035, 143],
  [3884458789, 62],
  [3884458793, 61],
  [3884458795, 63],
  [3884459659, 64],
  [3884459661, 65],
  [3884459663, 66],
  [3884476522, 59],
  [3885893988, 58],
  [3885963043, 55],
  [3885963046, 56],
  [3885963048, 57],
  [3886000121, 107],
  [3886000126, 108],
  [3886029357, 109],
  [3886029359, 110],
  [3886038971, 111],
  [3886038973, 112],
  [3886047396, 113],
  [3886198921, 105],
  [3886198924, 106],
]);

function exactFields(value, expected) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    Object.keys(value).every((key) => expected.includes(key))
  );
}

function uuid7EpochMs(value) {
  return Number.parseInt(value.replaceAll("-", "").slice(0, 12), 16);
}

function validateDraft202012Cases(cases) {
  const result = spawnSync("uv", ["run", "--frozen", "python", "-c", DRAFT_2020_12_RUNNER], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? join(root, ".local/uv-cache") },
    input: JSON.stringify({ schema, cases }),
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Draft 2020-12 validation failed to run: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

function hasExpectedSchemaFailure(result, path, validator) {
  return result.errors.some((error) => isDeepStrictEqual(error.path, path) && error.validator === validator);
}

const invalidMergedAt = structuredClone(ledger);
invalidMergedAt.entries[0].sourceMergedAt = "not-a-date";
const invalidLine = structuredClone(ledger);
invalidLine.entries[0].line = 0;
const invalidAdditionalProperty = structuredClone(ledger);
invalidAdditionalProperty.unexpectedField = true;
const schemaResults = validateDraft202012Cases([
  { name: "current-ledger", instance: ledger },
  { name: "invalid-source-merged-at", instance: invalidMergedAt },
  { name: "line-zero", instance: invalidLine },
  { name: "additional-root-property", instance: invalidAdditionalProperty },
]);
const schemaResultByName = new Map(schemaResults.map((result) => [result.name, result]));
check(schemaResultByName.get("current-ledger")?.errors.length === 0, "Draft 2020-12 rejected the current review ledger");
check(
  hasExpectedSchemaFailure(schemaResultByName.get("invalid-source-merged-at"), ["entries", 0, "sourceMergedAt"], "format"),
  "Draft 2020-12 accepted an invalid sourceMergedAt",
);
check(hasExpectedSchemaFailure(schemaResultByName.get("line-zero"), ["entries", 0, "line"], "minimum"), "Draft 2020-12 accepted line zero");
check(
  hasExpectedSchemaFailure(schemaResultByName.get("additional-root-property"), [], "additionalProperties"),
  "Draft 2020-12 accepted an additional root property",
);

check(ledger.$schema === "../schemas/review-comment-issue-ledger.schema.json", "ledger schema link changed");
check(ledger.repository === "Anionix/verifiable-offline-webmcp-agent-spec", "repository identity changed");
check(ledger.sourceMainCommit === "b61cba217838fce4ef16c0a3403f45afee345352", "source main commit changed");
check(ledger.stateTransition === "REVIEW_THREADS_UNRESOLVED -> ISSUES_TRACKED -> FIX_IN_PROGRESS", "review issue state transition changed");
check(UUID_V5.test(ledger.identity?.informationUuidV5 ?? ""), "ledger information ID is not UUIDv5");
check(UUID_V7.test(ledger.identity?.observationUuidV7 ?? ""), "ledger observation ID is not UUIDv7");
check(Date.parse(ledger.observedAt) === ledger.observedAtEpochMs, "ledger observedAt and epoch differ");
check(uuid7EpochMs(ledger.identity.observationUuidV7) === ledger.observedAtEpochMs, "ledger UUIDv7 time differs");
check(Array.isArray(ledger.entries) && ledger.entries.length === 53, "ledger must contain exactly 53 entries");
check(EXPECTED_COMMENT_ISSUES.size === 53, "expected review mapping must contain exactly 53 entries");

const commentIds = new Set();
const threadIds = new Set();
const reviewUrls = new Set();
const issueNumbers = new Set();
const informationIds = new Set();
for (const entry of ledger.entries) {
  check(exactFields(entry, ENTRY_FIELDS), `review entry ${entry?.sourceCommentId} has unexpected fields`);
  check(UUID_V5.test(entry.informationUuidV5), `review entry ${entry.sourceCommentId} information ID is not UUIDv5`);
  check(UUID_V7.test(entry.issueObservationUuidV7), `review entry ${entry.sourceCommentId} observation ID is not UUIDv7`);
  check(!commentIds.has(entry.sourceCommentId), `review comment ${entry.sourceCommentId} is duplicated`);
  check(!threadIds.has(entry.sourceThreadId), `review thread ${entry.sourceThreadId} is duplicated`);
  check(!reviewUrls.has(entry.sourceReviewUrl), `review URL ${entry.sourceReviewUrl} is duplicated`);
  check(!issueNumbers.has(entry.issueNumber), `issue ${entry.issueNumber} tracks more than one review comment`);
  check(!informationIds.has(entry.informationUuidV5), `review information ID ${entry.informationUuidV5} is duplicated`);
  commentIds.add(entry.sourceCommentId);
  threadIds.add(entry.sourceThreadId);
  reviewUrls.add(entry.sourceReviewUrl);
  issueNumbers.add(entry.issueNumber);
  informationIds.add(entry.informationUuidV5);

  check(EXPECTED_COMMENT_ISSUES.get(entry.sourceCommentId) === entry.issueNumber, `review comment ${entry.sourceCommentId} maps to the wrong issue`);
  const reviewMatch = entry.sourceReviewUrl.match(REVIEW_URL);
  check(reviewMatch !== null, `review URL ${entry.sourceReviewUrl} has an invalid form`);
  check(Number(reviewMatch[1]) === entry.sourcePullRequest, `review URL ${entry.sourceReviewUrl} has the wrong pull request`);
  check(Number(reviewMatch[2]) === entry.sourceCommentId, `review URL ${entry.sourceReviewUrl} has the wrong comment ID`);
  check(
    entry.issueUrl === `https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/issues/${entry.issueNumber}`,
    `issue ${entry.issueNumber} URL changed`,
  );
  check(entry.threadStateAtObservation === "UNRESOLVED", `review thread ${entry.sourceThreadId} was not observed unresolved`);
  check(entry.severity === "P1" || entry.severity === "P2", `issue ${entry.issueNumber} severity is outside the review contract`);
  check(typeof entry.path === "string" && entry.path.length > 0, `issue ${entry.issueNumber} lacks a source path`);
  check(entry.line === null || Number.isInteger(entry.line), `issue ${entry.issueNumber} has an invalid source line`);

  const newlyTracked = entry.issueNumber >= 105 && entry.issueNumber <= 145;
  check(
    entry.trackingDisposition === (newlyTracked ? "ISSUE_CREATED_IN_BATCH" : "ISSUE_ALREADY_TRACKED"),
    `issue ${entry.issueNumber} tracking disposition changed`,
  );
  check(entry.issueStateAtObservation === (newlyTracked ? "OPEN" : "CLOSED"), `issue ${entry.issueNumber} observation state changed`);
  check(entry.issueStateReasonAtObservation === (newlyTracked ? null : "COMPLETED"), `issue ${entry.issueNumber} observation reason changed`);
  const fixedInBatch = entry.issueNumber >= 105 && entry.issueNumber <= 113;
  check(entry.fixDisposition === (fixedInBatch ? "FIX_IN_BATCH" : "FIXED_BEFORE_BATCH"), `issue ${entry.issueNumber} fix disposition changed`);
  check(
    entry.sourcePullRequestState === (entry.sourcePullRequest === 52 ? "OPEN" : "MERGED"),
    `pull request ${entry.sourcePullRequest} observation state changed`,
  );
  check(
    (entry.sourceMergedAt === null) === (entry.sourcePullRequestState === "OPEN"),
    `pull request ${entry.sourcePullRequest} merge time contradicts its state`,
  );
}

const summary = {
  unresolvedReviewThreadsObserved: ledger.entries.length,
  currentThreadsObserved: ledger.entries.filter((entry) => !entry.outdatedAtObservation).length,
  outdatedThreadsObserved: ledger.entries.filter((entry) => entry.outdatedAtObservation).length,
  issuesAlreadyTracked: ledger.entries.filter((entry) => entry.trackingDisposition === "ISSUE_ALREADY_TRACKED").length,
  issuesCreatedInBatch: ledger.entries.filter((entry) => entry.trackingDisposition === "ISSUE_CREATED_IN_BATCH").length,
  fixesVerifiedBeforeBatch: ledger.entries.filter((entry) => entry.fixDisposition === "FIXED_BEFORE_BATCH").length,
  fixesInBatch: ledger.entries.filter((entry) => entry.fixDisposition === "FIX_IN_BATCH").length,
  actualNotifications: 0,
  externalBookingEffects: 0,
  devpostFinalSubmissions: 0,
};
check(isDeepStrictEqual(ledger.summary, summary), "review issue summary differs from the entries");
check(
  isDeepStrictEqual(
    [...issueNumbers].filter((number) => number >= 105).sort((a, b) => a - b),
    Array.from({ length: 41 }, (_, index) => index + 105),
  ),
  "new review issue range must be exactly 105 through 145",
);
check(schema.$defs?.entry?.additionalProperties === false, "review issue schema must reject unknown entry fields");
check(schema.properties?.entries?.minItems === 53 && schema.properties?.entries?.maxItems === 53, "review issue schema count changed");

console.log(`review comment issue ledger: ${checks} checks passed`);

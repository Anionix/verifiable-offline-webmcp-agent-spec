// information_uuid_v5=c54ebaa9-7c51-5825-a10e-a6fa85054fae
// event_uuid_v7=01a048b7-2625-7855-8b2f-80c41da7e93f
// machine-contract: a duplicate retry preserves the measured count of one, while a count above one is shown as a violation.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertPersistedIntentMatchesPreview,
  createInputBoundaryState,
  createVisualState,
  notificationControlAvailability,
  reduceInputBoundaryState,
  reduceVisualState,
  visualEventFromPersistedStatus,
} from "../../../examples/notification-demo/visual-state.js";

// information_uuid_v5=97ce90b3-983b-56e7-9381-c8c2df3068e2
// event_uuid_v7=01a049fe-ffc3-73a1-9446-8e38a434dfca
// state_transition=DISCOVERED -> DRY_RUN occurred_at=2026-08-28T20:10:43.523Z
// machine-contract: a repeated preview restores the persisted control/effect pair and measured effect count instead of inventing a new PREVIEWED state.
// information_uuid_v5=0a6e95b1-f829-5429-9caa-bd142f018915
// event_uuid_v7=01a04a1b-eac6-7c5c-aa43-c19d4a593bfb
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T20:42:18.694Z
// machine-contract: readback accepts a newer control/effect state for the same immutable intent identity while rejecting payload substitution.
// information_uuid_v5=3093ad26-25f3-5912-b015-70a04c93fe08
// event_uuid_v7=01a04a3b-7a18-76a0-b150-b1aacc95e727
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:16:47.000Z
// machine-contract: the WebMCP boundary panel renders the same restored control state, effect state, and measured count as the primary visualization.
// information_uuid_v5=4cb035a8-f737-514f-90c6-da6c0672f814
// event_uuid_v7=01a04a4c-1be8-727c-9b05-be91397708b3
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:34:57.000Z
// machine-contract: restoring another intent starts from the default visual state and cannot inherit retry or delivery text from the prior intent.
// information_uuid_v5=22f6663a-2651-58fe-aab8-f213212c6562
// event_uuid_v7=01a04a4c-1be8-7a58-a3c1-5c4e0474d59f
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:34:57.000Z
// machine-contract: every pre-effect or confirmed-absent state requires a measured effect count of zero; a mismatch renders a safety violation.

// information_uuid_v5=233068fa-1846-5b44-94fe-2479cdc8796d
// event_uuid_v7=01a048c2-e27e-721b-8f08-3bdadbfc683f
// machine-contract: status changes remain perceivable without color or motion, and interactive controls use native semantics.
// information_uuid_v5=352a20a6-27a7-5b3c-b8af-4840c182d390
// event_uuid_v7=01a048c5-b414-73be-bfee-952e95cc42fc
// machine-contract: confirmed effect states reject both zero claims and duplicate claims.
// information_uuid_v5=fd39f8d9-5fc5-56ae-8efc-bf4310a6a924
// event_uuid_v7=01a048d1-d607-7161-8e76-35f6f5ff592c
// machine-contract: the offline demo uses its local font stack without the overused web-font set.
// information_uuid_v5=cbeb5a00-12c7-5557-a8ec-c50cd3765001
// event_uuid_v7=01a048da-1888-7be0-9eef-3e1d0cadd1b1
// machine-contract: accepted input reaches dry run only; rejected input visibly stops before intent creation.
// information_uuid_v5=a031493c-3143-5904-a218-bf47e8be4654
// event_uuid_v7=01a048f8-3326-7ad0-a607-d9b64a598798
// machine-contract: provenance is visible as labeled evidence rather than color-only decoration.
// information_uuid_v5=d53907bf-96cd-56e5-be92-5c4f3576e477
// event_uuid_v7=01a04972-c11c-74d1-8639-c71dded7b68a
// machine-contract: six replay gates are complete, text-labeled, and never bypass prior ledger or reconciliation stops.

test("the input boundary shows accepted WebMCP input reaching dry run only", () => {
  let state = reduceInputBoundaryState(createInputBoundaryState(), { type: "INPUT_RECEIVED" });
  state = reduceInputBoundaryState(state, { type: "INPUT_ACCEPTED" });
  state = reduceInputBoundaryState(state, { type: "DRY_RUN_COMPLETED" });
  assert.equal(state.phase, "dry-run");
  assert.equal(state.receivedState, "success");
  assert.equal(state.validationState, "success");
  assert.equal(state.dryRunState, "success");
  assert.equal(state.dryRunText, "DRY_RUN / NOT_STARTED");
  assert.match(state.announcement, /通知はまだありません/);
});

test("the input boundary exposes rejection before intent creation", () => {
  let state = reduceInputBoundaryState(createInputBoundaryState(), { type: "INPUT_RECEIVED" });
  state = reduceInputBoundaryState(state, { type: "INPUT_REJECTED", message: "許可されていない項目があります" });
  assert.equal(state.phase, "rejected");
  assert.equal(state.validationState, "error");
  assert.equal(state.dryRunState, "blocked");
  assert.match(state.dryRunText, /Intentを作らず停止/);
  assert.match(state.announcement, /通知は作成していません/);
});

test("the input boundary preserves a restored WebMCP state", () => {
  let state = reduceInputBoundaryState(createInputBoundaryState(), { type: "INPUT_RECEIVED" });
  state = reduceInputBoundaryState(state, { type: "INPUT_ACCEPTED" });
  state = reduceInputBoundaryState(state, {
    type: "DRY_RUN_COMPLETED",
    controlState: "VERIFIED",
    effectState: "CONFIRMED_PRESENT",
    effectStartCount: 1,
  });
  assert.equal(state.phase, "restored");
  assert.equal(state.dryRunText, "VERIFIED / CONFIRMED_PRESENT");
  assert.match(state.announcement, /外部効果開始台帳は1回/);
  assert.doesNotMatch(state.announcement, /通知はまだありません/);

  state = reduceInputBoundaryState(state, {
    type: "DRY_RUN_COMPLETED",
    controlState: "EXECUTING",
    effectState: "AMBIGUOUS",
    effectStartCount: 1,
  });
  assert.equal(state.phase, "restored");
  assert.equal(state.dryRunText, "EXECUTING / AMBIGUOUS");
  assert.doesNotMatch(state.announcement, /DRY_RUN \/ NOT_STARTED|通知はまだありません/);
});

test("restoring another intent clears the previous intent visualization", () => {
  let state = reduceVisualState(createVisualState(), { type: "PREVIEWED" });
  state = reduceVisualState(state, { type: "PRESENT_CONFIRMED", effectStartCount: 1 });
  assert.equal(state.retryState, "ready");
  state = reduceVisualState(state, {
    type: "RESTORE_PERSISTED",
    intent: { controlState: "EXECUTING", effectState: "AMBIGUOUS" },
    effectStartCount: 1,
  });
  assert.equal(state.phase, "ambiguous");
  assert.equal(state.retryState, "idle");
  assert.equal(state.retryText, "初回通知後に試せます");
});

test("a pre-effect state with a measured effect is a violation", () => {
  const event = visualEventFromPersistedStatus({ controlState: "DRY_RUN", effectState: "NOT_STARTED" }, 1);
  const state = reduceVisualState(createVisualState(), event);
  assert.equal(state.phase, "violation");
  assert.equal(state.effectStartCount, 1);
  assert.match(state.announcement, /安全条件違反/);
});

test("restored safety violations disable every effect-bearing control until evidence recovers", () => {
  const invalidPreview = notificationControlAvailability(
    { controlState: "DRY_RUN", effectState: "NOT_STARTED" },
    1,
  );
  assert.deepEqual(invalidPreview, {
    approve: false,
    reconcile: false,
    retry: false,
    safetyPassed: false,
  });
  const invalidVerified = notificationControlAvailability(
    { controlState: "VERIFIED", effectState: "CONFIRMED_PRESENT" },
    2,
  );
  assert.equal(invalidVerified.retry, false);
  assert.equal(invalidVerified.safetyPassed, false);

  const recoveredPreview = notificationControlAvailability(
    { controlState: "DRY_RUN", effectState: "NOT_STARTED" },
    0,
  );
  assert.equal(recoveredPreview.approve, true);
  assert.equal(recoveredPreview.safetyPassed, true);
  const recoveredVerified = notificationControlAvailability(
    { controlState: "VERIFIED", effectState: "CONFIRMED_PRESENT" },
    1,
  );
  assert.equal(recoveredVerified.retry, true);
  assert.equal(recoveredVerified.safetyPassed, true);
});

test("an expired restored approval is visible but cannot authorize an effect", () => {
  const intent = {
    controlState: "USER_APPROVED",
    effectState: "NOT_STARTED",
    approvalExpiresAt: 2_000,
  };
  const event = visualEventFromPersistedStatus(intent, 0, 2_001);
  const state = reduceVisualState(createVisualState(), event);
  assert.equal(event.type, "APPROVAL_EXPIRED");
  assert.equal(state.phase, "approval-expired");
  assert.match(state.announcement, /古い承認では通知せず/);
  assert.equal(notificationControlAvailability(intent, 0, 2_001).approve, false);
});

test("local and WebMCP restoration pass measured counts through the same control gate", async () => {
  const application = await readFile(
    new URL("../../../examples/notification-demo/app.js", import.meta.url),
    "utf8",
  );
  assert.match(application, /notificationControlAvailability\(intent, effectStartCount\)/);
  assert.match(application, /render\([\s\S]*status\.effectStartCount,[\s\S]*\);/);
  const webMcpRestoration = application.slice(application.indexOf("async function registerWebMcp"));
  assert.match(webMcpRestoration, /render\([\s\S]*status\.effectStartCount,[\s\S]*\);/);
  assert.match(application, /if \(state\.phase === "violation"\) disableEffectControls\(\)/);
});

test("the visible flow converges two requests to one notification", () => {
  let state = reduceVisualState(createVisualState(), { type: "PREVIEWED" });
  state = reduceVisualState(state, { type: "EXECUTION_CLAIMED" });
  state = reduceVisualState(state, { type: "PRESENT_CONFIRMED", effectStartCount: 1 });
  state = reduceVisualState(state, { type: "RETRY_STARTED" });
  state = reduceVisualState(state, { type: "DUPLICATE_SUPPRESSED", effectStartCount: 1 });
  assert.equal(state.phase, "duplicate-suppressed");
  assert.equal(state.effectStartCount, 1);
  assert.equal(state.notificationCount, 1);
  assert.equal(state.retryText, "ALREADY_VERIFIED");
  assert.equal(state.blockedText, "二件目を停止");
  assert.equal(Object.values(state.replayGates).every((gate) => gate.state === "skipped"), true);
  assert.match(state.replayGateSummary, /6項目は確認不要/);
});

test("a repeated preview restores verified and ambiguous persisted states", () => {
  assert.deepEqual(
    visualEventFromPersistedStatus({ controlState: "VERIFIED", effectState: "CONFIRMED_PRESENT" }, 1),
    { type: "PRESENT_CONFIRMED", effectStartCount: 1 },
  );
  assert.deepEqual(
    visualEventFromPersistedStatus({ controlState: "EXECUTING", effectState: "AMBIGUOUS" }, 1),
    { type: "AMBIGUOUS", effectStartCount: 1 },
  );
  assert.throws(
    () => visualEventFromPersistedStatus({ controlState: "VERIFIED", effectState: "NOT_STARTED" }, 0),
    /unsupported persisted notification state/,
  );
});

test("a status readback accepts a newer state for the same immutable intent", () => {
  const preview = {
    intentId: "intent-1",
    logicalOperationId: "operation-1",
    payloadDigest: "digest-1",
    target: "local-mac-notification",
    title: "title",
    body: "body",
    controlState: "DRY_RUN",
    effectState: "NOT_STARTED",
  };
  assert.doesNotThrow(() => assertPersistedIntentMatchesPreview({
    ...preview,
    controlState: "VERIFIED",
    effectState: "CONFIRMED_PRESENT",
  }, preview));
  assert.throws(() => assertPersistedIntentMatchesPreview({
    ...preview,
    payloadDigest: "substituted",
  }, preview), /immutable intent readback mismatch/);
});

test("the visualization never hides a duplicate-effect violation", () => {
  const state = reduceVisualState(createVisualState(), {
    type: "DUPLICATE_SUPPRESSED",
    effectStartCount: 2,
  });
  assert.equal(state.phase, "violation");
  assert.equal(state.effectStartCount, 2);
  assert.equal(state.notificationCount, 2);
  assert.match(state.announcement, /安全条件違反/);
});

test("a confirmed state with no measured effect is also a violation", () => {
  const state = reduceVisualState(createVisualState(), {
    type: "PRESENT_CONFIRMED",
    effectStartCount: 0,
  });
  assert.equal(state.phase, "violation");
  assert.equal(state.notificationCount, 0);
  assert.match(state.countText, /0件/);
});

test("ambiguous execution explicitly requires reconciliation", () => {
  const state = reduceVisualState(createVisualState(), {
    type: "AMBIGUOUS",
    effectStartCount: 1,
  });
  assert.equal(state.phase, "ambiguous");
  assert.equal(state.countLabel, "結果不明");
  assert.match(state.countText, /再送しません/);
  assert.equal(Object.values(state.replayGates).every((gate) => gate.text === "照合が先"), true);
});

test("all six replay checks are visible and one failure stops replay", () => {
  const state = reduceVisualState(createVisualState(), {
    type: "REPLAY_GATES_EVALUATED",
    decision: "STOP",
    gates: [
      { gate: "AUTHORIZATION", status: "PASS" },
      { gate: "PERMISSION", status: "BLOCKED" },
      { gate: "VERSION", status: "PASS" },
      { gate: "CONSENT", status: "PASS" },
      { gate: "TIME_TO_LIVE", status: "PASS" },
      { gate: "PRECONDITION", status: "PASS" },
    ],
  });
  assert.equal(state.phase, "replay-blocked");
  assert.equal(Object.keys(state.replayGates).length, 6);
  assert.equal(state.replayGates.permission.state, "blocked");
  assert.equal(state.replayGates.authorization.state, "success");
  assert.equal(state.blockedText, "再送を停止");
});

test("the visualization exposes status semantics and a reduced-motion path", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../../../examples/notification-demo/index.html", import.meta.url), "utf8"),
    readFile(new URL("../../../examples/notification-demo/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="status"/);
  assert.match(html, /<button[^>]+id="preview"/);
  assert.match(html, /<label[^>]+for="logical-operation"/);
  assert.match(html, /id="input-boundary-flow"/);
  assert.match(html, /受信/);
  assert.match(html, /厳格検査/);
  assert.match(html, /乾式実行だけ/);
  assert.match(html, /未信頼の印を読み戻す/);
  assert.match(html, /id="provenance-channel"/);
  assert.match(html, /id="provenance-trust"/);
  assert.match(html, /id="provenance-origin"/);
  assert.match(html, /id="provenance-readback"/);
  assert.match(html, /id="replay-gate-title"/);
  assert.match(html, /再試行前の6項目/);
  assert.match(html, /id="replay-authorization"/);
  assert.match(html, /id="replay-permission"/);
  assert.match(html, /id="replay-version"/);
  assert.match(html, /id="replay-consent"/);
  assert.match(html, /id="replay-time-to-live"/);
  assert.match(html, /id="replay-precondition"/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.input-boundary-flow \{ grid-template-columns: 1fr/);
  assert.match(css, /\.provenance-rail \{ grid-template-columns: repeat\(2/);
  assert.match(css, /\.replay-gates \{ grid-template-columns: repeat\(3/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /font-family: "Avenir Next", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif/);
  assert.doesNotMatch(css, /\b(?:Inter|Roboto|Fraunces|Geist|Plus Jakarta Sans|Space Grotesk)\b/i);
});

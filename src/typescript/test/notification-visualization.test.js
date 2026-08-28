// information_uuid_v5=c54ebaa9-7c51-5825-a10e-a6fa85054fae
// event_uuid_v7=01a048b7-2625-7855-8b2f-80c41da7e93f
// machine-contract: a duplicate retry preserves the measured count of one, while a count above one is shown as a violation.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createVisualState, reduceVisualState } from "../../../examples/notification-demo/visual-state.js";

// information_uuid_v5=233068fa-1846-5b44-94fe-2479cdc8796d
// event_uuid_v7=01a048c2-e27e-721b-8f08-3bdadbfc683f
// machine-contract: status changes remain perceivable without color or motion, and interactive controls use native semantics.
// information_uuid_v5=352a20a6-27a7-5b3c-b8af-4840c182d390
// event_uuid_v7=01a048c5-b414-73be-bfee-952e95cc42fc
// machine-contract: confirmed effect states reject both zero claims and duplicate claims.
// information_uuid_v5=fd39f8d9-5fc5-56ae-8efc-bf4310a6a924
// event_uuid_v7=01a048d1-d607-7161-8e76-35f6f5ff592c
// machine-contract: the offline demo uses its local font stack without the overused web-font set.

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
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /font-family: "Avenir Next", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif/);
  assert.doesNotMatch(css, /\b(?:Inter|Roboto|Fraunces|Geist|Plus Jakarta Sans|Space Grotesk)\b/i);
});

// information_uuid_v5=9944cdf2-dd20-5913-a8a4-ea1e2fcd3ad8
// event_uuid_v7=01a04921-8851-7dd4-aa8b-1c2fae21afb5
// machine-contract: the visualization cannot label a run verified when even one external effect started or fault probe was not rejected.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deriveSyncView, stagedSyncView } from "../../../examples/offline-sync-demo/visual-state.js";

const evidence = JSON.parse(readFileSync(new URL("../../../metadata/offline-sync-verification.json", import.meta.url), "utf8"));

test("public evidence visibly reduces two notification sources to zero effects and one review", () => {
  const view = deriveSyncView(evidence);
  assert.equal(view.phase, "verified");
  assert.equal(view.intentSources, 2);
  assert.equal(view.notifications, 0);
  assert.equal(view.reviewCases, 1);
  assert.deepEqual(view.safeTags, ["offline-first", "shared", "verifiable"]);
  assert.equal(stagedSyncView(view, 4).dangerousEffectStopped, true);
});

test("the visible state becomes a violation if a notification starts or a fault is not stopped", () => {
  const started = structuredClone(evidence);
  started.observations.externalEffectStarts = 1;
  assert.equal(deriveSyncView(started).phase, "violation");
  const missedFork = structuredClone(evidence);
  missedFork.observations.forkRejected = "UNMEASURED";
  assert.equal(deriveSyncView(missedFork).phase, "violation");
});

test("the demo server is a read-only evidence surface without an effect execution route", () => {
  const server = readFileSync(new URL("../sync/demo-server.ts", import.meta.url), "utf8");
  assert.match(server, /\["GET", "HEAD"\]/);
  assert.doesNotMatch(server, /approve-and-claim|NotificationEngine|NotificationAdapter/);
  const html = readFileSync(new URL("../../../examples/offline-sync-demo/index.html", import.meta.url), "utf8");
  assert.match(html, /この画面に通知を実行する操作はありません/);
  assert.match(html, /aria-live="polite"/);
});

// information_uuid_v5=8017288b-66a9-5dd0-866d-2d9b033dafce
// event_uuid_v7=01a0493d-49bb-79ce-b84d-ef2815c939cd
// machine-contract: visual VERIFIED state requires exactly one candidate and zero authorization, effects, real network requests, and retries.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolve } from "node:path";
import { derivePlannerView, stagedPlannerView } from "../../../examples/online-planner-demo/visual-state.js";

const root = resolve(import.meta.dirname, "../../..");

async function evidenceFiles() {
  const evidence = JSON.parse(await readFile(resolve(root, "metadata/online-planner-verification.json"), "utf8"));
  const events = (await readFile(resolve(root, "data/audit/online-planner-events.ndjson"), "utf8"))
    .trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  return { evidence, events };
}

test("public planner evidence renders the hard authority stop", async () => {
  const { evidence, events } = await evidenceFiles();
  const view = derivePlannerView(evidence, events);
  assert.equal(view.phase, "verified");
  assert.equal(view.candidateCount, 1);
  assert.equal(view.authorizationCount, 0);
  assert.equal(view.effectCount, 0);
  assert.equal(view.networkCount, 0);
  assert.equal(view.retryCount, 0);
  assert.equal(stagedPlannerView(view, 4).authorityStopped, true);
});

test("any claimed effect changes the visualization to a violation", async () => {
  const { evidence, events } = await evidenceFiles();
  const changed = structuredClone(evidence);
  changed.scope.externalEffectStarts = 1;
  const view = derivePlannerView(changed, events);
  assert.equal(view.phase, "violation");
  assert.equal(stagedPlannerView(view, 4).violation, true);
  assert.equal(stagedPlannerView(view, 4).authorityStopped, false);
});

test("an unsafe audit event cannot be hidden by a safe summary", async () => {
  const { evidence, events } = await evidenceFiles();
  const changedEvents = structuredClone(events);
  changedEvents[0].authorizationCreated = 1;
  assert.equal(derivePlannerView(evidence, changedEvents).phase, "violation");
});

// information_uuid_v5=6c13ddbc-3bad-5a27-a471-f250e3b79279
// event_uuid_v7=01a04c92-0d3b-7a4d-b2c3-5339832830cd
// state_transition=REVIEW_FINDINGS_OPEN -> NOTIFICATION_REGRESSIONS_COVERED occurred_at=2026-08-29T08:14:35.195Z
// machine-contract: changed visible content, permission races, and reload after approval cannot substitute an intent or consume more than one effect-start slot.
// information_uuid_v5=e3600a62-baf5-5f10-b1d3-ae0ae962ca7f
// source_issue_observation_uuid_v7=01a04cf7-edbe-72e1-954d-efd343fa8750
// event_uuid_v7=01a04cf7-edba-7522-a031-3eb2f7dad1c8
// state_transition=OMITTED_APPROVAL_BINDING_ACCEPTED -> INCOMPLETE_BINDING_REJECTED occurred_at=2026-08-29T10:01:51.802Z
// machine-contract: every omitted field and every mismatched value is rejected before approval or effect-start state can be persisted; the exact six-field binding remains accepted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";

Object.defineProperties(globalThis, {
  IDBKeyRange: { configurable: true, value: IDBKeyRange },
  indexedDB: { configurable: true, value: indexedDB },
  location: { configurable: true, value: Object.freeze({ origin: "https://notification.test" }) },
});

const contract = await import("../../../examples/vercel-notification-demo/approval-contract.js");
const store = await import("../../../examples/vercel-notification-demo/browser-store.js");

function input(suffix) {
  return Object.freeze({
    logicalOperationId: `approval-regression-${suffix}`,
    title: `Visible title ${suffix}`,
    body: `Visible body ${suffix}`,
  });
}

function incompleteBindings(binding) {
  return Object.keys(binding).map((omitted) => {
    const incomplete = { ...binding };
    delete incomplete[omitted];
    return incomplete;
  });
}

function mismatchedBindings(binding) {
  return Object.keys(binding).map((changed) => ({ ...binding, [changed]: `${binding[changed]}-mismatch` }));
}

test("approval and effect start reject omitted, incomplete, and mismatched bindings before mutation", async () => {
  const envelope = await store.createOrReadDryRun(input("required-binding"), { channel: "LOCAL_FORM" });
  const binding = contract.approvalBindingFromIntent(envelope.intent);
  const invalidBindings = [undefined, null, {}, ...incompleteBindings(binding), ...mismatchedBindings(binding)];

  for (const invalid of invalidBindings) {
    await assert.rejects(store.approveIntent(binding.intentId, invalid), /visible notification content does not match/);
  }
  let persisted = await store.getIntent(binding.intentId);
  assert.equal(persisted.controlState, "DRY_RUN");
  assert.equal(persisted.effectState, "NOT_STARTED");
  assert.equal(persisted.effectStartCount, 0);
  assert.deepEqual(
    (await store.listIntentEvents(binding.intentId)).map((event) => event.kind),
    ["intent-dry-run-created"],
  );

  await store.approveIntent(binding.intentId, binding);
  for (const invalid of invalidBindings) {
    await assert.rejects(store.claimEffectStart(binding.intentId, invalid), /visible notification content does not match|persisted approval is not bound/);
  }
  persisted = await store.getIntent(binding.intentId);
  assert.equal(persisted.controlState, "USER_APPROVED");
  assert.equal(persisted.effectState, "NOT_STARTED");
  assert.equal(persisted.effectStartCount, 0);
  assert.deepEqual(
    (await store.listIntentEvents(binding.intentId)).map((event) => event.kind),
    ["intent-dry-run-created", "human-approved"],
  );

  const claimed = await store.claimEffectStart(binding.intentId, binding);
  assert.equal(claimed.intent.controlState, "EXECUTING");
  assert.equal(claimed.intent.effectState, "AMBIGUOUS");
  assert.equal(claimed.intent.effectStartCount, 1);
});

test("abort before effect remains available without an approval binding", async () => {
  const envelope = await store.createOrReadDryRun(input("unbound-abort-control"), { channel: "LOCAL_FORM" });
  const aborted = await store.abortBeforeEffect(envelope.intent.intentId, "USER_CANCELLED");
  assert.equal(aborted.intent.controlState, "ABORTED");
  assert.equal(aborted.intent.effectState, "NOT_STARTED");
  assert.equal(aborted.intent.effectStartCount, 0);
});

test("approval is bound to the exact normalized dry-run content", async () => {
  const original = input("content-binding");
  const envelope = await store.createOrReadDryRun(original, { channel: "LOCAL_FORM" });
  const binding = contract.approvalBindingFromIntent(envelope.intent);
  const changed = { ...original, title: "Changed after dry run" };
  const [changedIntentId, changedDigest] = await Promise.all([store.deriveIntentId(changed.logicalOperationId), store.digestPayload(changed)]);

  assert.throws(() => contract.assertVisibleInputMatchesApproval(binding, changed, changedIntentId, changedDigest), /visible notification changed/);
  await assert.rejects(store.approveIntent(binding.intentId, { ...binding, title: changed.title }), /visible notification content does not match/);
  assert.equal((await store.getIntent(binding.intentId)).controlState, "DRY_RUN");

  const approved = await store.approveIntent(binding.intentId, binding);
  assert.equal(approved.intent.controlState, "USER_APPROVED");
  assert.equal(approved.intent.approvalIntentId, binding.intentId);
  assert.equal(approved.intent.approvalPayloadDigest, binding.payloadDigest);
});

test("a pending permission result stays bound to the intent captured before waiting", async () => {
  const firstEnvelope = await store.createOrReadDryRun(input("permission-first"), { channel: "LOCAL_FORM" });
  const secondEnvelope = await store.createOrReadDryRun(input("permission-second"), { channel: "WEBMCP" });
  const first = contract.approvalBindingFromIntent(firstEnvelope.intent);
  let selected = first;
  let resolvePermission;
  const waiting = contract.requestPermissionForApproval(
    first,
    () =>
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
  );

  selected = contract.approvalBindingFromIntent(secondEnvelope.intent);
  resolvePermission("granted");
  const result = await waiting;
  assert.equal(selected.intentId, secondEnvelope.intent.intentId);
  assert.equal(result.binding.intentId, firstEnvelope.intent.intentId);
  assert.equal(result.binding.payloadDigest, firstEnvelope.intent.payloadDigest);
  assert.equal(result.permission, "granted");
});

test("USER_APPROVED and NOT_STARTED resumes once after a module reload", async () => {
  const original = input("reload-resume");
  const envelope = await store.createOrReadDryRun(original, { channel: "LOCAL_FORM" });
  const binding = contract.approvalBindingFromIntent(envelope.intent);
  await store.approveIntent(binding.intentId, binding);

  const reloaded = await import(`../../../examples/vercel-notification-demo/browser-store.js?reload=${Date.now()}`);
  const restored = await reloaded.getIntent(binding.intentId);
  assert.equal(restored.controlState, "USER_APPROVED");
  assert.equal(restored.effectState, "NOT_STARTED");
  assert.equal(restored.effectStartCount, 0);
  const restoredBinding = contract.approvalBindingFromIntent(restored);
  contract.assertIntentMatchesApprovalBinding(restored, restoredBinding, { requirePersistedApproval: true });

  const attempts = await Promise.allSettled([
    reloaded.claimEffectStart(binding.intentId, restoredBinding),
    reloaded.claimEffectStart(binding.intentId, restoredBinding),
  ]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
  const after = await reloaded.getIntent(binding.intentId);
  assert.equal(after.controlState, "EXECUTING");
  assert.equal(after.effectState, "AMBIGUOUS");
  assert.equal(after.effectStartCount, 1);
  assert.deepEqual(
    (await reloaded.listIntentEvents(binding.intentId)).map((event) => event.kind),
    ["intent-dry-run-created", "human-approved", "effect-start-claimed"],
  );
});

test("the application invalidates approval on edits and never rereads the selected intent after permission wait", async () => {
  const [application, worker] = await Promise.all([
    readFile(new URL("../../../examples/vercel-notification-demo/app.js", import.meta.url), "utf8"),
    readFile(new URL("../../../examples/vercel-notification-demo/service-worker.js", import.meta.url), "utf8"),
  ]);
  const approvalFunction = application.slice(
    application.indexOf("async function approveAndNotify("),
    application.indexOf("async function retrySameOperation("),
  );
  const afterPermissionWait = approvalFunction.slice(approvalFunction.indexOf("await requestPermissionForApproval"));
  assert.match(application, /input\.addEventListener\("input"[\s\S]*currentApprovalBinding = null/);
  assert.match(approvalFunction, /const intentId = clickedBinding\.intentId/);
  assert.doesNotMatch(afterPermissionWait, /currentIntentId/);
  assert.match(worker, /"\/approval-contract\.js"/);
});

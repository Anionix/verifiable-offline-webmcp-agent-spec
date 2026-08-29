// information_uuid_v5=58f4a6aa-2439-5811-bb59-6ee84fb23a1e
// event_uuid_v7=01a04872-05cd-7c54-89cc-29efcd16142c
// machine-contract: duplicate-effect count must remain <= 1 across retry, ambiguity, and restart scenarios.
// event_uuid_v7=01a04893-376c-7fc0-aabe-f56beef8ec7e
// machine-contract: every suppressed retry is auditable even though it leaves control and effect state unchanged.
// information_uuid_v5=e0ed63ea-430a-5598-8dff-436a4c5fa6ca
// event_uuid_v7=01a04972-c1fd-7e7e-b547-e2cba731d317
// machine-contract: browser show claims remain AMBIGUOUS until exactly one matching Service Worker tag is independently read back.
// information_uuid_v5=5b3dd6c4-39fd-57b2-98bc-842b8d7f88bc
// event_uuid_v7=01a0498b-5662-7094-9bef-88e9b2f13a10
// machine-contract: confirmed pre-effect absence keeps measured effect starts at zero; a later successful replay raises it to one, never two.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { ReplayBlockedError, type ReplayEvidence } from "../governance/replay-verification.ts";
import { AuditLog } from "../notification/audit-log.ts";
import { NotificationEngine } from "../notification/engine.ts";
import { SimulatedNotificationAdapter } from "../notification/simulated-adapter.ts";
import { NotificationStore } from "../notification/store.ts";
import type { NotificationIntent } from "../notification/types.ts";
import { uuidV7 } from "../uuid.ts";

// information_uuid_v5=97ce90b3-983b-56e7-9381-c8c2df3068e2
// event_uuid_v7=01a049fe-ffc3-73a1-9446-8e38a434dfca
// state_transition=DISCOVERED -> DRY_RUN occurred_at=2026-08-28T20:10:43.523Z
// machine-contract: notification title and body limits count Unicode code points consistently at projection and engine boundaries.

interface Fixture {
  directory: string;
  store: NotificationStore;
  audit: AuditLog;
  engine: NotificationEngine;
  now: { value: number };
  close(): void;
}

function fixture(name: string): Fixture {
  const directory = mkdtempSync(join(tmpdir(), `notification-${name}-`));
  const now = { value: 1_787_913_600_000 };
  const store = new NotificationStore(join(directory, "queue.sqlite"));
  const audit = new AuditLog(join(directory, "audit.ndjson"));
  const engine = new NotificationEngine({ store, audit, now: () => now.value });
  return {
    directory,
    store,
    audit,
    engine,
    now,
    close() {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("engine length limits count astral Unicode characters like the input projector", () => {
  const item = fixture("unicode-length");
  try {
    assert.doesNotThrow(() => item.engine.createIntent({
      logicalOperationId: "unicode-length-valid",
      title: "😀".repeat(120),
      body: "本文",
    }));
    assert.throws(() => item.engine.createIntent({
      logicalOperationId: "unicode-length-invalid",
      title: "😀".repeat(121),
      body: "本文",
    }), /1-120 Unicode characters/);
  } finally {
    item.close();
  }
});

async function prepare(engine: NotificationEngine, logicalOperationId: string) {
  const intent = engine.createIntent({
    logicalOperationId,
    title: "検証通知",
    body: "この通知は一度だけ表示されます。",
  });
  await engine.preview(intent.intentId);
  engine.approve(intent.intentId);
  return intent;
}

function validReplayEvidence(engine: NotificationEngine, intent: NotificationIntent, now: number): ReplayEvidence {
  const bound = () => ({
    intentId: intent.intentId,
    payloadDigest: intent.payloadDigest,
    evidenceEventId: uuidV7(now),
    observedAtEpochMs: now,
  });
  const preconditionDigest = engine.replayPreconditionDigest(intent);
  return {
    authorization: { ...bound(), source: "AUTHORIZATION_POLICY", decision: "ALLOW" },
    permission: { ...bound(), source: "HOST_PERMISSION_READBACK", state: "GRANTED" },
    version: { ...bound(), source: "VERSION_REGISTRY", requiredVersion: "0.1.0", observedVersion: "0.1.0" },
    consent: { ...bound(), source: "USER_CONSENT_RECEIPT", expiresAtEpochMs: now + 60_000 },
    timeToLive: { ...bound(), source: "TRUSTED_CLOCK", queuedAtEpochMs: now, expiresAtEpochMs: now + 60_000 },
    precondition: {
      ...bound(),
      source: "INDEPENDENT_READ_BACK",
      priorEffectState: "CONFIRMED_ABSENT",
      priorEffectStartStatus: "NOT_STARTED",
      expectedDigest: preconditionDigest,
      observedDigest: preconditionDigest,
    },
  };
}

test("an existing effect ledger migrates to conservative start assessment", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-ledger-migration-"));
  const databasePath = join(directory, "queue.sqlite");
  const legacy = new DatabaseSync(databasePath);
  try {
    legacy.exec(`
      CREATE TABLE effects (
        effect_event_id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        outcome TEXT NOT NULL,
        receipt_json TEXT
      );
      INSERT INTO effects VALUES ('present-event', 'legacy-intent', 1, 'CONFIRMED_PRESENT', NULL);
      INSERT INTO effects VALUES ('absent-event', 'legacy-intent', 2, 'CONFIRMED_ABSENT', NULL);
    `);
  } finally {
    legacy.close();
  }
  const migrated = new NotificationStore(databasePath);
  try {
    const rows = (migrated.database.prepare(`
      SELECT effect_event_id, start_status FROM effects ORDER BY started_at
    `).all() as Array<{ effect_event_id: string; start_status: string }>)
      .map((row) => ({ ...row }));
    assert.deepEqual(rows, [
      { effect_event_id: "present-event", start_status: "STARTED" },
      { effect_event_id: "absent-event", start_status: "UNKNOWN" },
    ]);
    assert.equal(migrated.countEffectStarts("legacy-intent"), 2);
  } finally {
    migrated.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a duplicate request never starts a second visible effect", async () => {
  const item = fixture("dedupe");
  try {
    const adapter = new SimulatedNotificationAdapter("success");
    const intent = await prepare(item.engine, "dedupe-case");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "VERIFIED");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "ALREADY_VERIFIED");
    assert.equal(adapter.executionCount, 1);
    assert.equal(adapter.effectStartCount, 1);
    assert.equal(adapter.visible.size, 1);
    assert.equal(item.store.countEffectClaims(intent.intentId), 1);
    assert.equal(item.store.getLatestEffectClaimEvidence(intent.intentId)?.startStatus, "STARTED");
    assert.equal(item.engine.getEffectStartCount(intent.intentId), 1);
    assert.equal(item.audit.verify().count, 8);
  } finally {
    item.close();
  }
});

test("browser confirmation rejects fabricated counts and persists claim separately from truth", async () => {
  const item = fixture("browser-independent-readback");
  try {
    const intent = await prepare(item.engine, "browser-independent-readback-case");
    const claim = item.engine.claimBrowserExecution(intent.intentId);
    assert.equal(claim.status, "COMMAND");
    assert.throws(
      () => item.engine.confirmBrowserReceipt(intent.intentId, { activeTags: [intent.intentId, intent.intentId] }),
      /duplicate notification readback detected/,
    );
    assert.throws(
      () => item.engine.confirmBrowserReceipt(intent.intentId, { activeTags: ["different-intent"] }),
      /different intent tag/,
    );
    assert.equal(item.engine.getIntent(intent.intentId)?.effectState, "AMBIGUOUS");
    const verified = item.engine.confirmBrowserReceipt(intent.intentId, { activeTags: [intent.intentId] });
    assert.equal(verified.status, "VERIFIED");
    assert.equal(item.engine.getEffectStartCount(intent.intentId), 1);

    const row = item.store.database.prepare(`
      SELECT receipt_json FROM effects WHERE intent_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1
    `).get(intent.intentId) as { receipt_json: string };
    const receipt = JSON.parse(row.receipt_json) as {
      verification: {
        recordedClaim: { source: string; claimedPresence: string };
        independentObservation: { method: string; observedPresence: string };
        truthEstimate: { presence: string };
      };
    };
    assert.equal(receipt.verification.recordedClaim.source, "BROWSER_SHOW_NOTIFICATION");
    assert.equal(receipt.verification.recordedClaim.claimedPresence, "PRESENT");
    assert.equal(receipt.verification.independentObservation.method, "SERVICE_WORKER_GET_NOTIFICATIONS");
    assert.equal(receipt.verification.independentObservation.observedPresence, "PRESENT");
    assert.equal(receipt.verification.truthEstimate.presence, "CONFIRMED_PRESENT");
  } finally {
    item.close();
  }
});

test("the same payload in different logical operations gets different intent IDs", () => {
  const item = fixture("identity");
  try {
    const first = item.engine.createIntent({ logicalOperationId: "operation-a", title: "同じ", body: "本文" });
    const second = item.engine.createIntent({ logicalOperationId: "operation-b", title: "同じ", body: "本文" });
    assert.notEqual(first.intentId, second.intentId);
    assert.equal(first.payloadDigest, second.payloadDigest);
  } finally {
    item.close();
  }
});

test("a timeout after the effect forces reconciliation and blocks retry", async () => {
  const item = fixture("ambiguous");
  try {
    const adapter = new SimulatedNotificationAdapter("timeout-after-effect");
    const intent = await prepare(item.engine, "ambiguous-case");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "AMBIGUOUS");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "RECONCILE_REQUIRED");
    assert.equal(adapter.executionCount, 1);
    assert.equal(adapter.effectStartCount, 1);
    assert.equal((await item.engine.reconcile(intent.intentId, adapter)).status, "VERIFIED");
    assert.equal(adapter.visible.size, 1);
    assert.equal(item.audit.verify().valid, true);
  } finally {
    item.close();
  }
});

test("a later absent readback cannot erase an unknown historical effect start", async () => {
  const item = fixture("historical-effect-unknown");
  try {
    const adapter = new SimulatedNotificationAdapter("timeout-after-effect");
    const intent = await prepare(item.engine, "historical-effect-unknown-case");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "AMBIGUOUS");
    adapter.visible.clear();
    assert.equal((await item.engine.reconcile(intent.intentId, adapter)).status, "AMBIGUOUS");
    assert.equal(item.engine.getIntent(intent.intentId)?.effectState, "AMBIGUOUS");
    assert.equal(item.engine.getEffectStartCount(intent.intentId), 1);
    assert.throws(
      () => item.engine.resetAfterConfirmedAbsent(intent.intentId, validReplayEvidence(item.engine, item.engine.getIntent(intent.intentId)!, item.now.value)),
      /replay evaluation requires ABORTED\/CONFIRMED_ABSENT|reset requires|requires ABORTED/,
    );
  } finally {
    item.close();
  }
});

test("a confirmed pre-effect failure can be reproposed with a new approval", async () => {
  const item = fixture("confirmed-absent");
  try {
    const adapter = new SimulatedNotificationAdapter("fail-before-effect");
    const intent = await prepare(item.engine, "retry-case");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "ABORTED_CONFIRMED_ABSENT");
    assert.equal(adapter.visible.size, 0);
    assert.equal(item.store.getLatestEffectClaimEvidence(intent.intentId)?.startStatus, "NOT_STARTED");
    const confirmedAbsent = item.engine.getIntent(intent.intentId)!;
    item.now.value += 1;
    item.engine.resetAfterConfirmedAbsent(
      intent.intentId,
      validReplayEvidence(item.engine, confirmedAbsent, item.now.value),
    );
    await item.engine.preview(intent.intentId);
    item.engine.approve(intent.intentId);
    adapter.mode = "success";
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "VERIFIED");
    assert.equal(adapter.visible.size, 1);
    assert.equal(adapter.executionCount, 2);
    assert.equal(adapter.effectStartCount, 1);
    assert.equal(item.store.countEffectClaims(intent.intentId), 2);
    assert.equal(item.engine.getEffectStartCount(intent.intentId), 1);
  } finally {
    item.close();
  }
});

test("a failed replay gate remains stopped before a second effect claim", async () => {
  const item = fixture("replay-gate-stop");
  try {
    const adapter = new SimulatedNotificationAdapter("fail-before-effect");
    const intent = await prepare(item.engine, "replay-gate-stop-case");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "ABORTED_CONFIRMED_ABSENT");
    const confirmedAbsent = item.engine.getIntent(intent.intentId)!;
    const evidence = validReplayEvidence(item.engine, confirmedAbsent, item.now.value);
    evidence.permission.state = "DENIED";
    assert.throws(
      () => item.engine.resetAfterConfirmedAbsent(intent.intentId, evidence),
      (error: unknown) => error instanceof ReplayBlockedError
        && error.evaluation.decision === "STOP"
        && error.evaluation.gates.find((gate) => gate.gate === "PERMISSION")?.status === "BLOCKED",
    );
    assert.equal(item.engine.getIntent(intent.intentId)?.effectState, "CONFIRMED_ABSENT");
    assert.equal(item.engine.getEffectStartCount(intent.intentId), 0);
    assert.equal(item.store.countEffectClaims(intent.intentId), 1);
    assert.equal(adapter.executionCount, 1);
    assert.equal(adapter.effectStartCount, 0);
  } finally {
    item.close();
  }
});

test("restart preserves ambiguous state and does not execute twice", async () => {
  const item = fixture("restart");
  const databasePath = join(item.directory, "queue.sqlite");
  const auditPath = join(item.directory, "audit.ndjson");
  try {
    const adapter = new SimulatedNotificationAdapter("timeout-after-effect");
    const intent = await prepare(item.engine, "restart-case");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "AMBIGUOUS");
    item.store.close();
    const reopenedStore = new NotificationStore(databasePath);
    const reopened = new NotificationEngine({ store: reopenedStore, audit: new AuditLog(auditPath), now: () => item.now.value });
    assert.equal((await reopened.execute(intent.intentId, adapter)).status, "RECONCILE_REQUIRED");
    assert.equal(adapter.executionCount, 1);
    assert.equal((await reopened.reconcile(intent.intentId, adapter)).status, "VERIFIED");
    reopenedStore.close();
  } finally {
    rmSync(item.directory, { recursive: true, force: true });
  }
});

test("expired approval aborts before the adapter is called", async () => {
  const item = fixture("expiry");
  try {
    const adapter = new SimulatedNotificationAdapter("success");
    const intent = item.engine.createIntent({ logicalOperationId: "expiry-case", title: "期限", body: "期限切れ" });
    await item.engine.preview(intent.intentId);
    item.engine.approve(intent.intentId, 1_000);
    item.now.value += 1_001;
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "APPROVAL_EXPIRED");
    assert.equal(adapter.executionCount, 0);
  } finally {
    item.close();
  }
});

test("an expired approval is explicitly reprepared, reapproved, and started with a new receipt", async () => {
  const item = fixture("expired-reapproval");
  try {
    const intent = item.engine.createIntent({
      logicalOperationId: "expired-reapproval-case",
      title: "期限",
      body: "再承認",
    });
    await item.engine.preview(intent.intentId);
    const expiredReceipt = item.engine.approve(intent.intentId, 1_000);
    item.now.value += 1_001;

    const reprepared = await item.engine.preview(intent.intentId);
    const afterReprepare = item.engine.getIntent(intent.intentId)!;
    assert.equal(afterReprepare.controlState, "DRY_RUN");
    assert.equal(afterReprepare.effectState, "NOT_STARTED");
    assert.equal(afterReprepare.approvalEventId, null);
    assert.equal(afterReprepare.approvalPayloadDigest, null);
    assert.equal(afterReprepare.approvalExpiresAt, null);
    assert.equal(reprepared.payloadDigest, intent.payloadDigest);

    const renewedReceipt = item.engine.approve(intent.intentId, 120_000);
    assert.notEqual(renewedReceipt.eventId, expiredReceipt.eventId);
    assert.ok(renewedReceipt.expiresAt > expiredReceipt.expiresAt);
    const claimed = item.engine.claimBrowserExecution(intent.intentId);
    assert.equal(claimed.status, "COMMAND");
    assert.equal(item.engine.getEffectStartCount(intent.intentId), 1);
    const kinds = item.store.database
      .prepare("SELECT kind FROM attempts WHERE intent_id = ? ORDER BY rowid")
      .all(intent.intentId)
      .map((row) => (row as { kind: string }).kind);
    assert.deepEqual(kinds, [
      "intent-created",
      "dry-run-reviewed",
      "user-approved",
      "expired-approval-reprepared",
      "user-approved",
      "execution-claimed",
    ]);
  } finally {
    item.close();
  }
});

test("approval and execution fail closed when persisted state contradicts the effect ledger", async () => {
  const item = fixture("persisted-safety-invariant");
  try {
    const intent = item.engine.createIntent({
      logicalOperationId: "persisted-safety-invariant-case",
      title: "安全条件",
      body: "不整合を停止",
    });
    await item.engine.preview(intent.intentId);
    item.store.database.prepare(`
      INSERT INTO effects (effect_event_id, intent_id, started_at, start_status, outcome, receipt_json)
      VALUES (?, ?, ?, 'UNKNOWN', 'AMBIGUOUS', NULL)
    `).run(uuidV7(item.now.value), intent.intentId, item.now.value);
    assert.throws(
      () => item.engine.approve(intent.intentId),
      /approval safety invariant requires zero prior effect starts/,
    );
    assert.equal(item.engine.getIntent(intent.intentId)?.controlState, "DRY_RUN");
  } finally {
    item.close();
  }
});

test("100 healthy simulated notifications have p95 latency below two seconds", async () => {
  const item = fixture("latency");
  try {
    const durations: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const adapter = new SimulatedNotificationAdapter("success");
      const intent = await prepare(item.engine, `latency-${index}`);
      const start = performance.now();
      assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "VERIFIED");
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!;
    assert.ok(p95 < 2_000, `p95 ${p95}ms must be below 2000ms`);
  } finally {
    item.close();
  }
});

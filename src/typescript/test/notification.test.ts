// information_uuid_v5=58f4a6aa-2439-5811-bb59-6ee84fb23a1e
// event_uuid_v7=01a04872-05cd-7c54-89cc-29efcd16142c
// machine-contract: duplicate-effect count must remain <= 1 across retry, ambiguity, and restart scenarios.
// event_uuid_v7=01a04893-376c-7fc0-aabe-f56beef8ec7e
// machine-contract: every suppressed retry is auditable even though it leaves control and effect state unchanged.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AuditLog } from "../notification/audit-log.ts";
import { NotificationEngine } from "../notification/engine.ts";
import { SimulatedNotificationAdapter } from "../notification/simulated-adapter.ts";
import { NotificationStore } from "../notification/store.ts";

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

test("a duplicate request never starts a second visible effect", async () => {
  const item = fixture("dedupe");
  try {
    const adapter = new SimulatedNotificationAdapter("success");
    const intent = await prepare(item.engine, "dedupe-case");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "VERIFIED");
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "ALREADY_VERIFIED");
    assert.equal(adapter.executionCount, 1);
    assert.equal(adapter.visible.size, 1);
    assert.equal(item.store.countEffectClaims(intent.intentId), 1);
    assert.equal(item.engine.getEffectStartCount(intent.intentId), 1);
    assert.equal(item.audit.verify().count, 6);
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
    assert.equal((await item.engine.reconcile(intent.intentId, adapter)).status, "VERIFIED");
    assert.equal(adapter.visible.size, 1);
    assert.equal(item.audit.verify().valid, true);
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
    item.engine.resetAfterConfirmedAbsent(intent.intentId);
    await item.engine.preview(intent.intentId);
    item.engine.approve(intent.intentId);
    adapter.mode = "success";
    assert.equal((await item.engine.execute(intent.intentId, adapter)).status, "VERIFIED");
    assert.equal(adapter.visible.size, 1);
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

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
// information_uuid_v5=4a133fe5-d18c-597f-abcc-328e2d816f10
// event_uuid_v7=01a04cd1-5eac-7d0d-b48d-64008648a762
// state_transition=UNTRUSTED_STORAGE_PATH -> REJECTED occurred_at=2026-08-29T09:19:44.812Z
// machine-contract: traversal, unexpected extensions, and symbolic links are rejected before audit or SQLite I/O begins.
// information_uuid_v5=c82fc322-fc96-5ce1-aa03-ba374d074d0e
// event_uuid_v7=01a04ce0-0e78-72d0-a80a-bc3fc49c7256
// state_transition=CONSTRUCTOR_ONLY_SYMLINK_CHECK -> PER_IO_NOFOLLOW_AND_PRIVATE_PARENT occurred_at=2026-08-29T09:35:47.320Z
// machine-contract: replacing an audit path after construction remains rejected, and a shared temporary root never qualifies as a storage parent.
// information_uuid_v5=f38bf817-15be-5398-bd7e-78bc788498ec
// event_uuid_v7=01a04cf4-5c1a-740e-bf0b-21652882816d
// state_transition=REVIEW_COMMENT_TRACKED -> CROSS_PLATFORM_BOUNDARY_TESTED occurred_at=2026-08-29T09:57:57.921Z
// machine-contract: simulated Windows skips meaningless POSIX mode bits while macOS and Linux retain private-parent enforcement; a linked repository root is rejected without touching its target.
// information_uuid_v5=9a7359d0-121f-561a-b05d-2dae29b22bec
// event_uuid_v7=01a04d0d-7648-762e-8124-3cf06ef35603
// state_transition=HARDLINKED_EXTERNAL_FILE_WRITABLE -> HARDLINK_REJECTED_WITH_VICTIM_UNCHANGED occurred_at=2026-08-29T10:25:23.016Z
// machine-contract: audit and SQLite candidates with multiple links fail before storage writes; external victim bytes, SHA-256, and mode remain identical, including an audit-path replacement after construction.
// information_uuid_v5=83951c9f-4ece-576e-bacc-8224d32a3b99
// event_uuid_v7=01a04d24-0955-78ae-9c7c-218287ed5acb
// state_transition=REJECTED_TMPDIR_TAINT_FIXTURE -> REJECTED_REPOSITORY_SIBLING_FIXTURE occurred_at=2026-08-29T10:50:05.633Z
// machine-contract: the outside-root negative test uses a repository-relative sibling path so the CodeQL temporary-file model measures only reachable storage operations; runtime containment rejection remains unchanged.
// information_uuid_v5=f1067880-6f05-5541-8fe2-b16ebff23f6a
// event_uuid_v7=01a04d40-5d78-7e5e-a69a-8ea902356b69
// state_transition=WINDOWS_NOFOLLOW_ASSUMED -> WINDOWS_LINK_PATH_EXPLICITLY_REJECTED occurred_at=2026-08-29T11:20:59.000Z
// machine-contract: the Windows branch is exercised without O_NOFOLLOW; final database and audit links must fail while ordinary single-link files remain usable and external victim bytes remain unchanged.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { ReplayBlockedError, type ReplayEvidence } from "../governance/replay-verification.ts";
import { AuditLog } from "../notification/audit-log.ts";
import { NotificationEngine } from "../notification/engine.ts";
import { SimulatedNotificationAdapter } from "../notification/simulated-adapter.ts";
import { assertNotificationStorageDescriptor, containedNotificationStoragePath, openNotificationStorageGuard } from "../notification/storage-path.ts";
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

function fileSnapshot(path: string): { content: Buffer; sha256: string; mode: number } {
  const content = readFileSync(path);
  return {
    content,
    sha256: createHash("sha256").update(content).digest("hex"),
    mode: statSync(path).mode & 0o777,
  };
}

function assertFileUnchanged(path: string, before: ReturnType<typeof fileSnapshot>): void {
  const after = fileSnapshot(path);
  assert.deepEqual(after.content, before.content);
  assert.equal(after.sha256, before.sha256);
  assert.equal(after.mode, before.mode);
}

test("notification storage rejects paths outside its fixed local and test roots", () => {
  const outsideTemporaryRoot = resolve("untrusted-outside-root", "notification-outside.sqlite");
  assert.throws(() => new NotificationStore(outsideTemporaryRoot), /outside the allowed storage roots/);
  assert.throws(() => new AuditLog(outsideTemporaryRoot.replace(/\.sqlite$/, ".ndjson")), /outside the allowed storage roots/);
});

test("notification storage rejects unexpected filenames and symbolic links before I/O", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-path-boundary-"));
  try {
    assert.throws(() => new NotificationStore(join(directory, "queue.db")), /simple \.sqlite filename/);
    assert.throws(() => new AuditLog(join(directory, "audit.log")), /simple \.ndjson filename/);

    const databaseTarget = join(directory, "database-target.sqlite");
    const databaseLink = join(directory, "queue.sqlite");
    writeFileSync(databaseTarget, "", { mode: 0o600 });
    symlinkSync(databaseTarget, databaseLink);
    assert.throws(() => new NotificationStore(databaseLink), /must not be a symbolic link/);

    const auditTarget = join(directory, "audit-target.ndjson");
    const auditLink = join(directory, "audit.ndjson");
    writeFileSync(auditTarget, "", { mode: 0o600 });
    symlinkSync(auditTarget, auditLink);
    assert.throws(() => new AuditLog(auditLink), /must not be a symbolic link/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("notification storage rejects a shared parent and audit symlink replacement after construction", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-private-parent-"));
  try {
    chmodSync(directory, 0o755);
    assert.throws(() => new NotificationStore(join(directory, "queue.sqlite")), /private to the current user/);
    assert.throws(() => new AuditLog(join(directory, "audit.ndjson")), /private to the current user/);

    chmodSync(directory, 0o700);
    const nested = join(directory, "nested");
    mkdirSync(nested, { mode: 0o700 });
    assert.throws(() => new NotificationStore(join(nested, "queue.sqlite")), /one direct private child/);
    assert.throws(() => new AuditLog(join(nested, "audit.ndjson")), /one direct private child/);

    const auditPath = join(directory, "audit.ndjson");
    const audit = new AuditLog(auditPath);
    symlinkSync(join(process.cwd(), "package.json"), auditPath);
    assert.throws(() => audit.verify(), /must not be a symbolic link/);
    assert.throws(() => audit.append({} as never), /must not be a symbolic link/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("notification storage rejects a parent symlink that escapes an allowed root", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-parent-link-"));
  try {
    const link = join(directory, "outside");
    symlinkSync(process.cwd(), link, "dir");
    assert.throws(() => new NotificationStore(join(link, "queue.sqlite")), /resolves outside its allowed storage root/);
    assert.throws(() => new AuditLog(join(link, "audit.ndjson")), /resolves outside its allowed storage root/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("notification storage applies mode bits only on POSIX platforms", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-platform-policy-"));
  try {
    chmodSync(directory, 0o755);
    const options = {
      repositoryStorageRoot: join(directory, "repository-local"),
      platform: "win32" as const,
    };
    assert.doesNotThrow(() => containedNotificationStoragePath(join(directory, "audit.ndjson"), "audit", options));
    assert.doesNotThrow(() => containedNotificationStoragePath(join(directory, "queue.sqlite"), "database", options));
    assert.throws(
      () => containedNotificationStoragePath(join(directory, "audit.ndjson"), "audit", { ...options, platform: "darwin" }),
      /private to the current user/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("notification storage rejects final links when Windows cannot rely on O_NOFOLLOW", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-windows-link-"));
  const external = mkdtempSync(join(tmpdir(), "notification-windows-link-victim-"));
  try {
    const databaseVictim = join(external, "database-victim.txt");
    const auditVictim = join(external, "audit-victim.txt");
    const databasePath = join(directory, "queue.sqlite");
    const auditPath = join(directory, "audit.ndjson");
    writeFileSync(databaseVictim, "database victim\n", { mode: 0o600 });
    writeFileSync(auditVictim, "audit victim\n", { mode: 0o600 });
    const databaseBefore = fileSnapshot(databaseVictim);
    const auditBefore = fileSnapshot(auditVictim);
    symlinkSync(databaseVictim, databasePath);
    symlinkSync(auditVictim, auditPath);
    const options = { platform: "win32" as const };

    assert.throws(() => containedNotificationStoragePath(databasePath, "database", options), /must not be a symbolic link/);
    assert.throws(() => containedNotificationStoragePath(auditPath, "audit", options), /must not be a symbolic link/);
    assert.throws(() => openNotificationStorageGuard(databasePath, "database", options), /must not be a symbolic link/);
    assert.throws(() => openNotificationStorageGuard(auditPath, "audit", options), /must not be a symbolic link/);
    assertFileUnchanged(databaseVictim, databaseBefore);
    assertFileUnchanged(auditVictim, auditBefore);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});

test("notification storage keeps ordinary Windows storage files usable", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-windows-regular-"));
  const databasePath = join(directory, "queue.sqlite");
  const auditPath = join(directory, "audit.ndjson");
  try {
    writeFileSync(databasePath, "", { mode: 0o600 });
    writeFileSync(auditPath, "", { mode: 0o600 });
    const options = { platform: "win32" as const };
    const canonicalDirectory = realpathSync(directory);
    assert.equal(containedNotificationStoragePath(databasePath, "database", options), join(canonicalDirectory, "queue.sqlite"));
    assert.equal(containedNotificationStoragePath(auditPath, "audit", options), join(canonicalDirectory, "audit.ndjson"));

    const databaseGuard = openNotificationStorageGuard(databasePath, "database", options);
    const auditGuard = openNotificationStorageGuard(auditPath, "audit", options);
    try {
      assert.doesNotThrow(() => assertNotificationStorageDescriptor(databasePath, databaseGuard, "database", options));
      assert.doesNotThrow(() => assertNotificationStorageDescriptor(auditPath, auditGuard, "audit", options));
    } finally {
      closeSync(databaseGuard);
      closeSync(auditGuard);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("notification storage rejects a linked repository root without touching its target", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-linked-root-"));
  const external = mkdtempSync(join(tmpdir(), "notification-linked-target-"));
  try {
    const storageRoot = join(directory, ".local");
    const beforeMode = statSync(external).mode & 0o777;
    symlinkSync(external, storageRoot, "dir");
    const options = { repositoryStorageRoot: storageRoot, platform: "win32" as const };

    assert.throws(() => containedNotificationStoragePath(join(storageRoot, "audit.ndjson"), "audit", options), /storage root must not be a symbolic link/);
    assert.throws(() => containedNotificationStoragePath(join(storageRoot, "queue.sqlite"), "database", options), /storage root must not be a symbolic link/);
    assert.deepEqual(readdirSync(external), []);
    assert.equal(statSync(external).mode & 0o777, beforeMode);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});

test("notification storage rejects existing hard links without changing external victims", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-hardlink-path-"));
  const external = mkdtempSync(join(tmpdir(), "notification-hardlink-victim-"));
  try {
    const auditVictim = join(external, "audit-victim.txt");
    const databaseVictim = join(external, "database-victim.txt");
    writeFileSync(auditVictim, "audit victim\n", { mode: 0o640 });
    writeFileSync(databaseVictim, "", { mode: 0o640 });
    const auditBefore = fileSnapshot(auditVictim);
    const databaseBefore = fileSnapshot(databaseVictim);
    linkSync(auditVictim, join(directory, "audit.ndjson"));
    linkSync(databaseVictim, join(directory, "queue.sqlite"));

    assert.throws(() => new AuditLog(join(directory, "audit.ndjson")), /must not have multiple hard links/);
    assert.throws(() => new NotificationStore(join(directory, "queue.sqlite")), /must not have multiple hard links/);
    assertFileUnchanged(auditVictim, auditBefore);
    assertFileUnchanged(databaseVictim, databaseBefore);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});

test("audit I/O rejects a hard-link replacement after construction without changing its victim", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-hardlink-swap-"));
  const external = mkdtempSync(join(tmpdir(), "notification-hardlink-swap-victim-"));
  try {
    const auditPath = join(directory, "audit.ndjson");
    const victim = join(external, "victim.txt");
    const audit = new AuditLog(auditPath);
    writeFileSync(victim, "", { mode: 0o640 });
    const before = fileSnapshot(victim);
    linkSync(victim, auditPath);

    assert.throws(() => audit.append({} as never), /must not have multiple hard links/);
    assert.throws(() => audit.verify(), /must not have multiple hard links/);
    assertFileUnchanged(victim, before);
    unlinkSync(auditPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});

test("notification storage rejects a different regular file while the reviewed descriptor remains open", () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-descriptor-swap-"));
  const path = join(directory, "queue.sqlite");
  const guard = openNotificationStorageGuard(path, "database");
  try {
    renameSync(path, join(directory, "reviewed.sqlite"));
    writeFileSync(path, "replacement", { mode: 0o600 });
    assert.throws(() => assertNotificationStorageDescriptor(path, guard, "database"), /changed during open/);
  } finally {
    closeSync(guard);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("engine length limits count astral Unicode characters like the input projector", () => {
  const item = fixture("unicode-length");
  try {
    assert.doesNotThrow(() =>
      item.engine.createIntent({
        logicalOperationId: "unicode-length-valid",
        title: "😀".repeat(120),
        body: "本文",
      }),
    );
    assert.throws(
      () =>
        item.engine.createIntent({
          logicalOperationId: "unicode-length-invalid",
          title: "😀".repeat(121),
          body: "本文",
        }),
      /1-120 Unicode characters/,
    );
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
    const rows = (
      migrated.database
        .prepare(`
      SELECT effect_event_id, start_status FROM effects ORDER BY started_at
    `)
        .all() as Array<{ effect_event_id: string; start_status: string }>
    ).map((row) => ({ ...row }));
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
    assert.throws(() => item.engine.confirmBrowserReceipt(intent.intentId, { activeTags: ["different-intent"] }), /different intent tag/);
    assert.equal(item.engine.getIntent(intent.intentId)?.effectState, "AMBIGUOUS");
    const verified = item.engine.confirmBrowserReceipt(intent.intentId, { activeTags: [intent.intentId] });
    assert.equal(verified.status, "VERIFIED");
    assert.equal(item.engine.getEffectStartCount(intent.intentId), 1);

    const row = item.store.database
      .prepare(`
      SELECT receipt_json FROM effects WHERE intent_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1
    `)
      .get(intent.intentId) as { receipt_json: string };
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
    item.engine.resetAfterConfirmedAbsent(intent.intentId, validReplayEvidence(item.engine, confirmedAbsent, item.now.value));
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
      (error: unknown) =>
        error instanceof ReplayBlockedError &&
        error.evaluation.decision === "STOP" &&
        error.evaluation.gates.find((gate) => gate.gate === "PERMISSION")?.status === "BLOCKED",
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
    assert.deepEqual(kinds, ["intent-created", "dry-run-reviewed", "user-approved", "expired-approval-reprepared", "user-approved", "execution-claimed"]);
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
    item.store.database
      .prepare(`
      INSERT INTO effects (effect_event_id, intent_id, started_at, start_status, outcome, receipt_json)
      VALUES (?, ?, ?, 'UNKNOWN', 'AMBIGUOUS', NULL)
    `)
      .run(uuidV7(item.now.value), intent.intentId, item.now.value);
    assert.throws(() => item.engine.approve(intent.intentId), /approval safety invariant requires zero prior effect starts/);
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

// information_uuid_v5=51b1b201-3e72-55c9-91bd-6478d3a79507
// event_uuid_v7=01a048da-1888-70e0-ae63-0eeaf0ec9fde
// machine-contract: rejected preview input leaves SQLite and the audit chain unchanged; accepted input stops at DRY_RUN/NOT_STARTED.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AuditLog } from "../notification/audit-log.ts";
import { NotificationEngine } from "../notification/engine.ts";
import { NotificationInputError } from "../notification/input-projection.js";
import { prepareNotificationPreview } from "../notification/preview-boundary.ts";
import { NotificationStore } from "../notification/store.ts";
import { ROOT_UUID_NAMESPACE } from "../notification/types.ts";
import { uuidV5 } from "../uuid.ts";

test("preview boundary rejects unprojected input without creating an intent", async () => {
  const directory = mkdtempSync(join(tmpdir(), "notification-api-boundary-"));
  const store = new NotificationStore(join(directory, "queue.sqlite"));
  const audit = new AuditLog(join(directory, "audit.ndjson"));
  const engine = new NotificationEngine({ store, audit });
  try {
    const operation = "api-boundary-rejected";
    const intentId = uuidV5(ROOT_UUID_NAMESPACE, `notification-intent/${operation}`);
    await assert.rejects(
      prepareNotificationPreview(engine, {
        logicalOperationId: operation,
        title: "Title",
        body: "Body",
        execute: true,
      }),
      (error: unknown) => error instanceof NotificationInputError && error.code === "UNKNOWN_FIELD",
    );
    assert.equal(engine.getIntent(intentId), null);
    assert.equal(engine.getEffectStartCount(intentId), 0);
    assert.deepEqual(audit.verify(), { valid: true, count: 0, lastHash: "" });

    const accepted = await prepareNotificationPreview(engine, {
      logicalOperationId: "api-boundary-accepted",
      title: "  Cafe\u0301  ",
      body: "Literal notification text",
    });
    assert.equal(accepted.intent.title, "Café");
    assert.equal(accepted.intent.controlState, "DRY_RUN");
    assert.equal(accepted.intent.effectState, "NOT_STARTED");
    assert.equal(accepted.preview.approvalRequired, true);
    assert.equal(engine.getEffectStartCount(accepted.intent.intentId), 0);
    assert.equal(audit.verify().count, 2);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

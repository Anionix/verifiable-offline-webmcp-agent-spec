// information_uuid_v5=51b1b201-3e72-55c9-91bd-6478d3a79507
// event_uuid_v7=01a048da-1888-70e0-ae63-0eeaf0ec9fde
// machine-contract: untrusted input is projected before createIntent; success stops at DRY_RUN and never invokes an execution adapter.
import { StateConflictError, type NotificationIntent, type NotificationPreview } from "./types.ts";
import { NotificationEngine } from "./engine.ts";
import { projectNotificationToolInput } from "./input-projection.js";

export interface NotificationPreviewEnvelope {
  preview: NotificationPreview;
  intent: NotificationIntent;
}

export async function prepareNotificationPreview(
  engine: NotificationEngine,
  input: unknown,
): Promise<NotificationPreviewEnvelope> {
  const projected = projectNotificationToolInput(input);
  const created = engine.createIntent(projected);
  const preview = await engine.preview(created.intentId);
  const intent = engine.getIntent(created.intentId);
  if (!intent) throw new StateConflictError("preview intent readback failed");
  return { preview, intent };
}

// information_uuid_v5=51b1b201-3e72-55c9-91bd-6478d3a79507
// event_uuid_v7=01a048da-1888-70e0-ae63-0eeaf0ec9fde
// machine-contract: untrusted input is projected before createIntent; success stops at DRY_RUN and never invokes an execution adapter.
import { StateConflictError, type NotificationIntent, type NotificationPreview } from "./types.ts";
import { NotificationEngine } from "./engine.ts";
import { projectNotificationToolInput } from "./input-projection.js";
import {
  provenanceFromDetails,
  projectInputProvenance,
  sameProvenance,
  type InputProvenance,
} from "./input-provenance.ts";

export interface InputEvidenceReadback {
  invocation: Readonly<InputProvenance>;
  persisted: Readonly<InputProvenance>;
  auditPersisted: Readonly<InputProvenance>;
  persistedEventId: string;
  auditEventId: string;
  matchesPersisted: boolean;
  sqliteMatchesAudit: boolean;
}

export interface NotificationPreviewEnvelope {
  preview: NotificationPreview;
  intent: NotificationIntent;
  inputEvidence: InputEvidenceReadback;
}

export async function prepareNotificationPreview(
  engine: NotificationEngine,
  input: unknown,
  inputProvenance: InputProvenance,
): Promise<NotificationPreviewEnvelope> {
  const projected = projectNotificationToolInput(input);
  const invocation = projectInputProvenance(inputProvenance);
  const created = engine.createIntent({ ...projected, inputProvenance: invocation });
  const storedEvidence = engine.getInputProvenanceEvidence(created.intentId);
  if (!storedEvidence) throw new StateConflictError("SQLite input provenance readback failed");
  const auditRecord = engine.audit.readIntentCreation(created.intentId);
  if (!auditRecord) throw new StateConflictError("audit input provenance readback failed");
  const auditPersisted = provenanceFromDetails(auditRecord.details);
  const sqliteMatchesAudit = storedEvidence.eventId === auditRecord.eventId
    && sameProvenance(storedEvidence.provenance, auditPersisted);
  if (!sqliteMatchesAudit) throw new StateConflictError("SQLite and audit input provenance differ");
  const preview = await engine.preview(created.intentId);
  const intent = engine.getIntent(created.intentId);
  if (!intent) throw new StateConflictError("preview intent readback failed");
  return {
    preview,
    intent,
    inputEvidence: Object.freeze({
      invocation,
      persisted: storedEvidence.provenance,
      auditPersisted,
      persistedEventId: storedEvidence.eventId,
      auditEventId: auditRecord.eventId,
      matchesPersisted: sameProvenance(invocation, storedEvidence.provenance),
      sqliteMatchesAudit,
    }),
  };
}

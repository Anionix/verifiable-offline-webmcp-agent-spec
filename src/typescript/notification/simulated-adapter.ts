// information_uuid_v5=20aeb769-0c90-581f-bc43-d05558148374
// event_uuid_v7=01a04872-0531-7e8c-83d2-eabc3abda422
// machine-contract: simulation modes reproduce pre-effect absence, post-effect ambiguity, and confirmed success without external services.
import type {
  AdapterExecutionResult,
  ApprovalReceipt,
  NotificationAdapter,
  NotificationIntent,
  NotificationPreview,
  Presence,
} from "./types.ts";
import { AmbiguousEffectError, ConfirmedAbsentError } from "./types.ts";

export type SimulationMode = "success" | "fail-before-effect" | "timeout-after-effect" | "unknown";

export class SimulatedNotificationAdapter implements NotificationAdapter {
  mode: SimulationMode;
  readonly visible = new Set<string>();
  executionCount = 0;

  constructor(mode: SimulationMode = "success") {
    this.mode = mode;
  }

  preview(intent: NotificationIntent): NotificationPreview {
    return {
      intentId: intent.intentId,
      logicalOperationId: intent.logicalOperationId,
      target: intent.target,
      title: intent.title,
      body: intent.body,
      payloadDigest: intent.payloadDigest,
      approvalRequired: true,
    };
  }

  async execute(intent: NotificationIntent, approval: ApprovalReceipt): Promise<AdapterExecutionResult> {
    if (
      approval.intentId !== intent.intentId
      || approval.target !== intent.target
      || approval.payloadDigest !== intent.payloadDigest
    ) throw new ConfirmedAbsentError("approval does not bind the requested effect");
    this.executionCount += 1;
    if (this.mode === "fail-before-effect") throw new ConfirmedAbsentError("simulated failure before effect");
    if (this.mode === "timeout-after-effect") {
      this.visible.add(intent.intentId);
      throw new AmbiguousEffectError("simulated response loss after effect");
    }
    if (this.mode === "unknown") throw new AmbiguousEffectError("simulated unknown result");
    this.visible.add(intent.intentId);
    return { presence: "PRESENT", receipt: { simulator: true, tag: intent.intentId } };
  }

  async reconcile(intent: NotificationIntent): Promise<Presence> {
    if (this.mode === "unknown" && !this.visible.has(intent.intentId)) return "UNKNOWN";
    return this.visible.has(intent.intentId) ? "PRESENT" : "ABSENT";
  }
}

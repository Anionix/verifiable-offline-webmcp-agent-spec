// information_uuid_v5=34f7f3c3-adc1-514c-a7a8-4c8fb7891dd2
// event_uuid_v7=01a04872-0460-7dec-b47f-6ea6a3348078
// machine-contract: control_state and effect_state are separate; AMBIGUOUS permits reconciliation only.
export const ROOT_UUID_NAMESPACE = "47f3e535-0e27-559a-9556-aa79a84f95eb";

export type ControlState =
  | "DISCOVERED"
  | "PROPOSED"
  | "DRY_RUN"
  | "USER_APPROVED"
  | "EXECUTING"
  | "VERIFIED"
  | "REJECTED"
  | "ABORTED";

export type EffectState =
  | "NOT_STARTED"
  | "AMBIGUOUS"
  | "RECONCILING"
  | "CONFIRMED_PRESENT"
  | "CONFIRMED_ABSENT";

export type Presence = "PRESENT" | "ABSENT" | "UNKNOWN";
export type NotificationTarget = "local-mac-notification";

export interface NotificationIntentInput {
  logicalOperationId: string;
  title: string;
  body: string;
  target?: NotificationTarget;
}

export interface NotificationIntent {
  intentId: string;
  logicalOperationId: string;
  title: string;
  body: string;
  target: NotificationTarget;
  payloadDigest: string;
  controlState: ControlState;
  effectState: EffectState;
  approvalEventId: string | null;
  approvalTarget: NotificationTarget | null;
  approvalPayloadDigest: string | null;
  approvalExpiresAt: number | null;
  createdAt: number;
  updatedAt: number;
  revision: number;
}

export interface ApprovalReceipt {
  eventId: string;
  intentId: string;
  target: NotificationTarget;
  payloadDigest: string;
  approvedAt: number;
  expiresAt: number;
}

export interface NotificationPreview {
  intentId: string;
  logicalOperationId: string;
  target: NotificationTarget;
  title: string;
  body: string;
  payloadDigest: string;
  approvalRequired: true;
}

export interface AdapterExecutionResult {
  presence: Presence;
  receipt?: Record<string, string | number | boolean | null>;
}

export interface NotificationAdapter {
  preview(intent: NotificationIntent): Promise<NotificationPreview> | NotificationPreview;
  execute(intent: NotificationIntent, approval: ApprovalReceipt): Promise<AdapterExecutionResult>;
  reconcile(intent: NotificationIntent): Promise<Presence>;
}

export interface TransitionRecord {
  eventId: string;
  intentId: string;
  kind: string;
  occurredAt: number;
  fromControl: ControlState | null;
  toControl: ControlState;
  fromEffect: EffectState | null;
  toEffect: EffectState;
  details: Record<string, string | number | boolean | null>;
}

export type ClaimResult =
  | { status: "CLAIMED"; intent: NotificationIntent; transition: TransitionRecord }
  | { status: "ALREADY_VERIFIED"; intent: NotificationIntent }
  | { status: "RECONCILE_REQUIRED"; intent: NotificationIntent }
  | { status: "APPROVAL_EXPIRED"; intent: NotificationIntent; transition: TransitionRecord };

export class ConfirmedAbsentError extends Error {
  constructor(message = "external effect was confirmed absent") {
    super(message);
    this.name = "ConfirmedAbsentError";
  }
}

export class AmbiguousEffectError extends Error {
  constructor(message = "external effect may have occurred") {
    super(message);
    this.name = "AmbiguousEffectError";
  }
}

export class StateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateConflictError";
  }
}

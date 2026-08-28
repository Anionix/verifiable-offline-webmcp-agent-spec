// information_uuid_v5=0f2f9d6a-05a1-563b-90f6-1aa7bf46b050
// event_uuid_v7=01a04872-066c-7490-84fd-4167a24da2a4
// machine-contract: notification permission and execute are reachable only from an explicit user click after preview.
// information_uuid_v5=d9696b52-9426-58c4-ba40-4e49dea2aae9
// event_uuid_v7=01a048b7-2629-7bbf-9167-8b5f7cee8e66
// machine-contract: the visible count comes from SQLite effect claims and any value above one is rendered as a safety violation.
// information_uuid_v5=66186252-51bf-5758-9526-c97fcf2c664c
// event_uuid_v7=01a048c2-e245-73bb-8b32-bcd1ab64e00d
// machine-contract: an unknown count is announced as unknown, never as a numeric number of effects.
// information_uuid_v5=51b1b201-3e72-55c9-91bd-6478d3a79507
// event_uuid_v7=01a048da-1888-70e0-ae63-0eeaf0ec9fde
// machine-contract: WebMCP input is projected before UI mutation and can call preview only; permission and notification remain click-only.
import {
  NOTIFICATION_TOOL_INPUT_SCHEMA,
  NotificationInputError,
  projectNotificationToolInput,
} from "/input-projection.js";
import {
  createInputBoundaryState,
  createVisualState,
  reduceInputBoundaryState,
  reduceVisualState,
} from "/visual-state.js";

const elements = {
  logicalOperation: document.querySelector("#logical-operation"),
  title: document.querySelector("#title"),
  body: document.querySelector("#body"),
  preview: document.querySelector("#preview"),
  approve: document.querySelector("#approve"),
  retry: document.querySelector("#retry"),
  reconcile: document.querySelector("#reconcile"),
  webmcp: document.querySelector("#webmcp"),
  intent: document.querySelector("#intent"),
  control: document.querySelector("#control"),
  effect: document.querySelector("#effect"),
  log: document.querySelector("#log"),
  flow: document.querySelector("#dedupe-flow"),
  flowPhase: document.querySelector("#flow-phase"),
  flowAnnouncer: document.querySelector("#flow-announcer"),
  initialNode: document.querySelector("#initial-node"),
  initialStatus: document.querySelector("#initial-visual-status"),
  retryNode: document.querySelector("#retry-node"),
  retryStatus: document.querySelector("#retry-visual-status"),
  ledgerInitialNode: document.querySelector("#ledger-initial-node"),
  ledgerInitialStatus: document.querySelector("#ledger-initial-status"),
  ledgerRetryNode: document.querySelector("#ledger-retry-node"),
  ledgerRetryStatus: document.querySelector("#ledger-retry-status"),
  deliveryNode: document.querySelector("#delivery-node"),
  deliveryStatus: document.querySelector("#delivery-status"),
  blockedNode: document.querySelector("#blocked-node"),
  blockedStatus: document.querySelector("#blocked-status"),
  countCard: document.querySelector("#notification-count-card"),
  countLabel: document.querySelector("#count-label"),
  count: document.querySelector("#notification-count"),
  countCaption: document.querySelector("#count-caption"),
  inputBoundary: document.querySelector("#input-boundary-flow"),
  inputBoundaryPhase: document.querySelector("#input-boundary-phase"),
  inputBoundaryAnnouncer: document.querySelector("#input-boundary-announcer"),
  inputReceivedNode: document.querySelector("#input-received-node"),
  inputReceivedStatus: document.querySelector("#input-received-status"),
  inputValidationNode: document.querySelector("#input-validation-node"),
  inputValidationStatus: document.querySelector("#input-validation-status"),
  inputDryRunNode: document.querySelector("#input-dry-run-node"),
  inputDryRunStatus: document.querySelector("#input-dry-run-status"),
};

let currentIntentId = null;
let visualState = createVisualState();
let inputBoundaryState = createInputBoundaryState();
const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });

const phaseLabels = {
  idle: "実行前",
  previewed: "乾式確認済み",
  executing: "初回を実行中",
  verified: "1件を確認済み",
  retrying: "再試行を照合中",
  "duplicate-suppressed": "二件目を停止済み",
  ambiguous: "結果を照合してください",
  absent: "表示なしを確認済み",
  violation: "安全条件違反",
  error: "停止",
};

function syncNode(node, status, state, text) {
  node.dataset.state = state;
  status.textContent = text;
}

function renderVisualState(state) {
  elements.flow.dataset.phase = state.phase;
  elements.flowPhase.textContent = phaseLabels[state.phase] ?? state.phase;
  syncNode(elements.initialNode, elements.initialStatus, state.initialState, state.initialText);
  syncNode(elements.retryNode, elements.retryStatus, state.retryState, state.retryText);
  syncNode(elements.ledgerInitialNode, elements.ledgerInitialStatus, state.ledgerInitialState, state.ledgerInitialText);
  syncNode(elements.ledgerRetryNode, elements.ledgerRetryStatus, state.ledgerRetryState, state.ledgerRetryText);
  syncNode(elements.deliveryNode, elements.deliveryStatus, state.deliveryState, state.deliveryText);
  syncNode(elements.blockedNode, elements.blockedStatus, state.blockedState, state.blockedText);
  elements.countLabel.textContent = state.countLabel;
  elements.count.textContent = state.notificationCount === null ? "—" : String(state.notificationCount);
  elements.countCaption.textContent = state.countText;
  elements.countCard.dataset.state = ["verified", "duplicate-suppressed"].includes(state.phase)
    ? "success"
    : ["ambiguous", "absent"].includes(state.phase)
      ? "warning"
      : ["violation", "error"].includes(state.phase) ? "error" : "idle";
  const spokenCount = state.notificationCount === null ? "件数は不明" : `${state.notificationCount}件`;
  elements.countCard.setAttribute("aria-label", `${state.countLabel} ${spokenCount}。${state.countText}`);
  elements.flowAnnouncer.textContent = state.announcement;
}

function updateVisual(event) {
  visualState = reduceVisualState(visualState, event);
  renderVisualState(visualState);
}

renderVisualState(visualState);

function renderInputBoundary(state) {
  elements.inputBoundary.dataset.phase = state.phase;
  elements.inputBoundaryPhase.textContent = state.phaseText;
  syncNode(elements.inputReceivedNode, elements.inputReceivedStatus, state.receivedState, state.receivedText);
  syncNode(elements.inputValidationNode, elements.inputValidationStatus, state.validationState, state.validationText);
  syncNode(elements.inputDryRunNode, elements.inputDryRunStatus, state.dryRunState, state.dryRunText);
  elements.inputBoundaryAnnouncer.textContent = state.announcement;
}

function updateInputBoundary(event) {
  inputBoundaryState = reduceInputBoundaryState(inputBoundaryState, event);
  renderInputBoundary(inputBoundaryState);
}

renderInputBoundary(inputBoundaryState);

async function request(path, value, signal) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `request failed: ${response.status}`);
  return result;
}

async function readStatus() {
  if (!currentIntentId) throw new Error("状態を読むIntentがありません");
  const response = await fetch(`/api/status?intentId=${encodeURIComponent(currentIntentId)}`, {
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `status request failed: ${response.status}`);
  return result;
}

function formValue() {
  return {
    logicalOperationId: elements.logicalOperation.value,
    title: elements.title.value,
    body: elements.body.value,
  };
}

function render(result, message) {
  const intent = result.intent ?? result;
  if (intent?.intentId) {
    currentIntentId = intent.intentId;
    elements.intent.textContent = intent.intentId;
    elements.control.textContent = intent.controlState;
    elements.effect.textContent = intent.effectState;
    elements.approve.disabled = !["DRY_RUN", "USER_APPROVED", "VERIFIED"].includes(intent.controlState);
    elements.retry.disabled = intent.controlState !== "VERIFIED";
    elements.reconcile.disabled = intent.effectState !== "AMBIGUOUS";
  }
  elements.log.textContent = message + "\n\n" + JSON.stringify(result, null, 2);
}

async function preview(values = formValue(), signal) {
  updateVisual({ type: "RESET" });
  const result = await request("/api/preview", values, signal);
  render(result.intent, "乾式実行が完了しました。内容を確認してから承認してください。");
  updateVisual({ type: "PREVIEWED" });
  return result;
}

async function approveAndNotify(mode = "initial") {
  if (!currentIntentId) throw new Error("先に乾式実行してください");
  if (mode === "retry") updateVisual({ type: "RETRY_STARTED" });
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(`通知権限が許可されませんでした: ${permission}`);
  const claim = await request("/api/approve-and-claim", { intentId: currentIntentId });
  if (claim.status !== "COMMAND") {
    const status = await readStatus();
    if (claim.status === "ALREADY_VERIFIED") {
      updateVisual({ type: "DUPLICATE_SUPPRESSED", effectStartCount: status.effectStartCount });
    } else if (claim.status === "RECONCILE_REQUIRED") {
      updateVisual({ type: "AMBIGUOUS", effectStartCount: status.effectStartCount });
    } else {
      updateVisual({ type: "FAILED", message: `外部効果は開始しませんでした: ${claim.status}` });
    }
    render(claim.intent, `外部効果は開始しませんでした: ${claim.status}`);
    return claim;
  }
  updateVisual({ type: "EXECUTION_CLAIMED" });
  const ready = await navigator.serviceWorker.ready;
  await ready.showNotification(claim.command.title, {
    body: claim.command.body,
    tag: claim.command.tag,
    renotify: false,
    data: { intentId: currentIntentId },
  });
  const active = await ready.getNotifications({ tag: claim.command.tag });
  if (active.length < 1) {
    const status = await readStatus();
    updateVisual({ type: "AMBIGUOUS", effectStartCount: status.effectStartCount });
    render(claim.intent, "通知表示後の読み戻しができません。状態はAMBIGUOUSのままです。");
    elements.reconcile.disabled = false;
    return claim;
  }
  const receipt = await request("/api/receipt", { intentId: currentIntentId, activeCount: active.length });
  const status = await readStatus();
  updateVisual({ type: "PRESENT_CONFIRMED", effectStartCount: status.effectStartCount });
  render(receipt.intent, "通知を1件表示し、サービスワーカーから読み戻してVERIFIEDになりました。");
  return receipt;
}

async function reconcile() {
  if (!currentIntentId) throw new Error("照合するIntentがありません");
  const ready = await navigator.serviceWorker.ready;
  const active = await ready.getNotifications({ tag: currentIntentId });
  const result = await request("/api/reconcile", {
    intentId: currentIntentId,
    presence: active.length > 0 ? "PRESENT" : "ABSENT",
  });
  const status = await readStatus();
  if (result.status === "VERIFIED") {
    updateVisual({ type: "PRESENT_CONFIRMED", effectStartCount: status.effectStartCount });
  } else if (result.status === "ABORTED_CONFIRMED_ABSENT") {
    updateVisual({ type: "ABSENT_CONFIRMED", effectStartCount: status.effectStartCount });
  } else {
    updateVisual({ type: "AMBIGUOUS", effectStartCount: status.effectStartCount });
  }
  render(result.intent, `照合結果: ${result.status}`);
}

async function handle(action) {
  try { await action(); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateVisual({ type: "FAILED", message });
    elements.log.textContent = `停止: ${message}`;
  }
}

elements.preview.addEventListener("click", () => handle(preview));
elements.approve.addEventListener("click", () => handle(() => approveAndNotify("initial")));
elements.retry.addEventListener("click", () => handle(() => approveAndNotify("retry")));
elements.reconcile.addEventListener("click", () => handle(reconcile));

async function registerWebMcp() {
  const context = document.modelContext;
  if (!context?.registerTool) {
    elements.webmcp.textContent = "INCONCLUSIVE — このブラウザーにdocument.modelContextがありません";
    return;
  }
  try {
    await context.registerTool({
      name: "notify_once",
      title: "Prepare one duplicate-safe local notification",
      description: "Strictly validates three literal notification fields and prepares a dry run. It cannot request notification permission or create a visible notification.",
      inputSchema: NOTIFICATION_TOOL_INPUT_SCHEMA,
      execute: async (input, options = {}) => {
        updateInputBoundary({ type: "INPUT_RECEIVED" });
        let projected;
        try {
          options.signal?.throwIfAborted();
          projected = projectNotificationToolInput(input);
        } catch (error) {
          const message = inputRejectionMessage(error);
          updateInputBoundary({ type: "INPUT_REJECTED", message });
          elements.log.textContent = `WebMCP入力を拒否: ${message}`;
          throw error;
        }
        updateInputBoundary({ type: "INPUT_ACCEPTED" });
        let result;
        try {
          result = await preview(projected, options.signal);
          assertDryRunReadback(result);
        } catch (error) {
          updateInputBoundary({ type: "DRY_RUN_FAILED" });
          elements.log.textContent = "WebMCP乾式実行を停止: 結果を確認できません。実通知は開始していません。";
          throw error;
        }
        elements.logicalOperation.value = projected.logicalOperationId;
        elements.title.value = projected.title;
        elements.body.value = projected.body;
        updateInputBoundary({ type: "DRY_RUN_COMPLETED" });
        return {
          intentId: result.intent.intentId,
          target: result.intent.target,
          payloadDigest: result.intent.payloadDigest,
          controlState: result.intent.controlState,
          effectState: result.intent.effectState,
          humanApprovalRequired: true,
        };
      },
    }, { exposedTo: [] });
    elements.webmcp.textContent = "CONFIRMED — same-origin notify_onceを登録済み";
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    elements.webmcp.textContent = `INCONCLUSIVE — notify_onceを登録できません (${name})`;
  }
}

function inputRejectionMessage(error) {
  if (!(error instanceof NotificationInputError)) return "入力形式を確認できません";
  const messages = {
    INPUT_OBJECT_REQUIRED: "物体形式ではありません",
    PLAIN_OBJECT_REQUIRED: "単純な物体ではありません",
    UNKNOWN_FIELD: "許可されていない項目があります",
    MISSING_FIELD: "必要な項目がありません",
    DATA_PROPERTY_REQUIRED: "通常の入力項目ではありません",
    STRING_REQUIRED: "文字列ではありません",
    INVALID_UNICODE: "正しいUnicodeではありません",
    CONTROL_CHARACTER: "制御文字が含まれています",
    DIRECTIONAL_CONTROL: "方向制御文字が含まれています",
    NONCHARACTER: "予約済みUnicode文字が含まれています",
    INVALID_LENGTH: "文字数が範囲外です",
    UNSUPPORTED_CHARACTER: "論理操作識別子に未対応文字があります",
  };
  return messages[error.code] ?? "入力検査で拒否しました";
}

function assertDryRunReadback(result) {
  const intent = result?.intent;
  const previewResult = result?.preview;
  if (
    !intent
    || !previewResult
    || intent.controlState !== "DRY_RUN"
    || intent.effectState !== "NOT_STARTED"
    || previewResult.intentId !== intent.intentId
    || previewResult.payloadDigest !== intent.payloadDigest
    || previewResult.approvalRequired !== true
  ) {
    throw new Error("dry-run readback mismatch");
  }
}

await registerWebMcp();

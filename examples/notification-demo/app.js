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
// information_uuid_v5=d53907bf-96cd-56e5-be92-5c4f3576e477
// event_uuid_v7=01a04972-c11c-74d1-8639-c71dded7b68a
// machine-contract: the six replay checks are rendered from reducer state; no visual PASS can grant execution authority.
// information_uuid_v5=97ce90b3-983b-56e7-9381-c8c2df3068e2
// event_uuid_v7=01a049fe-ffc3-73a1-9446-8e38a434dfca
// state_transition=DISCOVERED -> EXECUTING occurred_at=2026-08-28T20:10:43.523Z
// machine-contract: repeated preview reads persisted control/effect state and the SQLite effect count before rendering; it never invents a fresh zero-effect state.
// information_uuid_v5=0a6e95b1-f829-5429-9caa-bd142f018915
// event_uuid_v7=01a04a1b-eac6-7c5c-aa43-c19d4a593bfb
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T20:42:18.694Z
// machine-contract: concurrent state advancement is accepted only after immutable intent identity is read back unchanged.
// information_uuid_v5=a49f40c5-65fa-5363-b64f-be5d86766914
// event_uuid_v7=01a04a28-9e04-7709-9ce3-49b9331fd953
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T20:56:11.012Z
// machine-contract: the WebMCP path reads and renders the same persisted status as the local path; a repeated preview never resets visible truth.
// information_uuid_v5=3093ad26-25f3-5912-b015-70a04c93fe08
// event_uuid_v7=01a04a3b-7a18-76a0-b150-b1aacc95e727
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:16:47.000Z
// machine-contract: the input-boundary panel receives the persisted control/effect pair and measured count instead of inventing DRY_RUN / NOT_STARTED.
// information_uuid_v5=4cb035a8-f737-514f-90c6-da6c0672f814
// event_uuid_v7=01a04a4c-1be8-727c-9b05-be91397708b3
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:34:57.000Z
// machine-contract: every WebMCP restoration atomically resets the prior intent visualization before applying persisted state.
// information_uuid_v5=d2cbf4dc-f6a8-53df-ae82-e3e84f51ee7f
// information_uuid_v5=4eeca0e8-026c-559e-9496-885453aa6f30
// event_uuid_v7=01a04a5a-ece0-7715-a44c-3fe4200880af
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:51:08.000Z
// machine-contract: a WebMCP completion renders only its own lifecycle input/result pair, and measured-count mismatches remain visible as safety violations.
// information_uuid_v5=7a79c189-d065-5783-9e6b-b096312036f5
// event_uuid_v7=01a04a78-c198-785c-8260-cbcaa840927f
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T22:23:43.000Z
// machine-contract: every local preview reads status with the intent identifier returned by that invocation, never a concurrently replaced UI selection.
import {
  NotificationInputError,
  registerNotificationWebMcpTool,
} from "/webmcp-notification-adapter.js";
import {
  assertPersistedIntentMatchesPreview,
  createInputBoundaryState,
  createVisualState,
  REPLAY_GATE_KEYS,
  reduceInputBoundaryState,
  reduceVisualState,
  visualEventFromPersistedStatus,
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
  provenanceChannel: document.querySelector("#provenance-channel"),
  provenanceTrust: document.querySelector("#provenance-trust"),
  provenanceOrigin: document.querySelector("#provenance-origin"),
  provenanceReadback: document.querySelector("#provenance-readback"),
  replayGateSummary: document.querySelector("#replay-gate-summary"),
  replayGates: {
    authorization: [document.querySelector("#replay-authorization"), document.querySelector("#replay-authorization-status")],
    permission: [document.querySelector("#replay-permission"), document.querySelector("#replay-permission-status")],
    version: [document.querySelector("#replay-version"), document.querySelector("#replay-version-status")],
    consent: [document.querySelector("#replay-consent"), document.querySelector("#replay-consent-status")],
    timeToLive: [document.querySelector("#replay-time-to-live"), document.querySelector("#replay-time-to-live-status")],
    precondition: [document.querySelector("#replay-precondition"), document.querySelector("#replay-precondition-status")],
  },
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
  "replay-ready": "6項目を確認済み",
  "replay-blocked": "再送を停止済み",
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
  elements.replayGateSummary.textContent = state.replayGateSummary;
  for (const key of REPLAY_GATE_KEYS) {
    const [node, status] = elements.replayGates[key];
    syncNode(node, status, state.replayGates[key].state, state.replayGates[key].text);
  }
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

async function requestPreview(values, signal, path = "/api/preview") {
  return request(path, values, signal);
}

async function readStatus(intentId = currentIntentId) {
  if (!intentId) throw new Error("状態を読むIntentがありません");
  const response = await fetch(`/api/status?intentId=${encodeURIComponent(intentId)}`, {
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

function assertLocalPreviewReadback(result) {
  const intent = result?.intent;
  const previewResult = result?.preview;
  const inputEvidence = result?.inputEvidence;
  if (
    !intent
    || !previewResult
    || !inputEvidence?.invocation
    || !inputEvidence?.persisted
    || !inputEvidence?.auditPersisted
    || inputEvidence.sqliteMatchesAudit !== true
    || inputEvidence.persistedEventId !== inputEvidence.auditEventId
    || previewResult.intentId !== intent.intentId
    || previewResult.payloadDigest !== intent.payloadDigest
    || previewResult.approvalRequired !== true
  ) throw new Error("preview readback mismatch");
}

function assertStatusReadback(status, expectedIntent) {
  if (
    !status?.intent
    || !Number.isSafeInteger(status.effectStartCount)
    || status.effectStartCount < 0
  ) throw new Error("persisted status readback mismatch");
  assertPersistedIntentMatchesPreview(status.intent, expectedIntent);
}

function renderProvenanceObservation(observation) {
  if (!observation) return;
  elements.provenanceChannel.textContent = observation.channel === "WEBMCP" ? "WebMCP" : observation.channel;
  elements.provenanceTrust.textContent = observation.sourceTrust === "UNTRUSTED" ? "未信頼の入力" : observation.sourceTrust;
  elements.provenanceOrigin.textContent = observation.sourceOrigin;
  elements.provenanceReadback.textContent = "読み戻し待ち";
}

function renderInputEvidence(inputEvidence) {
  if (inputEvidence?.channel && inputEvidence?.sourceOrigin) {
    elements.provenanceChannel.textContent = inputEvidence.channel === "WEBMCP" ? "WebMCP" : "ローカル画面";
    elements.provenanceTrust.textContent = inputEvidence.sourceTrust === "UNTRUSTED" ? "未信頼の印を保持" : "内部入力";
    elements.provenanceOrigin.textContent = inputEvidence.sourceOrigin;
    elements.provenanceReadback.textContent = inputEvidence.matchesPersisted
      ? "SQLite・監査と一致"
      : `既存台帳の${inputEvidence.persistedChannel}を保持`;
    return;
  }
  const invocation = inputEvidence?.invocation;
  const persisted = inputEvidence?.persisted;
  if (!invocation || !persisted) return;
  elements.provenanceChannel.textContent = invocation.channel === "WEBMCP" ? "WebMCP" : "ローカル画面";
  elements.provenanceTrust.textContent = invocation.sourceTrust === "UNTRUSTED" ? "未信頼の印を保持" : "内部入力";
  elements.provenanceOrigin.textContent = invocation.sourceOrigin;
  elements.provenanceReadback.textContent = inputEvidence.matchesPersisted
    ? "SQLite・監査と一致"
    : `既存台帳の${persisted.channel}を保持`;
}

function webMcpUiResult(event) {
  const result = event.result;
  const input = event.input;
  if (
    !result
    || !input
    || typeof result.intentId !== "string"
    || typeof result.target !== "string"
    || typeof result.payloadDigest !== "string"
    || typeof result.controlState !== "string"
    || typeof result.effectState !== "string"
    || !Number.isSafeInteger(result.effectStartCount)
    || result.effectStartCount < 0
  ) throw new Error("WebMCP完了結果が入力と結び付いていません");
  return {
    intent: {
      intentId: result.intentId,
      logicalOperationId: input.logicalOperationId,
      target: result.target,
      payloadDigest: result.payloadDigest,
      controlState: result.controlState,
      effectState: result.effectState,
      title: input.title,
      body: input.body,
    },
    effectStartCount: result.effectStartCount,
    inputEvidence: result.inputEvidence,
  };
}

async function preview(values = formValue(), signal) {
  updateVisual({ type: "RESET" });
  const result = await requestPreview(values, signal);
  assertLocalPreviewReadback(result);
  render(result.intent, "台帳の状態を読み戻しています。");
  const status = await readStatus(result.intent.intentId);
  assertStatusReadback(status, result.intent);
  const event = visualEventFromPersistedStatus(status.intent, status.effectStartCount);
  const restored = status.intent.controlState !== "DRY_RUN";
  render(
    status.intent,
    restored
      ? `既存状態を読み戻しました: ${status.intent.controlState} / ${status.intent.effectState}`
      : "乾式実行が完了しました。内容を確認してから承認してください。",
  );
  renderInputEvidence(result.inputEvidence);
  updateVisual(event);
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
  const receipt = await request("/api/receipt", {
    intentId: currentIntentId,
    activeTags: active.map((notification) => notification.tag),
  });
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
    activeTags: active.map((notification) => notification.tag),
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
  const registration = await registerNotificationWebMcpTool({
    preview: async (projected, context) => {
      const result = await requestPreview(projected, context.signal, "/api/webmcp-preview");
      assertLocalPreviewReadback(result);
      const status = await readStatus(result.intent.intentId);
      assertStatusReadback(status, result.intent);
      return { ...result, status };
    },
    onLifecycle: (event) => {
      renderProvenanceObservation(event.observation);
      if (event.type === "INPUT_RECEIVED") {
        updateInputBoundary({ type: "INPUT_RECEIVED" });
      } else if (event.type === "INPUT_REJECTED") {
        const message = inputRejectionMessage(event.error);
        updateInputBoundary({ type: "INPUT_REJECTED", message });
        elements.provenanceReadback.textContent = "Intent作成前に停止";
        elements.log.textContent = `WebMCP入力を拒否: ${message}`;
      } else if (event.type === "INPUT_ACCEPTED") {
        updateInputBoundary({ type: "INPUT_ACCEPTED" });
      } else if (event.type === "DRY_RUN_COMPLETED") {
        const completion = webMcpUiResult(event);
        const status = {
          intent: completion.intent,
          effectStartCount: completion.effectStartCount,
        };
        const restored = status.intent.controlState !== "DRY_RUN";
        render(
          status.intent,
          restored
            ? `WebMCPから既存状態を読み戻しました: ${status.intent.controlState} / ${status.intent.effectState}`
            : "WebMCP入力の由来をSQLiteと監査記録から読み戻しました。実通知は開始していません。",
        );
        renderInputEvidence(completion.inputEvidence);
        updateVisual({
          type: "RESTORE_PERSISTED",
          intent: status.intent,
          effectStartCount: status.effectStartCount,
        });
        elements.logicalOperation.value = event.input.logicalOperationId;
        elements.title.value = event.input.title;
        elements.body.value = event.input.body;
        updateInputBoundary({
          type: "DRY_RUN_COMPLETED",
          controlState: status.intent.controlState,
          effectState: status.intent.effectState,
          effectStartCount: status.effectStartCount,
        });
      } else if (event.type === "DRY_RUN_FAILED") {
        updateInputBoundary({ type: "DRY_RUN_FAILED" });
        elements.provenanceReadback.textContent = "結果不一致で停止";
        elements.log.textContent = "WebMCP乾式実行を停止: 由来か結果を確認できません。実通知は開始していません。";
      }
    },
  });

  if (registration.status === "REGISTERED") {
    elements.webmcp.textContent = "CONFIRMED — 専用アダプターがsame-origin notify_onceを登録済み";
  } else if (registration.status === "UNAVAILABLE") {
    elements.webmcp.textContent = "INCONCLUSIVE — このブラウザーにWebMCP入口がありません。ローカル経路は利用できます";
  } else if (registration.status === "PERMISSION_DENIED") {
    elements.webmcp.textContent = "BLOCKED — tools権限方針が登録を拒否しました";
  } else {
    elements.webmcp.textContent = `INCONCLUSIVE — 専用アダプターの登録失敗 (${registration.errorName})`;
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

await registerWebMcp();

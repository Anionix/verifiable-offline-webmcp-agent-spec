// @ts-check
// information_uuid_v5=1f2858ab-7aa2-59c9-b388-c0d98b3f8355
// event_uuid_v7=01a04a5f-510c-74b6-9324-96978edf204b
// state_transition=REGISTERED -> USER_APPROVED -> EXECUTING -> VERIFIED occurred_at=2026-08-28T22:05:45.740Z
// machine-contract: an agent can create only a dry run; notification permission and the one allowed effect remain reachable only from the visible human approval button.

import { projectNotificationToolInput } from "/input-projection.js";
import {
  abortBeforeEffect,
  approveIntent,
  claimEffectStart,
  confirmEffectPresent,
  createOrReadDryRun,
  getIntent,
  getIntentByLogicalOperation,
  listIntentEvents,
  suppressVerifiedDuplicate,
} from "/browser-store.js";
import {
  NotificationInputError,
  registerPublicNotificationTool,
} from "/webmcp-adapter.js";

const elements = {
  logicalOperation: document.querySelector("#logical-operation"),
  title: document.querySelector("#title"),
  body: document.querySelector("#body"),
  preview: document.querySelector("#preview"),
  approve: document.querySelector("#approve"),
  retry: document.querySelector("#retry"),
  reconcile: document.querySelector("#reconcile"),
  message: document.querySelector("#message"),
  toolStatus: document.querySelector("#tool-status"),
  storageStatus: document.querySelector("#storage-status"),
  offlineStatus: document.querySelector("#offline-status"),
  intentId: document.querySelector("#intent-id"),
  controlState: document.querySelector("#control-state"),
  effectState: document.querySelector("#effect-state"),
  effectCount: document.querySelector("#effect-count"),
  provenance: document.querySelector("#provenance"),
  auditHead: document.querySelector("#audit-head"),
  eventLog: document.querySelector("#event-log"),
  resultCard: document.querySelector("#result-card"),
  resultLabel: document.querySelector("#result-label"),
  steps: {
    input: document.querySelector("#step-input"),
    dryRun: document.querySelector("#step-dry-run"),
    approval: document.querySelector("#step-approval"),
    effect: document.querySelector("#step-effect"),
  },
};

let currentIntentId = null;
let serviceWorkerRegistration = null;

function formValue() {
  return {
    logicalOperationId: elements.logicalOperation.value,
    title: elements.title.value,
    body: elements.body.value,
  };
}

function short(value) {
  if (!value || typeof value !== "string") return "—";
  return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

function inputErrorMessage(error) {
  if (!(error instanceof NotificationInputError)) return error instanceof Error ? error.message : String(error);
  const labels = {
    INPUT_OBJECT_REQUIRED: "Input must be one object / 入力は一つの物体形式が必要です",
    PLAIN_OBJECT_REQUIRED: "Inherited input is blocked / 継承された入力を停止しました",
    UNKNOWN_FIELD: "Unknown field blocked / 未許可の項目を停止しました",
    MISSING_FIELD: "Required field missing / 必須項目がありません",
    DATA_PROPERTY_REQUIRED: "Accessor input blocked / 動的な入力項目を停止しました",
    STRING_REQUIRED: "Text value required / 文字列が必要です",
    INVALID_UNICODE: "Malformed text blocked / 壊れた文字を停止しました",
    CONTROL_CHARACTER: "Control character blocked / 制御文字を停止しました",
    DIRECTIONAL_CONTROL: "Directional control blocked / 方向制御文字を停止しました",
    NONCHARACTER: "Reserved character blocked / 予約文字を停止しました",
    INVALID_LENGTH: "Text length is outside the contract / 文字数が契約外です",
    UNSUPPORTED_CHARACTER: "Operation ID contains unsupported characters / 操作識別子に未対応文字があります",
  };
  return labels[error.code] ?? error.message;
}

function setMessage(text, state = "info") {
  elements.message.textContent = text;
  elements.message.dataset.state = state;
}

function setStep(element, state, status) {
  element.dataset.state = state;
  element.querySelector("small").textContent = status;
}

function stateInvariant(intent) {
  const pair = `${intent.controlState}/${intent.effectState}`;
  if (["DRY_RUN/NOT_STARTED", "USER_APPROVED/NOT_STARTED", "ABORTED/NOT_STARTED"].includes(pair)) {
    return intent.effectStartCount === 0;
  }
  if (["EXECUTING/AMBIGUOUS", "VERIFIED/CONFIRMED_PRESENT"].includes(pair)) {
    return intent.effectStartCount === 1;
  }
  return false;
}

function renderFlow(intent) {
  setStep(elements.steps.input, "verified", "Strict input accepted / 厳格検査済み");
  setStep(elements.steps.dryRun, "verified", "Stored locally / 端末内に保存済み");
  setStep(elements.steps.approval, "idle", "Human only / 人だけが実行可能");
  setStep(elements.steps.effect, "idle", "Not started / 未開始");

  if (intent.controlState === "DRY_RUN") {
    setStep(elements.steps.approval, "active", "Waiting for your click / クリック待ち");
  } else if (intent.controlState === "USER_APPROVED") {
    setStep(elements.steps.approval, "verified", "Approved / 承認済み");
    setStep(elements.steps.effect, "active", "Starting once / 1回だけ開始中");
  } else if (intent.controlState === "EXECUTING") {
    setStep(elements.steps.approval, "verified", "Approved / 承認済み");
    setStep(elements.steps.effect, "warning", "Unknown; no retry / 結果不明・再送停止");
  } else if (intent.controlState === "VERIFIED") {
    setStep(elements.steps.approval, "verified", "Approved / 承認済み");
    setStep(elements.steps.effect, "verified", "One confirmed / 1件を確認済み");
  } else if (intent.controlState === "ABORTED") {
    setStep(elements.steps.approval, "blocked", "Stopped / 停止");
    setStep(elements.steps.effect, "blocked", "Never started / 未開始");
  }
}

async function renderEvents(intentId) {
  const events = await listIntentEvents(intentId);
  elements.eventLog.textContent = events.map((event) => {
    const time = new Date(event.occurredAt).toISOString();
    return `#${event.sequence} ${time} ${event.kind}\n  ${event.fromControl}/${event.fromEffect ?? "—"} -> ${event.toControl}/${event.toEffect}\n  event=${event.eventId} hash=${event.hash}`;
  }).join("\n\n");
}

async function renderIntent(intent, message, inputEvidence) {
  if (!intent) throw new TypeError("Persisted intent is unavailable / 保存されたIntentがありません");
  currentIntentId = intent.intentId;
  const safe = stateInvariant(intent);
  elements.intentId.textContent = intent.intentId;
  elements.controlState.textContent = intent.controlState;
  elements.effectState.textContent = intent.effectState;
  elements.effectCount.textContent = String(intent.effectStartCount);
  elements.auditHead.textContent = short(intent.auditHead);
  elements.provenance.textContent = inputEvidence
    ? `${inputEvidence.channel} · ${inputEvidence.storageKind} · ${inputEvidence.matchesPersisted ? "MATCH" : `FIRST=${inputEvidence.persistedChannel}`}`
    : "IndexedDB readback / 端末内読み戻し";
  elements.approve.disabled = intent.controlState !== "DRY_RUN";
  elements.retry.disabled = intent.controlState !== "VERIFIED";
  elements.reconcile.disabled = !(intent.controlState === "EXECUTING" && intent.effectState === "AMBIGUOUS");
  elements.resultCard.dataset.state = safe
    ? intent.controlState === "VERIFIED" ? "verified" : intent.controlState === "EXECUTING" ? "warning" : "ready"
    : "violation";
  elements.resultLabel.textContent = safe
    ? intent.controlState === "VERIFIED"
      ? "Verified one effect / 1件を確認"
      : intent.controlState === "EXECUTING"
        ? "Unknown; retry blocked / 結果不明・再送停止"
        : "No effect started / 外部効果は未開始"
    : "Safety invariant failed / 安全条件違反";
  renderFlow(intent);
  setMessage(message, safe ? "success" : "error");
  await renderEvents(intent.intentId);
}

async function previewLocal() {
  const projected = projectNotificationToolInput(formValue());
  const envelope = await createOrReadDryRun(projected, { channel: "LOCAL_FORM" });
  await renderIntent(
    envelope.status.intent,
    envelope.status.intent.controlState === "DRY_RUN"
      ? "Dry run stored. No permission requested. / 乾式実行を保存しました。通知許可は求めていません。"
      : "Existing state restored without retry. / 再送せず既存状態を読み戻しました。",
    {
      ...envelope.inputEvidence.invocation,
      matchesPersisted: envelope.inputEvidence.matchesPersisted,
      persistedChannel: envelope.inputEvidence.persisted.channel,
    },
  );
}

async function readyRegistration() {
  if (!serviceWorkerRegistration) serviceWorkerRegistration = await navigator.serviceWorker.ready;
  return serviceWorkerRegistration;
}

async function approveAndNotify() {
  if (!currentIntentId) throw new TypeError("Run the dry run first / 先に乾式実行してください");
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new TypeError("This browser cannot verify notifications / このブラウザーでは通知を確認できません");
  }

  const permission = await Notification.requestPermission();
  const before = await getIntent(currentIntentId);
  if (!before || before.controlState !== "DRY_RUN") throw new TypeError("Intent is not waiting for approval / 承認待ち状態ではありません");
  if (permission !== "granted") {
    const stopped = await abortBeforeEffect(currentIntentId, `NOTIFICATION_PERMISSION_${permission.toUpperCase()}`);
    await renderIntent(stopped.intent, "Stopped before any effect because permission was not granted. / 許可されなかったため外部効果の前で停止しました。");
    return;
  }

  const approved = await approveIntent(currentIntentId);
  await renderIntent(approved.intent, "Human approval bound to this payload. / この内容への人の承認を結び付けました。");
  const claimed = await claimEffectStart(currentIntentId);
  await renderIntent(claimed.intent, "Effect start claimed conservatively; checking the browser. / 開始を保守的に1件計上し、ブラウザーで確認中です。");

  try {
    const registration = await readyRegistration();
    await registration.showNotification(claimed.intent.title, {
      body: claimed.intent.body,
      tag: claimed.intent.intentId,
      renotify: false,
      data: { intentId: claimed.intent.intentId },
    });
    const active = await registration.getNotifications({ tag: claimed.intent.intentId });
    if (!active.some((notification) => notification.tag === claimed.intent.intentId)) {
      await renderIntent(
        await getIntent(currentIntentId),
        "Result is unknown. Automatic retry is blocked. / 結果不明です。自動再送を停止しました。",
      );
      return;
    }
    const verified = await confirmEffectPresent(currentIntentId);
    await renderIntent(verified.intent, "One notification was read back and verified. / 通知1件を読み戻して確認しました。");
  } catch (error) {
    const current = await getIntent(currentIntentId);
    await renderIntent(
      current,
      `Result is unknown; retry remains blocked. / 結果不明のため再送停止: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function retrySameOperation() {
  if (!currentIntentId) throw new TypeError("No intent to retry / 再試行するIntentがありません");
  const current = await getIntent(currentIntentId);
  if (!current || current.controlState !== "VERIFIED") throw new TypeError("Only a verified intent can prove duplicate suppression / 確認済みIntentだけが重複停止を証明できます");
  const suppressed = await suppressVerifiedDuplicate(currentIntentId);
  await renderIntent(suppressed.intent, "Duplicate stopped. The effect count is still one. / 重複を停止しました。外部効果は1件のままです。");
}

async function reconcileUnknown() {
  if (!currentIntentId) throw new TypeError("No intent to reconcile / 照合するIntentがありません");
  const current = await getIntent(currentIntentId);
  if (!current || current.controlState !== "EXECUTING" || current.effectState !== "AMBIGUOUS") {
    throw new TypeError("Intent is not ambiguous / 結果不明状態ではありません");
  }
  const registration = await readyRegistration();
  const active = await registration.getNotifications({ tag: current.intentId });
  if (active.some((notification) => notification.tag === current.intentId)) {
    const verified = await confirmEffectPresent(current.intentId);
    await renderIntent(verified.intent, "Presence confirmed without retry. / 再送せず表示を確認しました。");
    return;
  }
  await renderIntent(
    current,
    "Current absence cannot prove that no earlier display occurred. Retry stays blocked. / 現在表示がないだけでは過去の未表示を証明できないため、再送停止を維持します。",
  );
}

async function handle(action) {
  try {
    await action();
  } catch (error) {
    setMessage(inputErrorMessage(error), "error");
  }
}

async function restoreDefaultIntent() {
  try {
    const projected = projectNotificationToolInput(formValue());
    const existing = await getIntentByLogicalOperation(projected.logicalOperationId);
    if (existing) await renderIntent(existing, "Restored from this browser. / このブラウザーの保存状態を復元しました。");
  } catch (error) {
    setMessage(inputErrorMessage(error), "error");
  }
}

async function registerWebMcp() {
  const registration = await registerPublicNotificationTool({
    preview: (input, context) => createOrReadDryRun(input, context),
    onLifecycle: (event) => {
      if (event.type === "INPUT_RECEIVED") {
        setMessage("Agent input received; validating three fields. / エージェント入力を受信し、3項目を検査中です。", "info");
      } else if (event.type === "INPUT_REJECTED") {
        setMessage(inputErrorMessage(event.error), "error");
      } else if (event.type === "INPUT_ACCEPTED") {
        setMessage("Strict input accepted; storing dry run only. / 厳格検査に合格し、乾式実行だけを保存中です。", "info");
      } else if (event.type === "DRY_RUN_COMPLETED") {
        elements.logicalOperation.value = event.input.logicalOperationId;
        elements.title.value = event.input.title;
        elements.body.value = event.input.body;
        void getIntent(event.result.intentId).then((intent) => renderIntent(
          intent,
          event.result.restored
            ? "Agent restored existing state; no retry occurred. / エージェントが既存状態を復元し、再送はしていません。"
            : "Agent prepared a dry run. Human approval is still required. / エージェントが乾式実行を準備しました。人の承認が必要です。",
          event.result.inputEvidence,
        )).catch((error) => setMessage(inputErrorMessage(error), "error"));
      } else if (event.type === "DRY_RUN_FAILED") {
        setMessage("Dry-run evidence could not be verified; stopped. / 乾式実行の証拠を確認できず停止しました。", "error");
      }
    },
  });

  if (registration.status === "REGISTERED") {
    elements.toolStatus.textContent = "CONFIRMED · notify_once";
    elements.toolStatus.dataset.state = "verified";
  } else if (registration.status === "UNAVAILABLE") {
    elements.toolStatus.textContent = "INCONCLUSIVE · browser surface absent";
    elements.toolStatus.dataset.state = "warning";
  } else {
    elements.toolStatus.textContent = `${registration.status} · ${registration.reason}`;
    elements.toolStatus.dataset.state = "blocked";
  }
}

elements.preview.addEventListener("click", () => void handle(previewLocal));
elements.approve.addEventListener("click", () => void handle(approveAndNotify));
elements.retry.addEventListener("click", () => void handle(retrySameOperation));
elements.reconcile.addEventListener("click", () => void handle(reconcileUnknown));

if ("serviceWorker" in navigator) {
  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    elements.offlineStatus.textContent = "READY · cached after first visit";
    elements.offlineStatus.dataset.state = "verified";
  } catch (error) {
    elements.offlineStatus.textContent = "INCONCLUSIVE · cache unavailable";
    elements.offlineStatus.dataset.state = "warning";
    setMessage(inputErrorMessage(error), "error");
  }
} else {
  elements.offlineStatus.textContent = "UNAVAILABLE · no service worker";
  elements.offlineStatus.dataset.state = "blocked";
}

try {
  await restoreDefaultIntent();
  elements.storageStatus.textContent = "READY · IndexedDB readback";
  elements.storageStatus.dataset.state = "verified";
} catch (error) {
  elements.storageStatus.textContent = "BLOCKED · IndexedDB unavailable";
  elements.storageStatus.dataset.state = "blocked";
  setMessage(inputErrorMessage(error), "error");
}

await registerWebMcp();

// information_uuid_v5=0f2f9d6a-05a1-563b-90f6-1aa7bf46b050
// event_uuid_v7=01a04872-066c-7490-84fd-4167a24da2a4
// machine-contract: notification permission and execute are reachable only from an explicit user click after preview.
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
};

let currentIntentId = null;
const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });

async function request(path, value) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `request failed: ${response.status}`);
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

async function preview(values = formValue()) {
  const result = await request("/api/preview", values);
  render(result.intent, "乾式実行が完了しました。内容を確認してから承認してください。");
  return result;
}

async function approveAndNotify() {
  if (!currentIntentId) throw new Error("先に乾式実行してください");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(`通知権限が許可されませんでした: ${permission}`);
  const claim = await request("/api/approve-and-claim", { intentId: currentIntentId });
  if (claim.status !== "COMMAND") {
    render(claim.intent, `外部効果は開始しませんでした: ${claim.status}`);
    return claim;
  }
  const ready = await navigator.serviceWorker.ready;
  await ready.showNotification(claim.command.title, {
    body: claim.command.body,
    tag: claim.command.tag,
    renotify: false,
    data: { intentId: currentIntentId },
  });
  const active = await ready.getNotifications({ tag: claim.command.tag });
  if (active.length < 1) {
    render(claim.intent, "通知表示後の読み戻しができません。状態はAMBIGUOUSのままです。");
    elements.reconcile.disabled = false;
    return claim;
  }
  const receipt = await request("/api/receipt", { intentId: currentIntentId, activeCount: active.length });
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
  render(result.intent, `照合結果: ${result.status}`);
}

async function handle(action) {
  try { await action(); }
  catch (error) { elements.log.textContent = `停止: ${error instanceof Error ? error.message : String(error)}`; }
}

elements.preview.addEventListener("click", () => handle(preview));
elements.approve.addEventListener("click", () => handle(approveAndNotify));
elements.retry.addEventListener("click", () => handle(approveAndNotify));
elements.reconcile.addEventListener("click", () => handle(reconcile));

async function registerWebMcp() {
  const context = document.modelContext;
  if (!context?.registerTool) {
    elements.webmcp.textContent = "INCONCLUSIVE — このブラウザーにdocument.modelContextがありません";
    return;
  }
  await context.registerTool({
    name: "notify_once",
    title: "Prepare one duplicate-safe local notification",
    description: "Prepares a local Mac notification. A visible human approval in the page is still required before the effect.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["logicalOperationId", "title", "body"],
      properties: {
        logicalOperationId: { type: "string", minLength: 1, maxLength: 128 },
        title: { type: "string", minLength: 1, maxLength: 120 },
        body: { type: "string", minLength: 1, maxLength: 1000 },
      },
    },
    execute: async (input) => {
      elements.logicalOperation.value = input.logicalOperationId;
      elements.title.value = input.title;
      elements.body.value = input.body;
      const result = await preview(input);
      return { ...result.preview, state: "DRY_RUN", humanApprovalRequired: true };
    },
  });
  elements.webmcp.textContent = "CONFIRMED — notify_onceを登録済み";
}

await registerWebMcp();

// information_uuid_v5=b7c2df57-dddf-58df-9132-5f643af144d4
// event_uuid_v7=01a04921-8789-7e55-b951-4924be6b2cd8
// machine-contract: browser reads public evidence only; no request path can authorize, execute, or reconcile a notification.
import { deriveSyncView, stagedSyncView } from "/visual-state.js";

const elements = {
  proof: document.querySelector("#hero-proof"),
  intentSources: document.querySelector("#intent-source-count"),
  notifications: document.querySelector("#notification-count"),
  reviews: document.querySelector("#review-count"),
  replay: document.querySelector("#replay"),
  flow: document.querySelector("#sync-flow"),
  announcer: document.querySelector("#flow-announcer"),
  deviceA: document.querySelector("#device-a"),
  deviceB: document.querySelector("#device-b"),
  deviceAEvents: document.querySelector("#device-a-events"),
  deviceBEvents: document.querySelector("#device-b-events"),
  deviceAStatus: document.querySelector("#device-a-status"),
  deviceBStatus: document.querySelector("#device-b-status"),
  verification: document.querySelector("#verification-gate"),
  verificationStatus: document.querySelector("#verification-status"),
  ingestionCount: document.querySelector("#ingestion-count"),
  safeResult: document.querySelector("#safe-result"),
  safeStatus: document.querySelector("#safe-status"),
  safeTags: document.querySelector("#safe-tags"),
  dangerResult: document.querySelector("#danger-result"),
  dangerStatus: document.querySelector("#danger-status"),
  checkpoints: document.querySelector("#device-checkpoints"),
  faults: document.querySelector("#fault-list"),
  technicalLog: document.querySelector("#technical-log"),
};

let view = null;
let replayGeneration = 0;

function short(value) {
  return value === "UNMEASURED" ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function setState(element, state) {
  element.dataset.state = state;
}

function renderStep(step) {
  if (!view) return;
  const staged = stagedSyncView(view, step);
  elements.flow.dataset.step = String(staged.step);
  setState(elements.deviceA, staged.devicesReady ? "verified" : "idle");
  setState(elements.deviceB, staged.devicesReady ? "verified" : "idle");
  elements.deviceAStatus.textContent = staged.devicesReady ? "端末内署名済み" : "通信切断中";
  elements.deviceBStatus.textContent = staged.devicesReady ? "端末内署名済み" : "通信切断中";
  setState(elements.verification, staged.signaturesVerified ? "verified" : "idle");
  elements.verificationStatus.textContent = staged.signaturesVerified ? "全件合格" : "待機";
  setState(elements.safeResult, staged.safeStateMerged ? "verified" : "idle");
  elements.safeStatus.textContent = staged.safeStateMerged ? "収束済み" : "待機";
  elements.safeTags.textContent = staged.safeStateMerged ? view.safeTags.join(" ・ ") : "まだ統合していません";
  setState(elements.dangerResult, staged.violation ? "violation" : staged.dangerousEffectStopped ? "stopped" : "idle");
  elements.dangerStatus.textContent = staged.violation ? "安全条件違反" : staged.dangerousEffectStopped ? "自動実行を停止" : "待機";
  const messages = [
    "二台は通信切断中です。",
    "二台が独立した署名鎖を作りました。",
    "署名、端末内連番、直前ハッシュを検証しました。",
    "安全なタグ集合だけが同じ値へ収束しました。",
    staged.violation ? "証拠の安全条件が崩れています。" : "二つの通知意図を実行せず、一つの人の確認待ちへ止めました。",
  ];
  elements.announcer.textContent = messages[staged.step];
}

function checkpointRow(device) {
  const article = document.createElement("article");
  article.className = "checkpoint-row";
  const label = document.createElement("div");
  const title = document.createElement("h3");
  const description = document.createElement("p");
  const badge = document.createElement("span");
  title.textContent = device.label;
  description.textContent = `${device.eventCount ?? "—"}件 ・ Merkle root ${short(device.merkleRoot)}`;
  badge.textContent = device.treeSize === device.eventCount ? "署名照合済み" : "不一致";
  badge.dataset.state = device.treeSize === device.eventCount ? "verified" : "violation";
  label.append(title, description);
  article.append(label, badge);
  return article;
}

function renderEvidence(evidence, records) {
  view = deriveSyncView(evidence);
  elements.proof.dataset.state = view.phase;
  elements.flow.dataset.state = view.phase;
  elements.intentSources.textContent = view.intentSources === null ? "—" : String(view.intentSources);
  elements.notifications.textContent = view.notifications === null ? "—" : String(view.notifications);
  elements.reviews.textContent = view.reviewCases === null ? "—" : String(view.reviewCases);
  elements.deviceAEvents.textContent = view.devices[0]?.eventCount ?? "—";
  elements.deviceBEvents.textContent = view.devices[1]?.eventCount ?? "—";
  elements.ingestionCount.textContent = view.globalIngestionCount ?? "—";
  elements.checkpoints.replaceChildren(...view.devices.map(checkpointRow));
  const faultItems = view.faultResults.map(fault => {
    const item = document.createElement("li");
    const icon = document.createElement("span");
    const copy = document.createElement("span");
    const code = document.createElement("code");
    icon.className = "fault-mark";
    icon.textContent = fault.stopped ? "✓" : "!";
    copy.textContent = fault.label;
    code.textContent = fault.code;
    item.dataset.state = fault.stopped ? "verified" : "violation";
    item.append(icon, copy, code);
    return item;
  });
  elements.faults.replaceChildren(...faultItems);
  elements.technicalLog.textContent = records.map(record =>
    `#${record.globalSequence} 端末=${short(record.deviceId)} 端末内=${record.deviceSequence}  ${record.decision}`,
  ).join("\n");
  elements.replay.disabled = false;
  renderStep(4);
}

async function replay() {
  if (!view) return;
  const generation = ++replayGeneration;
  elements.replay.disabled = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (let step = 0; step <= 4; step += 1) {
    if (generation !== replayGeneration) return;
    renderStep(step);
    if (!reduced && step < 4) await new Promise(resolve => setTimeout(resolve, 560));
  }
  elements.replay.disabled = false;
}

elements.replay.addEventListener("click", () => void replay());

try {
  const [evidenceResponse, ingestionResponse] = await Promise.all([
    fetch("/evidence.json", { headers: { Accept: "application/json" }, cache: "no-store" }),
    fetch("/ingestion.ndjson", { headers: { Accept: "application/x-ndjson" }, cache: "no-store" }),
  ]);
  if (!evidenceResponse.ok || !ingestionResponse.ok) throw new Error("公開証拠を読み込めませんでした");
  const evidence = await evidenceResponse.json();
  const records = (await ingestionResponse.text()).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  renderEvidence(evidence, records);
} catch (error) {
  elements.proof.dataset.state = "violation";
  elements.flow.dataset.state = "violation";
  elements.announcer.textContent = error instanceof Error ? error.message : "読込に失敗しました";
  elements.technicalLog.textContent = elements.announcer.textContent;
}

// information_uuid_v5=6f0da229-628c-5da6-b2ae-7c66706a6811
// event_uuid_v7=01a0493d-49be-757d-9c61-2d40d20273b3
// machine-contract: browser reads public planner evidence only; replay changes presentation state and cannot call a model, authorize, or execute a tool.
import { derivePlannerView, stagedPlannerView } from "/visual-state.js";

const elements = {
  proof: document.querySelector("#proof-board"),
  candidate: document.querySelector("#candidate-count"),
  authorization: document.querySelector("#authorization-count"),
  effect: document.querySelector("#effect-count"),
  network: document.querySelector("#network-count"),
  retry: document.querySelector("#retry-count"),
  scenario: document.querySelector("#scenario-count"),
  seal: document.querySelector("#matrix-seal"),
  reasons: document.querySelector("#reason-list"),
  live: document.querySelector("#live-limit"),
  pricing: document.querySelector("#pricing-limit"),
  quality: document.querySelector("#quality-limit"),
  replay: document.querySelector("#replay"),
  flow: document.querySelector("#planner-flow"),
  announcer: document.querySelector("#flow-announcer"),
  local: document.querySelector("#step-local"),
  preflight: document.querySelector("#step-preflight"),
  request: document.querySelector("#step-request"),
  candidateStep: document.querySelector("#step-candidate"),
  effectStep: document.querySelector("#step-effect"),
  localStatus: document.querySelector("#status-local"),
  preflightStatus: document.querySelector("#status-preflight"),
  requestStatus: document.querySelector("#status-request"),
  candidateStatus: document.querySelector("#status-candidate"),
  effectStatus: document.querySelector("#status-effect"),
  log: document.querySelector("#technical-log"),
};

let view = null;
let generation = 0;
const setState = (element, state) => { element.dataset.state = state; };
const count = value => value === null ? "—" : String(value);
const short = value => value === "UNMEASURED" ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;

function renderStep(step) {
  if (!view) return;
  const staged = stagedPlannerView(view, step);
  setState(elements.local, staged.localReady ? "verified" : "idle");
  setState(elements.preflight, staged.preflightPassed ? "verified" : "idle");
  setState(elements.request, staged.oneRequestBounded ? "verified" : "idle");
  setState(elements.candidateStep, staged.violation ? "violation" : staged.candidateOnly ? "verified" : "idle");
  setState(elements.effectStep, staged.violation ? "violation" : staged.authorityStopped ? "stopped" : "idle");
  elements.localStatus.textContent = staged.localReady ? "利用可能" : "待機";
  elements.preflightStatus.textContent = staged.preflightPassed ? "通過" : "待機";
  elements.requestStatus.textContent = staged.oneRequestBounded ? "1回" : "待機";
  elements.candidateStatus.textContent = staged.violation ? "証拠違反" : staged.candidateOnly ? "候補のみ" : "待機";
  elements.effectStatus.textContent = staged.violation ? "証拠違反" : staged.authorityStopped ? "0のまま停止" : "待機";
  const messages = [
    "ローカル機能は利用可能です。",
    "道具、公開情報、費用を事前確認しました。",
    "時間上限つきの模擬要求を一回だけ開始しました。",
    staged.violation ? "公開証拠の安全条件が崩れています。" : "返答を未承認の候補として隔離しました。",
    staged.violation ? "承認境界の検証に失敗しました。" : "承認作成と外部効果をゼロのまま停止しました。",
  ];
  elements.announcer.textContent = messages[staged.step];
}

function render(evidence, events) {
  view = derivePlannerView(evidence, events);
  setState(elements.proof, view.phase);
  setState(elements.flow, view.phase);
  setState(elements.seal, view.phase);
  elements.candidate.textContent = count(view.candidateCount);
  elements.authorization.textContent = count(view.authorizationCount);
  elements.effect.textContent = count(view.effectCount);
  elements.network.textContent = count(view.networkCount);
  elements.retry.textContent = `${count(view.retryCount)} 回`;
  elements.scenario.textContent = count(view.scenarioCount);
  elements.seal.textContent = view.phase === "verified" ? "全件照合済み" : "条件違反";
  elements.live.textContent = view.limitations.live;
  elements.pricing.textContent = view.limitations.pricing;
  elements.quality.textContent = view.limitations.quality;
  const reasons = view.stopReasons.map(reason => {
    const item = document.createElement("li");
    item.textContent = reason;
    return item;
  });
  elements.reasons.replaceChildren(...reasons);
  elements.log.textContent = view.auditEvents.map(event =>
    `#${event.sequence ?? "—"}  ${event.kind.padEnd(19)} -> ${event.toState.padEnd(18)} ${event.reason ?? "OK"}  hash=${short(event.hash)}`,
  ).join("\n");
  elements.replay.disabled = false;
  renderStep(4);
}

async function replay() {
  if (!view) return;
  const current = ++generation;
  elements.replay.disabled = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (let step = 0; step <= 4; step += 1) {
    if (current !== generation) return;
    renderStep(step);
    if (!reduced && step < 4) await new Promise(resolve => setTimeout(resolve, 480));
  }
  elements.replay.disabled = false;
}

elements.replay.addEventListener("click", () => void replay());

try {
  const [evidenceResponse, auditResponse] = await Promise.all([
    fetch("/evidence.json", { headers: { Accept: "application/json" }, cache: "no-store" }),
    fetch("/audit.ndjson", { headers: { Accept: "application/x-ndjson" }, cache: "no-store" }),
  ]);
  if (!evidenceResponse.ok || !auditResponse.ok) throw new Error("公開証拠を読み込めませんでした");
  const evidence = await evidenceResponse.json();
  const events = (await auditResponse.text()).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  render(evidence, events);
} catch (error) {
  setState(elements.proof, "violation");
  setState(elements.flow, "violation");
  elements.seal.textContent = "読込失敗";
  elements.announcer.textContent = error instanceof Error ? error.message : "公開証拠の読込に失敗しました";
  elements.log.textContent = elements.announcer.textContent;
}

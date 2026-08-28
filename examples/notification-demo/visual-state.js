// information_uuid_v5=93f61359-9c25-5713-a190-6386973412fc
// event_uuid_v7=01a048b7-2624-7250-b747-08f5da2aad09
// machine-contract: the visualization must show the measured effect count; it must never clamp or hide a count above one.
// information_uuid_v5=3e9850eb-3a15-5818-9be6-b4e275a02073
// event_uuid_v7=01a048c5-b3e2-7c15-9299-e9d55ac1a8c0
// machine-contract: a confirmed-present or already-verified state requires exactly one measured effect claim.
// information_uuid_v5=cbeb5a00-12c7-5557-a8ec-c50cd3765001
// event_uuid_v7=01a048da-1888-7be0-9eef-3e1d0cadd1b1
// machine-contract: WebMCP input visibly advances RECEIVED -> STRICTLY_PROJECTED -> DRY_RUN, while rejection stops before intent creation.
// information_uuid_v5=d53907bf-96cd-56e5-be92-5c4f3576e477
// event_uuid_v7=01a04972-c11c-74d1-8639-c71dded7b68a
// machine-contract: CONFIRMED_ABSENT permits replay only after six visible checks pass; VERIFIED and AMBIGUOUS never enter the replay gate.
// information_uuid_v5=3093ad26-25f3-5912-b015-70a04c93fe08
// event_uuid_v7=01a04a3b-7a18-76a0-b150-b1aacc95e727
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:16:47.000Z
// machine-contract: a restored WebMCP state is rendered consistently in both panels and is never relabeled as a new zero-effect dry run.
// information_uuid_v5=4cb035a8-f737-514f-90c6-da6c0672f814
// event_uuid_v7=01a04a4c-1be8-727c-9b05-be91397708b3
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:34:57.000Z
// machine-contract: RESTORE_PERSISTED always reduces from the default state, so a new intent cannot inherit the prior intent's visual fields.
// information_uuid_v5=22f6663a-2651-58fe-aab8-f213212c6562
// event_uuid_v7=01a04a4c-1be8-7a58-a3c1-5c4e0474d59f
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:34:57.000Z
// machine-contract: NOT_STARTED and CONFIRMED_ABSENT require zero measured starts, while AMBIGUOUS and CONFIRMED_PRESENT require exactly one.

export const REPLAY_GATE_KEYS = Object.freeze([
  "authorization",
  "permission",
  "version",
  "consent",
  "timeToLive",
  "precondition",
]);

function replayGates(state = "idle", text = "未確認") {
  return Object.fromEntries(REPLAY_GATE_KEYS.map((key) => [key, Object.freeze({ state, text })]));
}

const DEFAULT_STATE = Object.freeze({
  phase: "idle",
  initialState: "idle",
  initialText: "乾式実行を待っています",
  retryState: "idle",
  retryText: "初回通知後に試せます",
  ledgerInitialState: "idle",
  ledgerInitialText: "未照合",
  ledgerRetryState: "idle",
  ledgerRetryText: "未照合",
  deliveryState: "idle",
  deliveryText: "通知はまだありません",
  blockedState: "idle",
  blockedText: "再試行前です",
  replayGateSummary: "再送が必要になった場合だけ、6項目をすべて再確認します。",
  replayGates: Object.freeze(replayGates()),
  effectStartCount: 0,
  notificationCount: 0,
  countLabel: "通知",
  countText: "外部効果はまだありません",
  announcement: "乾式実行を開始してください。",
});

const INPUT_BOUNDARY_DEFAULT_STATE = Object.freeze({
  phase: "idle",
  phaseText: "待機",
  receivedState: "idle",
  receivedText: "WebMCP呼び出しを待機",
  validationState: "idle",
  validationText: "未検査",
  dryRunState: "idle",
  dryRunText: "通知権限には進みません",
  announcement: "WebMCP入力を待っています。",
});

export function createVisualState() {
  return { ...DEFAULT_STATE, replayGates: replayGates() };
}

export function createInputBoundaryState() {
  return { ...INPUT_BOUNDARY_DEFAULT_STATE };
}

export function reduceInputBoundaryState(previous, event) {
  const state = previous ?? createInputBoundaryState();
  switch (event.type) {
    case "RESET_INPUT_BOUNDARY":
      return createInputBoundaryState();
    case "INPUT_RECEIVED":
      return {
        ...state,
        phase: "received",
        phaseText: "受信",
        receivedState: "active",
        receivedText: "値を受信しました",
        validationState: "idle",
        validationText: "厳格検査を開始",
        dryRunState: "idle",
        dryRunText: "まだ通していません",
        announcement: "WebMCP入力を受信し、厳格検査を開始しました。",
      };
    case "INPUT_ACCEPTED":
      return {
        ...state,
        phase: "accepted",
        phaseText: "検査合格",
        receivedState: "success",
        receivedText: "3項目だけを受信",
        validationState: "success",
        validationText: "型・文字・長さを確認",
        dryRunState: "active",
        dryRunText: "乾式実行へ送信中",
        announcement: "入力は厳格検査に合格し、乾式実行へ進みました。",
      };
    case "DRY_RUN_COMPLETED": {
      const controlState = event.controlState ?? "DRY_RUN";
      const effectState = event.effectState ?? "NOT_STARTED";
      const effectStartCount = event.effectStartCount ?? 0;
      const persistedEvent = visualEventFromPersistedStatus({ controlState, effectState }, effectStartCount);
      const persistedVisual = reduceVisualState(createVisualState(), persistedEvent);
      const violation = persistedVisual.phase === "violation";
      const restored = controlState !== "DRY_RUN" || effectState !== "NOT_STARTED";
      return {
        ...state,
        phase: violation ? "violation" : restored ? "restored" : "dry-run",
        phaseText: violation ? "安全条件違反" : restored ? "既存状態を復元" : "乾式実行済み",
        receivedState: "success",
        receivedText: "3項目だけを受信",
        validationState: "success",
        validationText: "型・文字・長さを確認",
        dryRunState: violation ? "error" : "success",
        dryRunText: `${controlState} / ${effectState}`,
        announcement: violation
          ? persistedVisual.announcement
          : restored
          ? `WebMCP入力は乾式実行経路で既存状態 ${controlState} / ${effectState} を読み戻しました。外部効果開始台帳は${effectStartCount}回です。`
          : "WebMCP入力は乾式実行だけへ到達しました。通知はまだありません。",
      };
    }
    case "DRY_RUN_FAILED":
      return {
        ...state,
        phase: "failed",
        phaseText: "停止",
        receivedState: "success",
        validationState: "success",
        dryRunState: "error",
        dryRunText: "結果を確認できません",
        announcement: "入力検査後の乾式実行を停止しました。実通知は開始していません。",
      };
    case "INPUT_REJECTED":
      return {
        ...state,
        phase: "rejected",
        phaseText: "拒否",
        receivedState: "success",
        receivedText: "値を受信しました",
        validationState: "error",
        validationText: event.message,
        dryRunState: "blocked",
        dryRunText: "Intentを作らず停止",
        announcement: `WebMCP入力を拒否しました。${event.message}。Intentと通知は作成していません。`,
      };
    default:
      throw new TypeError(`unknown input-boundary event: ${event.type}`);
  }
}

function measuredCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("effectStartCount must be a non-negative safe integer");
  }
  return value;
}

// information_uuid_v5=0a6e95b1-f829-5429-9caa-bd142f018915
// event_uuid_v7=01a04a1b-eac6-7c5c-aa43-c19d4a593bfb
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T20:42:18.694Z
// machine-contract: a status readback may advance mutable state, but it must preserve every immutable intent field from the preview response.
export function assertPersistedIntentMatchesPreview(persisted, preview) {
  const immutableFields = ["intentId", "logicalOperationId", "payloadDigest", "target", "title", "body"];
  if (
    !persisted
    || !preview
    || immutableFields.some((field) => persisted[field] !== preview[field])
  ) throw new TypeError("immutable intent readback mismatch");
}

// information_uuid_v5=97ce90b3-983b-56e7-9381-c8c2df3068e2
// event_uuid_v7=01a049fe-ffc3-73a1-9446-8e38a434dfca
// state_transition=DRY_RUN -> VERIFIED occurred_at=2026-08-28T20:10:43.523Z
// machine-contract: persisted control/effect state plus the measured ledger count determines the restored visualization; preview never overwrites observed truth.
export function visualEventFromPersistedStatus(intent, effectStartCount) {
  const count = measuredCount(effectStartCount);
  if (intent?.controlState === "VERIFIED" && intent.effectState === "CONFIRMED_PRESENT") {
    return { type: "PRESENT_CONFIRMED", effectStartCount: count };
  }
  if (intent?.controlState === "EXECUTING" && ["AMBIGUOUS", "RECONCILING"].includes(intent.effectState)) {
    return { type: "AMBIGUOUS", effectStartCount: count };
  }
  if (intent?.controlState === "ABORTED" && intent.effectState === "CONFIRMED_ABSENT") {
    return { type: "ABSENT_CONFIRMED", effectStartCount: count };
  }
  if (["DRY_RUN", "USER_APPROVED"].includes(intent?.controlState) && intent.effectState === "NOT_STARTED") {
    return { type: "PREVIEWED", effectStartCount: count };
  }
  if (intent?.controlState === "ABORTED" && intent.effectState === "NOT_STARTED") {
    return { type: "FAILED", message: "既存の操作は実行前に停止済みです", effectStartCount: count };
  }
  throw new TypeError(`unsupported persisted notification state: ${intent?.controlState}/${intent?.effectState}`);
}

function violationState(state, count, message) {
  return {
    ...state,
    phase: "violation",
    initialState: "error",
    retryState: "error",
    ledgerInitialState: "error",
    ledgerRetryState: "error",
    deliveryState: "error",
    blockedState: "error",
    replayGateSummary: "安全条件違反を解消するまで再送できません。",
    replayGates: replayGates("error", "停止"),
    effectStartCount: count,
    notificationCount: count,
    countLabel: "安全条件違反",
    countText: message,
    announcement: `安全条件違反。${message}。`,
  };
}

function withNoEffectInvariant(state, effectStartCount) {
  const count = measuredCount(effectStartCount);
  if (count === 0) return { ...state, effectStartCount: count };
  return violationState(state, count, `外部効果未開始の状態なのに開始台帳が${count}件あります`);
}

function withConfirmedEffectInvariant(state, effectStartCount) {
  const count = measuredCount(effectStartCount);
  if (count === 1) return { ...state, effectStartCount: count };
  const message = count === 0
    ? "確認済み状態なのに外部効果開始が0件です"
    : `外部効果が${count}件あります`;
  return violationState(state, count, message);
}

function withAmbiguousEffectInvariant(state, effectStartCount) {
  const count = measuredCount(effectStartCount);
  if (count === 1) return { ...state, effectStartCount: count };
  const message = count === 0
    ? "結果不明の状態なのに保守的な外部効果開始が0件です"
    : `外部効果が${count}件あります`;
  return violationState(state, count, message);
}

export function reduceVisualState(previous, event) {
  const state = previous ?? createVisualState();
  switch (event.type) {
    case "RESET":
      return createVisualState();
    case "RESTORE_PERSISTED":
      return reduceVisualState(
        createVisualState(),
        visualEventFromPersistedStatus(event.intent, event.effectStartCount),
      );
    case "PREVIEWED":
      return withNoEffectInvariant({
        ...createVisualState(),
        phase: "previewed",
        initialState: "ready",
        initialText: "乾式確認済み",
        ledgerInitialState: "ready",
        ledgerInitialText: "新しい操作として待機",
        announcement: "乾式実行が完了しました。通知はまだ0件です。",
      }, event.effectStartCount ?? 0);
    case "EXECUTION_CLAIMED":
      return {
        ...state,
        phase: "executing",
        initialState: "active",
        initialText: "台帳へ照会中",
        ledgerInitialState: "active",
        ledgerInitialText: "新しい操作を登録",
        deliveryState: "active",
        deliveryText: "通知結果を確認中",
        countLabel: "結果確認中",
        announcement: "初回要求を実行し、通知結果を確認しています。",
      };
    case "PRESENT_CONFIRMED":
      return withConfirmedEffectInvariant({
        ...state,
        phase: "verified",
        initialState: "success",
        initialText: "1件目を実行済み",
        retryState: "ready",
        retryText: "同じ操作を再試行できます",
        ledgerInitialState: "success",
        ledgerInitialText: "新しい操作として登録済み",
        deliveryState: "success",
        deliveryText: "表示を読み戻して確認",
        replayGateSummary: "実行済みなら再送しないため、6項目の再送判定には進みません。",
        replayGates: replayGates("idle", "台帳確認が先"),
        notificationCount: event.effectStartCount,
        countLabel: "通知",
        countText: "確認済みの外部効果",
        announcement: "通知を1件表示して確認しました。同じ操作を再試行できます。",
      }, event.effectStartCount);
    case "RETRY_STARTED":
      return {
        ...state,
        phase: "retrying",
        retryState: "active",
        retryText: "登録済みか照合中",
        ledgerRetryState: "active",
        ledgerRetryText: "同じIntent IDを照合",
        blockedState: "active",
        blockedText: "判定待ち",
        replayGateSummary: "まず台帳を確認中。実行済みなら、ここで止めます。",
        replayGates: replayGates("active", "台帳確認待ち"),
        announcement: "同じ論理操作を再試行し、台帳で照合しています。",
      };
    case "DUPLICATE_SUPPRESSED":
      return withConfirmedEffectInvariant({
        ...state,
        phase: "duplicate-suppressed",
        retryState: "blocked",
        retryText: "ALREADY_VERIFIED",
        ledgerRetryState: "blocked",
        ledgerRetryText: "登録済みを検出",
        blockedState: "success",
        blockedText: "二件目を停止",
        replayGateSummary: "台帳で実行済みを確認。再送しないので、6項目は確認不要です。",
        replayGates: replayGates("skipped", "確認不要"),
        notificationCount: event.effectStartCount,
        countLabel: "通知",
        countText: "再試行後も1件のまま",
        announcement: "同じ操作の再試行を停止しました。通知は1件のままです。",
      }, event.effectStartCount);
    case "AMBIGUOUS":
      return withAmbiguousEffectInvariant({
        ...state,
        phase: "ambiguous",
        initialState: "warning",
        initialText: "結果が不明です",
        ledgerInitialState: "warning",
        ledgerInitialText: "再送せず照合が必要",
        deliveryState: "warning",
        deliveryText: "表示結果を照合してください",
        replayGateSummary: "結果が不明な間は6項目を評価せず、先に独立照合します。",
        replayGates: replayGates("warning", "照合が先"),
        notificationCount: null,
        countLabel: "結果不明",
        countText: "照合前に再送しません",
        announcement: "通知結果が不明です。再送せず、結果を照合してください。",
      }, event.effectStartCount);
    case "ABSENT_CONFIRMED":
      return withNoEffectInvariant({
        ...state,
        phase: "absent",
        initialState: "warning",
        initialText: "表示なしを確認",
        ledgerInitialState: "warning",
        ledgerInitialText: "CONFIRMED_ABSENT",
        deliveryState: "idle",
        deliveryText: "通知は表示されていません",
        replayGateSummary: "再送するには、6項目すべての新しい証拠が必要です。",
        replayGates: replayGates("ready", "再確認待ち"),
        notificationCount: 0,
        countLabel: "通知",
        countText: "表示なしを確認済み",
        announcement: "通知が表示されていないことを確認しました。",
      }, event.effectStartCount);
    case "REPLAY_GATES_EVALUATED": {
      const gateStates = replayGates();
      for (const result of event.gates ?? []) {
        const key = {
          AUTHORIZATION: "authorization",
          PERMISSION: "permission",
          VERSION: "version",
          CONSENT: "consent",
          TIME_TO_LIVE: "timeToLive",
          PRECONDITION: "precondition",
        }[result.gate];
        if (!key || !["PASS", "BLOCKED"].includes(result.status)) {
          throw new TypeError("invalid replay gate result");
        }
        gateStates[key] = Object.freeze({
          state: result.status === "PASS" ? "success" : "blocked",
          text: result.status === "PASS" ? "合格" : "停止",
        });
      }
      if (Object.values(gateStates).some((item) => item.state === "idle")) {
        throw new TypeError("all six replay gate results are required");
      }
      const allowed = event.decision === "ALLOW_REPLAY";
      if (!allowed && event.decision !== "STOP") throw new TypeError("invalid replay decision");
      return {
        ...state,
        phase: allowed ? "replay-ready" : "replay-blocked",
        replayGateSummary: allowed
          ? "6項目すべて合格。表示なしの確認後に限り、再提案できます。"
          : "不合格の項目があるため、二件目を開始せず停止しました。",
        replayGates: gateStates,
        blockedState: allowed ? state.blockedState : "success",
        blockedText: allowed ? state.blockedText : "再送を停止",
        announcement: allowed
          ? "再試行前の6項目がすべて合格しました。"
          : "再試行前の6項目に不合格があり、二件目を停止しました。",
      };
    }
    case "FAILED":
      if (event.effectStartCount !== undefined) return withNoEffectInvariant({
        ...state,
        phase: "error",
        initialState: state.initialState === "active" ? "error" : state.initialState,
        retryState: state.retryState === "active" ? "error" : state.retryState,
        countLabel: "停止",
        countText: event.message,
        announcement: `処理を停止しました。${event.message}`,
      }, event.effectStartCount);
      return {
        ...state,
        phase: "error",
        initialState: state.initialState === "active" ? "error" : state.initialState,
        retryState: state.retryState === "active" ? "error" : state.retryState,
        countLabel: "停止",
        countText: event.message,
        announcement: `処理を停止しました。${event.message}`,
      };
    default:
      throw new TypeError(`unknown visualization event: ${event.type}`);
  }
}

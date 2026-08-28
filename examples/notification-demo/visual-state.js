// information_uuid_v5=93f61359-9c25-5713-a190-6386973412fc
// event_uuid_v7=01a048b7-2624-7250-b747-08f5da2aad09
// machine-contract: the visualization must show the measured effect count; it must never clamp or hide a count above one.
// information_uuid_v5=3e9850eb-3a15-5818-9be6-b4e275a02073
// event_uuid_v7=01a048c5-b3e2-7c15-9299-e9d55ac1a8c0
// machine-contract: a confirmed-present or already-verified state requires exactly one measured effect claim.
// information_uuid_v5=cbeb5a00-12c7-5557-a8ec-c50cd3765001
// event_uuid_v7=01a048da-1888-7be0-9eef-3e1d0cadd1b1
// machine-contract: WebMCP input visibly advances RECEIVED -> STRICTLY_PROJECTED -> DRY_RUN, while rejection stops before intent creation.

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
  return { ...DEFAULT_STATE };
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
    case "DRY_RUN_COMPLETED":
      return {
        ...state,
        phase: "dry-run",
        phaseText: "乾式実行済み",
        receivedState: "success",
        receivedText: "3項目だけを受信",
        validationState: "success",
        validationText: "型・文字・長さを確認",
        dryRunState: "success",
        dryRunText: "DRY_RUN / NOT_STARTED",
        announcement: "WebMCP入力は乾式実行だけへ到達しました。通知はまだありません。",
      };
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
    effectStartCount: count,
    notificationCount: count,
    countLabel: "安全条件違反",
    countText: message,
    announcement: `安全条件違反。${message}。`,
  };
}

function withInvariant(state, effectStartCount) {
  const count = measuredCount(effectStartCount);
  if (count <= 1) return { ...state, effectStartCount: count };
  return violationState(state, count, `外部効果が${count}件あります`);
}

function withConfirmedEffectInvariant(state, effectStartCount) {
  const count = measuredCount(effectStartCount);
  if (count === 1) return { ...state, effectStartCount: count };
  const message = count === 0
    ? "確認済み状態なのに外部効果開始が0件です"
    : `外部効果が${count}件あります`;
  return violationState(state, count, message);
}

export function reduceVisualState(previous, event) {
  const state = previous ?? createVisualState();
  switch (event.type) {
    case "RESET":
      return createVisualState();
    case "PREVIEWED":
      return {
        ...createVisualState(),
        phase: "previewed",
        initialState: "ready",
        initialText: "乾式確認済み",
        ledgerInitialState: "ready",
        ledgerInitialText: "新しい操作として待機",
        announcement: "乾式実行が完了しました。通知はまだ0件です。",
      };
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
        notificationCount: event.effectStartCount,
        countLabel: "通知",
        countText: "再試行後も1件のまま",
        announcement: "同じ操作の再試行を停止しました。通知は1件のままです。",
      }, event.effectStartCount);
    case "AMBIGUOUS":
      return withInvariant({
        ...state,
        phase: "ambiguous",
        initialState: "warning",
        initialText: "結果が不明です",
        ledgerInitialState: "warning",
        ledgerInitialText: "再送せず照合が必要",
        deliveryState: "warning",
        deliveryText: "表示結果を照合してください",
        notificationCount: null,
        countLabel: "結果不明",
        countText: "照合前に再送しません",
        announcement: "通知結果が不明です。再送せず、結果を照合してください。",
      }, event.effectStartCount);
    case "ABSENT_CONFIRMED":
      return withInvariant({
        ...state,
        phase: "absent",
        initialState: "warning",
        initialText: "表示なしを確認",
        ledgerInitialState: "warning",
        ledgerInitialText: "CONFIRMED_ABSENT",
        deliveryState: "idle",
        deliveryText: "通知は表示されていません",
        notificationCount: 0,
        countLabel: "通知",
        countText: "表示なしを確認済み",
        announcement: "通知が表示されていないことを確認しました。",
      }, event.effectStartCount);
    case "FAILED":
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

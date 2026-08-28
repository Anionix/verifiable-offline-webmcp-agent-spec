// information_uuid_v5=5daaabb6-622f-530c-a828-8b9b8d3c3376
// event_uuid_v7=01a0493d-49bf-7c95-ac88-d7e63d29b4a5
// machine-contract: public evidence renders VERIFIED only when candidate=1, authorization=0, external effects=0, retries=0, and real network requests=0.

/** @param {unknown} value */
function integerOrNull(value) {
  return Number.isSafeInteger(value) ? Number(value) : null;
}

/** @param {unknown} evidence @param {unknown} events */
export function derivePlannerView(evidence, events) {
  const value = /** @type {Record<string, any>} */ (evidence ?? {});
  const scope = value.scope ?? {};
  const observations = value.observations ?? {};
  const request = value.requestContract ?? {};
  const auditEvents = Array.isArray(events) ? events : [];
  const stopReasons = Array.isArray(observations.stopReasons)
    ? /** @type {unknown[]} */ (observations.stopReasons).filter(reason => typeof reason === "string")
    : [];
  const candidateEvents = auditEvents.filter(event => event?.kind === "candidate-recorded");
  const unsafeAuditEvent = auditEvents.find(event =>
    event?.authorizationCreated !== 0 || event?.externalEffectStarts !== 0 || event?.automaticRetries !== 0);
  const verified = value.status === "VERIFIED"
    && scope.actualNetworkRequests === 0
    && scope.actualExternalSpendMicroUsd === 0
    && scope.authorizationCreated === 0
    && scope.externalEffectStarts === 0
    && observations.expectedOutcomesMatched === true
    && observations.localPathAvailableWhenDisabled === true
    && observations.localPathAvailableWhenOffline === true
    && observations.privacyValuesExposed === false
    && observations.acceptedCandidateCount === 1
    && observations.acceptedCandidateStatus === "UNTRUSTED_PROPOSAL"
    && observations.automaticRetries === 0
    && observations.auditChainValid === true
    && request.store === false
    && request.background === false
    && request.parallelToolCalls === false
    && request.strictTools === true
    && request.allowlistApplied === true
    && candidateEvents.length === 1
    && !unsafeAuditEvent;
  return Object.freeze({
    phase: verified ? "verified" : "violation",
    headline: verified ? "候補は作る。権限は渡さない。" : "公開証拠の安全条件が崩れています",
    candidateCount: integerOrNull(observations.acceptedCandidateCount),
    authorizationCount: integerOrNull(scope.authorizationCreated),
    effectCount: integerOrNull(scope.externalEffectStarts),
    networkCount: integerOrNull(scope.actualNetworkRequests),
    retryCount: integerOrNull(observations.automaticRetries),
    scenarioCount: integerOrNull(observations.scenarioCount),
    stopReasons,
    limitations: {
      live: value.limitations?.liveResponsesApiConformance ?? "UNMEASURED",
      pricing: value.limitations?.currentProductionPricing ?? "UNMEASURED",
      quality: value.limitations?.productionQuality ?? "UNMEASURED",
    },
    auditEvents: auditEvents.map(event => ({
      sequence: integerOrNull(event?.sequence),
      kind: typeof event?.kind === "string" ? event.kind : "unknown",
      toState: typeof event?.toState === "string" ? event.toState : "unknown",
      reason: typeof event?.reason === "string" ? event.reason : null,
      transportAttempts: integerOrNull(event?.transportAttempts),
      hash: typeof event?.recordHash === "string" ? event.recordHash : "UNMEASURED",
    })),
  });
}

/** @param {ReturnType<typeof derivePlannerView>} view @param {number} step */
export function stagedPlannerView(view, step) {
  const bounded = Math.max(0, Math.min(4, Number.isInteger(step) ? step : 0));
  return Object.freeze({
    step: bounded,
    localReady: bounded >= 0,
    preflightPassed: bounded >= 1,
    oneRequestBounded: bounded >= 2,
    candidateOnly: bounded >= 3 && view.phase === "verified",
    authorityStopped: bounded >= 4 && view.phase === "verified",
    violation: bounded >= 3 && view.phase === "violation",
  });
}

// information_uuid_v5=9874d9b8-123a-50cd-8074-b31551bdc1cd
// event_uuid_v7=01a04921-87d0-7748-92c9-e4429672be9a
// machine-contract: evidence may render VERIFIED only when two dangerous sources converge to review and externalEffectStarts remains zero.

/** @param {unknown} value @returns {value is string} */
function isString(value) {
  return typeof value === "string";
}

/** @param {unknown} evidence */
export function deriveSyncView(evidence) {
  const value = /** @type {Record<string, any>} */ (evidence ?? {});
  const observations = value.observations ?? {};
  const devices = Array.isArray(value.devices) ? value.devices : [];
  const faultPairs = [
    ["署名改変", observations.signatureTamperRejected, "INVALID_SIGNATURE"],
    ["連番の欠け", observations.sequenceGapRejected, "SEQUENCE_GAP"],
    ["端末内の分岐", observations.forkRejected, "FORK_DETECTED"],
    ["チェックポイント不一致", observations.checkpointMismatchRejected, "CHECKPOINT_MISMATCH"],
  ];
  const faultResults = faultPairs.map(([label, actual, expected]) => ({
    label,
    code: typeof actual === "string" ? actual : "UNMEASURED",
    stopped: actual === expected,
  }));
  const verified = value.status === "VERIFIED"
    && devices.length === 2
    && observations.offlineDivergenceReproduced === true
    && observations.reconnectVerified === true
    && observations.deviceSequencesPreserved === true
    && observations.duplicateIngestionDidNotAdvance === true
    && observations.globalAuditValid === true
    && observations.dangerousIntentSourceCount === 2
    && observations.dangerousReviewCount === 1
    && observations.dangerousDecision === "HUMAN_REVIEW_REQUIRED"
    && observations.externalEffectStarts === 0
    && faultResults.every(item => item.stopped);
  return Object.freeze({
    phase: verified ? "verified" : "violation",
    title: verified ? "二つの意図を止めて、一つの確認待ちへ" : "証拠の条件が崩れています",
    intentSources: Number.isSafeInteger(observations.dangerousIntentSourceCount)
      ? observations.dangerousIntentSourceCount
      : null,
    notifications: Number.isSafeInteger(observations.externalEffectStarts)
      ? observations.externalEffectStarts
      : null,
    reviewCases: Number.isSafeInteger(observations.dangerousReviewCount)
      ? observations.dangerousReviewCount
      : null,
    safeTags: Array.isArray(observations.safeTags)
      ? /** @type {unknown[]} */ (observations.safeTags).filter(isString)
      : [],
    globalIngestionCount: Number.isSafeInteger(observations.globalIngestionCount)
      ? observations.globalIngestionCount
      : null,
    devices: devices.map(device => ({
      label: typeof device.label === "string" ? device.label : "端末",
      deviceId: typeof device.deviceId === "string" ? device.deviceId : "UNMEASURED",
      eventCount: Number.isSafeInteger(device.eventCount) ? device.eventCount : null,
      treeSize: Number.isSafeInteger(device.checkpoint?.treeSize) ? device.checkpoint.treeSize : null,
      merkleRoot: typeof device.checkpoint?.merkleRoot === "string" ? device.checkpoint.merkleRoot : "UNMEASURED",
    })),
    faultResults,
  });
}

/** @param {ReturnType<typeof deriveSyncView>} view @param {number} step */
export function stagedSyncView(view, step) {
  const bounded = Math.max(0, Math.min(4, Number.isInteger(step) ? step : 0));
  return Object.freeze({
    step: bounded,
    devicesReady: bounded >= 1,
    signaturesVerified: bounded >= 2,
    safeStateMerged: bounded >= 3,
    dangerousEffectStopped: bounded >= 4 && view.phase === "verified",
    violation: bounded >= 4 && view.phase === "violation",
  });
}

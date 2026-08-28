(* Verifiable Offline WebMCP Agent — mathematical reference model *)
ClearAll[CallAllowedQ, CommitAllowedQ, GeometricFactor, ExpectedRetries,
  GoodCommitProbability, BadCommitProbability, HumanProbability,
  DuplicateProbability, PosteriorReliability];

CallAllowedQ[pPPM_Integer, gain_Integer, failureLoss_Integer,
  totalPenalty_Integer, abstainUtility_Integer, scale_Integer : 1000000] :=
  pPPM (gain + failureLoss) >
    scale (totalPenalty + failureLoss + abstainUtility);

CommitAllowedQ[cPPM_Integer, classFloorPPM_Integer, damage_Integer,
  lossBudget_Integer, scale_Integer : 1000000] :=
  cPPM >= classFloorPPM &&
    (damage <= 0 || (scale - cPPM) damage <= scale lossBudget);

GeometricFactor[qR_, retryBudget_Integer?NonNegative] :=
  Sum[qR^i, {i, 0, retryBudget}];

ExpectedRetries[qR_, retryBudget_Integer?NonNegative] :=
  Sum[qR^i, {i, 1, retryBudget}];

GoodCommitProbability[qT_, beta_, qR_, retryBudget_Integer?NonNegative] :=
  qT (1 - beta) GeometricFactor[qR, retryBudget];

BadCommitProbability[qB_, alpha_, qR_, retryBudget_Integer?NonNegative] :=
  qB alpha GeometricFactor[qR, retryBudget];

HumanProbability[qT_, qB_, qR_, qH_, alpha_, beta_, retryBudget_Integer?NonNegative] :=
  (qH + qT beta + qB (1 - alpha)) GeometricFactor[qR, retryBudget] +
    qR^(retryBudget + 1);

DuplicateProbability[qR_, eta_, retryBudget_Integer?NonNegative] :=
  eta qR (1 - (qR (1 - eta))^retryBudget)/(1 - qR (1 - eta));

PosteriorReliability[alpha0_, beta0_, successes_, failures_] :=
  (alpha0 + successes)/(alpha0 + beta0 + successes + failures);

VerificationTest[
  FullSimplify[
    GoodCommitProbability[qT, beta, qR, r] +
    BadCommitProbability[qB, alpha, qR, r] +
    HumanProbability[qT, qB, qR, qH, alpha, beta, r],
    Assumptions -> {qT + qB + qR + qH == 1, 0 <= qR < 1, r >= 0,
      Element[r, Integers]}],
  1,
  TestID -> "ProbabilityMassConservation"
]

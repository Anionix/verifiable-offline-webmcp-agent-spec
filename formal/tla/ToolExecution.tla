------------------------------ MODULE ToolExecution ------------------------------
\* information_uuid_v5=3db7326c-bd4a-52a1-abae-3a0bec14c980
\* event_uuid_v7=01a049c4-fd4d-7cdc-bc6d-44f3d59b3efb
\* machine-contract: ambiguous effects reconcile before retry; every reachable effect count is at most one.
EXTENDS Naturals, TLC

CONSTANT MaxRetry

VARIABLES pc, auth, verified, ambiguous, effectCount, retryLeft

vars == <<pc, auth, verified, ambiguous, effectCount, retryLeft>>

States == {
  "PRE", "AUTHORIZED", "EXECUTING", "AMBIGUOUS", "SUCCEEDED", "FAILED",
  "RECONCILING", "VERIFYING", "VERIFIED", "COMMITTED", "DENIED", "EXPIRED"
}

Init ==
  /\ pc = "PRE"
  /\ auth = FALSE
  /\ verified = FALSE
  /\ ambiguous = FALSE
  /\ effectCount = 0
  /\ retryLeft = MaxRetry

Authorize ==
  /\ pc = "PRE"
  /\ pc' = "AUTHORIZED"
  /\ auth' = TRUE
  /\ UNCHANGED <<verified, ambiguous, effectCount, retryLeft>>

Deny ==
  /\ pc = "PRE"
  /\ pc' = "DENIED"
  /\ UNCHANGED <<auth, verified, ambiguous, effectCount, retryLeft>>

StartExecution ==
  /\ pc = "AUTHORIZED"
  /\ auth = TRUE
  /\ pc' = "EXECUTING"
  /\ UNCHANGED <<auth, verified, ambiguous, effectCount, retryLeft>>

ExecutionSuccess ==
  /\ pc = "EXECUTING"
  /\ effectCount = 0
  /\ pc' = "SUCCEEDED"
  /\ effectCount' = 1
  /\ ambiguous' = FALSE
  /\ UNCHANGED <<auth, verified, retryLeft>>

ExecutionFailure ==
  /\ pc = "EXECUTING"
  /\ pc' = "FAILED"
  /\ UNCHANGED <<auth, verified, ambiguous, effectCount, retryLeft>>

ExecutionUnknownNoEffect ==
  /\ pc = "EXECUTING"
  /\ effectCount = 0
  /\ pc' = "AMBIGUOUS"
  /\ ambiguous' = TRUE
  /\ UNCHANGED <<auth, verified, effectCount, retryLeft>>

ExecutionUnknownWithEffect ==
  /\ pc = "EXECUTING"
  /\ effectCount = 0
  /\ pc' = "AMBIGUOUS"
  /\ ambiguous' = TRUE
  /\ effectCount' = 1
  /\ UNCHANGED <<auth, verified, retryLeft>>

BeginReconcile ==
  /\ pc = "AMBIGUOUS"
  /\ pc' = "RECONCILING"
  /\ UNCHANGED <<auth, verified, ambiguous, effectCount, retryLeft>>

ReconcileEffectFound ==
  /\ pc = "RECONCILING"
  /\ effectCount = 1
  /\ pc' = "SUCCEEDED"
  /\ ambiguous' = FALSE
  /\ UNCHANGED <<auth, verified, effectCount, retryLeft>>

ReconcileNoEffect ==
  /\ pc = "RECONCILING"
  /\ effectCount = 0
  /\ pc' = "FAILED"
  /\ ambiguous' = FALSE
  /\ UNCHANGED <<auth, verified, effectCount, retryLeft>>

Retry ==
  /\ pc = "FAILED"
  /\ auth = TRUE
  /\ effectCount = 0
  /\ retryLeft > 0
  /\ pc' = "AUTHORIZED"
  /\ retryLeft' = retryLeft - 1
  /\ UNCHANGED <<auth, verified, ambiguous, effectCount>>

BeginVerify ==
  /\ pc = "SUCCEEDED"
  /\ pc' = "VERIFYING"
  /\ UNCHANGED <<auth, verified, ambiguous, effectCount, retryLeft>>

Verify ==
  /\ pc = "VERIFYING"
  /\ effectCount = 1
  /\ pc' = "VERIFIED"
  /\ verified' = TRUE
  /\ UNCHANGED <<auth, ambiguous, effectCount, retryLeft>>

Commit ==
  /\ pc = "VERIFIED"
  /\ verified = TRUE
  /\ pc' = "COMMITTED"
  /\ UNCHANGED <<auth, verified, ambiguous, effectCount, retryLeft>>

Expire ==
  /\ pc = "AUTHORIZED"
  /\ pc' = "EXPIRED"
  /\ UNCHANGED <<auth, verified, ambiguous, effectCount, retryLeft>>

Next ==
  \/ Authorize \/ Deny \/ StartExecution \/ ExecutionSuccess \/ ExecutionFailure
  \/ ExecutionUnknownNoEffect \/ ExecutionUnknownWithEffect \/ BeginReconcile
  \/ ReconcileEffectFound \/ ReconcileNoEffect \/ Retry \/ BeginVerify \/ Verify
  \/ Commit \/ Expire

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ pc \in States
  /\ auth \in BOOLEAN
  /\ verified \in BOOLEAN
  /\ ambiguous \in BOOLEAN
  /\ effectCount \in 0..1
  /\ retryLeft \in 0..MaxRetry

NoUnauthorizedExecution == pc = "EXECUTING" => auth
NoDoubleEffect == effectCount <= 1
NoCommitWithoutVerification == pc = "COMMITTED" => verified
NoAmbiguousRetry == ambiguous => ~(pc = "AUTHORIZED" \/ pc = "EXECUTING")
EffectRequiresAuthorization == effectCount > 0 => auth

=============================================================================

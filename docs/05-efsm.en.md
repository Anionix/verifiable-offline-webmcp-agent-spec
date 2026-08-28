---
title: "Execution EFSM"
language: "en"
stable_uuid_v5: "65ea9b0f-fe9c-59ff-b4de-f6780b0abded"
event_uuid_v7: "01a04291-b460-76e8-a698-54048f3d1b68"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Execution EFSM

The normal path is `PRE → AUTHORIZED → EXECUTING → SUCCEEDED → VERIFYING → VERIFIED → COMMITTED`. An unknown effect follows `AMBIGUOUS → RECONCILING`; it never mutates again before the effect is established.

`SUCCEEDED ≠ VERIFIED`, commit implies verification, and one intent has at most one active attempt. Every autonomous cycle decreases `ρ=retryLeft+verifyLeft+reconcileLeft`, preventing infinite autonomous loops.

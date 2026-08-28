---
title: "Tool Contract"
language: "en"
stable_uuid_v5: "56a08869-b16a-5a1a-a43a-4eab64ea45d4"
event_uuid_v7: "01a04291-b45c-7061-8064-a342b2e7a2ef"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Tool Contract

\[
\tau_j=\langle I_j,P_j,T_j,Q_j,C_j,R_j,E_j,Recovery_j,Audit_j\rangle
\]

A contract fixes schemas, preconditions, transition semantics, postconditions, costs, risk, evidence, recovery, and audit policy. `FAILED` and `AMBIGUOUS` are deliberately distinct: an unknown external effect is reconciled before any mutating retry.

Offline policy is class-specific: reads cache, reversible writes queue, messages remain drafts, financial/destructive operations store intent only, and identity mutation is not replayed automatically.

See [`schemas/tool-contract.schema.json`](../schemas/tool-contract.schema.json) and [`examples/`](../examples/).

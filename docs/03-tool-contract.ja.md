---
title: "Tool Contract"
language: "ja"
stable_uuid_v5: "893e4945-a54b-5f4f-bc35-21900c06d200"
event_uuid_v7: "01a04291-b45b-7fa0-ad62-b73e1ff8b471"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Tool Contract

\[
\tau_j=\langle I_j,P_j,T_j,Q_j,C_j,R_j,E_j,Recovery_j,Audit_j\rangle
\]

| 項 | 意味 |
|---|---|
| `I` | input/output schema |
| `P` | preconditions |
| `T` | state transition |
| `Q` | postconditions |
| `C` | latency/cost/energy/privacy |
| `R` | expected harm/tail risk |
| `E` | verification evidence |
| `Recovery` | reconcile/rollback |
| `Audit` | logging/redaction/provenance |

クラス別offline policy:

| class | offline |
|---|---|
| read | CACHE |
| reversible write | QUEUE |
| messaging | DRAFT |
| destructive | INTENT_ONLY |
| financial | INTENT_ONLY |
| identity mutation | NO_REPLAY |

`FAILED` と `AMBIGUOUS` は別物。timeoutで効果の有無が不明なら、retryではなくreconcileへ進みます。

machine-readable schemaは [`schemas/tool-contract.schema.json`](../schemas/tool-contract.schema.json)、具体例は [`examples/`](../examples/) です。

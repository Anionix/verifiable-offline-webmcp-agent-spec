---
title: "実行EFSM"
language: "ja"
stable_uuid_v5: "877ad626-7a24-5b04-9132-9270f1bb8665"
event_uuid_v7: "01a04291-b45f-7df7-bbf4-f36794939cf5"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# 実行EFSM

正常path:

```text
PRE → AUTHORIZED → EXECUTING → SUCCEEDED → VERIFYING → VERIFIED → COMMITTED
```

不確実path:

```text
EXECUTING → AMBIGUOUS → RECONCILING → SUCCEEDED | FAILED | HUMAN
```

主要不変条件:

\[
SUCCEEDED\ne VERIFIED
\]

\[
COMMITTED\Rightarrow VERIFIED
\]

\[
AMBIGUOUS\Rightarrow\neg MutatingRetry
\]

\[
ActiveAttemptCount(intentID)\le1
\]

自動cycleにはranking function `ρ=retryLeft+verifyLeft+reconcileLeft` を持たせ、各cycleで必ず減少させます。

図: [`diagrams/efsm.mmd`](../diagrams/efsm.mmd)

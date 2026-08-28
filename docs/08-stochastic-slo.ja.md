---
title: "確率SLO最適化"
language: "ja"
stable_uuid_v5: "b3f72359-43a1-5224-a0cd-40c227b8b26d"
event_uuid_v7: "01a04291-b465-7faa-8a4e-7d2647deead6"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# 確率SLO最適化

1 attemptの結果を`true candidate / bad candidate / safe retry / human`へ分けます。

\[
q_T+q_B+q_R+q_H=1
\]

\[
G_R=\frac{1-q_R^{R+1}}{1-q_R}
\]

\[
P_{good}=q_T(1-\beta)G_R
\]

\[
P_{bad}=q_B\alpha G_R
\]

\[
P_H=[q_H+q_T\beta+q_B(1-\alpha)]G_R+q_R^{R+1}
\]

最適化変数は`θ, retryBudget, verifyBudget, remotePlannerRate`。bad commit、duplicate、latency、energy、privacy、API costをhard constraintにし、その内側でresource objectiveを最小化します。

[`data/slo-parameters.sample.json`](../data/slo-parameters.sample.json) は説明用synthetic値で、production観測値ではありません。

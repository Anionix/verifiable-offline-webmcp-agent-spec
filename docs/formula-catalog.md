---
title: "Formula Catalog / 数式カタログ"
language: "ja-en"
stable_uuid_v5: "65108dcd-6e06-51e4-a4f1-f6fb59d79cbb"
event_uuid_v7: "01a04291-b474-7aea-b2c7-246e809882fa"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Formula Catalog / 数式カタログ

Machine-readable form: [`knowledge/formulas.json`](../knowledge/formulas.json). Wolfram checks: [`formal/wolfram/verification-report.json`](../formal/wolfram/verification-report.json).

| ID | 日本語 / English | Formula | Kind | Primary sources |
|---|---|---|---|---|
| F-001 | システム構成 / System composition | `$\mathrm{System}=\mathrm{StateEstimation}+\mathrm{ToolObservation}+\mathrm{ConstrainedPlanning}+\mathrm{WebMCPExecution}+\mathrm{Verification}+\mathrm{OfflineQueue}+\mathrm{Synchronization}` | definition | SRC-POMDP-1998, SRC-CMDP-1999, SRC-WEBMCP-2026 |
| F-002 | 制約付きPOMDP / Constrained POMDP | `$\mathcal{M}=\langle S,O,B,A,T,Z,R,C,\gamma\rangle` | model | SRC-POMDP-1998, SRC-CMDP-1999 |
| F-003 | 状態ベクトル / State vector | `$x_t=(g_t,w_t,d_t,n_t,b_t,q_t,r_t,p_t,h_t,\mathcal{T}_t,v_t)` | definition | SRC-POMDP-1998 |
| F-004 | 重み付き進捗 / Weighted progress | `$\mathrm{Progress}_t=\frac{\sum_k w_k g_{k,t}}{\sum_k w_k}` | derived | design-derived |
| F-005 | ツール実行可能性 / Tool feasibility | `$\mathrm{Feasible}_j= A_jS_jO_jP_jN_jD_jV_j` | policy | SRC-WEBMCP-2026, SRC-MCP-2026 |
| F-006 | 実行可能行動集合 / Feasible action set | `$A_t^+=\{a_j\mid \mathrm{Feasible}_j(t)=1\}` | definition | SRC-CMDP-1999 |
| F-007 | WebMCPからplannerへの射影 / Projection from WebMCP to planner | `$\Phi(\tau_j)=(name_j,description_j,schema_j)` | design | SRC-WEBMCP-2026, SRC-OPENAI-RESPONSES-2025 |
| F-008 | planner効用 / Planner utility | `$U_m=w_QQ_m-w_LL_m-w_CC_m-w_EE_m-w_RR_m-w_PP_m` | utility | SRC-CMDP-1999 |
| F-009 | planner選択 / Planner selection | `$m^*=\arg\max_{m\in\mathcal{P}_t^+} U_m` | optimization | SRC-CMDP-1999 |
| F-010 | remote planner損益分岐 / Remote planner break-even | `$Q_R>Q_L+\frac{w_L(L_R-L_L)+w_C(C_R-C_L)+w_E(E_R-E_L)+w_R(R_R-R_L)+w_P(P_R-P_L)}{w_Q}` | derived | SRC-CMDP-1999 |
| F-011 | オフラインhard gate / Offline hard gate | `$online=0\Rightarrow \mathrm{Feasible}_{Responses}=0` | invariant | SRC-OPENAI-RUNTIME-2026 |
| F-012 | remote遅延 / Remote latency | `$L_R=RTT+\frac{B_\uparrow}{BW_\uparrow}+L_{API}+L_{planning}+L_{tool}+\frac{B_\downarrow}{BW_\downarrow}` | cost-model | design-derived |
| F-013 | APIコスト / API cost | `$Cost_R=N_{in}p_{in}+N_{out}p_{out}+\sum_j c_j^{tool}` | cost-model | SRC-OPENAI-RESPONSES-2025 |
| F-014 | Beta事後平均 / Beta posterior mean | `$\widehat r_j=\frac{\alpha_0+s_j}{\alpha_0+\beta_0+s_j+f_j}` | statistical | design-derived |
| F-015 | 鮮度減衰 / Freshness decay | `$Freshness_i(t)=e^{-\lambda_i(t-t_i)},\quad \lambda_i=\frac{\ln 2}{h_i}` | statistical | design-derived |
| F-016 | belief更新 / Belief update | `$b_{t+1}(s\prime)=\eta Z(o_{t+1}\mid s\prime,a_t)\sum_s T(s\prime\mid s,a_t)b_t(s)` | probability | SRC-POMDP-1998 |
| F-017 | 期待損失 / Expected harm | `$H(a)=\sum_k p_k(a)s_k(a)` | risk | SRC-CMDP-1999 |
| F-018 | privacyコスト / Privacy cost | `$PrivacyCost(a)=\sum_i sensitivity_i\,x_i` | risk | SRC-WEBMCP-2026 |
| F-019 | DAG準備条件 / DAG readiness | `$Ready(v_i)=\mathbf{1}[\forall v_j\in Pred(v_i):status(v_j)=done]\cdot Precondition(v_i)` | planning | design-derived |
| F-020 | 並列独立条件 / Parallel independence | `$W_i\cap W_j=\varnothing\land W_i\cap R_j=\varnothing\land W_j\cap R_i=\varnothing` | concurrency | SRC-OPENAI-RUNTIME-2026 |
| F-021 | queue replay条件 / Queue replay condition | `$Replay_i=Online\cdot NotExpired_i\cdot Preconditions_i\cdot VersionCompatible_i\cdot ConsentValid_i` | policy | design-derived |
| F-022 | Littleの法則 / Little's Law | `$L=\lambda W` | queueing | SRC-LITTLE-1961 |
| F-023 | CRDT merge / CRDT merge | `$S_{merged}=S_{local}\sqcup S_{remote},\quad a\sqcup b=b\sqcup a,\;(a\sqcup b)\sqcup c=a\sqcup(b\sqcup c),\;a\sqcup a=a` | distributed | SRC-CRDT-2011 |
| F-024 | 実行後検証 / Post-execution verification | `$V=SchemaValid\cdot PostCondition\cdot EffectObserved\cdot ForbiddenEffectAbsent` | policy | SRC-WEBMCP-2026 |
| F-025 | 情報価値 / Expected value of information | `$EVI(a)=\mathbb{E}[V(b_{t+1})\mid a]-V(b_t)-Cost(a)` | decision | SRC-POMDP-1998 |
| F-026 | 棄却条件 / Abstention condition | `$\max_{a\in A_t^+}U(a)\le U_\bot\Rightarrow ABSTAIN` | decision | SRC-CHOW-1970 |
| F-027 | 完了条件 / Completion condition | `$DONE=GoalSatisfied\land Verified\land Confidence\ge\theta_C\land Risk\le\theta_R\land RequiredQueue=\varnothing` | invariant | design-derived |
| F-028 | 全体目的関数 / Global objective | `$\max_\pi\mathbb{E}_\pi\left[\sum_{t=0}^T\gamma^t(R_t-\lambda_LL_t-\lambda_CC_t-\lambda_EE_t-\lambda_RH_t-\lambda_PP_t)\right]` | optimization | SRC-CMDP-1999 |
| F-101 | Tool Contract 7項組 / Seven-part Tool Contract | `$\tau_j=\langle I_j,P_j,T_j,Q_j,C_j,R_j,E_j\rangle` | definition | SRC-JSONSCHEMA-2020-12, SRC-WEBMCP-2026 |
| F-102 | 予測成功確率 / Predicted success probability | `$\pi_j=q^{pre}_j r_j q^{env}_j` | statistical | design-derived |
| F-103 | tool expected utility / Tool expected utility | `$EU_j=\pi_jG_j-(1-\pi_j)L_j^F-\kappa_j-\lambda_HH_j` | utility | SRC-CMDP-1999 |
| F-104 | 呼出最低成功確率 / Minimum call success probability | `$\pi_j>\frac{K_j+L_j^F+U_\bot}{G_j+L_j^F}` | derived | SRC-CMDP-1999 |
| F-105 | 証拠尤度比 / Evidence likelihood ratio | `$LR_i=\frac{P(e_i\mid Success)}{P(e_i\mid Failure)}` | statistical | design-derived |
| F-106 | 事後confidence / Posterior confidence | `$Confidence_{post}=\frac{O_0\prod_i LR_i}{1+O_0\prod_i LR_i}` | statistical | design-derived |
| F-107 | commit閾値 / Commit threshold | `$c_j\ge\max\left(\theta_j^{class},1-\frac{B_j}{D_j}\right)` | derived | SRC-CMDP-1999 |
| F-108 | plan成功確率 / Plan success probability | `$P(success_\Pi)=\prod_{j=1}^n\pi_j,\quad \log P(success_\Pi)=\sum_j\log\pi_j` | probability | design-derived |
| F-109 | plan最適化 / Plan optimization | `$\max_{x_j\in\{0,1\}}\sum_jx_jEU_j\;\text{s.t. constraints}` | optimization | SRC-CMDP-1999 |
| F-201 | Canonical IR判定集合 / Canonical IR decision set | `$D=\{ALLOW,DENY,HUMAN,RECONCILE\}` | definition | design-derived |
| F-202 | 整数pre判定 / Integer pre-decision | `$p_{ppm}(G+L)>10^6(K+L+U_0)` | implementation | SRC-RFC7493 |
| F-203 | 整数post判定 / Integer post-decision | `$(10^6-c_{ppm})D\le 10^6B` | implementation | SRC-RFC7493 |
| F-301 | 実行EFSM / Execution EFSM | `$\mathcal{M}_E=\langle Q,\Sigma,X,G,A,\delta,q_0,F\rangle` | formal | SRC-TLA-LAMPORT |
| F-302 | 終了ranking function / Termination ranking function | `$\rho_t=retryLeft_t+verifyLeft_t+reconcileLeft_t,\quad \rho_{t+1}<\rho_t` | liveness | SRC-TLA-LAMPORT |
| F-401 | TLA+仕様 / TLA+ specification | `$Spec=Init\land\Box[Next]_{vars}` | formal | SRC-TLA-LAMPORT |
| F-402 | at-most-once / At-most-once effect | `$\sum_a Effect(intentID,a)\le 1` | safety | SRC-TLA-LAMPORT |
| F-501 | event digest / Event digest | `$d_i=H(0x00\parallel C(E_i^{core}))` | cryptographic | SRC-RFC8785, SRC-FIPS180-4 |
| F-502 | hash chain / Hash chain | `$h_i=H(0x01\parallel h_{i-1}\parallel d_i\parallel Encode(i))` | cryptographic | SRC-FIPS180-4 |
| F-503 | event署名 / Event signature | `$\sigma_i=Sign_{sk}(Domain\parallel logID\parallel deviceID\parallel sequence_i\parallel h_i)` | cryptographic | SRC-RFC8032 |
| F-504 | Merkle tree / Merkle tree | `$Leaf_i=H(0x00\parallel d_i),\quad Node=H(0x01\parallel Left\parallel Right)` | cryptographic | SRC-RFC9162 |
| F-601 | 結果確率分割 / Outcome probability partition | `$q_T+q_B+q_R+q_H=1` | probability | design-derived |
| F-602 | 有限retry幾何級数 / Finite retry geometric series | `$G_R=\sum_{k=0}^Rq_R^k=\frac{1-q_R^{R+1}}{1-q_R}` | probability | design-derived |
| F-603 | 正commit確率 / Good commit probability | `$P_{good}=q_T[1-\beta(\theta,V)]G_R` | probability | design-derived |
| F-604 | 誤commit確率 / Bad commit probability | `$P_{bad}=q_B\alpha(\theta,V)G_R` | probability | design-derived |
| F-605 | 人間退避確率 / Human/non-commit probability | `$P_H=[q_H+q_T\beta+q_B(1-\alpha)]G_R+q_R^{R+1}` | probability | design-derived |
| F-606 | 重複効果確率 / Duplicate-effect probability | `$P_{dup}=\frac{\eta q_R[1-(q_R(1-\eta))^R]}{1-q_R(1-\eta)}` | probability | design-derived |
| F-607 | SLO最適化 / SLO optimization | `$\min_{\theta,R,V,z}J\quad\text{s.t. }P_{good}\ge S_{min},\;P_{bad}\le\epsilon_{bad},\;P_{dup}\le\epsilon_{dup},\;E[T]\le L_{max}` | optimization | SRC-CMDP-1999 |

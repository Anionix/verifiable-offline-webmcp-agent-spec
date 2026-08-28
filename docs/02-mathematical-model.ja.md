---
title: "数理モデル"
language: "ja"
stable_uuid_v5: "f81adabb-fd05-55f8-814c-42b4a3cf8e6c"
event_uuid_v7: "01a04291-b459-73b0-a519-d8ddedada6f2"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# 数理モデル

## 1. 制約付きPOMDP

\[
\mathcal M=\langle S,O,B,A,T,Z,R,C,\gamma\rangle
\]

- `S`: 世界状態
- `O`: 観測
- `B`: belief
- `A`: action
- `T`: transition
- `Z`: observation likelihood
- `R`: reward
- `C`: hard/soft cost constraints
- `γ`: discount

belief update:

\[
b_{t+1}(s')=\eta Z(o_{t+1}|s',a_t)\sum_sT(s'|s,a_t)b_t(s)
\]

POMDPは部分観測の意思決定、CMDPは制約付き最適化の理論基盤です。 [SRC-POMDP-1998](source-map.md#src-pomdp-1998) [SRC-CMDP-1999](source-map.md#src-cmdp-1999)

## 2. Tool feasibility

\[
F_j=I_j\prod_kG_{jk}
\]

`F_j=0` はscore減点ではなく、候補集合からの除外です。

## 3. Expected utility

\[
EU_j=p_jG_j-(1-p_j)L_j-K_j
\]

\[
p_j(G_j+L_j)>K_j+L_j+U_0
\]

整数PPM実装:

\[
p_{ppm}(G+L)>10^6(K+L+U_0)
\]

## 4. Commit threshold

\[
(1-c)D\le B
\]

\[
c\ge1-\frac BD
\]

productionでは除算せず、

\[
(10^6-c_{ppm})D\le10^6B
\]

を評価します。

## 5. 証拠更新

\[
LR_i=\frac{P(e_i|Success)}{P(e_i|Failure)}
\]

\[
O_{post}=O_0\prod_iLR_i,\qquad c=\frac{O_{post}}{1+O_{post}}
\]

## 6. Queueと信頼性

\[
L=\lambda W
\]

\[
\hat r_j=\frac{\alpha_j+s_j}{\alpha_j+\beta_j+s_j+f_j}
\]

## 7. SLO合成

\[
q_T+q_B+q_R+q_H=1
\]

\[
G_R=\frac{1-q_R^{R+1}}{1-q_R}
\]

\[
P_{good}=q_T(1-\beta)G_R,\quad P_{bad}=q_B\alpha G_R
\]

Wolfram検算結果は [`formal/wolfram/verification-report.json`](../formal/wolfram/verification-report.json) に固定しています。

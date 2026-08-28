---
title: "設計仕様書 — 日本語"
language: "ja"
stable_uuid_v5: "234187bd-093b-547c-8116-c4bb3a98eef0"
event_uuid_v7: "01a04291-b455-7450-bc60-f09765c842eb"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# 設計仕様書 — 日本語

## 1. 文書の地位

本書は実装可能な設計仕様 v0.1.0 である。英語規範文、machine-readable JSON、JSON Schema、TypeScript reference、Wolfram reference、TLA+ modelを同じ意味へ揃える。WebMCPは2026-08-26時点でCommunity Group DraftでありW3C標準ではないため、直接依存をadapterへ隔離する。[SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)

規範語は `MUST / MUST NOT / SHOULD / SHOULD NOT / MAY` を用いる。完全な要件表は [`requirement-catalog.md`](requirement-catalog.md)。

## 2. 設計目標

1. **Offline-first:** network unavailableでもcapture、local planning、draft、queue、auditを継続する。
2. **WebMCP-first action:** 構造化toolが存在する場合、曖昧な画面クリックを優先しない。
3. **Planner without authority:** Responses APIやlocal LLMはcandidate planを生成するが、権限を生成しない。
4. **Evidence before commit:** toolの成功返答を現実の成功と同一視しない。
5. **Formal safety:** 危険状態を「避ける」のではなく遷移関係から除去する。
6. **Tamper evidence:** 後からeventを差し替えるとhash chain、signature、Merkle rootで検出できる。
7. **Machine readability:** claim、formula、requirement、source、decision、timelineをJSON/JSON-LDで提供する。
8. **Bilingual clarity:** 日本語と英語を併記し、machine-readable recordで意味を固定する。

## 3. 非目標

- LLMを認可serviceとして扱わない。
- WebMCP draftを安定標準と仮定しない。
- cryptographic logだけで物理的真実を証明したとは主張しない。
- CRDTで支払い、送信、削除等の非可換副作用をmergeしない。
- sample SLO値をproduction SLAとして扱わない。

## 4. システム境界

### 4.1 actor

- **User:** 最終authority。critical actionのmandateまたは個別approvalを与える。
- **Local Planner:** offline/low-cost candidate plan。
- **Responses Bridge:** feasible toolのschemaだけをremote plannerへ射影する。
- **Tool Contract Engine:** decision authority。
- **WebMCP Adapter/Executor:** browser内tool discovery/execution。
- **Evidence Engine:** read-back、receipt、state diff、schema validation。
- **Audit/Sync:** signed device chain、global ingestion、Merkle checkpoint。

### 4.2 trust order


authorityの優先順は次で固定する。


a. User mandate / explicit approval  
 b. Policy and verified state  
 c. Tool Contract  
 d. Cryptographically bound evidence  
 e. Planner proposal  
 f. Tool output / page observation / untrusted content

形式的には、

\[
Authority_{t+1}\subseteq Authority_t\cup NewExplicitHumanGrant_t
\]

LLM出力だけでauthorityが増える遷移は存在してはならない。

## 5. Identifierとtime model

### 5.1 UUIDv5

長期安定するentity IDは、root namespaceとcanonical pathから生成する。

\[
StableID(x)=UUIDv5(NS_{root},canonicalPath(x))
\]

同じ入力は同じIDになる。source、claim、formula、requirement、component、file、tool contractへ使う。UUIDv5はsecurity tokenではない。[SRC-RFC9562](source-map.md#src-rfc9562)

### 5.2 UUIDv7

event、metric、build activityはUUIDv7を使う。先頭48bitのUnix epoch millisecondsを `eventEpochMs` と一致させる。単一millisecond内はmonotonic counter/random fieldで順序性を補う。[SRC-RFC9562](source-map.md#src-rfc9562)

### 5.3 時刻

すべての規範eventは次を持つ。

```json
{
  "eventTime": "2026-08-27T10:17:17.000Z",
  "eventEpochMs": 1787825837000,
  "timeZone": "UTC",
  "localTimeZone": "Asia/Tokyo"
}
```

因果順序はtimestampだけで決めない。`previousEventHash`、`deviceSequence`、`globalSequence`、causal referenceを使う。[SRC-RFC3339](source-map.md#src-rfc3339) [SRC-PROVO-2013](source-map.md#src-provo-2013)

## 6. 数理モデル

### 6.1 制約付きPOMDP

\[
\mathcal M=\langle S,O,B,A,T,Z,R,C,\gamma\rangle
\]

真の世界状態は完全観測できないため、履歴をbeliefへ圧縮する。

\[
b_{t+1}(s')=\eta Z(o_{t+1}\mid s',a_t)\sum_sT(s'\mid s,a_t)b_t(s)
\]

ただし安全制約はutilityへsoft penaltyとして混ぜず、hard gateとして行動集合から除去する。[SRC-POMDP-1998](source-map.md#src-pomdp-1998) [SRC-CMDP-1999](source-map.md#src-cmdp-1999)

### 6.2 状態

\[
x_t=(g_t,w_t,d_t,n_t,b_t,q_t,r_t,p_t,h_t,\mathcal T_t,v_t)
\]

- `g`: goal progress
- `w`: external world
- `d`: local device/database/cache/UI
- `n`: network state
- `b`: battery/CPU/RAM/storage/thermal
- `q`: offline queue
- `r`: risk
- `p`: permission/consent
- `h`: history/evidence
- `T`: discovered WebMCP tools
- `v`: versions/checkpoints

### 6.3 Tool feasibility

\[
Feasible_j=A_jS_jO_jP_jN_jD_jV_j
\]

各項は0/1で、active document、schema、origin、permission、network、dependency、preconditionを表す。

\[
A_t^+=\{a_j\mid Feasible_j(t)=1\}
\]

**マジで大事:** 0になったtoolは「scoreを下げる」のではなく、plannerへ見せない。

### 6.4 Planner utility

\[
U_m=w_QQ_m-w_LL_m-w_CC_m-w_EE_m-w_RR_m-w_PP_m
\]

\[
m^*=\arg\max_{m\in\mathcal P_t^+}U_m
\]

offlineならResponsesは効用が低いのではなく、

\[
online=0\Rightarrow Feasible_{Responses}=0
\]

となる。

### 6.5 Tool Contract

\[
\tau_j=\langle I_j,P_j,T_j,Q_j,C_j,R_j,E_j\rangle
\]

- `I`: input/output schema
- `P`: preconditions
- `T`: state transition
- `Q`: postconditions
- `C`: latency/money/energy/privacy/token cost
- `R`: expected harm/tail risk
- `E`: evidence model

成功予測は、

\[
\pi_j=q_j^{pre}r_jq_j^{env}
\]

expected utilityは、

\[
EU_j=\pi_jG_j-(1-\pi_j)L_j^F-K_j
\]

call thresholdは、

\[
\pi_j>\frac{K_j+L_j^F+U_\bot}{G_j+L_j^F}
\]

production実装はfloat divisionを避け、PPM整数で交差積比較する。

\[
p_{ppm}(G+L)>10^6(K+L+U_0)
\]

Wolfram検算結果は [`formal/wolfram/verification-report.json`](../formal/wolfram/verification-report.json)。

### 6.6 Verification

証拠のlikelihood ratioを、

\[
LR_i=\frac{P(e_i\mid Success)}{P(e_i\mid Failure)}
\]

prior oddsを `O0` として、

\[
Confidence_{post}=\frac{O_0\prod_iLR_i}{1+O_0\prod_iLR_i}
\]

commit thresholdは、

\[
c\ge\max\left(\theta_{class},1-\frac{B}{D}\right)
\]

整数比較は、

\[
(10^6-c_{ppm})D\le10^6B
\]

とする。

## 7. WebMCPとResponses APIの結合

WebMCP descriptorからplannerへ渡すのは、`name`、`description`、`inputSchema`等の必要部分だけ。`execute` capabilityと秘密情報は渡さない。

\[
\Phi(\tau_j)=(name_j,description_j,schema_j)
\]

Responses APIはcandidate `toolName,args`を返せるが、実行前にCanonical IRへ正規化し、Policy Engineで再判定する。OpenAIの公式runtime説明も、model proposalとruntime executionを分けている。[SRC-OPENAI-RUNTIME-2026](source-map.md#src-openai-runtime-2026)

WebMCP草案はtool poisoning、output injection、intent misrepresentation、over-parameterizationをリスクとして扱うため、description/output/page observationはすべてtainted dataとする。[SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)

## 8. Canonical IR

判定集合は、

\[
D=\{ALLOW,DENY,HUMAN,RECONCILE\}
\]

評価順序は、

`hard DENY > RECONCILE > HUMAN > utility DENY > ALLOW`

とする。missing security fieldはfalseへ推測せずDENY。

```text
if any hard gate fails → DENY
else if previous effect is ambiguous → RECONCILE
else if human is required → HUMAN
else if expected utility threshold fails → DENY
else → ALLOW
```

TypeScriptとWolframは同じIRへ同じdecisionを返す必要がある。golden vectorは [`data/golden-vectors.json`](../data/golden-vectors.json)。

## 9. EFSM

主要状態:

`PRE → HUMAN_PENDING/AUTHORIZED → QUEUED/EXECUTING → AMBIGUOUS/SUCCEEDED/FAILED → RECONCILING/VERIFYING → VERIFIED → COMMITTED`

terminalは `COMMITTED, ROLLED_BACK, DENIED, CANCELLED, EXPIRED`。

### 9.1 不変条件

\[
\Box(EXECUTING\Rightarrow AuthorizationValid)
\]

\[
\Box(COMMITTED\Rightarrow VERIFIED)
\]

\[
\Box(AMBIGUOUS\Rightarrow\neg MutatingRetry)
\]

\[
\sum_aEffect(intentID,a)\le1
\]

### 9.2 timeout

`Timeout`は`Failure`ではない。server側で効果が発生した可能性が残る場合は`AMBIGUOUS`。

```text
AMBIGUOUS → RECONCILING → effect found / no effect proven / HUMAN
```

### 9.3 termination

\[
\rho=retryLeft+verifyLeft+reconcileLeft
\]

全autonomous cycleで `ρ' < ρ` を要求する。外部event待ちのHUMAN/QUEUEDにはexpiry/fairness assumptionを置く。

## 10. TLA+ safety model

規範behaviorは、

\[
Spec=Init\land\Box[Next]_{vars}
\]

で定義する。検査するinvariant:

1. `NoUnauthorizedExecution`
2. `NoDoubleEffect`
3. `NoCommitWithoutVerification`
4. `NoAmbiguousRetry`
5. `EffectRequiresAuthorization`
6. `TerminalIsAbsorbing`

`formal/tla/ToolExecution.tla`が規範model。`formal/model-checker/reachability.py`は独立した有限全探索reference。mutation modeではguardを壊し、counterexampleが出ることも検査する。[SRC-TLA-LAMPORT](source-map.md#src-tla-lamport)

## 11. Offline queueとsync

### 11.1 queue record

queueは実行済みoperationではなく、未実行intentを保持する。

```json
{
  "intentId": "uuidv5",
  "eventId": "uuidv7",
  "toolId": "account.update_address",
  "normalizedArgs": {},
  "baseVersion": 17,
  "ttlSeconds": 86400,
  "externalEffectStarted": false
}
```

replay条件:

\[
Replay=Online\cdot NotExpired\cdot Auth\cdot Permission\cdot VersionCompatible\cdot ConsentValid\cdot Preconditions
\]

### 11.2 CRDT scope

CRDT mergeは、tag、set、counter、draft metadata等の可換状態へ限定する。支払い、送信、予約、削除は`CONFLICT/HUMAN`へ送る。[SRC-CRDT-2011](source-map.md#src-crdt-2011)

### 11.3 queue SLO

長期安定には `λ < μ` を目標とし、

\[
L=\lambda W
\]

でqueue length、arrival rate、waiting timeの整合性を監視する。[SRC-LITTLE-1961](source-map.md#src-little-1961)

## 12. Event sourcingと暗号学的監査

### 12.1 event record

現在状態はevent streamのprojection。

\[
S_n=Fold(Apply,S_0,[E_1,\ldots,E_n])
\]

snapshotはcacheで、event logがsource record。

### 12.2 canonical digest

\[
d_i=H(0x00\parallel C(E_i^{core}))
\]

`C`はJCSまたは本repoの整数/文字列/boolean/null限定subset。[SRC-RFC8785](source-map.md#src-rfc8785)

### 12.3 hash chain

\[
h_i=H(0x01\parallel h_{i-1}\parallel d_i\parallel Encode(i))
\]

v0.1の`H`はSHA-256。[SRC-FIPS180-4](source-map.md#src-fips180-4)

### 12.4 signature

\[
\sigma_i=Sign_{sk}(Domain\parallel logID\parallel deviceID\parallel sequence_i\parallel h_i)
\]

v0.1はEd25519。private keyはOS key store/Secure Enclave内で保持しplanner contextへ出さない。[SRC-RFC8032](source-map.md#src-rfc8032)

### 12.5 Merkle checkpoint

\[
Leaf=H(0x00\parallel d_i),\quad Node=H(0x01\parallel Left\parallel Right)
\]

batch root、tree size、chain headをsigned checkpointにしてdevice外へanchorする。inclusion/consistency proofを提供する。[SRC-RFC9162](source-map.md#src-rfc9162)

### 12.6 truth limitation

署名logが証明するのは「誰が何を記録し、どの順序でbindしたか」。toolが嘘を返した場合、logは嘘が記録されたことしか証明しない。だからIndependent Evidenceが必要。

## 13. Stochastic SLO optimizer

1回の実行結果:

\[
q_T+q_B+q_R+q_H=1
\]

retry budget `R` に対する有限幾何級数:

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

\[
P_{dup}=\frac{\eta q_R[1-(q_R(1-\eta))^R]}{1-q_R(1-\eta)}
\]

最適化:

\[
\min_{\theta,R,V,z}J
\]

subject to:

- `P_good ≥ S_min`
- `P_bad ≤ ε_bad`
- `P_dup ≤ ε_dup`
- `E[T] ≤ L_max`
- `E[Energy] ≤ E_max`
- `E[Cost] ≤ C_max`

sampleは [`data/slo-parameters.sample.json`](../data/slo-parameters.sample.json) にあり、明示的にsyntheticである。

## 14. Security / privacy controls

- tool description、output、page observationをtainted dataとして扱う。
- `untrustedContentHint`はsignalであり、唯一のtrust判定にしない。
- source origin、tool reliability、policy class、permission scopeを組み合わせる。
- private key、access token、passwordはplannerへ渡さない。
- sensitive payloadは別encrypted blobへ置き、audit logにはdigest/referenceだけを残す。
- planner capabilityはexecutor capabilityのsubset。
- critical commit toolはplannerへ直接公開しない。
- approval後にargs/contentが変わればapproval invalid。

## 15. API境界

Policy Engine APIは、

- `POST /v1/evaluate/pre`
- `POST /v1/evaluate/post`
- `POST /v1/reconcile`
- `POST /v1/audit/events`

を持つ。OpenAPI定義は [`api/policy-engine.openapi.yaml`](../api/policy-engine.openapi.yaml)。

## 16. 実装順

1. Canonical IRとJSON Schema
2. TypeScript evaluatorとgolden vectors
3. WebMCP adapter
4. EFSM runtime
5. offline queue/replay
6. Evidence Engine
7. signed event log/checkpoint
8. Responses bridge
9. TLA+/mutation model
10. telemetryとSLO optimizer

## 17. Acceptance criteria

- `make validate`が成功する。
- JSON/NDJSON/YAMLがparseできる。
- UUIDv5/v7とUUIDv7 timestampが検証できる。
- TypeScriptとPython/Wolfram referenceがgolden vectorで一致する。
- hash chain、Ed25519 signature、Merkle root/inclusion proofが検証できる。
- finite state searchで安全違反0、normal COMMIT reachable。
- mutation testがcounterexampleを検出する。
- source/claim/formula/requirement cross-referenceが欠損しない。

## 18. まとめ

> **盛らずに言うと:** LLMの賢さを上げても、権限・副作用・事実確認・監査の責任は消えない。だから、賢さはplannerへ閉じ込め、決定・実行・検証・記録を別レイヤーで固定する。これが本設計の本質。

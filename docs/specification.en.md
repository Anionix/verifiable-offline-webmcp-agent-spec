---
title: "Design Specification — English"
language: "en"
stable_uuid_v5: "1c7335ed-8f3a-5fb8-8867-a3d00f54d7ad"
event_uuid_v7: "01a04291-b456-7906-ad6f-caff84d65e57"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Design Specification — English

## 1. Status

This is an implementable v0.1.0 design specification. Normative English, machine-readable JSON, JSON Schema, TypeScript, Wolfram, and TLA+ artifacts are intended to denote the same system. WebMCP is a Community Group Draft rather than a W3C Standard, so all direct API dependency is isolated behind an adapter. [SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)

## 2. Core rule

> **No hype:** intelligence remains inside planning. Authority, execution, verification, and audit are separate systems.

`LLM proposes → Policy permits → WebMCP executes → Evidence verifies → Events record → Cryptography binds`.

## 3. Goals

- retain a useful local core while offline;
- use structured WebMCP tools as the preferred action space;
- make the Responses API an optional online planner;
- enforce hard gates before utility optimization;
- treat UNKNOWN/timeout as ambiguous until reconciled;
- require independent evidence before commit;
- make key unsafe states unreachable in the formal model;
- produce a machine-readable bilingual knowledge package.

## 4. Identifier and temporal model

Stable entities use UUIDv5:

\[
StableID(x)=UUIDv5(NS_{root},canonicalPath(x))
\]

Events and observations use UUIDv7 and carry matching Unix epoch milliseconds. Normative timestamps use RFC 3339 UTC, while causal order is represented by sequence and hash references. [SRC-RFC9562](source-map.md#src-rfc9562) [SRC-RFC3339](source-map.md#src-rfc3339)

## 5. Constrained partially observable model

\[
\mathcal M=\langle S,O,B,A,T,Z,R,C,\gamma\rangle
\]

\[
b_{t+1}(s')=\eta Z(o_{t+1}\mid s',a_t)\sum_sT(s'\mid s,a_t)b_t(s)
\]

Hard safety and authorization constraints remove actions from the feasible set; they are not mere utility penalties. [SRC-POMDP-1998](source-map.md#src-pomdp-1998) [SRC-CMDP-1999](source-map.md#src-cmdp-1999)

## 6. Tool space and planner selection

\[
Feasible_j=A_jS_jO_jP_jN_jD_jV_j
\]

\[
A_t^+=\{a_j\mid Feasible_j(t)=1\}
\]

Only feasible tools are projected to a planner. WebMCP is the capability/action substrate; the Responses API is a policy proposal optimizer available only when its hard availability gate passes.

\[
U_m=w_QQ_m-w_LL_m-w_CC_m-w_EE_m-w_RR_m-w_PP_m
\]

\[
m^*=\arg\max_{m\in\mathcal P_t^+}U_m
\]

## 7. Tool Contract and Canonical IR

Each tool has:

\[
\tau_j=\langle I_j,P_j,T_j,Q_j,C_j,R_j,E_j\rangle
\]

The decision set is:

\[
D=\{ALLOW,DENY,HUMAN,RECONCILE\}
\]

Decision precedence is fixed: hard DENY, RECONCILE, HUMAN, utility DENY, ALLOW.

The call threshold is:

\[
\pi_j>\frac{K_j+L_j^F+U_\bot}{G_j+L_j^F}
\]

Production code uses integer cross multiplication:

\[
p_{ppm}(G+L)>10^6(K+L+U_0)
\]

The commit threshold is:

\[
c\ge\max\left(\theta_{class},1-\frac{B}{D}\right)
\]

## 8. Execution state machine

The success path is:

`PRE → AUTHORIZED → EXECUTING → SUCCEEDED → VERIFYING → VERIFIED → COMMITTED`.

Unknown outcomes take:

`EXECUTING → AMBIGUOUS → RECONCILING → SUCCEEDED/FAILED/HUMAN`.

Required invariants include:

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

The TLA+ behavior specification is `Spec = Init ∧ □[Next]_vars`. See [`formal/tla/ToolExecution.tla`](../formal/tla/ToolExecution.tla). [SRC-TLA-LAMPORT](source-map.md#src-tla-lamport)

## 9. Offline and synchronization

The queue stores unexecuted intent. Before replay, the system revalidates authorization, permission, version, consent, TTL, and preconditions. Per-device signed chains preserve local causal order; a sync server adds a global ingestion sequence.

CRDT merge is limited to commutative/idempotent data. Payments, sends, reservations, and destructive effects become explicit conflicts rather than merged state. [SRC-CRDT-2011](source-map.md#src-crdt-2011)

Queue SLOs track `L = λW`. [SRC-LITTLE-1961](source-map.md#src-little-1961)

## 10. Evidence and audit

A tool's success response is a claim, not sufficient proof. Independent evidence includes read-back, receipts, state diffs, version changes, and external observations.

Events are canonicalized, hashed, chained, and signed:

\[
d_i=H(0x00\parallel C(E_i^{core}))
\]

\[
h_i=H(0x01\parallel h_{i-1}\parallel d_i\parallel Encode(i))
\]

\[
\sigma_i=Sign_{sk}(Domain\parallel logID\parallel deviceID\parallel sequence_i\parallel h_i)
\]

JCS, SHA-256, Ed25519, and RFC 9162-style Merkle roots are used in v0.1. [SRC-RFC8785](source-map.md#src-rfc8785) [SRC-FIPS180-4](source-map.md#src-fips180-4) [SRC-RFC8032](source-map.md#src-rfc8032) [SRC-RFC9162](source-map.md#src-rfc9162)

## 11. Stochastic SLO model

\[
q_T+q_B+q_R+q_H=1
\]

\[
G_R=\frac{1-q_R^{R+1}}{1-q_R}
\]

\[
P_{good}=q_T(1-\beta)G_R,\quad P_{bad}=q_B\alpha G_R
\]

\[
P_H=[q_H+q_T\beta+q_B(1-\alpha)]G_R+q_R^{R+1}
\]

Threshold, retry budget, verification budget, and remote-planner rate are optimized subject to hard constraints on bad commits, duplicate effects, latency, energy, privacy, and cost. Sample values are synthetic.

## 12. Security boundaries

- planner output cannot create authority;
- planner capability is a subset of executor capability;
- secrets never enter planner context;
- tool/page content is tainted input;
- critical commit tools remain inside the policy boundary;
- approval is bound to normalized intent and invalidated by changes;
- the audit log stores digests/references rather than unnecessary personal data.

## 13. Acceptance

`make validate` must parse and cross-check all structured assets, run TypeScript vectors, verify UUIDs, verify the signed hash chain and Merkle checkpoint, and execute the independent finite-state reachability and mutation tests.

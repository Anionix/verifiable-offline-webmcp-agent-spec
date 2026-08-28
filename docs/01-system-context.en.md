---
title: "System Context and Responsibility Boundaries"
language: "en"
stable_uuid_v5: "48a6be26-33c0-5c14-9d15-3de43ce6f58a"
event_uuid_v7: "01a04291-b458-7e6f-b956-cabd13f230d6"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# System Context and Responsibility Boundaries

## 1. Goal

The system keeps core mobile work available offline, adds higher-capability reasoning only when online, and subjects every external side effect to computable authorization, verification, and provenance.

The essential move is separation of duties: an impressive planner is not a safe authority boundary.

| Layer | Responsibility | Authority |
|---|---|---|
| User / Mandate | Goal, scope, approval | Root of authority |
| Planner | Candidate plan | Cannot create authority |
| Tool Contract Engine | Hard gates, utility, risk | Execution decision authority |
| EFSM | Legal state transitions | Transition authority |
| WebMCP Adapter | Discover and execute structured tools | Approved effects only |
| Evidence Engine | Verify physical/external effect | Produces commit evidence |
| Audit Log | Signed history | Provenance |
| Sync Server | Verify and merge offline chains | Global ingestion order |
| Responses API | Online candidate planner | Optional planning only |

## 2. Trust boundary

Tool/page output, model output, and remote content are proposals or data. They do not amplify privilege.

\[
Authority_{t+1}\subseteq Authority_t\cup ExplicitHumanGrant_t
\]

Critical commit tools stay inside the policy boundary; a planner receives prepare/review capabilities only.

## 3. End-to-end flow

1. Normalize user intent; assign UUIDv5 for semantic identity and UUIDv7 for occurrence order.
2. Observe local state, network, battery, and the tool registry.
3. Remove infeasible tools.
4. Select rule/local/Responses/human planning.
5. Evaluate `ALLOW / DENY / HUMAN / RECONCILE`.
6. Only `ALLOW` reaches WebMCP execution.
7. Verify the effect with independent evidence and read-back.
8. The EFSM permits `COMMITTED` only after `VERIFIED`.
9. Canonicalize, hash, chain, and sign every event.
10. Offline mode stores unexecuted intent and revalidates every guard on replay.

WebMCP is isolated behind an adapter because it is a Community Group draft, not a W3C Standard. [SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)

Responses is an online planning option; authorization and actual execution remain in the runtime/policy boundary. [SRC-OPENAI-RESPONSES-2025](source-map.md#src-openai-responses-2025) [SRC-OPENAI-RUNTIME-2026](source-map.md#src-openai-runtime-2026)

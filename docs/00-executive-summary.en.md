---
title: "Executive Summary"
language: "en"
stable_uuid_v5: "684a45b6-64f3-572e-a889-a492e91db135"
event_uuid_v7: "01a04291-b454-7670-88f5-9562ad815914"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Executive Summary

## 5W1H

- **Who:** user, local planner, Responses API, Policy Engine, WebMCP tools, Evidence Engine, and audit services.
- **What:** safely plan, execute, verify, synchronize, and audit user intent.
- **When:** online and offline, especially during disconnection, timeout, and resynchronization.
- **Where:** on-device, in the browser/WebMCP boundary, remote planning, sync services, and external checkpoints.
- **Why:** an LLM's textual confidence cannot establish authority, side-effect uniqueness, or real-world truth.
- **How:** hard gates, expected utility, EFSM/TLA+, independent evidence, signed event logs, and constrained SLO optimization.

> **Seriously important:** “The tool returned success” is not the same as “the real-world effect was verified.” `SUCCEEDED != VERIFIED`.

The core flow is:

`Discover → Contract → Filter → Plan → Authorize → Execute → Reconcile if ambiguous → Verify → Commit → Audit → Optimize`.

Non-negotiable properties:

- unauthorized execution is unreachable;
- one intent produces at most one external economic effect;
- AMBIGUOUS never directly retries a mutation;
- COMMITTED is reachable only through VERIFIED;
- LLM output, tool output, and page content cannot amplify authority;
- queued offline work is unexecuted intent and is revalidated before replay.

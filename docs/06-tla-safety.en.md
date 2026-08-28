---
title: "TLA+ Safety Specification"
language: "en"
stable_uuid_v5: "785e299e-050d-505f-b6eb-4fad0d54d39d"
event_uuid_v7: "01a04291-b462-7838-a550-cb8f81f87cad"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# TLA+ Safety Specification

\[
Spec=Init\land\Box[Next]_{vars}
\]

The model checks that unauthorized execution, double effect, commit bypass, and ambiguous retry are unreachable while a valid commit remains reachable. [`formal/tla/ToolExecution.tla`](../formal/tla/ToolExecution.tla) is normative. The bundled independent Python explorer and mutation tests exercise the same finite abstraction. [SRC-TLA-LAMPORT](source-map.md#src-tla-lamport)

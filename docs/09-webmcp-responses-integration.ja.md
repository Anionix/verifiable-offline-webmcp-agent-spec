---
title: "WebMCP × Responses統合"
language: "ja"
stable_uuid_v5: "e2d66eda-4eda-5fc4-b6f0-7d3e858ffad4"
event_uuid_v7: "01a04291-b467-7723-8055-9ee6a6c7c0f3"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# WebMCP × Responses統合

## 原則

\[
WebMCP=Capability/ExecutionInterface
\]

\[
Responses=OptionalCandidatePlanner
\]

WebMCP toolからplannerへ渡すのは`name/description/inputSchema`等の必要最小限。`execute`、secret、critical commit authorityは渡しません。

\[
PlannerCapability\subset ExecutorCapability
\]

remote plannerの利用条件:

\[
Online\land EU_{remote}>\max(EU_{local},EU_{rule})
\]

WebMCPはdraftなのでadapterへ隔離し、仕様変更時のblast radiusを狭めます。 [SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)

Responses APIとremote MCPの位置づけはOpenAIの一次資料に紐づけます。 [SRC-OPENAI-RESPONSES-2025](source-map.md#src-openai-responses-2025) [SRC-OPENAI-MCP-2025](source-map.md#src-openai-mcp-2025)

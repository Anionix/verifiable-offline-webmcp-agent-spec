---
title: "WebMCP × Responses統合"
language: "ja"
stable_uuid_v5: "e2d66eda-4eda-5fc4-b6f0-7d3e858ffad4"
event_uuid_v7: "01a04291-b467-7723-8055-9ee6a6c7c0f3"
updated_event_uuid_v7: "01a04904-ca98-7443-8568-48507dc9a6cd"
generated_at: "2026-08-27T09:34:00Z"
updated_at: "2026-08-28T15:37:25.912Z"
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

WebMCPは草案なので専用アダプターへ隔離し、仕様変更の影響範囲を狭めます。`document.modelContext`と`registerTool()`へ触れるのは通知用アダプターだけで、通知エンジンはWebMCPの形を知りません。 [SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)

ローカル通知デモの入力境界は、[`15-webmcp-input-boundary.ja.md`](15-webmcp-input-boundary.ja.md)で具体化します。`inputSchema`だけを信用せず、WebMCP呼び出しとlocalhost APIが同じ厳格な投影器を使い、乾式実行までで止めます。

入力の経路、信頼状態、生成元、未信頼内容の印は、呼び出し側の値ではなくサーバー経路から生成し、SQLiteと監査記録から読み戻します。専用アダプターと来歴契約は[`16-webmcp-provenance-adapter.ja.md`](16-webmcp-provenance-adapter.ja.md)を正本とします。

Responses APIとremote MCPの位置づけはOpenAIの一次資料に紐づけます。 [SRC-OPENAI-RESPONSES-2025](source-map.md#src-openai-responses-2025) [SRC-OPENAI-MCP-2025](source-map.md#src-openai-mcp-2025)

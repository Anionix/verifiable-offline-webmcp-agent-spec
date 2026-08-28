---
title: "Normative Requirement Catalog / 規範要件カタログ"
language: "ja-en"
stable_uuid_v5: "1b8f414f-c8ab-5678-92cf-1e5a7105bef2"
event_uuid_v7: "01a04291-b475-7307-949f-6dc7a1b34db2"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Normative Requirement Catalog / 規範要件カタログ

Machine-readable form: [`knowledge/requirements.json`](../knowledge/requirements.json).

| ID | Level | 日本語 | English | Sources | Tests |
|---|---|---|---|---|---|
| REQ-ID-001 | **MUST** | すべての知識エンティティはcanonical nameとroot namespaceからUUIDv5を持たなければならない。 | Every knowledge entity MUST have a UUIDv5 derived from its canonical name and the root namespace. | SRC-RFC9562 | TEST-ID-001 |
| REQ-ID-002 | **MUST** | すべてのイベントはevent timeを反映するUUIDv7を持たなければならない。 | Every event MUST have a UUIDv7 reflecting its event time. | SRC-RFC9562 | TEST-ID-002 |
| REQ-ID-003 | **MUST NOT** | UUIDを認可tokenまたは秘密として扱ってはならない。 | UUIDs MUST NOT be treated as authorization tokens or secrets. | SRC-RFC9562 | TEST-SEC-001 |
| REQ-TIME-001 | **MUST** | 規範時刻はRFC 3339 UTC文字列とepoch_msの両方で保存しなければならない。 | Normative time MUST be stored as both an RFC 3339 UTC string and epoch_ms. | SRC-RFC3339, SRC-RFC7493 | TEST-TIME-001 |
| REQ-TIME-002 | **MUST** | 因果順序はhash referenceとsequenceで表し、wall-clockだけに依存してはならない。 | Causal order MUST be represented by hash references and sequence numbers, not wall-clock time alone. | SRC-PROVO-2013, SRC-RFC9162 | TEST-AUDIT-004 |
| REQ-DATA-001 | **MUST** | Canonical IR、Tool Contract、Audit EventはJSON Schemaで検証されなければならない。 | Canonical IR, Tool Contract, and Audit Event MUST be validated with JSON Schema. | SRC-JSONSCHEMA-2020-12 | TEST-SCHEMA-001 |
| REQ-DATA-002 | **MUST** | JSONはRFC 8259に適合し、duplicate keyを生成してはならない。 | JSON MUST conform to RFC 8259 and MUST NOT contain duplicate object member names. | SRC-RFC8259, SRC-RFC7493 | TEST-SCHEMA-002 |
| REQ-DATA-003 | **MUST** | 金額、PPM、sequence、epoch_msなど判定に使う値は整数で表さなければならない。 | Decision-critical values such as money, PPM, sequence, and epoch_ms MUST be integers. | SRC-RFC7493 | TEST-IR-001 |
| REQ-KNOW-001 | **SHOULD** | 知識エンティティはJSON-LD graphとしてリンク可能であるべきである。 | Knowledge entities SHOULD be linkable as a JSON-LD graph. | SRC-JSONLD-2020 | TEST-KNOW-001 |
| REQ-KNOW-002 | **MUST** | claim、formula、requirement、decisionは生成activityとsource provenanceを記録しなければならない。 | Claims, formulas, requirements, and decisions MUST record generation activity and source provenance. | SRC-PROVO-2013 | TEST-KNOW-002 |
| REQ-KNOW-003 | **SHOULD** | distributionとmanifestはDCAT/SPDX風metadataで発見可能にすべきである。 | Distributions and manifests SHOULD be discoverable with DCAT/SPDX-style metadata. | SRC-DCAT3-2024 | TEST-KNOW-003 |
| REQ-WEBMCP-001 | **MUST** | WebMCPのdraft APIは専用adapterに隔離しなければならない。 | The draft WebMCP API MUST be isolated behind a dedicated adapter. | SRC-WEBMCP-2026 | TEST-ARCH-001 |
| REQ-WEBMCP-002 | **MUST** | plannerへ公開する前にtool discoveryとcontract lookupを実行しなければならない。 | Tool discovery and contract lookup MUST occur before tools are exposed to a planner. | SRC-WEBMCP-2026 | TEST-ARCH-002 |
| REQ-WEBMCP-003 | **MUST** | hard gateに失敗したtoolはplannerの候補集合から除外しなければならない。 | A tool that fails a hard gate MUST be removed from the planner candidate set. | SRC-WEBMCP-2026, SRC-MCP-2026 | TEST-POLICY-001 |
| REQ-MCP-001 | **MUST** | MCP経由のtoolでもhost policyとuser consentを迂回してはならない。 | Tools reached through MCP MUST NOT bypass host policy or user consent. | SRC-MCP-2026 | TEST-SEC-002 |
| REQ-PLAN-001 | **MUST** | Responses APIはoptional plannerであり、system availabilityの単一障害点にしてはならない。 | The Responses API MUST be an optional planner and MUST NOT be a single point of system availability. | SRC-OPENAI-RESPONSES-2025 | TEST-OFFLINE-001 |
| REQ-PLAN-002 | **MUST** | remote MCPまたはResponses tool exposureはfeasible toolだけに限定しなければならない。 | Remote MCP or Responses tool exposure MUST be limited to feasible tools. | SRC-OPENAI-MCP-2025, SRC-MCP-2026 | TEST-POLICY-002 |
| REQ-PLAN-003 | **MUST** | planner出力はcandidate proposalであり、authorizationを生成してはならない。 | Planner output MUST be treated as a candidate proposal and MUST NOT create authorization. | SRC-OPENAI-RUNTIME-2026 | TEST-SEC-003 |
| REQ-TOOL-001 | **MUST** | 各toolはinput、precondition、transition、postcondition、cost、risk、evidenceのcontractを持たなければならない。 | Each tool MUST have a contract covering input, preconditions, transition, postconditions, cost, risk, and evidence. | SRC-JSONSCHEMA-2020-12, SRC-WEBMCP-2026 | TEST-CONTRACT-001 |
| REQ-TOOL-002 | **MUST** | mutation toolはdeclared read setとwrite setを持たなければならない。 | Mutation tools MUST declare read and write sets. | SRC-TLA-LAMPORT | TEST-CONTRACT-002 |
| REQ-TOOL-003 | **SHOULD** | 観測可能なwriteはread-backでpostconditionを確認すべきである。 | Observable writes SHOULD verify postconditions by read-back. | SRC-WEBMCP-2026 | TEST-VERIFY-001 |
| REQ-POLICY-001 | **MUST** | policy decisionはALLOW、DENY、HUMAN、RECONCILEのいずれかでなければならない。 | A policy decision MUST be one of ALLOW, DENY, HUMAN, or RECONCILE. | SRC-TLA-LAMPORT | TEST-IR-002 |
| REQ-POLICY-002 | **MUST** | 判定優先順位はhard DENY、RECONCILE、HUMAN、utility DENY、ALLOWの順でなければならない。 | Decision precedence MUST be hard DENY, RECONCILE, HUMAN, utility DENY, then ALLOW. | SRC-TLA-LAMPORT | TEST-POLICY-003 |
| REQ-POLICY-003 | **MUST** | TypeScriptとWolfram referenceは同じCanonical IRへ同じ判定を返さなければならない。 | TypeScript and the Wolfram reference MUST return the same decision for the same Canonical IR. | SRC-TLA-LAMPORT | TEST-CONFORMANCE-001 |
| REQ-POLICY-004 | **MUST** | commit thresholdはrisk class floorとexpected-loss thresholdの最大値でなければならない。 | The commit threshold MUST be the maximum of the risk-class floor and expected-loss threshold. | SRC-CMDP-1999 | TEST-POLICY-004 |
| REQ-POLICY-005 | **MUST** | remote plannerへ送るデータは必要品質を満たす最小十分集合にしなければならない。 | Data sent to a remote planner MUST be the minimum sufficient set that meets required quality. | SRC-WEBMCP-2026 | TEST-PRIVACY-001 |
| REQ-POLICY-006 | **MUST** | financial、destructive、identity mutationは有効なmandateがない限りHUMANでなければならない。 | Financial, destructive, and identity mutation actions MUST be HUMAN unless covered by a valid mandate. | SRC-MCP-2026 | TEST-CRITICAL-001 |
| REQ-POLICY-007 | **MUST** | approvalはtool、normalized args、target、amount/content digest、expiryにbindされなければならない。 | Approval MUST be bound to tool, normalized arguments, target, amount/content digest, and expiry. | SRC-RFC8785, SRC-RFC8032 | TEST-AUTH-001 |
| REQ-POLICY-008 | **MUST** | LLM、tool output、web contentだけでauthorityを増加させてはならない。 | Authority MUST NOT increase solely because of LLM output, tool output, or web content. | SRC-WEBMCP-2026, SRC-TLA-LAMPORT | TEST-SEC-004 |
| REQ-POLICY-009 | **MUST** | 最大効用がreject utility以下ならABSTAIN/HUMANを選ばなければならない。 | When maximum utility is no greater than reject utility, the system MUST choose ABSTAIN/HUMAN. | SRC-CHOW-1970 | TEST-POLICY-005 |
| REQ-EXEC-001 | **MUST** | EXECUTING状態へ入るには有効なauthorizationが必要である。 | Entering EXECUTING MUST require valid authorization. | SRC-TLA-LAMPORT | TEST-MODEL-001 |
| REQ-EXEC-002 | **MUST** | AMBIGUOUS状態からmutation retryへ直接遷移してはならない。 | AMBIGUOUS MUST NOT transition directly to a mutating retry. | SRC-TLA-LAMPORT | TEST-MODEL-002 |
| REQ-EXEC-003 | **MUST** | 同一intentの外部economic effectは高々1回でなければならない。 | An external economic effect for the same intent MUST occur at most once. | SRC-TLA-LAMPORT | TEST-MODEL-003 |
| REQ-EXEC-004 | **MUST** | COMMITTEDへ到達する前にVERIFIEDを通過しなければならない。 | The system MUST pass through VERIFIED before reaching COMMITTED. | SRC-TLA-LAMPORT | TEST-MODEL-004 |
| REQ-EXEC-005 | **MUST** | autonomous retry、verify、reconcileのcycleではranking functionが減少しなければならない。 | The ranking function MUST decrease on autonomous retry, verification, and reconciliation cycles. | SRC-TLA-LAMPORT | TEST-MODEL-005 |
| REQ-OFFLINE-001 | **MUST** | network unavailable時にResponsesを候補から除外し、core local workflowを維持しなければならない。 | When the network is unavailable, Responses MUST be removed from candidates and the local core workflow preserved. | SRC-OPENAI-RUNTIME-2026 | TEST-OFFLINE-001 |
| REQ-OFFLINE-002 | **MUST** | offline queueは未実行intentを保存し、外部効果を開始してはならない。 | The offline queue MUST store unexecuted intent and MUST NOT start an external effect. | SRC-TLA-LAMPORT | TEST-OFFLINE-002 |
| REQ-OFFLINE-003 | **MUST** | replay前にauthorization、permission、version、consent、TTL、preconditionを再評価しなければならない。 | Authorization, permission, version, consent, TTL, and preconditions MUST be re-evaluated before replay. | SRC-MCP-2026 | TEST-OFFLINE-003 |
| REQ-SYNC-001 | **MUST** | 各deviceはoffline中に独立したsigned sequenceを維持しなければならない。 | Each device MUST maintain an independent signed sequence while offline. | SRC-RFC8032, SRC-RFC9562 | TEST-SYNC-001 |
| REQ-SYNC-002 | **MUST** | server取り込み時にdevice sequenceを保持したままglobal sequenceを追加しなければならない。 | Server ingestion MUST preserve device sequence while adding a global sequence. | SRC-PROVO-2013 | TEST-SYNC-002 |
| REQ-SYNC-003 | **MUST** | CRDT mergeは可換で冪等な状態へ限定しなければならない。 | CRDT merge MUST be limited to commutative, idempotent state. | SRC-CRDT-2011 | TEST-SYNC-003 |
| REQ-SYNC-004 | **MUST NOT** | 支払い、送信、削除、予約など非可換副作用をCRDT mergeしてはならない。 | Payments, sends, deletions, reservations, and other non-commutative effects MUST NOT be CRDT-merged. | SRC-CRDT-2011 | TEST-SYNC-004 |
| REQ-SYNC-005 | **SHOULD** | 長期運用では平均処理率μが平均流入率λを上回るようcapacity planningすべきである。 | Long-run capacity planning SHOULD keep average service rate μ above average arrival rate λ. | SRC-LITTLE-1961 | TEST-SLO-001 |
| REQ-SYNC-006 | **MUST** | queue length、arrival rate、waiting timeを計測しL=λW整合性を監視しなければならない。 | Queue length, arrival rate, and waiting time MUST be measured and monitored for consistency with L = λW. | SRC-LITTLE-1961 | TEST-SLO-002 |
| REQ-SEC-001 | **MUST** | untrusted tool outputをinstructionではなくdataとして扱わなければならない。 | Untrusted tool output MUST be treated as data, not instruction. | SRC-WEBMCP-2026 | TEST-SEC-005 |
| REQ-SEC-002 | **MUST** | private key、access token、passwordをplanner contextへ渡してはならない。 | Private keys, access tokens, and passwords MUST NOT enter planner context. | SRC-MCP-2026, SRC-RFC8032 | TEST-SEC-006 |
| REQ-SEC-003 | **MUST** | source trust、origin、untrusted annotationをtaint metadataとして伝播しなければならない。 | Source trust, origin, and untrusted annotations MUST propagate as taint metadata. | SRC-WEBMCP-2026 | TEST-SEC-007 |
| REQ-SEC-004 | **MUST** | planner capabilityはexecutor capabilityの真部分集合または等しい集合でなければならない。 | Planner capability MUST be a subset of executor capability. | SRC-MCP-2026 | TEST-SEC-008 |
| REQ-SEC-005 | **SHOULD** | critical commit toolはplannerへ直接公開せず、policy engine内に保持すべきである。 | Critical commit tools SHOULD remain inside the policy engine rather than being directly exposed to a planner. | SRC-MCP-2026 | TEST-CRITICAL-002 |
| REQ-SEC-006 | **MUST** | audit logにsecretまたは不要なpersonal dataを直接保存してはならない。 | The audit log MUST NOT directly store secrets or unnecessary personal data. | SRC-PROVO-2013 | TEST-PRIVACY-002 |
| REQ-SEC-007 | **MUST** | WebMCP draft versionをmetadataへ記録し、互換性testをCIで実行しなければならない。 | The WebMCP draft version MUST be recorded in metadata and compatibility tests run in CI. | SRC-WEBMCP-2026 | TEST-ARCH-003 |
| REQ-SEC-008 | **MUST** | tool description、tool output、page observationをprompt injectionの可能性がある入力として扱わなければならない。 | Tool descriptions, tool outputs, and page observations MUST be treated as potentially prompt-injected inputs. | SRC-WEBMCP-2026 | TEST-SEC-009 |
| REQ-VERIFY-001 | **MUST** | 外部副作用のcommitはtool自己申告だけでなく独立観測またはreceiptを必要とする。 | Committing an external side effect MUST require independent observation or a receipt, not only the tool self-report. | SRC-PROVO-2013 | TEST-VERIFY-002 |
| REQ-VERIFY-002 | **SHOULD** | confidenceはvalidation dataで校正し、LLMの自己申告confidenceを使うべきではない。 | Confidence SHOULD be calibrated on validation data and SHOULD NOT rely on an LLM self-report. | SRC-CHOW-1970 | TEST-SLO-003 |
| REQ-AUDIT-001 | **MUST** | 署名・hash対象eventはJCSまたは互換な限定subsetでcanonicalizeしなければならない。 | Events used for signatures and hashes MUST be canonicalized with JCS or a compatible restricted subset. | SRC-RFC8785, SRC-RFC7493 | TEST-AUDIT-001 |
| REQ-AUDIT-002 | **MUST** | event digestとchain hashには承認済みhash algorithmを使わなければならない。v0.1はSHA-256とする。 | Event digests and chain hashes MUST use an approved hash algorithm; v0.1 uses SHA-256. | SRC-FIPS180-4 | TEST-AUDIT-002 |
| REQ-AUDIT-003 | **MUST** | device eventとcheckpointはkey identifier付きEd25519署名でbindしなければならない。 | Device events and checkpoints MUST be bound with Ed25519 signatures carrying a key identifier. | SRC-RFC8032 | TEST-AUDIT-003 |
| REQ-AUDIT-004 | **SHOULD** | event batchはMerkle rootへ集約しsigned checkpointを外部保存すべきである。 | Event batches SHOULD be aggregated into a Merkle root and an externally stored signed checkpoint. | SRC-RFC9162 | TEST-AUDIT-004 |
| REQ-AUDIT-005 | **SHOULD** | 重要eventについて全logを開示せずinclusion proofを生成できるべきである。 | The system SHOULD generate inclusion proofs for important events without disclosing the full log. | SRC-RFC9162 | TEST-AUDIT-005 |
| REQ-AUDIT-006 | **MUST** | AUTHORIZE、EXECUTE、VERIFY、COMMITは同一intent digestを参照しなければならない。 | AUTHORIZE, EXECUTE, VERIFY, and COMMIT MUST reference the same intent digest. | SRC-RFC8785, SRC-PROVO-2013 | TEST-AUDIT-006 |
| REQ-AUDIT-007 | **MUST** | authorization時のpolicyとTool Contractのdigestをeventへ記録しなければならない。 | The event MUST record digests of the policy and Tool Contract used at authorization time. | SRC-PROVO-2013 | TEST-AUDIT-007 |
| REQ-AUDIT-008 | **MUST** | 同じevent streamから同じstate projectionを再構築できなければならない。 | The same event stream MUST reconstruct the same state projection. | SRC-TLA-LAMPORT | TEST-AUDIT-008 |
| REQ-AUDIT-009 | **MUST** | snapshotはevent logの派生cacheとして扱い、hash anchorを持たなければならない。 | A snapshot MUST be treated as a derived cache and carry a hash anchor to the event log. | SRC-PROVO-2013 | TEST-AUDIT-009 |
| REQ-AUDIT-010 | **MUST** | 記録されたclaimと独立に観測されたtruth estimateを区別しなければならない。 | The system MUST distinguish a recorded claim from an independently observed truth estimate. | SRC-PROVO-2013 | TEST-VERIFY-003 |
| REQ-FORMAL-001 | **MUST** | 未承認実行、二重効果、未検証commit、ambiguous retryをTLA+ invariantとして定義しなければならない。 | Unauthorized execution, double effects, unverified commit, and ambiguous retry MUST be defined as TLA+ invariants. | SRC-TLA-LAMPORT | TEST-MODEL-ALL |
| REQ-FORMAL-002 | **MUST** | 各安全guardを意図的に破壊したmutation modelがcounterexampleを生成することを確認しなければならない。 | A mutation model that deliberately breaks each safety guard MUST produce a counterexample. | SRC-TLA-LAMPORT | TEST-MODEL-MUTATION |
| REQ-SLO-001 | **MUST** | qT、qB、qR、qHは非負で合計1でなければならない。 | qT, qB, qR, and qH MUST be nonnegative and sum to one. | SRC-CMDP-1999 | TEST-SLO-004 |
| REQ-SLO-002 | **MUST** | P_badとP_dupは目的関数のpenaltyではなくhard chance constraintで制御しなければならない。 | P_bad and P_dup MUST be controlled as hard chance constraints, not only objective penalties. | SRC-CMDP-1999 | TEST-SLO-005 |
| REQ-SLO-003 | **MUST** | sample SLO parameterとruntime metricはsynthetic/illustrativeであることを明示しなければならない。 | Sample SLO parameters and runtime metrics MUST be labeled synthetic/illustrative. | SRC-CMDP-1999 | TEST-SLO-006 |

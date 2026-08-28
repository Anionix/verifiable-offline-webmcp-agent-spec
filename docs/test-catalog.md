---
title: "Verification Test Catalog / 検証テスト台帳"
language: "ja-en"
stable_uuid_v5: "aaa566c6-2347-563d-810f-75d5eac39489"
event_uuid_v7: "01a04291-c2e0-7d98-bf15-0be303646458"
updated_event_uuid_v7: "01a048e2-e264-7ed5-a64b-2f3ef202ffe7"
provenance_event_uuid_v7: "01a04904-ca95-7468-9bd0-cb597093a64a"
offline_sync_event_uuid_v7: "01a04927-4698-7f6a-b5e9-ef8bd558913c"
online_planner_event_uuid_v7: "01a04948-c160-7283-a380-4f7db4ccb041"
security_boundary_event_uuid_v7: "01a04967-af58-7fee-af26-3701238950ec"
replay_verification_event_uuid_v7: "01a0497e-f947-7442-b95c-2eed7476e477"
slo_gate_event_uuid_v7: "01a049ad-1379-780b-9344-3df2682e855c"
final_verification_event_uuid_v7: "01a049d1-b7e1-7443-a30b-4620165c8b17"
generated_at: "2026-08-27T09:34:04.000Z"
updated_at: "2026-08-28T18:41:14.617Z"
version: "0.1.0"
status: "design-specification"
---

# Verification Test Catalog / 検証テスト台帳

**Total / 合計:** 67 tests — implemented 67 / automated 67 / partially implemented 0 / specified 0. Machine-readable authority: [`knowledge/tests.json`](../knowledge/tests.json). The governance boundary now covers discovery, contract lookup, approval binding, signed mandates, host policy, consent, secret rejection, capability narrowing, untrusted-data handling, six fresh replay checks, independent readback, claim-versus-truth separation, and six hard operational-quality gates. The final verifier also requires every declared automation artifact to exist and independently matches the Python and TLA+ state counts. The six operational-quality records use deterministic synthetic evidence; production quality remains `UNMEASURED`, while general native WebMCP conformance remains `INCONCLUSIVE`.

| Test ID | Kind | Status | Automated | Requirements |
|---|---|---|---:|---|
| `TEST-ARCH-001` | architecture-requirement-test | implemented | yes | REQ-WEBMCP-001 |
| `TEST-ARCH-002` | architecture-requirement-test | implemented | yes | REQ-WEBMCP-002 |
| `TEST-ARCH-003` | architecture-requirement-test | implemented | yes | REQ-SEC-007 |
| `TEST-AUDIT-001` | cryptographic-audit-verification | implemented | yes | REQ-AUDIT-001 |
| `TEST-AUDIT-002` | cryptographic-audit-verification | implemented | yes | REQ-AUDIT-002 |
| `TEST-AUDIT-003` | cryptographic-audit-verification | implemented | yes | REQ-AUDIT-003 |
| `TEST-AUDIT-004` | cryptographic-audit-verification | implemented | yes | REQ-TIME-002, REQ-AUDIT-004 |
| `TEST-AUDIT-005` | cryptographic-audit-verification | implemented | yes | REQ-AUDIT-005 |
| `TEST-AUDIT-006` | cryptographic-audit-verification | implemented | yes | REQ-AUDIT-006 |
| `TEST-AUDIT-007` | cryptographic-audit-verification | implemented | yes | REQ-AUDIT-007 |
| `TEST-AUDIT-008` | cryptographic-audit-verification | implemented | yes | REQ-AUDIT-008 |
| `TEST-AUDIT-009` | cryptographic-audit-verification | implemented | yes | REQ-AUDIT-009 |
| `TEST-AUTH-001` | security-policy-test | implemented | yes | REQ-POLICY-007 |
| `TEST-CONFORMANCE-001` | decision-conformance-test | implemented | yes | REQ-POLICY-003 |
| `TEST-CONTRACT-001` | tool-contract-test | implemented | yes | REQ-TOOL-001 |
| `TEST-CONTRACT-002` | tool-contract-test | implemented | yes | REQ-TOOL-002 |
| `TEST-CRITICAL-001` | security-policy-test | implemented | yes | REQ-POLICY-006 |
| `TEST-CRITICAL-002` | security-policy-test | implemented | yes | REQ-SEC-005 |
| `TEST-ID-001` | identifier-temporal-validation | implemented | yes | REQ-ID-001 |
| `TEST-ID-002` | identifier-temporal-validation | implemented | yes | REQ-ID-002 |
| `TEST-IR-001` | decision-conformance-test | implemented | yes | REQ-DATA-003 |
| `TEST-IR-002` | decision-conformance-test | implemented | yes | REQ-POLICY-001 |
| `TEST-KNOW-001` | knowledge-graph-integrity-check | implemented | yes | REQ-KNOW-001 |
| `TEST-KNOW-002` | knowledge-graph-integrity-check | implemented | yes | REQ-KNOW-002 |
| `TEST-KNOW-003` | knowledge-graph-integrity-check | implemented | yes | REQ-KNOW-003 |
| `TEST-MODEL-001` | finite-state-model-check | implemented | yes | REQ-EXEC-001 |
| `TEST-MODEL-002` | finite-state-model-check | implemented | yes | REQ-EXEC-002 |
| `TEST-MODEL-003` | finite-state-model-check | implemented | yes | REQ-EXEC-003 |
| `TEST-MODEL-004` | finite-state-model-check | implemented | yes | REQ-EXEC-004 |
| `TEST-MODEL-005` | finite-state-model-check | implemented | yes | REQ-EXEC-005 |
| `TEST-MODEL-ALL` | finite-state-model-check | implemented | yes | REQ-FORMAL-001 |
| `TEST-MODEL-MUTATION` | finite-state-model-check | implemented | yes | REQ-FORMAL-002 |
| `TEST-OFFLINE-001` | offline-sync-scenario-test | implemented | yes | REQ-PLAN-001, REQ-OFFLINE-001 |
| `TEST-OFFLINE-002` | offline-sync-scenario-test | implemented | yes | REQ-OFFLINE-002 |
| `TEST-OFFLINE-003` | offline-sync-scenario-test | implemented | yes | REQ-OFFLINE-003 |
| `TEST-POLICY-001` | decision-conformance-test | implemented | yes | REQ-WEBMCP-003 |
| `TEST-POLICY-002` | decision-conformance-test | implemented | yes | REQ-PLAN-002 |
| `TEST-POLICY-003` | decision-conformance-test | implemented | yes | REQ-POLICY-002 |
| `TEST-POLICY-004` | decision-conformance-test | implemented | yes | REQ-POLICY-004 |
| `TEST-POLICY-005` | decision-conformance-test | implemented | yes | REQ-POLICY-009 |
| `TEST-PRIVACY-001` | security-policy-test | implemented | yes | REQ-POLICY-005 |
| `TEST-PRIVACY-002` | security-policy-test | implemented | yes | REQ-SEC-006 |
| `TEST-SCHEMA-001` | json-schema-validation | implemented | yes | REQ-DATA-001 |
| `TEST-SCHEMA-002` | json-schema-validation | implemented | yes | REQ-DATA-002 |
| `TEST-SEC-001` | security-policy-test | implemented | yes | REQ-ID-003 |
| `TEST-SEC-002` | security-policy-test | implemented | yes | REQ-MCP-001 |
| `TEST-SEC-003` | security-policy-test | implemented | yes | REQ-PLAN-003 |
| `TEST-SEC-004` | security-policy-test | implemented | yes | REQ-POLICY-008 |
| `TEST-SEC-005` | security-policy-test | implemented | yes | REQ-SEC-001 |
| `TEST-SEC-006` | security-policy-test | implemented | yes | REQ-SEC-002 |
| `TEST-SEC-007` | security-policy-test | implemented | yes | REQ-SEC-003 |
| `TEST-SEC-008` | security-policy-test | implemented | yes | REQ-SEC-004 |
| `TEST-SEC-009` | security-policy-test | implemented | yes | REQ-SEC-008 |
| `TEST-SLO-001` | stochastic-mathematical-check | implemented | yes | REQ-SYNC-005 |
| `TEST-SLO-002` | stochastic-mathematical-check | implemented | yes | REQ-SYNC-006 |
| `TEST-SLO-003` | stochastic-mathematical-check | implemented | yes | REQ-VERIFY-002 |
| `TEST-SLO-004` | stochastic-mathematical-check | implemented | yes | REQ-SLO-001 |
| `TEST-SLO-005` | stochastic-mathematical-check | implemented | yes | REQ-SLO-002 |
| `TEST-SLO-006` | stochastic-mathematical-check | implemented | yes | REQ-SLO-003 |
| `TEST-SYNC-001` | offline-sync-scenario-test | implemented | yes | REQ-SYNC-001 |
| `TEST-SYNC-002` | offline-sync-scenario-test | implemented | yes | REQ-SYNC-002 |
| `TEST-SYNC-003` | offline-sync-scenario-test | implemented | yes | REQ-SYNC-003 |
| `TEST-SYNC-004` | offline-sync-scenario-test | implemented | yes | REQ-SYNC-004 |
| `TEST-TIME-001` | identifier-temporal-validation | implemented | yes | REQ-TIME-001 |
| `TEST-VERIFY-001` | evidence-verification-test | implemented | yes | REQ-TOOL-003 |
| `TEST-VERIFY-002` | evidence-verification-test | implemented | yes | REQ-VERIFY-001 |
| `TEST-VERIFY-003` | evidence-verification-test | implemented | yes | REQ-AUDIT-010 |

# Changelog

## 0.2.0-candidate — 2026-08-28

- Added a SQLite-backed notification intent, attempt, and effect ledger with a unique logical-operation constraint.
- Added UUIDv5 intent identity, UUIDv7 transition identity, approval binding, ambiguous-effect reconciliation, and a hash-chained JSON Lines audit log.
- Added simulated failure, response-loss, restart, duplicate-retry, approval-expiry, schema, type, and 100-sample latency checks.
- Added a localhost browser notification demo. A real notification remains gated by immediate user approval, and native WebMCP support remains `INCONCLUSIVE` until observed.
- Split artifact regeneration from read-only validation and pinned Python and Node.js dependencies.

## 0.1.0 — 2026-08-27

- Initial bilingual architecture specification.
- Added source/claim/formula/requirement knowledge graph.
- Added UUIDv5/v7 and RFC 3339 temporal metadata.
- Added JSON Schema, Canonical IR, TypeScript evaluator, Wolfram model, TLA+ model, and independent reachability checker.
- Added signed sample audit chain, Merkle checkpoint, inclusion proof, and tamper report.
- Added stochastic SLO model and synthetic time series.

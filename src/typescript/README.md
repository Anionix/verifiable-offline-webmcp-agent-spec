# TypeScript reference

The reference evaluator uses exact BigInt cross-products at decision boundaries and shares golden vectors with the Python and Wolfram references. The notification candidate uses the Node.js 24 built-in SQLite module and is therefore pinned separately in `.node-version` and `package-lock.json`.

```bash
npm ci
npm test
npm run typecheck
```

## Duplicate-safe notification candidate

`notification/` separates control state from external-effect state, persists intent/attempt/effect rows in SQLite, and appends a SHA-256 hash-chained JSON Lines record for every transition. UUIDv5 identifies the logical notification intent and UUIDv7 identifies each attempt and transition.

```bash
npm run benchmark:notification
npm run demo:notification
```

The simulated adapter never calls an external service. The browser demo is localhost-only and requests a real notification only after an explicit click. `AMBIGUOUS` blocks `execute` and permits `reconcile` only.

## Signed offline synchronization candidate

`sync/` creates per-device Ed25519 chains and signed Merkle checkpoints, then ingests them into a persistent SQLite ledger without changing device-local order. The synchronizer automatically materializes only an add-only tag set. Notification, payment, reservation, and deletion intents become `HUMAN_REVIEW_REQUIRED`; this module has no external-effect executor.

```bash
npm run evidence:sync
npm run demo:sync
```

Evidence generation is an explicit write step. `npm test`, `npm run typecheck`, and repository `make validate` are read-only.

## Optional online planner candidate

`planner/` separates local availability, preflight disclosure, one bounded transport attempt, and an untrusted candidate. The production transport is only an interface; the checked-in evidence uses a scripted local transport and makes no network request. Tool exposure is allowlisted and proposal-only, private fields are removed, unknown pricing stops before transport, and timeout or response loss never retries automatically.

```bash
npm run evidence:planner
npm run demo:planner
```

The demo server is read-only. It serves public evidence, a sanitized request sample, and a hash-chained audit record; it has no model, approval, notification, or mutation route.

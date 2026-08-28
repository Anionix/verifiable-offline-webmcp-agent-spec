# Contributing / コントリビューション

Thank you for improving Verifiable Offline WebMCP Agent Architecture.

## Rules

1. Keep normative machine-readable records in English keys; supply Japanese and English labels/statements.
2. Add or update primary sources in `knowledge/sources.json` and link claims with `source_refs`.
3. Use UUIDv5 for stable semantic identity and UUIDv7 for occurrence/event identity.
4. Update JSON Schema before adding incompatible fields.
5. Add golden vectors for every policy boundary change.
6. Update the TLA+ model and mutation tests when state transitions change.
7. Never commit private keys, access tokens, credentials, or real personal data.
8. Run `make validate` before opening a pull request.

## Commit style

Prefer focused changes such as `spec:`, `schema:`, `formal:`, `security:`, `test:`, or `docs:`.

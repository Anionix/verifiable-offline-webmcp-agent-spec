# Security Policy

## Reporting

Do not open a public issue for a vulnerability that could enable unauthorized execution, duplicate financial/messaging effects, approval forgery, audit-chain compromise, secret exposure, or policy bypass. Use the private security reporting mechanism of the hosting repository.

## Trust model

The repository is a design/reference artifact. Sample public keys, example tool contracts, synthetic SLO data, and example endpoints are not production trust anchors or deployment configuration.

## High-priority findings

- `AMBIGUOUS` can trigger a mutating retry.
- `COMMITTED` can be reached without `VERIFIED`.
- planner output can grant authority or expose a critical commit tool.
- intent-bound approval can be reused for changed arguments.
- event chains can be rewritten without an external checkpoint.
- private key or credential material is present in logs/model context.

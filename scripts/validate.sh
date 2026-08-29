#!/usr/bin/env bash
# information_uuid_v5=2529999d-3fab-525f-ae00-9cf933e597a5
# event_uuid_v7=01a04b41-fd38-75c5-99ac-b6e473f1ea38 state_transition=ONE_HOST_RECEIPT -> PORTABLE_AND_SITES_RECEIPTS occurred_at=2026-08-29T02:03:31.000Z
# information_uuid_v5=bf5f3cfb-4add-5274-bd53-4fe165bfe985
# event_uuid_v7=01a04b93-947d-7143-8e2a-4ef233e51598 state_transition=SOURCE_QUALITY_UNMEASURED -> BOUNDED_SOURCE_QUALITY_GATE occurred_at=2026-08-29T03:32:38.141Z
# machine-contract: the portable client and Sites package must pass independently before repository validation can succeed.
# machine-contract: Oxlint checks hotel JavaScript, Biome checks hotel markup and styles, and Oxfmt checks only the newly governed formatting surface before repository validation proceeds.
# event_uuid_v7=01a04c82-7268-7d00-91c5-62daa23328c state_transition=VOID_STATIC_ADAPTER_STANDALONE -> VOID_STATIC_ADAPTER_IN_FULL_GATE occurred_at=2026-08-29T07:53:32.520Z
# machine-contract: the full repository gate verifies the pinned Void CLI and pre-built dist/client adapter without authenticating, linking a project, or deploying.
# information_uuid_v5=17436d1b-fda6-5147-b5b0-ba04f2465e30
# event_uuid_v7=01a04c9e-a9f3-75f0-ac02-6d9514cfc4b5 state_transition=PYTHON_TYPE_TOOLS_STANDALONE -> PYTHON_TYPE_TOOLS_IN_FULL_GATE occurred_at=2026-08-29T08:24:21.747Z
# machine-contract: both pinned Python type checks and both language-server protocol handshakes must pass before repository validation proceeds.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/.local"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT/.local/uv-cache}"
npm --prefix "$ROOT" run quality:check
uv run --frozen python "$ROOT/scripts/validate_python_type_tools.py"
uv run --frozen python "$ROOT/scripts/validate_repo.py" --report "$ROOT/.local/build-report.json"
node "$ROOT/scripts/build_web_site.mjs"
node "$ROOT/scripts/validate_void_integration.mjs"
node "$ROOT/scripts/validate_hotel_portable_validator.mjs"
node "$ROOT/scripts/validate_hotel_sites_validator.mjs"
node "$ROOT/scripts/validate_service_integrations.mjs"
node "$ROOT/scripts/validate_security_remediation.mjs"
uv run --frozen python "$ROOT/scripts/build_manifest.py" --check

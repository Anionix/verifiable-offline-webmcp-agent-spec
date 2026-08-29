#!/usr/bin/env bash
# information_uuid_v5=2529999d-3fab-525f-ae00-9cf933e597a5
# event_uuid_v7=01a04b41-fd38-75c5-99ac-b6e473f1ea38 state_transition=ONE_HOST_RECEIPT -> PORTABLE_AND_SITES_RECEIPTS occurred_at=2026-08-29T02:03:31.000Z
# machine-contract: the portable client and Sites package must pass independently before repository validation can succeed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/.local"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT/.local/uv-cache}"
uv run --frozen python "$ROOT/scripts/validate_repo.py" --report "$ROOT/.local/build-report.json"
node "$ROOT/scripts/build_web_site.mjs"
node "$ROOT/scripts/validate_hotel_portable_validator.mjs"
node "$ROOT/scripts/validate_hotel_sites_validator.mjs"
node "$ROOT/scripts/validate_service_integrations.mjs"
uv run --frozen python "$ROOT/scripts/build_manifest.py" --check

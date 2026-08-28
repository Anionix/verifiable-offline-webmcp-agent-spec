#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/.local"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$ROOT/.local/uv-cache}"
uv run --frozen python "$ROOT/scripts/validate_repo.py" --report "$ROOT/.local/build-report.json"
node "$ROOT/scripts/build_web_site.mjs"
node "$ROOT/scripts/validate_vercel_site.mjs"
node "$ROOT/scripts/validate_service_integrations.mjs"
uv run --frozen python "$ROOT/scripts/build_manifest.py" --check

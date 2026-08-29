SHELL := /bin/bash
.PHONY: validate regenerate test-ts typecheck typecheck-python validate-python-tools lsp-ty lsp-pyrefly model-check manifest benchmark-notification demo demo-sync demo-planner evidence-sync evidence-planner evidence-slo evidence-final verify-tla

export UV_CACHE_DIR ?= $(CURDIR)/.local/uv-cache

validate:
	bash scripts/validate.sh

regenerate:
	uv run --frozen python scripts/build_manifest.py --write

test-ts:
	cd src/typescript && npm test

typecheck:
	cd src/typescript && npm run typecheck

typecheck-python:
	uv run --frozen ty check
	uv run --frozen pyrefly check --min-severity warn

validate-python-tools:
	uv run --frozen python scripts/validate_python_type_tools.py

lsp-ty:
	uv run --frozen ty server

lsp-pyrefly:
	uv run --frozen pyrefly lsp

model-check:
	uv run --frozen python formal/model-checker/reachability.py

manifest:
	uv run --frozen python scripts/build_manifest.py --write

benchmark-notification:
	cd src/typescript && npm run benchmark:notification -- --samples ../../data/timeseries/notification-demo-latency.ndjson --summary ../../metadata/notification-demo-latency.json

demo:
	cd src/typescript && npm run demo:notification

demo-sync:
	cd src/typescript && npm run demo:sync

evidence-sync:
	cd src/typescript && npm run evidence:sync

demo-planner:
	cd src/typescript && npm run demo:planner

evidence-planner:
	cd src/typescript && npm run evidence:planner

evidence-slo:
	cd src/typescript && npm run evidence:slo

evidence-final:
	uv run --frozen python scripts/final_verification.py --write

verify-tla:
	uv run --frozen python scripts/final_verification.py --check --tla2tools-jar "$(TLA2TOOLS_JAR)"

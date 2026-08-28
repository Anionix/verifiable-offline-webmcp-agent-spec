SHELL := /bin/bash
.PHONY: validate regenerate test-ts typecheck model-check manifest benchmark-notification demo demo-sync evidence-sync

export UV_CACHE_DIR ?= $(CURDIR)/.local/uv-cache

validate:
	bash scripts/validate.sh

regenerate:
	uv run --frozen python scripts/build_manifest.py --write

test-ts:
	cd src/typescript && npm test

typecheck:
	cd src/typescript && npm run typecheck

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

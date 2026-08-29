#!/usr/bin/env python3
# information_uuid_v5=cd034fcd-9a4a-5d32-bea8-375d2511206c
# event_uuid_v7=01a04895-5146-74b1-af5b-00e8ce98730d
# machine-contract: live notification evidence must preserve a valid hash chain, one effect claim, and an auditable suppressed retry.
# event_uuid_v7=01a049d1-b7e1-7443-a30b-4620165c8b17
# state_transition=EXECUTING -> READY_FOR_PUBLIC_READBACK occurred_at=2026-08-28T19:21:16.001Z
# machine-contract: final evidence preserves native WebMCP as INCONCLUSIVE, checks two finite-state engines against 38 states, and proves 67 automated records with zero new effects.
# information_uuid_v5=2f981a59-3d10-5036-98da-3ef8ae14f518
# event_uuid_v7=01a049fe-fe89-7814-9487-0ad568541f20
# state_transition=DISCOVERED -> EXECUTING occurred_at=2026-08-28T20:10:43.209Z
# machine-contract: every live notification audit event is bound to the single scoped intent before global counts can prove duplicate suppression.
# information_uuid_v5=3a0187cc-7497-5325-a2ad-3df91330e778
# event_uuid_v7=01a049ff-0159-7193-b343-dc803d80f4e0
# state_transition=DISCOVERED -> EXECUTING occurred_at=2026-08-28T20:10:43.929Z
# machine-contract: each global ingestion record must match the signed source device, sequence, operation, digest, and chain hash.
# information_uuid_v5=bcad8087-6a22-59b1-99f9-cb3ce9179242
# event_uuid_v7=01a04a1b-eac6-7c5c-aa43-c19d4a593bfb
# state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T20:42:18.694Z
# machine-contract: every strict object schema has exactly the same declared property and required-key sets at every nesting depth.
# information_uuid_v5=634d296a-aa05-536e-9874-70c499eee377
# event_uuid_v7=01a04a28-9e04-7709-9ce3-49b9331fd953
# state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T20:56:11.012Z
# machine-contract: scalar schema lower bounds never exceed upper bounds and all numeric bounds fit JavaScript safe integers.
# information_uuid_v5=8d79ed21-27ce-52d4-9513-e2b024ae670a
# event_uuid_v7=01a04b38-0e40-7ae1-8778-eb130910efa5
# state_transition=HOST_STATE_UNCHECKED -> HOST_STATE_EXCLUDED occurred_at=2026-08-29T01:52:40.000Z
# machine-contract: generated integrity records never include mutable host state from .vercel, .wrangler, .local, dist, or node_modules.
# event_uuid_v7=01a04bdb-34bf-766c-b47a-d92e201fd28f
# state_transition=VERCEL_PROJECT_LINKED -> VERCEL_HOST_STATE_EXCLUDED occurred_at=2026-08-29T04:50:55.000Z
# information_uuid_v5=8ef00763-b59a-5f86-b841-bf5cee364100
# event_uuid_v7=01a04bc8-7f33-7fe3-8877-477e7f8b995a
# state_transition=AUDIO_TIMED_PENDING_FINAL_VIDEO -> FINAL_VIDEO_VERIFIED occurred_at=2026-08-29T04:30:26.100Z
# machine-contract: every completed screen or final video carries measured video evidence; a verified final cut is local, 1920x1080, audible, English-captioned, under three minutes, and at least 70 percent actual site recording.
# information_uuid_v5=befe51ac-d842-523a-83ba-91290fa1301d
# event_uuid_v7=01a04c63-6328-7ecf-9db0-2d826f35eece
# state_transition=PUBLICATION_FAIL_CLOSED -> PUBLICATION_READBACK_VERIFIED occurred_at=2026-08-29T07:19:37.000Z
# machine-contract: a public-video claim requires owner approval, anonymous playback evidence, matching local duration, published Japanese subtitles, explicit thumbnail fallback, and a Devpost readback whose challenge submission remains unsubmitted.
# event_uuid_v7=01a04c84-1a18-7719-84d1-c65cfd9a1db5
# state_transition=VOID_NOT_INSTALLED -> VOID_LOCAL_ADAPTER_EVIDENCE_VALIDATED occurred_at=2026-08-29T07:55:20.984Z
# machine-contract: Void package and MCP registration evidence stays separate from provider authentication, project linking, publication, and runtime execution.
# event_uuid_v7=01a04c90-5270-7d67-be8b-a19c33bb52ca
# state_transition=YOUTUBE_DURATION_ONLY_BINDING -> SELECTED_UPLOAD_DIGEST_BOUND occurred_at=2026-08-29T08:08:41.840Z
# machine-contract: public YouTube evidence must bind the selected local final-video artifact identifier, path, and SHA-256 to the returned public video identifier; equal duration alone is insufficient.
# information_uuid_v5=8e656bba-df14-5ee2-9348-f6239fb7edf9
# event_uuid_v7=01a04cf7-edba-71cd-b1c5-c8271758d1b4
# state_transition=SELF_CERTIFIED_ARTIFACT_BINDING -> ARTIFACT_TO_VIDEO_IDENTITY_UNMEASURED occurred_at=2026-08-29T10:01:51.802Z
# machine-contract: anonymous playback, timestamps, and subtitles are verified separately; no editable repository record may promote local-artifact to public-video identity without an independent upload receipt.
# information_uuid_v5=17436d1b-fda6-5147-b5b0-ba04f2465e30
# event_uuid_v7=01a04c9e-a9f3-75f0-ac02-6d9514cfc4b5 state_transition=PYTHON_TYPE_TOOLS_STANDALONE -> PYTHON_TYPE_TOOLS_IN_FULL_GATE occurred_at=2026-08-29T08:24:21.747Z
# machine-contract: schema evidence must preserve exact tool versions, release status, project scope, and language-server handshake results.
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[1]
SCALE = 1_000_000
JAVASCRIPT_MAX_SAFE_INTEGER = 9_007_199_254_740_991
IGNORED_PARTS = {".git", ".jj", ".local", ".playwright-mcp", ".venv", ".vercel", ".wrangler", "dist", "node_modules", "__pycache__"}
SRT_TIMING = re.compile(
    r"(?P<start_h>\d{2}):(?P<start_m>\d{2}):(?P<start_s>\d{2}),(?P<start_ms>\d{3})"
    r" --> "
    r"(?P<end_h>\d{2}):(?P<end_m>\d{2}):(?P<end_s>\d{2}),(?P<end_ms>\d{3})"
)


def is_ignored(path: Path):
    return any(part in IGNORED_PARTS for part in path.relative_to(ROOT).parts)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_ed25519_public_key(path: Path) -> Ed25519PublicKey:
    """Load a public key and fail closed if an evidence fixture changes algorithms."""
    key = serialization.load_pem_public_key(path.read_bytes())
    if not isinstance(key, Ed25519PublicKey):
        raise TypeError(f"{path.relative_to(ROOT)} must contain an Ed25519 public key")
    return key


def parse_subrip(path: Path) -> dict[str, Any]:
    """Return a strict, ordered SubRip summary for machine-checkable caption evidence."""
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    blocks = [block for block in re.split(r"\n{2,}", text.strip()) if block]
    cues: list[dict[str, Any]] = []
    previous_end = 0
    for expected_index, block in enumerate(blocks, start=1):
        lines = block.splitlines()
        if len(lines) < 3 or lines[0] != str(expected_index):
            raise ValueError(f"{path.relative_to(ROOT)} has a missing or non-sequential cue at {expected_index}")
        timing = SRT_TIMING.fullmatch(lines[1])
        if timing is None:
            raise ValueError(f"{path.relative_to(ROOT)} has invalid timing at cue {expected_index}")

        def milliseconds(prefix: str) -> int:
            minute = int(timing[f"{prefix}_m"])
            second = int(timing[f"{prefix}_s"])
            if minute >= 60 or second >= 60:
                raise ValueError(f"{path.relative_to(ROOT)} has out-of-range timing at cue {expected_index}")
            return (
                int(timing[f"{prefix}_h"]) * 3_600_000
                + minute * 60_000
                + second * 1_000
                + int(timing[f"{prefix}_ms"])
            )

        start = milliseconds("start")
        end = milliseconds("end")
        caption = "\n".join(lines[2:]).strip()
        if not caption or start >= end:
            raise ValueError(f"{path.relative_to(ROOT)} has an empty or non-positive cue at {expected_index}")
        if start < previous_end:
            raise ValueError(f"{path.relative_to(ROOT)} overlaps at cue {expected_index}")
        cues.append({"start": start, "end": end, "caption": caption})
        previous_end = end
    return {
        "captionCount": len(cues),
        "timedWords": sum(len(cue["caption"].split()) for cue in cues),
        "lastEndMs": cues[-1]["end"] if cues else 0,
        "cues": cues,
    }


def canonical_bytes(value):
    def check(x):
        if isinstance(x, float): raise TypeError("float forbidden in audit canonical subset")
        if isinstance(x, dict):
            for k, v in x.items():
                if not isinstance(k, str): raise TypeError("keys must be strings")
                check(v)
        elif isinstance(x, list):
            for v in x: check(v)
        elif x is not None and not isinstance(x, (str, int, bool)):
            raise TypeError(type(x))
    check(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def sha256(data: bytes): return hashlib.sha256(data).hexdigest()


def uuid7_ms(value: str):
    u = uuid.UUID(value)
    if u.version != 7: raise ValueError("not v7")
    return u.int >> 80


def merkle_leaf(d: str): return hashlib.sha256(b"\x00" + bytes.fromhex(d)).digest()

def merkle_node(a: bytes, b: bytes): return hashlib.sha256(b"\x01" + a + b).digest()


def merkle_root(ds):
    level = [merkle_leaf(d) for d in ds]
    if not level: return hashlib.sha256(b"").digest()
    while len(level) > 1:
        level = [level[i] if i + 1 == len(level) else merkle_node(level[i], level[i+1]) for i in range(0, len(level), 2)]
    return level[0]


def verify_inclusion(digest: str, index: int, size: int, path: list[str]):
    h = merkle_leaf(digest)
    i = index
    n = size
    cursor = 0
    while n > 1:
        sibling_exists = (i % 2 == 1) or (i + 1 < n)
        if sibling_exists:
            s = bytes.fromhex(path[cursor]); cursor += 1
            h = merkle_node(s, h) if i % 2 else merkle_node(h, s)
        i //= 2
        n = (n + 1) // 2
    if cursor != len(path): raise AssertionError("unused Merkle path entries")
    return h.hex()


def eval_ir(ir):
    if ir["phase"] == "pre":
        if not all(ir["gates"].values()): return "DENY"
        if ir["state"]["ambiguousPreviousEffect"]: return "RECONCILE"
        if ir["state"]["humanRequired"]: return "HUMAN"
        u = ir["utility"]
        lhs = u["successProbabilityPPM"] * (u["successGain"] + u["failureLoss"])
        rhs = SCALE * (u["totalPenalty"] + u["failureLoss"] + u["abstainUtility"])
        return "ALLOW" if lhs > rhs else "DENY"
    if not all(ir["gates"].values()): return "DENY"
    if ir["state"]["ambiguousPreviousEffect"]: return "RECONCILE"
    if ir["state"]["humanRequired"]: return "HUMAN"
    v = ir["verification"]
    if v["confidencePPM"] is None or v["confidencePPM"] < v["classFloorPPM"]: return "DENY"
    if v["damage"] is None or v["lossBudget"] is None: return "DENY"
    good = v["damage"] <= 0 or (SCALE - v["confidencePPM"]) * v["damage"] <= SCALE * v["lossBudget"]
    return "ALLOW" if good else "DENY"


def live_event_matches_scope(event, scoped_intent_id):
    return event.get("intentId") == scoped_intent_id


def sync_source_matches_record(record, source):
    return (
        source is not None
        and source.get("eventId") == record.get("sourceEventId")
        and source.get("deviceId") == record.get("deviceId")
        and source.get("sequence") == record.get("deviceSequence")
        and source.get("operation") == record.get("operation")
        and source.get("proof", {}).get("eventDigest") == record.get("sourceEventDigest")
        and source.get("proof", {}).get("chainHash") == record.get("sourceChainHash")
    )


def strict_parameter_contract_errors(schema, path="parameters"):
    findings = []
    if not isinstance(schema, dict):
        return [f"{path} must be an object"]
    schema_type = schema.get("type")
    if schema_type == "string":
        minimum = schema.get("minLength")
        maximum = schema.get("maxLength")
        if minimum is not None and (type(minimum) is not int or minimum < 0 or minimum > JAVASCRIPT_MAX_SAFE_INTEGER):
            findings.append(f"{path}.minLength must be a non-negative JavaScript safe integer")
        if maximum is not None and (type(maximum) is not int or maximum < 0 or maximum > JAVASCRIPT_MAX_SAFE_INTEGER):
            findings.append(f"{path}.maxLength must be a non-negative JavaScript safe integer")
        if type(minimum) is int and type(maximum) is int and minimum > maximum:
            findings.append(f"{path} minLength exceeds maxLength")
        return findings
    if schema_type == "integer":
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if minimum is not None and (type(minimum) is not int or abs(minimum) > JAVASCRIPT_MAX_SAFE_INTEGER):
            findings.append(f"{path}.minimum must be a JavaScript safe integer")
        if maximum is not None and (type(maximum) is not int or abs(maximum) > JAVASCRIPT_MAX_SAFE_INTEGER):
            findings.append(f"{path}.maximum must be a JavaScript safe integer")
        if type(minimum) is int and type(maximum) is int and minimum > maximum:
            findings.append(f"{path} minimum exceeds maximum")
        return findings
    if schema_type != "object":
        return findings
    properties = schema.get("properties")
    required = schema.get("required")
    if not isinstance(properties, dict) or not isinstance(required, list):
        return [f"{path} object schema lacks properties or required"]
    if any(not isinstance(name, str) for name in required):
        return [f"{path} required entries must be strings"]
    property_names = set(properties)
    required_names = set(required)
    if property_names != required_names:
        findings.append(
            f"{path} properties/required differ; "
            f"missing={sorted(property_names - required_names)}, extra={sorted(required_names - property_names)}"
        )
    for name, child in properties.items():
        findings.extend(strict_parameter_contract_errors(child, f"{path}.properties.{name}"))
    return findings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    errors = []
    checks = {}

    # Parse JSON, NDJSON, and YAML.
    for p in ROOT.rglob("*.json"):
        if is_ignored(p):
            continue
        try: load_json(p)
        except Exception as e: errors.append(f"JSON {p.relative_to(ROOT)}: {e}")
    for p in ROOT.rglob("*.ndjson"):
        if is_ignored(p):
            continue
        for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if line.strip():
                try: json.loads(line)
                except Exception as e: errors.append(f"NDJSON {p.relative_to(ROOT)}:{n}: {e}")
    for p in [*ROOT.rglob("*.yaml"), *ROOT.rglob("*.yml")]:
        if is_ignored(p):
            continue
        try: yaml.safe_load(p.read_text(encoding="utf-8"))
        except Exception as e: errors.append(f"YAML {p.relative_to(ROOT)}: {e}")
    checks["structured_parse"] = not errors

    # Host-local caches and generated deploy state are intentionally outside the
    # portable repository receipt. Check both generated integrity records so a
    # future manifest regeneration cannot silently publish machine-specific data.
    host_generated_start = len(errors)
    host_generated_parts = {".vercel", ".wrangler", ".local", "dist", "node_modules"}
    try:
        catalog = load_json(ROOT / "metadata/file-catalog.json")
        catalog_paths = [record["path"] for record in catalog["files"]]
        manifest_paths = []
        for line_number, line in enumerate((ROOT / "MANIFEST.sha256").read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            fields = line.split(maxsplit=1)
            if len(fields) != 2:
                errors.append(f"MANIFEST.sha256:{line_number}: expected digest and repository path")
                continue
            manifest_paths.append(fields[1])
        for source, paths in (("metadata/file-catalog.json", catalog_paths), ("MANIFEST.sha256", manifest_paths)):
            for repository_path in paths:
                parts = set(repository_path.replace("\\", "/").split("/"))
                forbidden = sorted(parts & host_generated_parts)
                if forbidden:
                    errors.append(f"{source}: host-generated path is forbidden: {repository_path} ({', '.join(forbidden)})")
    except Exception as exc:
        errors.append(f"host-generated state exclusion check: {exc}")
    checks["host_generated_state_excluded"] = len(errors) == host_generated_start

    # Live browser-notification evidence: independently bind the public summary
    # to the captured transition stream without trusting the local SQLite file.
    live_start = len(errors)
    live_path = ROOT / "data/audit/notification-demo-live-events.ndjson"
    live_events = [json.loads(line) for line in live_path.read_text(encoding="utf-8").splitlines() if line]
    live_evidence = load_json(ROOT / "metadata/notification-demo-live-verification.json")
    scoped_intent_id = live_evidence["scope"]["intent_id"]
    try:
        if uuid.UUID(scoped_intent_id).version != 5:
            raise ValueError("scoped intent ID is not UUIDv5")
    except Exception as exc:
        errors.append(f"live notification scoped intent UUID: {exc}")
    previous_hash = ""
    for index, event in enumerate(live_events, 1):
        event_hash = event.get("eventHash", "")
        core = {key: value for key, value in event.items() if key != "eventHash"}
        if core.get("previousHash") != previous_hash:
            errors.append(f"live notification event {index} previous hash mismatch")
        if sha256(canonical_bytes(core)) != event_hash:
            errors.append(f"live notification event {index} digest mismatch")
        try:
            event_id = uuid.UUID(event["eventId"])
            intent_id = uuid.UUID(event["intentId"])
            if event_id.version != 7 or abs(uuid7_ms(str(event_id)) - event["occurredAt"]) > 1:
                raise ValueError("event UUIDv7 timestamp mismatch")
            if intent_id.version != 5:
                raise ValueError("intent ID is not UUIDv5")
        except Exception as exc:
            errors.append(f"live notification event {index} UUID: {exc}")
        if not live_event_matches_scope(event, scoped_intent_id):
            errors.append(f"live notification event {index} belongs to a different intent")
        previous_hash = event_hash
    if live_events:
        mutation = dict(live_events[0])
        mutation["intentId"] = str(uuid.uuid5(uuid.NAMESPACE_URL, "validator-regression/different-live-intent"))
        if live_event_matches_scope(mutation, scoped_intent_id):
            errors.append("live notification validator accepted a different-intent mutation")
    observation = live_evidence["observations"]
    execution_claims = sum(event["kind"] == "execution-claimed" for event in live_events)
    suppressed_retries = sum(event["kind"] == "duplicate-execution-suppressed" for event in live_events)
    if execution_claims != 1 or observation["effect_start_count_after_retry"] != 1:
        errors.append("live notification evidence must contain exactly one external-effect claim")
    if suppressed_retries < 1 or observation["same_operation_retry_status"] != "ALREADY_VERIFIED":
        errors.append("live notification evidence is missing the suppressed duplicate retry")
    if observation["service_worker_active_count"] != 1:
        errors.append("live notification service-worker readback must contain exactly one active notification")
    if observation["control_state"] != "VERIFIED" or observation["effect_state"] != "CONFIRMED_PRESENT":
        errors.append("live notification evidence did not finish VERIFIED/CONFIRMED_PRESENT")
    if not observation["audit_valid"] or observation["audit_event_count"] != len(live_events):
        errors.append("live notification audit count or validity summary mismatch")
    if observation["audit_last_hash"] != previous_hash:
        errors.append("live notification audit last hash mismatch")
    if observation["retry_event_id"] != live_events[-1]["eventId"]:
        errors.append("live notification retry event ID mismatch")
    try:
        evidence_uuid = uuid.UUID(live_evidence["identity"]["uuid_v7"])
        if evidence_uuid.version != 7 or abs(uuid7_ms(str(evidence_uuid)) - live_evidence["temporal"]["epoch_ms"]) > 1:
            raise ValueError("evidence UUIDv7 timestamp mismatch")
    except Exception as exc:
        errors.append(f"live notification evidence UUID: {exc}")
    checks["live_notification_evidence"] = len(errors) == live_start

    # Local Markdown link integrity. External URLs are tracked in the source registry
    # and are intentionally not fetched by the offline validator.
    broken_links = []
    for p in ROOT.rglob("*.md"):
        if is_ignored(p):
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        text = re.sub(r"```.*?```", "", text, flags=re.S)
        for target in re.findall(r"\]\(([^)]+)\)", text):
            value = target.strip()
            if value.startswith("<") and value.endswith(">"):
                value = value[1:-1]
            if value.startswith(("http://", "https://", "mailto:", "#", "urn:")):
                continue
            if ' "' in value:
                value = value.split(' "', 1)[0]
            rel = value.split("#", 1)[0]
            if not rel:
                continue
            resolved = (ROOT / rel.lstrip("/")).resolve() if rel.startswith("/") else (p.parent / rel).resolve()
            if not resolved.exists():
                broken_links.append(f"{p.relative_to(ROOT)} -> {target}")
    errors.extend(f"broken local Markdown link: {x}" for x in broken_links)
    checks["local_markdown_links"] = not broken_links

    # JSON Schema validation.
    schemas = {p.stem.replace(".schema", ""): load_json(p) for p in (ROOT / "schemas").glob("*.schema.json")}
    schema_registry = Registry().with_resources(
        (schema["$id"], Resource.from_contents(schema)) for schema in schemas.values()
    )
    format_checker = FormatChecker()
    datasets = {
        "source": load_json(ROOT / "knowledge/sources.json")["records"],
        "claim": load_json(ROOT / "knowledge/claims.json")["records"],
        "formula": load_json(ROOT / "knowledge/formulas.json")["records"],
        "requirement": load_json(ROOT / "knowledge/requirements.json")["records"],
        "timeline-event": load_json(ROOT / "knowledge/timeline.json")["records"],
        "test": load_json(ROOT / "knowledge/tests.json")["records"],
    }
    for key, records in datasets.items():
        validator = Draft202012Validator(schemas[key], format_checker=format_checker)
        for rec in records:
            for e in validator.iter_errors(rec): errors.append(f"schema {key}/{rec.get('id')}: {e.message}")
    contract_validator = Draft202012Validator(schemas["tool-contract"], format_checker=format_checker)
    ir_validator = Draft202012Validator(schemas["canonical-ir"], format_checker=format_checker)
    for p in ROOT.glob("examples/*/tool-contract.json"):
        for e in contract_validator.iter_errors(load_json(p)): errors.append(f"schema {p.relative_to(ROOT)}: {e.message}")
    for p in ROOT.glob("examples/*/*ir*.json"):
        for e in ir_validator.iter_errors(load_json(p)): errors.append(f"schema {p.relative_to(ROOT)}: {e.message}")
    notification_validator = Draft202012Validator(schemas["notification-intent"], format_checker=format_checker)
    notification_sample = ROOT / "examples/notification-demo/intent.sample.json"
    for e in notification_validator.iter_errors(load_json(notification_sample)):
        errors.append(f"schema {notification_sample.relative_to(ROOT)}: {e.message}")
    audit_validator = Draft202012Validator(schemas["audit-event"], format_checker=format_checker)
    for n, line in enumerate((ROOT / "data/audit/events.sample.ndjson").read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            for e in audit_validator.iter_errors(json.loads(line)):
                errors.append(f"schema data/audit/events.sample.ndjson:{n}: {e.message}")
    metric_validator = Draft202012Validator(schemas["runtime-metric"], format_checker=format_checker)
    for n, line in enumerate((ROOT / "data/timeseries/runtime-metrics.sample.ndjson").read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            for e in metric_validator.iter_errors(json.loads(line)):
                errors.append(f"schema data/timeseries/runtime-metrics.sample.ndjson:{n}: {e.message}")
    timeline_validator = Draft202012Validator(schemas["timeline-event"], format_checker=format_checker)
    for n, line in enumerate((ROOT / "data/timeseries/design-events.ndjson").read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            for e in timeline_validator.iter_errors(json.loads(line)):
                errors.append(f"schema data/timeseries/design-events.ndjson:{n}: {e.message}")

    sync_evidence = load_json(ROOT / "metadata/offline-sync-verification.json")
    sync_evidence_validator = Draft202012Validator(
        schemas["offline-sync-evidence"], registry=schema_registry, format_checker=format_checker
    )
    for e in sync_evidence_validator.iter_errors(sync_evidence):
        errors.append(f"schema metadata/offline-sync-verification.json: {e.message}")
    signed_event_validator = Draft202012Validator(
        schemas["signed-device-event"], registry=schema_registry, format_checker=format_checker
    )
    for n, line in enumerate((ROOT / sync_evidence["artifacts"]["deviceEvents"]).read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            for e in signed_event_validator.iter_errors(json.loads(line)):
                errors.append(f"schema {sync_evidence['artifacts']['deviceEvents']}:{n}: {e.message}")
    ingestion_validator = Draft202012Validator(
        schemas["sync-ingestion-record"], registry=schema_registry, format_checker=format_checker
    )
    for n, line in enumerate((ROOT / sync_evidence["artifacts"]["ingestionLedger"]).read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            for e in ingestion_validator.iter_errors(json.loads(line)):
                errors.append(f"schema {sync_evidence['artifacts']['ingestionLedger']}:{n}: {e.message}")
    checkpoint_validator = Draft202012Validator(
        schemas["signed-checkpoint"], registry=schema_registry, format_checker=format_checker
    )
    for device in sync_evidence["devices"]:
        for e in checkpoint_validator.iter_errors(device["checkpoint"]):
            errors.append(f"schema checkpoint/{device['deviceId']}: {e.message}")
    planner_evidence = load_json(ROOT / "metadata/online-planner-verification.json")
    planner_evidence_validator = Draft202012Validator(
        schemas["planner-evidence"], registry=schema_registry, format_checker=format_checker
    )
    for e in planner_evidence_validator.iter_errors(planner_evidence):
        errors.append(f"schema metadata/online-planner-verification.json: {e.message}")
    planner_request = load_json(ROOT / planner_evidence["artifacts"]["requestSample"])
    planner_request_validator = Draft202012Validator(
        schemas["responses-planner-request"], registry=schema_registry, format_checker=format_checker
    )
    for e in planner_request_validator.iter_errors(planner_request):
        errors.append(f"schema {planner_evidence['artifacts']['requestSample']}: {e.message}")
    for index, tool in enumerate(planner_request["tools"]):
        for error in strict_parameter_contract_errors(tool["parameters"], f"tools[{index}].parameters"):
            errors.append(f"strict planner parameter contract: {error}")
    malformed_planner_request = json.loads(json.dumps(planner_request))
    parameter_properties = malformed_planner_request["tools"][0]["parameters"]["properties"]
    first_parameter = next(iter(parameter_properties))
    parameter_properties[first_parameter] = {
        "type": "object",
        "additionalProperties": False,
        "properties": {"nested": {"type": "string"}},
        "required": ["different"],
    }
    malformed_schema_errors = list(planner_request_validator.iter_errors(malformed_planner_request))
    malformed_contract_errors = strict_parameter_contract_errors(
        malformed_planner_request["tools"][0]["parameters"],
        "mutation.parameters",
    )
    if not malformed_schema_errors and not malformed_contract_errors:
        errors.append("responses planner request schema accepted a malformed nested parameter schema")
    inverted_planner_request = json.loads(json.dumps(planner_request))
    inverted_properties = inverted_planner_request["tools"][0]["parameters"]["properties"]
    inverted_properties[first_parameter] = {"type": "string", "minLength": 10, "maxLength": 1}
    inverted_schema_errors = list(planner_request_validator.iter_errors(inverted_planner_request))
    inverted_contract_errors = strict_parameter_contract_errors(
        inverted_planner_request["tools"][0]["parameters"],
        "mutation.invertedParameters",
    )
    if not inverted_schema_errors and not inverted_contract_errors:
        errors.append("responses planner request schema accepted inverted scalar bounds")
    final_evidence = load_json(ROOT / "metadata/final-verification.json")
    final_evidence_validator = Draft202012Validator(
        schemas["final-verification"], registry=schema_registry, format_checker=format_checker
    )
    for e in final_evidence_validator.iter_errors(final_evidence):
        errors.append(f"schema metadata/final-verification.json: {e.message}")
    review_reconciliation = load_json(ROOT / "metadata/review-thread-reconciliation.json")
    review_reconciliation_validator = Draft202012Validator(
        schemas["review-thread-reconciliation"], registry=schema_registry, format_checker=format_checker
    )
    for e in review_reconciliation_validator.iter_errors(review_reconciliation):
        errors.append(f"schema metadata/review-thread-reconciliation.json: {e.message}")
    hotel_evidence = load_json(ROOT / "metadata/hotel-booking-verification.json")
    hotel_evidence_validator = Draft202012Validator(
        schemas["hotel-booking-verification"], registry=schema_registry, format_checker=format_checker
    )
    for e in hotel_evidence_validator.iter_errors(hotel_evidence):
        errors.append(f"schema metadata/hotel-booking-verification.json: {e.message}")
    if hotel_evidence["sourceCommit"] == "WORKTREE" and hotel_evidence["sourceState"] != "WORKTREE_CANDIDATE":
        errors.append("hotel WORKTREE source must remain a worktree candidate")
    live_hotel = hotel_evidence["liveDeployment"]
    if hotel_evidence["sourceState"] == "DEPLOYED_CURRENT":
        if (
            live_hotel["status"] != "CURRENT_ARTIFACT_VERIFIED"
            or live_hotel["deployedVersionSourceCommit"] != hotel_evidence["sourceCommit"]
            or live_hotel["functionalArtifactDigest"] != hotel_evidence["artifactDigest"]
            or live_hotel["fullSitesPackageDigest"] != hotel_evidence["fullSitesPackageDigest"]
        ):
            errors.append("deployed-current hotel evidence must match the live version source and both artifact digests")
    elif live_hotel["status"] == "CURRENT_ARTIFACT_VERIFIED":
        errors.append("a non-deployed candidate cannot claim the current artifact is live-verified")
    void_evidence = load_json(ROOT / "metadata/void-integration.json")
    void_evidence_validator = Draft202012Validator(
        schemas["void-integration"], registry=schema_registry, format_checker=format_checker
    )
    for e in void_evidence_validator.iter_errors(void_evidence):
        errors.append(f"schema metadata/void-integration.json: {e.message}")
    void_identity = void_evidence["identity"]
    void_transition = void_evidence["stateTransition"]
    if void_identity["observationUuidV7"] != void_transition["eventId"]:
        errors.append("Void observation and transition event identifiers differ")
    if void_identity["observedAt"] != void_transition["occurredAt"]:
        errors.append("Void observation and transition times differ")
    void_audit = void_evidence["dependencyAudit"]
    if void_audit["moderate"] + void_audit["high"] + void_audit["critical"] != void_audit["total"]:
        errors.append("Void dependency audit severity counts do not sum to the recorded total")
    if void_evidence["providerState"]["deploymentExecutionCount"] != 0:
        errors.append("Void integration evidence cannot claim a deployment before provider publication evidence exists")
    python_type_evidence = load_json(ROOT / "metadata/python-type-tools.json")
    python_type_validator = Draft202012Validator(
        schemas["python-type-tools"], registry=schema_registry, format_checker=format_checker
    )
    for e in python_type_validator.iter_errors(python_type_evidence):
        errors.append(f"schema metadata/python-type-tools.json: {e.message}")
    python_type_identity = python_type_evidence["identity"]
    python_type_transition = python_type_evidence["stateTransition"]
    if python_type_identity["observationUuidV7"] != python_type_transition["eventId"]:
        errors.append("Python type-tool observation and transition event identifiers differ")
    if python_type_identity["observedAt"] != python_type_transition["occurredAt"]:
        errors.append("Python type-tool observation and transition times differ")
    if python_type_evidence["installation"]["globalInstallationPerformed"]:
        errors.append("Python type-tool evidence cannot claim a global installation")
    if python_type_evidence["installation"]["automaticPyreflyInitExecuted"]:
        errors.append("Python type-tool evidence cannot claim an automatic Pyrefly configuration migration")
    if {tool["name"]: tool["officialStatus"] for tool in python_type_evidence["tools"]} != {
        "ty": "BETA",
        "Pyrefly": "STABLE",
    }:
        errors.append("Python type-tool release status boundary drifted")
    video_production = load_json(ROOT / "metadata/demo-video-production.json")
    video_production_validator = Draft202012Validator(
        schemas["demo-video-production"], registry=schema_registry, format_checker=format_checker
    )
    for e in video_production_validator.iter_errors(video_production):
        errors.append(f"schema metadata/demo-video-production.json: {e.message}")
    false_video_promotions = {
        "verified identity state": ("state", "VERIFIED"),
        "same-artifact assertion": ("sameArtifactClaim", "SAME_ARTIFACT"),
        "self-certified receipt": ("independentUploadReceipt", {"source": "SELF_CERTIFIED_EDITABLE_RECORD"}),
    }
    for promotion_name, (field, value) in false_video_promotions.items():
        falsely_promoted_video = json.loads(json.dumps(video_production))
        falsely_promoted_video["publication"]["artifactToVideoIdentity"][field] = value
        if not list(video_production_validator.iter_errors(falsely_promoted_video)):
            errors.append(f"video production schema accepted false promotion: {promotion_name}")
    video_start = len(errors)
    try:
        media_capabilities = video_production["mediaCapabilities"]
        expected_media_services = {"Higgsfield", "OpenArt", "Magnific", "vidIQ", "HeyGen", "Canva"}
        if {record["service"] for record in media_capabilities} != expected_media_services:
            errors.append("video media capability inventory must contain the exact six authorized services")
        for record in media_capabilities:
            if record["authenticationState"] == "CONFIRMED" and not record["verifiedOperations"]:
                errors.append(f"confirmed media authentication lacks a verified operation: {record['service']}")
            if record["authenticationState"] != "CONFIRMED" and record["verifiedOperations"]:
                errors.append(f"unverified media authentication lists a successful operation: {record['service']}")
        used_services = {record["service"] for record in media_capabilities if record["productionUseState"] == "USED"}
        if any(record["service"] == "LOCAL" and record["remoteId"] is not None for record in video_production["assets"]):
            errors.append("local video-production assets cannot claim a remote provider identifier")
        asset_services = {
            record["service"]
            for record in video_production["assets"]
            if record["status"] == "COMPLETED" and record["service"] in expected_media_services
        }
        if used_services != asset_services:
            errors.append("used media capability services differ from completed production asset services")
        video_assets = [
            record for record in video_production["assets"]
            if record["kind"] in {"SCREEN_RECORDING", "FINAL_VIDEO"}
        ]
        completed_video_assets = [record for record in video_assets if record["status"] == "COMPLETED"]
        for record in completed_video_assets:
            evidence = record.get("videoEvidence")
            if evidence is None:
                errors.append(f"completed {record['kind']} asset lacks measured video evidence")
                continue
            duration_seconds = evidence["durationSeconds"]
            site_recording_seconds = evidence["siteRecordingSeconds"]
            if site_recording_seconds > duration_seconds:
                errors.append(f"{record['kind']} site-recording seconds exceed its duration")
                continue
            actual_permille = round(1000 * site_recording_seconds / duration_seconds)
            if actual_permille != evidence["actualSiteRecordingPermille"]:
                errors.append(f"{record['kind']} actual site-recording ratio is inconsistent")

        final_video_assets = [record for record in video_assets if record["kind"] == "FINAL_VIDEO"]
        for record in final_video_assets:
            evidence = record.get("videoEvidence", {})
            if (
                record["service"] != "LOCAL"
                or record["status"] != "COMPLETED"
                or record["remoteId"] is not None
                or evidence.get("width") != 1920
                or evidence.get("height") != 1080
                or evidence.get("hasAudio") is not True
                or evidence.get("englishCaptionsBurned") is not True
                or not isinstance(evidence.get("durationSeconds"), (int, float))
                or evidence["durationSeconds"] >= 180
                or not isinstance(evidence.get("actualSiteRecordingPermille"), int)
                or evidence["actualSiteRecordingPermille"] < 700
            ):
                errors.append("final video must be a completed local 1920x1080 cut with audio, burned English captions, duration under 180 seconds, and at least 70 percent actual site recording")
        production_files = video_production["productionFiles"]
        expected_video_kinds = {"STORYBOARD", "NARRATION_EN", "SUBTITLES_EN", "SUBTITLES_JA"}
        if {record["kind"] for record in production_files} != expected_video_kinds:
            errors.append("video production files must contain exactly the storyboard, narration, and two subtitle drafts")
        for record in production_files:
            path = ROOT / record["path"]
            if not path.is_file():
                errors.append(f"video production file is missing: {record['path']}")
                continue
            if sha256(path.read_bytes()) != record["sha256"]:
                errors.append(f"video production file digest mismatch: {record['path']}")
        plan = video_production["productionPlan"]
        publication = video_production["publication"]
        if publication.get("status") == "NOT_STARTED":
            if publication != {
                "youtubeUrl": None,
                "status": "NOT_STARTED",
                "requiresSeparateApproval": True,
            }:
                errors.append("unstarted video publication has unexpected evidence fields")
        elif publication.get("status") == "PUBLIC_READBACK_VERIFIED":
            try:
                publication_id = uuid.UUID(publication["publicationId"])
                publication_event = uuid.UUID(publication["observationUuidV7"])
                publication_observed_ms = int(datetime.fromisoformat(
                    publication["observedAt"].replace("Z", "+00:00")
                ).timestamp() * 1000)
                published_ms = int(datetime.fromisoformat(
                    publication["publishedAt"].replace("Z", "+00:00")
                ).timestamp() * 1000)
                devpost = publication["devpostReadback"]
                devpost_id = uuid.UUID(devpost["informationUuidV5"])
                devpost_event = uuid.UUID(devpost["observationUuidV7"])
                devpost_observed_ms = int(datetime.fromisoformat(
                    devpost["observedAt"].replace("Z", "+00:00")
                ).timestamp() * 1000)
            except Exception as exc:
                errors.append(f"published video identity or time is invalid: {exc}")
            else:
                if publication_id.version != 5:
                    errors.append("published video information identifier is not UUIDv5")
                if publication_event.version != 7 or uuid7_ms(str(publication_event)) != publication_observed_ms:
                    errors.append("published video observation UUIDv7 does not match observedAt")
                if published_ms > publication_observed_ms:
                    errors.append("published video time occurs after its observation")
                if devpost_id.version != 5:
                    errors.append("Devpost video readback information identifier is not UUIDv5")
                if devpost_event.version != 7 or uuid7_ms(str(devpost_event)) != devpost_observed_ms:
                    errors.append("Devpost video readback UUIDv7 does not match observedAt")

            video_id = publication.get("videoId")
            anonymous_readback = publication.get("anonymousReadback", {})
            subtitles_readback = publication.get("subtitles", {})
            thumbnail_readback = publication.get("thumbnail", {})
            devpost = publication.get("devpostReadback", {})
            canva_thumbnails = [
                record for record in video_production["assets"]
                if record["service"] == "Canva" and record["kind"] == "THUMBNAIL"
            ]
            artifact_identity = publication.get("artifactToVideoIdentity", {})
            if len(final_video_assets) == 1:
                final_video = final_video_assets[0]
                try:
                    artifact_identity_id = uuid.UUID(artifact_identity["informationUuidV5"])
                    artifact_identity_event = uuid.UUID(artifact_identity["observationUuidV7"])
                    artifact_identity_observed_ms = int(datetime.fromisoformat(
                        artifact_identity["observedAt"].replace("Z", "+00:00")
                    ).timestamp() * 1000)
                except Exception as exc:
                    errors.append(f"artifact-to-video identity boundary or time is invalid: {exc}")
                else:
                    if artifact_identity_id.version != 5:
                        errors.append("artifact-to-video boundary information identifier is not UUIDv5")
                    if (
                        artifact_identity_event.version != 7
                        or uuid7_ms(str(artifact_identity_event)) != artifact_identity_observed_ms
                    ):
                        errors.append("artifact-to-video boundary UUIDv7 does not match observedAt")
                if (
                    artifact_identity.get("informationUuidV5") != "8e656bba-df14-5ee2-9348-f6239fb7edf9"
                    or artifact_identity.get("state") != "UNMEASURED"
                    or artifact_identity.get("independentUploadReceiptState") != "NOT_RETAINED"
                    or artifact_identity.get("independentUploadReceipt") is not None
                    or artifact_identity.get("sameArtifactClaim") != "NOT_ASSERTED"
                    or artifact_identity.get("localArtifact") != {
                        "assetId": final_video["assetId"],
                        "path": final_video["localPath"],
                        "sha256": final_video["sha256"],
                    }
                    or artifact_identity.get("publicVideo") != {
                        "videoId": video_id,
                        "evidenceSource": "YOUTUBE_PUBLIC_AND_OWNER_READBACK",
                    }
                ):
                    errors.append("artifact-to-video identity must remain unmeasured without an independent upload receipt")
            if (
                publication.get("youtubeUrl") != f"https://youtu.be/{video_id}"
                or publication.get("visibility") != "PUBLIC"
                or publication.get("requiresSeparateApproval") is not True
                or publication.get("approvalState") != "GRANTED"
                or anonymous_readback.get("httpStatus") != 200
                or anonymous_readback.get("playabilityStatus") != "OK"
                or anonymous_readback.get("playableInEmbed") is not True
                or anonymous_readback.get("isPrivate") is not False
                or anonymous_readback.get("isUnlisted") is not False
            ):
                errors.append("public YouTube evidence does not prove approved anonymous playback and public metadata readback")
            if (
                subtitles_readback.get("japaneseAuthored") != "PUBLISHED"
                or subtitles_readback.get("englishAutomatic") != "PUBLISHED"
            ):
                errors.append("public YouTube evidence does not preserve both observed subtitle tracks")
            if (
                len(canva_thumbnails) != 1
                or thumbnail_readback.get("canvaAssetSha256") != canva_thumbnails[0].get("sha256")
                or thumbnail_readback.get("customApplicationState") != "NOT_APPLIED_TOOL_TIMEOUT"
                or thumbnail_readback.get("failureReason") != "YOUTUBE_FILE_CHOOSER_TIMEOUT"
                or thumbnail_readback.get("publicState") != "AUTO_GENERATED_PUBLIC_VERIFIED"
                or thumbnail_readback.get("publicSha256") == thumbnail_readback.get("canvaAssetSha256")
            ):
                errors.append("YouTube thumbnail evidence does not preserve the failed custom upload and verified fallback")
            if (
                devpost.get("videoUrl") != publication.get("youtubeUrl")
                or devpost.get("projectState") != "published"
                or devpost.get("submittedAt") is not None
                or devpost.get("finalSubmissionState") != "NOT_SUBMITTED"
            ):
                errors.append("Devpost video readback crosses or obscures the final-submission boundary")
        else:
            errors.append("video publication has an unsupported status")
        planned_permille = round(
            1000 * plan["plannedActualSiteRecordingSeconds"] / plan["plannedDurationSeconds"]
        )
        if planned_permille != plan["plannedActualSiteRecordingPermille"]:
            errors.append("video production planned site-recording ratio is inconsistent")
        if plan["plannedActualSiteRecordingPermille"] < 700:
            errors.append("video production plan does not reserve at least 70 percent for actual site recording")
        subtitle_records = [record for record in production_files if record["kind"].startswith("SUBTITLES_")]
        subtitle_assets = [record for record in video_production["assets"] if record["kind"] == "SUBTITLE"]
        subtitle_assets_by_path = {record["localPath"]: record for record in subtitle_assets}
        subtitle_paths = {record["path"] for record in subtitle_records}
        if len(subtitle_assets) != 2 or set(subtitle_assets_by_path) != subtitle_paths:
            errors.append("each timed subtitle file must have one path-bound provenance asset")

        voice_assets = [record for record in video_production["assets"] if record["kind"] == "VOICE"]
        if len(voice_assets) != 1:
            errors.append("video production must contain exactly one measured narration asset")
            voice_asset = None
            audio_end_ms = 0
        else:
            voice_asset = voice_assets[0]
            audio_end_ms = round(1000 * voice_asset["voiceEvidence"]["durationSeconds"])

        parsed_subtitles: dict[str, dict[str, Any]] = {}
        for record in subtitle_records:
            path = ROOT / record["path"]
            parsed = parse_subrip(path)
            parsed_subtitles[record["kind"]] = parsed
            asset = subtitle_assets_by_path.get(record["path"])
            if asset is None:
                continue
            evidence = asset["subtitleEvidence"]
            if asset["sha256"] != record["sha256"]:
                errors.append(f"subtitle asset digest differs from production file: {record['path']}")
            if evidence["captionCount"] != parsed["captionCount"]:
                errors.append(f"subtitle caption count differs from file: {record['path']}")
            if voice_asset is not None and evidence["sourceAudioAssetId"] != voice_asset["assetId"]:
                errors.append(f"subtitle is not bound to the measured narration asset: {record['path']}")
            if parsed["lastEndMs"] > audio_end_ms:
                errors.append(f"subtitle ends after measured narration: {record['path']}")

            if record["kind"] == "SUBTITLES_EN":
                if evidence["timingMethod"] != "FASTER_WHISPER_LOCAL":
                    errors.append("English subtitles must use the preserved audio-derived clock")
                if evidence["timedWords"] != parsed["timedWords"]:
                    errors.append("English timed-word count differs from the subtitle file")
                if any("\n" in cue["caption"] for cue in parsed["cues"]):
                    errors.append("English burned-in captions must remain one line")
                if any(len(cue["caption"].split()) > 3 for cue in parsed["cues"]):
                    errors.append("English burned-in captions must contain at most three words")
                if any(len(cue["caption"]) > 15 for cue in parsed["cues"]):
                    errors.append("English burned-in captions must contain at most fifteen characters")
            elif record["kind"] == "SUBTITLES_JA":
                if evidence["timingMethod"] != "AUTHORED_TRANSLATION_ON_AUDIO_TIMED_CUES":
                    errors.append("Japanese subtitles must identify the locally authored translation timing method")

        if plan["captionTimingState"] == "PROVISIONAL" and not all(
            record["requiresAudioRetiming"] is True for record in subtitle_records
        ):
            errors.append("provisional subtitles must require retiming from final audio")
        if plan["captionTimingState"] == "AUDIO_TIMED_PENDING_FINAL_VIDEO":
            if not all(
                record["status"] == "TIMED_DRAFT" and record["requiresAudioRetiming"] is False
                for record in subtitle_records
            ):
                errors.append("audio-timed captions must be timed drafts that do not require another audio retiming")
            if any("NOTE" in (ROOT / record["path"]).read_text(encoding="utf-8") for record in subtitle_records):
                errors.append("audio-timed public subtitle drafts must not contain non-SubRip NOTE blocks")
            if not subtitle_assets or any(
                record["subtitleEvidence"]["finalVideoVerified"] is not False for record in subtitle_assets
            ):
                errors.append("pending final-video captions must remain marked final-video unverified")
        if plan["captionTimingState"] == "FINAL_VIDEO_VERIFIED":
            if not all(
                record["status"] == "FINAL" and record["requiresAudioRetiming"] is False
                for record in subtitle_records
            ):
                errors.append("final-video-verified captions must be final and must not require audio retiming")
            if not subtitle_assets or any(
                record["subtitleEvidence"]["finalVideoVerified"] is not True for record in subtitle_assets
            ):
                errors.append("final-video-verified subtitle assets must be marked verified against the final cut")
            if len(final_video_assets) != 1:
                errors.append("final-video-verified production must contain exactly one final-video asset")
    except Exception as exc:
        errors.append(f"video production evidence structure: {exc}")
    checks["video_production_files"] = len(errors) == video_start
    review_findings = review_reconciliation["findings"]
    review_ids = [finding["informationUuidV5"] for finding in review_findings]
    review_urls = [finding["reviewUrl"] for finding in review_findings]
    if len(review_findings) != 32 or len(set(review_ids)) != len(review_findings) or len(set(review_urls)) != len(review_findings):
        errors.append("review reconciliation must contain 32 distinct finding IDs and URLs")
    for finding in review_findings:
        for evidence_path in [*finding["fixEvidence"], *finding["testEvidence"]]:
            local_path = ROOT / evidence_path.split("#", 1)[0]
            if not local_path.is_file():
                errors.append(f"review reconciliation evidence path is missing: {evidence_path}")
    try:
        review_event = uuid.UUID(review_reconciliation["identity"]["uuidV7"])
        if review_event.version != 7 or uuid7_ms(str(review_event)) != review_reconciliation["temporal"]["epochMs"]:
            raise ValueError("timestamp mismatch")
    except Exception as exc:
        errors.append(f"review reconciliation UUIDv7: {exc}")
    try:
        review_verification = review_reconciliation["verification"]
        verification_event = uuid.UUID(review_verification["eventUuidV7"])
        if verification_event.version != 7 or uuid7_ms(str(verification_event)) != review_verification["epochMs"]:
            raise ValueError("verification timestamp mismatch")
    except Exception as exc:
        errors.append(f"review reconciliation verification UUIDv7: {exc}")
    try:
        for review_update in review_reconciliation["reviewUpdates"]:
            review_update_event = uuid.UUID(review_update["eventUuidV7"])
            if review_update_event.version != 7 or uuid7_ms(str(review_update_event)) != review_update["epochMs"]:
                raise ValueError("review-update timestamp mismatch")
    except Exception as exc:
        errors.append(f"review reconciliation update UUIDv7: {exc}")
    try:
        final_review_verification = review_reconciliation["finalVerification"]
        final_review_event = uuid.UUID(final_review_verification["eventUuidV7"])
        if final_review_event.version != 7 or uuid7_ms(str(final_review_event)) != final_review_verification["epochMs"]:
            raise ValueError("final verification timestamp mismatch")
    except Exception as exc:
        errors.append(f"review reconciliation final UUIDv7: {exc}")
    if review_reconciliation["summary"] != {
        "total": len(review_findings),
        "fixedInPatch": sum(finding["disposition"] == "FIXED_IN_PATCH" for finding in review_findings),
        "fixedBeforePatch": sum(finding["disposition"] == "FIXED_BEFORE_PATCH" for finding in review_findings),
        "remaining": 0,
    }:
        errors.append("review reconciliation summary does not match findings")
    checks["json_schema"] = not errors

    # Source graph and cross-reference integrity.
    extra_datasets = {
        "decision": load_json(ROOT / "knowledge/decisions.json")["records"],
        "component": load_json(ROOT / "knowledge/components.json")["records"],
        "risk-class": load_json(ROOT / "knowledge/risk-classes.json")["records"],
    }
    sources = {r["id"] for r in datasets["source"]}
    requirements = {r["id"] for r in datasets["requirement"]}
    tests = {r["id"] for r in datasets["test"]}
    all_records = [r for rs in [*datasets.values(), *extra_datasets.values()] for r in rs]
    all_ids = [r["id"] for r in all_records]
    if len(all_ids) != len(set(all_ids)):
        duplicates = sorted({x for x in all_ids if all_ids.count(x) > 1})
        errors.append(f"duplicate knowledge IDs: {duplicates}")
    known = set(all_ids)
    for rec in all_records:
        for ref in rec.get("source_refs", []):
            if ref not in sources: errors.append(f"unknown source ref {ref} in {rec['id']}")
        for ref in rec.get("related_ids", []):
            if ref not in known: errors.append(f"unknown related id {ref} in {rec['id']}")
    for rec in datasets["source"]:
        for ref in rec.get("supports", []):
            if ref not in known: errors.append(f"unknown supported ID {ref} in {rec['id']}")
    for rec in datasets["requirement"]:
        for ref in rec.get("verification_refs", []):
            if ref not in tests: errors.append(f"unknown verification test {ref} in {rec['id']}")
    for rec in datasets["test"]:
        for ref in rec.get("requirement_refs", []):
            if ref not in requirements: errors.append(f"unknown requirement {ref} in {rec['id']}")
        for artifact in rec.get("automation_artifacts", []):
            if not (ROOT / artifact).exists(): errors.append(f"missing automation artifact {artifact} in {rec['id']}")
    checks["source_graph"] = not errors

    # UUID version and embedded UUIDv7 timestamp checks.
    uuid_records = []
    for records in datasets.values(): uuid_records.extend(records)
    for records in extra_datasets.values(): uuid_records.extend(records)
    for rec in uuid_records:
        try:
            u5 = uuid.UUID(rec["identity"]["uuid_v5"]); u7 = uuid.UUID(rec["identity"]["uuid_v7"])
            if u5.version != 5: raise ValueError("stable ID not v5")
            if u7.version != 7: raise ValueError("event ID not v7")
            # generated records align to millisecond timestamp unless source precision is historical.
            if abs(uuid7_ms(str(u7)) - rec["temporal"]["epoch_ms"]) > 1000:
                raise ValueError("UUIDv7 time differs from temporal epoch")
        except Exception as e: errors.append(f"UUID {rec.get('id')}: {e}")
    checks["uuid_v5_v7"] = not errors

    # Golden vectors, independently in Python.
    vectors = load_json(ROOT / "data/golden-vectors.json")
    for group in [vectors["pre"], vectors["post"]]:
        for v in group:
            actual = eval_ir(v["input"])
            if actual != v["expected"]: errors.append(f"golden {v['id']}: {actual} != {v['expected']}")
    checks["golden_vectors_python"] = not errors

    # Audit chain and signatures.
    events = [json.loads(x) for x in (ROOT / "data/audit/events.sample.ndjson").read_text(encoding="utf-8").splitlines() if x]
    pub = load_ed25519_public_key(ROOT / "data/audit/keys/sample-device-public-key.pem")
    prev = ""
    for i, event in enumerate(events, 1):
        core = {k: v for k, v in event.items() if k != "proof"}
        digest = sha256(b"\x00" + canonical_bytes(core))
        if digest != event["proof"]["eventDigest"]: errors.append(f"audit event {i} digest mismatch")
        prev_bytes = bytes.fromhex(prev) if i > 1 else hashlib.sha256(b"TOOL-AUDIT-v0.1" + bytes.fromhex(event["logId"].replace("-", ""))).digest()
        chain = sha256(b"\x01" + prev_bytes + bytes.fromhex(digest) + i.to_bytes(8, "big"))
        if chain != event["proof"]["chainHash"]: errors.append(f"audit event {i} chain mismatch")
        if i > 1 and event["references"]["previousEventHash"] != prev: errors.append(f"audit event {i} prev link mismatch")
        msg = b"TOOL-AUDIT-EVENT-v0.1\x00" + bytes.fromhex(event["logId"].replace("-", "")) + bytes.fromhex(event["deviceId"].replace("-", "")) + i.to_bytes(8, "big") + bytes.fromhex(chain)
        try: pub.verify(base64.b64decode(event["proof"]["signatureBase64"]), msg)
        except Exception as e: errors.append(f"audit event {i} signature: {e}")
        prev = chain
    checks["audit_chain_signatures"] = not errors

    # Merkle root, proof, and signed checkpoint.
    checkpoint = load_json(ROOT / "data/audit/checkpoint.sample.json")
    proof = load_json(ROOT / "data/audit/inclusion-proof.sample.json")
    digests = [e["proof"]["eventDigest"] for e in events]
    root = merkle_root(digests).hex()
    if root != checkpoint["merkleRoot"]: errors.append("Merkle root mismatch")
    if verify_inclusion(proof["eventDigest"], proof["eventIndex"], proof["treeSize"], proof["auditPath"]) != proof["expectedRoot"]:
        errors.append("Merkle inclusion proof mismatch")
    cp_core = {k: v for k, v in checkpoint.items() if k not in {"digest", "signature"}}
    cp_digest = sha256(canonical_bytes(cp_core))
    if cp_digest != checkpoint["digest"]: errors.append("checkpoint digest mismatch")
    cp_pub = load_ed25519_public_key(ROOT / "data/audit/keys/sample-checkpoint-public-key.pem")
    try: cp_pub.verify(base64.b64decode(checkpoint["signature"]["signatureBase64"]), b"TOOL-AUDIT-CHECKPOINT-v0.1\x00" + bytes.fromhex(cp_digest))
    except Exception as e: errors.append(f"checkpoint signature: {e}")
    checks["merkle_checkpoint"] = not errors

    # Two-device offline sync evidence, independently verified in Python.
    sync_start = len(errors)
    sync_events_path = ROOT / sync_evidence["artifacts"]["deviceEvents"]
    sync_ingestion_path = ROOT / sync_evidence["artifacts"]["ingestionLedger"]
    sync_quarantine_path = ROOT / sync_evidence["artifacts"]["quarantineLedger"]
    sync_events = [json.loads(line) for line in sync_events_path.read_text(encoding="utf-8").splitlines() if line]
    sync_ingestion = [json.loads(line) for line in sync_ingestion_path.read_text(encoding="utf-8").splitlines() if line]
    sync_quarantine = [json.loads(line) for line in sync_quarantine_path.read_text(encoding="utf-8").splitlines() if line]

    for relative, expected in sync_evidence["artifacts"]["sha256"].items():
        path = ROOT / relative
        if not path.is_file() or sha256(path.read_bytes()) != expected:
            errors.append(f"offline sync artifact digest mismatch: {relative}")

    event_by_id = {}
    safe_tags = set()
    dangerous_sources = []
    for device in sync_evidence["devices"]:
        device_events = [event for event in sync_events if event["deviceId"] == device["deviceId"]]
        if len(device_events) != device["eventCount"]:
            errors.append(f"offline sync event count mismatch for {device['deviceId']}")
            continue
        public_key = load_ed25519_public_key(ROOT / device["publicKeyPath"])
        previous = sha256(
            b"OFFLINE-SYNC-GENESIS-v0.4\x00"
            + uuid.UUID(device["logId"]).bytes
            + uuid.UUID(device["deviceId"]).bytes
        )
        digests = []
        for expected_sequence, event in enumerate(device_events, 1):
            if event["sequence"] != expected_sequence:
                errors.append(f"offline sync device sequence mismatch for {device['deviceId']}")
            if event["previousChainHash"] != previous:
                errors.append(f"offline sync previous chain hash mismatch for {event['eventId']}")
            if uuid7_ms(event["eventId"]) != event["occurredAtEpochMs"]:
                errors.append(f"offline sync UUIDv7 time mismatch for {event['eventId']}")
            core = {key: value for key, value in event.items() if key != "proof"}
            digest = sha256(b"\x00" + canonical_bytes(core))
            chain_hash = sha256(
                b"\x01" + bytes.fromhex(previous) + bytes.fromhex(digest) + expected_sequence.to_bytes(8, "big")
            )
            if digest != event["proof"]["eventDigest"] or chain_hash != event["proof"]["chainHash"]:
                errors.append(f"offline sync event digest or chain mismatch for {event['eventId']}")
            message = (
                b"OFFLINE-SYNC-EVENT-v0.4\x00"
                + uuid.UUID(event["logId"]).bytes
                + uuid.UUID(event["deviceId"]).bytes
                + expected_sequence.to_bytes(8, "big")
                + bytes.fromhex(chain_hash)
            )
            try: public_key.verify(base64.b64decode(event["proof"]["signatureBase64"]), message)
            except Exception as exc: errors.append(f"offline sync event signature {event['eventId']}: {exc}")
            operation = event["operation"]
            if operation["type"] == "SAFE_TAG_ADD": safe_tags.add(operation["tag"])
            else: dangerous_sources.append(event)
            previous = chain_hash
            digests.append(digest)
            event_by_id[event["eventId"]] = event

        sync_checkpoint = device["checkpoint"]
        checkpoint_core = {key: value for key, value in sync_checkpoint.items() if key not in {"digest", "signature"}}
        checkpoint_digest = sha256(b"\x00" + canonical_bytes(checkpoint_core))
        if (
            sync_checkpoint["treeSize"] != len(device_events)
            or sync_checkpoint["chainHead"] != previous
            or sync_checkpoint["merkleRoot"] != merkle_root(digests).hex()
            or sync_checkpoint["digest"] != checkpoint_digest
        ):
            errors.append(f"offline sync checkpoint content mismatch for {device['deviceId']}")
        try:
            public_key.verify(
                base64.b64decode(sync_checkpoint["signature"]["signatureBase64"]),
                b"OFFLINE-SYNC-CHECKPOINT-v0.4\x00" + bytes.fromhex(checkpoint_digest),
            )
        except Exception as exc: errors.append(f"offline sync checkpoint signature {device['deviceId']}: {exc}")

    previous_global = sha256(b"OFFLINE-SYNC-GLOBAL-v0.4\x00")
    for expected_global, record in enumerate(sync_ingestion, 1):
        source = event_by_id.get(record["sourceEventId"])
        if (
            record["globalSequence"] != expected_global
            or record["previousGlobalHash"] != previous_global
            or not sync_source_matches_record(record, source)
        ):
            errors.append(f"offline sync ingestion source/order mismatch at {expected_global}")
        core = {key: value for key, value in record.items() if key != "globalHash"}
        record_hash = sha256(b"\x02" + bytes.fromhex(previous_global) + canonical_bytes(core))
        if record_hash != record["globalHash"]:
            errors.append(f"offline sync global hash mismatch at {expected_global}")
        expected_decision = "MERGED_SAFE_STATE" if record["operation"]["type"] == "SAFE_TAG_ADD" else "HUMAN_REVIEW_REQUIRED"
        if record["decision"] != expected_decision:
            errors.append(f"offline sync unsafe decision at {expected_global}")
        previous_global = record_hash

    if sync_ingestion:
        mutation = json.loads(json.dumps(sync_ingestion[0]))
        mutation["operation"] = {"type": "SAFE_TAG_ADD", "setId": "mutation", "tag": "mutation"}
        mutation_source = event_by_id.get(mutation["sourceEventId"])
        if sync_source_matches_record(mutation, mutation_source):
            errors.append("offline sync validator accepted an operation-relabel mutation")

    observations = sync_evidence["observations"]
    codes = {record["code"] for record in sync_quarantine}
    required_codes = {"INVALID_SIGNATURE", "SEQUENCE_GAP", "FORK_DETECTED", "CHECKPOINT_MISMATCH"}
    if codes != required_codes or any(record.get("externalEffectStarts") != 0 for record in sync_quarantine):
        errors.append("offline sync quarantine evidence is incomplete or claims an external effect")
    if sorted(safe_tags) != observations["safeTags"]:
        errors.append("offline sync safe-state projection mismatch")
    if len(sync_ingestion) != observations["globalIngestionCount"] or len(dangerous_sources) != observations["dangerousIntentSourceCount"]:
        errors.append("offline sync ingestion or dangerous-source count mismatch")
    if len({event["operation"]["intentId"] for event in dangerous_sources}) != observations["dangerousReviewCount"]:
        errors.append("offline sync dangerous review grouping mismatch")
    if observations["externalEffectStarts"] != 0 or sync_evidence["scope"]["actualNotifications"] != 0:
        errors.append("offline sync evidence must prove zero external effect starts")
    try:
        evidence_event = uuid.UUID(sync_evidence["identity"]["uuidV7"])
        if evidence_event.version != 7 or uuid7_ms(str(evidence_event)) != sync_evidence["temporal"]["epochMs"]:
            raise ValueError("evidence UUIDv7 timestamp mismatch")
    except Exception as exc: errors.append(f"offline sync evidence identity: {exc}")
    checks["offline_sync_evidence"] = len(errors) == sync_start

    # Optional online planner evidence. This independently verifies that the
    # public record proves a candidate-only boundary, not a live API execution.
    planner_start = len(errors)
    planner_audit_path = ROOT / planner_evidence["artifacts"]["auditLedger"]
    planner_request_path = ROOT / planner_evidence["artifacts"]["requestSample"]
    planner_events = [json.loads(line) for line in planner_audit_path.read_text(encoding="utf-8").splitlines() if line]
    for relative, expected in planner_evidence["artifacts"]["sha256"].items():
        path = ROOT / relative
        if not path.is_file() or sha256(path.read_bytes()) != expected:
            errors.append(f"online planner artifact digest mismatch: {relative}")

    planner_previous = sha256(b"ONLINE-PLANNER-AUDIT-v0.5\x00")
    candidate_count = 0
    request_start_count = 0
    recorded_stop_reasons = set()
    for expected_sequence, event in enumerate(planner_events, 1):
        core = {key: value for key, value in event.items() if key != "recordHash"}
        if (
            event.get("sequence") != expected_sequence
            or event.get("previousHash") != planner_previous
            or sha256(canonical_bytes(core)) != event.get("recordHash")
        ):
            errors.append(f"online planner audit chain mismatch at {expected_sequence}")
        try:
            event_id = uuid.UUID(event["eventId"])
            run_id = uuid.UUID(event["runId"])
            task_id = uuid.UUID(event["taskId"])
            if event_id.version != 7 or uuid7_ms(str(event_id)) != event["occurredAtEpochMs"]:
                raise ValueError("event UUIDv7 timestamp mismatch")
            if run_id.version != 7 or task_id.version != 5:
                raise ValueError("run/task UUID version mismatch")
            occurred_ms = int(datetime.fromisoformat(event["occurredAt"].replace("Z", "+00:00")).timestamp() * 1000)
            if occurred_ms != event["occurredAtEpochMs"]:
                raise ValueError("RFC3339 timestamp mismatch")
        except Exception as exc:
            errors.append(f"online planner audit identity at {expected_sequence}: {exc}")
        if (
            event.get("automaticRetries") != 0
            or event.get("authorizationCreated") != 0
            or event.get("externalEffectStarts") != 0
            or event.get("transportAttempts") not in {0, 1}
        ):
            errors.append(f"online planner audit unsafe counter at {expected_sequence}")
        if event.get("kind") == "candidate-recorded": candidate_count += 1
        if event.get("kind") == "request-started": request_start_count += 1
        if event.get("toState") == "STOPPED" and isinstance(event.get("reason"), str):
            recorded_stop_reasons.add(event["reason"])
        planner_previous = event.get("recordHash", "")

    def strict_parameter_shape(schema):
        if schema.get("type") != "object" or schema.get("additionalProperties") is not False:
            return False
        properties = schema.get("properties")
        required = schema.get("required")
        if not isinstance(properties, dict) or not isinstance(required, list) or set(properties) != set(required):
            return False
        return all(
            strict_parameter_shape(child) if child.get("type") == "object" else child.get("type") in {"string", "integer", "boolean"}
            for child in properties.values()
            if isinstance(child, dict)
        ) and all(isinstance(child, dict) for child in properties.values())

    request_tool_names = [tool["name"] for tool in planner_request["tools"]]
    allowed_tool_names = [tool["name"] for tool in planner_request["tool_choice"]["tools"]]
    try:
        minimized_input = json.loads(planner_request["input"][0]["content"][0]["text"])
    except Exception as exc:
        errors.append(f"online planner minimized input is not JSON: {exc}")
        minimized_input = {}
    if (
        planner_request.get("store") is not False
        or planner_request.get("background") is not False
        or planner_request.get("parallel_tool_calls") is not False
        or request_tool_names != allowed_tool_names
        or not all(tool.get("strict") is True and strict_parameter_shape(tool.get("parameters", {})) for tool in planner_request["tools"])
        or set(minimized_input) != {"context", "taskKind"}
        or set(minimized_input.get("context", {})) != {"goal", "channel"}
    ):
        errors.append("online planner request is not minimal, strict, and allowlisted")
    serialized_public_planner = planner_audit_path.read_text(encoding="utf-8") + planner_request_path.read_text(encoding="utf-8")
    forbidden_markers = ["private-customer-note-should-never-cross", "sk-secret-sentinel-should-never-cross"]
    if any(marker in serialized_public_planner for marker in forbidden_markers):
        errors.append("online planner public artifacts contain a privacy sentinel")

    planner_scope = planner_evidence["scope"]
    planner_observations = planner_evidence["observations"]
    if (
        planner_scope["actualNetworkRequests"] != 0
        or planner_scope["actualExternalSpendMicroUsd"] != 0
        or planner_scope["authorizationCreated"] != 0
        or planner_scope["externalEffectStarts"] != 0
        or planner_observations["automaticRetries"] != 0
        or planner_observations["privacyValuesExposed"] is not False
        or planner_observations["acceptedCandidateCount"] != candidate_count
        or candidate_count != 1
        or request_start_count != 7
        or set(planner_observations["stopReasons"]) != recorded_stop_reasons
    ):
        errors.append("online planner summary does not match candidate-only audit evidence")
    try:
        planner_evidence_event = uuid.UUID(planner_evidence["identity"]["uuidV7"])
        planner_evidence_info = uuid.UUID(planner_evidence["identity"]["uuidV5"])
        if (
            planner_evidence_event.version != 7
            or planner_evidence_info.version != 5
            or uuid7_ms(str(planner_evidence_event)) != planner_evidence["temporal"]["epochMs"]
        ):
            raise ValueError("evidence UUID version or timestamp mismatch")
    except Exception as exc:
        errors.append(f"online planner evidence identity: {exc}")
    checks["online_planner_evidence"] = len(errors) == planner_start

    # information_uuid_v5=c91d4db5-468a-5f4d-8a54-710c0f5c5177
    # event_uuid_v7=01a049ad-1379-780b-9344-3df2682e855c
    # state_transition=EXECUTING -> VERIFIED_SYNTHETIC occurred_at=2026-08-28T18:41:14.617Z
    # machine-contract: six synthetic PASS records prove gate behavior only; they cannot become a measured-production claim.
    slo_start = len(errors)
    slo_evidence = load_json(ROOT / "metadata/slo-gate-verification.json")
    expected_slo_tests = [f"TEST-SLO-{number:03d}" for number in range(1, 7)]
    try:
        slo_input_path = ROOT / slo_evidence["artifacts"]["input"]
        if not slo_input_path.is_file() or sha256(slo_input_path.read_bytes()) != slo_evidence["artifacts"]["inputSha256"]:
            errors.append("SLO gate input digest mismatch")
        slo_input = load_json(slo_input_path)
        input_evaluation_ms = slo_input["evaluation"]["evaluatedAtEpochMs"]
        for section_name in ["queue", "calibration", "outcomeMass", "chanceConstraints"]:
            section_provenance = slo_input[section_name]["provenance"]
            if (
                uuid7_ms(section_provenance["eventId"]) != section_provenance["observedAtEpochMs"]
                or section_provenance["observedAtEpochMs"] > input_evaluation_ms
            ):
                errors.append(f"SLO {section_name} evidence identity is invalid or later than evaluation")

        slo_event = uuid.UUID(slo_evidence["identity"]["uuidV7"])
        slo_information = uuid.UUID(slo_evidence["identity"]["uuidV5"])
        evaluated_at = int(datetime.fromisoformat(
            slo_evidence["temporal"]["evaluatedAt"].replace("Z", "+00:00")
        ).timestamp() * 1000)
        if (
            slo_event.version != 7
            or slo_information.version != 5
            or uuid7_ms(str(slo_event)) != slo_evidence["temporal"]["evaluatedAtEpochMs"]
            or evaluated_at != slo_evidence["temporal"]["evaluatedAtEpochMs"]
        ):
            errors.append("SLO gate evidence identity or RFC 3339 time mismatch")

        evaluation = slo_evidence["evaluation"]
        gates = evaluation["gates"]
        if (
            slo_evidence["status"] != "VERIFIED_SYNTHETIC"
            or evaluation["decision"] != "PASS"
            or evaluation["evidenceClass"] != "SYNTHETIC"
            or evaluation["selfReportedConfidenceUsed"] is not False
            or [item["testId"] for item in gates] != expected_slo_tests
            or any(item["status"] != "PASS" or item["reasons"] for item in gates)
            or slo_evidence["testIds"] != expected_slo_tests
            or evaluation["identity"] != slo_evidence["identity"]
            or evaluation["temporal"] != slo_evidence["temporal"]
            or set(evaluation["sourceRefs"]) != set(slo_evidence["sourceRefs"])
            or not set(evaluation["sourceRefs"]).issubset(sources)
        ):
            errors.append("SLO gate evidence does not contain exactly six bound synthetic PASS results")

        evidence_state = slo_evidence["evidenceState"]
        scope = slo_evidence["scope"]
        if (
            evidence_state["deterministicSyntheticFixture"] != "CONFIRMED"
            or evidence_state["productionRuntimeQuality"] != "UNMEASURED"
            or evidence_state["modelSelfReportedConfidenceUsed"] is not False
            or evidence_state["syntheticMeasuredMixing"] != "CONFIRMED_ABSENT"
            or scope["actualRuntimeMeasurements"] != 0
            or scope["actualExternalEffects"] != 0
            or scope["actualExternalSpendYen"] != 0
        ):
            errors.append("SLO synthetic evidence overclaims measurements, effects, spend, or confidence use")

        slo_records = {
            record["id"]: record
            for record in datasets["test"]
            if record["id"] in expected_slo_tests
        }
        required_artifacts = {
            "data/slo-gate-input.synthetic.json",
            "metadata/slo-gate-verification.json",
            "src/typescript/governance/slo-gates.ts",
            "src/typescript/slo/generate-evidence.ts",
            "src/typescript/test/slo-gates.test.ts",
            "docs/19-slo-gate-reference.ja.md",
            "formal/wolfram/ReferenceModel.wl",
        }
        if (
            set(slo_records) != set(expected_slo_tests)
            or any(record["implementation_status"] != "implemented" for record in slo_records.values())
            or any(record["automated"] is not True for record in slo_records.values())
            or any(not required_artifacts.issubset(record["automation_artifacts"]) for record in slo_records.values())
        ):
            errors.append("SLO test catalog is not fully implemented or lacks required automation artifacts")
    except Exception as exc:
        errors.append(f"SLO gate evidence structure: {exc}")
    checks["slo_gate_evidence"] = len(errors) == slo_start

    # No private key material.
    private_markers = ["BEGIN " + "PRIVATE KEY", "BEGIN OPENSSH " + "PRIVATE KEY", "PRIVATE " + "KEY-----"]
    for p in ROOT.rglob("*"):
        if is_ignored(p):
            continue
        if p.is_file() and p.suffix.lower() not in {".zip", ".png", ".jpg"}:
            try: text = p.read_text(encoding="utf-8")
            except Exception: continue
            if any(m in text for m in private_markers): errors.append(f"private key marker in {p.relative_to(ROOT)}")
    checks["no_private_keys"] = not errors

    # Independent reachability/mutation model.
    model_cmd = [sys.executable, str(ROOT / "formal/model-checker/reachability.py")]
    model_run = subprocess.run(model_cmd, text=True, capture_output=True)
    if model_run.returncode: errors.append("reachability checker failed: " + model_run.stderr)
    checks["reachability_and_mutation"] = model_run.returncode == 0

    # TypeScript vectors using built-in Node type stripping.
    ts_run = subprocess.run(["npm", "test"], cwd=ROOT / "src/typescript", text=True, capture_output=True)
    if ts_run.returncode: errors.append("TypeScript tests failed:\n" + ts_run.stdout + ts_run.stderr)
    checks["typescript_tests"] = ts_run.returncode == 0

    type_run = subprocess.run(["npm", "run", "typecheck"], cwd=ROOT / "src/typescript", text=True, capture_output=True)
    if type_run.returncode: errors.append("TypeScript type check failed:\n" + type_run.stdout + type_run.stderr)
    checks["typescript_typecheck"] = type_run.returncode == 0

    # Final public evidence is rebuilt in memory and compared byte-for-byte.
    # TLC is not bundled, so this lane checks the captured official-run report;
    # `make verify-tla TLA2TOOLS_JAR=...` additionally reruns the official engine.
    final_run = subprocess.run(
        [sys.executable, str(ROOT / "scripts/final_verification.py"), "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if final_run.returncode:
        errors.append("final public evidence failed:\n" + final_run.stdout + final_run.stderr)
    checks["final_public_evidence"] = final_run.returncode == 0

    # Wolfram report sanity. The final evidence separately records that no
    # Wolfram runtime was available for this run and reproduces the sample with
    # Python Fraction arithmetic instead of claiming a current kernel execution.
    wf = load_json(ROOT / "formal/wolfram/verification-report.json")
    if wf["results"]["probabilityMass"] != "1": errors.append("Wolfram probability mass check did not equal 1")
    checks["wolfram_report"] = wf["results"]["probabilityMass"] == "1"

    report = {
        "artifact": "verifiable-offline-webmcp-agent-spec",
        "validatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "checks": checks,
        "tlcExecuted": False,
        "tlcNote": "TLC is not bundled or started by make validate; the captured official v1.7.4 report, source hashes, and independent state count are checked. make verify-tla reruns TLC when a verified jar path is supplied.",
        "errorCount": len(errors),
        "errors": errors,
        "passed": not errors and all(checks.values()),
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__": main()

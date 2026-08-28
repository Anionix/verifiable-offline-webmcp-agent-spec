#!/usr/bin/env python3
# information_uuid_v5=cd034fcd-9a4a-5d32-bea8-375d2511206c
# event_uuid_v7=01a04895-5146-74b1-af5b-00e8ce98730d
# machine-contract: live notification evidence must preserve a valid hash chain, one effect claim, and an auditable suppressed retry.
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

import yaml
from cryptography.hazmat.primitives import serialization
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[1]
SCALE = 1_000_000
IGNORED_PARTS = {".git", ".jj", ".local", ".venv", "node_modules", "__pycache__"}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    errors = []
    checks = {}

    # Parse JSON, NDJSON, and YAML.
    for p in ROOT.rglob("*.json"):
        try: load_json(p)
        except Exception as e: errors.append(f"JSON {p.relative_to(ROOT)}: {e}")
    for p in ROOT.rglob("*.ndjson"):
        for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if line.strip():
                try: json.loads(line)
                except Exception as e: errors.append(f"NDJSON {p.relative_to(ROOT)}:{n}: {e}")
    for p in [*ROOT.rglob("*.yaml"), *ROOT.rglob("*.yml")]:
        try: yaml.safe_load(p.read_text(encoding="utf-8"))
        except Exception as e: errors.append(f"YAML {p.relative_to(ROOT)}: {e}")
    checks["structured_parse"] = not errors

    # Live browser-notification evidence: independently bind the public summary
    # to the captured transition stream without trusting the local SQLite file.
    live_start = len(errors)
    live_path = ROOT / "data/audit/notification-demo-live-events.ndjson"
    live_events = [json.loads(line) for line in live_path.read_text(encoding="utf-8").splitlines() if line]
    live_evidence = load_json(ROOT / "metadata/notification-demo-live-verification.json")
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
        previous_hash = event_hash
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
    pub = serialization.load_pem_public_key((ROOT / "data/audit/keys/sample-device-public-key.pem").read_bytes())
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
    cp_pub = serialization.load_pem_public_key((ROOT / "data/audit/keys/sample-checkpoint-public-key.pem").read_bytes())
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
        public_key = serialization.load_pem_public_key((ROOT / device["publicKeyPath"]).read_bytes())
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
            or source is None
            or source["proof"]["eventDigest"] != record["sourceEventDigest"]
            or source["proof"]["chainHash"] != record["sourceChainHash"]
            or source["sequence"] != record["deviceSequence"]
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

    # No private key material.
    private_markers = ["BEGIN " + "PRIVATE KEY", "BEGIN OPENSSH " + "PRIVATE KEY", "PRIVATE " + "KEY-----"]
    for p in ROOT.rglob("*"):
        if any(part in IGNORED_PARTS for part in p.parts):
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

    # Wolfram report sanity (actual evaluator output was captured at generation time).
    wf = load_json(ROOT / "formal/wolfram/verification-report.json")
    if wf["results"]["probabilityMass"] != "1": errors.append("Wolfram probability mass check did not equal 1")
    checks["wolfram_report"] = wf["results"]["probabilityMass"] == "1"

    report = {
        "artifact": "verifiable-offline-webmcp-agent-spec",
        "validatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "checks": checks,
        "tlcExecuted": False,
        "tlcNote": "TLA+ specification is provided; TLC is not bundled or executed by this local validation script.",
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

#!/usr/bin/env python3
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

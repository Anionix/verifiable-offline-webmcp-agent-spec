#!/usr/bin/env python3
"""Idempotently connect verification records to implemented automation."""

# information_uuid_v5=093921fd-513a-55b3-9e34-1e2e3f9f97e5
# event_uuid_v7=01a04966-f72d-78c1-9eac-494c46d4232e
# machine-contract: specified|partially-implemented -> implemented only when named automation artifacts exist; rerunning the same transition is byte-stable.
from __future__ import annotations

import argparse
import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from build_manifest import deterministic_uuid7


def utc_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
        raise argparse.ArgumentTypeError("occurred-at must be an RFC 3339 UTC timestamp")
    return parsed.astimezone(timezone.utc)


def render_utc(value: datetime) -> str:
    return value.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def restore_information_time(record: dict) -> None:
    """Keep immutable information time separate from later status-transition time."""
    identity_ms = int(uuid.UUID(record["identity"]["uuid_v7"])) >> 80
    created = datetime.fromisoformat(record["temporal"]["created_at"].replace("Z", "+00:00"))
    if int(created.timestamp() * 1000) != identity_ms:
        raise ValueError(f"identity and created_at differ for {record['id']}")
    record["temporal"]["updated_at"] = record["temporal"]["created_at"]
    record["temporal"]["observed_at"] = record["temporal"]["created_at"]
    record["temporal"]["epoch_ms"] = identity_ms
    record["temporal"]["local_rendering"] = created.astimezone(
        ZoneInfo(record["temporal"].get("local_time_zone", "Asia/Tokyo"))
    ).isoformat(timespec="milliseconds")


def promote(
    document: dict,
    test_ids: list[str],
    artifacts: list[str],
    observed: datetime,
    scope: str,
    repository_root: Path,
) -> dict:
    requested = set(test_ids)
    if len(requested) != len(test_ids):
        raise ValueError("duplicate test id")
    missing_artifacts = [item for item in artifacts if not (repository_root / item).is_file()]
    if missing_artifacts:
        raise FileNotFoundError(f"automation artifacts do not exist: {missing_artifacts}")
    seen: set[str] = set()
    for record in document["records"]:
        test_id = record.get("id")
        if test_id not in requested:
            continue
        seen.add(test_id)
        previous = record["implementation_status"]
        if previous not in {"specified", "partially-implemented", "implemented"}:
            raise ValueError(f"unsupported implementation status for {test_id}: {previous}")
        record["implementation_status"] = "implemented"
        record["automated"] = True
        record["automation_artifacts"] = sorted(set(record.get("automation_artifacts", [])) | set(artifacts))
        restore_information_time(record)
        if previous != "implemented":
            occurred_at = render_utc(observed)
            record["status_transition"] = {
                "event_uuid_v7": str(deterministic_uuid7(
                    observed,
                    f"test-status/{test_id}/{previous}/implemented",
                )),
                "occurred_at": occurred_at,
                "from": previous,
                "to": "implemented",
                "scope": scope,
            }
    missing = requested - seen
    if missing:
        raise KeyError(f"unknown test ids: {sorted(missing)}")
    return document


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("knowledge/tests.json"))
    parser.add_argument("--test-id", action="append", required=True)
    parser.add_argument("--artifact", action="append", required=True)
    parser.add_argument("--occurred-at", type=utc_time, required=True)
    parser.add_argument("--scope", required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    source = args.input.resolve()
    repository_root = Path(__file__).resolve().parent.parent
    original = source.read_text(encoding="utf-8")
    document = json.loads(original)
    promoted = promote(
        document,
        args.test_id,
        args.artifact,
        args.occurred_at,
        args.scope,
        repository_root,
    )
    rendered = json.dumps(promoted, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if rendered != original:
            raise SystemExit("verification records need promotion")
        return
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=source.parent,
        prefix=f".{source.name}.",
        delete=False,
    ) as handle:
        handle.write(rendered)
        temporary = Path(handle.name)
    try:
        os.replace(temporary, source)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()

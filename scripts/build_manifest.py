#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMESPACE = uuid.UUID("47f3e535-0e27-559a-9556-aa79a84f95eb")
MANIFEST_NAME = "MANIFEST.sha256"
CATALOG_PATH = "metadata/file-catalog.json"
EXCLUDED_PARTS = {".git", ".jj", ".local", ".playwright-mcp", ".venv", ".vercel", ".wrangler", "dist", "node_modules", "__pycache__"}
EXCLUDED_FILES = {".DS_Store", "results.sarif"}
# information_uuid_v5=50ced5c7-92a0-5047-b4c0-aafb22a1edcb
# event_uuid_v7=01a048ca-67e3-7b0f-9c74-2f7092340b03
# machine-contract: host-only ignored caches never influence a reproducible public artifact catalog.
# event_uuid_v7=01a04911-1637-7280-bf9b-a78e7c382617 state_transition=CI_REJECTED_HOST_ARTIFACTS->PUBLIC_CATALOG_EXCLUDES_BROWSER_OUTPUT occurred_at=2026-08-28T15:50:51.703Z
# event_uuid_v7=01a04a6f-c8b1-744f-b991-fae38fe1d803 state_transition=PUBLIC_SITE_BUILT->GENERATED_DIST_EXCLUDED occurred_at=2026-08-28T22:06:43Z
# event_uuid_v7=01a04b33-fcac-7667-afd1-01da71a4131b state_transition=HOST_RUNTIME_CREATED->WRANGLER_STATE_EXCLUDED occurred_at=2026-08-29T01:48:13.356Z
# event_uuid_v7=01a04bdb-34bf-766c-b47a-d92e201fd28f state_transition=VERCEL_PROJECT_LINKED->VERCEL_HOST_STATE_EXCLUDED occurred_at=2026-08-29T04:50:55.000Z
EXCLUDED_PATHS = {".impeccable/hook.cache.json"}
MEDIA_TYPES = {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jsonld": "application/ld+json",
    ".md": "text/markdown",
    ".ndjson": "application/x-ndjson",
    ".pem": "application/x-pem-file",
    ".py": "text/x-python",
    ".toml": "application/toml",
    ".ts": "text/typescript",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
}


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest_path(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def deterministic_uuid7(observed: datetime, seed: str) -> uuid.UUID:
    """Return a reproducible UUIDv7 for a generated catalog revision."""
    epoch_ms = int(observed.timestamp() * 1000)
    random_bits = hashlib.sha256(seed.encode("utf-8")).digest()
    random_a = int.from_bytes(random_bits[:2], "big") & 0xFFF
    random_b = int.from_bytes(random_bits[2:10], "big") & ((1 << 62) - 1)
    value = (
        ((epoch_ms & ((1 << 48) - 1)) << 80)
        | (7 << 76)
        | (random_a << 64)
        | (2 << 62)
        | random_b
    )
    return uuid.UUID(int=value)


def temporal(observed: datetime) -> dict[str, object]:
    value = observed.astimezone(timezone.utc)
    return {
        "observed_at": value.isoformat().replace("+00:00", "Z"),
        "epoch_ms": int(value.timestamp() * 1000),
        "time_zone": "UTC",
        "precision": "millisecond",
    }


def identity(relative_path: str, observed: datetime) -> dict[str, str]:
    return {
        "uuid_v5": str(uuid.uuid5(NAMESPACE, "file/" + relative_path.lower())),
        "uuid_v7": str(deterministic_uuid7(observed, relative_path)),
        "uuid_namespace": str(NAMESPACE),
    }


def media_type(relative_path: str) -> str:
    return MEDIA_TYPES.get(Path(relative_path).suffix.lower(), "application/octet-stream")


def source_paths() -> list[Path]:
    paths: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in EXCLUDED_PARTS for part in path.parts):
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative in {MANIFEST_NAME, CATALOG_PATH} or relative in EXCLUDED_PATHS or path.name in EXCLUDED_FILES:
            continue
        paths.append(path)
    return sorted(paths, key=lambda item: item.relative_to(ROOT).as_posix())


def build_outputs() -> tuple[bytes, bytes, int]:
    artifact = json.loads((ROOT / "metadata/artifact.json").read_text(encoding="utf-8"))
    base = datetime.fromisoformat(artifact["temporal"]["observed_at"].replace("Z", "+00:00"))
    paths = source_paths()
    rows: list[dict[str, object]] = []
    for index, path in enumerate(paths):
        relative = path.relative_to(ROOT).as_posix()
        observed = base + timedelta(milliseconds=index)
        rows.append({
            "path": relative,
            "sha256": digest_path(path),
            "bytes": path.stat().st_size,
            "mediaType": media_type(relative),
            "category": relative.split("/", 1)[0] if "/" in relative else "root",
            "identity": identity(relative, observed),
            "temporal": temporal(observed),
            "selfReferentialHashOmitted": False,
        })
    omissions = [
        (CATALOG_PATH, "The catalog cannot embed its own final digest; MANIFEST.sha256 authenticates it."),
        (MANIFEST_NAME, "The checksum manifest cannot contain its own final digest."),
    ]
    for relative, reason in omissions:
        observed = base + timedelta(milliseconds=len(rows))
        rows.append({
            "path": relative,
            "sha256": None,
            "bytes": None,
            "mediaType": media_type(relative),
            "category": relative.split("/", 1)[0],
            "identity": identity(relative, observed),
            "temporal": temporal(observed),
            "selfReferentialHashOmitted": True,
            "omissionReason": reason,
        })
    rows.sort(key=lambda row: str(row["path"]))
    catalog = {
        "identity": {
            "uuid_v5": str(uuid.uuid5(NAMESPACE, "catalog/file-catalog")),
            "uuid_v7": str(deterministic_uuid7(base, "catalog/file-catalog")),
            "uuid_namespace": str(NAMESPACE),
        },
        "temporal": temporal(base),
        "recordCount": len(rows),
        "selfHashPolicy": "Self-referential digests are null; MANIFEST.sha256 authenticates the generated catalog.",
        "files": rows,
    }
    catalog_bytes = (json.dumps(catalog, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    manifest_rows = [
        f"{digest_path(path)}  {path.relative_to(ROOT).as_posix()}"
        for path in paths
    ]
    manifest_rows.append(f"{digest_bytes(catalog_bytes)}  {CATALOG_PATH}")
    manifest_bytes = ("\n".join(sorted(manifest_rows)) + "\n").encode("utf-8")
    return catalog_bytes, manifest_bytes, len(rows)


def explain_stale(expected: dict[Path, bytes]) -> None:
    """Print bounded, secret-free diagnostics without changing tracked files."""
    catalog_path = ROOT / CATALOG_PATH
    expected_catalog = json.loads(expected[catalog_path])
    actual_catalog = json.loads(catalog_path.read_bytes()) if catalog_path.exists() else {"files": []}
    expected_rows = {row["path"]: row for row in expected_catalog.get("files", [])}
    actual_rows = {row["path"]: row for row in actual_catalog.get("files", [])}
    for path in sorted(set(expected_rows) | set(actual_rows)):
        expected_row = expected_rows.get(path)
        actual_row = actual_rows.get(path)
        if expected_row != actual_row:
            if expected_row is None:
                print(f"catalog unexpected path: {path}")
            elif actual_row is None:
                print(f"catalog missing path: {path}")
            else:
                changed = sorted(key for key in set(expected_row) | set(actual_row) if expected_row.get(key) != actual_row.get(key))
                print(f"catalog changed path: {path}; fields: {', '.join(changed)}")

    manifest_path = ROOT / MANIFEST_NAME
    expected_lines: set[str] = set(expected[manifest_path].decode("utf-8").splitlines())
    actual_lines: set[str] = set(manifest_path.read_text(encoding="utf-8").splitlines()) if manifest_path.exists() else set()
    for line in sorted(expected_lines - actual_lines)[:20]:
        digest, _, path = line.partition("  ")
        print(f"manifest expected: {path} sha256={digest}")
    for line in sorted(actual_lines - expected_lines)[:20]:
        digest, _, path = line.partition("  ")
        print(f"manifest actual: {path} sha256={digest}")


def main() -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()
    catalog_bytes, manifest_bytes, count = build_outputs()
    expected = {
        ROOT / CATALOG_PATH: catalog_bytes,
        ROOT / MANIFEST_NAME: manifest_bytes,
    }
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, content in expected.items() if not path.exists() or path.read_bytes() != content]
        if stale:
            explain_stale(expected)
            raise SystemExit("generated integrity files are stale: " + ", ".join(stale))
        print(f"integrity files verified for {count} catalog records")
        return
    for path, content in expected.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    print(f"cataloged {count} files reproducibly")


if __name__ == "__main__":
    main()

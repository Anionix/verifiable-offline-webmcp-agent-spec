#!/usr/bin/env python3
"""Generate stable UUIDv5 semantic IDs and RFC 9562 UUIDv7 event IDs."""
from __future__ import annotations
import argparse, json, secrets, time, uuid

ROOT_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "github.com/open-knowledge/verifiable-offline-webmcp-agent-spec")

def stable(category: str, name: str) -> uuid.UUID:
    return uuid.uuid5(ROOT_NAMESPACE, f"{category.strip().lower()}/{name.strip().lower()}")

def event(epoch_ms: int | None = None) -> uuid.UUID:
    ms = int(time.time() * 1000) if epoch_ms is None else epoch_ms
    value = ((ms & ((1 << 48) - 1)) << 80) | (7 << 76) | (secrets.randbits(12) << 64) | (2 << 62) | secrets.randbits(62)
    return uuid.UUID(int=value)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("category")
    ap.add_argument("name")
    ap.add_argument("--epoch-ms", type=int)
    a = ap.parse_args()
    print(json.dumps({"namespace": str(ROOT_NAMESPACE), "uuid_v5": str(stable(a.category, a.name)), "uuid_v7": str(event(a.epoch_ms))}, indent=2))
if __name__ == "__main__": main()

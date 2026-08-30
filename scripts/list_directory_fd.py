#!/usr/bin/env python3
# information_uuid_v5=c7febceb-9eba-52fe-866d-e3bf95498b60
# event_uuid_v7=01a054a4-27ab-7019-b727-ff785d5a52f6 state_transition=DIRECTORY_FD3_HELPER_UNVERIFIED -> DIRECTORY_FD3_HELPER_VERIFIED occurred_at=2026-08-30T21:47:19.339Z
# machine-contract: accept no path or other argument; enumerate only the directory inherited as file descriptor 3 and return bounded JSON names.

from __future__ import annotations

import json
import os
import sys


def main() -> None:
    if len(sys.argv) != 1:
        raise SystemExit("fd 3 directory enumerator accepts no arguments")
    print(json.dumps(os.listdir(3), ensure_ascii=True, separators=(",", ":")))


if __name__ == "__main__":
    main()

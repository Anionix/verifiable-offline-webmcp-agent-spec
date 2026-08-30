#!/usr/bin/env python3
# information_uuid_v5=c7febceb-9eba-52fe-866d-e3bf95498b60
# event_uuid_v7=01a054bb-6f19-7b12-857a-453b7df85cb7 state_transition=BOUND_ROOT_RELATIVE_ACCESS_UNVERIFIED -> BOUND_ROOT_RELATIVE_ACCESS_VERIFIED occurred_at=2026-08-30T22:12:44.953Z
# machine-contract: accept no path or other argument; receive only fd 3 and a strict relative-component request on stdin.

from __future__ import annotations

import errno
import json
import os
import stat
import sys
from typing import Any, NoReturn

ROOT_FD = 3
MAX_REQUEST_BYTES = 128 * 1024
MAX_COMPONENTS = 256
MAX_COMPONENT_BYTES = 255
MAX_DIRECTORY_ENTRIES = 4_096
MAX_FILE_BYTES = 8 * 1024 * 1024
DIRECTORY_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
FILE_FLAGS = os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW
REQUEST_KEYS = {"operation", "components", "expectedAncestors", "expectedIdentity"}


def fail(message: str) -> NoReturn:
    raise ValueError(message)


def component_list(value: Any, label: str) -> list[str]:
    if not isinstance(value, list):
        fail(f"{label} must be an array")
    if len(value) > MAX_COMPONENTS:
        fail(f"{label} has too many components")
    components: list[str] = []
    for component in value:
        if not isinstance(component, str):
            fail(f"{label} contains a non-string component")
        if (
            not component
            or component in {".", ".."}
            or "/" in component
            or "\\" in component
            or "\x00" in component
            or len(component.encode("utf-8", "surrogatepass")) > MAX_COMPONENT_BYTES
        ):
            fail(f"{label} contains an unsafe component")
        components.append(component)
    return components


def identity_from_stat(value: os.stat_result) -> dict[str, str]:
    if stat.S_ISREG(value.st_mode):
        kind = "file"
    elif stat.S_ISDIR(value.st_mode):
        kind = "directory"
    elif stat.S_ISLNK(value.st_mode):
        kind = "symbolic link"
    else:
        kind = "special file"
    return {"dev": str(value.st_dev), "ino": str(value.st_ino), "type": kind}


def identity_value(value: Any, label: str) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != {"dev", "ino", "type"}:
        fail(f"{label} must be an identity object")
    if not isinstance(value["dev"], str) or not value["dev"].isdigit():
        fail(f"{label}.dev must be a decimal string")
    if not isinstance(value["ino"], str) or not value["ino"].isdigit():
        fail(f"{label}.ino must be a decimal string")
    if value["type"] not in {"file", "directory", "symbolic link", "special file"}:
        fail(f"{label}.type is invalid")
    return {"dev": value["dev"], "ino": value["ino"], "type": value["type"]}


def same_identity(actual: dict[str, str], expected: dict[str, str], label: str) -> None:
    if actual != expected:
        fail(f"{label} identity changed")


def open_verified_directories(components: list[str], expected_ancestors: list[dict[str, Any]]) -> list[int]:
    if len(expected_ancestors) != len(components) + 1:
        fail("expected ancestor chain length does not match directory path")
    descriptors = [os.dup(ROOT_FD)]
    try:
        root_identity = identity_from_stat(os.fstat(descriptors[0]))
        same_identity(root_identity, identity_value(expected_ancestors[0]["identity"], "root identity"), "root")
        if component_list(expected_ancestors[0]["components"], "root components") != []:
            fail("root ancestor must have no components")
        for index, component in enumerate(components, start=1):
            expected = expected_ancestors[index]
            expected_components = component_list(expected["components"], f"ancestor {index} components")
            if expected_components != components[:index]:
                fail(f"ancestor {index} components do not match target")
            try:
                descriptor = os.open(component, DIRECTORY_FLAGS, dir_fd=descriptors[-1])
            except OSError as error:
                detail = error.strerror or "operating-system error"
                raise OSError(error.errno, f"ancestor {index} component {component}: {detail}") from error
            descriptors.append(descriptor)
            actual = identity_from_stat(os.fstat(descriptor))
            same_identity(actual, identity_value(expected["identity"], f"ancestor {index} identity"), f"ancestor {index}")
        return descriptors
    except Exception:
        close_descriptors(descriptors)
        raise


def close_descriptors(descriptors: list[int]) -> None:
    for descriptor in reversed(descriptors):
        os.close(descriptor)


def expected_identity(request: dict[str, Any]) -> dict[str, str] | None:
    value = request["expectedIdentity"]
    return None if value is None else identity_value(value, "expected identity")


def list_directory(request: dict[str, Any]) -> dict[str, Any]:
    components = component_list(request["components"], "components")
    expected_ancestors = request["expectedAncestors"]
    if not isinstance(expected_ancestors, list):
        fail("expectedAncestors must be an array")
    if request["expectedIdentity"] is None:
        fail("directory listing requires an expected identity")
    descriptors = open_verified_directories(components, expected_ancestors)
    try:
        actual = identity_from_stat(os.fstat(descriptors[-1]))
        same_identity(actual, expected_identity(request) or {}, "directory")
        names = os.listdir(descriptors[-1])
        if len(names) > MAX_DIRECTORY_ENTRIES:
            fail("directory entry count exceeded its limit")
        for name in names:
            component_list([name], "directory entry")
        same_identity(identity_from_stat(os.fstat(descriptors[-1])), actual, "directory after listing")
        return {"operation": "list", "identity": actual, "entries": names, "bytes": 0}
    finally:
        close_descriptors(descriptors)


def stat_entry(request: dict[str, Any]) -> dict[str, Any]:
    components = component_list(request["components"], "components")
    if not components:
        fail("stat requires a non-root component")
    expected_ancestors = request["expectedAncestors"]
    if not isinstance(expected_ancestors, list):
        fail("expectedAncestors must be an array")
    descriptors = open_verified_directories(components[:-1], expected_ancestors)
    try:
        value = os.stat(components[-1], dir_fd=descriptors[-1], follow_symlinks=False)
        actual = identity_from_stat(value)
        expected = expected_identity(request)
        if expected is not None:
            same_identity(actual, expected, "entry")
        return {"operation": "stat", "identity": actual, "bytes": 0}
    finally:
        close_descriptors(descriptors)


def read_entry(request: dict[str, Any]) -> tuple[dict[str, Any], bytes]:
    components = component_list(request["components"], "components")
    if not components:
        fail("read requires a non-root component")
    expected_ancestors = request["expectedAncestors"]
    if not isinstance(expected_ancestors, list):
        fail("expectedAncestors must be an array")
    expected = expected_identity(request)
    if expected is None:
        fail("file read requires an expected identity")
    descriptors = open_verified_directories(components[:-1], expected_ancestors)
    file_descriptor: int | None = None
    try:
        file_descriptor = os.open(components[-1], FILE_FLAGS, dir_fd=descriptors[-1])
        opened = identity_from_stat(os.fstat(file_descriptor))
        if opened["type"] != "file":
            fail("file must be regular")
        same_identity(opened, expected, "file")
        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = os.read(file_descriptor, min(1024 * 1024, MAX_FILE_BYTES - total + 1))
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_FILE_BYTES:
                fail("file exceeds byte limit")
            chunks.append(chunk)
        same_identity(identity_from_stat(os.fstat(file_descriptor)), opened, "file after read")
        return ({"operation": "read", "identity": opened, "bytes": total}, b"".join(chunks))
    finally:
        if file_descriptor is not None:
            os.close(file_descriptor)
        close_descriptors(descriptors)


def parse_request() -> dict[str, Any]:
    raw = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
    if len(raw) > MAX_REQUEST_BYTES:
        fail("request exceeds byte limit")
    try:
        request = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"invalid request: {error.__class__.__name__}")
    if not isinstance(request, dict) or set(request) != REQUEST_KEYS:
        fail("request keys are invalid")
    if request["operation"] not in {"list", "stat", "read"}:
        fail("operation is invalid")
    component_list(request["components"], "components")
    if not isinstance(request["expectedAncestors"], list):
        fail("expectedAncestors must be an array")
    if not request["expectedAncestors"]:
        fail("expectedAncestors must include the root")
    for index, ancestor in enumerate(request["expectedAncestors"]):
        if not isinstance(ancestor, dict) or set(ancestor) != {"components", "identity"}:
            fail(f"ancestor {index} is invalid")
        component_list(ancestor["components"], f"ancestor {index} components")
        identity_value(ancestor["identity"], f"ancestor {index} identity")
        if ancestor["identity"]["type"] != "directory":
            fail(f"ancestor {index} is not a directory")
    if request["expectedIdentity"] is not None:
        identity_value(request["expectedIdentity"], "expected identity")
    return request


def emit(response: dict[str, Any], payload: bytes = b"") -> None:
    header = json.dumps(response, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(header + b"\n" + payload)


def main() -> None:
    if len(sys.argv) != 1:
        raise SystemExit("bound-root helper accepts no arguments")
    request = parse_request()
    os.fstat(ROOT_FD)
    if request["operation"] == "list":
        emit(list_directory(request))
    elif request["operation"] == "stat":
        emit(stat_entry(request))
    else:
        response, payload = read_entry(request)
        emit(response, payload)


if __name__ == "__main__":
    try:
        main()
    except OSError as error:
        code = errno.errorcode.get(error.errno, "OSError") if error.errno is not None else "OSError"
        detail = error.strerror or "operating-system error"
        raise SystemExit(f"bound-root helper rejected request: {code}: {detail}")
    except (ValueError, TypeError) as error:
        raise SystemExit(f"bound-root helper rejected request: {error}")

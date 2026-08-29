#!/usr/bin/env python3
# information_uuid_v5=0295e1e4-5327-5304-8f27-a63d49de4ba3
# event_uuid_v7=01a04c99-d1c3-776e-9e68-78f0ce19ce97 state_transition=PYTHON_TYPE_ANALYSIS_UNCONFIGURED -> VERSION_PINNED -> PROJECT_SCOPE_CONFIGURED -> TYPE_CHECKS_PASSED -> LANGUAGE_SERVER_HANDSHAKES_VERIFIED occurred_at=2026-08-29T08:19:04.259Z
# machine-contract: local version pins, configured project scope, successful type checks, and successful language-server handshakes must all agree before this validator passes.
from __future__ import annotations

import json
import os
import select
import shutil
import subprocess
import time
import tomllib
import uuid
from pathlib import Path
from typing import Any, TypedDict, cast

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
PYPROJECT_PATH = ROOT / "pyproject.toml"
LOCK_PATH = ROOT / "uv.lock"
EVIDENCE_PATH = ROOT / "metadata/python-type-tools.json"
SCHEMA_PATH = ROOT / "schemas/python-type-tools.schema.json"
EXPECTED_PYTHON_VERSION = "3.12"
EXPECTED_SOURCE_PATHS = ["scripts", "formal/model-checker"]
EXPECTED_PYTHON_FILES = [
    "formal/model-checker/reachability.py",
    "scripts/build_manifest.py",
    "scripts/final_verification.py",
    "scripts/generate_ids.py",
    "scripts/promote_tests.py",
    "scripts/validate_python_type_tools.py",
    "scripts/validate_repo.py",
]


class ToolExpectation(TypedDict):
    version: str
    versionOutput: str
    macosArm64WheelSha256: str
    typeCheck: list[str]
    languageServer: list[str]


EXPECTED_TOOLS: dict[str, ToolExpectation] = {
    "ty": {
        "version": "0.0.75",
        "versionOutput": "ty 0.0.75",
        "macosArm64WheelSha256": "c6ccf34169821fe0d23e3360deeef981d217963412f1d087b9bdd32ec57f7a57",
        "typeCheck": ["ty", "check", "--output-format", "concise", "--no-progress", "--color", "never"],
        "languageServer": ["ty", "server"],
    },
    "pyrefly": {
        "version": "1.2.0",
        "versionOutput": "pyrefly 1.2.0",
        "macosArm64WheelSha256": "756f669b5555090f5c1a4fef30db1785fabe657764f7e4e6dc88994dfb8ca82d",
        "typeCheck": [
            "pyrefly",
            "check",
            "--color",
            "never",
            "--progress-bar",
            "no",
            "--summary=none",
            "--output-format",
            "min-text",
            "--min-severity",
            "warn",
        ],
        "languageServer": ["pyrefly", "lsp"],
    },
}


class ValidationError(RuntimeError):
    pass


checks = 0


def require(condition: bool, message: str) -> None:
    global checks
    if not condition:
        raise ValidationError(message)
    checks += 1


def require_object(value: object, message: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValidationError(message)
    return cast(dict[str, Any], value)


def require_list(value: object, message: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValidationError(message)
    return cast(list[Any], value)


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )


def executable_command(command: list[str]) -> list[str]:
    executable = shutil.which(command[0])
    require(executable is not None, f"{command[0]} executable is unavailable in the project environment")
    return [cast(str, executable), *command[1:]]


def rpc_frame(message: dict[str, Any]) -> bytes:
    body = json.dumps(message, separators=(",", ":")).encode("utf-8")
    return f"Content-Length: {len(body)}\r\n\r\n".encode("ascii") + body


def extract_rpc_frames(output: bytes, server_name: str) -> tuple[list[dict[str, Any]], bytes]:
    messages: list[dict[str, Any]] = []
    cursor = 0
    while cursor < len(output):
        header_end = output.find(b"\r\n\r\n", cursor)
        if header_end < 0:
            break
        headers = output[cursor:header_end].decode("ascii").split("\r\n")
        content_lengths = [line.split(":", 1)[1].strip() for line in headers if line.lower().startswith("content-length:")]
        require(len(content_lengths) == 1, f"{server_name} response must contain one Content-Length header")
        length = int(content_lengths[0])
        body_start = header_end + 4
        body_end = body_start + length
        if body_end > len(output):
            break
        message = json.loads(output[body_start:body_end])
        messages.append(require_object(message, f"{server_name} language-server message must be an object"))
        cursor = body_end
    return messages, output[cursor:]


def read_rpc_response(
    process: subprocess.Popen[bytes],
    response_id: int,
    buffered: bytes,
    server_name: str,
) -> tuple[dict[str, Any], bytes]:
    if process.stdout is None:
        raise ValidationError(f"{server_name} language-server stdout is unavailable")
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        messages, buffered = extract_rpc_frames(buffered, server_name)
        for message in messages:
            if message.get("id") == response_id and ("result" in message or "error" in message):
                return message, buffered
        timeout = max(0.0, deadline - time.monotonic())
        readable, _, _ = select.select([process.stdout], [], [], timeout)
        if not readable:
            break
        chunk = os.read(process.stdout.fileno(), 65_536)
        if not chunk:
            break
        buffered += chunk
    raise ValidationError(f"{server_name} did not return language-server response {response_id}")


def verify_language_server(command: list[str], server_name: str) -> None:
    root_uri = ROOT.as_uri()
    initialize_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "processId": None,
            "rootUri": root_uri,
            "capabilities": {},
            "workspaceFolders": [{"uri": root_uri, "name": ROOT.name}],
        },
    }
    initialized_notification = {"jsonrpc": "2.0", "method": "initialized", "params": {}}
    shutdown_request = {"jsonrpc": "2.0", "id": 2, "method": "shutdown", "params": None}
    exit_notification = {"jsonrpc": "2.0", "method": "exit", "params": None}
    environment = os.environ.copy()
    environment["NO_COLOR"] = "1"
    process = subprocess.Popen(
        executable_command(command),
        cwd=ROOT,
        env=environment,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=0,
    )
    if process.stdin is None or process.stderr is None:
        process.kill()
        raise ValidationError(f"{server_name} language-server pipes are unavailable")
    buffered = b""
    try:
        process.stdin.write(rpc_frame(initialize_request))
        process.stdin.flush()
        initialize, buffered = read_rpc_response(process, 1, buffered, server_name)
        require(isinstance(initialize.get("result"), dict), f"{server_name} did not complete the initialize handshake: {initialize}")

        process.stdin.write(rpc_frame(initialized_notification) + rpc_frame(shutdown_request))
        process.stdin.flush()
        shutdown, buffered = read_rpc_response(process, 2, buffered, server_name)
        require(shutdown.get("result") is None and "error" not in shutdown, f"{server_name} did not complete the shutdown handshake: {shutdown}")

        process.stdin.write(rpc_frame(exit_notification))
        process.stdin.flush()
        process.stdin.close()
        returncode = process.wait(timeout=15)
    except (BrokenPipeError, subprocess.TimeoutExpired):
        process.kill()
        process.wait(timeout=5)
        raise
    stderr = process.stderr.read().decode("utf-8", errors="replace").strip()
    require(returncode == 0, f"{server_name} language server exited with {returncode}: {stderr}")
    trailing_messages, trailing_bytes = extract_rpc_frames(buffered, server_name)
    require(not trailing_bytes.strip(), f"{server_name} returned an incomplete trailing language-server message")
    require(
        all(message.get("id") not in {1, 2} for message in trailing_messages),
        f"{server_name} returned duplicate lifecycle responses",
    )


def find_locked_package(lock: dict[str, Any], name: str) -> dict[str, Any]:
    packages = require_list(lock.get("package"), "uv.lock must contain a package list")
    matches = [package for package in packages if isinstance(package, dict) and package.get("name") == name]
    require(len(matches) == 1, f"uv.lock must contain exactly one {name} package")
    return cast(dict[str, Any], matches[0])


def main() -> None:
    pyproject = tomllib.loads(PYPROJECT_PATH.read_text(encoding="utf-8"))
    lock = tomllib.loads(LOCK_PATH.read_text(encoding="utf-8"))
    evidence = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    require(isinstance(evidence, dict) and isinstance(schema, dict), "type-tool evidence and schema must be JSON objects")

    dev_dependencies = require_list(
        pyproject.get("dependency-groups", {}).get("dev"),
        "Python development dependency group is missing",
    )
    type_tool_dependencies = [
        dependency
        for dependency in dev_dependencies
        if isinstance(dependency, str) and dependency.split("=", 1)[0] in EXPECTED_TOOLS
    ]
    require(type_tool_dependencies == ["pyrefly==1.2.0", "ty==0.0.75"], "Python type tools must be exact development dependencies")
    require(pyproject.get("tool", {}).get("ty", {}).get("environment", {}).get("python-version") == EXPECTED_PYTHON_VERSION, "ty Python target must be 3.12")
    require(pyproject.get("tool", {}).get("ty", {}).get("src", {}).get("include") == EXPECTED_SOURCE_PATHS, "ty project scope drifted")
    pyrefly = pyproject.get("tool", {}).get("pyrefly", {})
    require(pyrefly.get("python-version") == EXPECTED_PYTHON_VERSION, "Pyrefly Python target must be 3.12")
    require(pyrefly.get("project-includes") == EXPECTED_SOURCE_PATHS, "Pyrefly project scope drifted")
    require(pyrefly.get("search-path") == ["scripts"], "Pyrefly script import path drifted")
    require(pyrefly.get("errors") == {"untyped-import": False}, "Pyrefly untyped third-party import boundary drifted")
    actual_python_files = sorted(
        path.relative_to(ROOT).as_posix()
        for source_path in EXPECTED_SOURCE_PATHS
        for path in (ROOT / source_path).rglob("*.py")
    )
    require(actual_python_files == EXPECTED_PYTHON_FILES, "configured Python file inventory drifted")
    evidence_scope = require_object(evidence.get("projectScope"), "type-tool project scope evidence is missing")
    require(evidence_scope.get("pythonFiles") == EXPECTED_PYTHON_FILES, "type-tool evidence Python file inventory drifted")

    for name, expected in EXPECTED_TOOLS.items():
        package = find_locked_package(lock, name)
        require(package.get("version") == expected["version"], f"uv.lock {name} version drifted")
        wheels = require_list(package.get("wheels"), f"uv.lock {name} wheels are missing")
        expected_hash = f"sha256:{expected['macosArm64WheelSha256']}"
        require(any(isinstance(wheel, dict) and wheel.get("hash") == expected_hash and "macosx_11_0_arm64" in str(wheel.get("url")) for wheel in wheels), f"uv.lock {name} macOS arm64 wheel hash drifted")

        version_result = run(executable_command([name, "--version"]))
        require(version_result.returncode == 0, f"{name} version command failed")
        require(version_result.stdout.strip().startswith(expected["versionOutput"]), f"{name} installed version drifted: {version_result.stdout.strip()}")
        type_result = run(executable_command(expected["typeCheck"]))
        require(type_result.returncode == 0, f"{name} type check failed:\n{type_result.stdout}{type_result.stderr}")
        verify_language_server(expected["languageServer"], name)

    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    schema_errors = sorted(validator.iter_errors(evidence), key=lambda error: list(error.absolute_path))
    require(not schema_errors, "metadata/python-type-tools.json violates its schema: " + "; ".join(error.message for error in schema_errors))
    identity = require_object(evidence.get("identity"), "type-tool evidence identity is missing")
    transition = require_object(evidence.get("stateTransition"), "type-tool evidence state transition is missing")
    require(identity.get("observationUuidV7") == transition.get("eventId"), "type-tool observation and transition IDs differ")
    require(identity.get("observedAt") == transition.get("occurredAt"), "type-tool observation and transition times differ")
    observation_id = uuid.UUID(identity.get("observationUuidV7"))
    require(observation_id.version == 7, "type-tool observation ID must be UUIDv7")
    require(evidence.get("secretsIncluded") is False, "type-tool evidence must not contain secrets")
    print(f"python type-tool integration validated: {checks} checks, ty 0.0.75 beta, Pyrefly 1.2.0 stable")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError, KeyError, subprocess.TimeoutExpired, ValidationError) as exc:
        raise SystemExit(f"python type-tool validation failed: {exc}") from exc

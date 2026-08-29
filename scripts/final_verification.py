#!/usr/bin/env python3
# information_uuid_v5=a41fc94f-9513-59f6-a3ec-5c52bcfa3f3b
# event_uuid_v7=01a049d1-b7e1-7443-a30b-4620165c8b17
# state_transition=EXECUTING -> READY_FOR_PUBLIC_READBACK occurred_at=2026-08-28T19:21:16.001Z
# machine-contract: bounded browser observations, two finite-state engines, exact arithmetic, and all 67 test records must agree without upgrading INCONCLUSIVE or UNMEASURED claims.
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, getcontext
from fractions import Fraction
from pathlib import Path
from typing import Any, cast

ROOT = Path(__file__).resolve().parents[1]
NAMESPACE = uuid.UUID("47f3e535-0e27-559a-9556-aa79a84f95eb")
OBSERVATIONS_PATH = ROOT / "data/final-verification-observations.json"
TLA_REPORT_PATH = ROOT / "formal/tla/verification-report.json"
FINAL_REPORT_PATH = ROOT / "metadata/final-verification.json"
TEST_CATALOG_PATH = ROOT / "knowledge/tests.json"
WOLFRAM_MODEL_PATH = ROOT / "formal/wolfram/ReferenceModel.wl"
WOLFRAM_REPORT_PATH = ROOT / "formal/wolfram/verification-report.json"
TLA_SPEC_PATH = ROOT / "formal/tla/ToolExecution.tla"
TLA_CONFIG_PATH = ROOT / "formal/tla/ToolExecution.cfg"
REACHABILITY_PATH = ROOT / "formal/model-checker/reachability.py"

TLA_RELEASE = "v1.7.4"
TLA_RELEASE_URL = "https://github.com/tlaplus/tlaplus/releases/tag/v1.7.4"
TLA_JAR_URL = "https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar"
TLA_JAR_BYTES = 2_274_532
TLA_JAR_SHA1 = "bee4a54f3ee3d4afc347c3240ec2d9e93b075104"
TLA_JAR_SHA256 = "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88"
EXPECTED_INVARIANTS = [
    "TypeOK",
    "NoUnauthorizedExecution",
    "NoDoubleEffect",
    "NoCommitWithoutVerification",
    "NoAmbiguousRetry",
    "EffectRequiresAuthorization",
]
class VerificationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def exact_integer(value: object, expected: int) -> bool:
    return type(value) is int and value == expected


JsonObject = dict[str, Any]


def require_json_object(value: object, message: str) -> JsonObject:
    if not isinstance(value, dict):
        raise VerificationError(message)
    return cast(JsonObject, value)


def require_json_list(value: object, message: str) -> list[Any]:
    if not isinstance(value, list):
        raise VerificationError(message)
    return cast(list[Any], value)


def require_string(value: object, message: str) -> str:
    if not isinstance(value, str):
        raise VerificationError(message)
    return value


def require_integer(value: object, message: str) -> int:
    if type(value) is not int:
        raise VerificationError(message)
    return value


def require_exact_keys(value: JsonObject, expected: set[str], label: str) -> None:
    actual = set(value)
    require(actual == expected, f"{label} fields differ; missing={sorted(expected - actual)}, extra={sorted(actual - expected)}")


def require_tlc_result(value: object, label: str) -> JsonObject:
    value = require_json_object(value, f"{label} TLC result must be an object")
    require_exact_keys(
        value,
        {"status", "noError", "statesGenerated", "distinctStates", "statesLeftOnQueue", "completeGraphDepth", "invariants"},
        f"{label} TLC result",
    )
    require(value.get("status") == "VERIFIED", f"{label} TLC status drift")
    require(value.get("noError") is True, f"{label} TLC error result drift")
    for field, expected in [
        ("statesGenerated", 44),
        ("distinctStates", 38),
        ("statesLeftOnQueue", 0),
        ("completeGraphDepth", 13),
    ]:
        require(exact_integer(value.get(field), expected), f"{label} TLC {field} drift")
    require(value.get("invariants") == EXPECTED_INVARIANTS, f"{label} TLC invariant list drift")
    return value


def load_json(path: Path) -> JsonObject:
    value = json.loads(path.read_text(encoding="utf-8"))
    return require_json_object(value, f"{path.relative_to(ROOT)} must contain a JSON object")


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def digest_bytes(value: bytes, algorithm: str = "sha256") -> str:
    return hashlib.new(algorithm, value).hexdigest()


def digest_path(path: Path, algorithm: str = "sha256") -> str:
    return digest_bytes(path.read_bytes(), algorithm)


def parse_rfc3339(value: str) -> datetime:
    require(value.endswith("Z"), f"timestamp must use UTC Z form: {value}")
    parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    require(parsed.tzinfo is not None and parsed.utcoffset() == timedelta(0), f"timestamp must be UTC: {value}")
    return parsed


def epoch_ms(value: str) -> int:
    return int(parse_rfc3339(value).timestamp() * 1000)


def rfc3339_millisecond(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def stable_id(name: str) -> str:
    return str(uuid.uuid5(NAMESPACE, name))


def deterministic_uuid7(observed_ms: int, seed: str) -> str:
    random_bits = hashlib.sha256(seed.encode("utf-8")).digest()
    random_a = int.from_bytes(random_bits[:2], "big") & 0xFFF
    random_b = int.from_bytes(random_bits[2:10], "big") & ((1 << 62) - 1)
    value = (
        ((observed_ms & ((1 << 48) - 1)) << 80)
        | (7 << 76)
        | (random_a << 64)
        | (2 << 62)
        | random_b
    )
    return str(uuid.UUID(int=value))


def uuid7_epoch_ms(value: str) -> int:
    parsed = uuid.UUID(value)
    require(parsed.version == 7, f"not UUIDv7: {value}")
    return parsed.int >> 80


def validate_identity(identity: object, stable_name: str, observed_ms: int, event_seed: str) -> None:
    identity = require_json_object(identity, f"identity for {stable_name} must be an object")
    expected_v5 = stable_id(stable_name)
    expected_v7 = deterministic_uuid7(observed_ms, event_seed)
    require(identity.get("uuidV5") == expected_v5, f"UUIDv5 mismatch for {stable_name}")
    require(identity.get("uuidV7") == expected_v7, f"UUIDv7 mismatch for {stable_name}")
    if "namespace" in identity:
        require(identity.get("namespace") == str(NAMESPACE), f"UUID namespace mismatch for {stable_name}")
    require(uuid7_epoch_ms(expected_v7) == observed_ms, f"UUIDv7 timestamp mismatch for {stable_name}")


def validate_observations(observations: JsonObject) -> None:
    require_exact_keys(
        observations,
        {"identity", "temporal", "issue", "webMcpSpecification", "browserObservations", "discoveredTools", "conclusion", "wolframCurrentRun", "scope"},
        "final observation",
    )
    temporal = require_json_object(observations.get("temporal"), "observation temporal object missing")
    require_exact_keys(temporal, {"observedAt", "observedAtEpochMs", "timeZone"}, "observation temporal")
    observed_at = require_string(temporal.get("observedAt"), "observation time missing")
    observed_ms = require_integer(temporal.get("observedAtEpochMs"), "observation time missing")
    require(epoch_ms(observed_at) == observed_ms, "observation RFC 3339 and epoch times differ")
    require(temporal.get("timeZone") == "UTC", "observation time zone drift")
    require(isinstance(observations.get("identity"), dict), "observation identity missing")
    require_exact_keys(observations["identity"], {"uuidV5", "uuidV7", "namespace"}, "observation identity")
    validate_identity(observations.get("identity"), "observation/final-webmcp-browser-1.0.0", observed_ms, "iab")

    issue = require_json_object(observations.get("issue"), "Issue boundary missing")
    require_exact_keys(issue, {"number", "url", "informationUuidV5"}, "Issue boundary")
    require(exact_integer(issue.get("number"), 45), "unexpected Issue number")
    require(issue.get("url") == "https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/issues/45", "unexpected Issue URL")
    issue_information_id = uuid.UUID(str(issue.get("informationUuidV5")))
    require(issue_information_id.version == 5, "Issue information ID must be UUIDv5")

    specification = require_json_object(observations.get("webMcpSpecification"), "WebMCP specification observation missing")
    require_exact_keys(
        specification,
        {"source", "publication", "publishedOn", "standardsTrack", "documentSurface", "toolRegistrationSurface", "permissionsPolicyFeature"},
        "WebMCP specification observation",
    )
    require(specification.get("source") == "https://webmachinelearning.github.io/webmcp/", "unexpected WebMCP source")
    require(specification.get("publication") == "Draft Community Group Report", "WebMCP draft status lost")
    require(specification.get("standardsTrack") is False, "WebMCP must not be represented as Standards Track")
    require(specification.get("documentSurface") == "document.modelContext", "unexpected WebMCP document surface")

    expected_contexts = {
        "AUTOMATED_CHROMIUM": (
            "observation/automation-chrome-webmcp-1.0.0",
            "automation-chrome",
            "CONFIRMED_ABSENT",
            "NOT_OBSERVED",
        ),
        "CONNECTED_CHROME_READ_ONLY": (
            "observation/connected-chrome-webmcp-1.0.0",
            "chrome",
            "CONFIRMED_ABSENT",
            "CONFIRMED_ABSENT",
        ),
        "CODEX_IN_APP_BROWSER": (
            "observation/codex-iab-webmcp-1.0.0",
            "iab",
            "CONFIRMED_ABSENT",
            "CONFIRMED_PRESENT",
        ),
    }
    records = require_json_list(observations.get("browserObservations"), "browser observations must be a list")
    require(len(records) == 3, "exactly three bounded browser observations required")
    by_context: dict[str, JsonObject] = {}
    browser_observation_times: list[int] = []
    for raw_record in records:
        record = require_json_object(raw_record, "browser observation must be an object")
        require_exact_keys(
            record,
            {"identity", "temporal", "context", "browserVersion", "documentModelContext", "modelContextVersion", "toolsPermissionsPolicyAllowed", "notificationPermission", "serviceWorkerControllerPresent", "tabWebMcpCapability", "console", "network"},
            "browser observation",
        )
        context = require_string(record.get("context"), "browser context missing")
        require(context in expected_contexts, f"unexpected browser context: {context}")
        require(context not in by_context, f"duplicate browser context: {context}")
        record_temporal = require_json_object(record.get("temporal"), f"temporal missing for {context}")
        require_exact_keys(record_temporal, {"observedAt", "observedAtEpochMs"}, f"temporal for {context}")
        record_at = require_string(record_temporal.get("observedAt"), f"observation time missing for {context}")
        record_ms = require_integer(record_temporal.get("observedAtEpochMs"), f"observation time missing for {context}")
        require(epoch_ms(record_at) == record_ms, f"observation time mismatch for {context}")
        require(record_ms <= observed_ms, f"browser observation occurs after final observation: {context}")
        browser_observation_times.append(record_ms)
        stable_name, event_seed, expected_surface, expected_capability = expected_contexts[context]
        require(isinstance(record.get("identity"), dict), f"identity missing for {context}")
        require_exact_keys(record["identity"], {"uuidV5", "uuidV7"}, f"identity for {context}")
        validate_identity(record.get("identity"), stable_name, record_ms, event_seed)
        require(record.get("documentModelContext") == expected_surface, f"document surface mismatch for {context}")
        require(record.get("tabWebMcpCapability") == expected_capability, f"tab capability mismatch for {context}")
        network = require_json_object(record.get("network"), f"network observation missing for {context}")
        require_exact_keys(network, {"localStaticGetRequests", "mutatingRequests", "externalRequests"}, f"network observation for {context}")
        require(
            exact_integer(network.get("mutatingRequests"), 0)
            and exact_integer(network.get("externalRequests"), 0),
            f"unsafe request observed for {context}",
        )
        console = require_json_object(record.get("console"), f"console observation missing for {context}")
        require_exact_keys(console, {"errorCount", "warningCount", "warning"}, f"console observation for {context}")
        require(type(console.get("errorCount")) is int and console["errorCount"] >= 0, f"console error count invalid for {context}")
        require(type(console.get("warningCount")) is int and console["warningCount"] >= 0, f"console warning count invalid for {context}")
        by_context[context] = record

    require(max(browser_observation_times) == observed_ms, "final observation time must equal the latest browser observation")

    automation = by_context["AUTOMATED_CHROMIUM"]
    require(automation.get("browserVersion") == "Chromium 152.0.0.0", "automation browser version drift")
    require(automation.get("toolsPermissionsPolicyAllowed") is False, "automation tools policy result drift")
    require(automation.get("notificationPermission") == "default", "automation notification permission drift")
    require(exact_integer(automation["network"].get("localStaticGetRequests"), 6), "automation static request count drift")

    tools = require_json_list(observations.get("discoveredTools"), "discovered tools must be a list")
    require(len(tools) == 1, "exactly one bounded WebMCP tool required")
    tool = require_json_object(tools[0], "WebMCP tool must be an object")
    require(tool.get("name") == "notify_once", "unexpected WebMCP tool")
    require_exact_keys(
        tool,
        {"name", "title", "description", "origin", "strictObjectInput", "requiredFields", "additionalProperties", "called"},
        "discovered WebMCP tool",
    )
    require(tool.get("called") is False, "WebMCP tool must remain uncalled in final observation")
    require(tool.get("strictObjectInput") is True and tool.get("additionalProperties") is False, "WebMCP input must remain strict")
    require(tool.get("requiredFields") == ["logicalOperationId", "title", "body"], "WebMCP required fields drift")

    conclusion = require_json_object(observations.get("conclusion"), "WebMCP conclusion missing")
    require_exact_keys(
        conclusion,
        {"boundedToolDiscovery", "standardDocumentSurfaceInObservedChrome", "nativeWebMcpConformance", "nativeWebMcpVersion", "reason"},
        "WebMCP conclusion",
    )
    require(conclusion.get("boundedToolDiscovery") == "CONFIRMED_PRESENT", "bounded tool discovery was not preserved")
    require(conclusion.get("standardDocumentSurfaceInObservedChrome") == "CONFIRMED_ABSENT", "Chrome surface result drift")
    require(conclusion.get("nativeWebMcpConformance") == "INCONCLUSIVE", "native conformance must remain INCONCLUSIVE")
    require(conclusion.get("nativeWebMcpVersion") == "INCONCLUSIVE", "native version must remain INCONCLUSIVE")

    scope = require_json_object(observations.get("scope"), "observation scope missing")
    require(bool(scope), "observation scope missing")
    require_exact_keys(
        scope,
        {"actualWebMcpToolCalls", "actualNotificationPermissionRequests", "actualNotifications", "actualObservedPageExternalNetworkRequests", "intentRows", "attemptRows", "effectRows", "auditEvents"},
        "observation scope",
    )
    require(
        all(exact_integer(value, 0) for value in scope.values()),
        "final browser observation must have integer zero counts for calls, permissions, notifications, effects, and external requests",
    )
    wolfram = require_json_object(observations.get("wolframCurrentRun"), "current Wolfram observation missing")
    require_exact_keys(
        wolfram,
        {"observedAt", "runtimeAvailability", "currentExecution", "capturedReportStatus", "independentExactArithmetic"},
        "current Wolfram observation",
    )
    require(epoch_ms(str(wolfram.get("observedAt"))) <= observed_ms, "Wolfram availability observation occurs after browser evidence")
    require(wolfram.get("runtimeAvailability") == "UNAVAILABLE", "Wolfram runtime availability was overclaimed")
    require(wolfram.get("currentExecution") == "NOT_EXECUTED", "current Wolfram execution was overclaimed")
    require(wolfram.get("capturedReportStatus") == "CONFIRMED", "captured Wolfram report status missing")


def run_reachability() -> JsonObject:
    completed = subprocess.run(
        [sys.executable, str(REACHABILITY_PATH), "--max-retry", "2"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    require(completed.returncode == 0, f"finite explorer failed: {completed.stderr.strip()}")
    report = require_json_object(json.loads(completed.stdout), "finite explorer report must be an object")
    require(report.get("passed") is True, "finite explorer did not pass")
    baseline = require_json_object(report.get("baseline"), "finite explorer baseline missing")
    require(exact_integer(baseline.get("reachableStateCount"), 38), "finite explorer reachable-state count drift")
    require(exact_integer(baseline.get("transitionCount"), 43), "finite explorer transition count drift")
    require(baseline.get("commitReachable") is True, "finite explorer lost the verified commit path")
    for key in ["unauthorizedExecuteCount", "doubleEffectCount", "commitWithoutVerificationCount", "ambiguousRetryEdgeCount"]:
        require(exact_integer(baseline.get(key), 0), f"finite explorer baseline violation: {key}")
    mutations = require_json_object(report.get("mutations"), "finite explorer mutations missing")
    mutation_expectations = {
        "unauthorized": "unauthorizedExecuteCount",
        "double": "doubleEffectCount",
        "commit-bypass": "commitWithoutVerificationCount",
        "ambiguous-retry": "ambiguousRetryEdgeCount",
    }
    for mutation, counter in mutation_expectations.items():
        result = require_json_object(mutations.get(mutation), f"mutation result missing: {mutation}")
        require(require_integer(result.get(counter), f"mutation counter missing: {mutation}") > 0, f"mutation was not detected: {mutation}")
    return report


def parse_tlc_output(output: str) -> tuple[dict[str, str], JsonObject]:
    version = re.search(r"TLC2 Version ([0-9.]+).*\(rev: ([0-9a-f]+)\)", output)
    counts = re.search(r"(\d+) states generated, (\d+) distinct states found, (\d+) states left on queue", output)
    depth = re.search(r"depth of the complete state graph search is (\d+)", output)
    if version is None:
        raise VerificationError("TLC version was not found in output")
    if counts is None:
        raise VerificationError("TLC state counts were not found in output")
    if depth is None:
        raise VerificationError("TLC graph depth was not found in output")
    no_error = "Model checking completed. No error has been found." in output
    engine = {"version": version.group(1), "revision": version.group(2)}
    result = {
        "status": "VERIFIED" if no_error else "FAILED",
        "noError": no_error,
        "statesGenerated": int(counts.group(1)),
        "distinctStates": int(counts.group(2)),
        "statesLeftOnQueue": int(counts.group(3)),
        "completeGraphDepth": int(depth.group(1)),
        "invariants": EXPECTED_INVARIANTS,
    }
    return engine, result


def verify_tla_jar(jar: Path) -> None:
    require(jar.is_file(), f"TLA+ tools jar does not exist: {jar}")
    require(jar.stat().st_size == TLA_JAR_BYTES, "TLA+ tools jar size mismatch")
    require(digest_path(jar, "sha1") == TLA_JAR_SHA1, "TLA+ tools jar SHA-1 mismatch")
    require(digest_path(jar) == TLA_JAR_SHA256, "TLA+ tools jar SHA-256 mismatch")


def run_tlc(jar: Path) -> tuple[dict[str, str], JsonObject]:
    verify_tla_jar(jar)
    with tempfile.TemporaryDirectory(prefix="webmcp-tlc-") as metadata_directory:
        command = [
            "java",
            "-XX:+UseParallelGC",
            "-cp",
            str(jar),
            "tlc2.TLC",
            "-workers",
            "1",
            "-fp",
            "0",
            "-metadir",
            metadata_directory,
            "-config",
            TLA_CONFIG_PATH.name,
            TLA_SPEC_PATH.name,
        ]
        completed = subprocess.run(
            command,
            cwd=TLA_SPEC_PATH.parent,
            check=False,
            capture_output=True,
            text=True,
        )
    require(completed.returncode == 0, f"TLC failed: {(completed.stdout + completed.stderr).strip()}")
    engine, result = parse_tlc_output(completed.stdout + completed.stderr)
    require_tlc_result(result, "rerun")
    return engine, result


def capture_tla_report(jar: Path, observed_at: str) -> JsonObject:
    observed_ms = epoch_ms(observed_at)
    engine_observation, result = run_tlc(jar)
    event_id = deterministic_uuid7(observed_ms, "tla")
    return {
        "identity": {
            "uuidV5": stable_id("evidence/tla-tool-execution-1.0.0"),
            "uuidV7": event_id,
            "namespace": str(NAMESPACE),
        },
        "temporal": {
            "verifiedAt": observed_at,
            "verifiedAtEpochMs": observed_ms,
            "timeZone": "UTC",
        },
        "stateTransition": {
            "from": "DRY_RUN",
            "to": "VERIFIED",
            "eventId": event_id,
            "occurredAt": observed_at,
        },
        "engine": {
            "name": "TLC",
            "version": engine_observation["version"],
            "revision": engine_observation["revision"],
            "toolsRelease": TLA_RELEASE,
            "releaseSource": TLA_RELEASE_URL,
            "jarSource": TLA_JAR_URL,
            "jarBytes": TLA_JAR_BYTES,
            "publishedSha1": TLA_JAR_SHA1,
            "observedSha1": digest_path(jar, "sha1"),
            "observedSha256": digest_path(jar),
            "binaryBundled": False,
        },
        "inputs": {
            "specification": "formal/tla/ToolExecution.tla",
            "specificationSha256": digest_path(TLA_SPEC_PATH),
            "configuration": "formal/tla/ToolExecution.cfg",
            "configurationSha256": digest_path(TLA_CONFIG_PATH),
            "maxRetry": 2,
            "workers": 1,
            "fingerprintIndex": 0,
            "checkDeadlock": False,
            "command": [
                "java", "-XX:+UseParallelGC", "-cp", "<tla2tools.jar>", "tlc2.TLC",
                "-workers", "1", "-fp", "0", "-metadir", "<temporary-directory>",
                "-config", "ToolExecution.cfg", "ToolExecution.tla",
            ],
        },
        "result": result,
        "scope": {
            "finiteModelOnly": True,
            "actualNotificationEffects": 0,
            "actualNetworkEffectsDuringModelCheck": 0,
            "runtimeBrowserConformanceProved": False,
        },
    }


def validate_tla_report(report: JsonObject, reachability: JsonObject, rerun_jar: Path | None) -> None:
    require_exact_keys(report, {"identity", "temporal", "stateTransition", "engine", "inputs", "result", "scope"}, "TLA report")
    temporal = require_json_object(report.get("temporal"), "TLA temporal record missing")
    require_exact_keys(temporal, {"verifiedAt", "verifiedAtEpochMs", "timeZone"}, "TLA temporal")
    verified_at = require_string(temporal.get("verifiedAt"), "TLA verification time missing")
    verified_ms = require_integer(temporal.get("verifiedAtEpochMs"), "TLA verification time missing")
    require(epoch_ms(verified_at) == verified_ms, "TLA RFC 3339 and epoch times differ")
    require(temporal.get("timeZone") == "UTC", "TLA time zone drift")
    require(isinstance(report.get("identity"), dict), "TLA identity missing")
    require_exact_keys(report["identity"], {"uuidV5", "uuidV7", "namespace"}, "TLA identity")
    validate_identity(report.get("identity"), "evidence/tla-tool-execution-1.0.0", verified_ms, "tla")
    transition = require_json_object(report.get("stateTransition"), "TLA state transition missing")
    require_exact_keys(transition, {"from", "to", "eventId", "occurredAt"}, "TLA state transition")
    require(transition.get("from") == "DRY_RUN" and transition.get("to") == "VERIFIED", "TLA state transition drift")
    require(transition.get("eventId") == report["identity"]["uuidV7"], "TLA state transition event mismatch")
    require(transition.get("occurredAt") == verified_at, "TLA state transition time mismatch")

    engine = require_json_object(report.get("engine"), "TLA engine record missing")
    require_exact_keys(
        engine,
        {"name", "version", "revision", "toolsRelease", "releaseSource", "jarSource", "jarBytes", "publishedSha1", "observedSha1", "observedSha256", "binaryBundled"},
        "TLA engine",
    )
    require(engine.get("name") == "TLC" and engine.get("version") == "2.19" and engine.get("revision") == "5a47802", "TLC engine identity drift")
    require(engine.get("toolsRelease") == TLA_RELEASE and engine.get("releaseSource") == TLA_RELEASE_URL, "TLA release source drift")
    require(engine.get("jarSource") == TLA_JAR_URL and exact_integer(engine.get("jarBytes"), TLA_JAR_BYTES), "TLA jar source or size drift")
    require(engine.get("publishedSha1") == TLA_JAR_SHA1 and engine.get("observedSha1") == TLA_JAR_SHA1, "TLA jar SHA-1 mismatch")
    require(engine.get("observedSha256") == TLA_JAR_SHA256 and engine.get("binaryBundled") is False, "TLA jar SHA-256 or bundling claim mismatch")

    inputs = require_json_object(report.get("inputs"), "TLA inputs missing")
    require_exact_keys(
        inputs,
        {"specification", "specificationSha256", "configuration", "configurationSha256", "maxRetry", "workers", "fingerprintIndex", "checkDeadlock", "command"},
        "TLA inputs",
    )
    require(inputs.get("specificationSha256") == digest_path(TLA_SPEC_PATH), "TLA specification digest mismatch")
    require(inputs.get("configurationSha256") == digest_path(TLA_CONFIG_PATH), "TLA configuration digest mismatch")
    require(
        exact_integer(inputs.get("maxRetry"), 2)
        and exact_integer(inputs.get("workers"), 1)
        and exact_integer(inputs.get("fingerprintIndex"), 0),
        "TLA finite settings drift",
    )
    require(inputs.get("checkDeadlock") is False, "intentional terminal-state setting drift")
    require("CHECK_DEADLOCK FALSE" in TLA_CONFIG_PATH.read_text(encoding="utf-8"), "TLA configuration no longer declares intentional terminal states")
    specification_text = TLA_SPEC_PATH.read_text(encoding="utf-8")
    for invariant in EXPECTED_INVARIANTS:
        require(re.search(rf"^{re.escape(invariant)}\s*==", specification_text, flags=re.MULTILINE) is not None, f"TLA invariant missing: {invariant}")

    result = require_tlc_result(report.get("result"), "captured")
    baseline = reachability["baseline"]
    require(result["distinctStates"] == baseline["reachableStateCount"], "TLC and independent explorer state counts differ")
    scope = require_json_object(report.get("scope"), "TLA scope missing")
    require_exact_keys(scope, {"finiteModelOnly", "actualNotificationEffects", "actualNetworkEffectsDuringModelCheck", "runtimeBrowserConformanceProved"}, "TLA scope")
    require(scope.get("finiteModelOnly") is True, "TLA finite scope was overclaimed")
    require(
        exact_integer(scope.get("actualNotificationEffects"), 0)
        and exact_integer(scope.get("actualNetworkEffectsDuringModelCheck"), 0),
        "TLA execution claimed an external effect",
    )
    require(scope.get("runtimeBrowserConformanceProved") is False, "TLA must not claim browser conformance")

    if rerun_jar is not None:
        rerun_engine, rerun_result = run_tlc(rerun_jar)
        require(rerun_engine["version"] == engine["version"] and rerun_engine["revision"] == engine["revision"], "rerun TLC engine differs from captured engine")
        require_tlc_result(rerun_result, "rerun")
        require(rerun_result == result, "rerun TLC semantics differ from captured report")


def exact_wolfram_checks() -> JsonObject:
    report = load_json(WOLFRAM_REPORT_PATH)
    results = require_json_object(report.get("results"), "captured Wolfram results missing")
    require(results.get("probabilityMass") == "1", "captured Wolfram probability mass is not one")
    sample = require_json_object(results.get("sample"), "captured Wolfram sample missing")

    retry_probability = Fraction(3, 50)
    retry_budget = 3
    eta = Fraction(1, 100_000)
    probability_mass = Fraction(929, 1000) + Fraction(1, 1000) + retry_probability + Fraction(1, 100)
    geometric_factor = sum((retry_probability**index for index in range(retry_budget + 1)), Fraction(0))
    expected_retries = sum((retry_probability**index for index in range(1, retry_budget + 1)), Fraction(0))
    duplicate_probability = eta * retry_probability * (
        1 - (retry_probability * (1 - eta)) ** retry_budget
    ) / (1 - retry_probability * (1 - eta))
    require(probability_mass == 1, "independent exact probability mass is not one")

    getcontext().prec = 50
    def decimal_value(value: Fraction) -> Decimal:
        return Decimal(value.numerator) / Decimal(value.denominator)

    require(abs(Decimal(str(sample.get("geometricFactor"))) - decimal_value(geometric_factor)) <= Decimal("1e-15"), "captured geometric factor differs from exact arithmetic")
    require(abs(Decimal(str(sample.get("expectedRetries"))) - decimal_value(expected_retries)) <= Decimal("1e-15"), "captured expected retries differ from exact arithmetic")
    require(abs(Decimal(str(sample.get("duplicateProbabilityAtEta1e-5"))) - decimal_value(duplicate_probability)) <= Decimal("1e-18"), "captured duplicate probability differs from exact arithmetic")

    return {
        "runtimeAvailability": "UNAVAILABLE",
        "currentExecution": "NOT_EXECUTED",
        "capturedReport": "CONFIRMED",
        "capturedReportSha256": digest_path(WOLFRAM_REPORT_PATH),
        "modelSha256": digest_path(WOLFRAM_MODEL_PATH),
        "independentExactArithmetic": "VERIFIED",
        "probabilityMass": str(probability_mass),
        "geometricFactorExact": f"{geometric_factor.numerator}/{geometric_factor.denominator}",
        "expectedRetriesExact": f"{expected_retries.numerator}/{expected_retries.denominator}",
        "duplicateProbabilityExact": f"{duplicate_probability.numerator}/{duplicate_probability.denominator}",
        "duplicateProbabilityDecimal": format(decimal_value(duplicate_probability), ".24f"),
    }


def validate_test_catalog() -> JsonObject:
    catalog = load_json(TEST_CATALOG_PATH)
    records = require_json_list(catalog.get("records"), "test catalog records missing")
    require(len(records) == 67, f"expected 67 test records, got {len(records)}")
    identifiers: list[str] = []
    automation_artifacts: set[str] = set()
    for raw_record in records:
        record = require_json_object(raw_record, "test record must be an object")
        identifier = require_string(record.get("id"), "test record ID missing")
        identifiers.append(identifier)
        require(record.get("implementation_status") == "implemented", f"test is not implemented: {identifier}")
        require(record.get("automated") is True, f"test is not automated: {identifier}")
        artifacts = require_json_list(record.get("automation_artifacts"), f"test has no automation artifact: {identifier}")
        require(bool(artifacts), f"test has no automation artifact: {identifier}")
        for artifact in artifacts:
            require(isinstance(artifact, str) and (ROOT / artifact).exists(), f"missing automation artifact for {identifier}: {artifact}")
            automation_artifacts.add(artifact)
    require(len(identifiers) == len(set(identifiers)), "duplicate test IDs in catalog")
    return {
        "status": "VERIFIED",
        "total": len(records),
        "implemented": len(records),
        "automated": len(records),
        "partial": 0,
        "specificationOnly": 0,
        "automationArtifactCount": len(automation_artifacts),
        "catalogSha256": digest_path(TEST_CATALOG_PATH),
    }


def build_final_report(rerun_tla_jar: Path | None = None) -> JsonObject:
    observations = load_json(OBSERVATIONS_PATH)
    validate_observations(observations)
    reachability = run_reachability()
    tla_report = load_json(TLA_REPORT_PATH)
    validate_tla_report(tla_report, reachability, rerun_tla_jar)
    require(
        tla_report["temporal"]["verifiedAtEpochMs"] >= observations["temporal"]["observedAtEpochMs"],
        "TLA verification must not predate the browser evidence it accompanies",
    )
    wolfram = exact_wolfram_checks()
    test_catalog = validate_test_catalog()

    tla_verified_ms = tla_report["temporal"]["verifiedAtEpochMs"]
    final_ms = tla_verified_ms + 1
    final_at = rfc3339_millisecond(datetime.fromtimestamp(final_ms / 1000, tz=timezone.utc))
    final_event = deterministic_uuid7(final_ms, "final")
    scope = observations["scope"]
    baseline = reachability["baseline"]
    mutations = reachability["mutations"]
    return {
        "$schema": "../schemas/final-verification.schema.json",
        "identity": {
            "uuidV5": stable_id("evidence/final-verification-1.0.0"),
            "uuidV7": final_event,
            "namespace": str(NAMESPACE),
        },
        "temporal": {
            "verifiedAt": final_at,
            "verifiedAtEpochMs": final_ms,
            "timeZone": "UTC",
        },
        "version": "1.0.0",
        "status": "READY_FOR_PUBLIC_READBACK",
        "issue": observations["issue"],
        "stateTransition": {
            "from": "EXECUTING",
            "to": "READY_FOR_PUBLIC_READBACK",
            "eventId": final_event,
            "occurredAt": final_at,
        },
        "webMcp": {
            "conclusion": "INCONCLUSIVE",
            "version": "INCONCLUSIVE",
            "draftPublication": observations["webMcpSpecification"]["publication"],
            "draftPublishedOn": observations["webMcpSpecification"]["publishedOn"],
            "standardsTrack": False,
            "boundedObservationCount": len(observations["browserObservations"]),
            "standardDocumentSurfaceInObservedChrome": "CONFIRMED_ABSENT",
            "inAppBrowserToolDiscovery": "CONFIRMED_PRESENT",
            "discoveredToolNames": [tool["name"] for tool in observations["discoveredTools"]],
            "toolCalls": scope["actualWebMcpToolCalls"],
        },
        "formalVerification": {
            "finiteExplorer": {
                "status": "VERIFIED",
                "reachableStates": baseline["reachableStateCount"],
                "transitions": baseline["transitionCount"],
                "commitReachable": baseline["commitReachable"],
                "baselineViolations": {
                    "unauthorizedExecution": baseline["unauthorizedExecuteCount"],
                    "doubleEffect": baseline["doubleEffectCount"],
                    "commitWithoutVerification": baseline["commitWithoutVerificationCount"],
                    "ambiguousRetry": baseline["ambiguousRetryEdgeCount"],
                },
                "mutationDetections": {
                    "unauthorizedExecution": mutations["unauthorized"]["unauthorizedExecuteCount"],
                    "doubleEffect": mutations["double"]["doubleEffectCount"],
                    "commitWithoutVerification": mutations["commit-bypass"]["commitWithoutVerificationCount"],
                    "ambiguousRetry": mutations["ambiguous-retry"]["ambiguousRetryEdgeCount"],
                },
            },
            "tla": {
                "status": tla_report["result"]["status"],
                "toolsRelease": tla_report["engine"]["toolsRelease"],
                "engineVersion": tla_report["engine"]["version"],
                "statesGenerated": tla_report["result"]["statesGenerated"],
                "distinctStates": tla_report["result"]["distinctStates"],
                "statesLeftOnQueue": tla_report["result"]["statesLeftOnQueue"],
                "completeGraphDepth": tla_report["result"]["completeGraphDepth"],
                "jarPublishedSha1Matched": tla_report["engine"]["publishedSha1"] == tla_report["engine"]["observedSha1"],
                "binaryBundled": tla_report["engine"]["binaryBundled"],
            },
            "wolfram": wolfram,
        },
        "testCatalog": test_catalog,
        "effects": {
            "actualWebMcpToolCalls": scope["actualWebMcpToolCalls"],
            "actualNotificationPermissionRequests": scope["actualNotificationPermissionRequests"],
            "actualNotifications": scope["actualNotifications"],
            "actualObservedPageExternalNetworkRequests": scope["actualObservedPageExternalNetworkRequests"],
            "intentRows": scope["intentRows"],
            "attemptRows": scope["attemptRows"],
            "effectRows": scope["effectRows"],
            "auditEvents": scope["auditEvents"],
        },
        "reviewBoundary": {
            "postMergeMainReadback": "REQUIRED_EXTERNAL_RECORD",
            "unresolvedCriticalDefects": "PENDING_EXTERNAL_RECORD",
            "secretScan": "REQUIRED_BEFORE_PUSH",
            "recordTarget": observations["issue"]["url"],
        },
        "sources": [
            observations["webMcpSpecification"]["source"],
            TLA_RELEASE_URL,
            "formal/wolfram/ReferenceModel.wl",
            "formal/wolfram/verification-report.json",
        ],
        "artifacts": {
            "data/final-verification-observations.json": digest_path(OBSERVATIONS_PATH),
            "formal/tla/ToolExecution.tla": digest_path(TLA_SPEC_PATH),
            "formal/tla/ToolExecution.cfg": digest_path(TLA_CONFIG_PATH),
            "formal/tla/verification-report.json": digest_path(TLA_REPORT_PATH),
            "formal/model-checker/reachability.py": digest_path(REACHABILITY_PATH),
            "formal/wolfram/ReferenceModel.wl": digest_path(WOLFRAM_MODEL_PATH),
            "formal/wolfram/verification-report.json": digest_path(WOLFRAM_REPORT_PATH),
            "knowledge/tests.json": digest_path(TEST_CATALOG_PATH),
            "schemas/final-verification.schema.json": digest_path(ROOT / "schemas/final-verification.schema.json"),
            "scripts/final_verification.py": digest_path(ROOT / "scripts/final_verification.py"),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build or check bounded final verification evidence.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="write metadata/final-verification.json")
    mode.add_argument("--check", action="store_true", help="check tracked final evidence without writing")
    mode.add_argument("--capture-tla", type=Path, metavar="TLA2TOOLS_JAR", help="rerun TLC and write the captured TLA report")
    parser.add_argument("--observed-at", help="RFC 3339 UTC time for --capture-tla")
    parser.add_argument("--tla2tools-jar", type=Path, help="optionally rerun TLC while checking or writing")
    args = parser.parse_args()

    try:
        if args.capture_tla is not None:
            require(args.observed_at is not None, "--capture-tla requires --observed-at")
            report = capture_tla_report(args.capture_tla.resolve(), args.observed_at)
            TLA_REPORT_PATH.write_bytes(json_bytes(report))
            print(json.dumps({"captured": str(TLA_REPORT_PATH.relative_to(ROOT)), "result": report["result"]}, indent=2))
            return
        require(args.observed_at is None, "--observed-at is only valid with --capture-tla")
        report = build_final_report(args.tla2tools_jar.resolve() if args.tla2tools_jar else None)
        expected = json_bytes(report)
        if args.write:
            FINAL_REPORT_PATH.write_bytes(expected)
            print(json.dumps({"written": str(FINAL_REPORT_PATH.relative_to(ROOT)), "status": report["status"]}, indent=2))
            return
        require(FINAL_REPORT_PATH.is_file(), "metadata/final-verification.json is missing")
        require(FINAL_REPORT_PATH.read_bytes() == expected, "metadata/final-verification.json is stale")
        print(json.dumps({
            "checked": str(FINAL_REPORT_PATH.relative_to(ROOT)),
            "status": report["status"],
            "webMcp": report["webMcp"]["conclusion"],
            "tests": report["testCatalog"]["total"],
            "actualNotifications": report["effects"]["actualNotifications"],
            "tlcRerun": args.tla2tools_jar is not None,
        }, indent=2))
    except (OSError, ValueError, KeyError, TypeError, VerificationError, json.JSONDecodeError) as exc:
        raise SystemExit(f"final verification failed: {exc}") from exc


if __name__ == "__main__":
    main()

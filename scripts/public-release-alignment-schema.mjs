#!/usr/bin/env node
// information_uuid_v5=6d577b89-c7b5-56b0-bbc0-7dbfbaa17d8d
// event_uuid_v7=01a056be-90df-79b4-8e3c-057c59ed56a7 state_transition=SCHEMA_DECLARED_ONLY -> DRAFT_2020_12_EXECUTED occurred_at=2026-08-31T07:35:24.639Z
// machine-contract: the pinned Python Draft 2020-12 validator checks the public alignment record, and every failure keeps its JSON path and validator name.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const RUNNER = String.raw`
import json
import sys

from jsonschema import Draft202012Validator, FormatChecker

payload = json.load(sys.stdin)
schema = payload["schema"]
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())

def serialize_error(error):
    return {
        "path": list(error.path),
        "schemaPath": list(error.schema_path),
        "validator": error.validator,
        "message": error.message,
        "context": [serialize_error(child) for child in error.context],
    }

errors = sorted(validator.iter_errors(payload["instance"]), key=lambda error: (list(error.path), list(error.schema_path)))
json.dump({"errors": [serialize_error(error) for error in errors]}, sys.stdout, ensure_ascii=False, separators=(",", ":"))
`;

export function validateDraft202012(instance, schema) {
  const output = execFileSync("uv", ["run", "--frozen", "python", "-c", RUNNER], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? resolve(ROOT, ".local/uv-cache") },
    input: JSON.stringify({ instance, schema }),
    maxBuffer: 1024 * 1024,
    shell: false,
  });
  return JSON.parse(output);
}

function jsonPath(path) {
  if (path.length === 0) return "$";
  return path.reduce((result, part) => (typeof part === "number" ? `${result}[${part}]` : `${result}.${part}`), "$");
}

export function formatDraft202012Errors(result, filePath) {
  return result.errors.map((error) => `${filePath}:${jsonPath(error.path)} [${error.validator}] ${error.message}`).join("; ");
}

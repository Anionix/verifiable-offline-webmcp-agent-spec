// information_uuid_v5=ed8f40a9-d907-5615-a4ce-9366c0ff2f37
// event_uuid_v7=01a04b41-fd38-746f-993c-0b6e9b4004d9
// state_transition=IMPLICIT_DIGEST_SCOPE -> EXPLICIT_THREE_RECEIPT_SCOPE occurred_at=2026-08-29T02:03:31.000Z
// machine-contract: every hotel artifact digest uses sorted relative POSIX paths, a NUL separator, complete file bytes, and a trailing NUL separator.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const clientRoot = resolve(repositoryRoot, "dist/client");
export const serverRoot = resolve(repositoryRoot, "dist/server");
export const sitesPackageRoot = resolve(repositoryRoot, "dist");

export const digestCanonicalization = "LEXICOGRAPHIC_RELATIVE_POSIX_PATH_NUL_FILE_BYTES_NUL";

export const functionalDigestScope = Object.freeze({
  algorithm: "SHA-256",
  root: "dist/client",
  canonicalization: digestCanonicalization,
  excludedPaths: [".assetsignore", "service-integrations.json"],
});

export const fullClientDigestScope = Object.freeze({
  algorithm: "SHA-256",
  root: "dist/client",
  canonicalization: digestCanonicalization,
  excludedPaths: [],
});

export const fullSitesPackageDigestScope = Object.freeze({
  algorithm: "SHA-256",
  root: "dist",
  canonicalization: digestCanonicalization,
  excludedPaths: [],
});

export function relativePosix(root, path) {
  return relative(root, path).split(sep).join("/");
}

export async function readText(path) {
  return readFile(path, "utf8");
}

export async function readJson(path) {
  return JSON.parse(await readText(path));
}

export async function requireNonEmptyFile(path) {
  const details = await stat(path);
  assert(details.isFile() && details.size > 0, `${relativePosix(repositoryRoot, path)} must be a non-empty file`);
}

export async function walkFiles(root) {
  const paths = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) paths.push(...await walkFiles(path));
    else if (entry.isFile()) paths.push(path);
    else assert.fail(`${relativePosix(repositoryRoot, path)} must not be a symbolic link or special file`);
  }
  return paths.sort((left, right) => {
    const leftName = relativePosix(root, left);
    const rightName = relativePosix(root, right);
    return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
  });
}

export async function assertExactFiles(root, expected, label) {
  const actual = (await walkFiles(root)).map((path) => relativePosix(root, path));
  assert.deepEqual(actual, [...expected].sort(), `${label} contains an unexpected or missing file`);
}

export async function digestTree(root, excludedPaths = []) {
  const excluded = new Set(excludedPaths);
  const hash = createHash("sha256");
  for (const path of await walkFiles(root)) {
    const name = relativePosix(root, path);
    if (excluded.has(name)) continue;
    hash.update(name, "utf8");
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function assertDigestScope(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} digest scope differs from the machine contract`);
}

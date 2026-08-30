import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// information_uuid_v5=4f18aaff-864b-5bbd-a2ce-1c33f0add5f2
// event_uuid_v7=01a05388-5ea8-7fbd-a08e-e5a8ef88376f state_transition=RELEASE_FILE_SET_UNVERIFIED -> RELEASE_FILE_SET_REJECTS_UNLISTED occurred_at=2026-08-30T16:37:21.192Z
// machine-contract: run the real release validator against a harmless package fixture; do not inspect its source text.

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const validatorPath = resolve(repositoryRoot, "scripts/validate_hotel_release.mjs");
const sourceCommit = "5583cdbeddbbeae2c6f16fd481fc809069a15296";

const baseFiles = new Map([
  ["README.md", "# Kyoto Booking Retry Proof\n2 attempts → 1 simulated booking → 1 confirmation number\ncheck_existing_hotel_booking\n"],
  ["DEVPOST_VISUAL_GUIDE.md", "01-hero-empty\n05-retry-recognized\nAI-generated dramatization / Fictional booking\n"],
  ["DEVPOST_VISUAL_GUIDE_JA.md", "60秒の確認\n"],
  ["RELEASE_GUIDE.md", "shasum -a 256 -c SHA256SUMS\n"],
  ["LICENSE", "MIT License\n"],
  ["release-manifest.json", `${JSON.stringify({ presentation: { primaryReadme: "README.md", visualGuideEnglish: "DEVPOST_VISUAL_GUIDE.md", visualGuideJapanese: "DEVPOST_VISUAL_GUIDE_JA.md", releaseGuide: "RELEASE_GUIDE.md" }, source: { commit: sourceCommit } })}\n`],
  ["package-note.txt", "fixture-only package note\n"],
  ["package-provenance.txt", "fixture-only provenance\n"],
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeFixture(releaseRoot, extraFiles = {}) {
  await mkdir(releaseRoot, { recursive: true });
  const files = new Map(baseFiles);
  for (const [relativePath, contents] of files) {
    const absolutePath = resolve(releaseRoot, relativePath);
    await mkdir(resolve(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, contents);
  }
  const checksums = [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([relativePath, contents]) => `${sha256(contents)}  ${relativePath}`)
    .join("\n");
  await writeFile(resolve(releaseRoot, "SHA256SUMS"), `${checksums}\n`);
  for (const [relativePath, contents] of Object.entries(extraFiles)) {
    const absolutePath = resolve(releaseRoot, relativePath);
    await mkdir(resolve(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, contents);
  }
}

function runValidator(releaseRoot, options = {}) {
  const result = spawnSync(process.execPath, [validatorPath, "--release-root", releaseRoot], {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });
  return { ...result, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

async function withFixture(extraFiles, assertion) {
  const testRoot = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-release-"));
  try {
    await writeFixture(testRoot, extraFiles);
    await assertion(testRoot);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
}

test("accepts a checksum-complete release package without extra files", async () => {
  await withFixture({}, (releaseRoot) => {
    const result = runValidator(releaseRoot);
    assert.equal(result.status, 0, result.output);
    assert.match(result.stdout, /HOTEL_RELEASE_READBACK_PASS/u);
  });
});

test("rejects an unrecorded root file", async () => {
  await withFixture({ "unexpected.txt": "harmless unrecorded file\n" }, (releaseRoot) => {
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0, "the validator accepted an unrecorded root file");
    assert.match(result.output, /unlisted release files: unexpected\.txt/u);
  });
});

test("rejects an unrecorded nested file", async () => {
  await withFixture({ "nested/unexpected.json": "harmless nested file\n" }, (releaseRoot) => {
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /unlisted release files: nested\/unexpected\.json/u);
  });
});

test("rejects an unrecorded empty environment file", async () => {
  await withFixture({ ".env.test": "" }, (releaseRoot) => {
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /unlisted release files: \.env\.test/u);
  });
});

test("rejects an unrecorded video file", async () => {
  await withFixture({ "dummy.mp4": "not a real video\n" }, (releaseRoot) => {
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /unlisted release files: dummy\.mp4/u);
  });
});

test("rejects a symbolic link without reading its external target", async () => {
  const outsideDirectory = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-"));
  try {
    await withFixture({}, async (releaseRoot) => {
      const outsidePath = resolve(outsideDirectory, "outside.txt");
      const outsideContents = "outside release root\n";
      await writeFile(outsidePath, outsideContents);
      await symlink(outsidePath, resolve(releaseRoot, "external.txt"));
      const checksumPath = resolve(releaseRoot, "SHA256SUMS");
      const checksum = await readFile(checksumPath, "utf8");
      await writeFile(checksumPath, `${checksum}${sha256(outsideContents)}  external.txt\n`);
      const result = runValidator(releaseRoot);
      assert.notEqual(result.status, 0);
      assert.match(result.output, /external\.txt must not be a symbolic link/u);
    });
  } finally {
    await rm(outsideDirectory, { recursive: true, force: true });
  }
});

test("rejects a symbolic link supplied as the release root", { skip: process.platform === "win32" ? "symlink fixture is not portable to Windows" : false }, async () => {
  const aliasDirectory = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-root-"));
  try {
    await withFixture({}, async (releaseRoot) => {
      const rootLink = resolve(aliasDirectory, "release-root");
      await symlink(releaseRoot, rootLink);
      const result = runValidator(rootLink);
      assert.notEqual(result.status, 0);
      assert.match(result.output, /release root must not be a symbolic link/u);
    });
  } finally {
    await rm(aliasDirectory, { recursive: true, force: true });
  }
});

test("rejects a special file without reading it", { skip: process.platform === "win32" ? "mkfifo is not available on Windows" : false }, async () => {
  await withFixture({}, (releaseRoot) => {
    const fifoPath = resolve(releaseRoot, "special.fifo");
    const created = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
    assert.equal(created.status, 0, `${created.stdout ?? ""}\n${created.stderr ?? ""}`);
    const result = runValidator(releaseRoot, { timeout: 2000 });
    assert.notEqual(result.status, 0);
    assert.match(result.output, /special\.fifo must be a regular file/u);
  });
});

test("keeps rejecting a checksum-listed file that is missing", async () => {
  await withFixture({}, async (releaseRoot) => {
    await rm(resolve(releaseRoot, "package-note.txt"));
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /package-note\.txt/u);
  });
});

test("keeps rejecting a duplicate checksum path", async () => {
  await withFixture({}, async (releaseRoot) => {
    const checksumPath = resolve(releaseRoot, "SHA256SUMS");
    const checksum = await readFile(checksumPath, "utf8");
    const readmeChecksum = checksum.split("\n").find((line) => line.endsWith("  README.md"));
    assert.ok(readmeChecksum);
    await writeFile(checksumPath, `${checksum}${readmeChecksum}\n`);
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /duplicate checksum path: .*README\.md/u);
  });
});

test("keeps rejecting a checksum digest mismatch", async () => {
  await withFixture({}, async (releaseRoot) => {
    await writeFile(resolve(releaseRoot, "README.md"), "# Kyoto Booking Retry Proof\n2 attempts → 1 simulated booking → 1 confirmation number\ncheck_existing_hotel_booking\ntampered after checksum generation\n");
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /README\.md digest differs from SHA256SUMS/u);
  });
});

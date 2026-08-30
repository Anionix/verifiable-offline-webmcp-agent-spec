import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, lstat, mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateRelease } from "./validate_hotel_release.mjs";

// information_uuid_v5=4f18aaff-864b-5bbd-a2ce-1c33f0add5f2
// event_uuid_v7=01a05388-5ea8-7fbd-a08e-e5a8ef88376f state_transition=RELEASE_FILE_SET_UNVERIFIED -> RELEASE_FILE_SET_REJECTS_UNLISTED occurred_at=2026-08-30T16:37:21.192Z
// event_uuid_v7=01a053b8-3877-7197-be30-8519dfe88680 state_transition=PATH_SNAPSHOT_RACE_UNTESTED -> PATH_SNAPSHOT_RACE_REJECTED occurred_at=2026-08-30T17:29:37.143Z
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
  [
    "release-manifest.json",
    `${JSON.stringify({ presentation: { primaryReadme: "README.md", visualGuideEnglish: "DEVPOST_VISUAL_GUIDE.md", visualGuideJapanese: "DEVPOST_VISUAL_GUIDE_JA.md", releaseGuide: "RELEASE_GUIDE.md" }, source: { commit: sourceCommit } })}\n`,
  ],
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

async function addNestedChecksummedFile(releaseRoot) {
  const relativePath = "nested/group/release-note.txt";
  const contents = "nested release fixture\n";
  await mkdir(resolve(releaseRoot, "nested/group"), { recursive: true });
  await writeFile(resolve(releaseRoot, relativePath), contents);
  const checksumPath = resolve(releaseRoot, "SHA256SUMS");
  const checksum = await readFile(checksumPath, "utf8");
  await writeFile(checksumPath, `${checksum}${sha256(contents)}  ${relativePath}\n`);
}

function runValidator(releaseRoot, options = {}) {
  const result = spawnSync(process.execPath, [validatorPath, "--release-root", releaseRoot], {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });
  return { ...result, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function runTestChildWithTimeout(script, timeoutMs = 2000) {
  const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolvePromise({ status, signal, timedOut, stdout, stderr, output: `${stdout}\n${stderr}` });
    });
  });
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
    assert.equal(JSON.parse(result.stdout).directory, releaseRoot);
  });
});

test("fails closed before file operations on Windows", { skip: process.platform === "win32" ? false : "Windows-only platform guard" }, async () => {
  await assert.rejects(
    () => validateRelease("/definitely/missing"),
    /hotel release validation is unsupported on Windows: safe non-following file opens cannot be guaranteed/u,
  );
});

test(
  "does not skip validation when the CLI is invoked through a symbolic link",
  { skip: process.platform === "win32" ? "symlink fixture is not portable to Windows" : false },
  async () => {
    const aliasDirectory = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-cli-"));
    try {
      const validatorLink = resolve(aliasDirectory, "validate_hotel_release.mjs");
      await symlink(validatorPath, validatorLink);
      const result = spawnSync(process.execPath, [validatorLink, "--release-root", "/definitely/missing"], {
        cwd: repositoryRoot,
        encoding: "utf8",
      });
      assert.notEqual(result.status, 0, "the symlink-invoked validator silently skipped the release check");
    } finally {
      await rm(aliasDirectory, { recursive: true, force: true });
    }
  },
);

test("rejects an unrecorded root file", async () => {
  await withFixture({ "unexpected.txt": "harmless unrecorded file\n" }, (releaseRoot) => {
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0, "the validator accepted an unrecorded root file");
    assert.match(result.output, /unlisted release files: unexpected\.txt/u);
  });
});

test("rejects a directory listing above the bounded entry limit", async () => {
  await withFixture({}, async (releaseRoot) => {
    for (let index = 0; index <= 4_096; index += 1) await writeFile(resolve(releaseRoot, `unlisted-${index}.txt`), "unlisted\n");
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0, "the validator processed an unbounded directory listing");
    assert.match(result.output, /directory entry count exceeded its limit/u);
  });
});

test("rejects a regular file added after snapshot even when the release root inode is unchanged", async () => {
  await withFixture({}, async (releaseRoot) => {
    const initialRoot = await lstat(releaseRoot, { bigint: true });
    await assert.rejects(
      () =>
        validateRelease(releaseRoot, {
          afterSnapshot: async () => {
            await writeFile(resolve(releaseRoot, "UNLISTED.txt"), "unlisted after snapshot\n");
            const finalRoot = await lstat(releaseRoot, { bigint: true });
            assert.equal(finalRoot.ino, initialRoot.ino);
          },
        }),
      /release file set changed after snapshot: added=.*UNLISTED\.txt/u,
    );
  });
});

test("rejects same-inode rewrites after all initial reads", { skip: process.platform === "win32" ? "Windows validator is unsupported" : false }, async () => {
  await withFixture({}, async (releaseRoot) => {
    const readmePath = resolve(releaseRoot, "README.md");
    const checksumPath = resolve(releaseRoot, "SHA256SUMS");
    const rewrittenReadme =
      "# Kyoto Booking Retry Proof\n2 attempts → 1 simulated booking → 1 confirmation number\ncheck_existing_hotel_booking\nrewritten after initial read\n";
    const originalChecksums = await readFile(checksumPath, "utf8");
    const originalReadmeLine = originalChecksums.split("\n").find((line) => line.endsWith("  README.md"));
    assert.ok(originalReadmeLine);
    const rewrittenChecksums = originalChecksums.replace(originalReadmeLine, `${sha256(rewrittenReadme)}  README.md`);
    const paths = [readmePath, checksumPath];
    const initialIdentities = await Promise.all(paths.map((path) => lstat(path, { bigint: true })));
    await assert.rejects(
      () =>
        validateRelease(releaseRoot, {
          afterInitialRead: async () => {
            await writeFile(readmePath, rewrittenReadme);
            await writeFile(checksumPath, rewrittenChecksums);
            const finalIdentities = await Promise.all(paths.map((path) => lstat(path, { bigint: true })));
            for (let index = 0; index < paths.length; index += 1) {
              assert.equal(finalIdentities[index].dev, initialIdentities[index].dev);
              assert.equal(finalIdentities[index].ino, initialIdentities[index].ino);
            }
          },
        }),
      /content changed after initial read/u,
    );
  });
});

test(
  "rejects a regular file added after the final hash read",
  { skip: process.platform === "win32" ? "Windows validator is unsupported" : false },
  async () => {
    await withFixture({}, async (releaseRoot) => {
      await assert.rejects(
        () =>
          validateRelease(releaseRoot, {
            afterFinalRead: async () => writeFile(resolve(releaseRoot, "UNLISTED_AFTER_FINAL_READ.txt"), "unlisted after final read\n"),
          }),
        /release file set changed after snapshot: added=.*UNLISTED_AFTER_FINAL_READ\.txt/u,
      );
    });
  },
);

test(
  "rejects a root symlink swapped after lstat before descriptor enumeration",
  { skip: process.platform === "win32" ? "Windows validator is unsupported" : false },
  async () => {
    const outsideDirectory = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-root-fd-race-"));
    try {
      await writeFile(resolve(outsideDirectory, "outside.txt"), "outside release root\n");
      await withFixture({}, async (releaseRoot) => {
        const originalRoot = `${releaseRoot}.original`;
        let originalRootMoved = false;
        try {
          await assert.rejects(
            () =>
              validateRelease(releaseRoot, {
                afterDirectoryLstat: async (relativeDirectory) => {
                  if (relativeDirectory !== "") return;
                  await rename(releaseRoot, originalRoot);
                  originalRootMoved = true;
                  await symlink(outsideDirectory, releaseRoot);
                },
              }),
            /symbolic link|release root changed/u,
          );
        } finally {
          if (originalRootMoved) {
            await rm(releaseRoot, { recursive: true, force: true });
            await rename(originalRoot, releaseRoot);
          }
          await rm(originalRoot, { recursive: true, force: true });
        }
      });
    } finally {
      await rm(outsideDirectory, { recursive: true, force: true });
    }
  },
);

test(
  "rejects a nested symlink swapped after lstat before descriptor enumeration",
  { skip: process.platform === "win32" ? "Windows validator is unsupported" : false },
  async () => {
    const outsideDirectory = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-nested-fd-race-"));
    try {
      await mkdir(resolve(outsideDirectory, "group"));
      await writeFile(resolve(outsideDirectory, "group/release-note.txt"), "outside nested directory\n");
      await withFixture({}, async (releaseRoot) => {
        await addNestedChecksummedFile(releaseRoot);
        const nestedPath = resolve(releaseRoot, "nested");
        const originalNestedPath = `${releaseRoot}.nested-original`;
        let originalNestedMoved = false;
        try {
          await assert.rejects(
            () =>
              validateRelease(releaseRoot, {
                afterDirectoryLstat: async (relativeDirectory) => {
                  if (relativeDirectory !== "nested") return;
                  await rename(nestedPath, originalNestedPath);
                  originalNestedMoved = true;
                  await symlink(outsideDirectory, nestedPath);
                },
              }),
            /ELOOP|ENOTDIR|too many symbolic links/u,
          );
        } finally {
          if (originalNestedMoved) {
            await rm(nestedPath, { recursive: true, force: true });
            await rename(originalNestedPath, nestedPath);
          }
          await rm(originalNestedPath, { recursive: true, force: true });
        }
      });
    } finally {
      await rm(outsideDirectory, { recursive: true, force: true });
    }
  },
);

test(
  "rejects a root replacement before nested bound directory enumeration",
  { skip: process.platform === "win32" ? "Windows validator is unsupported" : false },
  async () => {
    const outsideRoot = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-root-bound-list-"));
    try {
      await writeFixture(outsideRoot);
      await addNestedChecksummedFile(outsideRoot);
      await withFixture({}, async (releaseRoot) => {
        await addNestedChecksummedFile(releaseRoot);
        const movedRoot = `${releaseRoot}.original`;
        let replacementInstalled = false;
        try {
          await assert.rejects(
            () =>
              validateRelease(releaseRoot, {
                afterDirectoryLstat: async (relativeDirectory) => {
                  if (relativeDirectory !== "nested" || replacementInstalled) return;
                  await rename(releaseRoot, movedRoot);
                  await symlink(outsideRoot, releaseRoot);
                  replacementInstalled = true;
                },
              }),
            /release root must not be a symbolic link|release root changed/u,
          );
        } finally {
          if (replacementInstalled) {
            await rm(releaseRoot, { recursive: true, force: true });
            await rename(movedRoot, releaseRoot);
          }
          await rm(movedRoot, { recursive: true, force: true });
        }
      });
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  },
);

test(
  "rejects a root replacement before nested bound file read",
  { skip: process.platform === "win32" ? "Windows validator is unsupported" : false },
  async () => {
    const outsideRoot = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-root-bound-read-"));
    try {
      await writeFixture(outsideRoot);
      await addNestedChecksummedFile(outsideRoot);
      await withFixture({}, async (releaseRoot) => {
        await addNestedChecksummedFile(releaseRoot);
        const movedRoot = `${releaseRoot}.original`;
        let replacementInstalled = false;
        try {
          await assert.rejects(
            () =>
              validateRelease(releaseRoot, {
                beforeFileRead: async (snapshot) => {
                  if (snapshot.relativePath !== "nested/group/release-note.txt" || replacementInstalled) return;
                  await rename(releaseRoot, movedRoot);
                  await symlink(outsideRoot, releaseRoot);
                  replacementInstalled = true;
                },
              }),
            /release root must not be a symbolic link|release root changed/u,
          );
        } finally {
          if (replacementInstalled) {
            await rm(releaseRoot, { recursive: true, force: true });
            await rename(movedRoot, releaseRoot);
          }
          await rm(movedRoot, { recursive: true, force: true });
        }
      });
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  },
);

test(
  "rejects a release root replaced with hardlinks after the final hash read",
  { skip: process.platform === "win32" ? "Windows validator is unsupported" : false },
  async () => {
    await withFixture({}, async (releaseRoot) => {
      const originalRoot = `${releaseRoot}.original`;
      const replacementRoot = `${releaseRoot}.replacement`;
      let originalRootMoved = false;
      let replacementInstalled = false;
      try {
        await assert.rejects(
          () =>
            validateRelease(releaseRoot, {
              afterFinalRead: async () => {
                await mkdir(replacementRoot);
                for (const relativePath of [...baseFiles.keys(), "SHA256SUMS"])
                  await link(resolve(releaseRoot, relativePath), resolve(replacementRoot, relativePath));
                await rename(releaseRoot, originalRoot);
                originalRootMoved = true;
                await rename(replacementRoot, releaseRoot);
                replacementInstalled = true;
              },
            }),
          /release root changed before final readback enumeration/u,
        );
      } finally {
        if (replacementInstalled) {
          await rm(releaseRoot, { recursive: true, force: true });
          await rename(originalRoot, releaseRoot);
        } else if (originalRootMoved) await rename(originalRoot, releaseRoot);
        await rm(replacementRoot, { recursive: true, force: true });
        await rm(originalRoot, { recursive: true, force: true });
      }
    });
  },
);

test(
  "rejects a nested ancestor replaced with hardlinks after the final hash read",
  { skip: process.platform === "win32" ? "Windows validator is unsupported" : false },
  async () => {
    await withFixture({}, async (releaseRoot) => {
      await addNestedChecksummedFile(releaseRoot);
      const nestedPath = resolve(releaseRoot, "nested");
      const originalNestedPath = `${releaseRoot}.nested-original`;
      const replacementNestedPath = resolve(releaseRoot, "nested-replacement");
      let originalNestedMoved = false;
      let replacementInstalled = false;
      try {
        await assert.rejects(
          () =>
            validateRelease(releaseRoot, {
              afterFinalRead: async () => {
                await mkdir(resolve(replacementNestedPath, "group"), { recursive: true });
                await link(resolve(nestedPath, "group/release-note.txt"), resolve(replacementNestedPath, "group/release-note.txt"));
                await rename(nestedPath, originalNestedPath);
                originalNestedMoved = true;
                await rename(replacementNestedPath, nestedPath);
                replacementInstalled = true;
              },
            }),
          /ancestor nested changed after final enumeration/u,
        );
      } finally {
        if (replacementInstalled) {
          await rm(nestedPath, { recursive: true, force: true });
          await rename(originalNestedPath, nestedPath);
        } else if (originalNestedMoved) await rename(originalNestedPath, nestedPath);
        await rm(replacementNestedPath, { recursive: true, force: true });
        await rm(originalNestedPath, { recursive: true, force: true });
      }
    });
  },
);

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

test(
  "rejects a README replaced with an external symlink after snapshot",
  { skip: process.platform === "win32" ? "symlink fixture is not portable to Windows" : false },
  async () => {
    const outsideDirectory = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-race-"));
    try {
      await withFixture({}, async (releaseRoot) => {
        const readmePath = resolve(releaseRoot, "README.md");
        const outsidePath = resolve(outsideDirectory, "README.md");
        await writeFile(outsidePath, await readFile(readmePath));
        await assert.rejects(
          () =>
            validateRelease(releaseRoot, {
              afterSnapshot: async () => {
                await rm(readmePath);
                await symlink(outsidePath, readmePath);
              },
            }),
          /README\.md/u,
          "the validator read the external symlink and accepted its matching digest",
        );
      });
    } finally {
      await rm(outsideDirectory, { recursive: true, force: true });
    }
  },
);

test(
  "rejects a README symlink that preserves the original inode after snapshot",
  { skip: process.platform === "win32" ? "symlink fixture is not portable to Windows" : false },
  async () => {
    const outsideDirectory = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-inode-race-"));
    try {
      await withFixture({}, async (releaseRoot) => {
        const readmePath = resolve(releaseRoot, "README.md");
        const originalPath = resolve(outsideDirectory, "README.md");
        await assert.rejects(
          () =>
            validateRelease(releaseRoot, {
              afterSnapshot: async () => {
                await rename(readmePath, originalPath);
                await symlink(originalPath, readmePath);
              },
            }),
          /README\.md must not be a symbolic link/u,
        );
      });
    } finally {
      await rm(outsideDirectory, { recursive: true, force: true });
    }
  },
);

test(
  "rejects a nested file when its grandparent becomes an inode-preserving symlink",
  { skip: process.platform === "win32" ? "symlink fixture is not portable to Windows" : false },
  async () => {
    await withFixture({}, async (releaseRoot) => {
      await addNestedChecksummedFile(releaseRoot);
      const nestedPath = resolve(releaseRoot, "nested");
      const originalNestedPath = resolve(releaseRoot, "nested-original");
      await assert.rejects(
        () =>
          validateRelease(releaseRoot, {
            afterSnapshot: async () => {
              await rename(nestedPath, originalNestedPath);
              await symlink(originalNestedPath, nestedPath);
            },
          }),
        /nested must not be a symbolic link/u,
      );
    });
  },
);

test("rejects a release root replaced after snapshot", async () => {
  const outsideDirectory = await mkdtemp(resolve(tmpdir(), "webmcp-issue-205-root-race-"));
  try {
    await writeFixture(outsideDirectory);
    await withFixture({}, async (releaseRoot) => {
      const movedRoot = `${releaseRoot}.original`;
      let replacementInstalled = false;
      try {
        await assert.rejects(
          () =>
            validateRelease(releaseRoot, {
              afterSnapshot: async () => {
                await rename(releaseRoot, movedRoot);
                await rename(outsideDirectory, releaseRoot);
                replacementInstalled = true;
              },
            }),
          /release root changed/u,
          "the validator followed a replaced release root directory",
        );
      } finally {
        if (replacementInstalled) await rename(releaseRoot, outsideDirectory);
        await rm(movedRoot, { recursive: true, force: true });
      }
    });
  } finally {
    await rm(outsideDirectory, { recursive: true, force: true });
  }
});

test(
  "rejects a FIFO swapped in after snapshot without blocking",
  { skip: process.platform === "win32" ? "mkfifo is not available on Windows" : false },
  async () => {
    await withFixture({}, async (releaseRoot) => {
      const readmePath = resolve(releaseRoot, "README.md");
      const validatorUrl = pathToFileURL(validatorPath).href;
      const childScript = `
      import { rm } from "node:fs/promises";
      import { spawnSync } from "node:child_process";
      import { validateRelease } from ${JSON.stringify(validatorUrl)};
      const releaseRoot = ${JSON.stringify(releaseRoot)};
      const readmePath = ${JSON.stringify(readmePath)};
      await validateRelease(releaseRoot, {
        afterSnapshot: async () => {
          await rm(readmePath);
          const created = spawnSync("mkfifo", [readmePath], { encoding: "utf8" });
          if (created.status !== 0) throw new Error("mkfifo failed: " + (created.stderr ?? ""));
        },
      });
    `;
      const result = await runTestChildWithTimeout(childScript);
      assert.equal(result.timedOut, false, "the validator blocked while opening a replaced FIFO");
      assert.notEqual(result.status, 0);
      assert.match(result.output, /README\.md must be a regular file/u);
    });
  },
);

test(
  "rejects a symbolic link supplied as the release root",
  { skip: process.platform === "win32" ? "symlink fixture is not portable to Windows" : false },
  async () => {
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
  },
);

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
    await writeFile(
      resolve(releaseRoot, "README.md"),
      "# Kyoto Booking Retry Proof\n2 attempts → 1 simulated booking → 1 confirmation number\ncheck_existing_hotel_booking\ntampered after checksum generation\n",
    );
    const result = runValidator(releaseRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /README\.md digest differs from SHA256SUMS/u);
  });
});

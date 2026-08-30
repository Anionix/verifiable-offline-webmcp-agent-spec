import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = join(repositoryRoot, "scripts/release-validation-context.mjs");

// information_uuid_v5=f2da6444-7447-5120-a39d-446adda200ca
// event_uuid_v7=01a0538e-7b53-7fc4-ab63-52fbfa995401 state=TEST_REPRODUCTION->RED_EXPECTED occurred_at=2026-08-30T16:44:01.747Z

function runGit(directory, args) {
  const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

async function initializeRepository() {
  const directory = await mkdtemp(join(tmpdir(), "hotel-release-context-"));
  runGit(directory, ["init", "--quiet"]);
  runGit(directory, ["config", "user.email", "test@example.invalid"]);
  runGit(directory, ["config", "user.name", "Hotel release test"]);
  runGit(directory, ["config", "commit.gpgsign", "false"]);
  return directory;
}

async function commitFile(directory, path, content, message) {
  return commitFiles(directory, [{ path, content }], message);
}

async function commitFiles(directory, files, message) {
  for (const { path, content } of files) {
    const absolutePath = join(directory, path);
    await mkdir(join(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, content);
  }
  for (const { path } of files) runGit(directory, ["add", path]);
  runGit(directory, ["commit", "--quiet", "-m", message]);
  return runGit(directory, ["rev-parse", "HEAD"]);
}

async function createLinearRepository() {
  const directory = await initializeRepository();
  const baseCommit = await commitFile(directory, "state.txt", "base\n", "base");
  runGit(directory, ["branch", "release-base", baseCommit]);
  const sourceCommit = await commitFile(
    directory,
    "release.txt",
    "release\n",
    "source",
  );
  const currentCommit = await commitFile(
    directory,
    "current.txt",
    "current\n",
    "current",
  );
  runGit(directory, ["checkout", "--quiet", "--detach", currentCommit]);
  return { directory, baseCommit, sourceCommit, currentCommit };
}

async function createSquashRepository({ currentRelease = "release\n", includeLiveness = true } = {}) {
  const directory = await initializeRepository();
  const commonCommit = await commitFile(
    directory,
    "common.txt",
    "common\n",
    "common",
  );
  runGit(directory, ["switch", "--quiet", "-c", "release-base", commonCommit]);
  const baseCommit = await commitFile(
    directory,
    "base.txt",
    "base-only\n",
    "base",
  );
  runGit(directory, ["switch", "--quiet", "-c", "release-source"]);
  await commitFile(
    directory,
    "src/typescript/hotel/browser-store.js",
    "liveness fixed\n",
    "liveness",
  );
  const sourceCommit = await commitFiles(
    directory,
    [
      {
        path: "examples/hotel-booking-demo/public/webmcp-evals.json",
        content: "release\n",
      },
      {
        path: "examples/hotel-booking-demo/README.md",
        content: "historical documentation\n",
      },
      { path: "scripts/validate.sh", content: "historical validation\n" },
      {
        path: "scripts/validate_hotel_release_candidate.mjs",
        content: "historical validator\n",
      },
    ],
    "historical validator",
  );

  runGit(directory, ["switch", "--quiet", "-c", "current", commonCommit]);
  if (includeLiveness) {
    await commitFile(
      directory,
      "src/typescript/hotel/browser-store.js",
      "liveness fixed\n",
      "squashed liveness",
    );
  }
  const currentCommit = await commitFiles(
    directory,
    [
      {
        path: "examples/hotel-booking-demo/public/webmcp-evals.json",
        content: currentRelease,
      },
      {
        path: "examples/hotel-booking-demo/README.md",
        content: "current documentation\n",
      },
      { path: "scripts/validate.sh", content: "current validation (#205)\n" },
      {
        path: "scripts/validate_hotel_release_candidate.mjs",
        content: "current validator\n",
      },
    ],
    "squashed release",
  );
  runGit(directory, ["checkout", "--quiet", "--detach", currentCommit]);
  return { directory, baseCommit, sourceCommit, currentCommit };
}

async function createUnrelatedSourceRepository() {
  const directory = await initializeRepository();
  const commonCommit = await commitFile(
    directory,
    "common.txt",
    "common\n",
    "common",
  );
  const currentCommit = await commitFile(
    directory,
    "current.txt",
    "current\n",
    "current",
  );
  runGit(directory, ["checkout", "--quiet", "--orphan", "orphan-source"]);
  runGit(directory, ["rm", "-r", "-f", "--quiet", "--ignore-unmatch", "."]);
  const baseCommit = await commitFile(
    directory,
    "orphan-base.txt",
    "orphan base\n",
    "orphan base",
  );
  const sourceCommit = await commitFile(
    directory,
    "orphan-source.txt",
    "orphan source\n",
    "orphan source",
  );
  runGit(directory, ["checkout", "--quiet", "--detach", currentCommit]);
  assert.equal(runGit(directory, ["merge-base", commonCommit, currentCommit]), commonCommit);
  return { directory, baseCommit, sourceCommit, currentCommit };
}

async function createRenameSquashRepository({ destinationPath, currentFiles }) {
  const directory = await initializeRepository();
  const commonCommit = await commitFile(directory, "common.txt", "common\n", "common");
  runGit(directory, ["switch", "--quiet", "-c", "release-base", commonCommit]);
  const sourcePath = "src/typescript/hotel/renamed-from.js";
  const baseCommit = await commitFile(directory, sourcePath, "renamed\n", "base");
  runGit(directory, ["switch", "--quiet", "-c", "release-source"]);
  await mkdir(join(directory, dirname(destinationPath)), { recursive: true });
  runGit(directory, ["mv", sourcePath, destinationPath]);
  runGit(directory, ["commit", "--quiet", "-m", "rename source file"]);
  const sourceCommit = runGit(directory, ["rev-parse", "HEAD"]);

  runGit(directory, ["switch", "--quiet", "-c", "current", commonCommit]);
  const currentCommit = await commitFiles(directory, currentFiles, "squashed rename");
  runGit(directory, ["checkout", "--quiet", "--detach", currentCommit]);
  return { directory, baseCommit, sourceCommit, currentCommit };
}

function runValidator({ directory, baseCommit, sourceCommit }) {
  return spawnSync(
    process.execPath,
    [
      validatorPath,
      "--repository-root",
      directory,
      "--base",
      baseCommit,
      "--source",
      sourceCommit,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_HEAD_REF: "historical-branch-name-must-not-matter",
      },
    },
  );
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

async function withRepository(create, callback) {
  const fixture = await create();
  try {
    await callback(fixture);
  } finally {
    await rm(fixture.directory, { force: true, recursive: true });
  }
}

test("accepts a valid base/source history on a detached checkout", async () => {
  await withRepository(createLinearRepository, ({ directory, baseCommit, sourceCommit }) => {
    const result = runValidator({ directory, baseCommit, sourceCommit });

    assert.equal(result.status, 0, output(result));
    assert.match(output(result), /HOTEL_RELEASE_CONTEXT_VALIDATION_PASS/u);
  });
});

test("accepts a squash checkout when source file entries are identical", async () => {
  await withRepository(createSquashRepository, ({ directory, baseCommit, sourceCommit }) => {
    const result = runValidator({ directory, baseCommit, sourceCommit });

    assert.equal(result.status, 0, output(result));
    assert.match(output(result), /mode.*SQUASH_CONTENT_MATCH/u);
  });
});

test("rejects a nonexistent base commit", async () => {
  await withRepository(createLinearRepository, ({ directory, sourceCommit }) => {
    const result = runValidator({
      directory,
      baseCommit: "1".repeat(40),
      sourceCommit,
    });

    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /release base commit must be an existing commit/u);
  });
});

test("rejects a nonexistent source commit", async () => {
  await withRepository(createLinearRepository, ({ directory, baseCommit }) => {
    const result = runValidator({
      directory,
      baseCommit,
      sourceCommit: "2".repeat(40),
    });

    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /release source commit must be an existing commit/u);
  });
});

test("rejects a base object that is not a commit", async () => {
  await withRepository(createLinearRepository, ({ directory, sourceCommit }) => {
    const baseObject = runGit(directory, ["rev-parse", "HEAD:state.txt"]);
    const result = runValidator({
      directory,
      baseCommit: baseObject,
      sourceCommit,
    });

    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /release base commit must be an existing commit/u);
  });
});

test("rejects a base commit unrelated to the source commit", async () => {
  await withRepository(createLinearRepository, async ({ directory, sourceCommit }) => {
    runGit(directory, ["switch", "--quiet", "--orphan", "unrelated-base"]);
    runGit(directory, ["rm", "-r", "-f", "--quiet", "--ignore-unmatch", "."]);
    const unrelatedBase = await commitFile(
      directory,
      "unrelated.txt",
      "unrelated\n",
      "unrelated base",
    );
    const result = runValidator({ directory, baseCommit: unrelatedBase, sourceCommit });

    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /release base commit must be an ancestor of the source commit/u);
  });
});

test("rejects a source commit with no common history with the checkout", async () => {
  await withRepository(createUnrelatedSourceRepository, ({ directory, baseCommit, sourceCommit }) => {
    const result = runValidator({ directory, baseCommit, sourceCommit });

    assert.notEqual(result.status, 0, output(result));
    assert.match(output(result), /release source commit has no common ancestor with the current checkout/u);
  });
});

test("rejects a source whose release file is not present in the squash checkout", async () => {
  await withRepository(
    () => createSquashRepository({ currentRelease: "different\n" }),
    ({ directory, baseCommit, sourceCommit }) => {
      const result = runValidator({ directory, baseCommit, sourceCommit });

      assert.notEqual(result.status, 0, output(result));
      assert.match(
        output(result),
        /release source file entry differs after squash: examples\/hotel-booking-demo\/public\/webmcp-evals\.json/u,
      );
    },
  );
});

test("rejects a squash checkout that omits an intermediate liveness input", async () => {
  await withRepository(
    () => createSquashRepository({ includeLiveness: false }),
    ({ directory, baseCommit, sourceCommit }) => {
      const result = runValidator({ directory, baseCommit, sourceCommit });

      assert.notEqual(result.status, 0, output(result));
      assert.match(
        output(result),
        /release source file entry differs after squash: src\/typescript\/hotel\/browser-store\.js/u,
      );
    },
  );
});

test("rejects an in-scope rename when the old file remains in the squash checkout", async () => {
  await withRepository(
    () =>
      createRenameSquashRepository({
        destinationPath: "src/typescript/hotel/renamed-to.js",
        currentFiles: [
          { path: "src/typescript/hotel/renamed-from.js", content: "stale old file\n" },
          { path: "src/typescript/hotel/renamed-to.js", content: "renamed\n" },
        ],
      }),
    ({ directory, baseCommit, sourceCommit }) => {
      const result = runValidator({ directory, baseCommit, sourceCommit });

      assert.notEqual(result.status, 0, output(result));
      assert.match(
        output(result),
        /release source file entry differs after squash: src\/typescript\/hotel\/renamed-from\.js/u,
      );
    },
  );
});

test("accepts an out-of-scope rename when the old file is deleted in the squash checkout", async () => {
  await withRepository(
    () =>
      createRenameSquashRepository({
        destinationPath: "docs/renamed.js",
        currentFiles: [{ path: "docs/renamed.js", content: "renamed\n" }],
      }),
    ({ directory, baseCommit, sourceCommit }) => {
      const result = runValidator({ directory, baseCommit, sourceCommit });

      assert.equal(result.status, 0, output(result));
      assert.match(output(result), /mode.*SQUASH_CONTENT_MATCH/u);
    },
  );
});

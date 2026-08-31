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

async function createBaseInputSquashRepository() {
  const directory = await initializeRepository();
  const commonCommit = await commitFile(directory, "common.txt", "common\n", "common");
  runGit(directory, ["switch", "--quiet", "-c", "release-base", commonCommit]);
  const baseCommit = await commitFile(
    directory,
    "src/typescript/hotel/base-input.js",
    "base input\n",
    "base release input",
  );
  runGit(directory, ["switch", "--quiet", "-c", "release-source"]);
  const sourceCommit = await commitFile(
    directory,
    "src/typescript/hotel/source-input.js",
    "source input\n",
    "source hotel change",
  );

  runGit(directory, ["switch", "--quiet", "-c", "current", commonCommit]);
  const currentCommit = await commitFile(
    directory,
    "src/typescript/hotel/source-input.js",
    "source input\n",
    "squashed source change",
  );
  runGit(directory, ["checkout", "--quiet", "--detach", currentCommit]);
  return { directory, baseCommit, sourceCommit, currentCommit };
}

async function createDurableEvidenceTagFreshCloneRepository() {
  const sourceRepository = await initializeRepository();
  const bareRepository = await mkdtemp(join(tmpdir(), "hotel-release-context-bare-"));
  const cloneParent = await mkdtemp(join(tmpdir(), "hotel-release-context-clones-"));
  runGit(bareRepository, ["init", "--bare", "--quiet"]);

  const commonCommit = await commitFile(sourceRepository, "common.txt", "common\n", "common");
  runGit(sourceRepository, ["switch", "--quiet", "-c", "release-source", commonCommit]);
  const baseCommit = await commitFile(
    sourceRepository,
    "src/typescript/hotel/base-input.js",
    "base input\n",
    "base release input",
  );
  const sourceCommit = await commitFile(
    sourceRepository,
    "src/typescript/hotel/source-input.js",
    "source input\n",
    "source hotel change",
  );

  runGit(sourceRepository, ["switch", "--quiet", "-c", "main", commonCommit]);
  const currentCommit = await commitFiles(
    sourceRepository,
    [
      { path: "src/typescript/hotel/base-input.js", content: "base input\n" },
      { path: "src/typescript/hotel/source-input.js", content: "source input\n" },
    ],
    "squashed hotel release",
  );
  const evidenceTag = "evidence/synthetic-hotel-release";
  runGit(sourceRepository, ["remote", "add", "origin", bareRepository]);
  runGit(sourceRepository, ["push", "--quiet", "origin", "main"]);
  runGit(sourceRepository, ["tag", "--annotate", "--message", "synthetic durable hotel release evidence", evidenceTag, sourceCommit]);
  runGit(sourceRepository, ["push", "--quiet", "origin", `refs/tags/${evidenceTag}:refs/tags/${evidenceTag}`]);
  runGit(bareRepository, ["symbolic-ref", "HEAD", "refs/heads/main"]);

  const freshWithTag = join(cloneParent, "with-tag");
  runGit(cloneParent, ["clone", "--quiet", "--no-local", "--single-branch", "--branch", "main", bareRepository, "with-tag"]);
  runGit(freshWithTag, ["fetch", "--quiet", "origin", `refs/tags/${evidenceTag}:refs/tags/${evidenceTag}`]);
  const freshWithoutTag = join(cloneParent, "without-tag");
  runGit(cloneParent, ["clone", "--quiet", "--no-local", "--no-tags", "--single-branch", "--branch", "main", bareRepository, "without-tag"]);

  return {
    directory: sourceRepository,
    cleanupDirectories: [bareRepository, cloneParent],
    freshWithTag,
    freshWithoutTag,
    baseCommit,
    sourceCommit,
    currentCommit,
    evidenceTag,
  };
}

const checkoutOnlyBoundaryChanges = Object.freeze([
  {
    expectedPath: ".node-version",
    commonFiles: [{ path: ".node-version", content: "20\n" }],
    currentFiles: [{ path: ".node-version", content: "22\n" }],
  },
  {
    expectedPath: "src/typescript/hotel/current-added.js",
    commonFiles: [],
    currentFiles: [{ path: "src/typescript/hotel/current-added.js", content: "current-only addition\n" }],
  },
  {
    expectedPath: "src/typescript/hotel/current-deleted.js",
    commonFiles: [{ path: "src/typescript/hotel/current-deleted.js", content: "common input\n" }],
    currentFiles: [],
    deletePath: "src/typescript/hotel/current-deleted.js",
  },
]);

async function createCheckoutOnlyDriftSquashRepository({ commonFiles, currentFiles, deletePath }) {
  const directory = await initializeRepository();
  const commonCommit = await commitFiles(
    directory,
    [{ path: "common.txt", content: "common\n" }, ...commonFiles],
    "common inputs",
  );
  runGit(directory, ["switch", "--quiet", "-c", "release-base", commonCommit]);
  const baseCommit = await commitFile(directory, "base.txt", "base-only\n", "base");
  runGit(directory, ["switch", "--quiet", "-c", "release-source"]);
  const sourceCommit = await commitFile(
    directory,
    "src/typescript/hotel/source-input.js",
    "source input\n",
    "source hotel change",
  );

  runGit(directory, ["switch", "--quiet", "-c", "current", commonCommit]);
  if (deletePath) runGit(directory, ["rm", "--quiet", deletePath]);
  const currentCommit = await commitFiles(
    directory,
    [
      { path: "src/typescript/hotel/source-input.js", content: "source input\n" },
      ...currentFiles,
    ],
    "squashed source with checkout-only drift",
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

const directReleaseConfigurationDrifts = Object.freeze([
  {
    path: ".node-version",
    source: "24.15.0\n",
    current: "24.14.0\n",
  },
  {
    path: "package-lock.json",
    source: '{"name":"root-source","lockfileVersion":3,"packages":{}}\n',
    current: '{"name":"root-current","lockfileVersion":3,"packages":{}}\n',
  },
  {
    path: "src/typescript/package-lock.json",
    source: '{"name":"typescript-source","lockfileVersion":3,"packages":{}}\n',
    current: '{"name":"typescript-current","lockfileVersion":3,"packages":{}}\n',
  },
  {
    path: "src/typescript/package.json",
    source: '{"scripts":{"test":"node --test source-suite.test.js"}}\n',
    current: '{"scripts":{"test":"node --test current-suite.test.js"}}\n',
  },
  {
    path: "vercel.json",
    source: "{\"headers\":[{\"source\":\"/(.*)\",\"headers\":[{\"key\":\"Content-Security-Policy\",\"value\":\"default-src 'self'\"}]}]}\n",
    current: "{\"headers\":[{\"source\":\"/(.*)\",\"headers\":[{\"key\":\"Content-Security-Policy\",\"value\":\"default-src *\"}]}]}\n",
  },
  {
    path: "netlify.toml",
    source: "[build]\ncommand = \"npm run build:web\"\n\nContent-Security-Policy = \"default-src 'self'\"\n",
    current: "[build]\ncommand = \"npm run build:web\"\n\nContent-Security-Policy = \"default-src *\"\n",
  },
  {
    path: "render.yaml",
    source: "services:\n  - type: web\n    env: static\n    headers:\n      - name: Content-Security-Policy\n        value: \"default-src 'self'\"\n",
    current: "services:\n  - type: web\n    env: static\n    headers:\n      - name: Content-Security-Policy\n        value: \"default-src *\"\n",
  },
  {
    path: ".openai/hosting.json",
    source: '{"project_id":"source-project"}\n',
    current: '{"project_id":"current-project"}\n',
  },
  {
    path: ".vercelignore",
    source: "dist\n.env*\n",
    current: "dist\npublic\n",
  },
  {
    path: "drizzle/0001_hotel.sql",
    source: "create table hotel_source (id integer);\n",
    current: "create table hotel_current (id integer);\n",
  },
  {
    path: "schemas/hotel-booking-tool-input.schema.json",
    source: '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"source"}\n',
    current: '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"current"}\n',
  },
  {
    path: "schemas/notification-tool-input.schema.json",
    source: '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"source"}\n',
    current: '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"current"}\n',
  },
  {
    path: "schemas/input-provenance.schema.json",
    source: '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"source"}\n',
    current: '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"current"}\n',
  },
  {
    path: "src/typescript/canonical.ts",
    source: 'export const CANONICAL_FIXTURE = "source";\n',
    current: 'export const CANONICAL_FIXTURE = "current";\n',
  },
  {
    path: "data/golden-vectors.json",
    source: '{"name":"golden-vectors","version":"source","vectors":[]}\n',
    current: '{"name":"golden-vectors","version":"current","vectors":[]}\n',
  },
  {
    path: "metadata/offline-sync-verification.json",
    source: '{"status":"PASS","source":"source"}\n',
    current: '{"status":"PASS","source":"current"}\n',
  },
]);

async function createHotelConfigurationDriftRepository(configuration) {
  const directory = await initializeRepository();
  const commonCommit = await commitFile(directory, "common.txt", "common\n", "common");
  runGit(directory, ["switch", "--quiet", "-c", "release-base", commonCommit]);
  const baseCommit = await commitFile(directory, "base.txt", "base-only\n", "base");
  runGit(directory, ["switch", "--quiet", "-c", "release-source"]);
  const sourceCommit = await commitFiles(
    directory,
    [
      {
        path: "src/typescript/hotel/browser-store.js",
        content: "liveness fixed\n",
      },
      { path: configuration.path, content: configuration.source },
    ],
    "hotel release and direct configuration",
  );

  runGit(directory, ["switch", "--quiet", "-c", "current", commonCommit]);
  const currentCommit = await commitFiles(
    directory,
    [
      {
        path: "src/typescript/hotel/browser-store.js",
        content: "liveness fixed\n",
      },
      { path: configuration.path, content: configuration.current },
    ],
    "squashed hotel release with configuration drift",
  );
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
    for (const directory of [fixture.directory, ...(fixture.cleanupDirectories ?? [])]) {
      await rm(directory, { force: true, recursive: true });
    }
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

test("rejects a squash checkout that drops an input introduced by the recorded base", async () => {
  await withRepository(createBaseInputSquashRepository, ({ directory, baseCommit, sourceCommit }) => {
    const result = runValidator({ directory, baseCommit, sourceCommit });

    assert.notEqual(result.status, 0, output(result));
    assert.match(
      output(result),
      /release source file entry differs after squash: src\/typescript\/hotel\/base-input\.js/u,
    );
  });
});

test("validates tag-backed source and base hashes after a fresh clone without a release branch", async () => {
  await withRepository(
    createDurableEvidenceTagFreshCloneRepository,
    ({ freshWithTag, freshWithoutTag, baseCommit, sourceCommit, evidenceTag }) => {
      assert.match(baseCommit, /^[0-9a-f]{40}$/u);
      assert.match(sourceCommit, /^[0-9a-f]{40}$/u);
      assert.equal(runGit(freshWithTag, ["cat-file", "-t", `refs/tags/${evidenceTag}`]), "tag");
      assert.equal(runGit(freshWithTag, ["cat-file", "-t", `refs/tags/${evidenceTag}^{commit}`]), "commit");
      assert.equal(runGit(freshWithTag, ["branch", "--list", "release-source"]), "");

      const taggedResult = runValidator({ directory: freshWithTag, baseCommit, sourceCommit });
      assert.equal(taggedResult.status, 0, output(taggedResult));
      assert.match(output(taggedResult), /mode.*SQUASH_CONTENT_MATCH/u);

      assert.equal(runGit(freshWithoutTag, ["tag", "--list", evidenceTag]), "");
      const missingTagResult = runValidator({ directory: freshWithoutTag, baseCommit, sourceCommit });
      assert.notEqual(missingTagResult.status, 0, output(missingTagResult));
      assert.match(output(missingTagResult), /release source commit must be an existing commit/u);
    },
  );
});

test("rejects checkout-only boundary changes in a squash checkout", async () => {
  for (const change of checkoutOnlyBoundaryChanges) {
    await withRepository(
      () => createCheckoutOnlyDriftSquashRepository(change),
      ({ directory, baseCommit, sourceCommit }) => {
        const result = runValidator({ directory, baseCommit, sourceCommit });

        assert.notEqual(result.status, 0, output(result));
        assert.match(
          output(result),
          new RegExp(`release source file entry differs after squash: ${change.expectedPath.replaceAll(".", "\\.")}`, "u"),
        );
      },
    );
  }
});

test("accepts a checkout-only change to an unrelated media evidence schema", async () => {
  await withRepository(
    () =>
      createCheckoutOnlyDriftSquashRepository({
        commonFiles: [],
        currentFiles: [
          {
            path: "schemas/demo-video-production.schema.json",
            content: '{"$schema":"current media evidence schema"}\n',
          },
        ],
      }),
    ({ directory, baseCommit, sourceCommit }) => {
      const result = runValidator({ directory, baseCommit, sourceCommit });

      assert.equal(result.status, 0, output(result));
      assert.match(output(result), /mode.*SQUASH_CONTENT_MATCH/u);
    },
  );
});

test("accepts only the reviewed notification storage helpers outside hotel squash comparison", async () => {
  await withRepository(
    () =>
      createCheckoutOnlyDriftSquashRepository({
        commonFiles: [
          { path: "src/typescript/notification/storage-create.ts", content: "historical helper\n" },
          { path: "src/typescript/notification/storage-path.ts", content: "historical path helper\n" },
        ],
        currentFiles: [
          { path: "src/typescript/notification/storage-create.ts", content: "reviewed helper\n" },
          { path: "src/typescript/notification/storage-path.ts", content: "reviewed path helper\n" },
        ],
      }),
    ({ directory, baseCommit, sourceCommit }) => {
      const result = runValidator({ directory, baseCommit, sourceCommit });

      assert.equal(result.status, 0, output(result));
      assert.match(output(result), /mode.*SQUASH_CONTENT_MATCH/u);
    },
  );
});

test("keeps adjacent notification source paths inside hotel squash comparison", async () => {
  await withRepository(
    () =>
      createCheckoutOnlyDriftSquashRepository({
        commonFiles: [{ path: "src/typescript/notification/other-helper.ts", content: "historical helper\n" }],
        currentFiles: [{ path: "src/typescript/notification/other-helper.ts", content: "unreviewed helper\n" }],
      }),
    ({ directory, baseCommit, sourceCommit }) => {
      const result = runValidator({ directory, baseCommit, sourceCommit });

      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /release source file entry differs after squash: src\/typescript\/notification\/other-helper\.ts/u);
    },
  );
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

test("rejects a squash checkout when a hotel change coexists with direct release configuration drift", async () => {
  for (const configuration of directReleaseConfigurationDrifts) {
    await withRepository(
      () => createHotelConfigurationDriftRepository(configuration),
      ({ directory, baseCommit, sourceCommit }) => {
        const result = runValidator({ directory, baseCommit, sourceCommit });

        assert.notEqual(result.status, 0, output(result));
        assert.ok(
          output(result).includes(`release source file entry differs after squash: ${configuration.path}`),
          output(result),
        );
      },
    );
  }
});

// information_uuid_v5=eeccc01c-0134-5420-9946-9efe2adbb772
// event_uuid_v7=01a05044-13e7-7d09-befb-4314fb57bcd2
// state_transition=EMPTY_ATTACKER_DIRECTORY_PARENT_RACE -> NO_EXTERNAL_ENTRY_CREATED occurred_at=2026-08-30T01:23:53.959Z
// machine-contract: both storage kinds and both publication paths face replacement after final validation. POSIX creation stays in the moved original directory; real Windows must deny the directory move. Simulating win32 only tests publication, not Windows directory locking.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeSync,
} from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStorageFileInWorkingDirectory, type NotificationStorageKind } from "../notification/storage-create.ts";
import { captureNotificationStorageParent, openNotificationStorageAppendGuard, openNotificationStorageGuard } from "../notification/storage-path.ts";

const kinds: NotificationStorageKind[] = ["database", "audit"];
const platforms = [...new Set<NodeJS.Platform>([process.platform, "win32"])];
const creatorUrl = new URL("../notification/storage-create.ts", import.meta.url).href;

function fixture(kind: NotificationStorageKind) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "notification-parent-create-")));
  const parent = join(directory, "parent");
  const moved = join(directory, "moved");
  const attacker = join(directory, "attacker");
  mkdirSync(parent, { mode: 0o700 });
  mkdirSync(attacker, { mode: 0o700 });
  const filename = kind === "database" ? "queue.sqlite" : "audit.ndjson";
  const path = join(parent, filename);
  const expectedParent = captureNotificationStorageParent(path, kind);
  return { directory, parent, moved, attacker, filename, path, expectedParent };
}

function openGuard(kind: NotificationStorageKind) {
  return kind === "database" ? openNotificationStorageGuard : openNotificationStorageAppendGuard;
}

test("notification creation never uses creation flags in the caller", () => {
  for (const kind of kinds)
    for (const platform of platforms) {
      const item = fixture(kind);
      const originalOpen = fs.openSync;
      try {
        fs.openSync = (path, flags, mode) => {
          assert.ok(typeof flags !== "number" || (flags & constants.O_CREAT) === 0, "all creation belongs in the parent-bound child");
          return originalOpen(path, flags, mode);
        };
        syncBuiltinESMExports();
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const descriptor = openGuard(kind)(item.path, kind, { platform, expectedParent: item.expectedParent });
          try {
            writeSync(descriptor, "ok");
          } finally {
            closeSync(descriptor);
          }
        }
        assert.equal(readFileSync(item.path, "utf8"), kind === "audit" ? "okok" : "ok");
        assert.deepEqual(readdirSync(item.parent), [item.filename]);
        assert.deepEqual(readdirSync(item.attacker), []);
      } finally {
        fs.openSync = originalOpen;
        syncBuiltinESMExports();
        rmSync(item.directory, { recursive: true, force: true });
      }
    }
});

for (const replacement of ["link", "directory"] as const) {
  test(`notification creation rejects an empty ${replacement} replacement before child validation`, () => {
    for (const kind of kinds)
      for (const platform of platforms) {
        const item = fixture(kind);
        let attempted = false;
        try {
          assert.throws(
            () =>
              openGuard(kind)(item.path, kind, {
                platform,
                expectedParent: item.expectedParent,
                afterStorageAbsenceObserved() {
                  attempted = true;
                  renameSync(item.parent, item.moved);
                  if (replacement === "link") symlinkSync(item.attacker, item.parent, "junction");
                  else renameSync(item.attacker, item.parent);
                },
              }),
            /parent changed before bound creation/,
          );
          assert.equal(attempted, true);
          assert.deepEqual(readdirSync(item.moved), []);
          assert.deepEqual(readdirSync(replacement === "link" ? item.attacker : item.parent), []);
        } finally {
          rmSync(item.directory, { recursive: true, force: true });
        }
      }
  });

  test(`notification creation remains parent-bound after final validation and ${replacement} replacement`, () => {
    for (const kind of kinds)
      for (const platform of platforms) {
        const item = fixture(kind);
        const parentDescriptor = openSync(item.parent, constants.O_RDONLY | constants.O_DIRECTORY);
        try {
          const parent = fstatSync(parentDescriptor, { bigint: true });
          // Fixed test program imports the real creation boundary; only fixture data travels on stdin.
          const child = spawnSync(
            process.execPath,
            [
              "--experimental-strip-types",
              "--input-type=module",
              "-e",
              `
          import assert from "node:assert/strict";
          import { readFileSync, renameSync, symlinkSync } from "node:fs";
          const data = JSON.parse(readFileSync(0, "utf8"));
          const { createStorageFileInWorkingDirectory } = await import(data.creatorUrl);
          let raceState;
          const receipt = createStorageFileInWorkingDirectory(data.request, () => {
            if (process.platform === "win32") {
              assert.throws(() => renameSync(data.parent, data.moved), error => ["EPERM", "EACCES", "EBUSY"].includes(error.code));
              raceState = "WINDOWS_DIRECTORY_MOVE_DENIED";
            } else {
              renameSync(data.parent, data.moved);
              if (data.replacement === "link") symlinkSync(data.attacker, data.parent, "dir");
              else renameSync(data.attacker, data.parent);
              raceState = "POSIX_ORIGINAL_DIRECTORY_RENAMED";
            }
          });
          process.stdout.write(JSON.stringify({ raceState, receipt }));
        `,
            ],
            {
              cwd: item.parent,
              encoding: "utf8",
              timeout: 10_000,
              maxBuffer: 16_384,
              shell: false,
              input: JSON.stringify({
                creatorUrl,
                parent: item.parent,
                moved: item.moved,
                attacker: item.attacker,
                replacement,
                request: {
                  kind,
                  filename: item.filename,
                  parentDev: parent.dev.toString(),
                  parentIno: parent.ino.toString(),
                  windowsPublication: platform === "win32",
                },
              }),
            },
          );
          assert.equal(child.error, undefined);
          assert.equal(child.status, 0, child.stderr);
          const receipt = JSON.parse(child.stdout);
          if (process.platform === "win32") {
            assert.equal(receipt.raceState, "WINDOWS_DIRECTORY_MOVE_DENIED");
            assert.equal(existsSync(item.moved), false);
            assert.deepEqual(readdirSync(item.parent), [item.filename]);
            assert.deepEqual(readdirSync(item.attacker), []);
            const descriptor = openGuard(kind)(item.path, kind, { expectedParent: item.expectedParent });
            closeSync(descriptor);
          } else {
            assert.equal(receipt.raceState, "POSIX_ORIGINAL_DIRECTORY_RENAMED");
            assert.deepEqual(readdirSync(item.moved), [item.filename]);
            assert.equal(readFileSync(join(item.moved, item.filename), "utf8"), "");
            assert.deepEqual(readdirSync(replacement === "link" ? item.attacker : item.parent), []);
            assert.throws(() => openGuard(kind)(item.path, kind, { expectedParent: item.expectedParent }), /parent/);
          }
        } finally {
          closeSync(parentDescriptor);
          rmSync(item.directory, { recursive: true, force: true });
        }
      }
  });
}

test("notification creation failure never falls back to a pathname create", () => {
  for (const kind of kinds) {
    const item = fixture(kind);
    try {
      assert.throws(
        () =>
          openGuard(kind)(item.path, kind, {
            expectedParent: item.expectedParent,
            afterStorageAbsenceObserved() {
              renameSync(item.parent, item.moved);
            },
          }),
        /bound creation helper failed/,
      );
      assert.deepEqual(readdirSync(item.moved), []);
      assert.deepEqual(readdirSync(item.attacker), []);
    } finally {
      rmSync(item.directory, { recursive: true, force: true });
    }
  }
});

test("notification creation child ignores inherited Node startup overrides", () => {
  const item = fixture("audit");
  const previousOptions = process.env.NODE_OPTIONS;
  const previousPath = process.env.NODE_PATH;
  try {
    process.env.NODE_OPTIONS = "--this-option-must-never-reach-the-creation-child";
    process.env.NODE_PATH = item.attacker;
    const descriptor = openNotificationStorageAppendGuard(item.path, "audit", { expectedParent: item.expectedParent });
    closeSync(descriptor);
    assert.deepEqual(readdirSync(item.parent), [item.filename]);
    assert.deepEqual(readdirSync(item.attacker), []);
  } finally {
    if (previousOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = previousOptions;
    if (previousPath === undefined) delete process.env.NODE_PATH;
    else process.env.NODE_PATH = previousPath;
    rmSync(item.directory, { recursive: true, force: true });
  }
});

test("notification creation rejects non-basename requests before any create", () => {
  for (const kind of kinds)
    for (const filename of ["../outside.sqlite", "sub/audit.ndjson", "sub\\audit.ndjson", "/audit.ndjson", "C:queue.sqlite", ".", "..", "audit.ndjson\0"]) {
      assert.throws(() => createStorageFileInWorkingDirectory({ kind, filename, parentDev: "1", parentIno: "1", windowsPublication: false }), /simple/);
    }
  assert.throws(() => createStorageFileInWorkingDirectory(null), /invalid/);
});

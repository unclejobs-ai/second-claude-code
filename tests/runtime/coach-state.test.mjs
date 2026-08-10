import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

import { readState, writeState, clearState, stateFilePath } from "../../scripts/lib/coach-state.mjs";

function withTempRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-state-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function withTempRootAsync(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-state-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("state lives under the project, not the plugin", () => {
  withTempRoot((root) => {
    assert.equal(stateFilePath(root), join(root, ".scc", "state", "coach.json"));
  });
});

test("readState returns null when nothing has been written", () => {
  withTempRoot((root) => {
    assert.equal(readState(root), null);
  });
});

test("writeState then readState round-trips the value", () => {
  withTempRoot((root) => {
    const value = { run_id: "r1", round: 2, forks: [] };
    writeState(root, value);
    assert.deepEqual(readState(root), value);
  });
});

test("writeState creates the directory tree when it is missing", () => {
  withTempRoot((root) => {
    writeState(root, { run_id: "r1" });
    assert.equal(existsSync(join(root, ".scc", "state")), true);
  });
});

test("clearState removes the file and readState goes back to null", () => {
  withTempRoot((root) => {
    writeState(root, { run_id: "r1" });
    clearState(root);
    assert.equal(readState(root), null);
  });
});

test("clearState on an absent file does not throw", () => {
  withTempRoot((root) => {
    assert.doesNotThrow(() => clearState(root));
  });
});

test("readState returns null for corrupt JSON instead of throwing", () => {
  withTempRoot((root) => {
    mkdirSync(join(root, ".scc", "state"), { recursive: true });
    writeFileSync(stateFilePath(root), "{ not json", "utf8");
    assert.equal(readState(root), null);
  });
});

test("two roots keep separate state", () => {
  withTempRoot((a) => {
    withTempRoot((b) => {
      writeState(a, { run_id: "a" });
      writeState(b, { run_id: "b" });
      assert.equal(readState(a).run_id, "a");
      assert.equal(readState(b).run_id, "b");
    });
  });
});

test("writeState leaves no temp file behind", () => {
  withTempRoot((root) => {
    writeState(root, { run_id: "r1" });
    const dir = join(root, ".scc", "state");
    const leftovers = readdirSync(dir).filter((name) => name.includes(".tmp-"));
    assert.deepEqual(leftovers, []);
  });
});

test("a stale temp file with an old mtime is swept on the next write", () => {
  withTempRoot((root) => {
    const path = stateFilePath(root);
    mkdirSync(dirname(path), { recursive: true });
    // Simulates a temp file stranded by a writer that was SIGKILLed between
    // writeFileSync and renameSync — nothing in that process ran to clean up.
    const staleTmp = `${path}.tmp-999999`;
    writeFileSync(staleTmp, "leftover from a killed writer", "utf8");
    const old = new Date(Date.now() - 120_000);
    utimesSync(staleTmp, old, old);

    writeState(root, { run_id: "r1" });

    assert.equal(existsSync(staleTmp), false);
  });
});

test("a fresh temp file from a concurrent writer is not swept", () => {
  withTempRoot((root) => {
    const path = stateFilePath(root);
    mkdirSync(dirname(path), { recursive: true });
    // Simulates another writer that is mid-write right now — its temp file
    // is recent, not abandoned, and must survive a concurrent writeState.
    const liveTmp = `${path}.tmp-888888`;
    writeFileSync(liveTmp, "mid-write from a live writer", "utf8");

    writeState(root, { run_id: "r1" });

    assert.equal(existsSync(liveTmp), true);
  });
});

// Runs `tags.length` writer processes against `writerRootArg` while reading
// from `readRoot` for `durationMs`, then asserts every non-null read matches
// a value a writer actually wrote. Shared by the real concurrency test and
// the guard-fires regression test below, so both exercise the exact same
// assertion path.
async function runConcurrentWriteCheck({ readRoot, writerRootArg, tags, durationMs }) {
  const writerScript = new URL("./fixtures/coach-state-writer.mjs", import.meta.url);
  const payloads = tags.map((tag) => ({ tag, blob: tag.repeat(200_000) }));

  const children = tags.map((tag) =>
    spawn(process.execPath, [writerScript.pathname, writerRootArg, tag, String(durationMs)], {
      stdio: "ignore",
    })
  );

  // Read for the same time budget the writers use, so the read loop stays
  // overlapped with active writing for its whole duration rather than
  // spending most of its iterations on an already-stable file.
  const readDeadline = Date.now() + durationMs;
  const readings = [];
  while (Date.now() < readDeadline) {
    readings.push(readState(readRoot));
  }

  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve, reject) => {
          child.on("exit", (code) => {
            if (code !== 0) reject(new Error(`writer fixture exited with code ${code}`));
            else resolve();
          });
          child.on("error", reject);
        })
    )
  );

  // A writer that silently targets the wrong root (an argv-order slip, say)
  // still exits 0 and leaves every read null. Without this, the test below
  // would pass having verified nothing.
  assert.ok(
    readings.some((r) => r !== null),
    "reader observed no writes — the writer fixture did not run against this root"
  );

  for (const reading of readings) {
    if (reading === null) continue;
    const matches = payloads.some((p) => JSON.stringify(p) === JSON.stringify(reading));
    assert.equal(matches, true, `torn read observed: ${JSON.stringify(reading).slice(0, 80)}`);
  }
}

test("concurrent writers never produce a torn read", async () => {
  await withTempRootAsync((root) =>
    runConcurrentWriteCheck({ readRoot: root, writerRootArg: root, tags: ["a", "b", "c"], durationMs: 2000 })
  );
});

test("the no-writes guard fires when the writer fixture targets the wrong root", async () => {
  await withTempRootAsync(async (readRoot) => {
    await withTempRootAsync(async (decoyRoot) => {
      // Stands in for the argv-order mistake the guard exists to catch: the
      // writer runs and exits 0, but against a root the reader never sees.
      await assert.rejects(
        () => runConcurrentWriteCheck({ readRoot, writerRootArg: decoyRoot, tags: ["a"], durationMs: 300 }),
        /reader observed no writes/
      );
    });
  });
});

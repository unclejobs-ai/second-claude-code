import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("concurrent writers never produce a torn read", async () => {
  await withTempRootAsync(async (root) => {
    const writerScript = new URL("./fixtures/coach-state-writer.mjs", import.meta.url);
    const tags = ["a", "b", "c"];
    const durationMs = 2000;
    const payloads = tags.map((tag) => ({ tag, blob: tag.repeat(200_000) }));

    const children = tags.map((tag) =>
      spawn(process.execPath, [writerScript.pathname, root, tag, String(durationMs)], {
        stdio: "ignore",
      })
    );

    // Read for the same time budget the writers use, so the read loop stays
    // overlapped with active writing for its whole duration rather than
    // spending most of its iterations on an already-stable file.
    const readDeadline = Date.now() + durationMs;
    const readings = [];
    while (Date.now() < readDeadline) {
      readings.push(readState(root));
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

    for (const reading of readings) {
      if (reading === null) continue;
      const matches = payloads.some((p) => JSON.stringify(p) === JSON.stringify(reading));
      assert.equal(matches, true, `torn read observed: ${JSON.stringify(reading).slice(0, 80)}`);
    }
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readState, writeState, clearState, stateFilePath } from "../../scripts/lib/coach-state.mjs";

function withTempRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-state-"));
  try {
    return fn(dir);
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

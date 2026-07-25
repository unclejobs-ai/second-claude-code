// The viewer reads a layout nothing used to produce, so it rendered an empty page on every real
// run. These tests hold the adapter to the shape `ui/src/types.ts` declares — a drift here is
// invisible until someone opens the browser.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const script = path.join(root, "scripts", "viewer-session.mjs");
const VIEWER_PHASES = new Set(["research", "analyze", "write", "review", "refine"]);

function makeDataDir({ current_phase = "do", completed = ["plan"], extra = {} } = {}) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "scc-viewer-session-"));
  mkdirSync(path.join(tmp, "data", "state"), { recursive: true });
  mkdirSync(path.join(tmp, "data", "cycles", "cycle-001"), { recursive: true });

  writeFileSync(
    path.join(tmp, "data", "state", "pdca-last-completed.json"),
    JSON.stringify({ run_id: "run-abc", topic: "t", current_phase, completed, ...extra }),
    "utf8"
  );
  for (const [name, body] of [["plan", "# Plan"], ["do", "# Do"], ["check", "# Check"]]) {
    writeFileSync(path.join(tmp, "data", "cycles", "cycle-001", `${name}.md`), body, "utf8");
  }
  return tmp;
}

function run(tmp, sessionDir) {
  const out = execFileSync(
    process.execPath,
    [script, "--data-dir", path.join(tmp, "data"), "--session-dir", sessionDir],
    { cwd: root, encoding: "utf8" }
  );
  return JSON.parse(out);
}

function readArtifacts(sessionDir) {
  const dir = path.join(sessionDir, "artifacts");
  return readdirSync(dir)
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
}

test("writes state.json in the shape the viewer declares", () => {
  const tmp = makeDataDir();
  const sessionDir = path.join(tmp, "session");
  try {
    run(tmp, sessionDir);
    const state = JSON.parse(readFileSync(path.join(sessionDir, "state.json"), "utf8"));

    assert.equal(state.sessionId, "run-abc");
    assert.ok(VIEWER_PHASES.has(state.currentPhase), "currentPhase uses the viewer vocabulary");
    assert.deepEqual(
      state.phases.map((p) => p.name),
      ["research", "analyze", "write", "review", "refine"]
    );
    for (const phase of state.phases) {
      assert.ok(["pending", "active", "completed", "skipped"].includes(phase.status));
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("exactly one phase is active, even though plan feeds two", () => {
  // plan → research + analyze. Marking both active would draw two cursors on the timeline.
  const tmp = makeDataDir({ current_phase: "plan", completed: [] });
  const sessionDir = path.join(tmp, "session");
  try {
    run(tmp, sessionDir);
    const state = JSON.parse(readFileSync(path.join(sessionDir, "state.json"), "utf8"));
    assert.equal(state.phases.filter((p) => p.status === "active").length, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("artifacts follow PDCA order, not filename order", () => {
  // check.md sorts first alphabetically and would put the review above the draft it reviewed.
  const tmp = makeDataDir();
  const sessionDir = path.join(tmp, "session");
  try {
    const result = run(tmp, sessionDir);
    assert.equal(result.artifacts, 3);
    assert.deepEqual(
      readArtifacts(sessionDir).map((a) => a.phase),
      ["research", "write", "review"]
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("every artifact carries the fields the renderer requires", () => {
  const tmp = makeDataDir();
  const sessionDir = path.join(tmp, "session");
  try {
    run(tmp, sessionDir);
    for (const artifact of readArtifacts(sessionDir)) {
      for (const field of ["id", "type", "phase", "title"]) {
        assert.ok(artifact[field], `artifact missing ${field}`);
      }
      assert.ok(VIEWER_PHASES.has(artifact.phase), `unknown phase ${artifact.phase}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("review numbers become a kpi artifact when a review has run", () => {
  const tmp = makeDataDir({
    current_phase: "act",
    completed: ["plan", "do", "check"],
    extra: { reviewer_count: 3, critical_count: 1, warning_count: 2, average_score: 0.82 },
  });
  const sessionDir = path.join(tmp, "session");
  try {
    run(tmp, sessionDir);
    const kpi = readArtifacts(sessionDir).find((a) => a.type === "kpi");
    assert.ok(kpi, "expected a kpi artifact");
    assert.equal(kpi.phase, "review");
    assert.ok(kpi.items.every((i) => "label" in i && "value" in i));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a run_id that would escape the sessions tree is refused", () => {
  // The default session directory is derived from a value read off disk. Dropping the id from the
  // path would fix traversal by collapsing every run into one directory — validate instead.
  const tmp = makeDataDir({ extra: { run_id: "../../escaped" } });
  try {
    assert.throws(
      () =>
        execFileSync(process.execPath, [script, "--data-dir", path.join(tmp, "data")], {
          cwd: root,
          encoding: "utf8",
          stdio: "pipe",
        }),
      /not usable as a directory name/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

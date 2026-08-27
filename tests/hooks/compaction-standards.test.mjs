import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { writeStandard, supersedeStandard } from "../../scripts/lib/standard-record.mjs";
import { writeState } from "../../scripts/lib/coach-state.mjs";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "compaction.mjs");
const sessionStartPath = path.join(root, "hooks", "session-start.mjs");
const NOW = new Date("2026-08-10T00:00:00.000Z");

function withProjectRoot(fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "scc-compact-standards-"));
  return fn(dir);
}

function makeDataDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "scc-compact-data-"));
  mkdirSync(path.join(dir, "state"), { recursive: true });
  return dir;
}

function runPostCompact(projectRoot) {
  const dataDir = makeDataDir();
  const post = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectRoot,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    input: JSON.stringify({ event: "PostCompact" }),
    encoding: "utf8",
  });
  const restored = spawnSync(process.execPath, [sessionStartPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectRoot,
      CLAUDE_PLUGIN_DATA: dataDir,
      SECOND_CLAUDE_CAPABILITIES: '["node"]',
    },
    input: JSON.stringify({ source: "compact" }),
    encoding: "utf8",
  });
  return { ...restored, post };
}

test("an active standard id survives compaction, a superseded one does not", () => {
  withProjectRoot((projectRoot) => {
    writeStandard(
      projectRoot,
      { id: "voice-two-track", title: "Two-track voice", chosen: "c", rejected: [], payload: "", review_when: "", triggers: [] },
      { now: NOW }
    );
    writeStandard(
      projectRoot,
      { id: "old-approach", title: "Old approach", chosen: "c", rejected: [], payload: "", review_when: "", triggers: [] },
      { now: NOW }
    );
    supersedeStandard(projectRoot, "old-approach");

    const result = runPostCompact(projectRoot);
    assert.equal(result.status, 0);
    assert.equal(result.post.stdout, "");
    assert.match(result.stdout, /voice-two-track/);
    assert.doesNotMatch(result.stdout, /old-approach/);
  });
});

test("an open coach interview survives compaction with its settled fork count", () => {
  withProjectRoot((projectRoot) => {
    writeState(projectRoot, { run_id: "r1", status: "in_progress", forks: ["a", "b"] });

    const result = runPostCompact(projectRoot);
    assert.equal(result.status, 0);
    assert.equal(result.post.stdout, "");
    assert.match(result.stdout, /coach/);
    assert.match(result.stdout, /2 standard\(s\) recorded/);
  });
});

test("a finalized (pending_approval) interview is not reported as open", () => {
  withProjectRoot((projectRoot) => {
    writeState(projectRoot, { run_id: "r1", status: "pending_approval", forks: ["a"] });

    const result = runPostCompact(projectRoot);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Second Claude Code/);
    assert.equal(result.post.stdout, "");
  });
});

test("a project with no .scc tree at all produces no output and does not throw", () => {
  withProjectRoot((projectRoot) => {
    const result = runPostCompact(projectRoot);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Second Claude Code/);
    assert.equal(result.post.stdout, "");
    assert.equal(result.post.stderr, "");
  });
});

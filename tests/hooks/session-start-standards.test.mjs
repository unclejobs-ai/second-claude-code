import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeStandard, supersedeStandard } from "../../scripts/lib/standard-record.mjs";
import { writeState } from "../../scripts/lib/coach-state.mjs";

const HOOK = join(process.cwd(), "hooks", "session-start.mjs");
const NOW = new Date("2026-08-10T00:00:00.000Z");

function fork(id, title) {
  return { id, title, chosen: "c", rejected: [], payload: "", review_when: "when", triggers: [id] };
}

function runHook(root) {
  return execFileSync("node", [HOOK], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: "{}",
  });
}

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-hook-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("active standards appear in the session-start output", () => {
  withRoot((root) => {
    writeStandard(root, fork("voice-two-track", "두 목소리로 간다"), { now: NOW });
    const out = runHook(root);
    assert.match(out, /voice-two-track/);
    assert.match(out, /두 목소리로 간다/);
  });
});

test("superseded standards are not loaded", () => {
  withRoot((root) => {
    writeStandard(root, fork("retired", "폐기된 것"), { now: NOW });
    supersedeStandard(root, "retired");
    assert.doesNotMatch(runHook(root), /폐기된 것/);
  });
});

test("an unfinished interview is announced", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: ["a"], status: "in_progress" });
    assert.match(runHook(root), /인터뷰/);
  });
});

test("the standards block stays within its 200-word budget", () => {
  withRoot((root) => {
    for (let i = 0; i < 20; i += 1) {
      writeStandard(root, fork(`std-${i}`, `기준 ${i}`), { now: NOW });
    }
    const out = runHook(root);
    const block = out.split("## 활성 기준")[1] || "";
    assert.ok(block.split(/\s+/).filter(Boolean).length <= 200, "standards block exceeded 200 words");
  });
});

test("at most 12 standards are listed", () => {
  withRoot((root) => {
    for (let i = 0; i < 20; i += 1) {
      writeStandard(root, fork(`std-${i}`, `기준 ${i}`), { now: NOW });
    }
    const out = runHook(root);
    const listed = (out.match(/^- std-\d+/gm) || []).length;
    assert.ok(listed <= 12, `listed ${listed} standards`);
  });
});

test("the eighteen-command banner is gone", () => {
  withRoot((root) => {
    const out = runHook(root);
    assert.doesNotMatch(out, /18 commands/);
    assert.doesNotMatch(out, /Active Plugin Dispatch/);
  });
});

test("a project with no standards still exits cleanly", () => {
  withRoot((root) => {
    assert.doesNotThrow(() => runHook(root));
  });
});

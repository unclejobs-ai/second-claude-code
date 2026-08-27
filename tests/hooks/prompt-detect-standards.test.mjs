import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeStandard } from "../../scripts/lib/standard-record.mjs";

const HOOK = join(process.cwd(), "hooks", "prompt-detect.mjs");
const NOW = new Date("2026-08-10T00:00:00.000Z");

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-pd-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runHook(root, prompt) {
  return execFileSync("node", [HOOK], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({ prompt }),
  });
}

const VOICE = {
  id: "voice-two-track",
  title: "두 목소리로 간다",
  chosen: "S-A와 S-B를 분리한다",
  rejected: [{ label: "고백조", why: "신뢰를 깎는다" }],
  payload: "",
  review_when: "",
  triggers: ["목소리", "S-A"],
};

test("a prompt containing a trigger surfaces the standard", () => {
  withRoot((root) => {
    writeStandard(root, VOICE, { now: NOW });
    const out = runHook(root, "이번 글 목소리 어떻게 갈까");
    assert.match(out, /voice-two-track/);
  });
});

test("an unrelated prompt stays silent", () => {
  withRoot((root) => {
    writeStandard(root, VOICE, { now: NOW });
    assert.equal(runHook(root, "이 함수 리팩터링 해줘").trim(), "");
  });
});

test("a standard with no triggers never fires", () => {
  withRoot((root) => {
    writeStandard(root, { ...VOICE, id: "silent", triggers: [] }, { now: NOW });
    assert.equal(runHook(root, "목소리 어떻게 갈까").trim(), "");
  });
});

test("the hook never instructs a skill invocation", () => {
  withRoot((root) => {
    writeStandard(root, VOICE, { now: NOW });
    const out = runHook(root, "이번 글 목소리 어떻게 갈까");
    assert.doesNotMatch(out, /MUST invoke/);
    assert.doesNotMatch(out, /\[ROUTING\]/);
  });
});

test("an architecture prompt does not route to a content skill", () => {
  // Regression: during the design session this hook twice told the model to
  // invoke scc:refine on an architecture turn.
  withRoot((root) => {
    const out = runHook(root, "스킬 구조를 전면 재설계하고 훅을 고쳐야 해");
    assert.doesNotMatch(out, /scc:refine/);
    assert.doesNotMatch(out, /MUST invoke/);
  });
});

test("a project with no standards produces no output", () => {
  withRoot((root) => {
    assert.equal(runHook(root, "아무 말").trim(), "");
  });
});

test("UserPromptSubmit sanitizes control and bidi characters in a standard path", () => {
  const root = mkdtempSync(join(tmpdir(), "scc-pd-\u001b[31m-\u0007-\u202e"));
  try {
    writeStandard(root, VOICE, { now: NOW });
    const out = runHook(root, "이번 글 목소리 어떻게 갈까");
    assert.match(out, /voice-two-track/);
    assert.doesNotMatch(out, /\u001b/);
    assert.doesNotMatch(out, /\u0007/);
    assert.doesNotMatch(out, /[\u202A-\u202E\u2066-\u2069]/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an oversized prompt payload is a bounded no-op", () => {
  withRoot((root) => {
    const result = spawnSync("node", [HOOK], {
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      input: JSON.stringify({ prompt: "x".repeat(600 * 1024) }),
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), "");
  });
});

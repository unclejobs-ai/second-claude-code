import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "session-end.mjs");

test("session end persists a handoff from canonical state files", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-"));
  const stateDir = path.join(tempDir, "state");

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    path.join(stateDir, "refine-active.json"),
    JSON.stringify({
      goal: "Raise the draft to APPROVED",
      current_iteration: 2,
      max: 4,
      scores: ["NEEDS WORK", "APPROVED"],
    })
  );
  writeFileSync(
    path.join(stateDir, "pipeline-active.json"),
    JSON.stringify({
      name: "weekly-digest",
      current_step: 3,
      total_steps: 5,
      status: "running",
    })
  );

  const result = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    encoding: "utf8",
  });

  // session-end.mjs writes the status message to stderr
  const stderr = result.stderr || "";

  const handoffPath = path.join(tempDir, "HANDOFF.md");
  assert.equal(existsSync(handoffPath), true, "HANDOFF.md should be created");
  assert.match(stderr, /HANDOFF\.md saved/i);

  const handoff = readFileSync(handoffPath, "utf8");
  assert.match(handoff, /Goal: Raise the draft to APPROVED/);
  assert.match(handoff, /Progress: iteration 2\/4/);
  assert.match(handoff, /Scores: NEEDS WORK → APPROVED/);
  assert.match(handoff, /Name: weekly-digest/);
  assert.match(handoff, /Progress: step 3\/5/);
  assert.match(handoff, /Status: running/);
  assert.match(handoff, /re-run.*\/second-claude-code:refine/);
  assert.match(handoff, /\/second-claude-code:workflow run weekly-digest/);
});

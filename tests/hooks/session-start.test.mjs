import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "session-start.mjs");

test("session start renders active state with canonical keys and capability summary", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-"));
  const stateDir = path.join(tempDir, "state");

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    path.join(stateDir, "refine-active.json"),
    JSON.stringify({
      goal: "Polish newsletter draft to 4.5+",
      current_iteration: 2,
      max: 3,
    })
  );
  writeFileSync(
    path.join(stateDir, "workflow-active.json"),
    JSON.stringify({
      name: "weekly-digest",
      current_step: 2,
      total_steps: 4,
    })
  );

  const output = execFileSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    encoding: "utf8",
  });

  assert.match(output, /Active refine: "Polish newsletter draft to 4\.5\+" \(iteration 2\/3\)/);
  assert.match(output, /Active workflow: "weekly-digest" \(step 2\/4\)/);
  assert.match(output, /Capabilities/i);
  assert.match(output, /git/);
  assert.doesNotMatch(output, /undefined/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(root, relPath), "utf8"));
}

test("hook registry points at existing hook entrypoints", () => {
  const hooksConfig = readJson("hooks/hooks.json");
  const hookGroups = Object.values(hooksConfig.hooks);

  for (const group of hookGroups) {
    for (const matcher of group) {
      for (const hook of matcher.hooks) {
        assert.equal(hook.type, "command");
        const match = hook.command.match(/hooks\/([^"]+\.mjs)/);
        assert.ok(match, `hook command should reference a hook script: ${hook.command}`);
        assert.equal(
          existsSync(path.join(root, "hooks", match[1])),
          true,
          `${match[1]} should exist`
        );
      }
    }
  }
});

test("environment detector returns valid capability JSON", () => {
  const scriptPath = path.join(root, "scripts", "detect-environment.sh");
  const output = execFileSync("bash", [scriptPath], {
    cwd: root,
    encoding: "utf8",
  });
  const parsed = JSON.parse(output);

  assert.ok(Array.isArray(parsed.capabilities), "capabilities should be an array");
  for (const capability of parsed.capabilities) {
    assert.equal(typeof capability, "string");
    assert.notEqual(capability.length, 0);
  }
});

test("state manager supports a full read/write/list/exists/clear roundtrip", () => {
  const scriptPath = path.join(root, "scripts", "state-manager.sh");
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-state-"));
  const env = {
    ...process.env,
    CLAUDE_PLUGIN_DATA: tempDir,
  };

  const writeOutput = execFileSync(
    "bash",
    [scriptPath, "write", "loop-active", '{"goal":"Ship smoke tests","current_iteration":1,"max":3}'],
    { cwd: root, env, encoding: "utf8" }
  );
  assert.match(writeOutput, /"ok":true/);

  const existsOutput = execFileSync("bash", [scriptPath, "exists", "loop-active"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.match(existsOutput, /"exists":true/);

  const readOutput = execFileSync("bash", [scriptPath, "read", "loop-active"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.match(readOutput, /Ship smoke tests/);

  const listOutput = execFileSync("bash", [scriptPath, "list"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.match(listOutput, /loop-active/);

  const clearOutput = execFileSync("bash", [scriptPath, "clear", "loop-active"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.match(clearOutput, /"deleted":true/);

  const readAfterClear = execFileSync("bash", [scriptPath, "read", "loop-active"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.match(readAfterClear, /^null\s*$/);
});

test("autopilot preset only uses supported commands, frameworks, and file handoffs", () => {
  const pipeline = readJson("templates/autopilot-pipeline.json");
  const allowedSkills = new Set([
    "/second-claude-code:research",
    "/second-claude-code:write",
    "/second-claude-code:analyze",
    "/second-claude-code:review",
    "/second-claude-code:loop",
    "/second-claude-code:capture",
    "/second-claude-code:pipeline",
    "/second-claude-code:hunt",
  ]);
  const supportedFrameworks = new Set([
    "swot",
    "rice",
    "okr",
    "prd",
    "lean-canvas",
    "persona",
    "journey-map",
    "pricing",
    "gtm",
    "north-star",
    "porter",
    "pestle",
    "ansoff",
    "battlecard",
    "value-prop",
  ]);

  assert.equal(pipeline.name, "autopilot");
  assert.equal(Array.isArray(pipeline.steps), true);
  assert.equal(pipeline.steps.length > 0, true);

  const priorOutputs = new Set();
  for (const [index, step] of pipeline.steps.entries()) {
    assert.equal(allowedSkills.has(step.skill), true, `step ${index + 1} uses a supported command`);
    assert.equal(typeof step.output, "string");
    assert.notEqual(step.output.length, 0);

    if (step.input_from) {
      const inputs = Array.isArray(step.input_from) ? step.input_from : [step.input_from];
      for (const inp of inputs) {
        assert.equal(
          priorOutputs.has(inp),
          true,
          `step ${index + 1} should read from an earlier output (${inp})`
        );
      }
    }

    if (step.skill === "/second-claude-code:analyze") {
      const match = step.args.match(/--framework\s+([^\s]+)/);
      assert.ok(match, "analyze step should declare a framework");
      assert.equal(
        supportedFrameworks.has(match[1]),
        true,
        `framework ${match[1]} should be supported`
      );
    }

    priorOutputs.add(step.output);
  }
});

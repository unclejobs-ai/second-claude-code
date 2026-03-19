import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "prompt-detect.mjs");

function runPrompt(userPrompt) {
  return execFileSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      USER_PROMPT: userPrompt,
    },
    encoding: "utf8",
  });
}

test("prompt detect routes review prompts to /second-claude-code:review", () => {
  const output = runPrompt("quality check this document");
  assert.match(output, /Consider using \/second-claude-code:review/);
});

test("prompt detect routes writing prompts to /second-claude-code:write", () => {
  const output = runPrompt("write a newsletter");
  assert.match(output, /Consider using \/second-claude-code:write/);
});

test("prompt detect prioritizes review for mixed report-quality prompts", () => {
  const output = runPrompt("review this report for quality");
  assert.match(output, /Consider using \/second-claude-code:review/);
});

test("prompt detect still routes Korean review prompts without Hangul literals in source", () => {
  const output = runPrompt("\uC774\uAC70 \uB9AC\uBDF0\uD574");
  assert.match(output, /Consider using \/second-claude-code:review/);
});

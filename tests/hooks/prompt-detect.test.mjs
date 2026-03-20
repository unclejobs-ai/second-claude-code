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

// ── Existing single-skill routing tests ──

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
  const output = runPrompt("이거 리뷰해");
  assert.match(output, /Consider using \/second-claude-code:review/);
});

// ── PDCA compound pattern tests ──

test("PDCA: Korean compound '알아보고' routes to full PDCA", () => {
  const output = runPrompt("AI 에이전트에 대해 알아보고 보고서 써줘");
  assert.match(output, /Consider using \/second-claude-code:pdca/);
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: Korean compound '조사해서' routes to full PDCA", () => {
  const output = runPrompt("시장 동향 조사해서 정리해줘");
  assert.match(output, /Consider using \/second-claude-code:pdca/);
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: English 'research and write' routes to full PDCA", () => {
  const output = runPrompt("research and write a report on AI agents");
  assert.match(output, /Consider using \/second-claude-code:pdca/);
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: English 'review and improve' routes to check+act", () => {
  const output = runPrompt("review and improve this draft");
  assert.match(output, /Consider using \/second-claude-code:pdca/);
  assert.match(output, /Check→Act cycle/);
});

test("PDCA: Korean '검토하고 고쳐' routes to check+act", () => {
  const output = runPrompt("이 초안 검토하고 고쳐줘");
  assert.match(output, /Consider using \/second-claude-code:pdca/);
  assert.match(output, /Check→Act cycle/);
});

test("PDCA: 'end-to-end' routes to full PDCA", () => {
  const output = runPrompt("do an end-to-end analysis of the cloud market");
  assert.match(output, /Consider using \/second-claude-code:pdca/);
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: 'comprehensive report' routes to full PDCA", () => {
  const output = runPrompt("write a comprehensive report on competitor landscape");
  assert.match(output, /Consider using \/second-claude-code:pdca/);
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: compound patterns take priority over single-skill patterns", () => {
  // "research and write" should match PDCA, not individual research or write
  const output = runPrompt("research and write about the future of AI");
  assert.match(output, /Consider using \/second-claude-code:pdca/);
  // Should NOT match individual skills
  assert.doesNotMatch(output, /Consider using \/second-claude-code:research/);
  assert.doesNotMatch(output, /Consider using \/second-claude-code:write/);
});

test("PDCA: single-skill prompts still route to individual skills, not PDCA", () => {
  const output = runPrompt("research the AI market");
  assert.match(output, /Consider using \/second-claude-code:research/);
  assert.doesNotMatch(output, /pdca/);
});

test("PDCA: slash commands are skipped entirely", () => {
  const output = runPrompt("/second-claude-code:review my draft");
  assert.equal(output.trim(), "");
});

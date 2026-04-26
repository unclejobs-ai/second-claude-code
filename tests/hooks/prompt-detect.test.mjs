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

function assertRoutesTo(output, skill) {
  assert.match(output, new RegExp(`skill: \\\\\"second-claude-code:${skill}\\\\\"`));
}

// ── Existing single-skill routing tests ──

test("prompt detect routes review prompts to /second-claude-code:review", () => {
  const output = runPrompt("quality check this document");
  assertRoutesTo(output, "review");
});

test("prompt detect routes writing prompts to /second-claude-code:write", () => {
  const output = runPrompt("write a newsletter");
  assertRoutesTo(output, "write");
});

test("prompt detect prioritizes review for mixed report-quality prompts", () => {
  const output = runPrompt("review this report for quality");
  assertRoutesTo(output, "review");
});

test("prompt detect still routes Korean review prompts without Hangul literals in source", () => {
  const output = runPrompt("이거 리뷰해");
  assertRoutesTo(output, "review");
});

test("prompt detect routes workflow scheduling prompts to /second-claude-code:workflow", () => {
  const output = runPrompt("schedule this workflow every morning");
  assertRoutesTo(output, "workflow");
});

test("prompt detect routes background workflow prompts to /second-claude-code:workflow", () => {
  const output = runPrompt("run this workflow in background");
  assertRoutesTo(output, "workflow");
});

test("prompt detect routes session recall prompts to /second-claude-code:workflow", () => {
  const output = runPrompt("search session recall for Hermes adoption");
  assertRoutesTo(output, "workflow");
});

test("prompt detect routes root-cause debugging prompts to /second-claude-code:investigate", () => {
  const output = runPrompt("investigate the root cause of conflicting claims in this report");
  assertRoutesTo(output, "investigate");
});

test("prompt detect keeps code bug prompts on development guidance", () => {
  const output = runPrompt("fix this bug in src/app.js");
  assert.doesNotMatch(output, /skill: \\\"second-claude-code:investigate\\\"/);
  assert.match(output, /버그·에러·테스트 실패 → systematic-debugging/);
  assert.match(output, /root cause \(비코드 문서\/분석\)/);
});

test("prompt detect routes general investigate prompts to /second-claude-code:research", () => {
  const output = runPrompt("investigate ai market trends");
  assertRoutesTo(output, "research");
});

// ── PDCA compound pattern tests ──

test("PDCA: Korean compound '알아보고' routes to full PDCA", () => {
  const output = runPrompt("AI 에이전트에 대해 알아보고 보고서 써줘");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: Korean compound '조사해서' routes to full PDCA", () => {
  const output = runPrompt("시장 동향 조사해서 정리해줘");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: English 'research and write' routes to full PDCA", () => {
  const output = runPrompt("research and write a report on AI agents");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: English 'review and improve' routes to check+act", () => {
  const output = runPrompt("review and improve this draft");
  assertRoutesTo(output, "pdca");
  assert.match(output, /Check→Act cycle/);
});

test("PDCA: Korean '검토하고 고쳐' routes to check+act", () => {
  const output = runPrompt("이 초안 검토하고 고쳐줘");
  assertRoutesTo(output, "pdca");
  assert.match(output, /Check→Act cycle/);
});

test("PDCA: 'end-to-end' routes to full PDCA", () => {
  const output = runPrompt("do an end-to-end analysis of the cloud market");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: 'comprehensive report' routes to full PDCA", () => {
  const output = runPrompt("write a comprehensive report on competitor landscape");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: compound patterns take priority over single-skill patterns", () => {
  // "research and write" should match PDCA, not individual research or write
  const output = runPrompt("research and write about the future of AI");
  assertRoutesTo(output, "pdca");
  // Should NOT match individual skills
  assert.doesNotMatch(output, /skill: \\"second-claude-code:research\\"/);
  assert.doesNotMatch(output, /skill: \\"second-claude-code:write\\"/);
});

test("PDCA: single-skill prompts still route to individual skills, not PDCA", () => {
  const output = runPrompt("research the AI market");
  assertRoutesTo(output, "research");
  assert.doesNotMatch(output, /skill: \\"second-claude-code:pdca\\"/);
});

test("PDCA: slash commands are skipped entirely", () => {
  const output = runPrompt("/second-claude-code:review my draft");
  assert.equal(output.trim(), "");
});

test("engineering prompt with end-to-end analysis does not misroute to PDCA", () => {
  const output = runPrompt("do an end-to-end analysis of our failing auth flow");
  assert.doesNotMatch(output, /skill: \\"second-claude-code:pdca\\"/);
});

test("engineering prompt with iterate until tests pass does not misroute to refine", () => {
  const output = runPrompt("iterate until the tests pass in this repo");
  assert.doesNotMatch(output, /skill: \\"second-claude-code:refine\\"/);
});

test("engineering prompt with CI deployment workflow does not misroute to workflow", () => {
  const output = runPrompt("automate this workflow in our CI deployment pipeline");
  assert.doesNotMatch(output, /skill: \\"second-claude-code:workflow\\"/);
});

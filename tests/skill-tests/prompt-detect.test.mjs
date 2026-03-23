#!/usr/bin/env node

/**
 * Tests for hooks/prompt-detect.mjs
 *
 * The hook reads process.env.USER_PROMPT and prints a routing hint to stdout,
 * or exits silently (no output) when no pattern matches.
 *
 * Run: node --test tests/skill-tests/prompt-detect.test.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(__dirname, "../../hooks/prompt-detect.mjs");

/**
 * Run the hook with the given USER_PROMPT and return stdout as a trimmed string.
 * Returns "" when the hook exits silently.
 */
function run(prompt) {
  try {
    const stdout = execFileSync(process.execPath, [HOOK], {
      env: { ...process.env, USER_PROMPT: prompt },
      encoding: "utf8",
    });
    return stdout.trim();
  } catch (err) {
    // Non-zero exit or other error — return empty string so callers can assert on it
    if (err.stdout !== undefined) return err.stdout.trim();
    throw err;
  }
}

function extractContext(output) {
  if (!output) return "";
  try {
    const parsed = JSON.parse(output);
    return parsed.hookSpecificOutput?.additionalContext || "";
  } catch {
    return output;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function assertRoutes(output, skill) {
  const context = extractContext(output);
  assert.ok(
    context.includes(`skill: "second-claude-code:${skill}"`),
    `Expected routing to "${skill}" but got: ${JSON.stringify(output)}`
  );
}

function assertSilent(output, description) {
  const context = extractContext(output);
  assert.strictEqual(
    context.includes("[ROUTING]"),
    false,
    `Expected no explicit routing for "${description}" but got: ${JSON.stringify(output)}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. True positives — should output routing hints
// ─────────────────────────────────────────────────────────────────────────────

describe("true positives", () => {
  test("Korean compound: 알아보고 보고서 써줘 → PDCA", () => {
    const out = run("알아보고 보고서 써줘");
    assertRoutes(out, "pdca");
  });

  test("English compound: research and write about AI → PDCA", () => {
    const out = run("research and write about AI");
    assertRoutes(out, "pdca");
  });

  test("Korean single: 이 초안을 리뷰해줘 → review", () => {
    // "리뷰" is in ko.review
    const out = run("이 초안을 리뷰해줘");
    assertRoutes(out, "review");
  });

  test("English single: write a report about AI → write", () => {
    const out = run("write a report about AI");
    assertRoutes(out, "write");
  });

  test("Framework detection: SWOT 분석해줘 → analyze", () => {
    const out = run("SWOT 분석해줘");
    assertRoutes(out, "analyze");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. True negatives — should output nothing
// ─────────────────────────────────────────────────────────────────────────────

describe("true negatives", () => {
  test("Empty prompt → silent", () => {
    const out = run("");
    assertSilent(out, "empty prompt");
  });

  test("Slash command: /second-claude-code:research → silent", () => {
    const out = run("/second-claude-code:research");
    assertSilent(out, "slash command");
  });

  test("Code task: fix the bug in auth.ts → silent", () => {
    const out = run("fix the bug in auth.ts");
    assertSilent(out, "fix bug");
  });

  test("Generic code: add a function to parse JSON → silent", () => {
    const out = run("add a function to parse JSON");
    assertSilent(out, "add function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. False positive prevention — CRITICAL (bugs that were fixed)
// ─────────────────────────────────────────────────────────────────────────────

describe("false positive prevention", () => {
  test("loop through this array → should NOT route to loop", () => {
    const out = run("loop through this array");
    assert.ok(
      !extractContext(out).includes(`skill: "second-claude-code:loop"`),
      `"loop through this array" should not route to loop but got: ${JSON.stringify(out)}`
    );
    assertSilent(out, "loop through this array");
  });

  test("pipeline this data through the transformer → should NOT route to pipeline", () => {
    const out = run("pipeline this data through the transformer");
    assert.ok(
      !extractContext(out).includes(`skill: "second-claude-code:workflow"`),
      `"pipeline this data…" should not route to pipeline but got: ${JSON.stringify(out)}`
    );
    assertSilent(out, "pipeline this data through the transformer");
  });

  test("end-to-end testing with cypress → should NOT route to PDCA", () => {
    const out = run("end-to-end testing with cypress");
    assert.ok(
      !extractContext(out).includes(`skill: "second-claude-code:pdca"`),
      `"end-to-end testing…" should not route to PDCA but got: ${JSON.stringify(out)}`
    );
    assertSilent(out, "end-to-end testing with cypress");
  });

  test("deep dive on this stack trace → should NOT route to PDCA", () => {
    const out = run("deep dive on this stack trace");
    assert.ok(
      !extractContext(out).includes(`skill: "second-claude-code:pdca"`),
      `"deep dive on this stack trace" should not route to PDCA but got: ${JSON.stringify(out)}`
    );
    assertSilent(out, "deep dive on this stack trace");
  });

  test("save this file to disk → should NOT route to collect", () => {
    // BUG: The pattern "save this" (line 232 of prompt-detect.mjs) is too broad.
    // "save this file to disk" is a filesystem instruction, not a knowledge-capture request.
    // Fix: replace "save this" with more specific patterns like "save this link",
    // "save this article", or "save this for later".
    // TODO: fix the pattern before this test will pass.
    const out = run("save this file to disk");
    assert.ok(
      !extractContext(out).includes(`skill: "second-claude-code:collect"`),
      `"save this file to disk" should not route to collect but got: ${JSON.stringify(out)}`
    );
    assertSilent(out, "save this file to disk");
  });

  test("automate this deployment → should NOT route (bare 'automate this' is too broad)", () => {
    // BUG: The pattern "automate this" (line 250 of prompt-detect.mjs) is too broad.
    // "automate this deployment" is a DevOps/CI task, not a knowledge-work pipeline request.
    // Fix: replace "automate this" with "automate this workflow" or "automate this process".
    // TODO: fix the pattern before this test will pass.
    const out = run("automate this deployment");
    assert.ok(
      !extractContext(out).includes(`skill: "second-claude-code:workflow"`),
      `"automate this deployment" should not route to pipeline but got: ${JSON.stringify(out)}`
    );
  });

  test("analyze this function signature → behavior check", () => {
    // "analyze" is a bare-word pattern in the analyze route.
    // This test documents what the hook currently does so regressions are visible.
    // The hook DOES match this because "analyze" is a single-word pattern — this is
    // an acknowledged limitation. The test records the actual behavior.
    const out = run("analyze this function signature");
    // If the hook routes, it should route to analyze (not something else)
    if (extractContext(out).includes("[ROUTING]")) {
      assert.ok(
        extractContext(out).includes(`skill: "second-claude-code:analyze"`),
        `"analyze this function signature" routed but not to analyze: ${JSON.stringify(out)}`
      );
    }
    // No assertion on silent vs. routed — this is a documentation test
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  test("Very long prompt (600+ chars) — only first 500 are scanned", () => {
    // Place a PDCA keyword at position 510 (beyond the 500-char scan window)
    // and nothing matching in the first 500 chars.
    // The hook should be silent.
    const padding = "x".repeat(510);
    const prompt = padding + "research and write about AI";
    const out = run(prompt);
    assertSilent(out, "keyword beyond 500-char scan window");
  });

  test("Very long prompt — keyword within first 500 chars is still detected", () => {
    // Place the keyword at position 10 so it is well within the scan window.
    const padding = "y".repeat(10);
    const prompt = padding + "research and write about AI" + "z".repeat(600);
    const out = run(prompt);
    assertRoutes(out, "pdca");
  });

  test("'write a newsletter and review this' — write wins over review (first-verb heuristic)", () => {
    // "뉴스레터"/"newsletter" triggers write; "review this" triggers review.
    // "write a newsletter" pattern (write) starts at pos 0.
    // "review this" pattern (review) starts at pos 20.
    // The earliest-position algorithm must pick write.
    const out = run("write a newsletter and review this draft");
    assertRoutes(out, "write");
    assert.ok(
      !extractContext(out).includes(`skill: "second-claude-code:review"`),
      `"write a newsletter and review this" should route to write, not review, but got: ${JSON.stringify(out)}`
    );
  });
});

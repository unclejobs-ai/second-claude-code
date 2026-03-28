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
const hookPath = path.join(root, "hooks", "subagent-stop.mjs");

function makeTempDataDir() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-subagent-stop-"));
  mkdirSync(path.join(tempDir, "state"), { recursive: true });
  return tempDir;
}

function aggregationPath(tempDir) {
  return path.join(tempDir, "state", "review-aggregation.json");
}

function writeAggregation(tempDir, state) {
  writeFileSync(aggregationPath(tempDir), JSON.stringify(state, null, 2));
}

function readAggregation(tempDir) {
  return JSON.parse(readFileSync(aggregationPath(tempDir), "utf8"));
}

function runHook(tempDir, payload) {
  return spawnSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    input: payload === undefined ? "" : JSON.stringify(payload),
    encoding: "utf8",
  });
}

function parseStdout(result) {
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function makeReviewer(overrides = {}) {
  return {
    name: "deep-reviewer",
    verdict: "APPROVED",
    is_pass: true,
    critical_count: 0,
    warning_count: 0,
    findings: [],
    score: 0.82,
    ...overrides,
  };
}

test("subagent stop exits quietly when no aggregation session exists", () => {
  const tempDir = makeTempDataDir();
  const result = runHook(tempDir, { output: "Reviewer: deep-reviewer\nAPPROVED" });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(existsSync(aggregationPath(tempDir)), false);
});

test("subagent stop skips empty reviewer output without mutating state", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    expected_reviewers: 3,
    threshold: 0.67,
    reviewers: [makeReviewer({ name: "fact-checker" })],
  });

  const before = readFileSync(aggregationPath(tempDir), "utf8");
  const result = runHook(tempDir);
  const after = readFileSync(aggregationPath(tempDir), "utf8");

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(after, before);
});

test("subagent stop records reviewer output and waits for remaining reviewers", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    expected_reviewers: 3,
    threshold: 0.67,
    reviewers: [],
  });

  const result = runHook(tempDir, {
    output: [
      "Reviewer: fact-checker",
      "**Score**: 0.91",
      "APPROVED",
      "Warning: cite primary sources",
    ].join("\n"),
  });

  const aggregation = readAggregation(tempDir);
  const output = parseStdout(result);
  const reviewer = aggregation.reviewers[0];

  assert.equal(result.status, 0);
  assert.equal(aggregation.reviewers.length, 1);
  assert.equal(reviewer.name, "fact-checker");
  assert.equal(reviewer.verdict, "APPROVED");
  assert.equal(reviewer.is_pass, true);
  assert.equal(reviewer.warning_count, 1);
  assert.equal(reviewer.score, 0.91);
  assert.equal(aggregation.consensus, null);
  assert.match(output.hookSpecificOutput.additionalContext, /\[REVIEW AGGREGATION\] 1\/3 reviewers reported\./);
  assert.match(output.hookSpecificOutput.additionalContext, /Latest: fact-checker → APPROVED score=0\.91 \(1 Warning\)/);
  assert.match(output.hookSpecificOutput.additionalContext, /Waiting for 2 more reviewer\(s\)/);
});

test("subagent stop uses last-write-wins for duplicate reviewer retries", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    expected_reviewers: 2,
    threshold: 0.67,
    reviewers: [
      makeReviewer({
        name: "fact-checker",
        verdict: "FAIL",
        is_pass: false,
        warning_count: 1,
        findings: ["Warning: stale citation"],
        score: 0.42,
      }),
    ],
  });

  runHook(tempDir, {
    output: [
      "Reviewer: fact-checker",
      "Score: 0.84",
      "APPROVED",
    ].join("\n"),
  });

  const aggregation = readAggregation(tempDir);

  assert.equal(aggregation.reviewers.length, 1);
  assert.equal(aggregation.reviewers[0].name, "fact-checker");
  assert.equal(aggregation.reviewers[0].verdict, "APPROVED");
  assert.equal(aggregation.reviewers[0].is_pass, true);
  assert.equal(aggregation.reviewers[0].score, 0.84);
  assert.equal(aggregation.reviewers[0].warning_count, 0);
});

test("subagent stop computes APPROVED consensus with score gate when all reviewers pass cleanly", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    expected_reviewers: 2,
    threshold: 0.67,
    reviewers: [makeReviewer({ name: "deep-reviewer", score: 0.8 })],
  });

  const result = runHook(tempDir, {
    output: [
      "Reviewer: fact-checker",
      "Score: 0.90",
      "APPROVED",
    ].join("\n"),
  });

  const aggregation = readAggregation(tempDir);
  const output = parseStdout(result);

  assert.equal(aggregation.consensus.verdict, "APPROVED");
  assert.equal(aggregation.consensus.pass_count, 2);
  // Math.round(0.67 * 2) = 1 (majority of 2, not unanimity)
  assert.equal(aggregation.consensus.required, 1);
  assert.ok(Math.abs(aggregation.consensus.average_score - 0.85) < 1e-9);
  assert.match(output.hookSpecificOutput.additionalContext, /CONSENSUS: APPROVED \(2\/2 pass, required 1 avg_score=0\.85 \[score-gate\]\)/);
  assert.match(output.hookSpecificOutput.additionalContext, /Review complete\. Proceed with the consensus verdict: APPROVED\./);
});

test("subagent stop requires unanimous approval for quick two-reviewer runs", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    expected_reviewers: 2,
    threshold: 0.67,
    preset: "quick",
    started_reviewers: [
      {
        name: "devil-advocate",
        started_at: "2026-03-28T00:01:00.000Z",
      },
      {
        name: "fact-checker",
        started_at: "2026-03-28T00:02:00.000Z",
      },
    ],
    reviewers: [
      makeReviewer({
        name: "devil-advocate",
        score: 0.8,
      }),
    ],
  });

  const result = runHook(tempDir, {
    output: [
      "Reviewer: fact-checker",
      "Score: 0.70",
      "NEEDS IMPROVEMENT",
    ].join("\n"),
  });

  const aggregation = readAggregation(tempDir);
  const output = parseStdout(result);

  assert.equal(aggregation.threshold, 1);
  assert.equal(aggregation.consensus.verdict, "NEEDS IMPROVEMENT");
  assert.equal(aggregation.consensus.pass_count, 1);
  assert.equal(aggregation.consensus.required, 2);
  assert.ok(Math.abs(aggregation.consensus.average_score - 0.75) < 1e-9);
  assert.match(output.hookSpecificOutput.additionalContext, /CONSENSUS: NEEDS IMPROVEMENT \(1\/2 pass, required 2 avg_score=0\.75 \[score-gate\]\)/);
});

test("subagent stop computes MINOR FIXES when score gate passes but warnings remain", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    expected_reviewers: 2,
    threshold: 0.67,
    reviewers: [
      makeReviewer({
        name: "deep-reviewer",
        verdict: "MINOR FIXES",
        warning_count: 1,
        findings: ["Warning: tighten introduction"],
        score: 0.72,
      }),
    ],
  });

  runHook(tempDir, {
    output: [
      "Reviewer: structure-analyst",
      "Score: 0.90",
      "APPROVED",
    ].join("\n"),
  });

  const aggregation = readAggregation(tempDir);

  assert.equal(aggregation.consensus.verdict, "MINOR FIXES");
  assert.equal(aggregation.consensus.average_score, 0.81);
});

test("subagent stop forces MUST FIX when a critical finding appears in a review table", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    expected_reviewers: 2,
    threshold: 0.67,
    reviewers: [makeReviewer({ name: "deep-reviewer", score: 0.88 })],
  });

  const result = runHook(tempDir, {
    output: [
      "Reviewer: structure-analyst",
      "Score: 0.93",
      "APPROVED",
      "| 1 | Critical | Broken evidence chain |",
    ].join("\n"),
  });

  const aggregation = readAggregation(tempDir);
  const reviewer = aggregation.reviewers.find((item) => item.name === "structure-analyst");
  const output = parseStdout(result);

  assert.equal(reviewer.verdict, "MUST FIX");
  assert.equal(reviewer.critical_count, 1);
  assert.match(reviewer.findings[0], /Critical table: Broken evidence chain/);
  assert.equal(aggregation.consensus.verdict, "MUST FIX");
  assert.match(output.hookSpecificOutput.additionalContext, /Latest: structure-analyst → MUST FIX score=0\.93 \(1 Critical\)/);
  assert.match(output.hookSpecificOutput.additionalContext, /CONSENSUS: MUST FIX/);
});

test("subagent stop downgrades low-score pass verdicts to NEEDS IMPROVEMENT", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    expected_reviewers: 3,
    threshold: 0.67,
    reviewers: [],
  });

  const result = runHook(tempDir, {
    output: [
      "Reviewer: fact-checker",
      "Score: 0.55",
      "APPROVED",
    ].join("\n"),
  });

  const aggregation = readAggregation(tempDir);
  const output = parseStdout(result);

  assert.equal(aggregation.reviewers[0].verdict, "NEEDS IMPROVEMENT");
  assert.equal(aggregation.reviewers[0].is_pass, false);
  assert.match(output.hookSpecificOutput.additionalContext, /Latest: fact-checker → NEEDS IMPROVEMENT score=0\.55/);
});

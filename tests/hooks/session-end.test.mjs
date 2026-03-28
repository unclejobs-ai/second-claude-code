import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "session-end.mjs");

function runSessionEnd(tempDir, extraEnv = {}) {
  return spawnSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
      ...extraEnv,
    },
    encoding: "utf8",
  });
}

function seedPdcaState(tempDir, pdca) {
  const stateDir = path.join(tempDir, "state");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(path.join(stateDir, "pdca-active.json"), JSON.stringify(pdca));
}

function appendPdcaEvents(tempDir, runId, timestamps) {
  const eventsDir = path.join(tempDir, "events");
  mkdirSync(eventsDir, { recursive: true });

  for (const ts of timestamps) {
    appendFileSync(
      path.join(eventsDir, `pdca-${runId}.jsonl`),
      JSON.stringify({
        ts,
        run_id: runId,
        type: "cycle_tick",
        phase: "plan",
      }) + "\n",
      "utf8"
    );
  }
}

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
  writeFileSync(
    path.join(stateDir, "loop-active.json"),
    JSON.stringify({
      run_id: "loop-write-core-20260326",
      suite: "write-core",
      generation: 1,
      max_generations: 3,
      status: "running",
      best_score: 0.84,
    })
  );

  const result = runSessionEnd(tempDir);

  // session-end.mjs writes the status message to stderr
  const stderr = result.stderr || "";

  const handoffPath = path.join(tempDir, "HANDOFF.md");
  assert.equal(existsSync(handoffPath), true, "HANDOFF.md should be created");
  assert.match(stderr, /HANDOFF\.md saved/i);

  const handoff = readFileSync(handoffPath, "utf8");
  assert.match(handoff, /Goal: Raise the draft to APPROVED/);
  assert.match(handoff, /Suite: write-core/);
  assert.match(handoff, /Generation: 1\/3/);
  assert.match(handoff, /Best score: 0\.84/);
  assert.match(handoff, /Progress: iteration 2\/4/);
  assert.match(handoff, /Scores: NEEDS WORK → APPROVED/);
  assert.match(handoff, /Name: weekly-digest/);
  assert.match(handoff, /Progress: step 3\/5/);
  assert.match(handoff, /Status: running/);
  assert.match(handoff, /\/second-claude-code:loop resume loop-write-core-20260326/);
  assert.match(handoff, /re-run.*\/second-claude-code:refine/);
  assert.match(handoff, /\/second-claude-code:workflow run weekly-digest/);
});

test("session end prints an ANSI PDCA completion summary when a cycle has completed act", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-"));
  const stateDir = path.join(tempDir, "state");
  const eventsDir = path.join(tempDir, "events");

  mkdirSync(stateDir, { recursive: true });
  mkdirSync(eventsDir, { recursive: true });

  const runId = "pdca-cycle-summary";

  writeFileSync(
    path.join(stateDir, "pdca-active.json"),
    JSON.stringify({
      run_id: runId,
      topic: "PDCA summary",
      current_phase: "plan",
      completed: ["plan", "do", "check", "act"],
      cycle_count: 2,
      max_cycles: 3,
      check_verdict: "MINOR FIXES",
      average_score: 0.81,
      warning_count: 2,
      critical_findings: [],
      artifacts: {
        plan_research: "/tmp/research.md",
        plan_analysis: "/tmp/analysis.md",
        do: "/tmp/draft.md",
        check_report: "/tmp/review.md",
        act_final: "/tmp/final.md",
      },
    })
  );

  appendFileSync(
    path.join(eventsDir, `pdca-${runId}.jsonl`),
    JSON.stringify({
      ts: new Date().toISOString(),
      run_id: runId,
      type: "cycle_start",
      phase: "plan",
      data: { topic: "PDCA summary", max_cycles: 3 },
    }) + "\n",
    "utf8"
  );

  const result = runSessionEnd(tempDir);

  assert.equal(result.status, 0);
  assert.match(result.stderr, /\u001b\[[0-9;]*m/);
  assert.match(result.stderr, /PDCA Cycle #1/);
  assert.match(result.stderr, /Plan .*Do .*Check .*Act/);
  assert.match(result.stderr, /Time: \d+m  Issues: 2  Score: 81/);
});

test("session end summary box shows warning status, prior cycle number, and placeholder score", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-"));
  const runId = "pdca-cycle-warning";

  seedPdcaState(tempDir, {
    run_id: runId,
    topic: "Warning summary",
    current_phase: "plan",
    completed: ["plan", "do", "check", "act"],
    cycle_count: 3,
    max_cycles: 4,
    check_verdict: "NEEDS IMPROVEMENT",
    warning_count: 1,
    critical_findings: [],
    top_improvements: ["Clarify claim", "Add evidence"],
  });
  appendPdcaEvents(tempDir, runId, [
    "2026-03-28T00:00:00.000Z",
    "2026-03-28T00:05:00.000Z",
  ]);

  const result = runSessionEnd(tempDir);

  assert.equal(result.status, 0);
  assert.match(result.stderr, /PDCA Cycle #2/);
  assert.match(result.stderr, /Check .*⚠/);
  assert.match(result.stderr, /Time: 5m  Issues: 2  Score: --/);
});

test("session end summary box shows must-fix failures and counts critical issues", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-"));
  const runId = "pdca-cycle-failure";

  seedPdcaState(tempDir, {
    run_id: runId,
    topic: "Failure summary",
    current_phase: "act",
    completed: ["plan", "do", "check", "act"],
    cycle_count: 2,
    max_cycles: 3,
    check_verdict: "MUST FIX",
    average_score: 0.49,
    warning_count: 1,
    critical_findings: ["Broken evidence chain"],
    top_improvements: ["Fix tone", "Add citations"],
  });
  appendPdcaEvents(tempDir, runId, [
    "2026-03-28T01:00:00.000Z",
    "2026-03-28T01:02:00.000Z",
  ]);

  const result = runSessionEnd(tempDir);

  assert.equal(result.status, 0);
  assert.match(result.stderr, /Check .*✗/);
  assert.match(result.stderr, /Time: 2m  Issues: 3  Score: 49/);
});

test("session end skips the PDCA summary box until act is completed", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-"));

  seedPdcaState(tempDir, {
    run_id: "pdca-cycle-incomplete",
    topic: "Incomplete summary",
    current_phase: "check",
    completed: ["plan", "do", "check"],
    cycle_count: 1,
    check_verdict: "APPROVED",
    average_score: 0.91,
  });

  const result = runSessionEnd(tempDir);

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /PDCA Cycle #/);
  assert.doesNotMatch(result.stderr, /Time: \d+m  Issues: /);
});

test("session end generates a cycle report only when the PDCA state is in act phase", () => {
  const actDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-"));
  seedPdcaState(actDir, {
    run_id: "pdca-cycle-report-act",
    topic: "Act report",
    current_phase: "act",
    completed: ["plan", "do", "check"],
    cycle_count: 4,
    check_verdict: "MINOR FIXES",
    average_score: 0.88,
    critical_findings: [],
    top_improvements: ["Tighten conclusion"],
    next_action: "Ship after edits",
  });

  const actResult = runSessionEnd(actDir);
  const actReportPath = path.join(actDir, "reports", "cycle-4.html");

  assert.equal(actResult.status, 0);
  assert.equal(existsSync(actReportPath), true);
  assert.match(actResult.stderr, /\[SCC\] Cycle report:/);
  assert.match(readFileSync(actReportPath, "utf8"), /Act report/);

  const checkDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-"));
  seedPdcaState(checkDir, {
    run_id: "pdca-cycle-report-check",
    topic: "Check phase",
    current_phase: "check",
    completed: ["plan", "do", "check"],
    cycle_count: 4,
    check_verdict: "MINOR FIXES",
    average_score: 0.88,
    critical_findings: [],
    top_improvements: ["Tighten conclusion"],
    next_action: "Ship after edits",
  });

  const checkResult = runSessionEnd(checkDir);
  const checkReportPath = path.join(checkDir, "reports", "cycle-4.html");

  assert.equal(checkResult.status, 0);
  assert.equal(existsSync(checkReportPath), false);
  assert.doesNotMatch(checkResult.stderr, /\[SCC\] Cycle report:/);
});

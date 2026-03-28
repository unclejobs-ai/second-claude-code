import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const handlerModulePath = path.join(root, "mcp", "lib", "pdca-handlers.mjs");

async function loadHandlers(dataDir) {
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  return import(`${pathToFileURL(handlerModulePath).href}?t=${Date.now()}-${Math.random()}`);
}

async function prepareCheckPhase(tempDir, statePatch = {}) {
  const handlers = await loadHandlers(tempDir);
  handlers.handleStartRun({ topic: "Decision test" });

  const stateDir = path.join(tempDir, "state");
  mkdirSync(stateDir, { recursive: true });

  const current = handlers.handleGetState();
  Object.assign(current, {
    artifacts: {
      ...current.artifacts,
      plan_research: "/tmp/research.md",
      plan_analysis: "/tmp/analysis.md",
      do: "/tmp/draft.md",
      check_report: "/tmp/review.md",
    },
    sources_count: 3,
    plan_mode_approved: true,
    do_artifact_complete: true,
    plan_findings_integrated: true,
  });

  const fs = await import("node:fs");
  fs.writeFileSync(
    path.join(stateDir, "pdca-active.json"),
    JSON.stringify(current, null, 2),
    "utf8"
  );

  handlers.handleTransition({ target_phase: "do", auto_gate: true });
  handlers.handleTransition({ target_phase: "check", auto_gate: true });

  const ready = handlers.handleGetState();
  Object.assign(ready, {
    check_verdict: "MINOR FIXES",
    reviewer_count: 3,
    average_score: 0.81,
    warning_count: 0,
    critical_findings: [],
    top_improvements: [],
    refine_count: 0,
    pivot_count: 0,
    ...statePatch,
  });

  fs.writeFileSync(
    path.join(stateDir, "pdca-active.json"),
    JSON.stringify(ready, null, 2),
    "utf8"
  );

  return handlers;
}

test("check->act auto_gate returns PROCEED when gate passes without warnings or criticals", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-pdca-decision-"));

  try {
    const handlers = await prepareCheckPhase(tempDir, {
      check_verdict: "APPROVED",
      warning_count: 0,
      critical_findings: [],
    });

    const result = handlers.handleTransition({ target_phase: "act", auto_gate: true });

    assert.equal(result.current_phase, "act");
    assert.equal(result.auto_gate_result.decision, "PROCEED");
    assert.equal(result.refine_count, 0);
    assert.equal(result.pivot_count, 0);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("check->act auto_gate returns REFINE and increments refine_count for warning-only reviews", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-pdca-decision-"));

  try {
    const handlers = await prepareCheckPhase(tempDir, {
      warning_count: 2,
      top_improvements: ["Tighten opening", "Add source callout"],
      refine_count: 1,
      critical_findings: [],
    });

    const result = handlers.handleTransition({ target_phase: "act", auto_gate: true });

    assert.equal(result.current_phase, "act");
    assert.equal(result.auto_gate_result.decision, "REFINE");
    assert.equal(result.refine_count, 2);
    assert.equal(result.pivot_count, 0);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("check->act auto_gate returns PIVOT and increments pivot_count when critical issues exist", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-pdca-decision-"));

  try {
    const handlers = await prepareCheckPhase(tempDir, {
      check_verdict: "MUST FIX",
      warning_count: 1,
      critical_findings: ["Broken evidence chain"],
      pivot_count: 1,
    });

    const result = handlers.handleTransition({ target_phase: "act", auto_gate: true });

    assert.equal(result.current_phase, "act");
    assert.equal(result.auto_gate_result.decision, "PIVOT");
    assert.equal(result.refine_count, 0);
    assert.equal(result.pivot_count, 2);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

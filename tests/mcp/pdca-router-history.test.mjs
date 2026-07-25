// Exercises the real pdca-handlers module rather than a simulation of it.
//
// pdca-state-server.test.mjs reimplements the transition logic locally, which means it cannot catch
// a handler that stops writing state. action_router_history spent a long time declared, documented,
// and never appended to; these tests exist so it cannot go quiet again.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "scc-router-history-"));
process.env.CLAUDE_PLUGIN_DATA = dataDir;

// Imported after CLAUDE_PLUGIN_DATA is set — the module resolves its data paths at load time.
const { handleStartRun, handleTransition, handleGetState, handleEndRun } = await import(
  "../../mcp/lib/pdca-handlers.mjs"
);

/**
 * Drive a run to Act, hand it to `body`, and always close it — a run left active by a failed
 * assertion would cascade into every test after it.
 */
function withRunAtAct(topic, { critical_count = 0, warning_count = 1 } = {}, body) {
  handleStartRun({ topic, domain: "content", max_cycles: 3 });
  try {
    handleTransition({
      target_phase: "do",
      phase_result: { sources_count: 5, plan_mode_approved: true, plan_findings_integrated: true },
    });
    handleTransition({ target_phase: "check", phase_result: { do_artifact_complete: true } });
    handleTransition({
      target_phase: "act",
      phase_result: { reviewer_count: 3, critical_count, warning_count },
    });
    body();
  } finally {
    handleEndRun({ reason: "test" });
  }
}

test.after(() => rmSync(dataDir, { recursive: true, force: true }));

test("leaving Act records the router's route and root cause", () => {
  withRunAtAct("records-route", {}, () => {
    handleTransition({ target_phase: "do", phase_result: { act_root_cause: "COMPLETENESS_GAP" } });

    const history = handleGetState().action_router_history;
    assert.equal(history.length, 1);
    assert.equal(history[0].route, "do");
    assert.equal(history[0].root_cause, "COMPLETENESS_GAP");
    assert.equal(history[0].cycle, 1);
  });
});

test("recorded counts match what the Act decision was computed from", () => {
  // Reviewers may report a count, a list, or both. The history must not log the raw field while the
  // decision used the combined figure, or the log contradicts the decision beside it.
  withRunAtAct("counts-match", { critical_count: 1, warning_count: 0 }, () => {
    handleTransition({
      target_phase: "plan",
      phase_result: { act_root_cause: "SOURCE_GAP", critical_findings: ["a", "b"] },
    });

    const [entry] = handleGetState().action_router_history;
    assert.equal(entry.critical_count, 3, "2 listed findings + critical_count 1");
  });
});

test("history accumulates across re-entries and survives the cycle reset", () => {
  withRunAtAct("accumulates", {}, () => {
    handleTransition({ target_phase: "do", phase_result: { act_root_cause: "FORMAT_VIOLATION" } });
    handleTransition({ target_phase: "check", phase_result: { do_artifact_complete: true } });
    handleTransition({
      target_phase: "act",
      phase_result: { reviewer_count: 3, critical_count: 1, warning_count: 0 },
    });
    handleTransition({ target_phase: "plan", phase_result: { act_root_cause: "SOURCE_GAP" } });

    // resetCycleScopedState clears act_root_cause, so an entry written after the reset would lose it.
    assert.deepEqual(
      handleGetState().action_router_history.map((h) => [h.route, h.root_cause]),
      [
        ["do", "FORMAT_VIOLATION"],
        ["plan", "SOURCE_GAP"],
      ]
    );
  });
});

test("forward transitions leave no router entry", () => {
  handleStartRun({ topic: "forward-only", domain: "content", max_cycles: 3 });
  try {
    handleTransition({
      target_phase: "do",
      phase_result: { sources_count: 5, plan_mode_approved: true, plan_findings_integrated: true },
    });
    handleTransition({ target_phase: "check", phase_result: { do_artifact_complete: true } });

    assert.deepEqual(handleGetState().action_router_history, []);
  } finally {
    handleEndRun({ reason: "test" });
  }
});

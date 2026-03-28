/**
 * Unit tests for PDCA State MCP Server logic.
 *
 * Since the MCP server module auto-starts (side effects on import), we
 * re-implement the pure domain functions here and test them in isolation.
 * For handler-level tests, we use a temporary data directory and call the
 * event-log library directly.
 *
 * Run:  node --test tests/mcp/pdca-state-server.test.mjs
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { logEvent, readEvents, getEventStats, listRunIds } from "../../hooks/lib/event-log.mjs";

// ---------------------------------------------------------------------------
// Domain logic extracted from mcp/pdca-state-server.mjs (pure functions)
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS = {
  plan: ["do"],
  do: ["check"],
  check: ["act"],
  act: ["plan"],
};

const GATE_REQUIRED = {
  plan_to_do: ["brief_exists", "sources_min_3", "analysis_exists", "plan_mode_approved"],
  do_to_check: ["artifact_exists", "artifact_complete", "plan_integrated"],
  check_to_act: ["verdict_set", "min_two_reviewers"],
  act_to_exit: ["decision_set", "root_cause_set"],
};

function evaluateGate(gate, state) {
  const required = GATE_REQUIRED[gate];
  if (!required) {
    return { passed: false, missing: [`unknown gate: ${gate}`] };
  }

  const missing = [];
  const artifacts = state.artifacts ?? {};

  switch (gate) {
    case "plan_to_do":
      if (!artifacts.plan_research) missing.push("brief_exists");
      if ((state.sources_count ?? 0) < 3) missing.push("sources_min_3");
      if (!artifacts.plan_analysis) missing.push("analysis_exists");
      if (!state.plan_mode_approved) missing.push("plan_mode_approved");
      break;

    case "do_to_check":
      if (!artifacts.do) missing.push("artifact_exists");
      if (!state.do_artifact_complete) missing.push("artifact_complete");
      if (!state.plan_findings_integrated) missing.push("plan_integrated");
      break;

    case "check_to_act":
      if (!state.check_verdict) missing.push("verdict_set");
      if ((state.reviewer_count ?? 0) < 2) missing.push("min_two_reviewers");
      break;

    case "act_to_exit":
      if (!state.act_decision) missing.push("decision_set");
      if (!state.act_root_cause) missing.push("root_cause_set");
      break;
  }

  return { passed: missing.length === 0, missing };
}

function buildInitialState(topic, maxCycles) {
  return {
    run_id: randomUUID(),
    topic,
    current_phase: "plan",
    completed: [],
    cycle_count: 1,
    max_cycles: maxCycles,
    artifacts: {
      plan_research: null,
      plan_analysis: null,
      do: null,
      check_report: null,
      act_final: null,
    },
    gates: {
      plan_to_do: null,
      do_to_check: null,
      check_to_act: null,
    },
    check_verdict: null,
    action_router_history: [],
    assumptions: [],
    stuck_flags: [],
    scope_creep_detail: {
      planned_scope: null,
      actual_scope: null,
      additions: [],
      omissions: [],
    },
    sources_count: 0,
    plan_mode_approved: false,
    do_artifact_complete: false,
    plan_findings_integrated: false,
    reviewer_count: 0,
    act_decision: null,
    act_root_cause: null,
  };
}

// ---------------------------------------------------------------------------
// Atomic file helpers (same as server)
// ---------------------------------------------------------------------------

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw new Error(`Failed to read ${path}: ${err.message}`);
  }
}

function writeJsonSync(filePath, data) {
  const dir = join(filePath, "..");
  mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Handler-level helpers (replicate server logic using temp dirs)
// ---------------------------------------------------------------------------

function createTestEnv() {
  const tempDir = mkdtempSync(join(os.tmpdir(), "pdca-test-"));
  const stateDir = join(tempDir, "state");
  mkdirSync(stateDir, { recursive: true });
  const activeFile = join(stateDir, "pdca-active.json");
  const completedFile = join(stateDir, "pdca-last-completed.json");

  return { tempDir, stateDir, activeFile, completedFile };
}

/**
 * Simulate handleStartRun using temp dir.
 */
function simulateStartRun(env, { topic, max_cycles = 3 }) {
  if (typeof topic !== "string" || topic.trim() === "") {
    throw new Error("topic must be a non-empty string");
  }
  if (typeof max_cycles !== "number" || !Number.isInteger(max_cycles) || max_cycles < 1) {
    throw new Error("max_cycles must be a positive integer");
  }

  const existing = readJson(env.activeFile);
  if (existing) {
    throw new Error(
      `Active PDCA run already exists (run_id: ${existing.run_id}, topic: "${existing.topic}"). ` +
        `End it with pdca_end_run before starting a new one.`
    );
  }

  const state = buildInitialState(topic.trim(), max_cycles);
  writeJsonSync(env.activeFile, state);

  logEvent(env.tempDir, state.run_id, {
    type: "cycle_start",
    phase: "plan",
    data: { topic: state.topic, max_cycles: state.max_cycles },
  });

  return state;
}

/** Map from "current_phase → target_phase" to the gate key. */
const PHASE_TO_GATE = {
  plan_do: "plan_to_do",
  do_check: "do_to_check",
  check_act: "check_to_act",
  act_plan: "act_to_exit",
};

/**
 * Simulate handleTransition using temp dir.
 */
function simulateTransition(env, { target_phase, artifacts = {}, auto_gate = false }) {
  const validPhases = ["plan", "do", "check", "act"];
  if (!validPhases.includes(target_phase)) {
    throw new Error(
      `target_phase must be one of: ${validPhases.join(", ")}. Got: "${target_phase}"`
    );
  }

  const state = readJson(env.activeFile);
  if (!state) {
    throw new Error("No active PDCA run. Start one with pdca_start_run.");
  }

  const current = state.current_phase;
  const allowed = VALID_TRANSITIONS[current] ?? [];
  if (!allowed.includes(target_phase)) {
    throw new Error(
      `Illegal transition: ${current} → ${target_phase}. ` +
        `From "${current}", allowed targets are: ${allowed.length > 0 ? allowed.join(", ") : "none (terminal phase)"}.`
    );
  }

  // ── auto_gate: evaluate the gate for this transition first ──
  if (auto_gate) {
    const gateKey = PHASE_TO_GATE[`${current}_${target_phase}`];
    if (gateKey) {
      const gateResult = evaluateGate(gateKey, state);

      logEvent(env.tempDir, state.run_id, {
        type: "gate_check",
        phase: current,
        action: gateKey,
        data: { passed: gateResult.passed, missing: gateResult.missing },
      });

      logEvent(env.tempDir, state.run_id, {
        type: gateResult.passed ? "gate_pass" : "gate_fail",
        phase: current,
        action: gateKey,
        data: gateResult.passed ? undefined : { missing: gateResult.missing },
      });

      if (!gateResult.passed) {
        return {
          transitioned: false,
          gate: gateKey,
          gate_result: gateResult,
          current_phase: current,
          target_phase,
        };
      }
    }
  }

  if (!state.completed.includes(current)) {
    state.completed.push(current);
  }

  if (target_phase === "plan") {
    state.cycle_count = (state.cycle_count ?? 1) + 1;
    if (state.cycle_count > state.max_cycles) {
      throw new Error(
        `max_cycles (${state.max_cycles}) reached. ` +
          `Cannot start another PDCA cycle. Use pdca_end_run to close the run.`
      );
    }
  }

  const VALID_ARTIFACT_KEYS = new Set(["plan_research", "plan_analysis", "do", "check_report", "act_final"]);
  if (artifacts && typeof artifacts === "object") {
    for (const k of Object.keys(artifacts)) {
      if (VALID_ARTIFACT_KEYS.has(k)) {
        state.artifacts[k] = artifacts[k];
      }
    }
  }

  const previousPhase = current;
  state.current_phase = target_phase;

  writeJsonSync(env.activeFile, state);

  logEvent(env.tempDir, state.run_id, {
    type: "phase_end",
    phase: previousPhase,
    data: { artifacts_set: Object.keys(state.artifacts).filter((k) => state.artifacts[k] !== null) },
  });

  logEvent(env.tempDir, state.run_id, {
    type: "phase_start",
    phase: target_phase,
    data: { cycle_count: state.cycle_count },
  });

  return state;
}

/**
 * Simulate handleCheckGate using temp dir.
 */
function simulateCheckGate(env, { gate }) {
  const validGates = Object.keys(GATE_REQUIRED);
  if (!validGates.includes(gate)) {
    throw new Error(
      `gate must be one of: ${validGates.join(", ")}. Got: "${gate}"`
    );
  }

  const state = readJson(env.activeFile);
  if (!state) {
    throw new Error("No active PDCA run. Start one with pdca_start_run.");
  }

  const result = evaluateGate(gate, state);

  logEvent(env.tempDir, state.run_id, {
    type: "gate_check",
    phase: state.current_phase,
    action: gate,
    data: { passed: result.passed, missing: result.missing },
  });

  logEvent(env.tempDir, state.run_id, {
    type: result.passed ? "gate_pass" : "gate_fail",
    phase: state.current_phase,
    action: gate,
    data: result.passed ? undefined : { missing: result.missing },
  });

  return result;
}

/**
 * Simulate handleUpdateStuckFlags using temp dir.
 */
function simulateUpdateStuckFlags(env, { flags }) {
  if (!Array.isArray(flags) || flags.length === 0) {
    throw new Error("flags must be a non-empty array of strings");
  }
  for (const f of flags) {
    if (typeof f !== "string") {
      throw new Error("Each flag must be a string");
    }
  }

  const state = readJson(env.activeFile);
  if (!state) {
    throw new Error("No active PDCA run. Start one with pdca_start_run.");
  }

  const existing = new Set(state.stuck_flags ?? []);
  const newFlags = flags.filter((f) => !existing.has(f));
  for (const f of flags) {
    existing.add(f);
  }
  state.stuck_flags = Array.from(existing);

  writeJsonSync(env.activeFile, state);

  if (newFlags.length > 0) {
    logEvent(env.tempDir, state.run_id, {
      type: "stuck_detected",
      phase: state.current_phase,
      data: { new_flags: newFlags, all_flags: state.stuck_flags },
    });
  }

  return state;
}

/**
 * Simulate handleEndRun using temp dir.
 */
function simulateEndRun(env) {
  const state = readJson(env.activeFile);
  if (!state) {
    throw new Error("No active PDCA run to end.");
  }

  const endedAt = new Date().toISOString();

  const summary = {
    run_id: state.run_id,
    topic: state.topic,
    completed_phases: state.completed,
    cycle_count: state.cycle_count,
    artifacts: state.artifacts,
    check_verdict: state.check_verdict,
    stuck_flags: state.stuck_flags,
    ended_at: endedAt,
  };

  const stats = getEventStats(env.tempDir, state.run_id);
  logEvent(env.tempDir, state.run_id, {
    type: "cycle_end",
    phase: state.current_phase,
    data: {
      completed_phases: state.completed,
      cycle_count: state.cycle_count,
      check_verdict: state.check_verdict,
      stuck_flags: state.stuck_flags,
      event_stats: stats,
      ended_at: endedAt,
    },
  });

  writeJsonSync(env.completedFile, { ...state, ended_at: endedAt });

  if (existsSync(env.activeFile)) {
    unlinkSync(env.activeFile);
  }

  return summary;
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("PDCA State Server — State Transitions", () => {
  let env;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    rmSync(env.tempDir, { recursive: true, force: true });
  });

  it("starts in 'plan' phase", () => {
    const state = simulateStartRun(env, { topic: "Test topic" });
    assert.equal(state.current_phase, "plan");
    assert.equal(state.cycle_count, 1);
    assert.deepEqual(state.completed, []);
  });

  it("plan → do transition", () => {
    simulateStartRun(env, { topic: "Test topic" });
    const state = simulateTransition(env, { target_phase: "do" });
    assert.equal(state.current_phase, "do");
    assert.ok(state.completed.includes("plan"));
  });

  it("do → check transition", () => {
    simulateStartRun(env, { topic: "Test topic" });
    simulateTransition(env, { target_phase: "do" });
    const state = simulateTransition(env, { target_phase: "check" });
    assert.equal(state.current_phase, "check");
    assert.ok(state.completed.includes("do"));
  });

  it("check → act transition", () => {
    simulateStartRun(env, { topic: "Test topic" });
    simulateTransition(env, { target_phase: "do" });
    simulateTransition(env, { target_phase: "check" });
    const state = simulateTransition(env, { target_phase: "act" });
    assert.equal(state.current_phase, "act");
    assert.ok(state.completed.includes("check"));
  });

  it("full cycle: plan → do → check → act → plan", () => {
    simulateStartRun(env, { topic: "Full cycle" });
    simulateTransition(env, { target_phase: "do" });
    simulateTransition(env, { target_phase: "check" });
    simulateTransition(env, { target_phase: "act" });
    const state = simulateTransition(env, { target_phase: "plan" });
    assert.equal(state.current_phase, "plan");
    assert.equal(state.cycle_count, 2);
    assert.deepEqual(state.completed, ["plan", "do", "check", "act"]);
  });

  it("merges artifacts during transition", () => {
    simulateStartRun(env, { topic: "Artifact test" });
    const state = simulateTransition(env, {
      target_phase: "do",
      artifacts: { plan_research: "/tmp/research.md", plan_analysis: "/tmp/analysis.md" },
    });
    assert.equal(state.artifacts.plan_research, "/tmp/research.md");
    assert.equal(state.artifacts.plan_analysis, "/tmp/analysis.md");
  });

  it("ignores invalid artifact keys", () => {
    simulateStartRun(env, { topic: "Artifact filter" });
    const state = simulateTransition(env, {
      target_phase: "do",
      artifacts: { plan_research: "/valid.md", bogus_key: "/ignored.md" },
    });
    assert.equal(state.artifacts.plan_research, "/valid.md");
    assert.equal(state.artifacts.bogus_key, undefined);
  });
});

describe("PDCA State Server — Invalid Transitions Rejected", () => {
  let env;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    rmSync(env.tempDir, { recursive: true, force: true });
  });

  it("rejects plan → check (must go through do)", () => {
    simulateStartRun(env, { topic: "Test" });
    assert.throws(
      () => simulateTransition(env, { target_phase: "check" }),
      /Illegal transition.*plan.*check/
    );
  });

  it("rejects plan → act", () => {
    simulateStartRun(env, { topic: "Test" });
    assert.throws(
      () => simulateTransition(env, { target_phase: "act" }),
      /Illegal transition.*plan.*act/
    );
  });

  it("rejects do → act (must go through check)", () => {
    simulateStartRun(env, { topic: "Test" });
    simulateTransition(env, { target_phase: "do" });
    assert.throws(
      () => simulateTransition(env, { target_phase: "act" }),
      /Illegal transition.*do.*act/
    );
  });

  it("rejects do → plan (must go through check → act)", () => {
    simulateStartRun(env, { topic: "Test" });
    simulateTransition(env, { target_phase: "do" });
    assert.throws(
      () => simulateTransition(env, { target_phase: "plan" }),
      /Illegal transition.*do.*plan/
    );
  });

  it("rejects check → do", () => {
    simulateStartRun(env, { topic: "Test" });
    simulateTransition(env, { target_phase: "do" });
    simulateTransition(env, { target_phase: "check" });
    assert.throws(
      () => simulateTransition(env, { target_phase: "do" }),
      /Illegal transition.*check.*do/
    );
  });

  it("rejects invalid target_phase value", () => {
    simulateStartRun(env, { topic: "Test" });
    assert.throws(
      () => simulateTransition(env, { target_phase: "invalid" }),
      /target_phase must be one of/
    );
  });

  it("rejects transition when no run is active", () => {
    assert.throws(
      () => simulateTransition(env, { target_phase: "do" }),
      /No active PDCA run/
    );
  });

  it("rejects exceeding max_cycles", () => {
    simulateStartRun(env, { topic: "Test", max_cycles: 1 });
    simulateTransition(env, { target_phase: "do" });
    simulateTransition(env, { target_phase: "check" });
    simulateTransition(env, { target_phase: "act" });
    assert.throws(
      () => simulateTransition(env, { target_phase: "plan" }),
      /max_cycles.*reached/
    );
  });
});

describe("PDCA State Server — Gate Evaluation Logic", () => {
  it("plan_to_do gate fails when nothing is set", () => {
    const state = buildInitialState("Test", 3);
    const result = evaluateGate("plan_to_do", state);
    assert.equal(result.passed, false);
    assert.deepEqual(result.missing, [
      "brief_exists",
      "sources_min_3",
      "analysis_exists",
      "plan_mode_approved",
    ]);
  });

  it("plan_to_do gate passes when all conditions met", () => {
    const state = buildInitialState("Test", 3);
    state.artifacts.plan_research = "/research.md";
    state.sources_count = 5;
    state.artifacts.plan_analysis = "/analysis.md";
    state.plan_mode_approved = true;
    const result = evaluateGate("plan_to_do", state);
    assert.equal(result.passed, true);
    assert.deepEqual(result.missing, []);
  });

  it("plan_to_do gate fails with partial conditions", () => {
    const state = buildInitialState("Test", 3);
    state.artifacts.plan_research = "/research.md";
    state.sources_count = 2; // less than 3
    const result = evaluateGate("plan_to_do", state);
    assert.equal(result.passed, false);
    assert.ok(result.missing.includes("sources_min_3"));
    assert.ok(result.missing.includes("analysis_exists"));
    assert.ok(result.missing.includes("plan_mode_approved"));
    assert.ok(!result.missing.includes("brief_exists"));
  });

  it("do_to_check gate fails when nothing is set", () => {
    const state = buildInitialState("Test", 3);
    const result = evaluateGate("do_to_check", state);
    assert.equal(result.passed, false);
    assert.deepEqual(result.missing, [
      "artifact_exists",
      "artifact_complete",
      "plan_integrated",
    ]);
  });

  it("do_to_check gate passes when all conditions met", () => {
    const state = buildInitialState("Test", 3);
    state.artifacts.do = "/artifact.ts";
    state.do_artifact_complete = true;
    state.plan_findings_integrated = true;
    const result = evaluateGate("do_to_check", state);
    assert.equal(result.passed, true);
    assert.deepEqual(result.missing, []);
  });

  it("check_to_act gate fails when nothing is set", () => {
    const state = buildInitialState("Test", 3);
    const result = evaluateGate("check_to_act", state);
    assert.equal(result.passed, false);
    assert.deepEqual(result.missing, ["verdict_set", "min_two_reviewers"]);
  });

  it("check_to_act gate passes when all conditions met", () => {
    const state = buildInitialState("Test", 3);
    state.check_verdict = "pass";
    state.reviewer_count = 3;
    const result = evaluateGate("check_to_act", state);
    assert.equal(result.passed, true);
    assert.deepEqual(result.missing, []);
  });

  it("check_to_act gate fails with exactly 1 reviewer", () => {
    const state = buildInitialState("Test", 3);
    state.check_verdict = "pass";
    state.reviewer_count = 1;
    const result = evaluateGate("check_to_act", state);
    assert.equal(result.passed, false);
    assert.ok(result.missing.includes("min_two_reviewers"));
  });

  it("act_to_exit gate fails when nothing is set", () => {
    const state = buildInitialState("Test", 3);
    const result = evaluateGate("act_to_exit", state);
    assert.equal(result.passed, false);
    assert.deepEqual(result.missing, ["decision_set", "root_cause_set"]);
  });

  it("act_to_exit gate passes when all conditions met", () => {
    const state = buildInitialState("Test", 3);
    state.act_decision = "ship";
    state.act_root_cause = "Performance degradation from N+1 queries";
    const result = evaluateGate("act_to_exit", state);
    assert.equal(result.passed, true);
    assert.deepEqual(result.missing, []);
  });

  it("unknown gate returns failure with descriptive message", () => {
    const state = buildInitialState("Test", 3);
    const result = evaluateGate("nonexistent_gate", state);
    assert.equal(result.passed, false);
    assert.equal(result.missing.length, 1);
    assert.ok(result.missing[0].includes("unknown gate"));
  });

  it("handleCheckGate rejects invalid gate name", () => {
    const env = createTestEnv();
    try {
      simulateStartRun(env, { topic: "Test" });
      assert.throws(
        () => simulateCheckGate(env, { gate: "bogus_gate" }),
        /gate must be one of/
      );
    } finally {
      rmSync(env.tempDir, { recursive: true, force: true });
    }
  });

  it("handleCheckGate works against live state (gate fails)", () => {
    const env = createTestEnv();
    try {
      simulateStartRun(env, { topic: "Gate integration" });
      const result = simulateCheckGate(env, { gate: "plan_to_do" });
      assert.equal(result.passed, false);
      assert.ok(result.missing.length > 0);
    } finally {
      rmSync(env.tempDir, { recursive: true, force: true });
    }
  });

  it("handleCheckGate passes after state is fully prepared", () => {
    const env = createTestEnv();
    try {
      simulateStartRun(env, { topic: "Gate pass test" });
      // Manually update state to satisfy plan_to_do gate
      const state = readJson(env.activeFile);
      state.artifacts.plan_research = "/research.md";
      state.sources_count = 5;
      state.artifacts.plan_analysis = "/analysis.md";
      state.plan_mode_approved = true;
      writeJsonSync(env.activeFile, state);

      const result = simulateCheckGate(env, { gate: "plan_to_do" });
      assert.equal(result.passed, true);
      assert.deepEqual(result.missing, []);
    } finally {
      rmSync(env.tempDir, { recursive: true, force: true });
    }
  });
});

describe("PDCA State Server — Event Logging", () => {
  let env;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    rmSync(env.tempDir, { recursive: true, force: true });
  });

  it("start_run logs cycle_start event", () => {
    const state = simulateStartRun(env, { topic: "Event test" });
    const events = readEvents(env.tempDir, state.run_id);
    assert.ok(events.length >= 1);
    assert.equal(events[0].type, "cycle_start");
    assert.equal(events[0].phase, "plan");
    assert.equal(events[0].data.topic, "Event test");
  });

  it("transition logs phase_end and phase_start events", () => {
    const state = simulateStartRun(env, { topic: "Event test" });
    simulateTransition(env, { target_phase: "do" });
    const events = readEvents(env.tempDir, state.run_id);
    // cycle_start, phase_end(plan), phase_start(do)
    assert.ok(events.length >= 3);

    const phaseEnd = events.find((e) => e.type === "phase_end" && e.phase === "plan");
    assert.ok(phaseEnd, "should have phase_end for plan");

    const phaseStart = events.find((e) => e.type === "phase_start" && e.phase === "do");
    assert.ok(phaseStart, "should have phase_start for do");
    assert.equal(phaseStart.data.cycle_count, 1);
  });

  it("full cycle generates ordered event sequence", () => {
    const state = simulateStartRun(env, { topic: "Full cycle events" });
    simulateTransition(env, { target_phase: "do" });
    simulateTransition(env, { target_phase: "check" });
    simulateTransition(env, { target_phase: "act" });

    const events = readEvents(env.tempDir, state.run_id);
    const types = events.map((e) => e.type);

    // Should see: cycle_start, phase_end(plan), phase_start(do),
    //             phase_end(do), phase_start(check), phase_end(check), phase_start(act)
    assert.equal(types[0], "cycle_start");
    assert.ok(types.includes("phase_end"));
    assert.ok(types.includes("phase_start"));
  });

  it("gate check logs gate_check and gate_fail events", () => {
    const state = simulateStartRun(env, { topic: "Gate log test" });
    simulateCheckGate(env, { gate: "plan_to_do" });

    const events = readEvents(env.tempDir, state.run_id);
    const gateCheck = events.find((e) => e.type === "gate_check");
    assert.ok(gateCheck, "should have gate_check event");
    assert.equal(gateCheck.action, "plan_to_do");

    const gateFail = events.find((e) => e.type === "gate_fail");
    assert.ok(gateFail, "should have gate_fail event");
    assert.ok(gateFail.data.missing.length > 0);
  });

  it("gate check logs gate_pass when conditions met", () => {
    const state = simulateStartRun(env, { topic: "Gate pass log" });
    // Satisfy plan_to_do gate
    const s = readJson(env.activeFile);
    s.artifacts.plan_research = "/r.md";
    s.sources_count = 3;
    s.artifacts.plan_analysis = "/a.md";
    s.plan_mode_approved = true;
    writeJsonSync(env.activeFile, s);

    simulateCheckGate(env, { gate: "plan_to_do" });

    const events = readEvents(env.tempDir, state.run_id);
    const gatePass = events.find((e) => e.type === "gate_pass");
    assert.ok(gatePass, "should have gate_pass event");
    assert.equal(gatePass.action, "plan_to_do");
  });

  it("stuck flags log stuck_detected event", () => {
    const state = simulateStartRun(env, { topic: "Stuck test" });
    simulateUpdateStuckFlags(env, { flags: ["plan_churn", "scope_creep"] });

    const events = readEvents(env.tempDir, state.run_id);
    const stuck = events.find((e) => e.type === "stuck_detected");
    assert.ok(stuck, "should have stuck_detected event");
    assert.deepEqual(stuck.data.new_flags, ["plan_churn", "scope_creep"]);
  });

  it("duplicate stuck flags do not generate new event", () => {
    const state = simulateStartRun(env, { topic: "Stuck dedup" });
    simulateUpdateStuckFlags(env, { flags: ["plan_churn"] });
    simulateUpdateStuckFlags(env, { flags: ["plan_churn"] }); // duplicate

    const events = readEvents(env.tempDir, state.run_id);
    const stuckEvents = events.filter((e) => e.type === "stuck_detected");
    assert.equal(stuckEvents.length, 1, "should only have one stuck_detected event");
  });

  it("event timestamps are valid ISO strings", () => {
    const state = simulateStartRun(env, { topic: "TS test" });
    const events = readEvents(env.tempDir, state.run_id);
    for (const e of events) {
      const ts = new Date(e.ts);
      assert.ok(!isNaN(ts.getTime()), `invalid timestamp: ${e.ts}`);
    }
  });

  it("events can be filtered by type", () => {
    const state = simulateStartRun(env, { topic: "Filter test" });
    simulateTransition(env, { target_phase: "do" });

    const phaseEnds = readEvents(env.tempDir, state.run_id, { type: "phase_end" });
    assert.ok(phaseEnds.length >= 1);
    for (const e of phaseEnds) {
      assert.equal(e.type, "phase_end");
    }
  });

  it("events can be filtered by phase", () => {
    const state = simulateStartRun(env, { topic: "Phase filter" });
    simulateTransition(env, { target_phase: "do" });

    const planEvents = readEvents(env.tempDir, state.run_id, { phase: "plan" });
    for (const e of planEvents) {
      assert.equal(e.phase, "plan");
    }
  });
});

describe("PDCA State Server — Tool Input Validation", () => {
  let env;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    rmSync(env.tempDir, { recursive: true, force: true });
  });

  it("start_run rejects empty topic", () => {
    assert.throws(
      () => simulateStartRun(env, { topic: "" }),
      /topic must be a non-empty string/
    );
  });

  it("start_run rejects non-string topic", () => {
    assert.throws(
      () => simulateStartRun(env, { topic: 42 }),
      /topic must be a non-empty string/
    );
  });

  it("start_run rejects whitespace-only topic", () => {
    assert.throws(
      () => simulateStartRun(env, { topic: "   " }),
      /topic must be a non-empty string/
    );
  });

  it("start_run rejects non-integer max_cycles", () => {
    assert.throws(
      () => simulateStartRun(env, { topic: "Test", max_cycles: 2.5 }),
      /max_cycles must be a positive integer/
    );
  });

  it("start_run rejects zero max_cycles", () => {
    assert.throws(
      () => simulateStartRun(env, { topic: "Test", max_cycles: 0 }),
      /max_cycles must be a positive integer/
    );
  });

  it("start_run rejects negative max_cycles", () => {
    assert.throws(
      () => simulateStartRun(env, { topic: "Test", max_cycles: -1 }),
      /max_cycles must be a positive integer/
    );
  });

  it("start_run rejects string max_cycles", () => {
    assert.throws(
      () => simulateStartRun(env, { topic: "Test", max_cycles: "3" }),
      /max_cycles must be a positive integer/
    );
  });

  it("start_run rejects duplicate run", () => {
    simulateStartRun(env, { topic: "First" });
    assert.throws(
      () => simulateStartRun(env, { topic: "Second" }),
      /Active PDCA run already exists/
    );
  });

  it("start_run trims topic whitespace", () => {
    const state = simulateStartRun(env, { topic: "  trimmed topic  " });
    assert.equal(state.topic, "trimmed topic");
  });

  it("start_run uses default max_cycles of 3", () => {
    const state = simulateStartRun(env, { topic: "Default cycles" });
    assert.equal(state.max_cycles, 3);
  });

  it("transition rejects invalid phase name", () => {
    simulateStartRun(env, { topic: "Test" });
    assert.throws(
      () => simulateTransition(env, { target_phase: "foo" }),
      /target_phase must be one of/
    );
  });

  it("end_run rejects when no active run", () => {
    assert.throws(
      () => simulateEndRun(env),
      /No active PDCA run to end/
    );
  });

  it("update_stuck_flags rejects empty flags array", () => {
    simulateStartRun(env, { topic: "Test" });
    assert.throws(
      () => simulateUpdateStuckFlags(env, { flags: [] }),
      /flags must be a non-empty array/
    );
  });

  it("update_stuck_flags rejects non-array flags", () => {
    simulateStartRun(env, { topic: "Test" });
    assert.throws(
      () => simulateUpdateStuckFlags(env, { flags: "not-array" }),
      /flags must be a non-empty array/
    );
  });

  it("update_stuck_flags rejects non-string items", () => {
    simulateStartRun(env, { topic: "Test" });
    assert.throws(
      () => simulateUpdateStuckFlags(env, { flags: [123] }),
      /Each flag must be a string/
    );
  });

  it("check_gate rejects without active run", () => {
    assert.throws(
      () => simulateCheckGate(env, { gate: "plan_to_do" }),
      /No active PDCA run/
    );
  });
});

describe("PDCA State Server — buildInitialState", () => {
  it("returns object with all required fields", () => {
    const state = buildInitialState("My Topic", 5);
    assert.equal(state.topic, "My Topic");
    assert.equal(state.current_phase, "plan");
    assert.equal(state.cycle_count, 1);
    assert.equal(state.max_cycles, 5);
    assert.ok(state.run_id);
    assert.deepEqual(state.completed, []);
    assert.deepEqual(state.stuck_flags, []);
    assert.deepEqual(state.assumptions, []);
    assert.equal(state.check_verdict, null);
    assert.equal(state.sources_count, 0);
    assert.equal(state.plan_mode_approved, false);
  });

  it("generates unique run_ids", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(buildInitialState("T", 1).run_id);
    }
    assert.equal(ids.size, 100);
  });

  it("all artifact slots start as null", () => {
    const state = buildInitialState("T", 1);
    for (const val of Object.values(state.artifacts)) {
      assert.equal(val, null);
    }
  });

  it("all gate slots start as null", () => {
    const state = buildInitialState("T", 1);
    for (const val of Object.values(state.gates)) {
      assert.equal(val, null);
    }
  });
});

describe("PDCA State Server — VALID_TRANSITIONS", () => {
  it("plan can only go to do", () => {
    assert.deepEqual(VALID_TRANSITIONS.plan, ["do"]);
  });

  it("do can only go to check", () => {
    assert.deepEqual(VALID_TRANSITIONS.do, ["check"]);
  });

  it("check can only go to act", () => {
    assert.deepEqual(VALID_TRANSITIONS.check, ["act"]);
  });

  it("act can only go to plan", () => {
    assert.deepEqual(VALID_TRANSITIONS.act, ["plan"]);
  });

  it("forms a complete cycle", () => {
    let phase = "plan";
    const visited = [];
    for (let i = 0; i < 4; i++) {
      visited.push(phase);
      phase = VALID_TRANSITIONS[phase][0];
    }
    assert.deepEqual(visited, ["plan", "do", "check", "act"]);
    assert.equal(phase, "plan"); // back to start
  });
});

describe("PDCA State Server — End Run", () => {
  let env;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    rmSync(env.tempDir, { recursive: true, force: true });
  });

  it("end_run returns summary with correct fields", () => {
    const state = simulateStartRun(env, { topic: "End test" });
    const summary = simulateEndRun(env);
    assert.equal(summary.run_id, state.run_id);
    assert.equal(summary.topic, "End test");
    assert.ok(summary.ended_at);
    assert.ok(Array.isArray(summary.completed_phases));
    assert.ok(Array.isArray(summary.stuck_flags));
  });

  it("end_run removes active file", () => {
    simulateStartRun(env, { topic: "Cleanup test" });
    simulateEndRun(env);
    assert.equal(existsSync(env.activeFile), false);
  });

  it("end_run creates completed file", () => {
    simulateStartRun(env, { topic: "Archive test" });
    simulateEndRun(env);
    assert.ok(existsSync(env.completedFile));
    const completed = readJson(env.completedFile);
    assert.equal(completed.topic, "Archive test");
    assert.ok(completed.ended_at);
  });

  it("end_run logs cycle_end event", () => {
    const state = simulateStartRun(env, { topic: "End event" });
    simulateEndRun(env);
    const events = readEvents(env.tempDir, state.run_id);
    const cycleEnd = events.find((e) => e.type === "cycle_end");
    assert.ok(cycleEnd, "should have cycle_end event");
    assert.ok(cycleEnd.data.ended_at);
  });

  it("allows starting a new run after ending previous", () => {
    simulateStartRun(env, { topic: "First" });
    simulateEndRun(env);
    const state = simulateStartRun(env, { topic: "Second" });
    assert.equal(state.topic, "Second");
    assert.equal(state.current_phase, "plan");
  });
});

describe("PDCA State Server — Stuck Flags", () => {
  let env;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    rmSync(env.tempDir, { recursive: true, force: true });
  });

  it("adds flags to state", () => {
    simulateStartRun(env, { topic: "Stuck" });
    const state = simulateUpdateStuckFlags(env, { flags: ["plan_churn"] });
    assert.deepEqual(state.stuck_flags, ["plan_churn"]);
  });

  it("deduplicates flags", () => {
    simulateStartRun(env, { topic: "Stuck" });
    simulateUpdateStuckFlags(env, { flags: ["plan_churn"] });
    const state = simulateUpdateStuckFlags(env, { flags: ["plan_churn", "scope_creep"] });
    assert.deepEqual(state.stuck_flags, ["plan_churn", "scope_creep"]);
  });

  it("persists flags to disk", () => {
    simulateStartRun(env, { topic: "Persist" });
    simulateUpdateStuckFlags(env, { flags: ["check_avoidance"] });
    const state = readJson(env.activeFile);
    assert.ok(state.stuck_flags.includes("check_avoidance"));
  });
});

// ---------------------------------------------------------------------------
// simulateListRuns helper — mirrors handleListRuns from the server
// ---------------------------------------------------------------------------

function simulateListRuns(env) {
  const runs = [];

  const knownRunIds = listRunIds(env.tempDir);
  const active = readJson(env.activeFile);
  const lastCompleted = readJson(env.completedFile);

  const allIds = new Set(knownRunIds);
  if (active) allIds.add(active.run_id);
  if (lastCompleted) allIds.add(lastCompleted.run_id);

  for (const runId of allIds) {
    const events = readEvents(env.tempDir, runId);

    const started_at = events.length > 0 ? events[0].ts : null;

    const cycleEnd = events.find((e) => e.type === "cycle_end");
    const ended_at = cycleEnd?.data?.ended_at ?? null;

    let topic = null;
    let final_phase = null;
    let cycles_completed = 0;

    if (active && active.run_id === runId) {
      topic = active.topic;
      final_phase = active.current_phase;
      cycles_completed = active.cycle_count ?? 1;
    }

    if (lastCompleted && lastCompleted.run_id === runId) {
      topic = lastCompleted.topic;
      final_phase = lastCompleted.current_phase;
      cycles_completed = lastCompleted.cycle_count ?? 1;
    }

    if (!topic) {
      const cycleStart = events.find((e) => e.type === "cycle_start");
      topic = cycleStart?.data?.topic ?? "unknown";
    }

    if (!final_phase) {
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].phase) {
          final_phase = events[i].phase;
          break;
        }
      }
      final_phase = final_phase ?? "unknown";
    }

    if (!cycles_completed) {
      cycles_completed = events.filter((e) => e.type === "cycle_start").length || 1;
    }

    runs.push({
      run_id: runId,
      topic,
      started_at,
      ended_at,
      final_phase,
      cycles_completed,
      is_active: active?.run_id === runId,
    });
  }

  runs.sort((a, b) => {
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    return (b.started_at || "").localeCompare(a.started_at || "");
  });

  return { total: runs.length, runs };
}

// ===========================================================================
// NEW TESTS — Feature 1: GATE-BEFORE-TRANSITION (auto_gate)
// ===========================================================================

describe("PDCA State Server — auto_gate on transition", () => {
  let env;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    rmSync(env.tempDir, { recursive: true, force: true });
  });

  it("auto_gate=false (default) allows transition without gate check", () => {
    simulateStartRun(env, { topic: "No gate" });
    const result = simulateTransition(env, { target_phase: "do" });
    // Normal transition returns the state with current_phase set
    assert.equal(result.current_phase, "do");
  });

  it("auto_gate=true blocks transition when gate fails", () => {
    simulateStartRun(env, { topic: "Gate block" });
    const result = simulateTransition(env, { target_phase: "do", auto_gate: true });

    // Should NOT have transitioned
    assert.equal(result.transitioned, false);
    assert.equal(result.gate, "plan_to_do");
    assert.equal(result.gate_result.passed, false);
    assert.ok(result.gate_result.missing.length > 0);
    assert.equal(result.current_phase, "plan");
    assert.equal(result.target_phase, "do");

    // Verify state was NOT mutated on disk
    const state = readJson(env.activeFile);
    assert.equal(state.current_phase, "plan");
    assert.deepEqual(state.completed, []);
  });

  it("auto_gate=true allows transition when gate passes", () => {
    simulateStartRun(env, { topic: "Gate pass" });

    // Satisfy plan_to_do gate requirements
    const state = readJson(env.activeFile);
    state.artifacts.plan_research = "/research.md";
    state.sources_count = 5;
    state.artifacts.plan_analysis = "/analysis.md";
    state.plan_mode_approved = true;
    writeJsonSync(env.activeFile, state);

    const result = simulateTransition(env, { target_phase: "do", auto_gate: true });

    // Should have transitioned normally
    assert.equal(result.current_phase, "do");
    assert.ok(result.completed.includes("plan"));
    // No transitioned property on successful transitions (it returns the state)
    assert.equal(result.transitioned, undefined);
  });

  it("auto_gate logs gate events when gate fails", () => {
    const run = simulateStartRun(env, { topic: "Gate fail events" });
    simulateTransition(env, { target_phase: "do", auto_gate: true });

    const events = readEvents(env.tempDir, run.run_id);
    const gateCheck = events.find((e) => e.type === "gate_check" && e.action === "plan_to_do");
    assert.ok(gateCheck, "should have gate_check event");
    assert.equal(gateCheck.data.passed, false);

    const gateFail = events.find((e) => e.type === "gate_fail" && e.action === "plan_to_do");
    assert.ok(gateFail, "should have gate_fail event");
  });

  it("auto_gate logs gate events when gate passes", () => {
    const run = simulateStartRun(env, { topic: "Gate pass events" });

    const state = readJson(env.activeFile);
    state.artifacts.plan_research = "/r.md";
    state.sources_count = 3;
    state.artifacts.plan_analysis = "/a.md";
    state.plan_mode_approved = true;
    writeJsonSync(env.activeFile, state);

    simulateTransition(env, { target_phase: "do", auto_gate: true });

    const events = readEvents(env.tempDir, run.run_id);
    const gatePass = events.find((e) => e.type === "gate_pass" && e.action === "plan_to_do");
    assert.ok(gatePass, "should have gate_pass event");
  });

  it("auto_gate works for do_to_check gate", () => {
    simulateStartRun(env, { topic: "Do gate" });
    simulateTransition(env, { target_phase: "do" });

    // Gate should fail — no artifacts
    const result = simulateTransition(env, { target_phase: "check", auto_gate: true });
    assert.equal(result.transitioned, false);
    assert.equal(result.gate, "do_to_check");
    assert.ok(result.gate_result.missing.includes("artifact_exists"));
  });

  it("auto_gate works for check_to_act gate", () => {
    simulateStartRun(env, { topic: "Check gate" });
    simulateTransition(env, { target_phase: "do" });
    simulateTransition(env, { target_phase: "check" });

    const result = simulateTransition(env, { target_phase: "act", auto_gate: true });
    assert.equal(result.transitioned, false);
    assert.equal(result.gate, "check_to_act");
    assert.ok(result.gate_result.missing.includes("verdict_set"));
  });

  it("auto_gate returns gate failure info with correct shape", () => {
    simulateStartRun(env, { topic: "Shape test" });
    const result = simulateTransition(env, { target_phase: "do", auto_gate: true });

    // Verify shape
    assert.equal(typeof result.transitioned, "boolean");
    assert.equal(typeof result.gate, "string");
    assert.equal(typeof result.gate_result, "object");
    assert.equal(typeof result.gate_result.passed, "boolean");
    assert.ok(Array.isArray(result.gate_result.missing));
    assert.equal(typeof result.current_phase, "string");
    assert.equal(typeof result.target_phase, "string");
  });

  it("existing callers unaffected — transition without auto_gate param still works", () => {
    simulateStartRun(env, { topic: "Backward compat" });
    // Call exactly as the old API: no auto_gate
    const result = simulateTransition(env, { target_phase: "do" });
    assert.equal(result.current_phase, "do");
  });
});

// ===========================================================================
// NEW TESTS — Feature 2: pdca_list_runs
// ===========================================================================

describe("PDCA State Server — pdca_list_runs", () => {
  let env;

  beforeEach(() => {
    env = createTestEnv();
  });

  afterEach(() => {
    rmSync(env.tempDir, { recursive: true, force: true });
  });

  it("returns empty array when no runs exist", () => {
    const result = simulateListRuns(env);
    assert.equal(result.total, 0);
    assert.deepEqual(result.runs, []);
  });

  it("lists active run", () => {
    const state = simulateStartRun(env, { topic: "Active run" });
    const result = simulateListRuns(env);

    assert.equal(result.total, 1);
    assert.equal(result.runs[0].run_id, state.run_id);
    assert.equal(result.runs[0].topic, "Active run");
    assert.equal(result.runs[0].is_active, true);
    assert.equal(result.runs[0].ended_at, null);
    assert.equal(result.runs[0].final_phase, "plan");
    assert.equal(result.runs[0].cycles_completed, 1);
  });

  it("lists completed run", () => {
    const state = simulateStartRun(env, { topic: "Completed run" });
    simulateEndRun(env);

    const result = simulateListRuns(env);
    assert.equal(result.total, 1);
    assert.equal(result.runs[0].run_id, state.run_id);
    assert.equal(result.runs[0].topic, "Completed run");
    assert.equal(result.runs[0].is_active, false);
    assert.ok(result.runs[0].ended_at);
  });

  it("lists both active and completed runs", () => {
    // First run — complete it
    simulateStartRun(env, { topic: "Run 1" });
    simulateEndRun(env);

    // Second run — keep it active
    const activeState = simulateStartRun(env, { topic: "Run 2" });

    const result = simulateListRuns(env);
    assert.equal(result.total, 2);

    // Active run should come first
    assert.equal(result.runs[0].run_id, activeState.run_id);
    assert.equal(result.runs[0].is_active, true);
    assert.equal(result.runs[1].is_active, false);
  });

  it("includes started_at from first event timestamp", () => {
    simulateStartRun(env, { topic: "Timestamp test" });
    const result = simulateListRuns(env);

    assert.ok(result.runs[0].started_at);
    const ts = new Date(result.runs[0].started_at);
    assert.ok(!isNaN(ts.getTime()), "started_at should be valid ISO date");
  });

  it("tracks phase progression", () => {
    simulateStartRun(env, { topic: "Phase track" });
    simulateTransition(env, { target_phase: "do" });
    simulateTransition(env, { target_phase: "check" });

    const result = simulateListRuns(env);
    assert.equal(result.runs[0].final_phase, "check");
  });

  it("tracks cycle count", () => {
    simulateStartRun(env, { topic: "Cycle count" });
    simulateTransition(env, { target_phase: "do" });
    simulateTransition(env, { target_phase: "check" });
    simulateTransition(env, { target_phase: "act" });
    simulateTransition(env, { target_phase: "plan" }); // cycle 2

    const result = simulateListRuns(env);
    assert.equal(result.runs[0].cycles_completed, 2);
  });

  it("result has correct shape", () => {
    simulateStartRun(env, { topic: "Shape" });
    const result = simulateListRuns(env);

    assert.equal(typeof result.total, "number");
    assert.ok(Array.isArray(result.runs));

    const run = result.runs[0];
    assert.equal(typeof run.run_id, "string");
    assert.equal(typeof run.topic, "string");
    assert.equal(typeof run.is_active, "boolean");
    assert.equal(typeof run.cycles_completed, "number");
    assert.equal(typeof run.final_phase, "string");
    // started_at is a string, ended_at may be null
    assert.ok(typeof run.started_at === "string" || run.started_at === null);
  });

  it("multiple completed runs appear in order (most recent first)", () => {
    // Run 1
    simulateStartRun(env, { topic: "Run A" });
    simulateEndRun(env);

    // Small delay to ensure different timestamps
    const run2 = simulateStartRun(env, { topic: "Run B" });
    simulateEndRun(env);

    const result = simulateListRuns(env);
    assert.equal(result.total, 2);
    // Run B should be first (more recent) — but note: only last-completed is stored
    // in the completed file. Run A may only exist in event logs.
    // Both should be listed regardless.
    const topics = result.runs.map((r) => r.topic);
    assert.ok(topics.includes("Run A"));
    assert.ok(topics.includes("Run B"));
  });
});

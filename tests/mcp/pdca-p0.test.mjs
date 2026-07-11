/**
 * P0 audit fixes — exercised against the REAL handlers (not a local reimplementation).
 *
 * Covers three critical defects found in the v1.5.2 audit:
 *   1. Cycle recycle must reset `completed` + cycle-scoped gate state (Stop gate death).
 *   2. auto_gate transitions must be satisfiable through the MCP API via `phase_result`.
 *   3. Event/analytics reads must reject path-traversal run_ids.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const handlerModulePath = path.join(root, "mcp", "lib", "pdca-handlers.mjs");

async function loadHandlers(dataDir) {
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  return import(`${pathToFileURL(handlerModulePath).href}?t=${Date.now()}-${Math.random()}`);
}

function tempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "pdca-p0-"));
}

test("recycle resets `completed` so the Stop gate re-arms every cycle", async () => {
  const dir = tempDir();
  try {
    const h = await loadHandlers(dir);
    // Drive to Act, persisting cycle-scoped gate state via the transition calls
    // themselves (handleGetState returns a disk copy, so mutating it wouldn't stick).
    h.handleStartRun({ topic: "Recycle test", max_cycles: 3 });
    h.handleTransition({
      target_phase: "do",
      artifacts: { plan_research: "/tmp/old-brief.md" },
      phase_result: { sources_count: 5 },
    });
    h.handleTransition({ target_phase: "check", phase_result: { reviewer_count: 3 } });
    h.handleTransition({ target_phase: "act", phase_result: { check_verdict: "APPROVED" } });

    const before = h.handleGetState();
    assert.equal(before.sources_count, 5, "seed persisted");
    assert.equal(before.artifacts.plan_research, "/tmp/old-brief.md", "artifact seed persisted");

    h.handleTransition({ target_phase: "plan" }); // act → plan recycle

    const after = h.handleGetState();
    assert.equal(after.cycle_count, 2, "cycle_count advances");
    assert.deepEqual(after.completed, [], "completed resets on recycle");
    assert.equal(after.sources_count ?? 0, 0, "gate counters reset");
    assert.equal(after.reviewer_count ?? 0, 0, "reviewer_count resets");
    assert.equal(after.check_verdict, null, "verdict resets");
    // Artifacts intentionally persist: the act→plan transition still saves the
    // completed Act artifact to cycle memory. Gate re-entry is enforced by the
    // reset counters (sources_count/plan_mode_approved), not by wiping artifacts.
    assert.equal(after.artifacts.plan_research, "/tmp/old-brief.md", "artifacts persist across recycle");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("auto_gate can PASS through the MCP API when phase_result is supplied", async () => {
  const dir = tempDir();
  try {
    const h = await loadHandlers(dir);
    h.handleStartRun({ topic: "Gate test", max_cycles: 3 });

    // Without the gate inputs, an auto-gated plan→do must be blocked.
    const blocked = h.handleTransition({
      target_phase: "do",
      auto_gate: true,
      artifacts: { plan_research: "/tmp/r.md", plan_analysis: "/tmp/a.md" },
    });
    assert.equal(blocked.transitioned, false, "blocked without gate inputs");
    assert.ok(blocked.gate_result.missing.includes("sources_min_3"));
    assert.ok(blocked.gate_result.missing.includes("plan_mode_approved"));

    // With phase_result supplying the gate inputs, it must pass.
    const passed = h.handleTransition({
      target_phase: "do",
      auto_gate: true,
      artifacts: { plan_research: "/tmp/r.md", plan_analysis: "/tmp/a.md" },
      phase_result: { sources_count: 4, plan_mode_approved: true },
    });
    assert.equal(passed.transitioned, true, "passes once gate inputs are set");
    assert.equal(h.handleGetState().current_phase, "do");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("phase_result rejects unknown keys and wrong types", async () => {
  const dir = tempDir();
  try {
    const h = await loadHandlers(dir);
    h.handleStartRun({ topic: "Validation test", max_cycles: 3 });
    assert.throws(
      () => h.handleTransition({ target_phase: "do", phase_result: { sources_count: "lots" } }),
      /sources_count/,
      "wrong type rejected",
    );
    // Unknown keys are ignored, not merged into state.
    h.handleTransition({ target_phase: "do", phase_result: { __proto__: {}, bogus_field: 1 } });
    assert.equal(h.handleGetState().bogus_field, undefined, "unknown key not merged");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("pdca_get_events rejects path-traversal run_ids", async () => {
  const dir = tempDir();
  try {
    const h = await loadHandlers(dir);
    // Plant a secret .jsonl OUTSIDE the events dir the traversal would target.
    const secret = path.join(dir, "secret.jsonl");
    writeFileSync(secret, JSON.stringify({ ts: "x", type: "secret", stolen: true }) + "\n");

    assert.throws(
      () => h.handleGetEvents({ run_id: "../secret" }),
      /run_id/,
      "traversal run_id is rejected",
    );
    assert.throws(
      () => h.handleGetEvents({ run_id: "../../etc/hosts" }),
      /run_id/,
      "deep traversal is rejected",
    );

    // A normal UUID-shaped run_id is still accepted (returns [] when absent).
    const ok = h.handleGetEvents({ run_id: "0a1b2c3d-4e5f-6789-abcd-ef0123456789" });
    assert.equal(ok.total, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

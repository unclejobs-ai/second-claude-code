import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadTracker,
  recordAgentContribution,
  buildSummary,
  getAgentEffectiveness,
  getTopAgentsForPhase,
} from "../../hooks/lib/agent-tracker.mjs";

function makeTempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "scc-tracker-"));
}

test("loadTracker returns empty structure for missing file", () => {
  const dir = makeTempDir();
  const data = loadTracker(dir);
  assert.deepEqual(data.records, []);
  assert.deepEqual(data.summary, {});
});

test("recordAgentContribution persists and builds summary", () => {
  const dir = makeTempDir();
  const summary = recordAgentContribution(dir, {
    agent: "xatu",
    phase: "check",
    outcome: "helped",
    quality_delta: 0.15,
    duration_ms: 5000,
    tokens: 3200,
  });

  assert.ok(summary.xatu);
  assert.equal(summary.xatu.total_invocations, 1);
  assert.equal(summary.xatu.phases.check.helped, 1);
  assert.equal(summary.xatu.avg_quality_delta, 0.15);

  // Verify persistence
  const reloaded = loadTracker(dir);
  assert.equal(reloaded.records.length, 1);
  assert.equal(reloaded.records[0].agent, "xatu");
});

test("buildSummary computes best_at and struggles_with", () => {
  const records = [
    { agent: "eevee", phase: "plan", outcome: "helped", quality_delta: 0.2, duration_ms: 1000, tokens: 500 },
    { agent: "eevee", phase: "plan", outcome: "helped", quality_delta: 0.3, duration_ms: 1000, tokens: 500 },
    { agent: "eevee", phase: "check", outcome: "hurt", quality_delta: -0.1, duration_ms: 1000, tokens: 500 },
    { agent: "eevee", phase: "check", outcome: "hurt", quality_delta: -0.2, duration_ms: 1000, tokens: 500 },
  ];

  const summary = buildSummary(records);
  assert.ok(summary.eevee.best_at.includes("plan"));
  assert.ok(summary.eevee.struggles_with.includes("check"));
});

test("getAgentEffectiveness returns null for unknown agent", () => {
  const dir = makeTempDir();
  const result = getAgentEffectiveness(dir, "nonexistent");
  assert.equal(result, null);
});

test("getAgentEffectiveness returns data for tracked agent", () => {
  const dir = makeTempDir();
  recordAgentContribution(dir, {
    agent: "smeargle",
    phase: "do",
    outcome: "helped",
    quality_delta: 0.5,
    duration_ms: 8000,
    tokens: 6000,
  });

  const result = getAgentEffectiveness(dir, "smeargle");
  assert.ok(result);
  assert.equal(result.total_invocations, 1);
  assert.equal(result.phases.do.helped, 1);
});

test("getTopAgentsForPhase ranks agents by effectiveness", () => {
  const dir = makeTempDir();

  // xatu: 3 helped in check
  for (let i = 0; i < 3; i++) {
    recordAgentContribution(dir, {
      agent: "xatu", phase: "check", outcome: "helped", quality_delta: 0.1, duration_ms: 1000, tokens: 500,
    });
  }

  // absol: 1 helped, 2 hurt in check
  recordAgentContribution(dir, {
    agent: "absol", phase: "check", outcome: "helped", quality_delta: 0.1, duration_ms: 1000, tokens: 500,
  });
  for (let i = 0; i < 2; i++) {
    recordAgentContribution(dir, {
      agent: "absol", phase: "check", outcome: "hurt", quality_delta: -0.1, duration_ms: 1000, tokens: 500,
    });
  }

  const top = getTopAgentsForPhase(dir, "check", 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].agent, "xatu"); // score 1.0
  assert.equal(top[1].agent, "absol"); // score -0.33
  assert.ok(top[0].score > top[1].score);
});

test("multiple agents across multiple phases build correct summary", () => {
  const records = [
    { agent: "eevee", phase: "plan", outcome: "helped", quality_delta: 0.2, duration_ms: 1000, tokens: 500 },
    { agent: "smeargle", phase: "do", outcome: "helped", quality_delta: 0.4, duration_ms: 2000, tokens: 1000 },
    { agent: "xatu", phase: "check", outcome: "helped", quality_delta: 0.3, duration_ms: 3000, tokens: 1500 },
    { agent: "ditto", phase: "act", outcome: "neutral", quality_delta: 0.0, duration_ms: 500, tokens: 200 },
  ];

  const summary = buildSummary(records);
  assert.equal(Object.keys(summary).length, 4);
  assert.equal(summary.eevee.total_invocations, 1);
  assert.equal(summary.smeargle.total_invocations, 1);
  assert.equal(summary.xatu.total_invocations, 1);
  assert.equal(summary.ditto.total_invocations, 1);
});

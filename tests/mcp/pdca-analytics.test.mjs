import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourcePath = path.join(root, "mcp", "lib", "pdca-handlers.mjs");
const sourceUrl = pathToFileURL(sourcePath).href;

function makeTempDir(prefix = "second-claude-pdca-analytics-") {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function loadHandlers(dataDir) {
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  return import(`${sourceUrl}?t=${Date.now()}-${Math.random()}`);
}

function writeEvents(dataDir, runId, events) {
  const eventsDir = path.join(dataDir, "events");
  mkdirSync(eventsDir, { recursive: true });
  writeFileSync(
    path.join(eventsDir, `pdca-${runId}.jsonl`),
    events.map((event) => JSON.stringify(event)).join("\n") + "\n",
    "utf8"
  );
}

function writeStateFile(dataDir, fileName, value) {
  const stateDir = path.join(dataDir, "state");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(path.join(stateDir, fileName), JSON.stringify(value, null, 2), "utf8");
}

function makeRunEvents(runId) {
  return [
    { ts: "2026-03-29T00:00:00.000Z", run_id: runId, type: "phase_start", phase: "plan" },
    {
      ts: "2026-03-29T00:00:01.000Z",
      run_id: runId,
      type: "gate_pass",
      phase: "plan",
      action: "plan_to_do",
    },
    { ts: "2026-03-29T00:00:03.000Z", run_id: runId, type: "phase_end", phase: "plan" },
    { ts: "2026-03-29T00:00:04.000Z", run_id: runId, type: "phase_start", phase: "do" },
    {
      ts: "2026-03-29T00:00:06.000Z",
      run_id: runId,
      type: "gate_fail",
      phase: "do",
      action: "do_to_check",
      data: { missing: ["artifact_exists"] },
    },
    { ts: "2026-03-29T00:00:09.000Z", run_id: runId, type: "phase_end", phase: "do" },
    { ts: "2026-03-29T00:00:10.000Z", run_id: runId, type: "error", phase: "do" },
  ];
}

describe("pdca analytics handlers", () => {
  test("handleGetEvents requires a non-empty run_id", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");

    try {
      const handlers = await loadHandlers(dataDir);
      assert.throws(() => handlers.handleGetEvents({ run_id: " " }), /run_id must be a non-empty string/);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleGetEvents filters events by phase", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");
    const runId = "run-phase-filter";
    writeEvents(dataDir, runId, makeRunEvents(runId));

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleGetEvents({ run_id: runId, phase: "plan" });

      assert.equal(result.run_id, runId);
      assert.equal(result.total, 3);
      assert.equal(result.returned, 3);
      assert.deepEqual(result.events.map((event) => event.phase), ["plan", "plan", "plan"]);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleGetEvents filters by type and returns the most recent entries within the limit", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");
    const runId = "run-type-filter";
    writeEvents(dataDir, runId, makeRunEvents(runId));

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleGetEvents({ run_id: runId, type: "phase_start", limit: 1 });

      assert.equal(result.total, 2);
      assert.equal(result.returned, 1);
      assert.equal(result.events[0].type, "phase_start");
      assert.equal(result.events[0].phase, "do");
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleGetAnalytics returns summary, phase durations, and gate statistics for an explicit run_id", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");
    const runId = "run-analytics";
    writeEvents(dataDir, runId, makeRunEvents(runId));

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleGetAnalytics({ run_id: runId });

      assert.equal(result.run_id, runId);
      assert.equal(result.summary.total_events, 7);
      assert.equal(result.summary.duration_ms, 10000);
      assert.deepEqual(result.summary.events_per_phase, { plan: 3, do: 4 });
      assert.equal(result.summary.gate_pass_count, 1);
      assert.equal(result.summary.gate_fail_count, 1);
      assert.equal(result.summary.error_count, 1);
      assert.deepEqual(result.phase_durations, {
        plan: { count: 1, avg_duration_ms: 3000 },
        do: { count: 1, avg_duration_ms: 5000 },
      });
      assert.deepEqual(result.gate_stats, {
        plan_to_do: { pass: 1, fail: 0, pass_rate: 1 },
        do_to_check: { pass: 0, fail: 1, pass_rate: 0 },
      });
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleGetAnalytics falls back to the active run when run_id is omitted", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");
    const runId = "run-active";
    writeEvents(dataDir, runId, makeRunEvents(runId));
    writeStateFile(dataDir, "pdca-active.json", { run_id: runId, topic: "active topic" });

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleGetAnalytics({});

      assert.equal(result.run_id, runId);
      assert.equal(result.summary.total_events, 7);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleGetAnalytics falls back to the last completed run when there is no active run", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");
    const runId = "run-completed";
    writeEvents(dataDir, runId, makeRunEvents(runId));
    writeStateFile(dataDir, "pdca-last-completed.json", { run_id: runId, topic: "completed topic" });

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleGetAnalytics({});

      assert.equal(result.run_id, runId);
      assert.equal(result.summary.total_events, 7);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleGetAnalytics throws when run_id is missing and there is no active or completed run", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");

    try {
      const handlers = await loadHandlers(dataDir);
      assert.throws(
        () => handlers.handleGetAnalytics({}),
        /No run_id provided and no active or completed run found\./
      );
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

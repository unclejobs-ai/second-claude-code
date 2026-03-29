import test from "node:test";
import assert from "node:assert/strict";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const modulePath = path.join(root, "mcp", "lib", "cycle-memory.mjs");

async function loadModule() {
  return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}-${Math.random()}`);
}

function makeTempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "second-claude-cycle-memory-"));
}

function cycleDir(dataDir, cycleId) {
  return path.join(dataDir, "cycles", `cycle-${String(cycleId).padStart(3, "0")}`);
}

function writeCyclePhaseFile(dataDir, cycleId, phase, content) {
  const dir = cycleDir(dataDir, cycleId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${phase}.md`), content, "utf8");
}

function writeInsightsFile(dataDir, insights) {
  const cyclesDir = path.join(dataDir, "cycles");
  mkdirSync(cyclesDir, { recursive: true });
  writeFileSync(path.join(cyclesDir, "insights.json"), JSON.stringify(insights, null, 2), "utf8");
}

test("saveCyclePhase creates phase markdown and appends a phase_save event", async () => {
  const dataDir = makeTempDir();

  try {
    const { saveCyclePhase } = await loadModule();
    const result = saveCyclePhase(dataDir, {
      cycle_id: 1,
      phase: "plan",
      content: "# Plan\nOutline",
    });

    assert.equal(readFileSync(result.path, "utf8"), "# Plan\nOutline");

    const eventsPath = path.join(cycleDir(dataDir, 1), "events.jsonl");
    const events = readFileSync(eventsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "phase_save");
    assert.equal(events[0].phase, "plan");
    assert.match(events[0].ts, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("saveCyclePhase pads cycle ids and appends follow-up events", async () => {
  const dataDir = makeTempDir();

  try {
    const { saveCyclePhase } = await loadModule();
    saveCyclePhase(dataDir, { cycle_id: 7, phase: "plan", content: "plan" });
    const result = saveCyclePhase(dataDir, { cycle_id: 7, phase: "do", content: "do" });

    assert.match(result.path, /cycle-007\/do\.md$/);

    const eventsPath = path.join(cycleDir(dataDir, 7), "events.jsonl");
    const events = readFileSync(eventsPath, "utf8").trim().split("\n");
    assert.equal(events.length, 2);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("getCycleHistory returns empty cycles when no cycle data exists", async () => {
  const dataDir = makeTempDir();

  try {
    const { getCycleHistory } = await loadModule();
    assert.deepEqual(getCycleHistory(dataDir, {}), { cycles: [] });
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("getCycleHistory returns the requested cycle with phase content and metrics", async () => {
  const dataDir = makeTempDir();
  const dir = cycleDir(dataDir, 2);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "plan.md"), "plan text", "utf8");
  writeFileSync(path.join(dir, "do.md"), "do text", "utf8");
  writeFileSync(path.join(dir, "check.md"), "check text", "utf8");
  writeFileSync(path.join(dir, "act.md"), "act text", "utf8");
  writeFileSync(path.join(dir, "metrics.json"), JSON.stringify({ score: 0.91 }), "utf8");

  try {
    const { getCycleHistory } = await loadModule();
    const result = getCycleHistory(dataDir, { cycle_id: 2 });

    assert.equal(result.cycles.length, 1);
    assert.deepEqual(result.cycles[0], {
      id: 2,
      plan: "plan text",
      do: "do text",
      check: "check text",
      act: "act text",
      metrics: { score: 0.91 },
    });
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("getCycleHistory returns the last N cycles ordered newest first", async () => {
  const dataDir = makeTempDir();
  writeCyclePhaseFile(dataDir, 1, "plan", "cycle 1");
  writeCyclePhaseFile(dataDir, 2, "plan", "cycle 2");
  writeCyclePhaseFile(dataDir, 3, "plan", "cycle 3");

  try {
    const { getCycleHistory } = await loadModule();
    const result = getCycleHistory(dataDir, { last_n: 2 });

    assert.deepEqual(
      result.cycles.map((cycle) => cycle.id),
      [3, 2]
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("getCycleHistory returns empty cycles for an unknown cycle id", async () => {
  const dataDir = makeTempDir();
  writeCyclePhaseFile(dataDir, 1, "plan", "cycle 1");

  try {
    const { getCycleHistory } = await loadModule();
    assert.deepEqual(getCycleHistory(dataDir, { cycle_id: 9 }), { cycles: [] });
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("saveInsight creates insights.json and tracks totals", async () => {
  const dataDir = makeTempDir();

  try {
    const { saveInsight } = await loadModule();
    const result = saveInsight(dataDir, {
      cycle_id: 1,
      insight: "Need clearer plan checkpoints",
      category: "process",
      severity: "info",
    });

    assert.deepEqual(result, { total_insights: 1, repeated_count: 1 });

    const saved = JSON.parse(readFileSync(path.join(dataDir, "cycles", "insights.json"), "utf8"));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].weight, 1);
    assert.equal(saved[0].text, "Need clearer plan checkpoints");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("saveInsight counts repeated insight text across cycles", async () => {
  const dataDir = makeTempDir();
  writeInsightsFile(dataDir, [
    {
      cycle_id: 1,
      timestamp: "2026-03-01T00:00:00.000Z",
      category: "technical",
      severity: "warning",
      text: "Cache invalidation kept breaking retries",
      weight: 1,
    },
  ]);

  try {
    const { saveInsight } = await loadModule();
    const result = saveInsight(dataDir, {
      cycle_id: 2,
      insight: "Cache invalidation kept breaking retries",
      category: "technical",
      severity: "warning",
    });

    assert.equal(result.total_insights, 2);
    assert.equal(result.repeated_count, 2);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("saveInsight writes a gotcha proposal after the third repeated critical insight", async () => {
  const dataDir = makeTempDir();
  writeInsightsFile(dataDir, [
    {
      cycle_id: 1,
      timestamp: "2026-03-01T00:00:00.000Z",
      category: "quality",
      severity: "critical",
      text: "Missing regression tests on release paths",
      weight: 1,
    },
    {
      cycle_id: 2,
      timestamp: "2026-03-02T00:00:00.000Z",
      category: "quality",
      severity: "critical",
      text: "Missing regression tests on release paths",
      weight: 1,
    },
  ]);

  try {
    const { saveInsight } = await loadModule();
    const result = saveInsight(dataDir, {
      cycle_id: 3,
      insight: "Missing regression tests on release paths",
      category: "quality",
      severity: "critical",
    });

    assert.equal(result.repeated_count, 3);

    const proposalPath = path.join(dataDir, "proposals", "gotchas-quality.md");
    assert.equal(existsSync(proposalPath), true);
    assert.match(readFileSync(proposalPath, "utf8"), /Missing regression tests on release paths/);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("getInsights filters by category and returns newest insights first", async () => {
  const dataDir = makeTempDir();
  writeInsightsFile(dataDir, [
    {
      cycle_id: 1,
      timestamp: "2026-03-01T00:00:00.000Z",
      category: "process",
      severity: "info",
      text: "Process note",
      weight: 1,
    },
    {
      cycle_id: 2,
      timestamp: "2026-03-02T00:00:00.000Z",
      category: "technical",
      severity: "warning",
      text: "Technical note",
      weight: 1,
    },
  ]);

  try {
    const { getInsights } = await loadModule();
    const result = getInsights(dataDir, { category: "technical" });

    assert.equal(result.insights.length, 1);
    assert.equal(result.insights[0].text, "Technical note");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("getInsights applies time decay and min_weight filtering", async () => {
  const dataDir = makeTempDir();
  const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  writeInsightsFile(dataDir, [
    {
      cycle_id: 1,
      timestamp: fortyDaysAgo,
      category: "technical",
      severity: "warning",
      text: "Old note",
      weight: 1,
    },
    {
      cycle_id: 2,
      timestamp: fifteenDaysAgo,
      category: "technical",
      severity: "info",
      text: "Recent note",
      weight: 1,
    },
  ]);

  try {
    const { getInsights } = await loadModule();
    const result = getInsights(dataDir, { min_weight: 0.4 });

    assert.equal(result.insights.length, 1);
    assert.equal(result.insights[0].text, "Recent note");
    assert.ok(result.insights[0].weight < 0.6 && result.insights[0].weight > 0.4);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("getInsights clamps decayed weight to zero and limits the result size", async () => {
  const dataDir = makeTempDir();
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  writeInsightsFile(
    dataDir,
    Array.from({ length: 25 }, (_, index) => ({
      cycle_id: index + 1,
      timestamp: index === 0 ? fortyFiveDaysAgo : new Date(Date.now() - index * 1000).toISOString(),
      category: "process",
      severity: "info",
      text: `Insight ${index + 1}`,
      weight: 1,
    }))
  );

  try {
    const { getInsights } = await loadModule();
    const result = getInsights(dataDir, {});

    assert.equal(result.insights.length, 20);
    const oldest = result.insights.find((entry) => entry.text === "Insight 1");
    assert.equal(oldest, undefined);

    const decayed = getInsights(dataDir, { min_weight: 0, last_n: 30 }).insights.find(
      (entry) => entry.text === "Insight 1"
    );
    assert.equal(decayed.weight, 0);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("saveCycleMetrics writes metrics.json for the cycle", async () => {
  const dataDir = makeTempDir();

  try {
    const { saveCycleMetrics } = await loadModule();
    const result = saveCycleMetrics(dataDir, {
      cycle_id: 4,
      metrics: { duration_ms: 1200, score: 0.82 },
    });

    assert.deepEqual(JSON.parse(readFileSync(result.path, "utf8")), {
      duration_ms: 1200,
      score: 0.82,
    });
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("appendCycleEvent appends timestamped JSONL events and returns the total count", async () => {
  const dataDir = makeTempDir();
  const dir = cycleDir(dataDir, 5);
  mkdirSync(dir, { recursive: true });
  appendFileSync(
    path.join(dir, "events.jsonl"),
    `${JSON.stringify({ ts: "2026-03-01T00:00:00.000Z", type: "existing" })}\n`,
    "utf8"
  );

  try {
    const { appendCycleEvent } = await loadModule();
    const result = appendCycleEvent(dataDir, {
      cycle_id: 5,
      event: { type: "phase_save", phase: "check" },
    });

    assert.equal(result.total_events, 2);

    const events = readFileSync(path.join(dir, "events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(events[1].phase, "check");
    assert.match(events[1].ts, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

/**
 * PDCA cycle memory helpers.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";

const PHASES = ["plan", "do", "check", "act"];
const INSIGHT_CATEGORIES = new Set(["process", "technical", "quality"]);
const INSIGHT_SEVERITIES = new Set(["info", "warning", "critical"]);

function padCycleId(cycleId) {
  return String(cycleId).padStart(3, "0");
}

function getCyclesDir(dataDir) {
  return join(dataDir, "cycles");
}

function getCycleDir(dataDir, cycleId) {
  return join(getCyclesDir(dataDir), `cycle-${padCycleId(cycleId)}`);
}

function readJsonFile(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readTextFile(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
}

function ensureCycleDir(dataDir, cycleId) {
  const dir = getCycleDir(dataDir, cycleId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function loadCycle(dataDir, cycleId) {
  const dir = getCycleDir(dataDir, cycleId);
  if (!existsSync(dir)) return null;

  return {
    id: Number(cycleId),
    plan: readTextFile(join(dir, "plan.md")),
    do: readTextFile(join(dir, "do.md")),
    check: readTextFile(join(dir, "check.md")),
    act: readTextFile(join(dir, "act.md")),
    metrics: readJsonFile(join(dir, "metrics.json"), null),
  };
}

function readInsights(dataDir) {
  return readJsonFile(join(getCyclesDir(dataDir), "insights.json"), []);
}

function writeInsights(dataDir, insights) {
  const cyclesDir = getCyclesDir(dataDir);
  mkdirSync(cyclesDir, { recursive: true });
  writeFileSync(join(cyclesDir, "insights.json"), JSON.stringify(insights, null, 2), "utf8");
}

function validateInsightInput({ category, severity, insight }) {
  if (!INSIGHT_CATEGORIES.has(category)) {
    throw new Error("category must be one of: process, technical, quality");
  }
  if (!INSIGHT_SEVERITIES.has(severity)) {
    throw new Error("severity must be one of: info, warning, critical");
  }
  if (typeof insight !== "string" || insight.trim() === "") {
    throw new Error("insight must be a non-empty string");
  }
}

function writeGotchaProposal(dataDir, { category, insight, repeatedCount, cycleId }) {
  const proposalsDir = join(dataDir, "proposals");
  const proposalPath = join(proposalsDir, `gotchas-${category}.md`);
  mkdirSync(proposalsDir, { recursive: true });

  const lines = [
    `# ${category} gotchas proposal`,
    "",
    `- Trigger cycle: ${cycleId}`,
    `- Repeated critical observations: ${repeatedCount}`,
    "",
    "## Proposed gotcha",
    "",
    insight,
    "",
    "## Recommendation",
    "",
    "Document this issue as a reusable gotcha and add a preventive checklist item.",
    "",
  ];

  writeFileSync(proposalPath, lines.join("\n"), "utf8");
}

export function appendCycleEvent(dataDir, { cycle_id, event }) {
  const dir = ensureCycleDir(dataDir, cycle_id);
  const eventsPath = join(dir, "events.jsonl");
  const record = {
    ts: new Date().toISOString(),
    ...(event ?? {}),
  };

  appendFileSync(eventsPath, `${JSON.stringify(record)}\n`, "utf8");

  const totalEvents = readFileSync(eventsPath, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0).length;

  return { total_events: totalEvents };
}

export function saveCyclePhase(dataDir, { cycle_id, phase, content }) {
  if (!PHASES.includes(phase)) {
    throw new Error("phase must be one of: plan, do, check, act");
  }

  const dir = ensureCycleDir(dataDir, cycle_id);
  const filePath = join(dir, `${phase}.md`);
  writeFileSync(filePath, typeof content === "string" ? content : "", "utf8");

  appendCycleEvent(dataDir, {
    cycle_id,
    event: { type: "phase_save", phase },
  });

  return { path: filePath, cycle_id, phase };
}

export function getCycleHistory(dataDir, { cycle_id, last_n } = {}) {
  if (cycle_id !== undefined) {
    const cycle = loadCycle(dataDir, cycle_id);
    return { cycles: cycle ? [cycle] : [] };
  }

  const cyclesDir = getCyclesDir(dataDir);
  if (!existsSync(cyclesDir)) {
    return { cycles: [] };
  }

  const cycleIds = readdirSync(cyclesDir)
    .map((name) => {
      const match = /^cycle-(\d+)$/.exec(name);
      return match ? Number(match[1]) : null;
    })
    .filter((value) => value !== null)
    .sort((a, b) => b - a);

  const limit = typeof last_n === "number" ? last_n : cycleIds.length;
  const cycles = cycleIds.slice(0, limit).map((id) => loadCycle(dataDir, id)).filter(Boolean);

  return { cycles };
}

export function saveInsight(dataDir, { cycle_id, insight, category, severity }) {
  validateInsightInput({ category, severity, insight });

  const insights = readInsights(dataDir);
  const record = {
    cycle_id,
    timestamp: new Date().toISOString(),
    category,
    severity,
    text: insight.trim(),
    weight: 1.0,
  };

  insights.push(record);
  writeInsights(dataDir, insights);

  const repeatedCount = insights.filter((entry) => entry.text === record.text).length;

  if (severity === "critical" && repeatedCount >= 3) {
    writeGotchaProposal(dataDir, {
      category,
      insight: record.text,
      repeatedCount,
      cycleId: cycle_id,
    });
  }

  return { total_insights: insights.length, repeated_count: repeatedCount };
}

export function getInsights(dataDir, { category, last_n = 20, min_weight } = {}) {
  const now = Date.now();
  const insights = readInsights(dataDir)
    .map((entry) => {
      const timestamp = entry.timestamp ?? new Date(0).toISOString();
      const daysSince = (now - new Date(timestamp).getTime()) / (24 * 60 * 60 * 1000);
      const weight = Math.max(0, 1.0 - daysSince / 30);

      return {
        cycle_id: entry.cycle_id,
        timestamp,
        category: entry.category,
        severity: entry.severity,
        text: entry.text,
        weight,
      };
    })
    .filter((entry) => (category ? entry.category === category : true))
    .filter((entry) => (typeof min_weight === "number" ? entry.weight >= min_weight : true))
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  return {
    insights: insights.slice(0, Math.max(0, Number(last_n) || 20)),
  };
}

export function saveCycleMetrics(dataDir, { cycle_id, metrics }) {
  const dir = ensureCycleDir(dataDir, cycle_id);
  const filePath = join(dir, "metrics.json");
  writeFileSync(filePath, JSON.stringify(metrics ?? {}, null, 2), "utf8");
  return { path: filePath };
}

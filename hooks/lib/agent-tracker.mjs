/**
 * MetaClaw PRM — Agent Effectiveness Tracker
 *
 * Inspired by AutoResearchClaw's MetaClaw Process Reward Model.
 * Tracks which agents are effective in which PDCA phases, enabling
 * long-term routing optimization.
 *
 * Records: agent name, phase, outcome (helped/neutral/hurt),
 * quality delta, duration, token estimate.
 *
 * Data stored in .data/metrics/agent-effectiveness.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const METRICS_DIR_NAME = "metrics";
const TRACKER_FILE = "agent-effectiveness.json";

/**
 * @typedef {{ agent: string, phase: string, outcome: "helped"|"neutral"|"hurt", quality_delta: number, duration_ms: number, tokens: number, timestamp: string }} AgentRecord
 */

/**
 * Load the tracker data. Returns empty structure if file doesn't exist.
 * @param {string} dataDir
 * @returns {{ records: AgentRecord[], summary: object }}
 */
export function loadTracker(dataDir) {
  const filePath = join(dataDir, METRICS_DIR_NAME, TRACKER_FILE);
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return { records: [], summary: {} };
  }
}

/**
 * Record an agent's contribution to a PDCA phase.
 * @param {string} dataDir
 * @param {AgentRecord} record
 */
export function recordAgentContribution(dataDir, record) {
  const metricsDir = join(dataDir, METRICS_DIR_NAME);
  mkdirSync(metricsDir, { recursive: true });

  const filePath = join(metricsDir, TRACKER_FILE);
  const data = loadTracker(dataDir);

  data.records.push({
    ...record,
    timestamp: record.timestamp || new Date().toISOString(),
  });

  // Rebuild summary
  data.summary = buildSummary(data.records);

  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return data.summary;
}

/**
 * Build agent effectiveness summary from records.
 * @param {AgentRecord[]} records
 * @returns {Object<string, { phases: Object<string, { helped: number, neutral: number, hurt: number }>, avg_quality_delta: number, total_invocations: number, best_at: string[], struggles_with: string[] }>}
 */
export function buildSummary(records) {
  const agents = {};

  for (const r of records) {
    if (!agents[r.agent]) {
      agents[r.agent] = { phases: {}, deltas: [], total: 0 };
    }
    const a = agents[r.agent];
    if (!a.phases[r.phase]) {
      a.phases[r.phase] = { helped: 0, neutral: 0, hurt: 0 };
    }
    a.phases[r.phase][r.outcome] = (a.phases[r.phase][r.outcome] || 0) + 1;
    a.deltas.push(r.quality_delta || 0);
    a.total += 1;
  }

  const summary = {};
  for (const [name, data] of Object.entries(agents)) {
    const avgDelta = data.deltas.length > 0
      ? data.deltas.reduce((s, d) => s + d, 0) / data.deltas.length
      : 0;

    // Find best/worst phases
    const phaseScores = [];
    for (const [phase, counts] of Object.entries(data.phases)) {
      const total = counts.helped + counts.neutral + counts.hurt;
      const score = total > 0 ? (counts.helped - counts.hurt) / total : 0;
      phaseScores.push({ phase, score, total });
    }
    phaseScores.sort((a, b) => b.score - a.score);

    summary[name] = {
      phases: data.phases,
      avg_quality_delta: Math.round(avgDelta * 1000) / 1000,
      total_invocations: data.total,
      best_at: phaseScores.filter((p) => p.score > 0.3).map((p) => p.phase),
      struggles_with: phaseScores.filter((p) => p.score < -0.3).map((p) => p.phase),
    };
  }

  return summary;
}

/**
 * Get effectiveness for a specific agent.
 * @param {string} dataDir
 * @param {string} agentName
 * @returns {{ phases: object, avg_quality_delta: number, total_invocations: number, best_at: string[], struggles_with: string[] } | null}
 */
export function getAgentEffectiveness(dataDir, agentName) {
  const data = loadTracker(dataDir);
  return data.summary[agentName] || null;
}

/**
 * Get the top N most effective agents for a given phase.
 * @param {string} dataDir
 * @param {string} phase
 * @param {number} [topN=5]
 * @returns {Array<{ agent: string, score: number, invocations: number }>}
 */
export function getTopAgentsForPhase(dataDir, phase, topN = 5) {
  const data = loadTracker(dataDir);
  const scores = [];

  for (const [agent, info] of Object.entries(data.summary)) {
    const phaseData = info.phases[phase];
    if (!phaseData) continue;
    const total = phaseData.helped + phaseData.neutral + phaseData.hurt;
    const score = total > 0 ? (phaseData.helped - phaseData.hurt) / total : 0;
    scores.push({ agent, score: Math.round(score * 100) / 100, invocations: total });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topN);
}

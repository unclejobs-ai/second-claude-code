/**
 * Soul Observer — shared observation logic for the soul learning pipeline.
 *
 * Detects correction/style/emotional signals from user text and persists
 * observations to daily JSONL files. All functions are safe no-ops when no
 * soul files exist.
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  renameSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Signal detection patterns
// ---------------------------------------------------------------------------

const CORRECTION_PATTERNS = [
  { regex: /이런\s*톤으로|이런\s*식으로/i, signal: "tone_correction", category: "correction" },
  { regex: /아니\s*그게\s*아니라|그게\s*아니고/i, signal: "approach_correction", category: "correction" },
  { regex: /더\s*(짧게|길게|자세히|간단히)/i, signal: "verbosity_correction", category: "correction" },
  { regex: /no,?\s*(not like that|I mean|I want)/i, signal: "content_correction", category: "correction" },
  { regex: /just\s*(tell me|give me|say)/i, signal: "directness_signal", category: "emotional" },
  { regex: /돌려말하지\s*말고|직접적으로/i, signal: "directness_signal", category: "emotional" },
  { regex: /결론만|핵심만|요약만/i, signal: "brevity_signal", category: "emotional" },
  { regex: /재밌게|유머/i, signal: "humor_preference", category: "style" },
  { regex: /formal|격식|존댓말/i, signal: "formality_signal", category: "style" },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect soul signals in a text string.
 *
 * @param {string} text
 * @returns {{ signal: string, category: string, confidence: number, raw_context: string }[]}
 */
export function detectSignals(text) {
  if (typeof text !== "string" || text.length === 0) return [];

  /** @type {{ signal: string, category: string, confidence: number, raw_context: string }[]} */
  const results = [];

  for (const entry of CORRECTION_PATTERNS) {
    const match = entry.regex.exec(text);
    if (match) {
      // Extract up to ~80 chars of surrounding context
      const start = Math.max(0, match.index - 20);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      const raw_context = text.slice(start, end).replace(/[\n\r]+/g, " ").trim();

      results.push({
        signal: entry.signal,
        category: entry.category,
        confidence: 0.8,
        raw_context,
      });
    }
  }

  return results;
}

/**
 * Append a single observation to today's JSONL file.
 * Creates the observations directory if needed.
 * appendFileSync is atomic for small payloads at the kernel level (O_APPEND).
 *
 * @param {string} dataDir  Root .data directory path
 * @param {{ signal: string, category: string, confidence: number, raw_context: string }} observation
 */
export function appendObservation(dataDir, observation) {
  const obsDir = join(dataDir, "soul", "observations");
  if (!existsSync(obsDir)) {
    mkdirSync(obsDir, { recursive: true });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = join(obsDir, `${today}.jsonl`);

  const record = JSON.stringify({
    ts: new Date().toISOString(),
    ...observation,
  });

  appendFileSync(filePath, record + "\n", "utf8");
}

/**
 * Read soul-active.json from the soul directory.
 * Returns null if the file does not exist or cannot be parsed.
 *
 * @param {string} dataDir
 * @returns {object | null}
 */
export function readSoulState(dataDir) {
  const filePath = join(dataDir, "soul", "soul-active.json");
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Quick check: is soul learning or hybrid mode active?
 * Returns false when no soul files exist — safe no-op default.
 *
 * @param {string} dataDir
 * @returns {boolean}
 */
export function isSoulLearning(dataDir) {
  const state = readSoulState(dataDir);
  if (!state) return false;
  const mode = String(state.mode || "").toLowerCase();
  return mode === "learning" || mode === "hybrid";
}

/**
 * Read SOUL.md content, truncated to ~250 words (~500 tokens).
 * Returns null when the file does not exist.
 *
 * @param {string} dataDir
 * @returns {string | null}
 */
export function readSoulProfile(dataDir) {
  const filePath = join(dataDir, "soul", "SOUL.md");
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, "utf8");

  // Truncate to ~250 words while preserving whole words
  const words = raw.split(/\s+/);
  if (words.length <= 250) return raw;

  return words.slice(0, 250).join(" ") + " …";
}

/**
 * Update soul-active.json with incremented counters and optional flags.
 * Writes atomically via tmp+rename. Safe no-op if state file doesn't exist.
 *
 * @param {string} dataDir
 * @param {{ increment_observations?: number, increment_sessions?: boolean, set_proposal_due?: boolean }} updates
 */
export function updateSoulState(dataDir, updates) {
  const filePath = join(dataDir, "soul", "soul-active.json");
  if (!existsSync(filePath)) return;

  /** @type {object} */
  let state;
  try {
    state = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return;
  }

  if (updates.increment_observations) {
    state.observation_count = (Number(state.observation_count) || 0) + updates.increment_observations;
  }
  if (updates.increment_sessions) {
    state.session_count = (Number(state.session_count) || 0) + 1;
  }
  if (updates.set_proposal_due === true) {
    state.proposal_due = true;
  }

  const tmp = `${filePath}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, filePath);
}

/**
 * Compute soul synthesis readiness from actual observation files.
 * Fast count without loading all data into memory.
 *
 * @param {string} dataDir
 * @returns {{ ready: boolean, observation_count: number, session_count: number, observation_shortfall: number, session_shortfall: number, proposal_due: boolean, learning_active: boolean, recommendation: string }}
 */
export function readSoulReadiness(dataDir) {
  const obsDir = join(dataDir, "soul", "observations");
  let totalObs = 0;
  const sessionSet = new Set();

  if (existsSync(obsDir)) {
    try {
      const files = readdirSync(obsDir).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        try {
          const content = readFileSync(join(obsDir, file), "utf8");
          const lines = content.split("\n").filter((l) => l.trim().length > 0);
          totalObs += lines.length;
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (obj.session_id) sessionSet.add(obj.session_id);
            } catch { /* skip malformed */ }
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* non-fatal */ }
  }

  const sessionCount = sessionSet.size;
  const thresholdMet = totalObs >= 30 || sessionCount >= 10;

  let proposalDue = false;
  let learningActive = false;
  const activeFilePath = join(dataDir, "soul", "soul-active.json");
  if (existsSync(activeFilePath)) {
    try {
      const state = JSON.parse(readFileSync(activeFilePath, "utf8"));
      proposalDue = state.proposal_due === true;
      const mode = String(state.mode || "").toLowerCase();
      learningActive = mode === "learning" || mode === "hybrid";
    } catch { /* non-fatal */ }
  }

  return {
    ready: thresholdMet,
    observation_count: totalObs,
    session_count: sessionCount,
    observation_shortfall: Math.max(0, 30 - totalObs),
    session_shortfall: Math.max(0, 10 - sessionCount),
    proposal_due: proposalDue,
    learning_active: learningActive,
    recommendation: thresholdMet
      ? "Synthesis threshold met. Run soul propose to generate a proposed SOUL.md."
      : `Need ${Math.max(0, 30 - totalObs)} more observations or ${Math.max(0, 10 - sessionCount)} more sessions.`,
  };
}

/**
 * Read the most recent shipping/retro observation if one exists.
 *
 * @param {string} dataDir
 * @returns {{ ts: string, raw_text: string } | null}
 */
export function readLatestRetro(dataDir) {
  const obsDir = join(dataDir, "soul", "observations");
  if (!existsSync(obsDir)) return null;

  /** @type {{ ts: string, raw_text: string } | null} */
  let latest = null;

  try {
    const files = readdirSync(obsDir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse(); // newest first
    for (const file of files) {
      try {
        const content = readFileSync(join(obsDir, file), "utf8");
        const lines = content.split("\n").filter((l) => l.trim().length > 0);
        // Iterate in reverse so the last line (most recent) is checked first
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const obj = JSON.parse(lines[i]);
            if (obj.signal_type === "shipping") {
              return { ts: obj.ts || "", raw_text: obj.raw_text || "" };
            }
          } catch { /* skip malformed */ }
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* non-fatal */ }

  return null;
}

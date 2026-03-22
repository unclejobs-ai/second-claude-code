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

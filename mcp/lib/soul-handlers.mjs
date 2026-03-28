/**
 * Soul profile and observations handlers.
 */

import {
  readFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");

// Soul paths
const SOUL_DIR = join(DATA_DIR, "soul");
const SOUL_PROFILE_FILE = join(SOUL_DIR, "SOUL.md");
const SOUL_ACTIVE_FILE = join(SOUL_DIR, "soul-active.json");
const SOUL_OBS_DIR = join(SOUL_DIR, "observations");

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/** soul_get_profile */
export function handleSoulGetProfile() {
  const profile = existsSync(SOUL_PROFILE_FILE)
    ? readFileSync(SOUL_PROFILE_FILE, "utf8")
    : null;

  let metadata = null;
  if (existsSync(SOUL_ACTIVE_FILE)) {
    try {
      metadata = JSON.parse(readFileSync(SOUL_ACTIVE_FILE, "utf8"));
    } catch (err) {
      throw new Error(`Failed to parse soul-active.json: ${err.message}`);
    }
  }

  return { profile, metadata };
}

/** soul_record_observation */
export function handleSoulRecordObservation({ signal, category, confidence, raw_context }) {
  if (typeof signal !== "string" || signal.trim() === "") {
    throw new Error("signal must be a non-empty string");
  }
  if (typeof category !== "string" || category.trim() === "") {
    throw new Error("category must be a non-empty string");
  }

  mkdirSync(SOUL_OBS_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = join(SOUL_OBS_DIR, `${today}.jsonl`);

  const record = JSON.stringify({
    ts: new Date().toISOString(),
    signal: signal.trim(),
    category: category.trim(),
    confidence: typeof confidence === "number" ? confidence : 0.8,
    raw_context: typeof raw_context === "string" ? raw_context.slice(0, 200) : "",
  });

  appendFileSync(filePath, record + "\n", "utf8");

  return { recorded: true, file: filePath, ts: JSON.parse(record).ts };
}

/** soul_get_observations */
export function handleSoulGetObservations({ category, date_from, date_to, limit = 50 }) {
  if (!existsSync(SOUL_OBS_DIR)) {
    return { observations: [], total: 0 };
  }

  // Gather candidate JSONL files filtered by date range
  const allFiles = readdirSync(SOUL_OBS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .sort(); // lexicographic = chronological for YYYY-MM-DD

  const filteredFiles = allFiles.filter((f) => {
    const date = f.replace(".jsonl", "");
    if (date_from && date < date_from) return false;
    if (date_to && date > date_to) return false;
    return true;
  });

  /** @type {object[]} */
  const observations = [];

  for (const file of filteredFiles) {
    const filePath = join(SOUL_OBS_DIR, file);
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (category && obj.category !== category) continue;
        observations.push(obj);
      } catch {
        // Skip malformed lines silently
      }
    }
  }

  // Most recent first, then apply limit
  observations.sort((a, b) => {
    const ta = String(a.ts || "");
    const tb = String(b.ts || "");
    return tb.localeCompare(ta);
  });

  const limitedObs = observations.slice(0, Math.max(1, Number(limit) || 50));

  return { observations: limitedObs, total: observations.length };
}

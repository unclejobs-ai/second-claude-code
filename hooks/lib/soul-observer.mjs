/**
 * Soul Observer — shared observation logic for the soul learning pipeline.
 *
 * Detects correction/style/emotional signals from user text and persists
 * observations to daily JSONL files. All functions are safe no-ops when no
 * soul files exist.
 */

import { existsSync, writeFileSync, renameSync, openSync, readSync, closeSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Signal detection patterns
// ---------------------------------------------------------------------------

// Hook boundaries receive text from files, subprocesses, and Claude's stdin.
// Keep those boundaries finite and remove terminal/control tricks before text
// is embedded in a prompt or persisted for a later session.
// Reviewer output itself is capped at 96 KiB. The surrounding JSON envelope,
// escaped characters, and future hook fields need headroom, so stdin uses a
// larger independent boundary and rejects overflow instead of returning a
// truncated, unparsable JSON document.
export const HOOK_INPUT_MAX_BYTES = 512 * 1024;
export const MAX_EXTERNAL_CONTEXT_CHARS = 12 * 1024;
/**
 * Read at most maxBytes from a file descriptor. This avoids loading an
 * accidentally huge SOUL/observation file just to render a small hook hint.
 */
export function readTextFileLimited(filePath, maxBytes = HOOK_INPUT_MAX_BYTES) {
  let fd;
  try {
    fd = openSync(filePath, "r");
    const buffer = Buffer.alloc(Math.max(1, maxBytes));
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(fd, buffer, offset, buffer.length - offset, null);
      if (count === 0) break;
      offset += count;
    }
    return buffer.subarray(0, offset).toString("utf8");
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* non-fatal */ }
    }
  }
}

/** Read bounded UTF-8 stdin for hook event payloads. */
export function readHookStdin(maxBytes = HOOK_INPUT_MAX_BYTES) {
  const limit = Math.max(1, Math.floor(Number(maxBytes) || HOOK_INPUT_MAX_BYTES));
  try {
    const buffer = Buffer.alloc(limit + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(0, buffer, offset, buffer.length - offset, null);
      if (count === 0) break;
      offset += count;
    }
    if (offset > limit) {
      const error = new RangeError(`hook input exceeds ${limit} bytes`);
      error.code = "SCC_HOOK_INPUT_TOO_LARGE";
      throw error;
    }
    return buffer.subarray(0, offset).toString("utf8");
  } catch (error) {
    if (error?.code === "SCC_HOOK_INPUT_TOO_LARGE") throw error;
    return "";
  }
}

/**
 * Remove ANSI/OSC escapes, bidi overrides, and non-printing control chars.
 * Newlines and tabs are retained because hook context is line-oriented.
 */
export function sanitizeExternalText(value, maxLen = MAX_EXTERNAL_CONTEXT_CHARS) {
  return String(value ?? "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069\u200B\u200C\u200D\u2060]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/\r\n?/g, "\n")
    .slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
    return JSON.parse(readTextFileLimited(filePath));
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
    state = JSON.parse(readTextFileLimited(filePath));
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


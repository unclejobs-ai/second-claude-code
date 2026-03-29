/**
 * Synchronous File Mutex — process-safe file locking for hooks.
 *
 * Claude Code hooks run as separate Node.js processes, so in-memory
 * promise chains (async file-mutex.mjs) cannot prevent cross-process races.
 * This module uses a lockfile (atomic O_EXCL create) for synchronous
 * mutual exclusion across concurrent hook processes.
 *
 * Inspired by Pi coding agent's withFileMutationQueue pattern,
 * adapted for Claude Code's synchronous hook execution model.
 *
 * Usage:
 *   import { withFileLockSync } from "./file-mutex-sync.mjs";
 *   withFileLockSync("/path/to/file.json", () => {
 *     const data = JSON.parse(readFileSync(path, "utf8"));
 *     data.count += 1;
 *     writeFileSync(path, JSON.stringify(data));
 *   });
 */

import { writeFileSync, unlinkSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const LOCK_SUFFIX = ".lock";
const STALE_THRESHOLD_MS = 30_000; // 30s — locks older than this are considered stale

/**
 * Execute `fn` while holding a file-based lock.
 * Spins with exponential backoff until the lock is acquired.
 *
 * @template T
 * @param {string} filePath - Path to the file being mutated.
 * @param {() => T} fn - Synchronous mutation function.
 * @param {{ maxWaitMs?: number }} [opts]
 * @returns {T}
 */
export function withFileLockSync(filePath, fn, opts = {}) {
  const lockPath = resolve(filePath) + LOCK_SUFFIX;
  const maxWaitMs = opts.maxWaitMs || 10_000;
  const started = Date.now();
  let delay = 5; // Start at 5ms

  // Spin-acquire
  while (true) {
    try {
      // Ensure parent directory exists before attempting O_EXCL lock creation.
      // Without this, writeFileSync fails with ENOENT (not EEXIST) if the
      // directory hasn't been created yet.
      const lockDir = resolve(lockPath, "..");
      if (!existsSync(lockDir)) {
        try { mkdirSync(lockDir, { recursive: true }); } catch { /* race-safe */ }
      }
      // O_EXCL — fails if file already exists (atomic create)
      writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      break; // Lock acquired
    } catch (err) {
      if (err.code !== "EEXIST") throw err;

      // Check for stale lock
      try {
        const st = statSync(lockPath);
        if (Date.now() - st.mtimeMs > STALE_THRESHOLD_MS) {
          // Stale lock — force remove and retry
          try { unlinkSync(lockPath); } catch { /* race with other cleaner */ }
          continue;
        }
      } catch {
        // Lock vanished between check — retry
        continue;
      }

      if (Date.now() - started > maxWaitMs) {
        // Timeout — force break stale lock
        try { unlinkSync(lockPath); } catch { /* ignore */ }
        throw new Error(`File lock timeout after ${maxWaitMs}ms on ${filePath}`);
      }

      // Busy wait with exponential backoff (portable sync sleep)
      const sleepMs = Math.min(delay, 200);
      const end = Date.now() + sleepMs;
      while (Date.now() < end) { /* spin */ }
      delay = Math.min(delay * 2, 200);
    }
  }

  try {
    return fn();
  } finally {
    try { unlinkSync(lockPath); } catch { /* ignore — lock already cleaned */ }
  }
}

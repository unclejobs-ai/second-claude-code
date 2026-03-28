/**
 * File Mutation Queue — per-file write serialization.
 *
 * Inspired by Pi coding agent's withFileMutationQueue pattern.
 * Serializes all write operations targeting the same file while allowing
 * parallel operations on different files. Prevents the race condition where
 * concurrent subagent-stop + subagent-start hooks do read-modify-write
 * on the same aggregation file and drop reviewer records.
 *
 * Usage:
 *   import { withFileLock } from "./file-mutex.mjs";
 *   await withFileLock("/path/to/file.json", async () => {
 *     const data = JSON.parse(readFileSync(path, "utf8"));
 *     data.count += 1;
 *     writeFileSync(path, JSON.stringify(data));
 *   });
 */

import { realpathSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** @type {Map<string, Promise<void>>} */
const locks = new Map();

/**
 * Resolve a file path to its canonical form for lock keying.
 * Falls back to resolve() if the file doesn't exist yet.
 * @param {string} filePath
 * @returns {string}
 */
function canonicalize(filePath) {
  const abs = resolve(filePath);
  try {
    return existsSync(abs) ? realpathSync(abs) : abs;
  } catch {
    return abs;
  }
}

/**
 * Execute `fn` while holding an exclusive per-file lock.
 * Operations on different files run in parallel.
 * Operations on the same file are serialized via promise chaining.
 *
 * @template T
 * @param {string} filePath - Path to the file being mutated.
 * @param {() => T | Promise<T>} fn - The mutation function.
 * @returns {Promise<T>}
 */
export async function withFileLock(filePath, fn) {
  const key = canonicalize(filePath);
  const prev = locks.get(key) || Promise.resolve();

  /** @type {(value?: any) => void} */
  let release;
  const next = new Promise((r) => {
    release = r;
  });
  locks.set(key, next);

  try {
    await prev;
    return await fn();
  } finally {
    // Clean up if no one else is waiting.
    if (locks.get(key) === next) {
      locks.delete(key);
    }
    release();
  }
}

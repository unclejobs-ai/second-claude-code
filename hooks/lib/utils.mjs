import { readFileSync, existsSync } from "fs";

/**
 * Sanitize a value for safe markdown embedding.
 * Strips markdown-active characters and newlines to prevent injection.
 */
export function sanitize(val, maxLen = 200) {
  return String(val || "")
    .replace(/[[\](){}#*`<>]/g, "")
    .replace(/[\n\r]/g, " ")
    .slice(0, maxLen);
}

/**
 * Read and parse a JSON file safely. Returns null if missing or corrupt.
 */
export function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

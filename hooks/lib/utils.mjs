import { readFileSync } from "fs";

/**
 * Sanitize a value for safe markdown embedding.
 * Strips markdown-active characters and newlines to prevent injection.
 */
export function sanitize(val, maxLen = 200) {
  return String(val || "")
    .replace(/[[\](){}#*`<>"'|]/g, "")
    .replace(/--/g, "")
    .replace(/[\n\r]/g, " ")
    .slice(0, maxLen);
}

/**
 * Read and parse a JSON file safely.
 * Returns null silently if the file does not exist.
 * Returns null with a console.error warning if the file exists but is malformed.
 */
export function readJsonSafe(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    console.error(`[utils] readJsonSafe: cannot read file "${path}":`, err.message);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[utils] readJsonSafe: JSON parse error in "${path}":`, err.message);
    return null;
  }
}

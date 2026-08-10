import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function stateFilePath(root) {
  return join(root, ".scc", "state", "coach.json");
}

export function readState(root) {
  const path = stateFilePath(root);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    // A corrupt state file reads as "no interview" rather than crashing the CLI.
    return null;
  }
}

export function writeState(root, value) {
  const path = stateFilePath(root);
  mkdirSync(dirname(path), { recursive: true });
  // Same directory so rename(2) stays on one filesystem, and pid-suffixed so
  // concurrent writers never share a temp file. rename is atomic, so a reader
  // observes the whole old file or the whole new one — never a torn one.
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  return value;
}

export function clearState(root) {
  rmSync(stateFilePath(root), { force: true });
}

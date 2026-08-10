import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const STALE_TEMP_FILE_AGE_MS = 60_000;

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

// A writer killed between writeFileSync and renameSync (SIGKILL — nothing in
// this process gets to run) strands its temp file forever. There is no pid
// to signal that moment, so age is the only honest signal: a real write
// completes in milliseconds, so any coach.json.tmp-* older than this is
// certainly abandoned, not mid-flight. Errors are swallowed — a failed sweep
// must never block a legitimate write.
function sweepStaleTempFiles(path) {
  const dir = dirname(path);
  const prefix = `${basename(path)}.tmp-`;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const staleBefore = Date.now() - STALE_TEMP_FILE_AGE_MS;
  for (const name of entries) {
    if (!name.startsWith(prefix)) continue;
    const candidate = join(dir, name);
    try {
      if (statSync(candidate).mtimeMs < staleBefore) {
        rmSync(candidate, { force: true });
      }
    } catch {
      // Best-effort: another process may have already removed it, or a
      // permission error — either way, do not block the write below.
    }
  }
}

export function writeState(root, value) {
  const path = stateFilePath(root);
  mkdirSync(dirname(path), { recursive: true });
  sweepStaleTempFiles(path);
  // Same directory so rename(2) stays on one filesystem, and pid-suffixed so
  // concurrent writers never share a temp file. rename is atomic, so a reader
  // observes the whole old file or the whole new one — never a torn one.
  const tmp = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(tmp, path);
  } finally {
    // No-op if the rename above already moved it away.
    rmSync(tmp, { force: true });
  }
  return value;
}

export function clearState(root) {
  rmSync(stateFilePath(root), { force: true });
}

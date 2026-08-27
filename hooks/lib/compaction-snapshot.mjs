import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

function boundedString(value, maxLength = 512) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export function compactionOwner(payload = {}, env = process.env) {
  const sessionId = boundedString(
    payload?.session_id ?? payload?.sessionId ?? env.CLAUDE_SESSION_ID,
    256
  );
  if (!sessionId) return null;

  const projectValue = boundedString(
    payload?.project_dir ?? payload?.cwd ?? env.CLAUDE_PROJECT_DIR ?? process.cwd(),
    4096
  );
  return {
    session_id: sessionId,
    project_root: resolve(projectValue || process.cwd()),
  };
}

export function compactionSnapshotPath(dataDir, owner) {
  if (!owner?.session_id) return null;
  const key = createHash("sha256")
    .update(`${owner.session_id}\0${owner.project_root || ""}`)
    .digest("hex")
    .slice(0, 24);
  return join(dataDir, "state", `compaction-snapshot-${key}.json`);
}

export function compactionOwnerMatches(snapshot, owner) {
  return Boolean(
    snapshot?.owner?.session_id &&
      owner?.session_id &&
      snapshot.owner.session_id === owner.session_id &&
      snapshot.owner.project_root === owner.project_root
  );
}

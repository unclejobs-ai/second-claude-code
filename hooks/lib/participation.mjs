/**
 * Upstream participation — who helped make the thing before it was reviewed.
 *
 * The invariant: whoever participated in producing an artifact does not get to
 * certify it. Agent reuse is what breaks this quietly. The critic roster and
 * the agents an upstream phase borrows are drawn from the same pool, so the
 * same name can shape a decision and then vote on the work that decision
 * governs — adversarial in form, self-review in substance.
 *
 * A reviewer-named agent that starts while no review aggregation is open is
 * running upstream, not on the panel. That is the signal this records.
 *
 * Lifetime is one Do -> Check pass: the list is cleared when consensus is
 * computed, so a name borrowed upstream once does not bar that agent from
 * every future review.
 */

import { join } from "path";
import { existsSync } from "fs";
import { readJsonSafe, ensureDir, writeJsonAtomic } from "./utils.mjs";
import { withFileLockSync } from "./file-mutex-sync.mjs";

function safeScope(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 96) || null;
}

/**
 * Participant lifetime follows the produced artifact (when the host provides
 * an artifact identifier), otherwise the Claude session. Subagent run IDs are
 * deliberately excluded: producer and reviewer calls have different run IDs.
 */
export function participantScope(payload) {
  const candidates = [
    payload?.review_artifact_id,
    payload?.artifact_id,
    payload?.tool_input?.review_artifact_id,
    payload?.tool_input?.artifact_id,
    payload?.session_id,
    payload?.sessionId,
    payload?.tool_input?.session_id,
    process.env.CLAUDE_SESSION_ID,
  ];
  for (const candidate of candidates) {
    const scope = safeScope(candidate);
    if (scope) return scope;
  }
  return null;
}

export function participantStateDir(stateDir, payload) {
  const scope = participantScope(payload);
  return scope ? join(stateDir, "review-participants", scope) : stateDir;
}

export function participantsFile(stateDir) {
  return join(stateDir, "upstream-participants.json");
}

export function recordParticipant(stateDir, name, { now = new Date() } = {}) {
  if (typeof name !== "string" || !name.trim()) return null;
  const file = participantsFile(stateDir);
  ensureDir(stateDir);
  return withFileLockSync(file, () => {
    const current = readJsonSafe(file);
    const participants = Array.isArray(current?.participants) ? current.participants : [];
    if (!participants.some((entry) => entry?.name === name)) {
      participants.push({ name, at: now.toISOString() });
    }
    const next = { participants };
    writeJsonAtomic(file, next);
    return next;
  });
}

export function readParticipantNames(stateDir) {
  const file = participantsFile(stateDir);
  if (!existsSync(file)) return [];
  const current = readJsonSafe(file);
  if (!Array.isArray(current?.participants)) return [];
  return current.participants
    .map((entry) => (typeof entry?.name === "string" ? entry.name : null))
    .filter(Boolean);
}

export function clearParticipants(stateDir) {
  const file = participantsFile(stateDir);
  if (!existsSync(file)) return;
  withFileLockSync(file, () => {
    writeJsonAtomic(file, { participants: [] });
  });
}

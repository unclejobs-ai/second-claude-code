import { join } from "node:path";

function safePart(value, maxLength = 48) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, maxLength) || null;
}

/**
 * Claude Code documents session_id and prompt_id on hook payloads. It does not
 * document run_id/review_run_id, so review state must not depend on those
 * synthetic fields. One review panel per session/prompt is supported.
 */
export function reviewSessionNamespace(payload) {
  const sessionId = safePart(
    payload?.session_id || payload?.sessionId || payload?.tool_input?.session_id || process.env.CLAUDE_SESSION_ID
  );
  const promptId = safePart(payload?.prompt_id || payload?.promptId || payload?.tool_input?.prompt_id);
  if (sessionId && promptId) return `${sessionId}--${promptId}`;
  return sessionId || promptId;
}

export function reviewAggregationPath(stateDir, payload) {
  const namespace = reviewSessionNamespace(payload);
  return {
    namespace,
    path: namespace
      ? join(stateDir, `review-aggregation-${namespace}.json`)
      : join(stateDir, "review-aggregation.json"),
  };
}

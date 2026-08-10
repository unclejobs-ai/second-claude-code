#!/usr/bin/env node

/**
 * UserPromptSubmit Hook — compares the prompt against active standards.
 *
 * Each standard declares its own `triggers`: literal strings. When one appears
 * verbatim in the prompt, the hook names the standard and its file path and
 * stops. It never instructs a skill invocation — the decision stays with the
 * user and the model. No active standards, or no trigger match, means no
 * output at all.
 */

import { readFileSync } from "fs";
import { listActiveStandards } from "../scripts/lib/standard-record.mjs";
import { sanitize } from "./lib/utils.mjs";

function readHookPayload() {
  if (process.stdin.isTTY) return null;

  try {
    const rawPayload = readFileSync(0, "utf8");
    if (!rawPayload.trim()) return null;
    return JSON.parse(rawPayload);
  } catch {
    return null;
  }
}

function extractPrompt(payload) {
  const candidates = [
    payload?.prompt,
    payload?.user_prompt,
    payload?.input,
    payload?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return "";
}

const hookPayload = readHookPayload();
const raw = extractPrompt(hookPayload) || process.env.USER_PROMPT || "";
const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let hits = [];
try {
  hits = listActiveStandards(projectRoot).filter((standard) =>
    (standard.triggers || []).some((trigger) => trigger && raw.includes(trigger))
  );
} catch {
  // Non-fatal — a malformed standard record must not break every prompt.
  hits = [];
}

if (hits.length > 0) {
  const lines = ["이 요청이 활성 기준의 적용 범위에 닿습니다.", ""];
  for (const hit of hits) {
    const id = sanitize(hit.id);
    const title = sanitize(hit.title);
    lines.push(`- **${id}** — ${title}`);
    lines.push(`  ${hit.path}`);
  }
  lines.push("");
  lines.push("기준을 지키거나, 명시적으로 폐기하고 새로 세우십시오. 조용히 다르게 가지 마십시오.");
  process.stdout.write(lines.join("\n") + "\n");
}

process.exit(0);

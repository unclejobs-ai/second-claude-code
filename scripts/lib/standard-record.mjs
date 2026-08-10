import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function standardsDir(root) {
  return join(root, ".scc", "standards");
}

function standardPath(root, id) {
  return join(standardsDir(root), id, "STANDARD.md");
}

function jsonArray(values) {
  return `[${(values || []).map((v) => JSON.stringify(String(v))).join(", ")}]`;
}

export function renderStandard(fork, { now = new Date(), supersedes = null } = {}) {
  const decided = now.toISOString().slice(0, 10);
  const checks = Array.isArray(fork.checks) ? fork.checks : [];
  const enforcement = checks.length > 0 ? "checked" : "none";
  const rejected = (fork.rejected || [])
    .map((option) => `- **${option.label}** — ${option.why}`)
    .join("\n");

  return `---
id: ${fork.id}
status: active
enforcement: ${enforcement}
decided: ${decided}
review_when: ${JSON.stringify(fork.review_when || "")}
supersedes: ${supersedes ? JSON.stringify(supersedes) : "null"}
triggers: ${jsonArray(fork.triggers)}
checks: []
---

# ${fork.title}

## 고른 것

${fork.chosen}

## 탈락

${rejected || "- (기록된 대안 없음)"}

## 실행 재료

${fork.payload || "(없음)"}

## 지키는 법

${
  enforcement === "checked"
    ? "이 기준에는 준수 검사가 붙어 있다."
    : "준수 검사가 아직 없다. 위반을 기계로 잡지 못하므로 사람이 확인해야 한다."
}
`;
}

export function writeStandard(root, fork, options = {}) {
  const path = standardPath(root, fork.id);
  mkdirSync(join(standardsDir(root), fork.id), { recursive: true });
  writeFileSync(path, renderStandard(fork, options), "utf8");
  return path;
}

function readField(body, field) {
  const match = body.match(new RegExp(`^${field}:\\s*(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function parseJsonField(body, field) {
  const raw = readField(body, field);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listActiveStandards(root) {
  const dir = standardsDir(root);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = standardPath(root, entry.name);
    if (!existsSync(path)) continue;
    const body = readFileSync(path, "utf8");
    if (readField(body, "status") !== "active") continue;
    const title = body.match(/^# (.+)$/m);
    out.push({
      id: readField(body, "id") || entry.name,
      title: title ? title[1].trim() : entry.name,
      review_when: JSON.parse(readField(body, "review_when") || '""'),
      triggers: parseJsonField(body, "triggers"),
      enforcement: readField(body, "enforcement") || "none",
      path,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function supersedeStandard(root, id) {
  const path = standardPath(root, id);
  if (!existsSync(path)) return false;
  const body = readFileSync(path, "utf8");
  writeFileSync(path, body.replace(/^status: active$/m, "status: superseded"), "utf8");
  return true;
}

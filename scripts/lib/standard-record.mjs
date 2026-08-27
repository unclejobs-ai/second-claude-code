import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Standards are project-controlled files, but hooks read them on every
// session/prompt boundary. Keep an unexpectedly large or numerous standards
// tree from becoming an unbounded hook cost.
export const MAX_STANDARD_ENTRIES = 64;
export const MAX_STANDARD_FILE_BYTES = 128 * 1024;

export function isValidStandardId(id) {
  return typeof id === "string" && ID_PATTERN.test(id);
}

function assertValidId(id) {
  if (!isValidStandardId(id)) {
    throw new Error(
      `기준 id는 소문자·숫자·하이픈 1~64자여야 합니다: ${JSON.stringify(id)}`
    );
  }
  return id;
}

/**
 * Read a STANDARD.md only when its complete content fits the byte budget.
 * Reading one byte past the limit lets us distinguish an exactly-at-limit
 * file from a truncated oversized file without ever loading the latter.
 */
function readStandardFile(path) {
  let fd;
  try {
    fd = openSync(path, "r");
    const buffer = Buffer.alloc(MAX_STANDARD_FILE_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(fd, buffer, offset, buffer.length - offset, null);
      if (count === 0) break;
      offset += count;
    }
    if (offset > MAX_STANDARD_FILE_BYTES) return null;
    return buffer.subarray(0, offset).toString("utf8");
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* non-fatal */ }
    }
  }
}

function standardsDir(root) {
  return join(root, ".scc", "standards");
}

function standardPath(root, id) {
  return join(standardsDir(root), id, "STANDARD.md");
}

function jsonArray(values) {
  return `[${(values || []).map((v) => JSON.stringify(String(v))).join(", ")}]`;
}

function writeFileAtomic(path, content) {
  const tmp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, path);
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
participants: ${jsonArray(fork.participants)}
checks: ${JSON.stringify(checks)}
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

function existingTitleOf(path) {
  if (!existsSync(path)) return { exists: false, title: null };
  const body = readStandardFile(path);
  if (body === null) return { exists: true, title: null };
  const match = body.match(/^# (.+)$/m);
  return { exists: true, title: match ? match[1].trim() : null };
}

export function writeStandard(root, fork, options = {}) {
  assertValidId(fork.id);
  const path = standardPath(root, fork.id);
  const existing = existingTitleOf(path);
  // A colliding id would otherwise erase a different decision's rejected options,
  // which is the one thing this record exists to preserve. Same title means the
  // caller is updating a record it already owns; a different title means two
  // decisions were handed the same id and one of them is about to disappear.
  // An existing file whose title cannot be safely read is not evidence of
  // ownership, so it is never silently replaced.
  if (existing.exists && (existing.title === null || existing.title !== fork.title)) {
    const existingTitle = existing.title === null ? "확인할 수 없는 기존 기준" : `기존 "${existing.title}"`;
    throw new Error(
      `id "${fork.id}"는 이미 다른 기준에 쓰이고 있습니다: ${existingTitle} / 새 "${fork.title}". id는 결정마다 서로 다르고 의미 있게 지어야 합니다.`
    );
  }
  mkdirSync(join(standardsDir(root), fork.id), { recursive: true });
  writeFileAtomic(path, renderStandard(fork, options));
  return path;
}

function frontmatterOf(body) {
  const match = body.match(/^---\n([\s\S]*?)\n---\n/);
  return match ? match[1] : "";
}

function readField(frontmatter, field) {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function parseJsonField(frontmatter, field) {
  const raw = readField(frontmatter, field);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonScalar(frontmatter, field, fallback) {
  const raw = readField(frontmatter, field);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function listActiveStandards(root) {
  const dir = standardsDir(root);
  if (!existsSync(dir)) return [];
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isValidStandardId(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_STANDARD_ENTRIES);
  for (const entry of entries) {
    const path = standardPath(root, entry.name);
    if (!existsSync(path)) continue;
    const body = readStandardFile(path);
    if (body === null) {
      // One unreadable record (STANDARD.md exists as a directory, a permission
      // error, an oversized file, ...) must not silence every other standard.
      continue;
    }
    const frontmatter = frontmatterOf(body);
    if (readField(frontmatter, "status") !== "active") continue;
    const id = readField(frontmatter, "id") || entry.name;
    // The directory is the storage identity. A malformed or mismatched
    // frontmatter id must not make a record appear under another identity.
    if (!isValidStandardId(id) || id !== entry.name) continue;
    const title = body.match(/^# (.+)$/m);
    out.push({
      id,
      title: title ? title[1].trim() : entry.name,
      review_when: parseJsonScalar(frontmatter, "review_when", ""),
      triggers: parseJsonField(frontmatter, "triggers"),
      // Who helped settle this fork. They are barred from reviewing the work it
      // governs -- a verdict from an author is a self-review wearing a reviewer's
      // name.
      participants: parseJsonField(frontmatter, "participants"),
      checks: parseJsonField(frontmatter, "checks"),
      enforcement: readField(frontmatter, "enforcement") || "none",
      path,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function supersedeStandard(root, id) {
  assertValidId(id);
  const path = standardPath(root, id);
  if (!existsSync(path)) return false;
  const body = readStandardFile(path);
  if (body === null) return false;
  const match = body.match(/^(---\n)([\s\S]*?)(\n---\n)/);
  if (!match) return false;
  const updated = match[2].replace(/^status:\s*active\s*$/m, "status: superseded");
  if (updated === match[2]) return false;
  const next =
    body.slice(0, match.index) +
    match[1] +
    updated +
    match[3] +
    body.slice(match.index + match[0].length);
  writeFileAtomic(path, next);
  return true;
}

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "fs";
import { join } from "path";

const MEMORY_DIRNAME = "memory";
const MEMORY_MARKDOWN = "PROJECT_MEMORY.md";
const MEMORY_INDEX = "project-memory.json";

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function writeJsonAtomic(filePath, value) {
  const tmp = `${filePath}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, filePath);
}

export function getProjectMemoryPaths(dataDir) {
  const memoryDir = join(dataDir, MEMORY_DIRNAME);
  return {
    memoryDir,
    markdownPath: join(memoryDir, MEMORY_MARKDOWN),
    indexPath: join(memoryDir, MEMORY_INDEX),
  };
}

export function readProjectMemorySnapshot(dataDir) {
  const { markdownPath } = getProjectMemoryPaths(dataDir);
  if (!existsSync(markdownPath)) return null;

  const raw = readFileSync(markdownPath, "utf8");
  const words = raw.split(/\s+/);
  if (words.length <= 220) return raw;
  return `${words.slice(0, 220).join(" ")} ...`;
}

export function readProjectMemoryIndex(dataDir) {
  const { indexPath } = getProjectMemoryPaths(dataDir);
  if (!existsSync(indexPath)) {
    return { entries: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(indexPath, "utf8"));
    if (!Array.isArray(parsed.entries)) return { entries: [] };
    return parsed;
  } catch {
    return { entries: [] };
  }
}

function renderProjectMemory(entries) {
  const lines = ["# Project Memory", ""];

  if (entries.length === 0) {
    lines.push("_No project memory recorded yet._");
    return lines.join("\n");
  }

  for (const entry of entries) {
    const suffix = entry.source ? ` (${entry.source})` : "";
    lines.push(`- **${entry.key}**: ${entry.content}${suffix}`);
  }

  return lines.join("\n");
}

export function upsertProjectMemoryEntry(dataDir, { key, content, source = "", tags = [] }) {
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("key must be a non-empty string");
  }
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("content must be a non-empty string");
  }

  const normalizedKey = key.trim();
  const normalizedTags = Array.isArray(tags)
    ? tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
    : [];

  const { memoryDir, markdownPath, indexPath } = getProjectMemoryPaths(dataDir);
  ensureDir(memoryDir);

  const index = readProjectMemoryIndex(dataDir);
  const now = new Date().toISOString();
  const existing = index.entries.find((entry) => entry.key === normalizedKey);

  if (existing) {
    existing.content = content.trim();
    existing.source = source.trim();
    existing.tags = normalizedTags;
    existing.updated_at = now;
  } else {
    index.entries.push({
      key: normalizedKey,
      content: content.trim(),
      source: source.trim(),
      tags: normalizedTags,
      updated_at: now,
    });
  }

  index.entries.sort((a, b) => a.key.localeCompare(b.key));
  writeJsonAtomic(indexPath, index);
  writeFileSync(markdownPath, renderProjectMemory(index.entries), "utf8");

  return {
    entries: index.entries,
    markdown: renderProjectMemory(index.entries),
  };
}

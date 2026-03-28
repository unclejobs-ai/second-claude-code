/**
 * Project memory get/upsert handlers.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  readProjectMemoryIndex,
  readProjectMemorySnapshot,
  upsertProjectMemoryEntry,
} from "../../hooks/lib/project-memory.mjs";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/** project_memory_get */
export function handleProjectMemoryGet() {
  return {
    markdown: readProjectMemorySnapshot(DATA_DIR),
    index: readProjectMemoryIndex(DATA_DIR),
  };
}

/** project_memory_upsert */
export function handleProjectMemoryUpsert({ key, content, source = "", tags = [] }) {
  return upsertProjectMemoryEntry(DATA_DIR, { key, content, source, tags });
}

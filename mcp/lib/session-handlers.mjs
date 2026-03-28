/**
 * Session recall search handler.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { searchSessionRecall } from "../../hooks/lib/companion-daemon.mjs";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/** session_recall_search */
export function handleSessionRecallSearch({ query, limit = 5 }) {
  return searchSessionRecall(DATA_DIR, { query, limit });
}

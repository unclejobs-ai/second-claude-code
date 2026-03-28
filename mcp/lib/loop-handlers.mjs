/**
 * Loop handler — list run IDs.
 *
 * This is a thin wrapper; the actual logic lives in event-log.mjs.
 * Exposed here so the MCP server has a symmetric module for loop-related tools.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { listRunIds } from "../../hooks/lib/event-log.mjs";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/** List all known PDCA run IDs from the event log directory. */
export function handleListRunIds() {
  return listRunIds(DATA_DIR);
}

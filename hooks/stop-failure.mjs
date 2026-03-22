#!/usr/bin/env node

/**
 * StopFailure Hook — PDCA Crash Recovery
 *
 * Fires when Claude Code terminates with an API error or rate limit.
 * Reads the current PDCA active state and writes a crash-recovery snapshot
 * so the next session can detect it and offer to resume.
 *
 * Exit 0 always — this hook must never block or error out visibly.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, copyFileSync } from "fs";
import { readJsonSafe, writeJsonAtomic } from "./lib/utils.mjs";
import { logEvent } from "./lib/event-log.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");
const ACTIVE_FILE = join(STATE_DIR, "pdca-active.json");
const RECOVERY_FILE = join(STATE_DIR, "pdca-crash-recovery.json");

function main() {
  try {
    const active = readJsonSafe(ACTIVE_FILE);
    if (!active) {
      // No active PDCA run — nothing to save
      process.exit(0);
    }

    const crashedAt = new Date().toISOString();

    // Build recovery snapshot: copy of active state + crash metadata
    const recovery = {
      ...active,
      crashed_at: crashedAt,
      recovery_source: "stop_failure_hook",
    };

    writeJsonAtomic(RECOVERY_FILE, recovery);

    // Log error event to the run's event log
    try {
      logEvent(DATA_DIR, active.run_id, {
        type: "error",
        phase: active.current_phase,
        action: "stop_failure",
        data: {
          crashed_at: crashedAt,
          current_phase: active.current_phase,
          cycle_count: active.cycle_count,
          recovery_file: RECOVERY_FILE,
        },
      });
    } catch {
      // Event log failure must not prevent recovery file write
    }
  } catch {
    // Silently swallow all errors — this hook must never surface to the user
  }

  process.exit(0);
}

main();

/**
 * Daemon status, schedule, jobs, background runs, notifications handlers.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createBackgroundRun,
  listBackgroundRuns,
  listDaemonJobs,
  queueDaemonNotification,
  readDaemonStatus,
  upsertDaemonJob,
} from "../../hooks/lib/companion-daemon.mjs";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/** daemon_get_status */
export function handleDaemonGetStatus() {
  return readDaemonStatus(DATA_DIR);
}

/** daemon_schedule_workflow */
export function handleDaemonScheduleWorkflow(input) {
  return upsertDaemonJob(DATA_DIR, input);
}

/** daemon_list_jobs */
export function handleDaemonListJobs() {
  return listDaemonJobs(DATA_DIR);
}

/** daemon_start_background_run */
export function handleDaemonStartBackgroundRun(input) {
  return createBackgroundRun(DATA_DIR, input);
}

/** daemon_list_background_runs */
export function handleDaemonListBackgroundRuns() {
  return listBackgroundRuns(DATA_DIR);
}

/** daemon_queue_notification */
export function handleDaemonQueueNotification(input) {
  return queueDaemonNotification(DATA_DIR, input);
}

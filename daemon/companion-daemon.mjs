#!/usr/bin/env node

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  appendRecallEntry,
  createBackgroundRun,
  listBackgroundRuns,
  listDaemonJobs,
  queueDaemonNotification,
  readDaemonStatus,
  searchSessionRecall,
  updateBackgroundRun,
  upsertDaemonJob,
  writeDaemonHeartbeat,
} from "../hooks/lib/companion-daemon.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");

function parseJsonArg(raw, label) {
  if (!raw) {
    throw new Error(`${label} JSON argument is required`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${label} must be valid JSON: ${err.message}`);
  }
}

function output(result) {
  console.log(JSON.stringify(result, null, 2));
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node daemon/companion-daemon.mjs status",
      "  node daemon/companion-daemon.mjs heartbeat [json-overrides]",
      "  node daemon/companion-daemon.mjs schedule-job '<json>'",
      "  node daemon/companion-daemon.mjs list-jobs",
      "  node daemon/companion-daemon.mjs start-run '<json>'",
      "  node daemon/companion-daemon.mjs list-runs",
      "  node daemon/companion-daemon.mjs update-run <run-id> '<json>'",
      "  node daemon/companion-daemon.mjs queue-notification '<json>'",
      "  node daemon/companion-daemon.mjs index-session '<json>'",
      "  node daemon/companion-daemon.mjs search-recall <query> [limit]",
    ].join("\n")
  );
}

function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "status":
      output(readDaemonStatus(DATA_DIR));
      return;
    case "heartbeat":
      output(writeDaemonHeartbeat(DATA_DIR, args[0] ? parseJsonArg(args[0], "heartbeat") : {}));
      return;
    case "schedule-job":
      output(upsertDaemonJob(DATA_DIR, parseJsonArg(args[0], "job")));
      return;
    case "list-jobs":
      output(listDaemonJobs(DATA_DIR));
      return;
    case "start-run":
      output(createBackgroundRun(DATA_DIR, parseJsonArg(args[0], "run")));
      return;
    case "list-runs":
      output(listBackgroundRuns(DATA_DIR));
      return;
    case "update-run":
      output(updateBackgroundRun(DATA_DIR, args[0], parseJsonArg(args[1], "patch")));
      return;
    case "queue-notification":
      output(queueDaemonNotification(DATA_DIR, parseJsonArg(args[0], "notification")));
      return;
    case "index-session":
      output(appendRecallEntry(DATA_DIR, parseJsonArg(args[0], "session index entry")));
      return;
    case "search-recall":
      output(searchSessionRecall(DATA_DIR, {
        query: args[0] || "",
        limit: args[1] ? Number(args[1]) : 5,
      }));
      return;
    default:
      usage();
      process.exit(1);
  }
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

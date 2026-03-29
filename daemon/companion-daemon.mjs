#!/usr/bin/env node

import { rmSync } from "fs";
import http from "http";
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
const DEFAULT_HOST = "127.0.0.1";

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
      "  node daemon/companion-daemon.mjs serve [port-or-socket-path]",
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

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function createHealthServer() {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      sendJson(res, 200, { status: "ok", uptime: process.uptime() });
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  });
}

function parseServeTarget(raw) {
  if (!raw) {
    return { host: DEFAULT_HOST, port: 0 };
  }

  if (/^\d+$/.test(raw)) {
    return { host: DEFAULT_HOST, port: Number(raw) };
  }

  return { socketPath: raw };
}

function serveHealthz(targetArg) {
  const target = parseServeTarget(targetArg);
  const server = createHealthServer();
  let cleanedUp = false;

  function cleanupSocket() {
    if (!target.socketPath || cleanedUp) return;
    cleanedUp = true;
    rmSync(target.socketPath, { force: true });
  }

  function shutdown(code = 0) {
    server.close(() => {
      cleanupSocket();
      process.exit(code);
    });
  }

  server.once("error", (err) => {
    cleanupSocket();
    console.error(err.message);
    process.exit(1);
  });

  process.once("SIGINT", () => shutdown(0));
  process.once("SIGTERM", () => shutdown(0));
  process.once("exit", cleanupSocket);

  if (target.socketPath) {
    cleanupSocket();
    server.listen(target.socketPath, () => {
      console.error(`companion daemon listening on socket ${target.socketPath}`);
    });
    return;
  }

  server.listen(target.port, target.host, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : target.port;
    console.error(`companion daemon listening on http://${target.host}:${port}`);
  });
}

function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "serve":
      serveHealthz(args[0]);
      return;
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

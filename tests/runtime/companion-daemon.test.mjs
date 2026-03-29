import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { getDaemonPaths, readDaemonStatus } from "../../hooks/lib/companion-daemon.mjs";

const root = process.cwd();
const daemonPath = path.join(root, "daemon", "companion-daemon.mjs");

function runDaemon(tempDir, ...args) {
  const output = execFileSync(process.execPath, [daemonPath, ...args], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    encoding: "utf8",
  });
  return JSON.parse(output);
}

function requestHealthz(socketPath) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath,
        path: "/healthz",
        method: "GET",
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body,
          });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

async function waitForHealthz(socketPath, child, stderr) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`daemon exited before serving /healthz: ${stderr()}`);
    }

    try {
      const response = await requestHealthz(socketPath);
      if (response.statusCode === 200) {
        return response;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`timed out waiting for /healthz on socket ${socketPath}`);
}

test("companion daemon CLI writes heartbeat and background job state", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-daemon-"));
  const status = runDaemon(tempDir, "heartbeat");
  const job = runDaemon(
    tempDir,
    "schedule-job",
    JSON.stringify({
      name: "Daily Digest",
      workflow_name: "autopilot",
      schedule: { type: "interval", minutes: 60 },
    })
  );
  const run = runDaemon(
    tempDir,
    "start-run",
    JSON.stringify({
      workflow_name: "autopilot",
      trigger: "manual",
    })
  );
  const jobs = runDaemon(tempDir, "list-jobs");
  const runs = runDaemon(tempDir, "list-runs");

  const paths = getDaemonPaths(tempDir);
  assert.equal(status.online, true);
  assert.equal(readDaemonStatus(tempDir).online, true);
  assert.equal(job.name, "Daily Digest");
  assert.equal(job.workflow_name, "autopilot");
  assert.equal(run.workflow_name, "autopilot");
  assert.equal(jobs.jobs.length, 1);
  assert.equal(jobs.jobs[0].id, job.id);
  assert.equal(runs.runs.length, 1);
  assert.equal(runs.runs[0].run_id, run.run_id);
  assert.equal(existsSync(paths.statusPath), true);
  assert.equal(existsSync(path.join(paths.runsDir, `${run.run_id}.json`)), true);
});

test("companion daemon queues notifications and searches recall entries", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-daemon-"));
  runDaemon(tempDir, "heartbeat");
  const notification = runDaemon(
    tempDir,
    "queue-notification",
    JSON.stringify({
      channel: "telegram",
      chat_id: "123",
      event_type: "cycle_complete",
      text: "PDCA approved",
    })
  );
  runDaemon(
    tempDir,
    "index-session",
    JSON.stringify({
      session_id: "sess-1",
      topic: "Hermes adoption",
      workflow_name: "autopilot",
      summary: "Completed autopilot workflow for Hermes adoption",
      tags: ["workflow", "hermes"],
    })
  );
  const recall = runDaemon(tempDir, "search-recall", "Hermes", "5");
  const notificationDir = getDaemonPaths(tempDir).notificationsDir;
  const files = readdirSync(notificationDir);
  const stored = JSON.parse(
    readFileSync(path.join(notificationDir, files[0]), "utf8")
  );

  assert.equal(notification.event_type, "cycle_complete");
  assert.equal(stored.chat_id, "123");
  assert.equal(recall.total, 1);
  assert.match(recall.entries[0].summary, /Hermes adoption/);
});

test("companion daemon rejects path-traversal run identifiers", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-daemon-"));

  assert.throws(
    () =>
      runDaemon(
        tempDir,
        "start-run",
        JSON.stringify({
          run_id: "../../escaped",
          workflow_name: "autopilot",
        })
      ),
    /run_id/i
  );
});

test("companion daemon serves /healthz with status and uptime", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-daemon-"));
  const socketPath = path.join(tempDir, "companion-daemon.sock");
  rmSync(socketPath, { force: true });
  let stderr = "";
  const child = spawn(process.execPath, [daemonPath, "serve", socketPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  try {
    const response = await waitForHealthz(socketPath, child, () => stderr.trim());
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(Object.keys(body).sort(), ["status", "uptime"]);
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptime, "number");
    assert.ok(body.uptime >= 0);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
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

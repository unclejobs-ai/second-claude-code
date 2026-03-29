import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourcePath = path.join(root, "mcp", "lib", "daemon-handlers.mjs");
const sourceUrl = pathToFileURL(sourcePath).href;

function makeTempDir(prefix = "second-claude-daemon-") {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function loadHandlers(dataDir) {
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  return import(`${sourceUrl}?t=${Date.now()}-${Math.random()}`);
}

async function loadStubbedHandlers(dataDir, responses) {
  const sandboxDir = makeTempDir("second-claude-daemon-stub-");
  const stubPath = path.join(sandboxDir, "companion-daemon-stub.mjs");
  const handlerPath = path.join(sandboxDir, "daemon-handlers.mjs");

  const source = readFileSync(sourcePath, "utf8").replace(
    "../../hooks/lib/companion-daemon.mjs",
    "./companion-daemon-stub.mjs"
  );

  const stubSource = `
export const calls = [];
const responses = ${JSON.stringify(responses, null, 2)};

function record(name, args) {
  calls.push({ name, args });
  return responses[name];
}

export function readDaemonStatus(...args) {
  return record("readDaemonStatus", args);
}

export function upsertDaemonJob(...args) {
  return record("upsertDaemonJob", args);
}

export function listDaemonJobs(...args) {
  return record("listDaemonJobs", args);
}

export function createBackgroundRun(...args) {
  return record("createBackgroundRun", args);
}

export function listBackgroundRuns(...args) {
  return record("listBackgroundRuns", args);
}

export function queueDaemonNotification(...args) {
  return record("queueDaemonNotification", args);
}
`;

  writeFileSync(stubPath, stubSource, "utf8");
  writeFileSync(handlerPath, source, "utf8");

  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  const handlers = await import(`${pathToFileURL(handlerPath).href}?t=${Date.now()}-${Math.random()}`);
  const stub = await import(pathToFileURL(stubPath).href);
  return { handlers, stub, sandboxDir };
}

describe("daemon handlers", () => {
  test("handleDaemonGetStatus delegates to readDaemonStatus with the resolved data dir", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "custom-data");
    const response = {
      installed: true,
      online: true,
      state: "online",
      heartbeat_ttl_ms: 120000,
    };

    try {
      const { handlers, stub, sandboxDir } = await loadStubbedHandlers(dataDir, {
        readDaemonStatus: response,
      });

      try {
        assert.deepEqual(handlers.handleDaemonGetStatus(), response);
        assert.deepEqual(stub.calls, [{ name: "readDaemonStatus", args: [dataDir] }]);
      } finally {
        rmSync(sandboxDir, { recursive: true, force: true });
      }
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleDaemonScheduleWorkflow and handleDaemonListJobs delegate to the daemon library", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "custom-data");
    const jobInput = {
      name: "Nightly Digest",
      workflow_name: "weekly-digest",
      schedule: { type: "cron", cron: "0 2 * * *" },
    };
    const scheduledJob = {
      id: "nightly-digest",
      name: "Nightly Digest",
      workflow_name: "weekly-digest",
    };
    const jobsListing = { jobs: [scheduledJob], total: 1 };

    try {
      const { handlers, stub, sandboxDir } = await loadStubbedHandlers(dataDir, {
        upsertDaemonJob: scheduledJob,
        listDaemonJobs: jobsListing,
      });

      try {
        assert.deepEqual(handlers.handleDaemonScheduleWorkflow(jobInput), scheduledJob);
        assert.deepEqual(handlers.handleDaemonListJobs(), jobsListing);
        assert.deepEqual(stub.calls, [
          { name: "upsertDaemonJob", args: [dataDir, jobInput] },
          { name: "listDaemonJobs", args: [dataDir] },
        ]);
      } finally {
        rmSync(sandboxDir, { recursive: true, force: true });
      }
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleDaemonStartBackgroundRun and handleDaemonListBackgroundRuns delegate to the daemon library", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "custom-data");
    const runInput = {
      workflow_name: "weekly-digest",
      trigger: "manual",
      input: { topic: "status" },
    };
    const run = {
      run_id: "run-weekly-digest-123",
      workflow_name: "weekly-digest",
      status: "queued",
    };
    const runsListing = { runs: [run], total: 1 };

    try {
      const { handlers, stub, sandboxDir } = await loadStubbedHandlers(dataDir, {
        createBackgroundRun: run,
        listBackgroundRuns: runsListing,
      });

      try {
        assert.deepEqual(handlers.handleDaemonStartBackgroundRun(runInput), run);
        assert.deepEqual(handlers.handleDaemonListBackgroundRuns(), runsListing);
        assert.deepEqual(stub.calls, [
          { name: "createBackgroundRun", args: [dataDir, runInput] },
          { name: "listBackgroundRuns", args: [dataDir] },
        ]);
      } finally {
        rmSync(sandboxDir, { recursive: true, force: true });
      }
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleDaemonQueueNotification delegates to queueDaemonNotification", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "custom-data");
    const notificationInput = {
      event_type: "workflow_completed",
      text: "Weekly digest finished",
      metadata: { workflow_name: "weekly-digest" },
    };
    const queued = {
      id: "notification-workflow-completed-123",
      event_type: "workflow_completed",
      text: "Weekly digest finished",
      status: "queued",
    };

    try {
      const { handlers, stub, sandboxDir } = await loadStubbedHandlers(dataDir, {
        queueDaemonNotification: queued,
      });

      try {
        assert.deepEqual(handlers.handleDaemonQueueNotification(notificationInput), queued);
        assert.deepEqual(stub.calls, [
          { name: "queueDaemonNotification", args: [dataDir, notificationInput] },
        ]);
      } finally {
        rmSync(sandboxDir, { recursive: true, force: true });
      }
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("daemon handlers handle a missing data dir gracefully with the real daemon library", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "missing-data");

    try {
      const handlers = await loadHandlers(dataDir);

      const status = handlers.handleDaemonGetStatus();
      assert.equal(status.installed, false);
      assert.equal(status.online, false);
      assert.equal(status.state, "absent");
      assert.equal(typeof status.heartbeat_ttl_ms, "number");

      assert.deepEqual(handlers.handleDaemonListJobs(), { jobs: [], total: 0 });
      assert.deepEqual(handlers.handleDaemonListBackgroundRuns(), { runs: [], total: 0 });

      const scheduled = handlers.handleDaemonScheduleWorkflow({
        name: "Nightly Digest",
        workflow_name: "weekly-digest",
      });
      assert.equal(scheduled.id, "nightly-digest");
      assert.equal(scheduled.workflow_name, "weekly-digest");

      const backgroundRun = handlers.handleDaemonStartBackgroundRun({
        workflow_name: "weekly-digest",
        input: { topic: "status" },
      });
      assert.equal(backgroundRun.workflow_name, "weekly-digest");
      assert.equal(backgroundRun.status, "queued");

      const notification = handlers.handleDaemonQueueNotification({
        event_type: "workflow_completed",
        text: "Weekly digest finished",
      });
      assert.equal(notification.event_type, "workflow_completed");
      assert.equal(notification.status, "queued");
      assert.equal(existsSync(path.join(dataDir, "daemon")), true);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

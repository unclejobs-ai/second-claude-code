import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { getDaemonPaths, writeDaemonHeartbeat } from "../../hooks/lib/companion-daemon.mjs";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "session-end.mjs");

test("session end writes recall entries and queues notifications when daemon is online", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-daemon-"));
  const stateDir = path.join(tempDir, "state");

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    path.join(stateDir, "pdca-active.json"),
    JSON.stringify({
      topic: "Hermes adoption",
      current_phase: "act",
      completed: ["plan", "do", "check"],
      check_verdict: "APPROVED",
    })
  );
  writeDaemonHeartbeat(tempDir);

  const result = spawnSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
      CLAUDE_SESSION_ID: "sess-42",
      TELEGRAM_CHAT_ID: "123",
    },
    encoding: "utf8",
  });

  const paths = getDaemonPaths(tempDir);
  const notifications = readdirSync(paths.notificationsDir);
  const recallRaw = readFileSync(paths.recallIndexPath, "utf8");

  assert.equal(result.status, 0);
  assert.equal(existsSync(path.join(tempDir, "HANDOFF.md")), true);
  assert.equal(notifications.length, 1);
  assert.match(recallRaw, /Hermes adoption/);
  assert.match(recallRaw, /sess-42/);

  const queued = JSON.parse(
    readFileSync(path.join(paths.notificationsDir, notifications[0]), "utf8")
  );
  assert.equal(queued.event_type, "cycle_complete");
  assert.match(queued.text, /Topic: Hermes adoption/);
});

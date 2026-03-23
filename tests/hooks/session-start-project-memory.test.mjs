import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { writeDaemonHeartbeat } from "../../hooks/lib/companion-daemon.mjs";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "session-start.mjs");

test("session start injects project memory and daemon status as separate layers", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-project-memory-"));
  const memoryDir = path.join(tempDir, "memory");

  mkdirSync(memoryDir, { recursive: true });
  writeFileSync(
    path.join(memoryDir, "PROJECT_MEMORY.md"),
    [
      "# Project Memory",
      "",
      "- Primary runtime: JavaScript ESM only",
      "- Companion daemon is planned but optional",
    ].join("\n")
  );
  writeDaemonHeartbeat(tempDir);

  const output = execFileSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    encoding: "utf8",
  });

  assert.match(output, /## Project Memory/);
  assert.match(output, /JavaScript ESM only/);
  assert.match(output, /Companion daemon is planned but optional/);
  assert.match(output, /## Companion Daemon/);
  assert.match(output, /scheduler, background runs, notification routing, and session recall are available/i);
});

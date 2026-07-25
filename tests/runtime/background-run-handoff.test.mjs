import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBackgroundRun, backgroundRunCommand } from "../../hooks/lib/companion-daemon.mjs";

test("a queued run carries the command that would execute it", () => {
  // Nothing drains this queue by design — Claude Code's own background agents do the executing,
  // and an in-plugin executor would run outside the conversation where consent for external
  // actions is given. The record is a handoff, so it has to carry the handoff.
  const dir = mkdtempSync(path.join(os.tmpdir(), "scc-bg-"));
  try {
    const run = createBackgroundRun(dir, { workflow_name: "weekly-digest" });

    assert.equal(run.status, "queued");
    assert.equal(run.handoff, 'claude --bg "/scc:workflow run weekly-digest"');

    // The persisted record stays the plain run — handoff is derived, not stored state.
    const saved = JSON.parse(readFileSync(path.join(dir, "daemon", "runs", `${run.run_id}.json`), "utf8"));
    assert.equal(saved.handoff, undefined);
    assert.equal(saved.workflow_name, "weekly-digest");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("workflow names are quoted so a space cannot split the command", () => {
  assert.equal(
    backgroundRunCommand({ workflow_name: "weekly digest" }),
    'claude --bg "/scc:workflow run weekly digest"'
  );
});

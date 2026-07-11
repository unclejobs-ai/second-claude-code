/**
 * Cross-process concurrency guarantee for withFileLockSync.
 *
 * The PDCA MCP handlers and the session-end hook now rely on this lock to make
 * read-modify-write of shared state files safe across concurrent Claude sessions
 * (each a separate OS process). This test spawns real child processes that race
 * on one file and asserts no update is lost.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const mutexUrl = pathToFileURL(path.join(process.cwd(), "hooks", "lib", "file-mutex-sync.mjs")).href;

test("withFileLockSync serializes concurrent cross-process RMW without lost updates", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mutex-"));
  try {
    const target = path.join(dir, "counter.json");
    writeFileSync(target, JSON.stringify({ count: 0 }));

    const WORKERS = 8;
    const INCS = 6;

    // Each worker reads, pauses to widen the race window, then writes back.
    // Without the lock the interleaving would drop updates (count < WORKERS*INCS).
    const childSrc = `
import { readFileSync, writeFileSync } from "node:fs";
import { withFileLockSync } from ${JSON.stringify(mutexUrl)};
const target = process.argv[2];
for (let i = 0; i < ${INCS}; i++) {
  withFileLockSync(target, () => {
    const d = JSON.parse(readFileSync(target, "utf8"));
    d.count += 1;
    const end = Date.now() + 3;
    while (Date.now() < end) { /* hold the critical section briefly */ }
    writeFileSync(target, JSON.stringify(d));
  });
}
`;
    const childPath = path.join(dir, "worker.mjs");
    writeFileSync(childPath, childSrc);

    await Promise.all(
      Array.from({ length: WORKERS }, () =>
        new Promise((resolve, reject) => {
          const c = spawn(process.execPath, [childPath, target], { stdio: "ignore" });
          c.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))));
          c.on("error", reject);
        })
      )
    );

    const final = JSON.parse(readFileSync(target, "utf8"));
    assert.equal(final.count, WORKERS * INCS, "every increment survived — no lost update");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

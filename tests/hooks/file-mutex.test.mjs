import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { withFileLock } from "../../hooks/lib/file-mutex.mjs";

function makeTempFile(content = "0") {
  const dir = mkdtempSync(path.join(os.tmpdir(), "scc-mutex-"));
  const file = path.join(dir, "counter.json");
  writeFileSync(file, content);
  return file;
}

test("withFileLock serializes writes to the same file", async () => {
  const file = makeTempFile("0");
  const results = [];

  // Launch 5 concurrent increments on the SAME file
  const promises = Array.from({ length: 5 }, (_, i) =>
    withFileLock(file, async () => {
      const val = parseInt(readFileSync(file, "utf8"), 10);
      // Simulate async delay to expose race conditions
      await new Promise((r) => setTimeout(r, 10));
      writeFileSync(file, String(val + 1));
      results.push(i);
    })
  );

  await Promise.all(promises);

  const final = parseInt(readFileSync(file, "utf8"), 10);
  assert.equal(final, 5, "All 5 increments should be serialized, not lost");
});

test("withFileLock allows parallel writes to DIFFERENT files", async () => {
  const file1 = makeTempFile("a");
  const file2 = makeTempFile("b");
  const order = [];

  const p1 = withFileLock(file1, async () => {
    order.push("start-1");
    await new Promise((r) => setTimeout(r, 50));
    order.push("end-1");
  });

  const p2 = withFileLock(file2, async () => {
    order.push("start-2");
    await new Promise((r) => setTimeout(r, 10));
    order.push("end-2");
  });

  await Promise.all([p1, p2]);

  // Both should start before either ends (parallel)
  assert.ok(order.indexOf("start-2") < order.indexOf("end-1"),
    "Different files should run in parallel");
});

test("withFileLock returns the function result", async () => {
  const file = makeTempFile("test");
  const result = await withFileLock(file, () => 42);
  assert.equal(result, 42);
});

test("withFileLock propagates errors", async () => {
  const file = makeTempFile("test");
  await assert.rejects(
    () => withFileLock(file, () => { throw new Error("boom"); }),
    { message: "boom" }
  );
});

test("withFileLock releases lock after error", async () => {
  const file = makeTempFile("0");

  // First call throws
  try {
    await withFileLock(file, () => { throw new Error("fail"); });
  } catch {}

  // Second call should succeed (lock released)
  const result = await withFileLock(file, () => {
    writeFileSync(file, "1");
    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(readFileSync(file, "utf8"), "1");
});

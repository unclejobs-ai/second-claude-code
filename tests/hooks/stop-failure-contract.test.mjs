import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("stop-failure never blocks", () => {
  const src = readFileSync(join(process.cwd(), "hooks", "stop-failure.mjs"), "utf8");
  assert.doesNotMatch(src, /process\.exit\(2\)/, "blocking leaked into a hook that must always exit 0");
  assert.doesNotMatch(src, /coachBlockReason/, "block logic must live in session-end, not stop-failure");
});

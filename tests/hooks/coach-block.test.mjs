import test from "node:test";
import assert from "node:assert/strict";

import { coachBlockReason } from "../../hooks/lib/coach-block.mjs";

test("no state means no block", () => {
  assert.equal(coachBlockReason(null), null);
});

test("an interview awaiting approval does not block", () => {
  assert.equal(coachBlockReason({ status: "pending_approval", forks: ["a"] }), null);
});

test("an in-progress interview blocks and counts the settled forks", () => {
  const reason = coachBlockReason({ status: "in_progress", forks: ["a", "b"] });
  assert.ok(reason);
  assert.match(reason, /2/);
  assert.match(reason, /coach/);
});

test("an in-progress interview with no settled forks still blocks", () => {
  assert.ok(coachBlockReason({ status: "in_progress", forks: [] }));
});

test("the reason names the resume command so the block is actionable", () => {
  assert.match(coachBlockReason({ status: "in_progress", forks: [] }), /--resume/);
});

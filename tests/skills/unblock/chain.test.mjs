import test from "node:test";
import assert from "node:assert/strict";
import { runChain } from "../../../skills/unblock/engine/chain.mjs";

test("runChain routes keyword input through Jina Search probe", async (t) => {
  if (process.env.UNBLOCK_SKIP_NETWORK_TESTS === "1") return t.skip("network tests disabled");
  const r = await runChain("just a keyword string");
  // Either succeeds (network reachable) or fails with keyword_search_failed
  if (r.ok) {
    assert.equal(r.phase, "0d");
    assert.ok(r.content);
  } else {
    assert.ok(["keyword_search_failed", "all_phases_exhausted"].includes(r.reason));
  }
});

test("runChain rejects empty input", async () => {
  const r = await runChain("");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "invalid_input");
});

test("runChain returns ok shape with required fields when content is found", async (t) => {
  // This hits Jina Reader — skip if offline / no network.
  if (process.env.UNBLOCK_SKIP_NETWORK_TESTS === "1") return t.skip("network tests disabled");
  const r = await runChain("https://en.wikipedia.org/wiki/Web_scraping", { maxPhase: 1 });
  if (!r.ok) return t.skip(`network unavailable or upstream failure: ${r.reason || "unknown"}`);
  assert.ok(r.phase !== null);
  assert.ok(typeof r.content === "string" && r.content.length > 200);
  assert.ok(Array.isArray(r.trace));
  assert.ok(r.elapsed_ms >= 0);
});

test("runChain refuses Phase 6 without --allow-paid", async () => {
  const r = await runChain("https://no-such-host-zzz-2026-zzzzzzzz.invalid/path", { maxPhase: 6, allowPaid: false });
  assert.equal(r.ok, false);
  const phase6 = r.trace?.find((t) => t.phase === 6);
  assert.ok(phase6 == null || phase6.status === "skipped", "Phase 6 must not run without explicit allowPaid");
});

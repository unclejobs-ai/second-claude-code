import test from "node:test";
import assert from "node:assert/strict";
import { isBlockedStatus, isWafLikelyStatus, detectChallengeBody, detectChallengeHeaders, classify } from "../../../skills/unblock/engine/detect.mjs";

test("isBlockedStatus catches 4xx/5xx", () => {
  assert.equal(isBlockedStatus(403), true);
  assert.equal(isBlockedStatus(429), true);
  assert.equal(isBlockedStatus(503), true);
  assert.equal(isBlockedStatus(200), false);
});

test("isWafLikelyStatus catches Cloudflare 5xx range", () => {
  assert.equal(isWafLikelyStatus(521), true);
  assert.equal(isWafLikelyStatus(525), true);
  assert.equal(isWafLikelyStatus(200), false);
});

test("detectChallengeBody catches Cloudflare-style challenge text", () => {
  const r = detectChallengeBody("Just a moment... cf-browser-verification");
  assert.equal(r.challenge, true);
  assert.ok(r.hits.length >= 2);
});

test("detectChallengeBody returns false for clean body", () => {
  const r = detectChallengeBody("<html><body><h1>Welcome to my blog</h1></body></html>");
  assert.equal(r.challenge, false);
});

test("detectChallengeHeaders flags WAF-vendor headers", () => {
  const r = detectChallengeHeaders({ "Server": "cloudflare", "Cf-Ray": "abc123" });
  assert.ok(r.wafSignals.includes("server"));
  assert.ok(r.wafSignals.includes("cf-ray"));
});

test("classify combines status + body + headers", () => {
  const r = classify({
    status: 403,
    headers: { server: "cloudflare" },
    body: "Just a moment...",
  });
  assert.equal(r.blocked, true);
  assert.equal(r.wafLikely, true);
  assert.equal(r.challengeBody, true);
});

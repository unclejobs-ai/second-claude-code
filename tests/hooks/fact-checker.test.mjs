import test from "node:test";
import assert from "node:assert/strict";
import { extractClaims, verifyClaims } from "../../hooks/lib/fact-checker.mjs";

test("extractClaims finds percentage improvements", () => {
  const claims = extractClaims("Achieved 30% improvement in build speed");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].value, 30);
  assert.equal(claims[0].unit, "%");
});

test("extractClaims finds duration reductions", () => {
  const claims = extractClaims("Reduced latency by 150ms faster response");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].value, 150);
  assert.equal(claims[0].unit, "ms");
});

test("extractClaims finds score values", () => {
  const claims = extractClaims("Review score: 0.85 and gate score=92");
  assert.equal(claims.length, 2);
  assert.equal(claims[0].value, 0.85);
  assert.equal(claims[1].value, 92);
});

test("extractClaims finds test counts", () => {
  const claims = extractClaims("Now at 242 tests passing with 0 failing");
  assert.ok(claims.length >= 1);
  const testClaim = claims.find((c) => c.value === 242);
  assert.ok(testClaim);
});

test("extractClaims returns empty for no claims", () => {
  assert.deepEqual(extractClaims("No numeric claims here"), []);
  assert.deepEqual(extractClaims(""), []);
  assert.deepEqual(extractClaims(null), []);
});

test("verifyClaims matches claims to metrics within tolerance", () => {
  const claims = [{ value: 30, unit: "%", context: "30% improvement" }];
  const metrics = { improvement_pct: 29.5, build_time_ms: 1200 };
  const result = verifyClaims(claims, metrics, { tolerance: 0.1 });

  assert.equal(result.verified.length, 1);
  assert.equal(result.unverified.length, 0);
  assert.equal(result.verified[0].matched_metric, "improvement_pct");
});

test("verifyClaims flags unverified claims", () => {
  const claims = [{ value: 99, unit: "%", context: "99% improvement" }];
  const metrics = { score: 0.5, time_ms: 3000 }; // 99 is far from both 0.5 and 3000
  const result = verifyClaims(claims, metrics);

  assert.equal(result.verified.length, 0);
  assert.equal(result.unverified.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Unverified claim/);
});

test("verifyClaims handles missing metrics gracefully", () => {
  const claims = [{ value: 50, unit: "%", context: "50% faster" }];
  const result = verifyClaims(claims, null);

  assert.equal(result.unverified.length, 1);
  assert.equal(result.warnings.length, 1);
});

test("verifyClaims handles nested metrics", () => {
  const claims = [{ value: 0.85, unit: "", context: "score: 0.85" }];
  const metrics = {
    review: { average_score: 0.85, reviewer_count: 3 },
    timing: { elapsed_ms: 5000 },
  };
  const result = verifyClaims(claims, metrics);

  assert.equal(result.verified.length, 1);
  assert.equal(result.verified[0].matched_metric, "review.average_score");
});

test("verifyClaims with zero claims returns clean result", () => {
  const result = verifyClaims([], { score: 100 });
  assert.equal(result.verified.length, 0);
  assert.equal(result.unverified.length, 0);
  assert.equal(result.warnings.length, 0);
});

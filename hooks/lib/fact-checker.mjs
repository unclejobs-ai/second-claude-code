/**
 * Fact Checker — Anti-Fabrication Layer
 *
 * Inspired by AutoResearchClaw's VerifiedRegistry + paper_verifier.
 * Extracts numeric claims from text and cross-references them against
 * actual test/benchmark results in metrics.json.
 *
 * Used during the Check phase to verify that performance claims in
 * PR descriptions, commit messages, or review summaries match reality.
 */

/**
 * Extract numeric claims from text.
 * Matches patterns like "30% improvement", "reduced by 50ms", "score: 0.85"
 *
 * @param {string} text
 * @returns {Array<{ value: number, unit: string, context: string }>}
 */
export function extractClaims(text) {
  if (!text || typeof text !== "string") return [];

  const patterns = [
    // "30% improvement" / "improved by 30%"
    /(\d+(?:\.\d+)?)\s*%\s*(?:improvement|faster|slower|reduction|increase|decrease)/gi,
    // "reduced by 50ms" / "50ms faster"
    /(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds|minutes|min|MB|KB|GB)\s*(?:faster|slower|less|more|reduction)/gi,
    // "score: 0.85" / "score of 0.85" / "score=0.85"
    /score\s*[:=]\s*(\d+(?:\.\d+)?)/gi,
    // "from X to Y" (captures Y as the claimed new value)
    /from\s+\d+(?:\.\d+)?\s*(?:to|→)\s+(\d+(?:\.\d+)?)/gi,
    // "N tests" / "N passing"
    /(\d+)\s*(?:tests?|passing|failing)/gi,
  ];

  const claims = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      if (isNaN(value)) continue;

      // Extract surrounding context (30 chars each side)
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      const context = text.slice(start, end).replace(/\n/g, " ").trim();

      claims.push({
        value,
        unit: match[2] || (match[0].includes("%") ? "%" : ""),
        context,
      });
    }
  }

  return claims;
}

/**
 * Verify claims against actual metrics.
 *
 * @param {Array<{ value: number, unit: string, context: string }>} claims
 * @param {object} metrics - Actual metrics from metrics.json or test results
 * @param {{ tolerance?: number }} [options]
 * @returns {{ verified: Array, unverified: Array, warnings: string[] }}
 */
export function verifyClaims(claims, metrics, options = {}) {
  const tolerance = options.tolerance ?? 0.1; // 10% tolerance by default
  const verified = [];
  const unverified = [];
  const warnings = [];

  if (!metrics || typeof metrics !== "object") {
    return {
      verified: [],
      unverified: claims,
      warnings: claims.length > 0 ? ["No metrics available to verify claims against"] : [],
    };
  }

  const metricValues = flattenMetrics(metrics);

  for (const claim of claims) {
    const match = metricValues.find((m) => {
      const diff = Math.abs(m.value - claim.value);
      const maxDiff = Math.abs(claim.value) * tolerance;
      return diff <= Math.max(maxDiff, 0.01); // absolute tolerance for small numbers
    });

    if (match) {
      verified.push({ ...claim, matched_metric: match.key, actual_value: match.value });
    } else {
      unverified.push(claim);
      warnings.push(
        `Unverified claim: "${claim.context}" (${claim.value}${claim.unit}) — no matching metric found`
      );
    }
  }

  return { verified, unverified, warnings };
}

/**
 * Flatten a nested metrics object into { key, value } pairs.
 * @param {object} obj
 * @param {string} [prefix=""]
 * @returns {Array<{ key: string, value: number }>}
 */
function flattenMetrics(obj, prefix = "") {
  const result = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "number" && !isNaN(val)) {
      result.push({ key: fullKey, value: val });
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      result.push(...flattenMetrics(val, fullKey));
    }
  }
  return result;
}

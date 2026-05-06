import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = JSON.parse(readFileSync(join(HERE, "profiles.json"), "utf8"));

const CHALLENGE_PATTERNS = PROFILES.challenges.patterns.map((p) => p.toLowerCase());

const STATUS_BLOCKED = new Set([401, 402, 403, 405, 406, 407, 410, 418, 421, 423, 425, 429, 430, 451, 503]);
const STATUS_WAF_LIKELY = new Set([403, 429, 503, 520, 521, 522, 523, 524, 525, 526]);

const CHALLENGE_HEADER_HINTS = [
  ["server", /cloudflare|akamai|imperva|incapsula|sucuri|stackpath/i],
  ["x-amz-cf-id", /./],
  ["cf-ray", /./],
  ["x-akamai-transformed", /./],
  ["x-iinfo", /./],
  ["x-sucuri-id", /./],
  ["set-cookie", /__cf_bm|__cflb|incap_ses|visid_incap|akm_/i],
];

export function isBlockedStatus(status) {
  return STATUS_BLOCKED.has(status) || (status >= 400 && status < 600);
}

export function isWafLikelyStatus(status) {
  return STATUS_WAF_LIKELY.has(status);
}

export function detectChallengeBody(body) {
  if (!body || typeof body !== "string") return { challenge: false, hits: [] };
  const lower = body.slice(0, 8192).toLowerCase();
  const hits = [];
  for (const pattern of CHALLENGE_PATTERNS) {
    if (lower.includes(pattern)) hits.push(pattern);
  }
  return { challenge: hits.length > 0, hits };
}

export function detectChallengeHeaders(headers) {
  if (!headers) return { wafSignals: [] };
  const lc = lowercaseHeaders(headers);
  const signals = [];
  for (const [name, re] of CHALLENGE_HEADER_HINTS) {
    const v = lc[name];
    if (typeof v === "string" && re.test(v)) signals.push(name);
  }
  return { wafSignals: signals };
}

export function classify(response) {
  const { status, headers, body } = response || {};
  const bodyCheck = detectChallengeBody(body);
  const headerCheck = detectChallengeHeaders(headers);
  return {
    status,
    blocked: isBlockedStatus(status),
    wafLikely: isWafLikelyStatus(status) || bodyCheck.challenge || headerCheck.wafSignals.length > 0,
    challengeBody: bodyCheck.challenge,
    challengeHits: bodyCheck.hits,
    wafSignals: headerCheck.wafSignals,
  };
}

function lowercaseHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k.toLowerCase()] = Array.isArray(v) ? v.join("; ") : String(v);
  }
  return out;
}

// Orchestrator — picks phase order, races cheap probes, applies signal-driven skip rules.
// Lives separately from chain.mjs so the "what to run next" decision is testable in isolation.

const VIDEO_HINT_RE = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|twitch\.tv|dailymotion\.com|soundcloud\.com|bilibili\.com|nicovideo\.jp|chzzk\.naver\.com|afreecatv\.com)/i;

const PUBLIC_API_HINT_RE = /(reddit\.com\/r\/[^/]+\/comments|news\.ycombinator\.com\/item|arxiv\.org\/abs|bsky\.app\/profile|github\.com\/[^/]+\/[^/]+|npmjs\.com\/package|wikipedia\.org\/wiki|stackoverflow\.com\/questions|stackexchange\.com\/questions|serverfault\.com\/questions|superuser\.com\/questions|askubuntu\.com\/questions|mathoverflow\.net\/questions|\/api\/v1\/statuses\/\d+|\/post\/\d+)/i;

export function urlPriors(rawUrl) {
  return {
    isVideo: VIDEO_HINT_RE.test(rawUrl),
    isPublicApi: PUBLIC_API_HINT_RE.test(rawUrl),
  };
}

// Decide which Phase 0 sub-probes to try and in what order.
// Returns array of phase IDs from {"0a", "0b", "0c"}.
export function phase0Order(rawUrl) {
  const p = urlPriors(rawUrl);
  if (p.isVideo) return ["0c", "0a", "0b"];
  if (p.isPublicApi) return ["0a", "0b", "0c"];
  return ["0a", "0b", "0c"];
}

// After a probe runs, decide which downstream phases should be SKIPPED outright.
// Returns Set<phaseId>. Each call only adds skip rules; never removes them.
export function deriveSkips(probeResult, currentSkips = new Set()) {
  const skips = new Set(currentSkips);
  if (!probeResult || probeResult.status !== "fail") return skips;

  // Heuristic: Phase 1 returned 2xx but stripped_too_short → likely a JS-rendered SPA shell.
  // No amount of header rotation or TLS spoof helps. Skip 2 and 3, jump to Playwright.
  if (probeResult.phase === 1 && Array.isArray(probeResult.reasons)) {
    const has2xxButShort = probeResult.attempts?.some((a) => a.status >= 200 && a.status < 300)
      && probeResult.reasons.includes("stripped_too_short");
    if (has2xxButShort) {
      skips.add(2);
      skips.add(3);
    }
  }

  // Heuristic: Phase 2 returned 200 with challenge_body → WAF-rendered interstitial.
  // curl-impersonate already lost; LightPanda's headless probably will too.
  // Jump straight to Phase 4 (real Chrome).
  if (probeResult.phase === 2 && Array.isArray(probeResult.reasons) && probeResult.reasons.includes("challenge_body")) {
    skips.add(3);
  }

  // Heuristic: Phase 3 (LightPanda) failed with stripped_too_short → still SPA-rendered.
  // Phase 4 (real Chrome) is the only remaining hope; archive is a separate concern.
  // No skip needed — chain naturally proceeds.

  return skips;
}

// Single-phase decision audit log entry.
export function explain(phaseId, action, reason) {
  return { phase: phaseId, action, reason };
}

// Stagnation detection: if the same fail reason dominates across phases,
// declare a terminal pattern and short-circuit the chain to archive.
// Returns { stagnant: boolean, dominantReason?: string, occurrences?: number }.
export function detectStagnation(trace, threshold = 3) {
  const counts = new Map();
  for (const entry of trace) {
    if (entry.status !== "fail" || !Array.isArray(entry.reasons)) continue;
    for (const r of entry.reasons) {
      counts.set(r, (counts.get(r) || 0) + 1);
    }
  }
  let dominant = null;
  for (const [reason, count] of counts) {
    if (count >= threshold && (!dominant || count > dominant.count)) {
      dominant = { reason, count };
    }
  }
  if (!dominant) return { stagnant: false };
  return { stagnant: true, dominantReason: dominant.reason, occurrences: dominant.count };
}

// Compute a stable idempotency key for a chain call.
// Allows callers to dedupe across re-invocations during a session.
export function idempotencyKey(url, opts = {}) {
  const stable = {
    url,
    maxPhase: opts.maxPhase ?? null,
    allowPaid: Boolean(opts.allowPaid),
    device: opts.device ?? null,
    selector: opts.selector ?? null,
    follow: Boolean(opts.followFirstResult),
  };
  const str = JSON.stringify(stable);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

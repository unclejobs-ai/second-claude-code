import { probePublicApi } from "./probes/public-api.mjs";
import { probeJinaReader } from "./probes/jina.mjs";
import { probeYtDlp } from "./probes/yt-dlp.mjs";
import { probeCurlVariants } from "./probes/curl.mjs";
import { probeImpersonate } from "./probes/impersonate.mjs";
import { probeLightpanda } from "./probes/lightpanda.mjs";
import { probePlaywright } from "./probes/playwright.mjs";
import { probeArchive } from "./probes/archive.mjs";
import { probePaidApi } from "./probes/paid-api.mjs";
import { probeKeyword } from "./probes/keyword.mjs";
import { classifyIntent } from "./intent.mjs";
import { phase0Order, deriveSkips, explain, detectStagnation, idempotencyKey } from "./orchestrator.mjs";
import { assertPublicUrl } from "./util.mjs";

const TRACE_SCHEMA_VERSION = 1;

const DEFAULT_MAX_PHASE = Number(process.env.UNBLOCK_MAX_PHASE ?? 5);

const PHASES = [
  { id: "0a", numeric: 0, label: "public-api",    tier: "free", needsBinary: false, run: probePublicApi },
  { id: "0b", numeric: 0, label: "jina-reader",   tier: "free", needsBinary: false, run: probeJinaReader },
  { id: "0c", numeric: 0, label: "yt-dlp",        tier: "free", needsBinary: true,  run: probeYtDlp },
  { id: 1,    numeric: 1, label: "curl-variants", tier: "free", needsBinary: false, run: probeCurlVariants },
  { id: 2,    numeric: 2, label: "impersonate",   tier: "free", needsBinary: true,  run: probeImpersonate },
  { id: 3,    numeric: 3, label: "lightpanda",    tier: "free", needsBinary: true,  run: probeLightpanda },
  { id: 4,    numeric: 4, label: "playwright",    tier: "free", needsBinary: true,  run: probePlaywright },
  { id: 5,    numeric: 5, label: "archive",       tier: "free", needsBinary: false, run: probeArchive },
  { id: 6,    numeric: 6, label: "paid-api",      tier: "paid", needsBinary: false, run: probePaidApi },
];

export async function runChain(input, opts = {}) {
  const intent = classifyIntent(input);
  if (intent.kind === "invalid") {
    return {
      ok: false, url: input, phase: null, probe: null, elapsed_ms: 0,
      reason: "invalid_input", trace: [],
    };
  }
  if (intent.kind === "keyword") {
    return runKeywordChain(intent.query, opts);
  }

  const guard = assertPublicUrl(intent.url);
  if (!guard.ok) {
    return finalize({
      ok: false, url: intent.url, phase: null, probe: null, elapsed_ms: 0,
      reason: `ssrf_guard:${guard.reason}`, trace: [], decisions: [],
    }, { url: intent.url, opts });
  }

  const maxPhase = opts.maxPhase ?? DEFAULT_MAX_PHASE;
  const allowPaid = Boolean(opts.allowPaid);
  const start = Date.now();
  const trace = [];
  const decisions = [];
  let lastPartial = null;

  // Reorder Phase 0 sub-probes based on URL host priors.
  const order0 = phase0Order(intent.url);
  const phaseById = Object.fromEntries(PHASES.map((p) => [String(p.id), p]));
  const reorderedPhases = [
    ...order0.map((id) => phaseById[id]).filter(Boolean),
    ...PHASES.filter((p) => !order0.includes(String(p.id))),
  ];
  if (order0.join(",") !== "0a,0b,0c") {
    decisions.push(explain("0", "reorder", `phase0_order=${order0.join(",")}`));
  }

  let dynamicSkips = new Set();

  for (const phase of reorderedPhases) {
    if (!phaseInRange(phase, maxPhase, allowPaid)) {
      trace.push({ phase: phase.id, probe: phase.label, status: "skipped", reason: "out_of_range" });
      continue;
    }
    if (dynamicSkips.has(phase.id)) {
      trace.push({ phase: phase.id, probe: phase.label, status: "skipped", reason: "orchestrator_signal_skip" });
      continue;
    }
    let result;
    try {
      result = await phase.run(intent.url, { ...opts, allowPaid });
    } catch (err) {
      result = {
        phase: phase.id,
        probe: phase.label,
        status: "fail",
        ok: false,
        error: String(err?.message || err),
        elapsed_ms: 0,
      };
    }
    trace.push(slimTrace(result));
    const newSkips = deriveSkips(result, dynamicSkips);
    if (newSkips.size > dynamicSkips.size) {
      for (const s of newSkips) {
        if (!dynamicSkips.has(s)) decisions.push(explain(phase.id, "skip", `derive_skip(${s})`));
      }
      dynamicSkips = newSkips;
    }
    // Stagnation detection: same fail reason across 3+ phases → jump straight to archive (Phase 5)
    const stag = detectStagnation(trace);
    if (stag.stagnant && phase.numeric < 5) {
      decisions.push(explain(phase.id, "stagnation", `${stag.dominantReason}_x${stag.occurrences}`));
      for (let p = phase.numeric + 1; p < 5; p++) dynamicSkips.add(p);
    }
    if (result.status === "ok" && result.content) {
      return finalize({
        ok: true, url: intent.url, phase: phase.id, probe: result.probe,
        elapsed_ms: Date.now() - start,
        content: result.content, title: result.title || "", meta: result.meta || {},
        trace, decisions,
      }, { url: intent.url, opts });
    }
    if (result.meta?.partial && result.content) lastPartial = { phase: phase.id, result };
  }

  if (lastPartial) {
    return finalize({
      ok: false, url: intent.url, phase: lastPartial.phase, probe: lastPartial.result.probe,
      elapsed_ms: Date.now() - start,
      content: lastPartial.result.content,
      title: lastPartial.result.title || "",
      meta: { ...(lastPartial.result.meta || {}), partial: true },
      trace, decisions,
    }, { url: intent.url, opts });
  }

  return finalize({
    ok: false, url: intent.url,
    phase: trace[trace.length - 1]?.phase ?? null,
    probe: null, elapsed_ms: Date.now() - start,
    trace, decisions, reason: "all_phases_exhausted",
  }, { url: intent.url, opts });
}

function finalize(envelope, identity) {
  return {
    schema_version: TRACE_SCHEMA_VERSION,
    ...envelope,
    idempotency_key: idempotencyKey(identity.url, identity.opts),
  };
}

async function runKeywordChain(query, opts) {
  const start = Date.now();
  const trace = [];
  const search = await probeKeyword(query, opts);
  trace.push(slimTrace(search));
  if (!search.ok) {
    return finalize({
      ok: false, url: query, phase: search.phase, probe: search.probe,
      elapsed_ms: Date.now() - start, trace, decisions: [], reason: "keyword_search_failed",
    }, { url: query, opts });
  }
  if (opts.followFirstResult && search.meta?.result_urls?.[0]) {
    const top = search.meta.result_urls[0];
    const followed = await runChain(top, { ...opts, followFirstResult: false });
    return finalize({
      ok: followed.ok,
      url: top,
      phase: followed.phase,
      probe: followed.probe,
      elapsed_ms: Date.now() - start,
      content: followed.ok ? followed.content : search.content,
      title: followed.title || search.title,
      meta: { ...(followed.meta || {}), keyword_query: query, search_results: search.meta?.result_urls },
      trace: [...trace, ...(followed.trace || [])],
      decisions: followed.decisions || [],
    }, { url: top, opts });
  }
  return finalize({
    ok: true, url: query, phase: search.phase, probe: search.probe,
    elapsed_ms: Date.now() - start,
    content: search.content, title: search.title, meta: search.meta,
    trace, decisions: [],
  }, { url: query, opts });
}

function phaseInRange(phase, maxPhase, allowPaid) {
  if (phase.tier === "paid" && !allowPaid) return false;
  return phase.numeric <= Number(maxPhase);
}

function slimTrace(r) {
  return {
    phase: r.phase,
    probe: r.probe,
    status: r.status,
    code: r.code,
    elapsed_ms: r.elapsed_ms,
    reason: r.reason,
    reasons: r.reasons,
    error: typeof r.error === "string" ? r.error.slice(0, 240) : r.error,
    attempts: r.attempts,
    sub_trace: r.trace,
  };
}

import { fetchText, fetchJson, makeOk, makeFail, makeSkipped } from "../util.mjs";
import { validateJson } from "../validate.mjs";

const TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;

export async function probeKeyword(query, opts = {}) {
  const start = Date.now();
  const phase = "0d";
  const probe = "jina-search";
  if (!query || typeof query !== "string") {
    return makeSkipped({ phase, probe, reason: "no_query", start });
  }
  const apiKey = process.env.JINA_API_KEY;
  const headers = { accept: "application/json", "x-retain-images": "none" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const body = JSON.stringify({ q: query, num: opts.num || 5 });
  let res;
  try {
    const r = await fetch("https://s.jina.ai/", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    res = { status: r.status, headers: Object.fromEntries(r.headers), body: await r.text(), ok: r.ok };
  } catch (err) {
    return makeFail({ phase, probe, error: err, start });
  }
  if (!res.ok) {
    return makeFail({ phase, probe, code: res.status, reasons: [`status_${res.status}`], start });
  }
  const v = validateJson(res);
  if (!v.ok) return makeFail({ phase, probe, code: res.status, reasons: v.reasons, start });
  const results = (v.parsed?.data || []).slice(0, 5);
  if (!results.length) return makeFail({ phase, probe, code: res.status, reasons: ["no_results"], start });

  const content = results.map((r, i) => [
    `## ${i + 1}. ${r.title || ""}`,
    `URL: ${r.url}`,
    "",
    (r.content || "").slice(0, 4000),
  ].join("\n")).join("\n\n---\n\n");

  return makeOk({
    phase, probe, code: 200,
    content,
    title: `Search results for: ${query}`,
    meta: {
      query,
      result_count: results.length,
      result_urls: results.map((r) => r.url),
      jina_keyed: Boolean(apiKey),
    },
    start,
  });
}

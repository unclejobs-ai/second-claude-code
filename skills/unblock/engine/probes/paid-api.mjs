import { validateJson } from "../validate.mjs";
import { fetchText, makeOk, makeFail, makeSkipped } from "../util.mjs";

const TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;

export async function probePaidApi(rawUrl, opts = {}) {
  const start = Date.now();
  const phase = 6;
  if (!opts.allowPaid) return makeSkipped({ phase, probe: "paid-api", reason: "paid_not_allowed", start });
  const tries = [];
  if (process.env.TAVILY_API_KEY) tries.push(["tavily", tryTavily]);
  if (process.env.EXA_API_KEY) tries.push(["exa", tryExa]);
  if (process.env.FIRECRAWL_API_KEY) tries.push(["firecrawl", tryFirecrawl]);
  if (!tries.length) return makeSkipped({ phase, probe: "paid-api", reason: "no_paid_keys", start });

  for (const [name, fn] of tries) {
    try {
      const r = await fn(rawUrl);
      if (r.ok) {
        return makeOk({
          phase, probe: `paid-api/${name}`,
          code: r.status || 200,
          content: r.content,
          title: r.title || "",
          meta: { paid: true, provider: name },
          start,
        });
      }
    } catch { /* try next */ }
  }
  return makeFail({ phase, probe: "paid-api", reasons: ["all_paid_failed"], start });
}

async function postJson(url, headers, payload) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = await res.text();
    return { status: res.status, headers: Object.fromEntries(res.headers), body, ok: res.ok };
  } catch (err) {
    return { status: 0, headers: {}, body: "", ok: false, error: String(err?.message || err) };
  }
}

async function tryTavily(rawUrl) {
  const res = await postJson("https://api.tavily.com/extract",
    { authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    { urls: [rawUrl], extract_depth: "advanced" });
  const v = validateJson(res);
  if (!v.ok) return { ok: false, status: res.status };
  const item = v.parsed?.results?.[0];
  if (!item?.raw_content) return { ok: false, status: res.status };
  return { ok: true, status: res.status, content: item.raw_content, title: item.title };
}

async function tryExa(rawUrl) {
  const res = await postJson("https://api.exa.ai/contents",
    { "x-api-key": process.env.EXA_API_KEY },
    { ids: [rawUrl], text: { maxCharacters: 50000 } });
  const v = validateJson(res);
  if (!v.ok) return { ok: false, status: res.status };
  const item = v.parsed?.results?.[0];
  if (!item?.text) return { ok: false, status: res.status };
  return { ok: true, status: res.status, content: item.text, title: item.title };
}

async function tryFirecrawl(rawUrl) {
  const res = await postJson("https://api.firecrawl.dev/v1/scrape",
    { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` },
    { url: rawUrl, formats: ["markdown"] });
  const v = validateJson(res);
  if (!v.ok) return { ok: false, status: res.status };
  const md = v.parsed?.data?.markdown;
  if (!md) return { ok: false, status: res.status };
  return { ok: true, status: res.status, content: md, title: v.parsed?.data?.metadata?.title };
}

import { validate, validateJson, stripHtml } from "../validate.mjs";
import { extractTitle, fetchText, fetchJson, makeOk, makeFail } from "../util.mjs";

export async function probeArchive(rawUrl) {
  const start = Date.now();
  const phase = 5;
  const trace = [];

  // Race the 3 independent archive sources — first valid wins
  const settled = await Promise.allSettled([
    safe("wayback", () => tryWayback(rawUrl)),
    safe("archive-today", () => tryArchiveToday(rawUrl)),
    safe("amp-cache", () => tryAmpCache(rawUrl)),
  ]);
  for (const r of settled) {
    if (r.status === "fulfilled") {
      const { source, result } = r.value;
      trace.push({ source, ok: Boolean(result?.ok), status: result?.status });
      if (result?.ok) {
        return makeOk({
          phase, probe: `archive/${source}`,
          code: result.status,
          content: result.content,
          title: result.title || "",
          meta: { via_archive: true, source },
          start, trace,
        });
      }
    } else {
      trace.push({ source: "?", ok: false, error: String(r.reason?.message || r.reason) });
    }
  }

  // Sequential after the race: feed discovery is order-dependent
  try {
    const r = await tryFeedDiscovery(rawUrl);
    trace.push({ source: "feed-discovery", ok: r.ok, status: r.status });
    if (r.ok) {
      return makeOk({
        phase, probe: "archive/feed",
        code: r.status,
        content: r.content,
        title: r.title || "",
        meta: { via_archive: true, source: "feed-discovery" },
        start, trace,
      });
    }
  } catch (err) {
    trace.push({ source: "feed-discovery", ok: false, error: String(err?.message || err) });
  }

  try {
    const og = await ogTagRescue(rawUrl);
    trace.push({ source: "og-rescue", ok: og.ok });
    if (og.ok) {
      return makeOk({
        phase, probe: "archive/og-rescue",
        code: og.status,
        content: og.content,
        title: og.title,
        meta: { via_archive: true, partial: true, source: "og-rescue" },
        start, trace,
      });
    }
  } catch (err) {
    trace.push({ source: "og-rescue", ok: false, error: String(err?.message || err) });
  }

  return makeFail({ phase, probe: "archive", reasons: ["all_archive_sources_failed"], start, trace });
}

async function safe(source, fn) {
  try { return { source, result: await fn() }; }
  catch (err) { return { source, result: { ok: false, status: 0, error: String(err?.message || err) } }; }
}

async function tryWayback(rawUrl) {
  const idx = await fetchJson(`https://archive.org/wayback/available?url=${encodeURIComponent(rawUrl)}`);
  const v = validateJson(idx);
  if (!v.ok) return { ok: false, status: idx.status };
  const snap = v.parsed?.archived_snapshots?.closest;
  if (!snap?.available || !snap.url) return { ok: false, status: snap?.status || 0 };
  return fetchAndValidateHtml(snap.url);
}

async function tryArchiveToday(rawUrl) {
  return fetchAndValidateHtml(`https://archive.ph/newest/${rawUrl}`, {
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  });
}

async function tryAmpCache(rawUrl) {
  const u = new URL(rawUrl);
  return fetchAndValidateHtml(`https://cdn.ampproject.org/c/s/${u.host}${u.pathname}${u.search}`);
}

async function fetchAndValidateHtml(url, headers) {
  const res = await fetchText(url, { headers });
  if (!res.ok) return { ok: false, status: res.status };
  const v = validate({ status: res.status, headers: res.headers, body: res.body });
  if (!v.ok) return { ok: false, status: res.status };
  return { ok: true, status: res.status, content: res.body, title: extractTitle(res.body) };
}

async function tryFeedDiscovery(rawUrl) {
  const u = new URL(rawUrl);
  const root = `${u.protocol}//${u.host}/`;
  const home = await fetchText(root, { headers: { accept: "text/html" } });
  if (!home.ok) return { ok: false, status: home.status };
  const feeds = [...home.body.matchAll(/<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["']/gi)]
    .map((m) => new URL(m[2], root).toString());
  if (!feeds.length) return { ok: false, status: 0 };
  const fetched = await Promise.allSettled(feeds.slice(0, 3).map((f) => fetchText(f)));
  for (const r of fetched) {
    if (r.status !== "fulfilled" || !r.value.ok) continue;
    const items = extractFeedItems(r.value.body);
    const match = items.find((it) => it.link === rawUrl) || items[0];
    if (match) {
      return {
        ok: true,
        status: r.value.status,
        content: `# ${match.title || ""}\n\n${match.description || match.summary || ""}`,
        title: match.title || "",
      };
    }
  }
  return { ok: false, status: 0 };
}

function extractFeedItems(xml) {
  const items = [];
  for (const m of xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/gi)) {
    const block = m[0];
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
    const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["']/i) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const link = linkMatch ? linkMatch[1].trim() : "";
    const description = (block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || "";
    const summary = (block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || [])[1] || "";
    items.push({ title: stripHtml(title), link: stripHtml(link), description: stripHtml(description), summary: stripHtml(summary) });
  }
  return items;
}

async function ogTagRescue(rawUrl) {
  const res = await fetchText(rawUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)",
      accept: "text/html",
    },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const og = (name) => (res.body.match(new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`, "i")) || [])[1] || "";
  const title = og("title") || extractTitle(res.body);
  const description = og("description");
  const image = og("image");
  if (!title && !description) return { ok: false, status: res.status };
  return {
    ok: true,
    status: res.status,
    content: `# ${title}\n\n${description}\n\n${image ? `![](${image})` : ""}`,
    title,
  };
}

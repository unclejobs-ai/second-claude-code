import { stripHtml, validateJson } from "../validate.mjs";
import { fetchText, fetchJson, makeOk, makeFail, makeSkipped } from "../util.mjs";

const STACK_EXCHANGE_HOSTS = /^https?:\/\/(?:[a-z0-9-]+\.)?(stackoverflow\.com|stackexchange\.com|serverfault\.com|superuser\.com|askubuntu\.com|mathoverflow\.net)\/questions\/(\d+)/i;
const MASTODON_PATTERN = /^https?:\/\/([a-z0-9.-]+)\/@[\w.-]+\/(\d+)/i;
const LEMMY_PATTERN = /^https?:\/\/([a-z0-9.-]+)\/post\/(\d+)/i;
const WIKIPEDIA_PATTERN = /^https?:\/\/([a-z]{2,3})\.wikipedia\.org\/wiki\/([^?#]+)/i;

const ROUTES = [
  { name: "reddit-comments", match: (u) => /^https?:\/\/(?:www\.|old\.|new\.)?reddit\.com\/r\/[^/]+\/comments\//i.test(u), fetch: redditComments },
  { name: "hn-item",         match: (u) => /^https?:\/\/news\.ycombinator\.com\/item\?id=\d+/i.test(u), fetch: hnItem },
  { name: "arxiv-abs",       match: (u) => /^https?:\/\/arxiv\.org\/abs\//i.test(u), fetch: arxivAbs },
  { name: "bluesky-post",    match: (u) => /^https?:\/\/bsky\.app\/profile\/[^/]+\/post\//i.test(u), fetch: blueskyPost },
  { name: "github-issue",    match: (u) => /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+/i.test(u), fetch: githubIssue },
  { name: "github-repo",     match: (u) => /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(u), fetch: githubRepo },
  { name: "npm-package",     match: (u) => /^https?:\/\/(?:www\.)?npmjs\.com\/package\//i.test(u), fetch: npmPackage },
  { name: "stack-exchange",  match: (u) => STACK_EXCHANGE_HOSTS.test(u), fetch: stackExchange },
  { name: "wikipedia",       match: (u) => WIKIPEDIA_PATTERN.test(u), fetch: wikipedia },
  { name: "mastodon",        match: (u) => MASTODON_PATTERN.test(u), fetch: mastodon },
  { name: "lemmy",           match: (u) => LEMMY_PATTERN.test(u), fetch: lemmy },
];

export async function probePublicApi(rawUrl) {
  const start = Date.now();
  for (const route of ROUTES) {
    if (!route.match(rawUrl)) continue;
    const phase = "0a";
    const probe = `public-api/${route.name}`;
    try {
      const r = await route.fetch(rawUrl);
      if (r.ok) return makeOk({ phase, probe, code: r.code || 200, content: r.content, title: r.title || "", meta: r.meta || {}, start });
      return makeFail({ phase, probe, code: r.code || 0, reasons: r.reasons, start });
    } catch (err) {
      return makeFail({ phase, probe, error: err, start });
    }
  }
  // Fallback: try oEmbed discovery — works for any site with a discoverable oEmbed endpoint
  try {
    const r = await oembedDiscovery(rawUrl);
    if (r.ok) return makeOk({ phase: "0a", probe: "public-api/oembed", code: r.code || 200, content: r.content, title: r.title || "", meta: r.meta || {}, start });
  } catch { /* fall through */ }

  return makeSkipped({ phase: "0a", probe: "public-api/router", reason: "no_pattern_match", start });
}

async function redditComments(url) {
  const jsonUrl = url.replace(/\/?(\?.*)?$/, ".json$1");
  const res = await fetchJson(jsonUrl);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const post = v.parsed?.[0]?.data?.children?.[0]?.data;
  const comments = v.parsed?.[1]?.data?.children?.map((c) => c.data?.body).filter(Boolean) || [];
  if (!post) return { ok: false, code: res.status, reasons: ["no_post"] };
  const content = [
    `# ${post.title || ""}`,
    `Author: ${post.author || ""} · Subreddit: r/${post.subreddit || ""}`,
    "",
    post.selftext || "",
    "",
    "## Comments",
    ...comments.slice(0, 50).map((c) => `- ${c.replace(/\s+/g, " ").slice(0, 800)}`),
  ].join("\n");
  return { ok: true, code: res.status, content, title: post.title || "", meta: { author: post.author, score: post.score } };
}

async function hnItem(url) {
  const id = (url.match(/id=(\d+)/) || [])[1];
  if (!id) return { ok: false, reasons: ["no_id"] };
  const res = await fetchJson(`https://hn.algolia.com/api/v1/items/${id}`);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const item = v.parsed;
  const lines = [`# ${item.title || ""}`, `Author: ${item.author || ""}`, "", item.text || ""];
  walkHn(item.children || [], 0, lines);
  return { ok: true, code: res.status, content: lines.join("\n"), title: item.title, meta: { author: item.author, points: item.points } };
}

function walkHn(children, depth, out) {
  for (const c of children.slice(0, 50)) {
    if (!c) continue;
    out.push(`${"  ".repeat(depth)}- [${c.author || "?"}] ${stripHtml(c.text || "").slice(0, 600)}`);
    if (c.children?.length && depth < 3) walkHn(c.children, depth + 1, out);
  }
}

async function arxivAbs(url) {
  const id = (url.match(/abs\/([\w.\-/]+)/) || [])[1];
  if (!id) return { ok: false, reasons: ["no_id"] };
  const res = await fetchJson(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`);
  if (res.status !== 200) return { ok: false, code: res.status, reasons: [`status_${res.status}`] };
  const xml = res.body;
  const title = (xml.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/) || [])[1]?.trim();
  const summary = (xml.match(/<entry>[\s\S]*?<summary>([\s\S]*?)<\/summary>/) || [])[1]?.trim();
  const authors = [...xml.matchAll(/<author>\s*<name>(.*?)<\/name>/g)].map((m) => m[1]);
  if (!title) return { ok: false, code: res.status, reasons: ["no_entry"] };
  return { ok: true, code: res.status, content: `# ${title}\n\nAuthors: ${authors.join(", ")}\n\n${summary || ""}`, title, meta: { authors } };
}

async function blueskyPost(url) {
  const m = url.match(/profile\/([^/]+)\/post\/([^/?#]+)/);
  if (!m) return { ok: false, reasons: ["no_uri"] };
  const [, handle, rkey] = m;
  const at = `at://${handle}/app.bsky.feed.post/${rkey}`;
  const api = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(at)}`;
  const res = await fetchJson(api);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const post = v.parsed?.thread?.post;
  if (!post) return { ok: false, code: res.status, reasons: ["no_post"] };
  const text = post.record?.text || "";
  const author = post.author?.handle || handle;
  const replies = (v.parsed.thread.replies || []).map((r) => r.post?.record?.text).filter(Boolean);
  return {
    ok: true,
    code: res.status,
    content: `# Bluesky post by @${author}\n\n${text}\n\n## Replies\n\n${replies.slice(0, 30).map((t) => `- ${t}`).join("\n")}`,
    title: text.slice(0, 80),
    meta: { author },
  };
}

async function githubRepo(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return { ok: false, reasons: ["no_repo"] };
  const [, owner, repo] = m;
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo.replace(/\/$/, "")}`);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const r = v.parsed;
  return {
    ok: true,
    code: res.status,
    content: `# ${r.full_name}\n\n${r.description || ""}\n\n- Stars: ${r.stargazers_count}\n- Forks: ${r.forks_count}\n- Language: ${r.language || ""}\n- License: ${r.license?.spdx_id || ""}\n- Updated: ${r.pushed_at}`,
    title: r.full_name,
    meta: { stars: r.stargazers_count },
  };
}

async function githubIssue(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
  if (!m) return { ok: false, reasons: ["no_issue"] };
  const [, owner, repo, num] = m;
  const res = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/issues/${num}`);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const i = v.parsed;
  const cmRes = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/issues/${num}/comments?per_page=30`);
  const cmV = validateJson(cmRes);
  const cm = cmV.ok ? cmV.parsed : [];
  const content = [`# ${i.title}`, `Author: ${i.user?.login}`, "", i.body || "", "", "## Comments"]
    .concat(cm.map((c) => `- [${c.user?.login}] ${c.body?.replace(/\s+/g, " ").slice(0, 800)}`))
    .join("\n");
  return { ok: true, code: res.status, content, title: i.title, meta: { state: i.state, user: i.user?.login } };
}

async function stackExchange(url) {
  const m = url.match(STACK_EXCHANGE_HOSTS);
  if (!m) return { ok: false, reasons: ["no_match"] };
  const [, host, qid] = m;
  const sitemap = {
    "stackoverflow.com": "stackoverflow",
    "stackexchange.com": "stackexchange",
    "serverfault.com": "serverfault",
    "superuser.com": "superuser",
    "askubuntu.com": "askubuntu",
    "mathoverflow.net": "mathoverflow.net",
  };
  const site = sitemap[host.toLowerCase()] || host.split(".")[0];
  const api = `https://api.stackexchange.com/2.3/questions/${qid}?site=${site}&filter=withbody`;
  const res = await fetchJson(api);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const q = v.parsed?.items?.[0];
  if (!q) return { ok: false, code: res.status, reasons: ["no_question"] };
  const ansApi = `https://api.stackexchange.com/2.3/questions/${qid}/answers?site=${site}&filter=withbody&sort=votes`;
  const ansRes = await fetchJson(ansApi);
  const ansV = validateJson(ansRes);
  const answers = ansV.ok ? (ansV.parsed.items || []) : [];
  const content = [
    `# ${stripHtml(q.title)}`,
    `Score: ${q.score} · Tags: ${(q.tags || []).join(", ")}`,
    "",
    stripHtml(q.body || ""),
    "",
    "## Answers",
    ...answers.slice(0, 5).map((a) => `### Score ${a.score}${a.is_accepted ? " (accepted)" : ""}\n\n${stripHtml(a.body || "")}`),
  ].join("\n");
  return { ok: true, code: res.status, content, title: stripHtml(q.title), meta: { score: q.score, answers: answers.length } };
}

async function wikipedia(url) {
  const m = url.match(WIKIPEDIA_PATTERN);
  if (!m) return { ok: false, reasons: ["no_match"] };
  const [, lang, slug] = m;
  const title = decodeURIComponent(slug.replace(/_/g, " "));
  const api = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetchJson(api);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const s = v.parsed;
  if (!s.title) return { ok: false, code: res.status, reasons: ["no_summary"] };
  return {
    ok: true,
    code: res.status,
    content: `# ${s.title}\n\n${s.description || ""}\n\n${s.extract || ""}\n\n[Read more](${s.content_urls?.desktop?.page || url})`,
    title: s.title,
    meta: { lang, type: s.type },
  };
}

async function mastodon(url) {
  const m = url.match(MASTODON_PATTERN);
  if (!m) return { ok: false, reasons: ["no_match"] };
  const [, host, id] = m;
  const api = `https://${host}/api/v1/statuses/${id}`;
  const res = await fetchJson(api);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const s = v.parsed;
  if (!s.id || !s.account) return { ok: false, code: res.status, reasons: ["no_status"] };
  const ctxRes = await fetchJson(`https://${host}/api/v1/statuses/${id}/context`);
  const ctxV = validateJson(ctxRes);
  const replies = ctxV.ok ? (ctxV.parsed.descendants || []).slice(0, 30) : [];
  const content = [
    `# Mastodon post by @${s.account.acct}`,
    `Date: ${s.created_at} · Replies: ${s.replies_count} · Reblogs: ${s.reblogs_count}`,
    "",
    stripHtml(s.content || ""),
    "",
    "## Replies",
    ...replies.map((r) => `- [@${r.account.acct}] ${stripHtml(r.content || "").slice(0, 600)}`),
  ].join("\n");
  return { ok: true, code: res.status, content, title: stripHtml(s.content || "").slice(0, 80), meta: { author: s.account.acct } };
}

async function lemmy(url) {
  const m = url.match(LEMMY_PATTERN);
  if (!m) return { ok: false, reasons: ["no_match"] };
  const [, host, postId] = m;
  const api = `https://${host}/api/v3/post?id=${postId}`;
  const res = await fetchJson(api);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const p = v.parsed?.post_view;
  if (!p) return { ok: false, code: res.status, reasons: ["no_post"] };
  const post = p.post;
  const cmRes = await fetchJson(`https://${host}/api/v3/comment/list?post_id=${postId}&limit=50&sort=Top`);
  const cmV = validateJson(cmRes);
  const comments = cmV.ok ? (cmV.parsed.comments || []).slice(0, 30) : [];
  const content = [
    `# ${post.name}`,
    `Author: ${p.creator?.name} · Community: ${p.community?.name}`,
    "",
    post.body || post.url || "",
    "",
    "## Comments",
    ...comments.map((c) => `- [${c.creator?.name}] ${(c.comment?.content || "").replace(/\s+/g, " ").slice(0, 600)}`),
  ].join("\n");
  return { ok: true, code: res.status, content, title: post.name, meta: { score: p.counts?.score } };
}

async function oembedDiscovery(url) {
  const head = await fetchText(url, { headers: { accept: "text/html" } });
  if (!head.ok) return { ok: false, code: head.status };
  const m = head.body.match(/<link[^>]+rel=["']alternate["'][^>]+type=["']application\/json\+oembed["'][^>]+href=["']([^"']+)["']/i)
    || head.body.match(/<link[^>]+type=["']application\/json\+oembed["'][^>]+href=["']([^"']+)["']/i)
    || head.body.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/json\+oembed["']/i);
  if (!m) return { ok: false, code: 0, reasons: ["no_oembed_link"] };
  const oembedUrl = new URL(m[1], url).toString();
  const res = await fetchJson(oembedUrl);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const o = v.parsed;
  if (!o.title && !o.html) return { ok: false, code: res.status, reasons: ["no_oembed_payload"] };
  const content = [
    `# ${o.title || ""}`,
    o.author_name ? `Author: ${o.author_name}` : null,
    o.provider_name ? `Provider: ${o.provider_name}` : null,
    "",
    o.description || "",
    o.html ? `\n${o.html}` : "",
  ].filter(Boolean).join("\n");
  return { ok: true, code: res.status, content, title: o.title || "", meta: { provider: o.provider_name, type: o.type } };
}

async function npmPackage(url) {
  const m = url.match(/package\/(@?[^/?#]+(?:\/[^/?#]+)?)/);
  if (!m) return { ok: false, reasons: ["no_pkg"] };
  const pkg = decodeURIComponent(m[1]);
  const res = await fetchJson(`https://registry.npmjs.org/${pkg}`);
  const v = validateJson(res);
  if (!v.ok) return { ok: false, code: res.status, reasons: v.reasons };
  const p = v.parsed;
  const latest = p["dist-tags"]?.latest;
  const versionData = p.versions?.[latest] || {};
  return {
    ok: true,
    code: res.status,
    content: `# ${p.name} @ ${latest}\n\n${p.description || ""}\n\n- Homepage: ${versionData.homepage || ""}\n- License: ${versionData.license || ""}\n- Author: ${versionData.author?.name || versionData.author || ""}\n\nReadme:\n\n${(p.readme || "").slice(0, 8000)}`,
    title: p.name,
    meta: { latest },
  };
}

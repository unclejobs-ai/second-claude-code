import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBinary } from "../install.mjs";
import { validate } from "../validate.mjs";
import { extractTitle, runProcess, makeOk, makeFail, makeSkipped } from "../util.mjs";

const TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;

export async function probePlaywright(rawUrl, opts = {}) {
  const start = Date.now();
  const phase = 4;
  const probe = "playwright";
  const handle = opts.preresolved?.playwright ?? await ensureBinary("playwright");
  if (!handle) return makeSkipped({ phase, probe, reason: "playwright_unavailable", start });

  const device = opts.device === "mobile" ? "iPhone 15" : "Desktop Chrome";
  const selector = opts.selector || "body";
  const tmp = mkdtempSync(join(tmpdir(), "unblock-pw-"));
  const script = join(tmp, "fetch.mjs");
  const out = join(tmp, "out.html");
  const apiOut = join(tmp, "apis.json");
  writeFileSync(script, scriptSource({ url: rawUrl, device, selector, out, apiOut, timeoutMs: TIMEOUT * 2 }));

  try {
    const probeRun = await runProcess("npx", ["--yes", "playwright", "--", "node", script], { timeoutMs: TIMEOUT * 3 });
    if (probeRun.code !== 0) return makeFail({ phase, probe, error: probeRun.stderr?.slice(0, 1000), start });

    let html = "";
    let discoveredApis = [];
    try { html = readFileSync(out, "utf8"); } catch {}
    try { if (existsSync(apiOut)) discoveredApis = JSON.parse(readFileSync(apiOut, "utf8")); } catch {}

    const v = validate({ status: 200, headers: { "content-type": "text/html" }, body: html });
    const safeApis = sanitizeApis(discoveredApis);
    const meta = { device, selector, discovered_apis: safeApis.slice(0, 10) };
    if (!v.ok) {
      const partial = safeApis.length > 0;
      return makeFail({
        phase, probe,
        reasons: v.reasons,
        start,
        ...(partial ? {
          content: `# Live page failed validation; ${safeApis.length} hidden API endpoint(s) discovered\n\n${safeApis.slice(0, 10).map((a) => `- ${a.method} ${a.url} (${a.status}, ${a.contentType || "?"})`).join("\n")}`,
          meta: { ...meta, partial: true },
        } : {}),
      });
    }
    return makeOk({
      phase, probe, code: 200,
      content: html,
      title: extractTitle(html),
      meta,
      start,
    });
  } catch (err) {
    return makeFail({ phase, probe, error: err, start });
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

function sanitizeApis(apis) {
  const out = [];
  for (const a of apis || []) {
    if (!a || typeof a.url !== "string") continue;
    const url = a.url.replace(/[\r\n`\\<>]/g, "").slice(0, 500);
    const method = String(a.method || "GET").replace(/[^A-Z]/g, "").slice(0, 10);
    const status = Number(a.status) || 0;
    const contentType = String(a.contentType || "").replace(/[\r\n`\\<>;]/g, "").slice(0, 80);
    out.push({ method, url, status, contentType });
  }
  return out;
}

function scriptSource({ url, device, selector, out, apiOut, timeoutMs }) {
  return `
import { chromium, devices } from "playwright";
const target = ${JSON.stringify(url)};
const desc = ${JSON.stringify(device)};
const ctxArgs = devices[desc] || {};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...ctxArgs, locale: ctxArgs.locale || "en-US" });
const page = await context.newPage();
const apis = [];
const targetUrl = new URL(target);
const targetHost = targetUrl.hostname;
const targetOrigin = targetUrl.origin;
page.on("response", async (resp) => {
  try {
    const url = resp.url();
    const ct = (resp.headers()["content-type"] || "").toLowerCase();
    if (url === target) return;
    let parsed;
    try { parsed = new URL(url); } catch { return; }
    // Tighten: require structured-data content-type AND same-origin or strict subdomain of target.
    const isStructured = /^application\\/(json|graphql|xml|x-protobuf|ld\\+json)/.test(ct);
    if (!isStructured) return;
    const sameOrigin = parsed.origin === targetOrigin;
    const strictSubdomain = parsed.hostname === targetHost || parsed.hostname.endsWith("." + targetHost);
    if (!sameOrigin && !strictSubdomain) return;
    if (resp.request().resourceType() === "image") return;
    apis.push({
      method: resp.request().method(),
      url,
      status: resp.status(),
      contentType: ct.split(";")[0],
    });
  } catch {}
});
try {
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: ${timeoutMs} });
  try { await page.waitForSelector(${JSON.stringify(selector)}, { timeout: 5000 }); } catch {}
  // Give XHRs a moment to settle
  try { await page.waitForLoadState("networkidle", { timeout: 4000 }); } catch {}
  const html = await page.content();
  const fs = await import("node:fs");
  fs.writeFileSync(${JSON.stringify(out)}, html, "utf8");
  fs.writeFileSync(${JSON.stringify(apiOut)}, JSON.stringify(apis), "utf8");
} finally {
  await browser.close();
}
`;
}

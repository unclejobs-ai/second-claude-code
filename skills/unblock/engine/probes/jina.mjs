import { extractTitle, fetchText, makeOk, makeFail } from "../util.mjs";

export async function probeJinaReader(rawUrl, opts = {}) {
  const start = Date.now();
  const apiKey = process.env.JINA_API_KEY;
  const reader = `https://r.jina.ai/${rawUrl}`;
  const headers = {
    accept: "text/markdown",
    "x-retain-images": "none",
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  if (opts.locale) headers["x-locale"] = opts.locale;

  const res = await fetchText(reader, { headers });
  const ok = res.status === 200 && res.body && res.body.length > 200;
  const phase = "0b";
  const probe = "jina-reader";
  if (!ok) {
    const reasons = [];
    if (res.error) reasons.push(res.error);
    if (res.status) reasons.push(`status_${res.status}`);
    if (res.body && res.body.length <= 200) reasons.push("body_too_short");
    return makeFail({ phase, probe, code: res.status, reasons, start });
  }
  const title = (res.body.match(/^Title:\s*(.+)$/m) || [])[1]?.trim() || extractTitle(res.body);
  return makeOk({
    phase, probe, code: 200,
    content: res.body, title,
    meta: { jina_keyed: Boolean(apiKey) },
    start,
  });
}

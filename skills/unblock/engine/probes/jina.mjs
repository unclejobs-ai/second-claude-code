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
  const phase = "0b";
  const probe = "jina-reader";
  const ok = res.status === 200 && res.body && res.body.length > 200;
  if (!ok) {
    const reasons = [];
    if (res.error) reasons.push(res.error);
    if (res.status) reasons.push(`status_${res.status}`);
    if (res.body && res.body.length <= 200) reasons.push("body_too_short");
    return makeFail({ phase, probe, code: res.status, reasons, start });
  }
  // Strip Jina envelope (Title/URL Source/Warning lines) and re-measure.
  // A 314-byte response that's all "Warning: This page contains iframe..."
  // is failure dressed up as success.
  const meaty = res.body
    .replace(/^Title:\s*.+$/gm, "")
    .replace(/^URL Source:\s*.+$/gm, "")
    .replace(/^Markdown Content:\s*$/gm, "")
    .replace(/^Published Time:\s*.+$/gm, "")
    .replace(/^Warning:\s*.+$/gm, "")
    .trim();
  if (meaty.length < 200) {
    return makeFail({ phase, probe, code: res.status, reasons: ["jina_envelope_only"], start });
  }
  const title = (res.body.match(/^Title:\s*(.+)$/m) || [])[1]?.trim() || extractTitle(res.body);
  return makeOk({
    phase, probe, code: 200,
    content: res.body, title,
    meta: { jina_keyed: Boolean(apiKey) },
    start,
  });
}

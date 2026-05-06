import { spawn } from "node:child_process";

const ALLOW_PRIVATE_HOSTS = process.env.UNBLOCK_ALLOW_PRIVATE_HOSTS === "1";

const PRIVATE_HOST_LITERALS = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata.goog",
  "metadata.azure.com",
  "instance-data",
]);

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^198\.(1[89])\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^22[4-9]\./,
  /^23[0-9]\./,
  /^24[0-9]\./,
  /^25[0-5]\./,
];

const PRIVATE_IPV6_PREFIXES = [
  "::1",
  "::ffff:",
  "fe80:",
  "fc00:",
  "fd00:",
  "ff00:",
];

function ipv4FromMapped(h) {
  // Match ::ffff:c0a8:0101 or ::ffff:192.168.1.1 (IPv4-mapped IPv6)
  const m = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (m) {
    const a = parseInt(m[1], 16);
    const b = parseInt(m[2], 16);
    return `${(a >> 8) & 0xff}.${a & 0xff}.${(b >> 8) & 0xff}.${b & 0xff}`;
  }
  const dotted = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  return null;
}

export function isPrivateHost(host) {
  if (!host || typeof host !== "string") return true;
  const h = host.toLowerCase().trim().replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST_LITERALS.has(h)) return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    for (const re of PRIVATE_IPV4_RANGES) if (re.test(h)) return true;
  }
  if (h.includes(":")) {
    const mapped = ipv4FromMapped(h);
    if (mapped) {
      for (const re of PRIVATE_IPV4_RANGES) if (re.test(mapped)) return true;
    }
    for (const prefix of PRIVATE_IPV6_PREFIXES) if (h.startsWith(prefix)) return true;
  }
  return false;
}

export function assertPublicUrl(rawUrl) {
  if (ALLOW_PRIVATE_HOSTS) return { ok: true };
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch { return { ok: false, reason: "invalid_url" }; }
  if (!/^https?:$/.test(parsed.protocol)) return { ok: false, reason: "non_http_protocol" };
  if (isPrivateHost(parsed.hostname)) return { ok: false, reason: "private_host_blocked" };
  return { ok: true };
}

export function extractTitle(html) {
  if (typeof html !== "string") return "";
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

export function parseCurlHeaderBody(raw) {
  if (typeof raw !== "string") return { status: 0, headers: {}, body: "" };
  const sep = raw.indexOf("\r\n\r\n");
  let headerBlock, body;
  if (sep >= 0) { headerBlock = raw.slice(0, sep); body = raw.slice(sep + 4); }
  else {
    const sep2 = raw.indexOf("\n\n");
    if (sep2 < 0) return { status: 0, headers: {}, body: raw };
    headerBlock = raw.slice(0, sep2); body = raw.slice(sep2 + 2);
  }
  // Strip any redirect-chain headers — keep the last status block
  const blocks = headerBlock.split(/\r?\n\r?\n/);
  const last = blocks[blocks.length - 1];
  if (!/^HTTP\/[\d.]+\s\d{3}/.test(last)) return { status: 0, headers: {}, body };
  const lines = last.split(/\r?\n/);
  const status = Number((lines[0].match(/\s(\d{3})\s/) || [])[1] || 0);
  const headers = {};
  const setCookies = [];
  for (let i = 1; i < lines.length; i++) {
    const idx = lines[i].indexOf(":");
    if (idx <= 0) continue;
    const name = lines[i].slice(0, idx).trim().toLowerCase();
    const value = lines[i].slice(idx + 1).trim();
    if (name === "set-cookie") setCookies.push(value);
    else headers[name] = value;
  }
  if (setCookies.length) headers["set-cookie"] = setCookies;
  return { status, headers, body };
}

export function runProcess(cmd, args, { timeoutMs = 15000, env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      env: env || process.env,
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: String(err) }));
  });
}

export function runCurl(binary, args, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs + 2000,
    });
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const parsed = parseCurlHeaderBody(raw);
      resolve({
        code,
        ok: code === 0 && parsed.status >= 200 && parsed.status < 400,
        ...parsed,
        stderr,
      });
    });
    child.on("error", (err) => resolve({ code: -1, ok: false, status: 0, headers: {}, body: "", stderr: String(err) }));
  });
}

const DEFAULT_TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;

export async function fetchText(url, { headers = {}, timeoutMs = DEFAULT_TIMEOUT, redirect = "follow", allowInternal = false } = {}) {
  if (!allowInternal) {
    const guard = assertPublicUrl(url);
    if (!guard.ok) return { status: 0, headers: {}, body: "", ok: false, error: `blocked:${guard.reason}` };
  }
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "unblock/1.0 (+second-claude-code)", ...headers },
      redirect,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text();
    return { status: res.status, headers: Object.fromEntries(res.headers), body, ok: res.ok };
  } catch (err) {
    return { status: 0, headers: {}, body: "", ok: false, error: String(err?.message || err) };
  }
}

export async function fetchJson(url, opts = {}) {
  const r = await fetchText(url, { ...opts, headers: { accept: "application/json", ...(opts.headers || {}) } });
  return r;
}

function elapsedFrom(start) {
  return start != null ? Date.now() - start : 0;
}

export function makeOk({ phase, probe, code = 200, content, title = "", meta = {}, start, attempts, trace }) {
  return {
    phase, probe,
    status: "ok",
    ok: true,
    code,
    elapsed_ms: elapsedFrom(start),
    content,
    title,
    meta: { byte_length: typeof content === "string" ? content.length : 0, ...meta },
    ...(attempts ? { attempts } : {}),
    ...(trace ? { trace } : {}),
  };
}

export function makeFail({ phase, probe, code = 0, reasons, error, start, attempts, trace, content, meta }) {
  const reasonField = error ? { error: typeof error === "string" ? error : String(error?.message || error) } : {};
  return {
    phase, probe,
    status: "fail",
    ok: false,
    code,
    elapsed_ms: elapsedFrom(start),
    ...(reasons ? { reasons } : {}),
    ...reasonField,
    ...(attempts ? { attempts } : {}),
    ...(trace ? { trace } : {}),
    ...(content != null ? { content, meta: meta || {} } : {}),
  };
}

export function makeSkipped({ phase, probe, reason, start }) {
  return {
    phase, probe,
    status: "skipped",
    ok: false,
    elapsed_ms: elapsedFrom(start),
    reason,
  };
}

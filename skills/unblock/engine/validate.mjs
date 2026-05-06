import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { detectChallengeBody } from "./detect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = JSON.parse(readFileSync(join(HERE, "profiles.json"), "utf8"));
const V = PROFILES.validators;

export function stripHtml(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function validate(response, opts = {}) {
  const { status, headers, body } = response || {};
  if (!body || typeof body !== "string") {
    return { ok: false, reasons: ["empty_body"], stripped: "" };
  }

  const reasons = [];
  if (status && status >= 400) reasons.push(`status_${status}`);
  if (body.length < V.min_body_chars) {
    reasons.push("body_too_short");
    return { ok: false, reasons, stripped: "" };
  }

  const stripped = stripHtml(body);
  const minText = opts.minText ?? V.min_text_after_strip_chars;
  if (stripped.length < minText) reasons.push("stripped_too_short");

  const challenge = detectChallengeBody(body);
  if (challenge.challenge) reasons.push("challenge_body");
  if (challenge.hits.length / Math.max(stripped.length, 1) > V.max_challenge_density) {
    reasons.push("challenge_density");
  }

  const ct = lowercaseHeader(headers, "content-type") || "";
  if (opts.expect === "html" && ct && !/text\/html|application\/xhtml/i.test(ct)) {
    reasons.push("content_type_mismatch");
  }

  return { ok: reasons.length === 0, reasons, stripped };
}

export function validateJson(response) {
  const reasons = [];
  const { status, headers, body } = response || {};
  if (!body) return { ok: false, reasons: ["empty_body"] };
  if (status && status >= 400) reasons.push(`status_${status}`);
  const ct = lowercaseHeader(headers, "content-type") || "";
  if (!/json|javascript/i.test(ct)) reasons.push("not_json_content_type");
  let parsed = null;
  try {
    parsed = typeof body === "string" ? JSON.parse(body) : body;
  } catch {
    reasons.push("json_parse_error");
  }
  return { ok: reasons.length === 0, reasons, parsed };
}

function lowercaseHeader(headers, name) {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return Array.isArray(v) ? v.join("; ") : String(v);
  }
  return null;
}

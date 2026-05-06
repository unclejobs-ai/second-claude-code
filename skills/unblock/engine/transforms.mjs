import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = JSON.parse(readFileSync(join(HERE, "profiles.json"), "utf8"));

export function generateVariants(rawUrl) {
  const variants = [];
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return variants;
  }

  const seen = new Set();
  const push = (u, label) => {
    const s = u.toString();
    if (!seen.has(s) && s !== rawUrl) {
      seen.add(s);
      variants.push({ url: s, label });
    }
  };

  for (const rule of PROFILES.url_transforms.rules) {
    if (rule.kind === "subdomain") {
      const next = applySubdomainRule(url, rule);
      if (next) push(next, `subdomain:${rule.from || "+"}=>${rule.to || rule.prepend}`);
    } else if (rule.kind === "path_suffix") {
      push(appendPath(url, rule.append), `suffix:${rule.append}`);
    } else if (rule.kind === "path_prefix") {
      push(prependPath(url, rule.prepend), `prefix:${rule.prepend}`);
    }
  }

  return variants;
}

function applySubdomainRule(urlObj, rule) {
  const host = urlObj.hostname;
  const parts = host.split(".");
  if (parts.length < 2) return null;
  if (rule.from && rule.to) {
    if (parts[0] === rule.from) {
      const next = new URL(urlObj.toString());
      next.hostname = [rule.to, ...parts.slice(1)].join(".");
      return next;
    }
    return null;
  }
  if (rule.prepend) {
    if (parts[0] === rule.prepend) return null;
    const next = new URL(urlObj.toString());
    next.hostname = [rule.prepend, ...parts].join(".");
    return next;
  }
  return null;
}

function appendPath(urlObj, suffix) {
  const next = new URL(urlObj.toString());
  if (next.pathname.endsWith(suffix)) return next;
  next.pathname = next.pathname.replace(/\/?$/, "") + suffix;
  return next;
}

function prependPath(urlObj, prefix) {
  const next = new URL(urlObj.toString());
  if (next.pathname.startsWith(prefix)) return next;
  next.pathname = prefix + next.pathname;
  return next;
}

export function rootUrl(rawUrl) {
  const u = new URL(rawUrl);
  return `${u.protocol}//${u.hostname}/`;
}

export function inferAcceptLanguage(rawUrl) {
  let host = "";
  try { host = new URL(rawUrl).hostname; } catch { return "en-US,en;q=0.9"; }
  const tld = host.split(".").pop()?.toLowerCase();
  switch (tld) {
    case "kr": return "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6";
    case "jp": return "ja-JP,ja;q=0.9,en-US;q=0.7,en;q=0.6";
    case "cn": return "zh-CN,zh;q=0.9,en-US;q=0.7,en;q=0.6";
    case "de": return "de-DE,de;q=0.9,en;q=0.7";
    case "fr": return "fr-FR,fr;q=0.9,en;q=0.7";
    case "es": return "es-ES,es;q=0.9,en;q=0.7";
    case "ru": return "ru-RU,ru;q=0.9,en;q=0.7";
    default: return "en-US,en;q=0.9";
  }
}

export function inferReferrer(rawUrl) {
  let host = "";
  try { host = new URL(rawUrl).hostname; } catch { return "https://www.google.com/"; }
  if (/(\.kr$|naver\.com$)/i.test(host)) return "https://search.naver.com/";
  if (/\.cn$/i.test(host)) return "https://www.baidu.com/";
  if (/\.jp$/i.test(host)) return "https://www.google.co.jp/";
  return "https://www.google.com/";
}

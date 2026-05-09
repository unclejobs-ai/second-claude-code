// Host → cleaner dispatch table.
// Each cleaner: (html, url) -> { ok, markdown, title, ... } | null
// Returning null lets the chain fall through to the next phase.
//
// Add new cleaners here. Keep the host predicate tight — bad cleaners that
// match too widely will silently mangle other sites' bodies.

import { extractNaverPost } from "./naver.mjs";
import { extractTistoryPost } from "./tistory.mjs";
import { extractBrunchPost } from "./brunch.mjs";

const CLEANERS = [
  {
    name: "naver",
    test: (host) => /(^|\.)blog\.naver\.com$/i.test(host),
    extract: extractNaverPost,
  },
  {
    name: "tistory",
    test: (host) => /\.tistory\.com$/i.test(host),
    extract: extractTistoryPost,
  },
  {
    name: "brunch",
    test: (host) => /^brunch\.co\.kr$/i.test(host),
    extract: extractBrunchPost,
  },
];

export function pickCleaner(rawUrl) {
  let host = "";
  try { host = new URL(rawUrl).hostname; } catch { return null; }
  for (const c of CLEANERS) {
    if (c.test(host)) return c;
  }
  return null;
}

export function listCleaners() {
  return CLEANERS.map((c) => c.name);
}

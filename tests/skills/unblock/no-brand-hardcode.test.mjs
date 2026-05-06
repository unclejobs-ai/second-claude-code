import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../../skills/unblock/engine/", import.meta.url).pathname;

const FORBIDDEN_BRANDS = [
  "naver",
  "coupang",
  "linkedin",
  "fmkorea",
  "dcinside",
  "clien",
  "yozm",
  "wishket",
  "twitter",
  "x.com",
  "medium.com",
  "substack",
  "stackoverflow",
  "threads",
  "mastodon",
];

const ALLOW_LIST = new Set([
  "engine/probes/public-api.mjs",
  "engine/probes/yt-dlp.mjs",
  "engine/probes/archive.mjs",
  "engine/probes/jina.mjs",
  "engine/transforms.mjs",
  "engine/orchestrator.mjs",
]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (full.endsWith(".mjs") || full.endsWith(".json")) yield full;
  }
}

test("engine/** has no forbidden brand names outside the public-API allowlist", () => {
  const ENGINE_BASE = ROOT.replace(/\/$/, "");
  for (const file of walk(ENGINE_BASE)) {
    const rel = relative(ENGINE_BASE, file);
    const relWithEngine = `engine/${rel}`;
    if (ALLOW_LIST.has(relWithEngine)) continue;
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const brand of FORBIDDEN_BRANDS) {
      const re = new RegExp(`\\b${escapeRegex(brand)}\\b`);
      if (re.test(text)) {
        assert.fail(`${relWithEngine} contains forbidden brand "${brand}". Site-specific hints must flow via --user-hint, not be hardcoded.`);
      }
    }
  }
});

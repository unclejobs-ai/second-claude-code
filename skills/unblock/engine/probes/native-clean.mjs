// Phase 0d — native body cleaner.
// curl the page once with mobile UA + Korean-friendly accept-language,
// then route through a host-specific cleaner from engine/cleaners/.
// Wins over Jina/curl chrome-laden output for sites we know how to parse.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runCurl, makeOk, makeFail } from "../util.mjs";
import { inferAcceptLanguage, inferReferrer } from "../transforms.mjs";
import { pickCleaner } from "../cleaners/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = JSON.parse(readFileSync(join(HERE, "..", "profiles.json"), "utf8"));
const TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;

export async function probeNativeClean(rawUrl) {
  const start = Date.now();
  const phase = "0d";
  const probe = "native-clean";

  const cleaner = pickCleaner(rawUrl);
  if (!cleaner) {
    return makeFail({ phase, probe, code: 0, reasons: ["no_cleaner_for_host"], start });
  }

  const ua = PROFILES.user_agents.safari_mobile;
  const acceptLang = inferAcceptLanguage(rawUrl);
  const referrer = inferReferrer(rawUrl);
  const args = [
    "-sSL", "--compressed", "--max-time", String(Math.ceil(TIMEOUT / 1000)),
    "-D", "-", "-o", "-",
    "-H", `user-agent: ${ua}`,
    "-H", "accept: text/html,application/xhtml+xml,text/markdown;q=0.95,application/xml;q=0.9,*/*;q=0.8",
    "-H", `accept-language: ${acceptLang}`,
    "-H", "accept-encoding: gzip, deflate, br",
    "-H", `referer: ${referrer}`,
    rawUrl,
  ];

  const res = await runCurl("curl", args, { timeoutMs: TIMEOUT });
  if (!res.ok || !res.body) {
    return makeFail({
      phase, probe, code: res.status,
      reasons: [res.error || `status_${res.status || 0}`],
      start,
    });
  }

  let extracted;
  try {
    extracted = cleaner.extract(res.body, rawUrl);
  } catch (err) {
    return makeFail({ phase, probe, code: res.status, reasons: [`cleaner_threw:${cleaner.name}`], error: String(err?.message || err), start });
  }

  if (!extracted || !extracted.ok || !extracted.markdown) {
    return makeFail({
      phase, probe, code: res.status,
      reasons: [`cleaner_no_match:${cleaner.name}`],
      start,
    });
  }

  if (extracted.chars < 200) {
    return makeFail({
      phase, probe, code: res.status,
      reasons: [`cleaner_too_short:${extracted.chars}`],
      start,
    });
  }

  return makeOk({
    phase, probe, code: res.status,
    content: extracted.markdown,
    title: extracted.title || "",
    meta: {
      cleaner: cleaner.name,
      author: extracted.author || null,
      published: extracted.published || null,
      blocks: extracted.blocks,
      body_chars: extracted.chars,
    },
    start,
  });
}

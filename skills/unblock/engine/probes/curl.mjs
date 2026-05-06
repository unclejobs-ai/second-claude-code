import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateVariants, inferAcceptLanguage, inferReferrer } from "../transforms.mjs";
import { validate } from "../validate.mjs";
import { extractTitle, runCurl, makeOk, makeFail } from "../util.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = JSON.parse(readFileSync(join(HERE, "..", "profiles.json"), "utf8"));
const TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;

const VARIANT_TIERS = [
  { ua: "chrome_desktop", platform: "macOS", mobile: false, secChUa: chromeBrand("131") },
  { ua: "chrome_mobile",  platform: "Android", mobile: true,  secChUa: chromeBrand("131") },
  { ua: "safari_desktop", platform: "macOS", mobile: false, secChUa: null },
  { ua: "safari_mobile",  platform: "iOS",   mobile: true,  secChUa: null },
  { ua: "firefox_desktop", platform: null, mobile: false, secChUa: null },
  { ua: "googlebot", platform: null, mobile: false, secChUa: null, noClientHints: true },
];

function chromeBrand(major) {
  return `"Chromium";v="${major}", "Not(A:Brand";v="24", "Google Chrome";v="${major}"`;
}

export async function probeCurlVariants(rawUrl) {
  const start = Date.now();
  const phase = 1;
  const attempts = [];
  const variants = [{ url: rawUrl, label: "primary" }, ...generateVariants(rawUrl)];
  const acceptLang = inferAcceptLanguage(rawUrl);
  const referrer = inferReferrer(rawUrl);

  let consecutiveBlocks = 0;
  outer: for (const variant of variants.slice(0, 4)) {
    for (const tier of VARIANT_TIERS) {
      const result = await curlOnce({ ...tier, url: variant.url, acceptLang, referrer });
      attempts.push({ variant: variant.label, ua: tier.ua, status: result.status, ok: result.ok });
      if (result.status >= 400 && result.status < 500) {
        consecutiveBlocks += 1;
        if (consecutiveBlocks >= 3) {
          attempts.push({ note: "early_bail_after_3_consecutive_4xx" });
          break outer;
        }
      } else consecutiveBlocks = 0;
      if (result.ok) {
        const v = validate({ status: result.status, headers: result.headers, body: result.body });
        if (v.ok) {
          return makeOk({
            phase,
            probe: `curl/${tier.ua}/${variant.label}`,
            code: result.status,
            content: result.body,
            title: extractTitle(result.body),
            meta: { transform: variant.label },
            start, attempts,
          });
        }
      }
    }
  }
  return makeFail({ phase, probe: "curl-variants", reasons: ["all_variants_failed_validation"], start, attempts });
}

function curlOnce({ url, ua, platform, mobile, secChUa, noClientHints, acceptLang, referrer }) {
  const headers = [
    ["user-agent", PROFILES.user_agents[ua]],
    ["accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"],
    ["accept-language", acceptLang],
    ["accept-encoding", "gzip, deflate, br, zstd"],
    ["cache-control", "max-age=0"],
    ["upgrade-insecure-requests", "1"],
    ["referer", referrer],
  ];
  if (!noClientHints && secChUa) {
    headers.push(["sec-ch-ua", secChUa]);
    headers.push(["sec-ch-ua-mobile", mobile ? "?1" : "?0"]);
    if (platform) headers.push(["sec-ch-ua-platform", `"${platform}"`]);
    headers.push(["sec-fetch-dest", "document"]);
    headers.push(["sec-fetch-mode", "navigate"]);
    headers.push(["sec-fetch-site", "cross-site"]);
    headers.push(["sec-fetch-user", "?1"]);
  }
  const args = ["-sSL", "--compressed", "--max-time", String(Math.ceil(TIMEOUT / 1000)), "-D", "-", "-o", "-"];
  for (const [k, v] of headers) args.push("-H", `${k}: ${v}`);
  args.push(url);
  return runCurl("curl", args, { timeoutMs: TIMEOUT });
}

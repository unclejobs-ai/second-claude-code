import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBinary } from "../install.mjs";
import { rootUrl, inferAcceptLanguage, inferReferrer } from "../transforms.mjs";
import { validate } from "../validate.mjs";
import { extractTitle, runCurl, makeOk, makeFail, makeSkipped } from "../util.mjs";

const TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;

export async function probeImpersonate(rawUrl, opts = {}) {
  const start = Date.now();
  const phase = 2;
  const tool = opts.preresolved?.["curl-impersonate"] ?? await ensureBinary("curl-impersonate");
  if (!tool) return makeSkipped({ phase, probe: "impersonate", reason: "curl_impersonate_unavailable", start });

  const tmpDir = mkdtempSync(join(tmpdir(), "unblock-imp-"));
  const cookieFile = join(tmpDir, "jar.txt");
  const referrer = inferReferrer(rawUrl);
  const acceptLang = inferAcceptLanguage(rawUrl);
  const attempts = [];
  const candidates = tool.all || [tool];

  try {
    let warmed = false;
    let lastFail = null;
    for (const cand of candidates) {
      if (!warmed) {
        await runImpersonate({ binary: cand.binary, url: rootUrl(rawUrl), cookieFile, referrer: "", acceptLang });
        warmed = true;
      }
      const result = await runImpersonate({ binary: cand.binary, url: rawUrl, cookieFile, referrer, acceptLang });
      attempts.push({ tls: cand.binary, status: result.status, ok: result.ok });
      if (!result.ok) { lastFail = result; continue; }
      const v = validate({ status: result.status, headers: result.headers, body: result.body });
      if (v.ok) {
        return makeOk({
          phase, probe: `impersonate/${cand.binary}`,
          code: result.status,
          content: result.body,
          title: extractTitle(result.body),
          meta: { cookies_warmed: true, tls_attempts: attempts.length },
          start, attempts,
        });
      }
      lastFail = { ...result, validation_reasons: v.reasons };
    }
    return makeFail({
      phase, probe: "impersonate",
      code: lastFail?.status || 0,
      reasons: lastFail?.validation_reasons || [`status_${lastFail?.status}`],
      start, attempts,
    });
  } catch (err) {
    return makeFail({ phase, probe: "impersonate", error: err, start, attempts });
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

function runImpersonate({ binary, url, cookieFile, referrer, acceptLang }) {
  const args = [
    "-sSL",
    "--compressed",
    "--max-time", String(Math.ceil(TIMEOUT / 1000)),
    "-D", "-",
    "-o", "-",
    "-b", cookieFile,
    "-c", cookieFile,
    "-H", `accept-language: ${acceptLang}`,
  ];
  if (referrer) args.push("-H", `referer: ${referrer}`);
  args.push(url);
  return runCurl(binary, args, { timeoutMs: TIMEOUT });
}

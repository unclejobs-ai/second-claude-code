import { ensureBinary } from "../install.mjs";
import { validate } from "../validate.mjs";
import { extractTitle, runProcess, makeOk, makeFail, makeSkipped } from "../util.mjs";

const TIMEOUT = Number(process.env.UNBLOCK_TIMEOUT_MS) || 15000;

export async function probeLightpanda(rawUrl, opts = {}) {
  const start = Date.now();
  const phase = 3;
  const probe = "lightpanda";
  const handle = opts.preresolved?.lightpanda ?? await ensureBinary("lightpanda");
  if (!handle) return makeSkipped({ phase, probe, reason: "lightpanda_unavailable", start });

  const isNpx = handle === "npx-lightpanda";
  const cmd = isNpx ? "npx" : handle;
  const baseArgs = isNpx ? ["--yes", "lightpanda-cli"] : [];
  const args = [...baseArgs, "fetch", rawUrl, "--format", "html"];

  const result = await runProcess(cmd, args, { timeoutMs: TIMEOUT * 2 });
  if (result.code !== 0 || !result.stdout) {
    return makeFail({ phase, probe, error: result.stderr?.slice(0, 1000), start });
  }
  const v = validate({ status: 200, headers: { "content-type": "text/html" }, body: result.stdout });
  if (!v.ok) return makeFail({ phase, probe, reasons: v.reasons, start });
  return makeOk({
    phase, probe, code: 200,
    content: result.stdout,
    title: extractTitle(result.stdout),
    meta: { engine: "lightpanda" },
    start,
  });
}

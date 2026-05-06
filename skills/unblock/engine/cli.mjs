#!/usr/bin/env node
import { runChain } from "./chain.mjs";

const HELP = `unblock — adaptive fetch chain (zero-key)

Usage:
  node skills/unblock/engine/cli.mjs <URL> [options]

Options:
  --json                  Emit JSON to stdout (default: pretty text)
  --trace                 Include full trace in JSON output
  --max-phase <N>         Cap chain at phase N (default 5)
  --allow-paid            Permit Phase 6 paid providers (Tavily/Exa/Firecrawl)
  --device <desktop|mobile>   Headless device emulation hint (Phase 4)
  --selector <css>        Wait-for selector for Phase 4
  --user-hint <key=value> Per-call site-specific hint (repeatable)
  --follow                For keyword input: also fetch the top search result URL
  --help                  Show this help

Exit codes:
  0  success (content returned, ok=true)
  1  exhausted (no probe validated)
  2  invalid input
`;

const HINT_KEY_BLOCK = new Set(["__proto__", "constructor", "prototype"]);

function parseArgs(argv) {
  const userHints = Object.create(null);
  const opts = { url: null, json: false, trace: false, maxPhase: undefined, allowPaid: false, followFirstResult: false, device: undefined, selector: undefined, userHints };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") { console.log(HELP); process.exit(0); }
    else if (a === "--json") opts.json = true;
    else if (a === "--trace") opts.trace = true;
    else if (a === "--allow-paid") opts.allowPaid = true;
    else if (a === "--follow") opts.followFirstResult = true;
    else if (a === "--max-phase") opts.maxPhase = Number(args[++i]);
    else if (a === "--device") opts.device = args[++i];
    else if (a === "--selector") opts.selector = args[++i];
    else if (a === "--user-hint") {
      const kv = args[++i] || "";
      const eq = kv.indexOf("=");
      if (eq > 0) {
        const key = kv.slice(0, eq);
        if (!HINT_KEY_BLOCK.has(key)) userHints[key] = kv.slice(eq + 1);
      }
    }
    else if (!opts.url && !a.startsWith("-")) opts.url = a;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.url) {
    process.stderr.write("error: URL required\n\n" + HELP);
    process.exit(2);
  }
  const result = await runChain(opts.url, {
    maxPhase: opts.maxPhase,
    allowPaid: opts.allowPaid,
    followFirstResult: opts.followFirstResult,
    device: opts.device,
    selector: opts.selector,
    userHints: opts.userHints,
  });

  if (opts.json) {
    if (!opts.trace) result.trace = result.trace?.slice(-3);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    if (result.ok) {
      process.stdout.write(`# ok phase=${result.phase} probe=${result.probe} elapsed=${result.elapsed_ms}ms\n`);
      if (result.title) process.stdout.write(`# title: ${result.title}\n`);
      process.stdout.write(`# meta: ${JSON.stringify(result.meta || {})}\n\n`);
      process.stdout.write(result.content + "\n");
    } else {
      process.stderr.write(`fail: ${result.reason || "exhausted"} (phase=${result.phase || "?"}, ${result.elapsed_ms}ms)\n`);
      if (opts.trace) process.stderr.write(JSON.stringify(result.trace, null, 2) + "\n");
      if (result.content) {
        process.stderr.write("partial content available:\n");
        process.stdout.write(result.content + "\n");
      }
    }
  }
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err?.stack || err}\n`);
  process.exit(1);
});

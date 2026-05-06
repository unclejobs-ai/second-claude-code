---
description: "Plan/Gather phase -- adaptive zero-key fetch chain for blocked or hardened web pages"
argument-hint: "https://example.com/blocked-article"
---

Invoke the `/second-claude-code:unblock` command to run the loaded `unblock` skill — adaptive 9-phase fetch chain for URLs that WebFetch can't crack (4xx, captcha, WAF, JS-heavy SPAs).

## Context
- Cache dir: !`echo "${UNBLOCK_CACHE_DIR:-$HOME/.cache/unblock}"`
- Jina key: !`[ -n "$JINA_API_KEY" ] && echo "set" || echo "absent (free tier 20 RPM)"`
- Tools: !`which curl_chrome131 lightpanda yt-dlp 2>/dev/null | tr '\n' ' ' | xargs -I {} echo "discovered: {}"`

## Arguments
- First argument: target URL (required) **or** a keyword query (will route through `s.jina.ai`)
- `--device desktop|mobile` — Phase 4 device emulation hint
- `--selector "<css>"` — Phase 4 wait-for selector
- `--max-phase <N>` — cap chain at phase N (default 5)
- `--allow-paid` — permit Phase 6 paid providers (Tavily / Exa / Firecrawl)
- `--follow` — keyword input: also fetch the top result URL
- `--user-hint key=value` — per-call site-specific hint (repeatable)
- `--trace` — include full per-phase trace + orchestration decisions in output
- `--json` — emit JSON to stdout

## Your task

Run the chain by invoking the CLI:

```bash
node skills/unblock/engine/cli.mjs "<input>" [options]
```

Return the validated content directly. If the chain exhausts without success,
surface the failure reason and the trace tail so the caller can adjust
arguments and retry — never retry blindly with the same arguments.

If the result has `meta.partial: true`, flag it explicitly: the OG-tag rescue
or hidden-API discovery caught only metadata, not the live page body.

If the result has `meta.discovered_apis`, list the captured endpoints — they
are the hidden internal JSON APIs that backed the page, often more useful
than the rendered HTML.

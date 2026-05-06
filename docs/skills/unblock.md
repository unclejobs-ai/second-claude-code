# Unblock

> Adaptive 9-phase fetch chain that hands back validated content for URLs WebFetch can't crack — or a structured failure trace. Zero API keys.

## Quick Example

```
This LinkedIn article won't load: https://www.linkedin.com/pulse/abc-xyz
```

**What happens:** The chain probes the URL through up to 9 escalating phases, stopping at the first probe whose body passes the 4-layer validator. For LinkedIn-class login walls, Phase 5 archive cluster (Wayback / archive.today / OG-rescue) usually wins. For a YouTube URL, Phase 0c yt-dlp returns the title + description + transcript without ever loading the page.

## Real-World Example

**Input:**
```
/second-claude-code:unblock "https://news.ycombinator.com/item?id=42000000"
```

**Process:**
1. URL host pattern matches `hn-item` — Phase 0a calls `hn.algolia.com/api/v1/items/42000000`.
2. JSON parses cleanly, body validates, title extracted.
3. Chain returns at Phase 0a in ~300ms with full thread + comments rendered as markdown.

**Output:**
```json
{
  "schema_version": 1,
  "ok": true,
  "url": "https://news.ycombinator.com/item?id=42000000",
  "phase": "0a",
  "probe": "public-api/hn-item",
  "elapsed_ms": 317,
  "title": "...",
  "content": "# ...\n\n## Comments\n- ...",
  "meta": { "author": "...", "points": 142 },
  "trace": [...],
  "decisions": [...],
  "idempotency_key": "t8fniy"
}
```

## When to Use

- Eevee researcher hits 403/blocked during `/second-claude-code:research`
- Manual fetch of a known-hostile site (X, LinkedIn, Naver, Coupang, fmkorea, etc.)
- WebFetch returns truncated/empty body for a JS-heavy SPA
- Pipeline step needs guaranteed page content, not best-effort

Skip if you just need keyword search — call `s.jina.ai` directly.

## Phases

| Phase | Probe | Cost | Auto without keys? |
|-------|-------|------|--------------------|
| 0a | Public APIs (Reddit / HN / arXiv / Bluesky / GitHub / NPM / Stack Exchange / Wikipedia / Mastodon / Lemmy / oEmbed) | free | yes |
| 0b | Jina Reader (`r.jina.ai`) | free at 20 RPM | yes |
| 0c | yt-dlp metadata + subtitles (1800+ media sites) | free | yes (auto-install) |
| 0d | Jina Search keyword routing | free at 20 RPM | yes (keyword input) |
| 1 | curl with rotating UA × headers × URL transforms | free | yes |
| 2 | curl-impersonate TLS rotation + cookie warming + referrer chain | free | yes (auto-install) |
| 3 | LightPanda headless | free | yes (auto-install) |
| 4 | Playwright real Chrome + hidden API discovery | free | yes (auto-install) |
| 5 | Free archives: Wayback + archive.today + AMP + RSS + OG rescue | free | yes |
| 6 | Optional paid (Tavily / Exa / Firecrawl) — `--allow-paid` only | paid | needs flag |

The chain stops at the first probe whose body passes `validate.mjs`. Phase 6 never runs implicitly.

## Options

| Flag | Effect |
|------|--------|
| `--json` | Emit JSON to stdout |
| `--trace` | Include full per-phase trace + orchestration decisions |
| `--max-phase <N>` | Cap chain at phase N (default 5) |
| `--allow-paid` | Permit Phase 6 paid providers |
| `--device desktop\|mobile` | Phase 4 device emulation hint |
| `--selector "<css>"` | Phase 4 wait-for selector |
| `--follow` | Keyword input: also fetch the top result URL |
| `--user-hint key=value` | Per-call site-specific hint (repeatable) |

## Eevee Researcher Integration

Eevee invokes Unblock automatically when `WebFetch` returns:
- HTTP 4xx or 5xx
- Body shorter than 200 chars after stripping markup
- Body matching known challenge signatures (Cloudflare, captcha, WAF)
- Content-type mismatch

See `skills/unblock/references/eevee-flow.md` for the call sequence.

## Orchestration

The chain is more than linear escalation:

- **URL host priors** reorder Phase 0 (`["0c","0a","0b"]` for video hosts, `["0a","0b","0c"]` for known public-API hosts).
- **Signal-driven dynamic skip**: Phase 1 returning 200 with `stripped_too_short` jumps directly to Phase 4, skipping 2 and 3 (it's a JS-rendered SPA, header rotation won't help).
- **Stagnation detection**: same fail reason across 3+ phases short-circuits the live chain to Phase 5 archive.
- **TLS multi-rotation in Phase 2**: cookie jar carries between chrome131 → safari17_0 → firefox133 attempts.
- **Hidden API discovery in Phase 4**: same-origin XHR responses with structured content-type are surfaced as `meta.discovered_apis` when the rendered HTML fails validation.

## Hard Rules

**R1** — No site-name hardcoding in `engine/**` outside the Phase 0a public-API allowlist. Site-specific scraping hints flow only via `--user-hint`.

**R2** — Validate before declare. Every probe result passes through the 4-layer validator (status, body length, challenge body, content-type).

**R3** — Auto-install on miss. Missing binary triggers a one-time install attempt. Never block the chain.

**R4** — Trace is mandatory on failure.

**R5** — Read trace before retry. Identical retries are forbidden.

**R6** — Paid is opt-in. Phase 6 never runs without `--allow-paid`.

**R7** — Single-user CLI, not a service. SSRF guard rejects RFC1918 / loopback / link-local / cloud metadata hosts; opt out via `UNBLOCK_ALLOW_PRIVATE_HOSTS=1`.

## Configuration

| Variable | Effect |
|----------|--------|
| `JINA_API_KEY` | Lifts Jina Reader 20 RPM cap |
| `TAVILY_API_KEY` / `EXA_API_KEY` / `FIRECRAWL_API_KEY` | Phase 6 only with `--allow-paid` |
| `UNBLOCK_TIMEOUT_MS` | Per-probe timeout (default 15000) |
| `UNBLOCK_MAX_PHASE` | Cap chain (default 5) |
| `UNBLOCK_CACHE_DIR` | Cookie + binary cache (default `~/.cache/unblock`) |
| `UNBLOCK_ALLOW_PRIVATE_HOSTS` | Set `1` to disable SSRF guard |

## Related Skills

- `research` — invokes `unblock` when a fetched source returns blocked content
- `pdca` — Plan phase chains research → unblock fallback automatically

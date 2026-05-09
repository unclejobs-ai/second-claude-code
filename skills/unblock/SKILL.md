---
name: unblock
description: "Use when a fetched URL returns 4xx/blocked, hits a WAF or captcha, or when a JS-heavy SPA returns no usable body. Escalates through public APIs, Jina Reader, header-diverse curl, TLS impersonation, headless browsers, and free archive mirrors until validated content is returned. Zero API keys."
effort: medium
---

# Unblock — Adaptive Fetch Chain (Zero-Key)

> No API keys. No signup. No config. Every phase runs on public endpoints,
> rate-limited free tiers, or self-hosted binaries that auto-install. Paid
> providers exist only behind explicit `--allow-paid`.

## Iron Law

> **First HTTP 200 is not success. Validate the body first.**

A 200 with a Cloudflare challenge HTML, a login wall, or an empty SPA shell
is failure. The chain stops only when content passes `engine/validate.mjs`.

## Phases

| Phase | Probe | Cost | Auto without keys? |
|-------|-------|------|--------------------|
| 0a | Public APIs (Reddit, HN, arXiv, Bluesky, GitHub, NPM, oEmbed) | free | yes |
| 0b | Jina Reader (`r.jina.ai`) | free at 20 RPM | yes |
| 0c | yt-dlp metadata + subtitles (1800+ media sites) | free | yes (auto-install) |
| 0d | Native cleaner (host-specific body extractor) | free | yes |
| 1 | curl with rotating UA × headers × URL transforms | free | yes |
| 2 | curl-impersonate (TLS spoof) + cookie warming + referrer chain | free | yes (auto-install) |
| 3 | LightPanda headless | free | yes (auto-install) |
| 4 | Playwright real Chrome | free | yes (auto-install) |
| 5 | Free archives: Wayback + archive.today + AMP + RSS + OG rescue | free | yes |
| 6 | Optional paid (Tavily / Exa / Firecrawl) | paid | needs `--allow-paid` |

The chain stops at the first probe whose body passes `validate.mjs`. Phase 6
never runs implicitly even with env keys present.

### Pre-chain URL normalization

Before any probe runs, hosts that hide their body inside an iframe shell are
rewritten to their canonical body URL. Example:

- `blog.naver.com/{id}/{logNo}` → `m.blog.naver.com/{id}/{logNo}`
- `blog.naver.com/PostView.naver?blogId=…&logNo=…` → `m.blog.naver.com/{id}/{logNo}`

The decision is logged to `decisions[]` with `action: "normalize"`. Both the
rewritten `url` and the caller's `original_url` appear in the result envelope.

## Phase 0d — Native Cleaners

Host-specific body extractors that turn raw HTML into chrome-free markdown
(no nav, footer, sidebar). Each cleaner:

- Lives in `engine/cleaners/<host>.mjs`
- Exports `extract(html, url) -> { ok, markdown, title, author, published, blocks, chars }` or returns `null` on no-match
- Registered in `engine/cleaners/index.mjs` with a host predicate

Phase 0d runs **first** for any URL whose host has a registered cleaner.
When it succeeds the output is materially cleaner (and faster) than Jina;
when it fails the chain falls through to 0a → 0b → … as usual.

| Cleaner | Hosts | Selector |
|---------|-------|----------|
| `naver` | `*.blog.naver.com` (after normalization → `m.blog.naver.com`) | SmartEditor `se-text-paragraph` / `se-image` / `se-quotation-line` |
| `tistory` | `*.tistory.com` | `tt_article_useless_p_margin` / `article-view` / `entry-content` |
| `brunch` | `brunch.co.kr` | `wrap_body` → `wrap_item` / `cont` |

To add a host: write `engine/cleaners/<host>.mjs` exporting an `extract`
function with the contract above, then register it in
`engine/cleaners/index.mjs`. The new cleaner is picked up automatically.

## When to Use

- Eevee researcher hits 403/blocked during `/second-claude-code:research`
- Manual fetch of a hostile site
- WebFetch returns truncated/empty body for JS-heavy SPAs

Not for plain keyword search (use Jina Search via `s.jina.ai`) or bulk crawls.

## Quick Start

```bash
node skills/unblock/engine/cli.mjs "<URL>"
node skills/unblock/engine/cli.mjs "<URL>" --device mobile --json
node skills/unblock/engine/cli.mjs "<URL>" --selector "article" --trace
node skills/unblock/engine/cli.mjs "<URL>" --max-phase 4
```

Exit codes: `0` success, `1` exhausted, `2` invalid input.

## Phase 0a — Public APIs (instant win)

Dispatched by URL host pattern.

| Pattern | Endpoint | Returns |
|---------|----------|---------|
| `reddit.com/r/*/comments/*` | `<url>.json` | post + comments |
| `news.ycombinator.com/item?id=N` | `hn.algolia.com/api/v1/items/N` | full thread |
| `arxiv.org/abs/*` | `export.arxiv.org/api/query` | abstract + metadata |
| `bsky.app/profile/*/post/*` | `public.api.bsky.app` | post + replies |
| `github.com/<o>/<r>` and issues/PR | `api.github.com` | repo / issue + comments |
| `npmjs.com/package/<p>` | `registry.npmjs.org/<p>` | package + readme |
| pages exposing `<link rel="alternate" type="application/json+oembed">` | discovered URL | oEmbed JSON |

## Phase 5 — Free Archive Fallback

When Phases 1–4 all fail, the chain tries free mirrors before giving up:
Wayback Machine, archive.today, AMP cache, RSS/Atom feed discovery, OG-tag
rescue (using a Facebook scraper UA against pages that gate humans but expose
metadata). Results carry `via_archive: true`; OG-rescue results also carry
`partial: true`. See `references/archive-fallbacks.md`.

## Phase 2 — Cookie Warming + Referrer Chain

`curl-impersonate` does not just spoof TLS. The probe runs a 2-hop sequence:

1. GET `https://<host>/` with empty referrer → captures `Set-Cookie`
2. GET target URL with referrer = locale-matched search engine, cookies = step 1 jar

Defeats homepage-cookie gates and referrer-checking news sites without
per-site rules.

## Phase 1 — Header Diversity

Each retry rotates User-Agent and: `Accept-Language` matched to TLD,
`Sec-Ch-Ua` / `Sec-Ch-Ua-Mobile` / `Sec-Ch-Ua-Platform` (Chrome 131 client
hints), `Sec-Fetch-Dest` / `Mode` / `Site`, `Accept-Encoding: gzip, deflate,
br, zstd`. WAFs gating on missing client hints fall here without escalation.

## Hard Rules

**R1 — No site-name hardcoding.** `engine/profiles.json` and code under
`engine/**` must not contain brand-specific selectors or domain matches
except the Phase 0a public-API allowlist (which routes to public APIs, not
selector scraping). Site-specific scraping hints flow only via `--user-hint`.
Enforced by `tests/skills/unblock/no-brand-hardcode.test.mjs`.

**R2 — Validate before declare.** Every probe result passes through
`validate.mjs`'s 4-layer check (status, body length, challenge body,
content-type) before being returned.

**R3 — Auto-install on miss.** Missing binary triggers a one-time install
attempt. If install fails, skip to next phase. Never block the chain.

**R4 — Trace is mandatory on failure.** Failure mode always returns a JSON
trace listing phase outcomes, error codes, elapsed times.

**R5 — Read trace before retry.** Identical retries are forbidden. Adjust
`--device`, `--selector`, or `--user-hint` based on trace.

**R6 — Paid is opt-in.** Phase 6 never runs without explicit `--allow-paid`.

**R7 — Single-user CLI, not a service.** This skill fetches arbitrary
user-supplied URLs without internal-IP filtering. Do not expose its CLI
behind a network endpoint without adding host allowlisting upstream — it can
otherwise be used to probe `169.254.169.254` and other private ranges (SSRF).

## Eevee Researcher Integration

Eevee invokes Unblock automatically when WebFetch returns 4xx/5xx, an
under-200-char body, a known challenge signature, or content-type mismatch.
See `references/eevee-flow.md`.

## Output

Returns JSON with `ok`, `url`, `phase`, `probe`, `elapsed_ms`, `content`,
`title`, `meta`, `trace`. Trace records every probe outcome. On exhaustion,
`content` may still be present with `partial: true` if Phase 5 OG-rescue
caught anything.

## Configuration

All optional. Defaults work zero-key.

| Variable | Effect |
|----------|--------|
| `JINA_API_KEY` | Lifts Jina Reader 20 RPM cap |
| `TAVILY_API_KEY` / `EXA_API_KEY` / `FIRECRAWL_API_KEY` | Phase 6 only with `--allow-paid` |
| `UNBLOCK_TIMEOUT_MS` | Per-probe timeout (default 15000) |
| `UNBLOCK_MAX_PHASE` | Cap chain (default 5) |
| `UNBLOCK_CACHE_DIR` | Cookie + binary cache (default `~/.cache/unblock`) |
| `UNBLOCK_SKIP_NETWORK_TESTS` | Skip network-touching tests |
| `UNBLOCK_ALLOW_PRIVATE_HOSTS` | Set `1` to disable SSRF guard (private/loopback/metadata). |

## Files

```
engine/
  cli.mjs           argv, exit code, output
  chain.mjs         orchestrator, escalation
  detect.mjs        challenge / WAF signatures
  validate.mjs      4-layer success validator
  transforms.mjs    URL variants + locale-aware headers
  intent.mjs        URL vs keyword router
  cookie-jar.mjs    in-memory Set-Cookie jar
  install.mjs       auto-install binaries
  profiles.json     UAs, transforms, validator thresholds
  probes/{public-api,jina,yt-dlp,curl,impersonate,lightpanda,playwright,archive,paid-api}.mjs
references/{waf-detection,tls-impersonation,archive-fallbacks,eevee-flow}.md
```

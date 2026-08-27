[한국어](unblock.ko.md)

# Unblock

> Recover readable content from blocked or JS-heavy URLs, or return a validated failure trace.

The default phases require no API key (“zero-key”). Paid providers are never
used unless `--allow-paid` is supplied. Some optional local binaries can be
installed once, on a best-effort basis, when missing; the install may require a
package manager, network access, and user permissions, and is not guaranteed.

## When to use

Use `/scc:unblock <URL>` when WebFetch returns a 4xx/5xx, an empty or truncated
body, a challenge page, or a JS-heavy SPA. A keyword input routes through Jina
Search; use direct Jina Search when you only need search results.

## Quick example

```text
/scc:unblock "https://news.ycombinator.com/item?id=42000000" --json
```

The adaptive chain tries the most useful probes for the host and stops at the
first result that passes status, body-length, challenge-body, and content-type
validation. On exhaustion, read the trace before changing arguments; identical
retries are not useful.

## Phases

| Phase | Probe | Default-key behavior |
|---|---|---|
| `0a` | Public APIs for known services | no key |
| `0b` | Jina Reader (`r.jina.ai`) | no key; optional key lifts its 20 RPM cap |
| `0c` | `yt-dlp` metadata/subtitles | may attempt one-time install if available |
| `0d` | Jina Search keyword routing | no key for the free path |
| `1` | `curl` headers, user agents, URL transforms | no key |
| `2` | curl-impersonate TLS/cookie/referrer variants | may attempt one-time install if available |
| `3` | LightPanda headless browser | may use `npx` one-time install if available |
| `4` | Playwright Chrome + hidden API discovery | may use `npx` one-time install if available |
| `5` | Free archives, AMP/RSS, OG rescue | no key |
| `6` | Tavily/Exa/Firecrawl | paid; only with `--allow-paid` and a provider key |

The default `--max-phase` is `5`, so Phase 6 is outside the default run.

## Options

| Flag | Effect |
|---|---|
| `--json` | Emit machine-readable JSON. |
| `--trace` | Include per-phase trace and orchestration decisions. |
| `--max-phase <N>` | Stop at phase `N` (default `5`). |
| `--allow-paid` | Opt in to Phase 6 paid providers. |
| `--device desktop\|mobile` | Device hint for Phase 4. |
| `--selector "<css>"` | Wait-for selector for Phase 4. |
| `--follow` | For keyword input, also fetch the top result URL. |
| `--user-hint key=value` | Repeatable site-specific hint. |

On success, return `content` and metadata. On failure, return the reason and
trace tail. If `meta.partial: true`, say that only metadata was recovered. If
`meta.discovered_apis` exists, list those captured same-origin endpoints.

## Safety and integration

- Validate every probe before declaring success.
- Paid access is opt-in; do not silently pass `--allow-paid`.
- Failed runs include a trace; read it before retrying.
- The single-user CLI rejects private, loopback, link-local, and cloud-metadata
  hosts unless `UNBLOCK_ALLOW_PRIVATE_HOSTS=1` is explicitly set.

`research` uses this path when a source is blocked. `pdca` may reach it through
the Plan fallback. See `skills/unblock/references/eevee-flow.md` for the exact
research handoff.

## Configuration

| Variable | Purpose |
|---|---|
| `JINA_API_KEY` | Raises the Jina Reader rate limit. |
| `TAVILY_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY` | Enable the matching paid provider only with `--allow-paid`. |
| `UNBLOCK_TIMEOUT_MS` | Per-probe timeout (default `15000`). |
| `UNBLOCK_MAX_PHASE` | Default phase cap (default `5`). |
| `UNBLOCK_CACHE_DIR` | Cookie/binary cache (default `~/.cache/unblock`). |
| `UNBLOCK_ALLOW_PRIVATE_HOSTS=1` | Explicitly disables the SSRF guard. |

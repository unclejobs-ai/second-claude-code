# Eevee → Unblock Fallback Flow

When the Eevee researcher (`agents/eevee.md`, name `researcher`) hits a hostile
URL during `/second-claude-code:research`, it must hand off to `unblock`
rather than retry with raw curl.

## Trigger conditions

Invoke `unblock` when **any** of:

- `WebFetch` returns HTTP 4xx or 5xx
- Body shorter than 200 chars after stripping markup
- Body matches known challenge patterns (Cloudflare "Just a moment", captcha,
  WAF challenge, login wall)
- Content-type mismatch (HTML expected, JSON or empty returned)
- Empty SPA shell — DOM with `<noscript>` and no article body

## Call shape

```bash
node skills/unblock/engine/cli.mjs "<URL>" --json
```

Returns JSON with `ok`, `phase`, `probe`, `content`, `title`, `meta`, `trace`.

If `ok: true`, proceed with `content` as the page text.

If `ok: false`:
1. Read the `trace` array — what phase did each probe stop at?
2. If a phase shows `status: "skipped"` with reason `*_unavailable`, the
   binary is missing locally; do not retry the same call.
3. Adjust **one** argument and call again:
   - `--device mobile` if desktop UA hit a mobile-only path
   - `--selector "<css>"` if Phase 4 needs to wait for a specific element
   - `--user-hint key=value` for a per-site escape hatch (e.g.
     `--user-hint locale=ko-KR`)
4. Never repeat the exact same call. Identical retries are forbidden by R5.

## Partial-success handling

If `ok: false` but `content` is present and `meta.partial === true`, the OG-tag
rescue caught at least the title + description from a gated page. Use the
partial content with an explicit caveat in the research brief — flag the
source as `partial` so downstream consumers know the body was not fully
recovered.

## Cost discipline

Phase 6 paid providers (Tavily / Exa / Firecrawl) require explicit
`--allow-paid`. Eevee must **not** pass `--allow-paid` without surfacing the
cost to the user first. The default chain is fully zero-key and should resolve
the vast majority of blocked URLs through Phases 0–5.

## Example trace interpretation

```json
{
  "ok": false,
  "phase": 4,
  "trace": [
    { "phase": "0a", "probe": "public-api/router", "status": "skipped", "reason": "no_pattern_match" },
    { "phase": "0b", "probe": "jina-reader", "status": "fail", "code": 451 },
    { "phase": 1, "probe": "curl-variants", "status": "fail" },
    { "phase": 2, "probe": "impersonate", "status": "skipped", "reason": "curl_impersonate_unavailable" },
    { "phase": 3, "probe": "lightpanda", "status": "skipped", "reason": "lightpanda_unavailable" },
    { "phase": 4, "probe": "playwright", "status": "fail" }
  ]
}
```

Reading: Jina hit a regional block (451), curl variants failed validation,
TLS impersonation and LightPanda binaries weren't installed, Playwright
ran but couldn't validate. **Action**: install `curl-impersonate` (most
likely fix), or try `--device mobile` for Playwright. Do not call
`--allow-paid` without user confirmation.

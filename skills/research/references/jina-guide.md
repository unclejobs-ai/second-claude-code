# Jina Reader/Search API — Quick Reference

Jina provides two endpoints for web content retrieval, both returning LLM-optimized markdown.

## Endpoints

| Endpoint | Purpose | Latency | Auth |
|----------|---------|---------|------|
| `s.jina.ai` | Search + content extraction (one call) | ~2.5s | Required |
| `r.jina.ai` | Single URL → markdown | ~7.9s | Optional (20 RPM without key) |

## Search API (`s.jina.ai`) — Primary

Replaces WebSearch + WebFetch in a single call. Returns top 5 results with full content extracted.

```bash
curl -s "https://s.jina.ai/" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Retain-Images: none" \
  -d '{"q":"search query","gl":"us","hl":"en","num":5}'
```

### Response parsing

```bash
curl -s "https://s.jina.ai/" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Retain-Images: none" \
  -d "{\"q\":\"$QUERY\"}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('data',[]):
    print(f\"## {r.get('title','')}\")
    print(f\"URL: {r.get('url','')}\")
    print(r.get('content','')[:2000])
    print('---')
"
```

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `q` | string (required) | Search query |
| `gl` | string | Country code (`kr`, `us`, etc.) |
| `hl` | string | Language (`ko`, `en`, etc.) |
| `num` | number | Max results (default 5) |
| `page` | number | Result offset for pagination |

### Headers

| Header | Value | Use case |
|--------|-------|----------|
| `X-Site` | domain URL | Limit search to specific domain |
| `X-Retain-Images` | `none` | Remove images, save tokens |
| `X-No-Cache` | `true` | Bypass cache for fresh data |
| `X-Engine` | `browser` / `direct` | Quality vs speed tradeoff |
| `X-Token-Budget` | number | Max tokens per request |

### Source domain mapping

| `--sources` flag | Jina equivalent |
|-----------------|-----------------|
| `web` | No `X-Site` header (default) |
| `academic` | `X-Site: https://scholar.google.com` + separate call with `X-Site: https://arxiv.org` |
| `news` | Add `after:30d` to query string |

## Reader API (`r.jina.ai`) — Deep Read

For extracting full content from a known URL when Search results are truncated.

```bash
curl -s "https://r.jina.ai/" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Retain-Images: none" \
  -d '{"url":"https://example.com/article"}'
```

### Useful headers for deep read

| Header | Value | Effect |
|--------|-------|--------|
| `X-Target-Selector` | CSS selector | Extract only matching elements (e.g., `article`, `.post-content`) |
| `X-Remove-Selector` | CSS selector | Exclude nav, footer, ads |
| `X-Wait-For-Selector` | CSS selector | Wait for dynamic content to load |
| `X-Respond-With` | `readerlm-v2` | Use specialized HTML→Markdown model (3x token cost, higher quality) |
| `X-Return-Format` | `markdown` / `text` / `screenshot` | Output format |

## Fallback Chain

```
Jina Search (s.jina.ai)
  └─ success → use content
  └─ failure (rate limit, API error, empty) → WebSearch + WebFetch fallback
       └─ WebFetch failure → Playwright (browser_navigate + browser_snapshot)
            └─ Playwright unavailable → note in Gaps & Limitations
```

## Kimi Synergy

When mmbridge is detected, Jina and Kimi complement each other:
- **Jina**: fast, clean web content extraction (structured markdown)
- **Kimi**: deep reasoning and synthesis across sources (BrowseComp 60.6%)

Enhanced parallel dispatch:
```
┌─ researcher: Jina Search (clean content) ─────────┐
│                                                     ├→ analyst: merge + dedup
└─ mmbridge research (Kimi deep analysis) ───────────┘
```

Jina provides higher-quality input to the analyst because:
1. No navigation noise (vs WebFetch)
2. No fallback chain failures (vs WebFetch → Playwright)
3. Content already markdown-formatted for LLM consumption
4. Kimi's independent analysis cross-validates Jina findings

## Rate Limits

| Tier | Reader (r.) | Search (s.) |
|------|------------|-------------|
| No key | 20 RPM | Blocked |
| Free key | 500 RPM | 100 RPM |
| Premium | 5000 RPM | 1000 RPM |

## Error Handling

| Error | Action |
|-------|--------|
| `AuthenticationRequiredError` | Check `$JINA_API_KEY` env var |
| Rate limit (429) | Fall back to WebSearch + WebFetch |
| Empty `data` array | Query too specific, broaden search terms |
| Content blocked by site | Fall back to Playwright for that URL |
| Network timeout | Retry once, then fall back |

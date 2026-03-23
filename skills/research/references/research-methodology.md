# Research: Methodology & Output Details

## Output Format

```markdown
# Research Brief: {topic}

## Executive Summary
(3-5 sentence synthesis)

## Key Findings
1. (finding with supporting evidence)

## Data Points
| Metric | Value | Source |
|--------|-------|--------|

## Gaps & Limitations
- (what could not be confirmed)

## Sources
1. [Title](URL) - accessed {date} - (relevance note)
```

## Web Engine & Fallback Chain

### Primary: Jina Search (`s.jina.ai`)

When `$JINA_API_KEY` is set, use Jina Search as the primary tool. Each call returns search results WITH full content — no separate fetch needed.

```bash
curl -s "https://s.jina.ai/" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Retain-Images: none" \
  -d '{"q":"query","gl":"us","hl":"en"}'
```

For deep reads of specific URLs, use Jina Reader (`r.jina.ai`):

```bash
curl -s "https://r.jina.ai/" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-Retain-Images: none" \
  -H "X-Target-Selector: article, .post-content, main" \
  -d '{"url":"https://example.com/article"}'
```

### Decision tree

```
$JINA_API_KEY set?
  ├─ yes → Jina Search(query)
  │         └─ success → use content (search + extract done)
  │         └─ specific URL blocked → Jina Reader(url) with X-Engine: browser
  │              └─ success → use content
  │              └─ failure → Playwright available?
  │                   ├─ yes → browser_navigate + browser_snapshot → parse tree
  │                   └─ no  → discard, note in Gaps & Limitations
  └─ no  → WebSearch(query) → WebFetch(url)
            └─ WebFetch failure → Playwright fallback (same as above)
```

### Playwright Fallback (unchanged)

Playwright is the last-resort fallback, used only when both Jina and WebFetch fail.

### Why accessibility tree over raw HTML

The `browser_snapshot()` tool returns an accessibility tree rather than raw HTML. This representation:
- Omits navigation chrome, ads, and boilerplate
- Is structured as labeled roles (heading, paragraph, cell) rather than tag soup
- Typically 80-90% fewer tokens than equivalent raw HTML for the same information density

### Cost controls

- Max **3 Playwright navigations per research round** (shallow, medium, or deep gap-fill round counts separately)
- If the cap is reached: skip remaining Playwright fetches, proceed with available content
- If `--interactive` flag is set: use Playwright for all URL fetches (no WebFetch); the cap still applies

### Graceful degradation

Playwright MCP is **optional**. If the `playwright` server is absent or fails to start:
- Research skill continues using WebFetch only
- No error is raised
- URLs that WebFetch cannot read are documented in Gaps & Limitations

## Gotchas

| Failure Mode | Mitigation |
|-------------|------------|
| Stops after 1 search | researcher MUST execute depth minimum: shallow 3, medium 5, deep 10. |
| Lists links without analysis | analyst required. Raw link dumps rejected. |
| Hallucinated sources | Every URL must come from actual Jina Search/WebSearch. writer cannot invent URLs. |
| Duplicate queries | researcher must vary phrasing with synonyms and different angles. |
| English-only sources | When `--lang ko`, include Korean queries in 30%+ of searches. With Jina, set `gl=kr, hl=ko`. |
| Unreadable fetched content | Validate responses; reject login walls, blocked pages. Try Jina Reader with `X-Engine: browser` before Playwright fallback. |
| Conflicting data points | analyst MUST flag discrepancies. Apply conflict resolution rules. |
| Stale sources | Flag sources older than 6 months on trend topics. Prefer last 3 months. |
| Coverage gaps at deep depth | Verify coverage requirements before synthesis. Document known gaps. |
| JS-heavy / SPA pages returning empty content | Try Jina Reader with `X-Engine: browser` first. Then Playwright: `browser_navigate` + `browser_snapshot`. Max 3 per round. |
| Playwright cap exceeded | Stop navigations, note skipped URLs in Gaps & Limitations, proceed to synthesis. |
| Playwright MCP not installed | Graceful degradation — continue with Jina/WebFetch only, no error thrown. |
| Jina API key missing | Fall back to WebSearch + WebFetch silently. No error. |
| Jina rate limit (429) | Fall back to WebSearch + WebFetch for remaining queries in this round. |

## Subagent Dispatch

```yaml
researcher:
  model: sonnet
  tools: [Bash, WebSearch, WebFetch, browser_navigate, browser_snapshot]
  constraint: "use Jina Search via Bash/curl when $JINA_API_KEY is set; fall back to WebSearch+WebFetch otherwise; meet depth minimums, vary phrasing, validate fetched content, flag staleness; Playwright tools optional — use only when Jina and WebFetch both fail or --interactive set; max 3 Playwright navigations per round"

analyst:
  model: sonnet
  tools: [none - works on researcher output]
  constraint: "produce gap list, flag data conflicts, verify coverage requirements"

writer:
  model: sonnet
  tools: [none - works on analyst output]
  constraint: "every claim needs a source, no invented URLs, include conflict annotations"
```

## Integration

- Called automatically by `/second-claude-code:write` before drafting
- Called optionally by `/second-claude-code:analyze` when `--with-research` is set
- Research results are saved to `.captures/` but not deduplicated across calls within a session. Callers should check for existing `.captures/research-{slug}*.md` files before re-running to avoid redundant searches.

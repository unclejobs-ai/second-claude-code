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

## Playwright Fallback

When `WebFetch` returns empty content or an error for a URL, use the Playwright MCP browser tools as a fallback before discarding the source.

### Decision tree

```
WebFetch(url)
  └─ success (body has readable text) → use content
  └─ failure (empty / error / minified JS) → Playwright available?
       ├─ yes → browser_navigate(url) → browser_snapshot() → parse tree
       │         └─ success → use extracted content
       │         └─ failure → discard, note in Gaps & Limitations
       └─ no  → discard, note in Gaps & Limitations
```

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
| Hallucinated sources | Every URL must come from actual WebSearch. writer cannot invent URLs. |
| Duplicate queries | researcher must vary phrasing with synonyms and different angles. |
| English-only sources | When `--lang ko`, include Korean queries in 30%+ of searches. |
| Unreadable fetched content | Validate responses; reject minified JS, login walls, error pages. |
| Conflicting data points | analyst MUST flag discrepancies. Apply conflict resolution rules. |
| Stale sources | Flag sources older than 6 months on trend topics. Prefer last 3 months. |
| Coverage gaps at deep depth | Verify coverage requirements before synthesis. Document known gaps. |
| JS-heavy / SPA pages returning empty content | Fall back to Playwright: `browser_navigate` + `browser_snapshot`. Max 3 per round. |
| Playwright cap exceeded | Stop navigations, note skipped URLs in Gaps & Limitations, proceed to synthesis. |
| Playwright MCP not installed | Graceful degradation — continue with WebFetch only, no error thrown. |

## Subagent Dispatch

```yaml
researcher:
  model: haiku
  tools: [WebSearch, WebFetch, browser_navigate, browser_snapshot]
  constraint: "meet depth minimums, vary phrasing, validate fetched content, flag staleness; Playwright tools optional — use only when WebFetch fails or --interactive set; max 3 Playwright navigations per round"

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

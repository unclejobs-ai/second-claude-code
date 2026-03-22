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

## Subagent Dispatch

```yaml
researcher:
  model: haiku
  tools: [WebSearch, WebFetch]
  constraint: "meet depth minimums, vary phrasing, validate fetched content, flag staleness"

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

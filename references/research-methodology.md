# Research Methodology Reference

Deep-dive details on coverage requirements, data conflict resolution, and design influences for the research skill.

---

## Coverage Requirements (by depth)

| Depth | Min English Sources | Min Non-English Sources | Min Primary Sources | Notes |
|-------|--------------------|-----------------------|--------------------|----|
| `shallow` | 2 | 0 | 0 | Speed over breadth |
| `medium` | 3 | 0 (1 if topic is international) | 1 | Primary = official docs, whitepapers, or survey data |
| `deep` | 3 | 1 (if topic has non-English ecosystem relevance) | 1 | Non-English: Korean, Chinese, Japanese, etc. based on topic domain. Primary source is mandatory. |

"Primary source" means official documentation, published whitepapers, peer-reviewed papers, or original survey/benchmark data -- not blog summaries or aggregator articles.

## Data Conflict Resolution

When the same data point (e.g., GitHub stars, market share, release date) appears with different values across sources:

1. **Note the discrepancy explicitly** in the analyst output -- never silently pick one.
2. **Prefer the most authoritative source**: official project page > GitHub API > third-party tracker > blog post.
3. **Prefer the most recent source**: a 2026 measurement beats a 2024 snapshot, unless the older source is the canonical origin.
4. **Include both values in the brief** with annotations when the gap is significant (>10% difference or qualitatively different conclusion). Format: `Value A (Source X, date) vs Value B (Source Y, date)`.
5. **Never average conflicting numbers** -- report the range or the most trustworthy value with a note.

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
- Output cached per session to avoid redundant searches

## Patterns Absorbed

- **Karpathy autoresearch**: Iterative search loop where each round refines based on previous gaps
- **Ars Contexta Record-Reduce**: Collect broadly first, then reduce to structured insight
- **Pi web-crawl pipeline**: Systematic URL collection with deduplication and relevance scoring

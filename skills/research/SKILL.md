---
name: research
description: "Autonomous deep research with iterative web exploration and structured briefs"
---

# Research

Autonomous multi-round web research that produces structured Research Briefs.

## When to Use

- User asks to research a topic, trend, or question
- Another skill (e.g., `/scc:write`, `/scc:analyze`) needs source material
- User wants competitive intelligence, market data, or literature review

## Internal Flow

```
researcher(haiku) ──[WebSearch x5-10]──► raw findings
        │
        ▼
analyst(sonnet) ──[structure + gap analysis]──► gap list
        │
        ▼  (if gaps found)
researcher(haiku) ──[WebSearch x3-5]──► supplemental findings
        │
        ▼
writer(sonnet) ──[synthesis]──► Research Brief
```

### Step-by-Step

1. **Dispatch researcher** (haiku model): Execute 5-10 WebSearch calls across varied query phrasings. Collect raw URLs, snippets, and data points. Never stop at 1 search.
2. **Dispatch analyst** (sonnet model): Structure raw findings into categories. Identify gaps, contradictions, and weak evidence areas. Produce a gap list.
3. **Optional 2nd round**: If analyst finds critical gaps, dispatch researcher again with targeted queries (3-5 additional searches).
4. **Dispatch writer** (sonnet model): Synthesize all findings into the output brief format.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--depth` | `shallow\|medium\|deep` | `medium` | 1 / 3 / 5 search rounds |
| `--sources` | `web\|academic\|news` | `web` | Constrains search domain |
| `--lang` | `ko\|en\|auto` | `auto` | Output language |

### Depth Behavior

- **shallow** (1 round): Quick scan. 5 searches, no gap analysis. Good for simple factual lookups.
- **medium** (3 rounds): Standard. Search, analyze gaps, search again. Covers most use cases.
- **deep** (5 rounds): Exhaustive. Multiple gap-fill cycles. Use for competitive intel or thorough literature review.

## Output Format

```markdown
# Research Brief: {topic}

## Executive Summary
(3-5 sentence synthesis of the most important findings)

## Key Findings
1. (finding with supporting evidence)
2. ...

## Data Points
| Metric | Value | Source |
|--------|-------|--------|
| ...    | ...   | [link] |

## Gaps & Limitations
- (what could not be confirmed)
- (areas needing deeper investigation)

## Sources
1. [Title](URL) - accessed {date} - (one-line relevance note)
2. ...
```

## Gotchas

These failure modes are common. The skill design explicitly counters each one.

| Failure Mode | Mitigation |
|-------------|------------|
| Stops after 1 search | researcher subagent MUST execute minimum 5 searches. Prompt enforces loop count. |
| Lists links without analysis | analyst subagent required. Raw link dumps are rejected; every finding needs a synthesis sentence. |
| Hallucinated sources | Every URL in the brief must come from an actual WebSearch result. writer cannot invent URLs. Fact-check step verifies URL existence. |
| Duplicate queries | researcher must vary query phrasing. Include synonyms, related terms, different angles. |
| English-only sources | When `--lang ko`, include Korean search queries in at least 30% of searches. |

## Patterns Absorbed

- **Karpathy autoresearch**: Iterative search loop where each round refines based on previous gaps
- **Ars Contexta Record-Reduce**: Collect broadly first, then reduce to structured insight
- **Pi web-crawl pipeline**: Systematic URL collection with deduplication and relevance scoring

## Subagent Dispatch

```yaml
researcher:
  model: haiku
  tools: [WebSearch, WebFetch]
  constraint: "minimum 5 searches per round, varied phrasing"

analyst:
  model: sonnet
  tools: [none - works on researcher output]
  constraint: "must produce explicit gap list, no pass-through"

writer:
  model: sonnet
  tools: [none - works on analyst output]
  constraint: "every claim needs a source, no invented URLs"
```

## Integration

- Called automatically by `/scc:write` before drafting
- Called optionally by `/scc:analyze` when `--with-research` is set
- Output cached per session to avoid redundant searches

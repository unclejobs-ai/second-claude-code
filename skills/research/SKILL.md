---
name: research
description: "Use when researching a topic through iterative web exploration and synthesis"
---

# Research

Autonomous multi-round web research that produces structured Research Briefs.

## When to Use

- User asks to research a topic, trend, or question
- Another skill (e.g., `/second-claude-code:write`, `/second-claude-code:analyze`) needs source material
- User wants competitive intelligence, market data, or literature review

## Internal Flow

```
researcher(haiku) --[WebSearch x5-10]--> raw findings
        |
        v
analyst(sonnet) --[structure + gap analysis]--> gap list
        |                                        (shallow: skip gap-fill)
        v  (medium/deep only, if gaps found)
researcher(haiku) --[WebSearch x3-5]--> supplemental findings
        |
        v
writer(sonnet) --[synthesis]--> Research Brief
```

### Step-by-Step

0. **Auto-load template**: Read `references/research-methodology.md` for output format template BEFORE starting any searches.
1. **Dispatch researcher** (haiku): Execute depth-appropriate WebSearch calls across varied query phrasings. Counts are HARD CAPS — see Depth Behavior.
2. **Validate sources**: Verify content is readable — not minified JS, login walls, or error pages. Discard and replace invalid sources.
3. **Dispatch analyst** (sonnet): Structure findings, identify gaps and contradictions. Apply Data Conflict Resolution rules (see `references/research-methodology.md`).
4. **Optional 2nd round**: If analyst finds critical gaps, dispatch researcher again only when depth allows (see Depth Behavior). Shallow depth: skip this step entirely.
5. **Dispatch writer** (sonnet): Synthesize into the output brief format with conflict annotations.
6. **Verification**: Before outputting the brief, count actual WebSearch calls. If count exceeds depth limit, discard excess results and re-synthesize from the capped set.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--depth` | `shallow\|medium\|deep` | `medium` | HARD limit on search rounds — see Depth Behavior |
| `--sources` | `web\|academic\|news` | `web` | Constrains search domain |
| `--lang` | `ko\|en\|auto` | `auto` | Output language. When called from another skill (write, analyze), inherits the caller's `--lang` value. |

### Depth Behavior

- **shallow**: EXACTLY 3 WebSearch calls. No WebFetch deep reads. No gap analysis round. Violation = restart.
- **medium**: EXACTLY 5 WebSearch calls + up to 2 WebFetch. One gap analysis round.
- **deep**: 10+ WebSearch calls. Unlimited WebFetch. Repeated gap-fill cycles until coverage, **max 3 gap-fill rounds**. If gaps remain after 3 rounds, document them in "Gaps & Limitations" and proceed to synthesis.

Coverage requirements and conflict resolution rules are in `references/research-methodology.md`.

### Source Domain (`--sources`)

- **web** (default): General web search. No domain restrictions.
- **academic**: Prefer Google Scholar, arXiv, PubMed, .edu domains. Add `site:scholar.google.com OR site:arxiv.org` to at least 50% of queries.
- **news**: Prefer recent news sources. Add `after:{30-days-ago}` filter. Prioritize Reuters, Bloomberg, TechCrunch, The Verge, and similar editorial sources over blog posts.

## Auto-Save

After producing the Research Brief, save it to a file:

- Path: `.captures/research-{slug}-{YYYY-MM-DD}.md`
- `{slug}` = topic lowercased, spaces to hyphens, max 40 chars
- Write the full brief using the Write tool. Do NOT skip this step.
- Tell the user the saved path.

## Gotchas

| Failure Mode | Mitigation |
|-------------|------------|
| Stops after 1 search | researcher MUST meet depth minimums: shallow=3, medium=5, deep=10. Fewer = restart. |
| Lists links without analysis | analyst step is required. Raw link dumps are rejected. |
| Hallucinated sources | Every URL must come from an actual WebSearch result. writer cannot invent URLs. |
| Duplicate queries | researcher must vary phrasing with synonyms and different angles per query. |

## Subagents

```yaml
researcher: { model: haiku, tools: [WebSearch, WebFetch], constraint: "meet depth minimums, vary phrasing, validate fetched content, flag staleness" }
analyst: { model: sonnet, tools: [], constraint: "produce gap list, flag data conflicts, verify coverage requirements" }
writer: { model: sonnet, tools: [], constraint: "every claim needs a source, no invented URLs, include conflict annotations" }
```

## Output & Integration

See `references/research-methodology.md` for output format template, extended gotchas table, and integration notes.

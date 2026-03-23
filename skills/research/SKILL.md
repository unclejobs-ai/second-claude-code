---
name: research
description: "Use when researching a topic through iterative web exploration and synthesis"
effort: high
---

# Research

Autonomous multi-round web research that produces structured Research Briefs.

## When to Use

- User asks to research a topic, trend, or question
- Another skill (e.g., `/second-claude-code:write`, `/second-claude-code:analyze`) needs source material
- User wants competitive intelligence, market data, or literature review

### Web Engine

The researcher uses **Jina Search** (`s.jina.ai`) as the primary tool. Fallback chain: Jina Search → WebSearch + WebFetch → Playwright. See `references/jina-guide.md`.

## MMBridge Enhancement

When mmbridge is detected (see `references/mmbridge-integration.md`), dispatch `mmbridge research` in parallel with the internal researcher.

### Dispatch

At Step 1, also run via Bash:

```bash
mmbridge research "<topic>" --type <type> --stream --export /tmp/mmbridge-research-${RUN_ID}.md
```

- `--type code-aware`: when topic relates to the current codebase
- `--type open`: for general topics unrelated to code
- `--depth shallow`: skip mmbridge
- `--depth medium|deep`: mmbridge enabled

### Merge

At Step 3, provide the mmbridge export file as supplemental source material. Count each distinct cited URL from mmbridge as one source and deduplicate overlaps during gap analysis.

### Step-by-Step

0. Auto-load `references/research-methodology.md` and `references/jina-guide.md`.
1. Dispatch **researcher** (sonnet): run depth-appropriate Jina Search calls with varied query phrasings. If `$JINA_API_KEY` is unavailable, fall back to WebSearch + WebFetch. If mmbridge is available at medium or deep depth, dispatch it in parallel.
2. Validate sources: reject login walls, blocked pages, and empty content. For blocked URLs, try Jina Reader (`r.jina.ai`) with `X-Engine: browser`, then Playwright if available.
3. Dispatch **analyst** (sonnet): merge internal and mmbridge findings, identify gaps, and apply conflict-resolution rules from `references/research-methodology.md`.
4. Optional second round: only when depth allows and the analyst found critical gaps.
5. Dispatch **writer** (sonnet): synthesize the final brief with conflict annotations.
6. Verify actual search counts before output. If counts exceed the depth cap, discard excess results and re-synthesize.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--depth` | `shallow\|medium\|deep` | `medium` | HARD limit on search rounds — see Depth Behavior |
| `--sources` | `web\|academic\|news` | `web` | Constrains search domain |
| `--lang` | `ko\|en\|auto` | `auto` | Output language. When called from another skill (write, analyze), inherits the caller's `--lang` value. |
| `--interactive` | flag | off | Force Playwright for all URL fetches (useful for SPAs, dashboards) |
| `--engine` | `jina\|legacy` | `jina` | `jina`: use Jina Search API. `legacy`: use WebSearch + WebFetch |

### Depth Behavior

- **shallow**: EXACTLY 3 Jina Search calls. No deep reads. No gap analysis round.
- **medium**: EXACTLY 5 Jina Search calls plus up to 2 Jina Reader deep reads.
- **deep**: 10+ Jina Search calls, unlimited Jina Reader deep reads, and at most 3 gap-fill rounds before documenting remaining gaps.

When `--engine legacy` is set or `$JINA_API_KEY` is unavailable, replace "Jina Search" with "WebSearch" and "Jina Reader" with "WebFetch" in the above counts.

Coverage requirements and conflict resolution rules are in `references/research-methodology.md`.

### Source Domain (`--sources`)

- **web** (default): General web search. No domain restrictions.
- **academic**: Bias at least half the calls toward Google Scholar or arXiv.
- **news**: Add `after:30d` and prefer established editorial sources over blogs.

## Fallback Chain

```
Jina Search (s.jina.ai) ─── primary: search + content in one call
  └─ blocked/empty → Jina Reader (r.jina.ai) with X-Engine: browser
       └─ still fails → Playwright (browser_navigate + browser_snapshot)
            └─ unavailable → note in Gaps & Limitations
```

When `--engine legacy` or `$JINA_API_KEY` is unavailable:
```
WebSearch → WebFetch → Playwright → Gaps & Limitations
```

When `--interactive` is set, skip Jina/WebFetch and use Playwright for every URL.

**Cost controls**: Max 3 Playwright navigations per round. Exceeding the cap means skip the rest and note the gap.

**Graceful degradation**: Both Jina and Playwright are optional. If `$JINA_API_KEY` is missing, fall back silently. If Playwright MCP is unavailable, proceed without it and note unreachable URLs.

## Auto-Save

- Path: `.captures/research-{slug}-{YYYY-MM-DD}.md`
- `{slug}` = topic lowercased, spaces to hyphens, max 40 chars
- Write the full brief using the Write tool and tell the user the saved path.

## Gotchas

| Failure Mode | Mitigation |
|-------------|------------|
| Stops after 1 search | researcher MUST meet depth minimums: shallow=3, medium=5, deep=10. Fewer = restart. |
| Lists links without analysis | analyst step is required. Raw link dumps are rejected. |
| Hallucinated sources | Every URL must come from an actual Jina Search/WebSearch result. writer cannot invent URLs. |
| Duplicate queries | researcher must vary phrasing with synonyms and different angles per query. |
| Jina API key missing | Fall back to WebSearch + WebFetch silently. Do not error. |

## Subagents

```yaml
researcher: { model: sonnet, tools: [Bash, WebSearch, WebFetch, browser_navigate, browser_snapshot], constraint: "use Jina Search via Bash/curl when $JINA_API_KEY is set; fall back to WebSearch+WebFetch otherwise; meet depth minimums, vary phrasing, validate fetched content, flag staleness; Playwright tools optional — use only when Jina and WebFetch both fail or --interactive set; max 3 Playwright navigations per round" }
analyst: { model: sonnet, tools: [], constraint: "produce gap list, flag data conflicts, verify coverage requirements" }
writer: { model: sonnet, tools: [], constraint: "every claim needs a source, no invented URLs, include conflict annotations" }
```

## Output & Integration

See `references/research-methodology.md` for output format template, extended gotchas table, and integration notes.

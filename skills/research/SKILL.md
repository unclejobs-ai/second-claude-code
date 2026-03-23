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

## Internal Flow

```
researcher(sonnet) --[Jina Search x5-10]--> raw findings ─┐
                                                            ├─→ analyst(sonnet) --[merge + gap analysis]
mmbridge research (parallel, if detected) ─────────────────┘        |
                                                             (shallow: skip gap-fill)
        v  (medium/deep only, if gaps found)
researcher(sonnet) --[Jina Search x3-5]--> supplemental findings
        |
        v
writer(sonnet) --[synthesis]--> Research Brief
```

### Web Engine

The researcher uses **Jina Search** (`s.jina.ai`) as the primary tool, which combines search + content extraction in a single call. Each Jina Search call returns up to 5 results with full markdown content.

Fallback chain: Jina Search → WebSearch + WebFetch → Playwright. See `references/jina-guide.md`.

## MMBridge Enhancement

When mmbridge is detected (see `references/mmbridge-integration.md`), the research skill dispatches
`mmbridge research` in **parallel** with the internal researcher for multi-model perspective.

### Enhanced Flow

```
┌─ researcher(sonnet): Jina Search ──────────────┐
│                                                  ├─→ analyst: merge + gap analysis
└─ mmbridge research "<topic>" --type code-aware ──┘
```

### Jina + Kimi Synergy

Jina provides clean, structured markdown from web sources. Kimi performs deep reasoning and cross-source synthesis. Together:
- Jina eliminates noisy WebFetch content → analyst gets higher-quality inputs from both pipelines
- Kimi cross-validates Jina findings independently → stronger conflict detection
- No fallback chain failures between them — each operates on its own retrieval path

### Dispatch

At Step 1 (Dispatch researcher), also run via Bash:

```bash
mmbridge research "<topic>" --type <type> --stream --export /tmp/mmbridge-research-${RUN_ID}.md
```

- `--type code-aware`: when topic relates to the current codebase
- `--type open`: for general topics unrelated to code
- `--depth shallow`: **skip mmbridge** (cost vs value too low)
- `--depth medium|deep`: mmbridge enabled

### Merge

At Step 3 (Dispatch analyst), provide the mmbridge export file as supplemental source material:
- Analyst treats mmbridge findings as additional sources alongside internal researcher findings
- mmbridge sources count toward the `sources_count` gate requirement (Plan→Do needs ≥3). Count each distinct cited URL from mmbridge export as 1 source
- If mmbridge produced duplicate findings, analyst deduplicates during gap analysis

### Step-by-Step

0. **Auto-load template**: Read `references/research-methodology.md` for output format template and `references/jina-guide.md` for Jina API usage BEFORE starting any searches.
1. **Dispatch researcher** (sonnet): Execute depth-appropriate Jina Search calls (`s.jina.ai`) via Bash/curl across varied query phrasings. Each call returns search results WITH content — no separate fetch step needed. Counts are HARD CAPS — see Depth Behavior. If `$JINA_API_KEY` is not set, fall back to WebSearch + WebFetch. If mmbridge detected and depth is medium or deep, dispatch `mmbridge research` in parallel (see MMBridge Enhancement above).
2. **Validate sources**: Verify Jina-returned content is readable — not login walls, blocked pages, or empty. For blocked URLs, use Jina Reader (`r.jina.ai`) with `X-Engine: browser` for a deeper fetch. If still unreadable, fall back to Playwright MCP when available. See `references/playwright-guide.md`.
3. **Dispatch analyst** (sonnet): Structure findings from internal researcher AND mmbridge (if available). Identify gaps and contradictions. Apply Data Conflict Resolution rules (see `references/research-methodology.md`).
4. **Optional 2nd round**: If analyst finds critical gaps, dispatch researcher again only when depth allows (see Depth Behavior). Shallow depth: skip this step entirely.
5. **Dispatch writer** (sonnet): Synthesize into the output brief format with conflict annotations.
6. **Verification**: Before outputting the brief, count actual Jina Search calls. If count exceeds depth limit, discard excess results and re-synthesize from the capped set.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--depth` | `shallow\|medium\|deep` | `medium` | HARD limit on search rounds — see Depth Behavior |
| `--sources` | `web\|academic\|news` | `web` | Constrains search domain |
| `--lang` | `ko\|en\|auto` | `auto` | Output language. When called from another skill (write, analyze), inherits the caller's `--lang` value. |
| `--interactive` | flag | off | Force Playwright for all URL fetches (useful for SPAs, dashboards) |
| `--engine` | `jina\|legacy` | `jina` | `jina`: use Jina Search API. `legacy`: use WebSearch + WebFetch |

### Depth Behavior

- **shallow**: EXACTLY 3 Jina Search calls. No deep reads. No gap analysis round. Violation = restart.
- **medium**: EXACTLY 5 Jina Search calls + up to 2 Jina Reader deep reads. One gap analysis round.
- **deep**: 10+ Jina Search calls. Unlimited Jina Reader deep reads. Repeated gap-fill cycles until coverage, **max 3 gap-fill rounds**. If gaps remain after 3 rounds, document them in "Gaps & Limitations" and proceed to synthesis.

When `--engine legacy` is set or `$JINA_API_KEY` is unavailable, replace "Jina Search" with "WebSearch" and "Jina Reader" with "WebFetch" in the above counts.

Coverage requirements and conflict resolution rules are in `references/research-methodology.md`.

### Source Domain (`--sources`)

- **web** (default): General web search. No domain restrictions.
- **academic**: With Jina, use `X-Site: https://scholar.google.com` header on 50%+ of calls. Alternate with `X-Site: https://arxiv.org`. With legacy engine, add `site:scholar.google.com OR site:arxiv.org` to queries.
- **news**: Add `after:30d` to query string. Prioritize Reuters, Bloomberg, TechCrunch, The Verge, and similar editorial sources over blog posts. With Jina, set `gl` and `hl` to match target audience locale.

## Fallback Chain

```
Jina Search (s.jina.ai) ─── primary: search + content in one call
  └─ blocked/empty → Jina Reader (r.jina.ai) with X-Engine: browser
       └─ still fails → Playwright (browser_navigate + browser_snapshot)
            └─ unavailable → note in Gaps & Limitations
```

When `--engine legacy` or `$JINA_API_KEY` unavailable:
```
WebSearch → WebFetch → Playwright → Gaps & Limitations
```

When `--interactive` flag is set, skip Jina/WebFetch and use Playwright for every URL.

**Cost controls**: Max 3 Playwright navigations per research round. Count them. Exceeding the cap = skip remaining Playwright fetches and note in Gaps & Limitations.

**Graceful degradation**: Both Jina and Playwright are optional. If `$JINA_API_KEY` is not set, fall back to WebSearch + WebFetch silently. If Playwright MCP is unavailable, proceed without it. Note unreachable URLs in Gaps & Limitations.

See `references/jina-guide.md` for Jina API reference and `references/playwright-guide.md` for Playwright patterns.

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

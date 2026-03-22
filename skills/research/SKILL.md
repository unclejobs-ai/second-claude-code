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
researcher(sonnet) --[WebSearch x5-10]--> raw findings ─┐
                                                         ├─→ analyst(sonnet) --[merge + gap analysis]
mmbridge research (parallel, if detected) ──────────────┘        |
                                                          (shallow: skip gap-fill)
        v  (medium/deep only, if gaps found)
researcher(sonnet) --[WebSearch x3-5]--> supplemental findings
        |
        v
writer(sonnet) --[synthesis]--> Research Brief
```

## MMBridge Enhancement

When mmbridge is detected (see `references/mmbridge-integration.md`), the research skill dispatches
`mmbridge research` in **parallel** with the internal researcher for multi-model perspective.

### Enhanced Flow

```
┌─ researcher(sonnet): WebSearch ────────────────┐
│                                                 ├─→ analyst: merge + gap analysis
└─ mmbridge research "<topic>" --type code-aware ─┘
```

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

0. **Auto-load template**: Read `references/research-methodology.md` for output format template BEFORE starting any searches.
1. **Dispatch researcher** (sonnet): Execute depth-appropriate WebSearch calls across varied query phrasings. Counts are HARD CAPS — see Depth Behavior. If mmbridge detected and depth is medium or deep, dispatch `mmbridge research` in parallel (see MMBridge Enhancement above).
2. **Validate sources**: Verify content is readable — not minified JS, login walls, or error pages. If WebFetch returns empty/error on a URL, fall back to Playwright MCP (`browser_navigate` + `browser_snapshot`) when available. See `references/playwright-guide.md`. Discard and replace sources that remain unreadable after fallback.
3. **Dispatch analyst** (sonnet): Structure findings from internal researcher AND mmbridge (if available). Identify gaps and contradictions. Apply Data Conflict Resolution rules (see `references/research-methodology.md`).
4. **Optional 2nd round**: If analyst finds critical gaps, dispatch researcher again only when depth allows (see Depth Behavior). Shallow depth: skip this step entirely.
5. **Dispatch writer** (sonnet): Synthesize into the output brief format with conflict annotations.
6. **Verification**: Before outputting the brief, count actual WebSearch calls. If count exceeds depth limit, discard excess results and re-synthesize from the capped set.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--depth` | `shallow\|medium\|deep` | `medium` | HARD limit on search rounds — see Depth Behavior |
| `--sources` | `web\|academic\|news` | `web` | Constrains search domain |
| `--lang` | `ko\|en\|auto` | `auto` | Output language. When called from another skill (write, analyze), inherits the caller's `--lang` value. |
| `--interactive` | flag | off | Force Playwright for all URL fetches (useful for SPAs, dashboards) |

### Depth Behavior

- **shallow**: EXACTLY 3 WebSearch calls. No WebFetch deep reads. No gap analysis round. Violation = restart.
- **medium**: EXACTLY 5 WebSearch calls + up to 2 WebFetch. One gap analysis round.
- **deep**: 10+ WebSearch calls. Unlimited WebFetch. Repeated gap-fill cycles until coverage, **max 3 gap-fill rounds**. If gaps remain after 3 rounds, document them in "Gaps & Limitations" and proceed to synthesis.

Coverage requirements and conflict resolution rules are in `references/research-methodology.md`.

### Source Domain (`--sources`)

- **web** (default): General web search. No domain restrictions.
- **academic**: Prefer Google Scholar, arXiv, PubMed, .edu domains. Add `site:scholar.google.com OR site:arxiv.org` to at least 50% of queries.
- **news**: Prefer recent news sources. Add `after:{30-days-ago}` filter. Prioritize Reuters, Bloomberg, TechCrunch, The Verge, and similar editorial sources over blog posts.

## Dynamic Web Research (Playwright Fallback)

When `WebFetch` fails on a URL (JavaScript-heavy site, login wall, dynamic content):

1. Detect failure: empty response body, HTTP error, or minified JS blob with no readable text.
2. Fall back to Playwright MCP tools in order:
   - `browser_navigate(url)` — load the page in a real browser
   - `browser_snapshot()` — capture an accessibility tree (compact structured data, far more token-efficient than raw HTML)
3. Parse the accessibility tree for headings, paragraphs, and data cells relevant to the query.
4. If `--interactive` flag is set, skip WebFetch entirely and use Playwright for every URL.

**Cost controls**: Max 3 Playwright navigations per research round. Count them. Exceeding the cap = skip remaining Playwright fetches and note in Gaps & Limitations.

**Graceful degradation**: Playwright MCP is optional. If the `playwright` MCP server is not configured or unavailable, research proceeds with WebFetch only — no error, no retry. Note unreachable URLs in Gaps & Limitations.

See `references/playwright-guide.md` for tool reference and usage patterns.

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
researcher: { model: sonnet, tools: [WebSearch, WebFetch, browser_navigate, browser_snapshot], constraint: "meet depth minimums, vary phrasing, validate fetched content, flag staleness; Playwright tools optional — use only when WebFetch fails or --interactive set; max 3 Playwright navigations per round" }
analyst: { model: sonnet, tools: [], constraint: "produce gap list, flag data conflicts, verify coverage requirements" }
writer: { model: sonnet, tools: [], constraint: "every claim needs a source, no invented URLs, include conflict annotations" }
```

## Output & Integration

See `references/research-methodology.md` for output format template, extended gotchas table, and integration notes.

---
name: discover
description: "Use when the current skills cannot handle a task and new skills are needed"
effort: low
---

## Iron Law

> **Check existing tools before installing new ones.**

## Red Flags

- "I can write tests later" → STOP. Write them now.
- "This change is too small to review" → STOP. Small bugs become P0 incidents.
- "I don't need to check previous cycle insights" → STOP. You will repeat the same mistake.
- "This is good enough" → STOP. Check the checklist.
- "No time to follow every step" → STOP. Skipped steps cost 3x more later.

# Discover

Find existing skills first, then search external marketplaces only when needed and safe. Discovery is **registry-first**: prefer the official/local/verified registry path before broader community search.

## When to Use

- The current skills do not cover the task
- A pipeline references a missing capability
- The user wants to browse or install additional skills

## Workflow

0. **Check built-in capabilities**: Before searching, check if the requested capability is already available through built-in tools (Read for PDFs, WebFetch for URLs, Bash for shell tasks, etc.). If built-in tools suffice, report that and skip external search.
1. Scan local skills by name and description.
2. If no strong match, search external sources in priority order (see Source Prioritization). Treat official/local/verified registry sources as the default adoption path.
3. **Candidate Inspection**: Fetch and read README/SKILL.md for the top 3 candidates. If inspection is blocked (private repo, rate limit): (a) search package name + "review"/"tutorial", (b) check npm page for README, (c) note "inspection blocked" and apply a -1 score penalty. See `references/discover-scoring.md` for the full workflow.
4. Score candidates on relevance, popularity, recency, dependency weight, and source trust. Show the full weighted breakdown (see `references/discover-scoring.md`).
5. Apply the **Build vs Install** threshold. If no candidate scores above 3.0, recommend a custom pipeline instead.
6. Present ranked options with pinned versions and wait for explicit approval.
7. Install only with approval and only when the environment supports it.

## Source Prioritization

| Priority | Source | Condition | Trust Tier |
|----------|--------|-----------|------------|
| 1 | Local `skills/` directory | Always | Tier 1 (highest) |
| 2 | GitHub repos with `SKILL.md` | When `gh` is available | Tier 2 |
| 3 | npm packages with `claude-code` keyword | When `npm` is available | Tier 3 |
| 4 | General web search | Always available | Tier 4 (lowest) |

Trust tier scores: Tier 1 = 5, Tier 2 = 4, Tier 3 = 3, Tier 4 = 2. Bumps apply for verified orgs or scoped packages.

## Evaluation Weights

Each criterion is scored 1-5. The weighted sum produces a final score (1.0-5.0).

| Criterion | Weight | Scoring Guide |
|-----------|--------|---------------|
| Relevance | 30% | 5 = exact match, 3 = partial overlap, 1 = tangential |
| Popularity | 20% | 5 = 1000+ stars, 3 = 100-999, 1 = <50 |
| Recency | 20% | 5 = updated within 30 days, 3 = within 6 months, 1 = >1 year stale |
| Dependencies | 15% | 5 = zero or minimal, 3 = moderate (5-15), 1 = heavy or native |
| Source trust | 15% | See trust tier mapping above |

## Thresholds

| Score Range | Action |
|-------------|--------|
| `4.0+` | Strong recommendation -- install with confidence |
| `3.0-3.9` | Viable with caveats -- list limitations |
| `<3.0` | Do NOT recommend. Suggest building a custom pipeline instead. |

## Safety

- Never auto-install. Pin exact versions (see `references/discover-scoring.md`).
- **Postinstall check**: Before recommending any npm package, inspect its `package.json` for `preinstall`, `install`, or `postinstall` scripts. Flag packages with lifecycle scripts and apply a -1 score penalty. Packages with obfuscated or network-calling lifecycle scripts must be rejected entirely.
- Flag heavy or stale packages.
- Degrade gracefully to local-scan-only mode if marketplace tooling is missing.
- Flag repos with no LICENSE file or suspicious content.

## Output Format

Return a ranked list AND save results to `${CLAUDE_PLUGIN_DATA}/discovers/{query-slug}.json`:
```json
{
  "query": "...",
  "searched_at": "ISO-8601",
  "built_in_check": { "capable": false, "reason": "Read tool handles PDFs up to 20 pages but cannot extract tables" },
  "candidates": [{ "rank": 1, "name": "...", "source": "...", "score": 3.8, "install_cmd": "...", "inspection_notes": "..." }],
  "recommendation": "install|build-custom|use-builtin"
}
```

## Gotchas

- Never invent package names.
- Never recommend a package without checking recency and source.
- Never skip the approval step.
- Never recommend a bare repo URL without a pinned version or commit hash.
- Never rely solely on metadata -- always attempt Candidate Inspection.
- If marketplace CLI does not exist, skip silently and note the gap.
- Never search externally when built-in tools already handle the capability.
- Always persist discover results to JSON for future reference.

## Subagents

```yaml
searcher: { model: haiku, tools: [Bash, WebSearch], constraint: "return only real results; query sources in priority order" }
inspector: { model: sonnet, tools: [Bash, Read], constraint: "fetch and read README/SKILL.md for top 3; verify claims" }
evaluator: { model: sonnet, tools: [Read], constraint: "score consistently; show full breakdown with rationale" }
```

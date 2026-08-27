---
description: "Plan/Gather phase -- research at shallow, medium, or deep depth"
argument-hint: "AI agent landscape 2026"
---

Invoke the `/scc:research` command to perform research at the requested depth through the
`research` skill.

## Context
- Cached research briefs: !`ls .captures/research-*.md 2>/dev/null | wc -l | xargs echo "Cached research briefs:"`

## Arguments
- First argument: research topic (required)
- `--depth shallow|medium|deep` (default: medium)
- `--sources web|academic|news` (default: web)
- `--lang ko|en|auto` (default: auto)
- `--engine jina|legacy` (default: jina)
- `--interactive` force browser-based fetching

### Depth behavior

- `shallow`: exactly 3 search calls; no deep reads or gap-analysis round.
- `medium`: exactly 5 search calls and up to 2 deep reads.
- `deep`: 10 or more search calls, unlimited deep reads, and up to 3 gap-fill rounds.

If the Jina engine is unavailable, the equivalent WebSearch/WebFetch fallback is used and the
same depth limits apply.

## Your task
Perform the research now using the plugin's loaded `research` skill and the provided arguments.

- Save the full brief to `.captures/research-{slug}-{YYYY-MM-DD}.md` following the research skill's Auto-Save contract.
- Return the final research brief directly and include the saved path.
- Do not say that you are invoking or have invoked a skill.

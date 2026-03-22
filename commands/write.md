---
description: "Do/Produce phase -- newsletter, article, shorts, report, social"
argument-hint: article "the future of vibe coding"
---

Invoke the `/second-claude-code:write` command to produce content through the `write` skill.

## Context
- Recent captures: !`ls .captures/*.md 2>/dev/null | tail -3`

## Arguments
- First argument: format (newsletter|article|shorts|report|social|card-news)
- Second argument: topic
- `--voice peer-mentor|expert|casual` (default: peer-mentor)
- `--publish notion|file` (default: file)

## Your task
Perform the writing task now using the plugin's loaded `write` skill and the provided arguments.

- Return the actual written output directly.
- Do not say that you are invoking or have invoked a skill.

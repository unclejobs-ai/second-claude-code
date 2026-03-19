---
name: hunt
description: "Use when the current skills cannot handle a task and new skills are needed"
---

# Hunt

Find existing skills first, then search external marketplaces only when needed and safe.

## When to Use

- The current skills do not cover the task
- A pipeline references a missing capability
- The user wants to browse or install additional skills

## Workflow

1. Scan local skills by name and description.
2. If no strong match exists, search external sources when the required CLIs are available.
3. Score candidates on relevance, popularity, recency, dependency weight, and source trust.
4. Present ranked options and wait for explicit approval.
5. Install only with approval and only when the environment supports it.

## Search Sources

| Source | Condition |
|--------|-----------|
| Local `skills/` | always |
| `npx skills search` | when `npx` is available |
| `npm search --json` | when `npm` is available |
| `gh search repos` | when `gh` is available |

## Evaluation Weights

Each criterion is scored on a 1-5 scale. The weighted sum produces a final score (1.0-5.0).

| Criterion | Weight |
|-----------|--------|
| Relevance | 30% |
| Popularity | 20% |
| Recency | 20% |
| Dependencies | 15% |
| Source trust | 15% |

## Thresholds

- `4.0+`: strong recommendation
- `3.0-3.9`: viable with caveats
- `<3.0`: mention only if nothing else exists

## Safety

- Never auto-install.
- Pin exact versions.
- Flag heavy or stale packages.
- Degrade gracefully to local-scan-only mode if marketplace tooling is missing.

## Output

Return a short ranked list with score, update date, source, and exact install command when applicable.

## Gotchas

- Never invent package names.
- Never recommend a package without checking recency and source.
- Never skip the approval step.

## Subagents

```yaml
searcher: { model: haiku, tools: [Bash, WebSearch], constraint: "return only real results" }
evaluator: { model: sonnet, tools: [Read], constraint: "score and rank candidates consistently" }
```

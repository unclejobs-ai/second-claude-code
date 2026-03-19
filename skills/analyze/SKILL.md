---
name: analyze
description: "Use when applying strategic frameworks such as SWOT, RICE, OKR, or GTM"
---

# Analyze

Apply a strategic framework to a topic, then stress-test it with a built-in challenge pass.

## When to Use

- Strategic analysis, prioritization, positioning, or planning
- The user explicitly names a framework
- Another skill needs a structured analysis artifact

## Supported Frameworks

| Framework | Best For |
|-----------|----------|
| `swot` | Situational assessment |
| `rice` | Prioritization scoring |
| `okr` | Goal-setting |
| `prd` | Product requirements |
| `lean-canvas` | Startup or product validation |
| `persona` | User definition |
| `journey-map` | Experience analysis |
| `pricing` | Pricing strategy |
| `gtm` | Go-to-market planning |
| `north-star` | Metric alignment |
| `porter` | Competitive forces |
| `pestle` | Macro-environment scan |
| `ansoff` | Growth direction |
| `battlecard` | Competitive comparison |
| `value-prop` | Value proposition design |

## Workflow

1. Detect the framework and load `skills/analyze/references/frameworks/{framework}.md`.
2. Optionally run `/second-claude-code:research --depth shallow` when market evidence is needed.
3. Ask `strategist` to apply the framework with evidence and clear implications.
4. Ask `devil-advocate` to attack the weakest 3 points.
5. Synthesize both into a balanced output with recommended actions.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--framework` | listed above | auto-detect |
| `--with-research` | flag | off |
| `--depth` | `quick\|standard\|thorough` | `standard` |
| `--skip-challenge` | flag | off |
| `--lang` | `ko\|en` | `ko` |

## Depth

- `quick`: Apply the template only.
- `standard`: Apply plus one challenge round.
- `thorough`: Add research and a second challenge round.

## Output

```markdown
# {Framework} Analysis: {topic}

## Analysis
(framework sections with evidence)

## Challenge
- 3 weakest points
- blind spots and assumptions

## Balanced Insight
(synthesis)

## Recommended Actions
1. ...
2. ...
3. ...
```

## Gotchas

- Do not force equal depth across all framework sections.
- Do not present generic claims without names, numbers, or evidence.
- Keep the challenge output in the final synthesis rather than discarding it.

## Subagents

```yaml
strategist: { model: sonnet, constraint: "apply framework, cite evidence, fill required sections" }
devil-advocate: { model: sonnet, constraint: "attack weakest 3 points, surface blind spots" }
```

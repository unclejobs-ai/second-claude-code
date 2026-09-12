[한국어](analyze.ko.md)

# Analyze

> Apply one strategic framework, cite evidence, challenge the weakest points, and turn the result into actions.

## When to use

Use `analyze` for strategy, prioritization, positioning, product planning, or
any request that benefits from a named framework. It is also useful as a
structured artifact for a later `write` or `workflow` step.

## Quick example

```text
/scc:analyze --framework swot --depth standard "our onboarding funnel"
```

The skill loads the selected framework, gathers or reads evidence, asks a
strategist to apply it, challenges the weakest points according to the selected
depth, and synthesizes balanced insight with recommended actions. The example
topic is illustrative; citations and conclusions come from the actual sources.

## Frameworks and depth

Supported frameworks (15): `swot`, `rice`, `okr`, `prd`, `lean-canvas`,
`persona`, `journey-map`, `pricing`, `gtm`, `north-star`, `porter`, `pestle`,
`ansoff`, `battlecard`, and `value-prop`.

| `--depth` | Contract |
|---|---|
| `quick` | Apply the template only. No research or challenge round. |
| `standard` (default) | Apply the template with evidence requirements and one challenge round. |
| `thorough` | Run the full research pass, two challenge rounds, and a second pass focused on source quality; add `mmbridge` debate when available. |

If `--framework` is omitted, an explicit framework name wins, intent keywords
are mapped next, and ambiguous matches are returned as a question. If nothing
matches, the skill uses SWOT and states that assumption.

## Options

| Flag | Values | Default |
|---|---|---|
| `--framework` | listed above | auto-detect |
| `--context` | `plan\|do` | auto from PDCA phase |
| `--with-research` | flag | off |
| `--depth` | `quick\|standard\|thorough` | `standard` |
| `--skip-challenge` | flag | off |
| `--lang` | `ko\|en` | `ko` |

`--with-research` explicitly adds the research step. At `thorough`, research is
part of the depth contract. `--skip-challenge` is an explicit override of the
normal challenge pass.

## Evidence and output

For competitors, products, and other external entities, read actual sources,
use at least three concrete data points per section or quadrant, cite external
claims inline, and label uncited claims `[unverified]`. Separate facts from
inferences. The saved artifact is
`.captures/analyze-{framework}-{slug}-{YYYY-MM-DD}.md`.

```markdown
# {Framework} Analysis: {topic}
## Analysis
## Challenge
## Balanced Insight
## Recommended Actions
```

The challenge is part of the synthesis; it must not disappear from the final
artifact. Uneven section depth is acceptable when the evidence is uneven.

## Works with

| Skill | Relationship |
|---|---|
| `research` | Supplies evidence when requested or required by `thorough`. |
| `review` | Provides an additional validation pass. |
| `workflow` | Runs analysis as a sequential file-producing step. |
| `write` | Turns the analysis artifact into a report or article. |

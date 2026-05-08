---
name: analyze
description: "Use when applying strategic frameworks such as SWOT, RICE, OKR, or GTM"
effort: high
---

## Iron Law

> **Never conclude first. Evidence determines the conclusion.**

## Red Flags

- "Let's use SWOT, it always works" → STOP. Framework must fit the problem, not habit.
- "Everyone knows they're the market leader" → STOP. Reputation ≠ evidence. Need 3+ data points per section.
- "The challenge round found nothing" → STOP. A challenge that confirms everything is a rubber stamp.
- "I'll fill in the weaker sections later" → STOP. Uneven depth hides gaps.
- "Data doesn't support it but the conclusion feels right" → STOP. Evidence determines the conclusion.

# Analyze

Apply a strategic framework to a topic, then stress-test it with a challenge pass.

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
2. Gather sources before analyzing. Read internal source files for the subject; for external entities, read current docs, source, changelogs, or feature pages. Record source paths for citation.
3. Ask `strategist` to apply the framework with evidence and clear implications, enforcing Source Requirements.
4. Ask `devil-advocate` to attack the weakest 3 points. At `thorough` depth with mmbridge detected, also dispatch `mmbridge debate` in parallel.
5. At `thorough` depth, run a second challenge pass focused on sourcing quality.
6. Synthesize both into a balanced output with recommended actions.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--framework` | listed above | auto-detect (see below) |
| `--with-research` | flag | off |
| `--depth` | `quick\|standard\|thorough` | `standard` |
| `--skip-challenge` | flag | off |
| `--lang` | `ko\|en` | `ko` |

### Framework Auto-Detection

When `--framework` is not specified, detect from the prompt:

1. Explicit name wins.
2. Intent keywords map common prompts to the closest framework.
3. If multiple frameworks fit, ask instead of guessing.
4. If nothing matches, default to `swot` and state the assumption.

## Source Requirements

When analyzing competitors, products, or external entities:

1. Read actual sources, not reputation.
2. Use at least 3 concrete data points per section or quadrant.
3. Cite every external claim inline; mark uncited claims as `[unverified]`.
4. Distinguish fact from inference.

## Depth Levels

| Level | Label | What happens | When to use |
|-------|-------|-------------|-------------|
| 1 | `quick` | Apply the template only. No research, no challenge round. | Internal brainstorming, time-boxed sessions |
| 2 | `standard` | Apply template with evidence-enforcement + one challenge round. | Default for most analyses |
| 3 | `thorough` | Full research pass (web search + source code reading) before applying template. Two challenge rounds + mmbridge debate (if available). Second round specifically attacks sourcing quality. | Competitive analysis, strategic decisions, publishable artifacts |

- `quick` maps to `--depth quick`
- `standard` maps to `--depth standard` (default)
- `thorough` maps to `--depth thorough`

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

## Auto-Save

- Path: `.captures/analyze-{framework}-{slug}-{YYYY-MM-DD}.md`
- `{slug}` = topic lowercased, spaces to hyphens, max 40 chars
- Write the full analysis using the Write tool and tell the user the saved path.

## Challenge Round

Mandatory at `standard` (1 round) and `thorough` (2 rounds). See `references/challenge-round.md` for the full protocol.

## MMBridge Debate Enhancement

When mmbridge is detected (see `references/mmbridge-integration.md`), analyze can dispatch `mmbridge debate` during the challenge round.

### When to Use

- `--depth standard`: skip mmbridge debate
- `--depth thorough`: run it in parallel with the internal devil-advocate

### Dispatch

At Step 4 (Challenge Round 1), also run via Bash:

```bash
mmbridge debate "<proposition from analysis>" --rounds 2 --json > /tmp/mmbridge-debate-${RUN_ID}.json
```

### Merge

- Parse the mmbridge debate JSON output for arguments tagged `FOR` and `AGAINST`
- `AGAINST` arguments are merged into the challenge round as additional attack vectors
- `FOR` arguments that contradict internal devil-advocate findings are noted as "disputed by external model"
- Synthesize both internal and external challenges into the "## Challenge" section of the output

### Cost Note

`mmbridge debate` costs more than a single internal challenge, so only activate it at `thorough` depth.

## Gotchas

- Do not force equal depth across all framework sections.
- Do not present generic claims without names, numbers, or evidence.
- Keep the challenge output in the final synthesis.
- Do not analyze competitors by reputation alone.
- Apply the same evidentiary standard to every option being compared.

## When Called from PDCA

`analyze` spans both Plan and Do phases:

- **Plan**: synthesize research findings into a structured framework.
- **Do**: apply a production-oriented framework to shape the artifact being built.

Add `--context plan|do` to override auto-detected PDCA phase.

## Subagents

```yaml
analyst: { model: sonnet, constraint: "pre-process raw research data into structured patterns before framework application" }
strategist: { model: sonnet, constraint: "apply framework, cite evidence, fill required sections" }
devil-advocate: { model: sonnet, constraint: "attack weakest 3 points, surface blind spots" }
```

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

1. Detect the framework and load `references/frameworks/{framework}.md`.
2. **Gather sources before analyzing.** For each entity being analyzed:
   - Read internal source files (SKILL.md, code, configs) for the subject.
   - For competitors/external entities: use web search, read their docs/repos, or fetch their feature pages. Do not skip this step.
   - Record sources found for use in citation during analysis.
3. Ask `strategist` to apply the framework with evidence and clear implications, enforcing Source Requirements (min 3 data points per quadrant, inline citations).
4. Ask `devil-advocate` to attack the weakest 3 points (Challenge Round 1).
5. At `deep` depth: run Challenge Round 2 (Source Audit) to verify sourcing quality.
6. Synthesize both into a balanced output with recommended actions.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--framework` | listed above | auto-detect |
| `--with-research` | flag | off |
| `--depth` | `quick\|standard\|thorough` | `standard` |
| `--skip-challenge` | flag | off |
| `--lang` | `ko\|en` | `ko` |

## Source Requirements

When analyzing competitors, products, or external entities:

1. **Read actual sources, not reputation.** Do not describe a competitor based on what "everyone knows." Read their documentation, source code, changelog, or official feature pages. If web search is available, use it. If their repo is accessible, read it.
2. **Minimum 3 concrete data points per quadrant.** Each SWOT quadrant (or equivalent framework section) must contain at least 3 items backed by observable facts: feature names, version numbers, file paths, pricing tiers, documented limitations, API signatures, or direct quotes from docs.
3. **Cite the source for every external claim.** Use the format `(source: URL/filename/doc section)` inline. If a claim cannot be sourced, prefix it with `[unverified]` and note what research would resolve it.
4. **Distinguish fact from inference.** Statements like "X is popular" or "Y is limited" require evidence. State the metric (GitHub stars, npm downloads, changelog frequency) or explicitly mark the statement as an inference with your reasoning.

## Depth Levels

| Level | Label | What happens | When to use |
|-------|-------|-------------|-------------|
| 1 | `quick` | Apply the template only. No research, no challenge round. | Internal brainstorming, time-boxed sessions |
| 2 | `standard` | Apply template with evidence-enforcement + one challenge round. | Default for most analyses |
| 3 | `thorough` | Full research pass (web search + source code reading) before applying template. Two challenge rounds. Second round specifically attacks sourcing quality. | Competitive analysis, strategic decisions, publishable artifacts |

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

After producing the final synthesis, save it to a file:

- Path: `.captures/analyze-{framework}-{slug}-{YYYY-MM-DD}.md`
- `{slug}` = topic lowercased, spaces to hyphens, max 40 chars
- Write the full analysis using the Write tool. Do NOT skip this step.
- Tell the user the saved path.

## Challenge Round

Mandatory at `standard` (1 round) and `deep` (2 rounds). See `references/challenge-round.md` for the full protocol.

## Gotchas

- Do not force equal depth across all framework sections.
- Do not present generic claims without names, numbers, or evidence.
- Keep the challenge output in the final synthesis rather than discarding it.
- **Do not analyze competitors based on reputation alone** — read their actual documentation, source code, or feature pages. If sources are unavailable, explicitly state what you could not verify.
- Do not conflate "widely believed" with "true." Popular opinion about a product's strengths/weaknesses may be outdated or wrong. Verify against current sources.
- When comparing two products, apply the same evidentiary standard to both. Do not rigorously source your own product's strengths while hand-waving the competitor's.

## Subagents

```yaml
strategist: { model: sonnet, constraint: "apply framework, cite evidence, fill required sections" }
devil-advocate: { model: sonnet, constraint: "attack weakest 3 points, surface blind spots" }
```

---
name: analyze
description: "Strategic framework analysis — SWOT, RICE, OKR, Lean Canvas, and 10+ frameworks"
---

# Analyze

Apply any strategic framework to a topic with built-in devil's advocate challenge.

## When to Use

- User asks for strategic analysis, competitive assessment, or framework application
- User names a specific framework (SWOT, RICE, OKR, etc.)
- Another skill needs structured analysis (e.g., `/scc:write --format report`)

## Supported Frameworks

| Framework | Category | Best For |
|-----------|----------|----------|
| `swot` | Strategy | Situational assessment |
| `rice` | Prioritization | Feature/initiative scoring |
| `okr` | Goal-setting | Quarterly planning |
| `prd` | Product | Feature specification |
| `lean-canvas` | Business | Startup/product validation |
| `persona` | User Research | Target user definition |
| `journey-map` | UX | User experience mapping |
| `pricing` | Revenue | Pricing strategy |
| `gtm` | Marketing | Go-to-market planning |
| `north-star` | Strategy | Metric alignment |
| `porter` | Strategy | Competitive forces |
| `pestle` | Strategy | Macro-environment scan |
| `ansoff` | Growth | Growth direction matrix |
| `battlecard` | Sales | Competitive comparison |
| `value-prop` | Product | Value proposition design |

## Internal Flow

```
framework recognition ──► template load (references/frameworks/)
        │
        ▼
/scc:research (optional) ──► market data, evidence
        │
        ▼
strategist(sonnet) ──[apply framework]──► initial analysis
        │
        ▼
devil-advocate(sonnet) ──[challenge]──► counter-arguments
        │
        ▼
synthesis ──► balanced insight (analysis + challenges)
```

### Step-by-Step

1. **Framework recognition**: Identify the requested framework. Load the corresponding template from `references/frameworks/{framework}.md`.
2. **Optional research**: If `--with-research` is set or the topic requires market data, auto-call `/scc:research --depth shallow`.
3. **Dispatch strategist** (sonnet model): Apply the framework template to the topic. Fill every section with specific, evidence-backed content.
4. **Dispatch devil-advocate** (sonnet model): Independently review the analysis. Attack the weakest 3 points. Identify blind spots and unstated assumptions.
5. **Synthesis**: Merge the strategist output with devil-advocate challenges. Present both the analysis and its counter-arguments as a balanced result.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--framework` | see table above | auto-detect | Which framework to apply |
| `--with-research` | flag | off | Run `/scc:research` for data |
| `--depth` | `quick\|standard\|thorough` | `standard` | Analysis depth |
| `--skip-challenge` | flag | off | Skip devil-advocate step |
| `--lang` | `ko\|en` | `ko` | Output language |

### Depth Behavior

- **quick**: Template fill only, no devil-advocate. Fast directional analysis.
- **standard**: Full flow with devil-advocate challenge. Covers most use cases.
- **thorough**: Research + full flow + second devil-advocate round targeting counter-arguments.

## Output Format

```markdown
# {Framework} Analysis: {topic}

## Analysis
(framework-specific sections filled with evidence)

## Challenge
### Weakest Points
1. (counter-argument with reasoning)
2. ...
3. ...

### Blind Spots
- (unstated assumptions)
- (missing perspectives)

## Balanced Insight
(synthesis that integrates analysis with legitimate challenges)

## Recommended Actions
1. (specific, actionable next step)
2. ...
```

## Gotchas

| Failure Mode | Mitigation |
|-------------|------------|
| Fills all quadrants equally | Strategist must allocate depth proportionally. A SWOT with 4 equal bullet lists is rejected. The strongest insight gets the most space. |
| Ignores counter-arguments | Devil-advocate is mandatory by default. Its output is included in final synthesis, not discarded. |
| Uses generic examples | Strategist prompt requires topic-specific data. "e.g., companies like X" without naming X is flagged. |
| Confuses framework purposes | Template loading ensures correct structure. Each template includes a "When to Use / When NOT to Use" header. |
| Superficial analysis | `standard` depth requires minimum 3 evidence points per framework section. `quick` allows assertion-only. |
| Devil-advocate is too agreeable | Prompt enforces adversarial stance: "Your job is to find holes, not to validate." |

## Patterns Absorbed

- **PM Toolkit (50+ frameworks)**: Comprehensive framework library with templates
- **Octopus Double Diamond**: Diverge (explore broadly) then converge (focus on insight)
- **Ars Contexta Reflect**: Structured reflection that separates analysis from judgment

## Subagent Dispatch

```yaml
strategist:
  model: sonnet
  tools: [none - works on template + research output]
  constraint: "must fill every section, no generic examples, cite evidence"

devil-advocate:
  model: sonnet
  tools: [none - works on strategist output]
  constraint: "must attack weakest 3 points, adversarial stance enforced"
```

## Integration

- Called by `/scc:write --format report` to structure analysis sections
- Optionally calls `/scc:research` for evidence gathering
- Templates loaded from `references/frameworks/` directory
- Output can be piped to `/scc:write` for polished report formatting

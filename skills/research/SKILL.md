---
name: research
description: "Use when researching a topic through iterative web exploration and synthesis"
---

# Research

Autonomous multi-round web research that produces structured Research Briefs.

## When to Use

- User asks to research a topic, trend, or question
- Another skill (e.g., `/second-claude-code:write`, `/second-claude-code:analyze`) needs source material
- User wants competitive intelligence, market data, or literature review

## Internal Flow

```
researcher(haiku) --[WebSearch x5-10]--> raw findings
        |
        v
analyst(sonnet) --[structure + gap analysis]--> gap list
        |                                        (shallow: skip gap-fill)
        v  (medium/deep only, if gaps found)
researcher(haiku) --[WebSearch x3-5]--> supplemental findings
        |
        v
writer(sonnet) --[synthesis]--> Research Brief
```

### Step-by-Step

0. **Auto-load template**: Read `references/research-methodology.md` for output format template BEFORE starting any searches.
1. **Dispatch researcher** (haiku): Execute depth-appropriate WebSearch calls across varied query phrasings. Counts are HARD CAPS — see Depth Behavior.
2. **Validate sources**: Verify content is readable — not minified JS, login walls, or error pages. Discard and replace invalid sources.
3. **Dispatch analyst** (sonnet): Structure findings, identify gaps and contradictions. Apply Data Conflict Resolution rules (see `references/research-methodology.md`).
4. **Optional 2nd round**: If analyst finds critical gaps, dispatch researcher again only when depth allows (see Depth Behavior). Shallow depth: skip this step entirely.
5. **Dispatch writer** (sonnet): Synthesize into the output brief format with conflict annotations.
6. **Verification**: Before outputting the brief, count actual WebSearch calls. If count exceeds depth limit, discard excess results and re-synthesize from the capped set.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--depth` | `shallow\|medium\|deep` | `medium` | HARD limit on search rounds — see Depth Behavior |
| `--sources` | `web\|academic\|news` | `web` | Constrains search domain |
| `--lang` | `ko\|en\|auto` | `auto` | Output language |

### Depth Behavior

- **shallow**: EXACTLY 3 WebSearch calls. No WebFetch deep reads. No gap analysis round. Violation = restart.
- **medium**: EXACTLY 5 WebSearch calls + up to 2 WebFetch. One gap analysis round.
- **deep**: 10+ WebSearch calls. Unlimited WebFetch. Repeated gap-fill cycles until coverage.

Coverage requirements and conflict resolution rules are in `references/research-methodology.md`.

## Output, Gotchas, Subagents & Integration

See `references/research-methodology.md` for output format template, gotchas table, subagent dispatch config, and integration notes.

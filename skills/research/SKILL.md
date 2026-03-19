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
        |
        v  (if gaps found)
researcher(haiku) --[WebSearch x3-5]--> supplemental findings
        |
        v
writer(sonnet) --[synthesis]--> Research Brief
```

### Step-by-Step

1. **Dispatch researcher** (haiku): Execute depth-appropriate WebSearch calls across varied query phrasings. Use 3 for `shallow`, 5 for `medium`, 10 for `deep`.
2. **Validate sources**: Verify content is readable -- not minified JS, login walls, or error pages. Discard and replace invalid sources.
3. **Dispatch analyst** (sonnet): Structure findings, identify gaps and contradictions. Apply Data Conflict Resolution rules (see `references/research-methodology.md`).
4. **Optional 2nd round**: If analyst finds critical gaps, dispatch researcher again (3-5 targeted searches).
5. **Dispatch writer** (sonnet): Synthesize into the output brief format with conflict annotations.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--depth` | `shallow\|medium\|deep` | `medium` | 1 / 3 / 5 search rounds |
| `--sources` | `web\|academic\|news` | `web` | Constrains search domain |
| `--lang` | `ko\|en\|auto` | `auto` | Output language |

### Depth Behavior

- **shallow** (1 round): 3 searches, no gap analysis.
- **medium** (2 rounds): 5 searches, gap analysis, then targeted follow-up.
- **deep** (iterative rounds): 10 searches across repeated gap-fill cycles.

Coverage requirements and conflict resolution rules are in `references/research-methodology.md`.

## Output, Gotchas, Subagents & Integration

See `references/research-methodology.md` for output format template, gotchas table, subagent dispatch config, and integration notes.

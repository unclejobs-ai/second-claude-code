---
name: write
description: "Content production — newsletter, article, shorts, report — with auto-research and review"
---

# Write

Produce any content format with automatic research sourcing and quality review.

## When to Use

- User asks to write, draft, or produce any content
- Triggered with a format: `newsletter`, `article`, `shorts`, `report`, `social`, `card-news`
- Another skill needs written output (e.g., `/scc:analyze` producing a report)

## Internal Flow

```
/scc:research ──► source material
       │
       ▼
writer(opus) ──[draft per format template]──► first draft
       │
       ▼
/scc:review ──► feedback report
       │
       ▼
editor(opus) ──[incorporate feedback]──► final output
```

### Step-by-Step

1. **Auto-call /scc:research**: Gather source material for the topic. Depth defaults to `medium`. Skip only if user provides explicit source material.
2. **Dispatch writer** (opus model): Draft content using the format-specific structure below. Apply the selected voice.
3. **Auto-call /scc:review**: Run content preset review (deep-reviewer + devil-advocate + tone-guardian).
4. **Dispatch editor** (opus model): Incorporate review feedback. Produce final version.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--format` | `newsletter\|article\|shorts\|report\|social\|card-news` | `newsletter` | Content structure |
| `--voice` | see Voice section | format-dependent | Tone and style |
| `--publish` | `notion\|file` | `file` | Output destination |
| `--skip-research` | flag | off | Skip research step (use when sources provided) |
| `--skip-review` | flag | off | Skip review step (drafts only) |
| `--lang` | `ko\|en` | `ko` | Output language |

## Voice Options

| Voice | Description | Default For |
|-------|-------------|-------------|
| `먼저가본동료` | Peer who tried it first. Warm, practical, "I tested this so you don't have to" | newsletter |
| `전문가` | Subject expert. Authoritative, data-driven, measured | report, article |
| `캐주얼` | Casual friend. Conversational, emoji-friendly, short sentences | shorts, social |

## Format-Specific Structures

### newsletter (6-stage)

```
1. 제목: Hook — curiosity gap or bold claim
2. 인트로: Context — why this matters now
3. Yes: Agreement — the common understanding
4. But: Twist — the surprising reality or counter-evidence
5. Therefore: Insight — the actionable takeaway
6. 결론: CTA — what reader should do next
```

Minimum: 800 words. Must include at least 2 data points from research.

### shorts (hook-problem-solution-CTA)

```
1. Hook: 3-second attention grab (question or bold statement)
2. Problem: Pain point the viewer recognizes
3. Solution: The insight or method
4. CTA: Clear next action
```

Total: 60-90 seconds of spoken content (~150-225 words). CTA is mandatory.

### article

Headline + subtitle, lead paragraph, 3-5 body sections with subheads, key takeaways, conclusion. Min 1500 words.

### report

Executive summary (1 page), background, 3-5 analysis sections, numbered recommendations (each referencing analysis), appendix. Min 2000 words.

### social

Single platform-optimized post with hashtag suggestions. Max 280 chars (Twitter) / 2200 (Instagram).

### card-news

Cover slide (bold title + hook), 6-7 content slides (one idea each, max 30 words), summary slide, CTA slide. Visual direction notes included.

## Gotchas

| Failure Mode | Mitigation |
|-------------|------------|
| Generic voice — sounds like ChatGPT | Voice guide is injected into writer prompt. Reviewer checks tone compliance. |
| Skips research step | Research is auto-called. `--skip-research` requires explicit flag. |
| Too-short content | Minimum word counts enforced per format. Writer must hit threshold before submitting. |
| Forgets CTA in shorts | CTA is a mandatory section in the shorts template. Review flags missing CTA as Critical. |
| Over-uses bullet lists | Newsletter and article formats require flowing prose. Bullets allowed only in takeaway sections. |
| Ignores review feedback | Editor must address every Critical and Major item. Diff between draft and final is logged. |

## Patterns Absorbed

- **Academy Shorts pipeline**: hook-problem-solution-CTA structure with strict timing
- **Newsletter 7-stage pipeline**: Yes-But-Therefore narrative arc
- **Content Factory**: One source material, multiple output formats. Research runs once, feeds all formats.

## Subagent Dispatch

```yaml
writer:
  model: opus
  tools: [none - works on research output]
  constraint: "must follow format template, hit word minimums, apply voice"

editor:
  model: opus
  tools: [none - works on review feedback + draft]
  constraint: "must address all Critical/Major review items"
```

## Integration

- Auto-calls `/scc:research` (unless `--skip-research`)
- Auto-calls `/scc:review` with `content` preset (unless `--skip-review`)
- Output goes to `--publish` destination (file or Notion)

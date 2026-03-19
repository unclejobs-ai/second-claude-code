---
name: write
description: "Use when producing newsletters, articles, reports, shorts, or social content"
---

# Write

Produce content with automatic research and review unless the caller explicitly skips those steps.

## When to Use

- The user asks for a draft, article, newsletter, report, short-form script, or social post
- Another skill needs polished written output

## Workflow

1. Run `/second-claude-code:research` unless source material is already provided.
2. Ask `writer` to draft in the selected format and voice.
3. Run `/second-claude-code:review` with the `content` preset unless skipped.
4. Ask `editor` to address all Critical and Major issues.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--format` | `newsletter\|article\|shorts\|report\|social\|card-news` | `newsletter` |
| `--voice` | `peer-mentor\|expert\|casual` | format-specific |
| `--publish` | `notion\|file` | `file` |
| `--skip-research` | flag | off |
| `--skip-review` | flag | off |
| `--lang` | `ko\|en` | `ko` |
| `--input` | file path | none |

When `--input` is provided (or when called from a pipeline with `input_from`), the file content is injected as source context and `--skip-research` is implied.

## Voices

| Voice | Default For |
|-------|-------------|
| `peer-mentor` | newsletter |
| `expert` | report, article |
| `casual` | shorts, social |

## Format Rules

- `newsletter`: 6-stage arc, minimum 2000 words, at least 2 research data points
- `article`: minimum 3000 words
- `report`: minimum 4000 words with numbered recommendations
- `shorts`: around 300 words with a mandatory CTA
- `social`: platform-optimized short post
- `card-news`: slide-by-slide narrative with visual direction

## Length Negotiation

When user-specified length conflicts with format minimums:
1. Inform the user: "Article format minimum is 3000 words, you requested ~800."
2. Offer alternatives: switch to `shorts` or `social` format, OR keep `article` at full length.
3. If user insists on short article, respect user intent but note the override in output metadata.

Never silently truncate or silently exceed the user's request.

## Gotchas

- Do not skip research unless real sources are already supplied.
- Do not miss the CTA in shorts or conclusions.
- Do not ship the reviewed version without addressing Critical and Major issues.

## Subagents

```yaml
writer: { model: opus, constraint: "follow format rules, voice, and length minimums" }
editor: { model: opus, constraint: "address all Critical and Major review items" }
```

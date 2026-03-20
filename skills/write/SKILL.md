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

1. Run `/second-claude-code:research` UNLESS `--skip-research` flag is set OR source material is already provided via `--input`.
2. Load format spec: read `references/formats/{format}.md` if it exists (e.g., `references/formats/shorts.md`, `references/formats/newsletter.md`). Apply voice from the Voices table.
3. Draft content following loaded format spec and voice constraints.
4. Run `/second-claude-code:review --preset quick` UNLESS `--skip-review` flag is set. This step is MANDATORY by default.
5. Address all Critical and Major review findings. Re-read the review output and apply fixes.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--format` | `newsletter\|article\|shorts\|report\|social\|card-news` | `article` |
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
| `casual` | shorts, social, card-news |

## Voice Checklist

Before finalizing, verify:
- [ ] At least one first-person example (peer-mentor) OR authoritative citation (expert) OR conversational aside (casual)
- [ ] Tone is consistent throughout — no voice mixing
- [ ] CTA present for shorts/social formats

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

## Auto-Save

After the review step (or after drafting if `--skip-review`), save the final content:

- Path: `.captures/write-{format}-{slug}-{YYYY-MM-DD}.md`
- `{slug}` = topic lowercased, spaces to hyphens, max 40 chars
- Write the full content using the Write tool. Do NOT skip this step.
- Tell the user the saved path.

When `--publish notion` is set, publish to Notion AND save the local .md file.

## Gotchas

- Do not skip research unless real sources are already supplied.
- Do not start writing before loading the format spec file.
- Do not output content without running the review step (unless `--skip-review` is explicitly set).
- Do not miss the CTA in shorts or conclusions.
- Do not ship the reviewed version without addressing Critical and Major issues.

## Subagents

```yaml
writer: { model: opus, constraint: "follow format rules, voice, and length minimums" }
editor: { model: opus, constraint: "address all Critical and Major review items" }
```

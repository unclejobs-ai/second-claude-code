---
name: translate
description: "Use when translating content between English and Korean with formatting preservation"
effort: medium
---

# Translate

Translate content between English and Korean (EN↔KO) while preserving formatting, voice, and technical accuracy.

## When to Use

- The user asks to translate text, a document, or content between English and Korean
- Another skill needs bilingual output
- Any prompt like "번역해줘", "translate this", "영어로", "한국어로"

## Workflow

1. Detect source and target languages from the prompt. If ambiguous, ask: "What is the target language — English or Korean?"
2. If `.data/soul/SOUL.md` exists, read `## Tone Rules` to align translation voice with user preferences.
3. Load glossary if available: read `references/glossary.md` for technical term mappings. If the file doesn't exist, proceed without it.
4. Dispatch **Smeargle** (writer/opus) to produce the translation draft, passing source text, target language, style, format mode, glossary terms, and soul tone rules as context.
5. Dispatch **Ditto** (editor/opus) for QA review: verify accuracy, formatting preservation, natural phrasing, and glossary compliance.
6. Address all Critical and Major QA findings. Minor findings may be deferred.
7. Auto-save the result.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--style` | `literal\|natural\|creative` | `natural` |
| `--format` | `preserve\|adapt` | `preserve` |
| `--source` | `en\|ko` | auto-detect |
| `--target` | `en\|ko` | opposite of source |
| `--glossary` | file path | `references/glossary.md` |
| `--skip-qa` | flag | off |
| `--input` | file path | none |

### Style Modes

| Style | Behavior |
|-------|----------|
| `literal` | Closest possible 1:1 translation. Preserves sentence structure and word order where grammatically valid. Suitable for legal, contractual, or specification documents. |
| `natural` | Fluent, idiomatic translation that reads as if originally written in the target language. Restructures sentences for natural flow. Default for most content. |
| `creative` | Adapts meaning, idioms, and cultural references for the target audience. May restructure paragraphs. Suitable for marketing copy, newsletters, and social content. |

### Format Modes

| Mode | Behavior |
|------|----------|
| `preserve` | Keep the original document structure intact: headings, bullet order, table layout, code block positions. Translate only the natural-language content. |
| `adapt` | Localize the document structure for the target culture. Korean→English may flatten nested honorific structures. English→Korean may add contextual headers. Reorder sections if culturally appropriate. |

## Soul-Aware Voice Resolution

Voice is resolved in this priority order:
1. `--style` flag (explicit override — always wins)
2. `## Tone Rules` in `.data/soul/SOUL.md` (personal preferences — merge with style)
3. Target language conventions as baseline

If `.data/soul/SOUL.md` exists, read its `## Tone Rules` section and treat those rules as non-negotiable constraints on top of the selected style. Soul tone rules override language defaults but never override an explicit `--style` flag.

## Formatting Preservation Rules

These elements MUST be preserved exactly in all modes:

- **Markdown headings**: `#`, `##`, `###` hierarchy maintained
- **Code blocks**: Never translate content inside ``` fences. Translate only surrounding comments if `--style creative`.
- **Inline code**: Never translate content inside backticks
- **Tables**: Preserve column count and alignment. Translate cell content only.
- **Links**: Preserve URLs. Translate link text only.
- **HTML tags**: Preserve tags. Translate inner text only.
- **YAML frontmatter**: Preserve keys. Translate values only when they are human-readable strings.
- **Bullet/numbered lists**: Preserve nesting depth and numbering scheme.
- **Emphasis**: Preserve `**bold**`, `*italic*`, `~~strikethrough~~` markers around translated text.

## Glossary Support

The glossary file maps technical terms bidirectionally:

```markdown
| EN | KO | Notes |
|----|-----|-------|
| agent | 에이전트 | Do not translate as 대리인 in tech context |
| skill | 스킬 | Use 스킬 not 기술 for this project |
| hook | 훅 | Keep as 훅 in dev context |
| pipeline | 파이프라인 | |
| prompt | 프롬프트 | |
```

When a glossary entry exists, the mapped term MUST be used. When no glossary entry exists, use the most contextually appropriate translation.

If `--glossary` points to a custom file, load that instead of the default.

## Language-Specific Rules

### English → Korean
- Default speech level: 해요체 (polite informal). Override with soul tone rules if they specify a different level.
- Preserve technical terms in their original English when no established Korean equivalent exists (e.g., "CI/CD" stays "CI/CD").
- Numbers and units: keep Arabic numerals. Convert units only if `--format adapt`.

### Korean → English
- Drop honorific markers unless `--style literal`.
- Convert Korean-specific cultural references to English equivalents in `creative` mode.
- Preserve Korean proper nouns in Revised Romanization unless a common English name exists.

## Auto-Save

After QA (or after translation if `--skip-qa`), save the final content:

- Path: `.captures/translate-{source}-to-{target}-{slug}-{YYYY-MM-DD}.md`
- `{slug}` = topic lowercased, spaces to hyphens, max 40 chars
- Write the full content using the Write tool. Do NOT skip this step.
- Tell the user the saved path.

## Gotchas

- Do not translate content inside code blocks or inline code.
- Do not guess the target language — detect from context or ask.
- Do not ignore glossary mappings when they exist.
- Do not skip QA unless `--skip-qa` is explicitly set.
- Do not flatten markdown structure in `preserve` mode.
- Do not mix speech levels (존댓말/반말) within a single translation.
- Do not translate proper nouns unless a glossary mapping exists.

## Subagents

```yaml
writer: { model: opus, constraint: "follow style mode, format mode, glossary, and soul tone rules" }
editor: { model: opus, constraint: "verify accuracy, formatting preservation, glossary compliance, and natural phrasing" }
```

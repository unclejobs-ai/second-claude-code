---
description: "Soul-aware English/Korean translation with style and format control"
argument-hint: '"text or file path" --to ko|en --style formal|casual|technical'
---

Invoke the `/second-claude-code:translate` command to translate content through the `translate` skill.

## Context
- Current soul: !`cat .data/soul/SOUL.md 2>/dev/null | head -5 || echo "No soul synthesized yet"`

## Arguments
- Required: text, file path, or content to translate
- `--to ko|en` target language
- `--style formal|casual|technical` style hint
- `--format preserve|plain|markdown` output format

## Your task
Translate now using the plugin's loaded `translate` skill and the provided arguments.

- Preserve meaning, formatting, and terminology unless the arguments say otherwise.
- Return the translated content directly.
- Do not say that you are invoking or have invoked a skill.

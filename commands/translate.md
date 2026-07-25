---
description: "Soul-aware English/Korean translation with style and format control"
argument-hint: '"text or file path" --target en|ko --style literal|natural|creative'
---

Invoke the `/scc:translate` command to translate content through the `translate` skill.

## Context
- Current soul: !`cat .data/soul/SOUL.md 2>/dev/null | head -5 || echo "No soul synthesized yet"`

## Arguments
- Required: text, file path, or content to translate
- `--target en|ko` target language (default: opposite of source)
- `--source en|ko` source language (default: auto-detect)
- `--style literal|natural|creative` translation style (default: natural)
- `--format preserve|adapt` formatting mode (default: preserve)
- `--glossary <path>` terminology map (default: references/glossary.md)
- `--skip-qa` skip the Ditto QA review
- `--input <path>` read the source from a file

## Your task
Translate now using the plugin's loaded `translate` skill and the provided arguments.

- Preserve meaning, formatting, and terminology unless the arguments say otherwise.
- Return the translated content directly.
- Do not say that you are invoking or have invoked a skill.

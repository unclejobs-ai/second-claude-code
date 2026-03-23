---
description: "Observe and synthesize a persistent user identity profile (SOUL.md)"
argument-hint: '"learn" or "propose" or "show" or "init --template developer"'
---

Invoke the `/second-claude-code:soul` command to build and maintain a user identity profile through the `soul` skill.

## Context
- Current soul: !`cat .data/soul/SOUL.md 2>/dev/null | head -5 || echo "No soul synthesized yet"`
- Observation count: !`wc -l < .data/soul/observations.jsonl 2>/dev/null || echo "0"` observations logged

## Subcommands
- `init` — bootstrap a fresh observation log and SOUL.md stub
- `learn` — record observations from this session into the log
- `show` — display current SOUL.md with evidence citations
- `propose` — synthesize and output a proposed SOUL.md (does not write)
- `apply` — write the proposed SOUL.md after review
- `diff` — compare current vs. proposed SOUL.md
- `reset` — archive current soul and start fresh

## Options
- `--mode manual|learning|hybrid` (default: hybrid)
- `--template default|developer|writer|researcher` (for init only)
- `--import <path>` (import observations from external file)

## Your task
Run the soul skill using the provided subcommand and arguments.

- Execute the subcommand workflow as defined in the soul skill.
- For `propose`: output the full proposed SOUL.md with evidence citations. Do not write to file.
- For `apply`: require the proposed SOUL.md to exist in this session before writing.
- For `learn`: dispatch the analyst subagent to extract signals from this session.
- Do not say that you are invoking or have invoked a skill.

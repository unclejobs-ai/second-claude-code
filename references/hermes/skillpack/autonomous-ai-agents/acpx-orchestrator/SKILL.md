---
name: acpx-orchestrator
description: Dispatch coding work to multiple external ACP-compatible coding agents through acpx and collect stable artifacts for later review.
version: 1.0.0
author: Second Claude Code
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [coding, acpx, orchestration, agents]
    category: autonomous-ai-agents
    related_skills: [external-coding-supervisor, mmbridge-quality]
---
# acpx-orchestrator

Use this skill when Hermes should run multiple external coding-agent runtimes in
parallel through `acpx`.

## When to Use

- You want Codex CLI, Claude Code, and Gemini CLI to handle distinct roles
- The task benefits from one writer plus one or more read-only reviewers
- You want stable local artifacts instead of ephemeral terminal output

## Quick Reference

| Goal | Command |
| --- | --- |
| Parallel coding fan-out | `node scripts/acpx-fanout.mjs run '<json>'` |
| Composite run with mmbridge handled elsewhere | Use this skill first, then `mmbridge-quality` |
| Read the final run | Inspect `.data/external-runs/acpx/<run_id>/summary.md` |

## Procedure

1. Confirm the repository contains `scripts/acpx-fanout.mjs`.
2. Confirm `acpx` is installed or a custom launcher is configured.
3. Build a role map with exactly one write-capable role.
4. Run `node scripts/acpx-fanout.mjs run '<json>'` from the repo root.
5. Read `summary.md` before opening raw role artifacts.
6. If the writer failed, stop and report the implementation failure first.
7. If reviewers disagree, ask for a narrower follow-up instead of merging conclusions.

## Standard Invocation

```bash
node scripts/acpx-fanout.mjs run '{
  "cwd": ".",
  "task": "Implement the requested change, review it, and draft operator notes.",
  "roles": [
    {
      "role": "impl",
      "agent": "codex",
      "mode": "exec",
      "prompt_template": "You are the implementation agent. You may edit files and run tests. Task: {{task}}"
    },
    {
      "role": "review",
      "agent": "claude",
      "mode": "exec",
      "prompt_template": "You are the reviewer. Do not edit files. Identify concrete regressions and missing tests for: {{task}}"
    },
    {
      "role": "docs",
      "agent": "gemini",
      "mode": "exec",
      "prompt_template": "You are the documentation agent. Do not edit files. Summarize user-visible changes and migration notes for: {{task}}"
    }
  ]
}'
```

## Pitfalls

- Do not let more than one role edit files in the same working tree.
- Do not auto-merge outputs from multiple coding agents.
- Do not treat review or docs roles as authoritative patch sources.
- Do not inspect raw ACP output first; it is noisier than the generated summary.

## Verification

- `summary.md` exists under `.data/external-runs/acpx/<run_id>/`
- `manifest.json` exists and lists all roles
- Every role has a `result.json`
- Failed roles have preserved `stderr.txt`

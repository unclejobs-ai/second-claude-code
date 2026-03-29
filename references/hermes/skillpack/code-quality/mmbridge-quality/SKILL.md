---
name: mmbridge-quality
description: Run mmbridge review, security, gate, and handoff commands as structured quality checks from Hermes.
version: 1.0.0
author: Second Claude Code
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [quality, review, security, gate, mmbridge]
    category: code-quality
    related_skills: [external-coding-supervisor, acpx-orchestrator]
---
# mmbridge-quality

Use this skill when Hermes should perform structured quality checks with
`mmbridge`.

## When to Use

- A coding pass has already completed and needs review or gate coverage
- You need machine-readable review or gate results
- You want a resumable quality artifact instead of free-form review text

## Quick Reference

| Goal | Command |
| --- | --- |
| Review | `mmbridge review --tool kimi --mode review --stream --export /tmp/mmbridge-review-$(date +%s).md` |
| Security | `mmbridge security --json > /tmp/mmbridge-security-$(date +%s).json` |
| Gate | `mmbridge gate --format json > /tmp/mmbridge-gate-$(date +%s).json` |
| Handoff | `mmbridge handoff --write /tmp/mmbridge-handoff-$(date +%s).md` |

## Procedure

1. Confirm `mmbridge` is installed.
2. Choose the narrowest quality command that answers the current question.
3. Prefer JSON or file export output over terminal-only output.
4. Read the artifact and summarize the next action.
5. Treat failures as degraded signal unless your workflow explicitly requires a hard gate.

## Pitfalls

- Do not run all quality commands by default.
- Do not block on `mmbridge` if your workflow treats it as advisory.
- Do not claim pass/fail without reading the structured result.

## Verification

- The output artifact exists and parses successfully
- Review output includes findings or an explicit empty finding set
- Gate output includes `status`
- Handoff output is written to disk

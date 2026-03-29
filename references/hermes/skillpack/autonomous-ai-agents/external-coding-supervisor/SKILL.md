---
name: external-coding-supervisor
description: Run acpx multi-agent coding fan-out and mmbridge quality checks in one composite workflow from Hermes.
version: 1.0.0
author: Second Claude Code
license: MIT
platforms: [macos, linux]
metadata:
  hermes:
    tags: [coding, supervisor, acpx, mmbridge, orchestration]
    category: autonomous-ai-agents
    related_skills: [acpx-orchestrator, mmbridge-quality]
---
# external-coding-supervisor

Use this skill when Hermes should launch a full external coding pass with
parallel agent execution followed by mmbridge quality checks.

## When to Use

- You want one command surface for `acpx` execution plus `mmbridge` gating
- You want Hermes to inspect one summary file instead of multiple raw outputs
- You want a single-writer implementation path with post-run review coverage

## Quick Reference

| Goal | Command |
| --- | --- |
| Full run | `node scripts/hermes-external-run.mjs run '<json>'` |
| Read final result | `.data/external-runs/acpx/<run_id>/summary.md` |
| Quality artifacts | `mmbridge-review.json`, `mmbridge-gate.json` in the run dir |

## Procedure

1. Confirm the repository contains `scripts/hermes-external-run.mjs`.
2. Confirm both `acpx` and `mmbridge` are available on the host.
3. Prepare the task description and role prompts.
4. Run the composite launcher.
5. Read `summary.md` first.
6. If `impl` failed, stop; the mmbridge phase is intentionally skipped.
7. If the mmbridge gate warns or fails, request a corrective implementation pass instead of accepting the run.

## Standard Invocation

```bash
node scripts/hermes-external-run.mjs run '{
  "cwd": ".",
  "task": "Implement the requested change, review it, and gate it.",
  "acpx": {
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
  },
  "mmbridge": {
    "enabled": true,
    "review_options": { "scope": "all" },
    "gate_options": { "mode": "review" }
  }
}'
```

## Pitfalls

- Do not bypass the summary and jump straight to raw artifacts.
- Do not keep mmbridge enabled when the writer role is known to be failing fast; fix the writer first.
- Do not promote a warning-only gate result to pass without reading the warning details.

## Verification

- `summary.md` exists and includes both role status and MMBridge sections
- `mmbridge-review.json` exists when `impl` succeeds
- `mmbridge-gate.json` exists when `impl` succeeds
- `manifest.json` contains an `mmbridge` object after the composite run

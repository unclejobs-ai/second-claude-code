# acpx-orchestrator

Use this skill when Hermes should dispatch work to multiple external coding-agent
runtimes through `acpx`.

## Purpose

- run implementation, review, and docs tasks in parallel
- collect stable artifacts under `.data/external-runs/acpx/`
- give Hermes a single `summary.md` to read instead of raw ACP streams

## Requirements

- `acpx` installed and available on `PATH`, or a custom launcher provided
- terminal/process tool access
- repo root available to Hermes

## Rules

- default to one write-capable role only: `impl`
- `review` and `docs` are read-only analysis roles
- never auto-merge conflicting outputs
- read `summary.md` first, then inspect per-role artifacts only if needed

## Standard Invocation

Run from the repository root:

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

## After the Run

1. Read `summary.md`
2. If `impl` failed, stop and report the failure first
3. If reviewers disagree, treat the run as advisory and request a narrower follow-up
4. Only inspect `stdout.ndjson` or `result.json` when the summary is insufficient

## Artifacts

All artifacts live under:

`.data/external-runs/acpx/<run_id>/`

Key files:

- `manifest.json`
- `summary.md`
- `<role>/result.json`
- `<role>/stdout.ndjson`
- `<role>/stderr.txt`

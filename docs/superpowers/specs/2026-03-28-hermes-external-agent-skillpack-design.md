# Hermes External Agent Skillpack Design

**Date**: 2026-03-28
**Scope**: External Hermes operator integration for `acpx` and `mmbridge`
**Architecture**: Keep Second Claude Code runtime unchanged. Export local scripts and operator docs that Hermes skills can call through its terminal/process tools.

---

## Motivation

Hermes already supports Codex as an inference provider, but that is not the same as
controlling multiple external coding-agent runtimes. We need a practical operator
path where:

- Hermes can trigger parallel coding work through `acpx`
- Hermes can trigger quality review and gate flows through `mmbridge`
- Second Claude Code remains a Claude Code plugin, not a second Hermes runtime

This design keeps the repo boundary intact while producing assets Hermes can use
immediately.

## Boundary

### In scope

- Local scripts that wrap `acpx` runs into stable artifacts
- Copy-paste Hermes skill docs that call those local scripts
- Summary artifacts that Hermes can read without parsing raw ACP event streams
- Tests for the local wrappers

### Out of scope

- Embedding Hermes runtime in the plugin
- Implementing ACP inside the plugin
- Auto-merging patches produced by multiple external agents
- Making `mmbridge` or `acpx` required runtime dependencies for core plugin flows

## Problem Split

### Hermes "Codex" is not `acpx codex`

- Hermes "Codex" = inference provider used by Hermes itself
- `acpx codex` = Codex CLI runtime addressed over ACP through the `acpx` client

The former solves model selection. The latter solves multi-runtime orchestration.

### MMBridge and ACP solve different layers

- `acpx`: dispatch and collect work from external coding agents
- `mmbridge`: review, security, gate, handoff, followup, resume

The operator path should use both, not force one to impersonate the other.

## Target Operator Flow

```text
Hermes
  -> terminal/process
  -> node scripts/acpx-fanout.mjs run '<json>'
       -> acpx codex
       -> acpx claude
       -> acpx gemini
       -> artifacts under .data/external-runs/acpx/<run_id>/
  -> read summary.md
  -> optional mmbridge review/security/gate
  -> summarize next action
```

## Local Artifact Contract

All `acpx` orchestration artifacts live under:

`<CLAUDE_PLUGIN_DATA or .data>/external-runs/acpx/<run_id>/`

Files:

- `manifest.json`: top-level run metadata and per-role status
- `<role>/request.json`: normalized request payload
- `<role>/stdout.ndjson` or `<role>/stdout.txt`: raw command output
- `<role>/stderr.txt`: captured stderr
- `<role>/result.json`: normalized execution result
- `summary.md`: human-readable overview for Hermes or a human operator

## Role Contract

Default roles:

- `impl`: single writer, implementation-oriented
- `review`: read-only reviewer
- `docs`: read-only documentation or release-note summarizer

The integration explicitly avoids multiple write-capable roles in the same working
tree. If multi-writer use is needed later, it must be coupled with worktree
isolation outside this first iteration.

## Script Responsibilities

### `scripts/acpx-runner.mjs`

- Normalize a single `acpx` request
- Support `exec` and `session` modes
- Capture stdout/stderr/duration/exit status
- Parse NDJSON if `--format json` is requested
- Write stable artifact files

### `scripts/acpx-fanout.mjs`

- Generate per-role prompts from a task
- Run multiple `acpx` requests in parallel
- Preserve partial failures
- Write `manifest.json`
- Trigger summary generation

### `scripts/acpx-render-summary.mjs`

- Read a manifest
- Produce a concise `summary.md`
- Highlight success/failure and final text snippets by role

## Hermes Skillpack

We will provide two operator docs under `references/hermes/`:

- `acpx-orchestrator-skill.md`
- `mmbridge-quality-skill.md`

These are external skill specs for Hermes users. They are documentation assets,
not plugin runtime wiring.

## Failure Model

- `acpx` absent: script exits non-zero with a clear launcher error
- one role fails: manifest captures the failure, other role artifacts remain valid
- JSON parsing fails: raw stdout is preserved and result marks parsing degradation
- summary generation fails: raw artifacts remain source of truth

## Verification

- unit/runtime tests for runner and fanout
- fake `acpx` launcher fixture to avoid hard dependency during tests
- summary artifact creation verified through runtime tests

## Rollout

### Phase 1

- add local scripts
- add tests
- add Hermes operator docs

### Phase 2

- optional daemon indexing of external runs
- optional worktree-aware launch policy
- optional tighter mmbridge handoff integration

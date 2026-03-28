# Hermes External Agent Skillpack Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export stable local wrappers and Hermes-facing operator docs so Hermes can drive both `acpx` and `mmbridge` against this repository without changing the plugin runtime boundary.

**Architecture:** Add a tested `acpx` wrapper stack (`runner` -> `fanout` -> `summary`) plus Hermes operator references for `acpx` orchestration and `mmbridge` quality workflows. Keep all integration optional and file-based.

**Tech Stack:** Node.js ESM, built-in `node:test`, markdown operator docs

---

### Task 1: Write the design and operator references

**Files:**
- Create: `docs/superpowers/specs/2026-03-28-hermes-external-agent-skillpack-design.md`
- Create: `references/hermes/README.md`
- Create: `references/hermes/acpx-orchestrator-skill.md`
- Create: `references/hermes/mmbridge-quality-skill.md`

- [ ] **Step 1: Write the design spec**

Document the runtime boundary, local artifact contract, role definitions, and
failure model.

- [ ] **Step 2: Write the Hermes operator reference**

Create a short README explaining that these docs are external Hermes skill assets,
not plugin runtime dependencies.

- [ ] **Step 3: Write the `acpx` Hermes skill document**

Include:
- prerequisites
- exact `node scripts/acpx-fanout.mjs run '<json>'` pattern
- default role policy
- post-run artifact reading rules

- [ ] **Step 4: Write the `mmbridge` Hermes skill document**

Include:
- review/security/gate command patterns
- output capture guidance
- non-blocking failure policy

### Task 2: Implement the single-run `acpx` wrapper

**Files:**
- Create: `scripts/lib/acpx-runtime.mjs`
- Create: `scripts/acpx-runner.mjs`
- Create: `tests/fixtures/fake-acpx.mjs`
- Create: `tests/runtime/acpx-runner.test.mjs`

- [ ] **Step 1: Write a fake launcher fixture**

It must emulate:
- `sessions ensure`
- `exec`
- session prompt mode
- optional forced failure by agent name

- [ ] **Step 2: Write the shared runtime helper**

Implement normalized request validation, launcher construction, safe JSON-line
parsing, output paths, and artifact helpers.

- [ ] **Step 3: Implement `acpx-runner`**

Support:
- `exec` mode
- `session` mode with `sessions ensure`
- stdout/stderr capture
- artifact emission
- JSON parsing degradation without data loss

- [ ] **Step 4: Write runner tests**

Test:
- successful exec run
- successful session run with ensure metadata

### Task 3: Implement parallel fanout and summary generation

**Files:**
- Create: `scripts/acpx-fanout.mjs`
- Create: `scripts/acpx-render-summary.mjs`
- Create: `tests/runtime/acpx-fanout.test.mjs`

- [ ] **Step 1: Implement default role templates**

Default roles:
- `impl` -> `codex`
- `review` -> `claude`
- `docs` -> `gemini`

- [ ] **Step 2: Implement fanout execution**

Run all roles in parallel, preserve partial failures, and write a top-level
`manifest.json`.

- [ ] **Step 3: Implement markdown summary generation**

Generate `summary.md` from `manifest.json` and per-role `result.json`.

- [ ] **Step 4: Write fanout tests**

Test:
- all roles succeed
- one role fails while the run stays inspectable

### Task 4: Verify and document usage

**Files:**
- Modify: `package.json` (only if needed for test or script discoverability)

- [ ] **Step 1: Run runtime tests**

Run: `node --test 'tests/runtime/acpx-*.test.mjs'`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Smoke-read generated Hermes docs**

Verify that the Hermes operator docs reference only local scripts and optional
external tools, with no repo-boundary violation.

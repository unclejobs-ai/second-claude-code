---
name: investigate
description: "Use when debugging errors, unexpected behavior, or root-cause analysis"
effort: medium
---

## Iron Law

> **No fixes without root cause investigation first.**

## Red Flags

- "I can write tests later" → STOP. Write them now.
- "This change is too small to review" → STOP. Small bugs become P0 incidents.
- "I don't need to check previous cycle insights" → STOP. You will repeat the same mistake.
- "This is good enough" → STOP. Check the checklist.
- "No time to follow every step" → STOP. Skipped steps cost 3x more later.

# Investigate

Systematic debugging with root cause investigation. Four phases: investigate, analyze, hypothesize, fix.

## When to Use

- User reports errors, stack traces, or unexpected behavior
- "Debug this", "fix this bug", "why is this broken"
- "It was working yesterday"
- 500 errors, TypeErrors, silent failures
- Another skill encounters a reproducible error it cannot resolve

## Workflow

1. **Investigate** — Gather evidence before forming any opinion.
   - Read the exact error message and full stack trace.
   - Identify reproduction conditions (when, where, which input).
   - Check recent changes: `git log --oneline -20` and `git diff HEAD~5 --stat`.
   - Scope the blast radius: Grep/Glob for related files and callers.

2. **Analyze** — Classify the pattern.

   | Pattern | Symptoms | Check |
   |---------|----------|-------|
   | Race condition | Intermittent failure | Timing/ordering dependency |
   | State corruption | Wrong values | Trace state mutation points |
   | Nil/undefined | TypeError | Missing optional chaining |
   | Import/dep conflict | Module errors | node_modules, version mismatch |
   | MCP protocol error | Tool invocation failure | Request/response schema mismatch |
   | Hook execution order | Unexpected side effects | Hook registration sequence |
   | Skill file parsing | Routing mismatch | YAML frontmatter + pattern match |
   | Schema drift | Type errors at boundaries | Schema vs handler comparison |
   | Stale cache | Works after clear | Cache invalidation path |
   | Config drift | Works locally, fails elsewhere | Environment variable differences |

3. **Hypothesize & Test** — State each hypothesis explicitly before testing.
   - Write it down: "X causes Y because Z"
   - Design a minimal test (add a log, change a condition, isolate)
   - **3-Strike Rule**: 3 consecutive wrong hypotheses → STOP and ask the user for more context. Do not guess further.

4. **Fix & Verify** — Only after root cause is confirmed.
   - **Blast Radius Gate**: If fix touches >5 files, ask before proceeding.
   - Apply the minimal fix for the confirmed cause.
   - Verify the fix: test FAILS without fix, PASSES with fix.
   - Write a regression test immediately. Do NOT ask — just write it.
   - Run the project's test/lint gates.

## Scope Lock

During investigation, do NOT modify files unrelated to the bug.
Resist refactoring temptation — this session is for the bug only.

## Options

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--scope` | `<path>` | auto-detected | Restrict investigation to directory |
| `--depth` | `shallow\|deep` | `shallow` | shallow=recent changes, deep=full history |

## Gotchas

- "Quick fix for now" → This is ALWAYS the wrong approach. Investigate first.
- If the bug is in a dependency, confirm the version and check release notes before blaming app code.
- MCP server restart may be needed to clear cached state — verify with a clean restart.
- Don't trust "it works on my machine" — check environment differences.

## Subagents

```yaml
evidence-gatherer: { model: sonnet, constraint: "Read logs, grep codebase, list recent commits — evidence only, no fixes", tools: [Read, Bash, Glob, Grep] }
root-cause-analyst: { model: opus, constraint: "Given evidence, determine the single root cause with confidence score" }
```

## Auto-Save

- Path: `.captures/investigate-{slug}-{YYYY-MM-DD}.md`
- `{slug}` = error type lowercased, spaces to hyphens, max 40 chars
- Write the full debug report using the Write tool and tell the user the saved path.

## Output

A structured debug report:

```
## Debug Report

### Symptom
{Original error/behavior}

### Root Cause
{Confirmed cause with evidence}

### Fix
{Changes made — file:line}

### Verification
- [ ] Original scenario no longer reproduces
- [ ] Regression test written and passing
- [ ] Test fails without fix, passes with fix
- [ ] Related tests passing

### Risk: {LOW|MEDIUM|HIGH}
### Confidence: {1-10}/10
```

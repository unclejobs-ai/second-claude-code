---
name: deep-interview
description: "Use when a vague idea needs Socratic requirements discovery, topology confirmation, ambiguity scoring, and an approval-gated spec before execution"
effort: high
---

# Deep Interview

Deep Interview turns vague requests into clear, approval-gated specifications. It asks one targeted question at a time, measures clarity after each answer, and stops execution until ambiguity is below the resolved threshold or the user explicitly accepts the remaining risk.

## Iron Law

> **Do not build from ambiguity.** Confirm the scope topology first, reduce ambiguity with scored questions, persist the spec, and require explicit approval before any execution workflow runs.

## When to Use

- The user says the idea is vague, asks to be interviewed, or wants assumptions exposed before execution.
- A request is complex enough that jumping to code would waste time on scope discovery.
- The user wants a durable spec for ralplan, ultragoal, or team rather than direct mutation.
- Brownfield work needs codebase facts gathered before asking the user to decide.

## Protocol

1. Resolve the ambiguity threshold from settings, defaulting to `0.05` when unset.
2. Detect greenfield vs brownfield and gather repo facts before asking codebase questions.
3. Run Round 0 topology confirmation exactly once. Keep sibling components visible throughout scoring and spec output.
4. Ask one question per round, targeting the weakest active component and clarity dimension.
5. Score goal, constraints, success criteria, and brownfield context with the weighted ambiguity formula.
6. Preserve the session language in questions, options, progress reports, and generated specs.
7. Use challenge modes at the documented round thresholds: contrarian, simplifier, then ontologist.
8. Write the final spec to `.gjc/specs/deep-interview-{slug}.md` and present approval choices.

## Runtime Surface

Use `node scripts/deep-interview-runner.mjs` for stateful execution. The runner owns threshold resolution, state persistence, resume/status output, scoring helpers, topology snapshots, spec rendering, and approval option rendering.
See `docs/skills/deep-interview.md` for self-serve usage, scoring, and troubleshooting details.

Internal auto-mode fragments live under `skills/deep-interview/references/fragments/` with `kind: skill-fragment`. They are not public skills, commands, or `skill://` routes.

## Hard Gates

- Never mutate product source directly from Deep Interview.
- Never auto-run ralplan, ultragoal, or team; present approval options instead.
- Never collapse a multi-component topology into the most-detailed component.
- Never ask the user to rediscover repo facts that exploration can cite.
- Never hide auto-mode validation failures from state evidence; user-facing fallback may be quiet, but diagnostics must persist.

## Outputs

- Active interview state for resume.
- Per-round clarity scores and ontology snapshots.
- A final `.gjc/specs/deep-interview-{slug}.md` spec.
- Pending approval options for ralplan consensus, ultragoal execution, team execution, or continued refinement.

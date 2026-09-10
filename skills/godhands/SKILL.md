---
name: godhands
description: "Use when a request needs extra hands that find, analyze, plan, decompose, benchmark, and improve through gated gather, draft, check, and cut. Do not use merely because a request is vague; vagueness takes a clarifying question, not a full pass."
effort: high
user-invocable: false
---

[Resolve runtime paths](../runtime-paths.md) before file or script operations.

## Iron Law

> **When God Hands is selected, honor the phase gates. Do not skip Check.**

God Hands is the public name of the gated knowledge-work pass: find, analyze,
plan, decompose, benchmark, improve. The runtime state and MCP tools stay
`pdca_*`. `/scc:pdca` is the slash-only compat name.

## When to Use

- End-to-end knowledge work that must find sources, analyze them, plan, draft, check, and improve
- The user says "research and write", names a full pass, or asks for extra hands on the work
- A fork is already settled or does not apply (`/scc:coach` first when it does)

## When Not to Use

- The user already named `/scc:write`, `/scc:review`, or another single skill
- The request is vague — ask one question; do not start a pass
- Named replay (`/scc:workflow`) or a parallel split (`/scc:batch`)

## The pass

```
Gather  →  /scc:research + /scc:analyze
Draft   →  /scc:write --skip-research --skip-review
Check   →  /scc:review
Cut     →  Action Router → /scc:refine, or back to Gather/Draft
```

Load gate checklists from `../pdca/references/` at each transition. Do not skip
gates. Direct skills remain available without wrapping.

`/scc:write` runs an internal review unless `--skip-review`. God Hands Draft
must pass `--skip-research --skip-review` so Check owns quality.

## Options

Same flags as the compat command `/scc:pdca`: `--phase`, `--depth`, `--target`,
`--max`, `--max-cycles`, `--no-questions`.

## State

`.data/state/pdca-active.json`. MCP: `pdca_get_state`, `pdca_start_run`,
`pdca_transition`, `pdca_check_gate`, `pdca_end_run`.

See `../pdca/SKILL.md` for phase schemas, stuck detection, and the Action Router.
Do not dispatch Pokemon filenames. Call the chained skills above.

---
name: pipeline
description: "Use when chaining multiple /scc commands into a reusable workflow"
---

# Pipeline

Create, save, and run reusable multi-step workflows where each step passes files to the next.

## When to Use

- A workflow repeats across sessions
- The job needs 3 or more skill invocations in sequence
- Research, writing, review, and refinement should run as one named process

## Subcommands

| Command | Purpose |
|---------|---------|
| `create` | define a pipeline |
| `run` | execute a saved pipeline |
| `list` | show saved pipelines |
| `show` | inspect a pipeline |
| `delete` | remove a pipeline |

## Execution Model

1. Load the pipeline definition.
2. Identify parallel groups: scan consecutive steps marked `parallel: true` to form candidate groups. Steps within a candidate group that reference each other via `input_from` are executed sequentially; remaining independent steps run concurrently.
3. Run sequential steps one at a time as fresh subagents.
4. Run parallel groups concurrently — dispatch each step as an independent subagent. Wait for all to complete before the next group.
5. Pass data through files, never memory.
6. Save run state after every step.
7. Resume from saved state if interrupted.

### Presets

Run a named preset with `/second-claude-code:pipeline run <preset>`:

| Preset | Steps | Use For |
|--------|-------|---------|
| `autopilot` | research → analyze → write → review → loop | End-to-end content production |

Preset definitions are stored in `templates/`.

## Definition

Store pipeline definitions at `${CLAUDE_PLUGIN_DATA}/pipelines/{name}.json`.

Each step should declare:

- `skill`
- `args`
- `output`
- optional `input_from`
- optional `on_fail` with `abort`, `skip`, or `retry`
- optional `parallel: true` — steps marked parallel that share no `input_from` dependencies run concurrently via subagent dispatch

## State

- Active state: `${CLAUDE_PLUGIN_DATA}/state/pipeline-active.json`
- Run log: `${CLAUDE_PLUGIN_DATA}/pipelines/{name}-run.json`

Canonical active keys:

```json
{"name":"weekly-digest","current_step":2,"total_steps":4,"status":"running"}
```

## Constraints

- Maximum 10 steps per pipeline
- Every step must declare an `output`
- Step compatibility is validated through `input_from` and `output`

## Gotchas

- Never assume shared memory between steps.
- Save outputs immediately so later failures do not erase earlier work.
- Split oversized workflows into smaller pipelines rather than exceeding the step limit.

## Subagents

```yaml
orchestrator: { model: sonnet, tools: [Read, Write, Bash], constraint: "execute sequentially and persist state" }
step_executor: { model: varies, constraint: "read input file and write output file only" }
```

---
name: pipeline
description: "Use when chaining multiple /scc commands into a reusable workflow"
---

# Pipeline

Create, save, and run reusable multi-step workflows where each step passes files to the next. Pipelines support runtime parameterization so a single definition serves multiple topics and contexts.

## When to Use

- A workflow repeats across sessions
- The job needs 3 or more skill invocations in sequence
- Research, writing, review, and refinement should run as one named process
- The same workflow applies to different topics (use `--topic` at runtime)

## Subcommands

| Command | Purpose | Output |
|---------|---------|--------|
| `create` | define a pipeline | Confirmation with definition summary and variable list |
| `run` | execute a saved pipeline (accepts `--topic`, `--output_dir`, and custom `--var` flags) | Step-by-step progress (Pending/Running/Done/Failed); final summary with output file paths |
| `list` | show saved pipelines | Table: name, step count, preset flag, last run date. Include all presets. |
| `show` | inspect a pipeline (resolves variables if `--topic` provided) | Full definition with resolved variables |
| `delete` | remove a pipeline | Confirmation with name of deleted pipeline |

## Variables

Pipeline definitions use `{{placeholder}}` syntax for values resolved at runtime.

| Variable | Source | Default |
|----------|--------|---------|
| `{{topic}}` | `--topic "X"` flag at runtime | **required** if present in definition |
| `{{date}}` | auto-generated | `YYYY-MM-DD` of run start |
| `{{output_dir}}` | `--output_dir "path"` flag | current working directory |
| `{{run_id}}` | auto-generated | `{pipeline_name}-{timestamp}` |

Pass custom variables with `--var key=value`. See `references/pipeline-definition.md` for resolution rules, default values, and full definition examples.

## Execution Model

1. Load the pipeline definition.
2. **Resolve variables**: merge defaults with runtime flags, inject built-ins. Abort if any `{{...}}` token remains unresolved.
3. Identify parallel groups: consecutive steps marked `parallel: true` without cross-references run concurrently.
4. Run sequential steps one at a time as fresh subagents. Pass data through files, never memory.
5. Save run state (including resolved variables) after every step.
6. Resume from saved state if interrupted.

## Presets

Run a named preset with `/second-claude-code:pipeline run <preset>`:

| Preset | Steps | Use For |
|--------|-------|---------|
| `autopilot` | research -> analyze -> write(`--skip-research --skip-review`) -> review -> loop | End-to-end content production |
| `quick-draft` | research -> write | Fast first draft |
| `quality-gate` | review -> loop | Post-hoc quality check on existing content |

## Definition

Store pipeline definitions at `${CLAUDE_PLUGIN_DATA}/pipelines/{name}.json`. See `references/pipeline-definition.md` for step fields, data flow, and a full worked example.

## State

> **Data directory**: `${CLAUDE_PLUGIN_DATA}` is set by the plugin system. If unavailable, fall back to `.data/` relative to the plugin root. Before writing state files, verify the directory exists with `mkdir -p`.

- Active state: `${CLAUDE_PLUGIN_DATA}/state/pipeline-active.json`
- Run log: `${CLAUDE_PLUGIN_DATA}/pipelines/{name}-run.json`

See `references/pipeline-definition.md` for the canonical state schema.

## Constraints

- Maximum 10 steps per pipeline
- Every step must declare an `output`
- Step compatibility is validated through `input_from` and `output`
- **Circular reference detection**: At create-time, build a dependency graph from `input_from` references. If a cycle is detected (A → B → C → A), abort with an error listing the cycle path. This check runs before any execution.
- Every `{{variable}}` in the definition must resolve at runtime (from flags, defaults, or built-ins)
- Variable names must be alphanumeric plus underscores: `[a-zA-Z_][a-zA-Z0-9_]*`
- Every skill referenced in a step must be a valid `/second-claude-code:*` command. Validate at create-time and abort with an error listing unknown skills.
- `on_fail: retry` allows up to 2 retry attempts per step (3 total attempts: 1 original + 2 retries). After the retry limit is exhausted, the step is treated as `abort`.

## Gotchas

- Never assume shared memory between steps.
- Save outputs immediately so later failures do not erase earlier work.
- Split oversized workflows into smaller pipelines rather than exceeding the step limit.
- Always provide `--topic` when running a pipeline that uses `{{topic}}`.
- Variable resolution happens once at run start. Mid-pipeline changes require a new run.
- When resuming, the orchestrator reuses `resolved_vars` from saved state -- it does not re-resolve from flags.
- Do not create a pipeline referencing skills that don't exist.

## Subagents

```yaml
orchestrator: { model: sonnet, tools: [Read, Write, Bash], constraint: "resolve variables, execute sequentially, persist state" }
step_executor: { model: varies, constraint: "read input file and write output file only" }
```

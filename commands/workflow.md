---
description: "Do/Produce phase -- build and run PDCA pipelines"
argument-hint: run autopilot --topic "AI trends" --background
---

Invoke the `/second-claude-code:workflow` command for workflow automation through the `workflow` skill.

## Context
- Active workflow: !`cat .data/state/workflow-active.json 2>/dev/null || echo "No active workflow"`
- Daemon jobs: !`node daemon/companion-daemon.mjs list-jobs 2>/dev/null || echo '{"jobs":[]}'`

## Arguments
- Subcommand: create|run|schedule|runs|recall|list|show|delete
- For create/run/schedule/show/delete: workflow name
- `run --background` queues the run in the companion daemon substrate instead of executing in the foreground
- `schedule` persists a recurring daemon job for a saved workflow
- `runs` should surface recent background executions
- `recall "query"` should search session recall before rebuilding a workflow from scratch

## Your task
Perform the requested workflow action now using the plugin's loaded `workflow` skill and the provided arguments.

- Return the actual workflow result directly.
- Prefer daemon-backed schedule/background/recall flows when the subcommand asks for them.
- Do not say that you are invoking or have invoked a skill.

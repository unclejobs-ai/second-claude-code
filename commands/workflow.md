---
description: "Do/Produce phase -- build and run PDCA pipelines"
argument-hint: run autopilot --topic "AI trends"
---

Invoke the `/second-claude-code:workflow` command for workflow automation through the `pipeline` skill.

## Context
- Active workflow: !`cat .data/state/workflow-active.json 2>/dev/null || echo "No active workflow"`

## Arguments
- Subcommand: create|run|list|show|delete
- For create/run/show/delete: pipeline name

## Your task
Perform the requested pipeline action now using the plugin's loaded `pipeline` skill and the provided arguments.

- Return the actual pipeline result directly.
- Do not say that you are invoking or have invoked a skill.

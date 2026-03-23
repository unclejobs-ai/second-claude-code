---
description: "Batch parallel execution -- decompose large tasks into independent units and run concurrently"
argument-hint: --topic "10-part newsletter series" --skill write --parallel 3
---

Invoke the `/second-claude-code:batch` command to decompose and execute a large task in parallel through the `batch` skill.

## Context
- Active batch runs: !`ls .data/state/batch-*.json 2>/dev/null | wc -l | xargs echo "Active batch state files:"`
- Recent batch outputs: !`ls .captures/batch-*/ 2>/dev/null | head -5`

## Arguments
- `--topic` (required): The overarching task to decompose
- `--skill write|research|analyze|refine` (default: write): Skill each unit runs
- `--units N` (default: auto, max 10): Override maximum unit count
- `--parallel N` (default: 3): Maximum concurrent unit agents
- `--format` (default: article): Passed to each unit's write skill when --skill write
- `--lang ko|en` (default: ko): Output language for all units
- `--synthesize`: After completion, merge all unit outputs into one combined document

## Your task
Perform the batch decomposition and execution now using the plugin's loaded `batch` skill and the provided arguments.

- Analyze the topic scope, decompose into independent units, and present the decomposition plan for user approval before executing.
- Do not begin execution until the user explicitly approves the decomposition plan.
- Do not say that you are invoking or have invoked a skill.

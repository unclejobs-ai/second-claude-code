---
description: "Plan/Gather phase -- discover skills; install only after explicit approval"
argument-hint: '"security audit" or "diagram generation"'
---

Invoke the `/scc:discover` command to discover candidate skills through the `discover` skill.

## Arguments
- First argument: description of needed capability
- The built-in capability check runs before any external search.

## Your task
Perform the discover flow now using the plugin's loaded `discover` skill and the provided arguments.

- Return ranked results with pinned versions and an install command, then wait for explicit user
  approval before installing anything.
- A recommendation is not approval. If approval is not present, stop after presenting the options.
- Do not say that you are invoking or have invoked a skill.

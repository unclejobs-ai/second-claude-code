---
description: "Open the SCC Artifact Viewer for PDCA session outputs"
argument-hint: --session-dir .data/sessions/current
---

Invoke the `/second-claude-code:viewer` command to open the artifact viewer through the `viewer` skill.

## Context
- Current git status: !`git status --short`
- Current PDCA state: !`cat .data/state/pdca-active.json 2>/dev/null || echo "No active PDCA state"`

## Arguments
- Optional: `--session-dir <dir>` to point at a PDCA session directory
- Optional: `--port <port>` to choose the local viewer port

## Your task
Start the viewer now using the plugin's loaded `viewer` skill and the provided arguments.

- Return the viewer URL directly.
- Do not say that you are invoking or have invoked a skill.

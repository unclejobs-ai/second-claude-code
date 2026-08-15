---
description: "Open the SCC Artifact Viewer, or export a PDCA session as a shareable provenance page"
argument-hint: --session-dir .scc/sessions/{session-id} [--export]
---

Open the artifact viewer. This is a tool, not a skill: it starts a server and writes a file, and there is no judgment in it worth spending a slot in the skill list on.

## Context
- Current git status: !`git status --short`
- Current PDCA state: !`cat .data/state/pdca-active.json 2>/dev/null || echo "No active PDCA state"`

## Arguments
- Optional: `--session-dir <dir>` to point at a PDCA session directory
- Optional: `--port <port>` to choose the local viewer port
- Optional: `--export` to write a single shareable Markdown provenance page instead of starting the server

## Your task
Start the viewer now with the provided arguments.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/viewer-session.mjs" --session-dir "${SESSION_DIR}"
bash "${CLAUDE_PLUGIN_ROOT}/ui/scripts/start-server.sh" \
  --session-dir "${SESSION_DIR}" \
  --dist-dir "${CLAUDE_PLUGIN_ROOT}/ui/dist"
```

Run the first command every time. PDCA writes `.data/state` and `.data/cycles/`, not the layout the
server reads — `viewer-session.mjs` is what projects one into the other. Skipping it serves the
previous run, or a blank page on the first run.

With `--export`, run this instead and return the written file path, then offer to publish it as an Artifact:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/export-artifact.mjs" --out pdca-export.md
```

- Confirm the port responds before handing over a URL. A dead link costs more than the extra second.
- Stop it with `bash ${CLAUDE_PLUGIN_ROOT}/ui/scripts/stop-server.sh --session-dir "${SESSION_DIR}"`. It also auto-stops after 30 minutes idle.
- See `docs/skills/viewer.md` for artifact JSON formats, the session layout, and troubleshooting.

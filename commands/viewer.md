---
description: "Open the SCC Artifact Viewer, or export a PDCA session as a shareable provenance page"
argument-hint: --session-dir .scc/sessions/{session-id} [--export] [--format html] [--out file]
---

Open the artifact viewer. This is a tool, not a skill: it starts a server and writes a file, and there is no judgment in it worth spending a slot in the skill list on.

The live viewer is a local WebSocket server. It is not a Claude Code Artifact. Do not pack that runtime into the export, and do not publish `localhost`. SCC does not own the host loop.

## Context
- Current git status: !`git status --short`
- Current PDCA state: !`cat "${CLAUDE_PLUGIN_DATA:-${CLAUDE_PLUGIN_ROOT}/.data}/state/pdca-active.json" 2>/dev/null || echo "No active PDCA state"`

## Arguments
- Optional: `--session-dir <dir>` to point at a PDCA session directory
- Optional: `--port <port>` to choose the local viewer port
- Optional: `--export` to write a shareable provenance page instead of starting the server
- Optional: `--format md|html` for export. Markdown is the default (mermaid-friendly hosts). `--format html` or `--out *.html` selects HTML
- Optional: `--out <file>` export path. Extension `.html` selects HTML even without `--format`

## Your task
Start the viewer now with the provided arguments.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/viewer-session.mjs" --session-dir "${SESSION_DIR}"
bash "${CLAUDE_PLUGIN_ROOT}/ui/scripts/start-server.sh" \
  --session-dir "${SESSION_DIR}" \
  --dist-dir "${CLAUDE_PLUGIN_ROOT}/ui/dist"
```

Run the first command every time. PDCA writes `${CLAUDE_PLUGIN_DATA:-${CLAUDE_PLUGIN_ROOT}/.data}/state` and
`${CLAUDE_PLUGIN_DATA:-${CLAUDE_PLUGIN_ROOT}/.data}/cycles/`, not the layout the server reads — `viewer-session.mjs` is what projects one into the other. Skipping it serves the
previous run, or a blank page on the first run.

With `--export`, do **not** start the server. Run `scripts/export-artifact.mjs` against the same append-only event log and return the written file path, then offer to publish the Markdown or HTML with the Artifact tool.

Markdown remains the default:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/export-artifact.mjs" --out pdca-export.md
```

HTML (`--format html` or `--out *.html`) writes one Claude-Artifact-safe page from that same log — one self-contained HTML file, inline CSS/JS, images as data URI or SVG, no `fetch`, no WebSocket, no Nivo/Shiki CDN, well under 16MB:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/export-artifact.mjs" --format html --out pdca-export.html
```

The file is a projection of the log: PDCA gates, reviews, and router decisions reconstructed from append-only events. It does not re-derive model context and it is not a second runtime.

- Confirm the port responds before handing over a live-viewer URL. A dead link costs more than the extra second.
- Stop the live viewer with `bash ${CLAUDE_PLUGIN_ROOT}/ui/scripts/stop-server.sh --session-dir "${SESSION_DIR}"`. It also auto-stops after 30 minutes idle.
- See `docs/skills/viewer.md` for the two export formats, artifact JSON, the session layout, and troubleshooting.

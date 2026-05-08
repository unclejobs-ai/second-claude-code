---
name: viewer
description: "Use when the user asks to open the SCC Artifact Viewer, show artifacts, inspect PDCA pipeline outputs, or after a PDCA pipeline run completes."
effort: low
---

## Iron Law

> **Always verify the artifact renders locally before sharing the URL.**

## Red Flags

- "The server should be running, just share the URL" → STOP, because you must confirm `server-info` exists and the port responds before giving the user a URL — dead links erode trust.
- "The artifact JSON looks correct, no need to open the viewer" → STOP, because JSON validity does not guarantee visual correctness — charts, flows, and markdown must be rendered and visually confirmed.
- "I'll share a screenshot of the raw JSON instead" → STOP, because the viewer exists to render artifacts interactively — raw JSON is not a substitute for the rendered view.
- "The session directory isn't set up yet but I'll start the server anyway" → STOP, because the server requires `state.json` and `artifacts/*.json` in the session directory — starting without them produces a blank page.
- "The server has been running for a while, it's probably still up" → STOP, because the server auto-stops after 30 minutes of inactivity — check `server.pid` or re-start before sharing.

# SCC Artifact Viewer

Opens a local web UI to view PDCA pipeline results as interactive artifacts.

## Usage

Start the viewer for the current PDCA session:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/ui/scripts/start-server.sh \
  --session-dir "${SESSION_DIR}" \
  --dist-dir "${CLAUDE_PLUGIN_ROOT}/ui/dist"
```

The script outputs JSON with the URL. Tell the user to open it in their browser.

## How It Works

1. The PDCA pipeline writes `state.json` and `artifacts/*.json` to the session directory
2. The server watches these files and broadcasts changes via WebSocket
3. The browser renders artifacts in real-time: markdown, charts (Nivo), code (Shiki), flow diagrams (SVG)

## Session Directory Structure

```
.scc/sessions/{session-id}/
├── state.json           ← PDCA state (phases, current phase, durations)
├── artifacts/
│   ├── 001-research.json
│   ├── 002-draft.json
│   └── 003-analysis.json
└── state/
    ├── server-info      ← Port, PID
    └── server.pid
```

## Artifact JSON Format

Each artifact file must have: `id`, `type`, `phase`, `title`, plus type-specific fields.

**Markdown**: `{ "type": "markdown", "content": "# Hello" }`
**Chart**: `{ "type": "chart", "chartType": "bar|line|pie|radar", "data": { "labels": [], "datasets": [{ "values": [] }] } }`
**Code**: `{ "type": "code", "language": "typescript", "code": "..." }`
**Flow**: `{ "type": "flow", "nodes": [{ "id", "label", "x", "y" }], "edges": [{ "from", "to" }] }`

## Stopping

```bash
bash ${CLAUDE_PLUGIN_ROOT}/ui/scripts/stop-server.sh --session-dir "${SESSION_DIR}"
```

The server also auto-stops after 30 minutes of inactivity.

## Development

```bash
cd ${CLAUDE_PLUGIN_ROOT}/ui
npm install
npm run dev        # Vite dev server
npm test           # Run tests
npm run build      # Build dist/ for production
```

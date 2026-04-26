---
name: viewer
description: "Use when the user asks to open the SCC Artifact Viewer, show artifacts, inspect PDCA pipeline outputs, or after a PDCA pipeline run completes."
effort: low
---

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

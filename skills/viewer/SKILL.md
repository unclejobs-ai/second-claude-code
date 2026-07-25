---
name: viewer
description: "Use when the user asks to open the SCC Artifact Viewer, show artifacts, inspect PDCA pipeline outputs, export a session as a shareable page, or after a PDCA pipeline run completes."
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

## Export Mode — Shareable Provenance Page

The live viewer is local and dies after 30 minutes. To hand someone the result, export instead:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/export-artifact.mjs" --out pdca-export.md
```

This writes one Markdown file and prints `{"out","artifacts","cycles","source"}`. Publish it with
the Artifact tool to get a shareable URL.

It reads what the pipeline actually writes — `.data/state/pdca-last-completed.json`, the
`.data/events/pdca-{run_id}.jsonl` event log, and the `.data/cycles/` markdown — so it works on real
runs today. Pass `--data-dir` for a different root or `--run <run_id>` to pick an older run. The
`--session-dir` form still reads the live viewer's `state.json` + `artifacts/*.json` layout.

Two things worth knowing about where the numbers come from:

- The phase timeline and its durations are reconstructed from the **event log**, not from
  `state.action_router_history` — that field is initialized to `[]` and never appended to, so
  anything reading it reports zero re-entries forever.
- A phase logged under a later cycle is what counts as a re-entry. If the pipeline later starts
  writing router history, the export uses it too, but it never depends on it.

What the export leads with is the **audit trail**, not the content: which gates passed, how many
reviewers attacked the draft and what they caught, every Act re-entry with its reason, and any drift
between planned and delivered scope. The produced artifacts follow underneath. A finished document
cannot show that it survived five adversarial reviewers and two re-entries — this is what makes the
PDCA record worth sharing.

Charts and flows become mermaid, so there is no bundle and no external asset to break.

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

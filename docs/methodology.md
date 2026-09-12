**English** | [한국어](methodology.ko.md)

# Methodology

## 1. Trajectory

DSH (DeepSeek Harness) owns the host loop. Its session is an append-only event log; the Web **轨迹** (Trajectory) tab re-derives model context from that log — user, assistant, tool, nested subtool, compaction, turn boundaries, tokens, TTFT. That is a harness feature. SCC cannot do it.

SCC is a Claude Code plugin. Claude Code owns the host loop. SCC must not embed a second runtime, must not reconstruct the model's conversation, and must not copy DSH's 轨迹 tabs.

Steal only this: PDCA gates, Check reviews, and Action Router decisions reconstruct from append-only events. Viewer HTML and Markdown are a **projection** of that log, not a second source of truth.

SCC trajectory = reconstruct **one** PDCA or workflow run from `.data/events` and `.data/cycles`. PDCA is the writer of that log. A saved `/scc:workflow` is in scope only when that run left events and cycle snapshots — not as a second session transcript.

| Source | Reconstructs |
|--------|----------------|
| `.data/events/pdca-{run_id}.jsonl` | `cycle_start` / `cycle_end`, `phase_start` / `phase_end`, `gate_check` / `gate_pass` / `gate_fail`, `review_started` / `review_completed`, `artifact_created`, `stuck_detected`, `error` |
| `.data/cycles/cycle-NNN/{phase}.md` | Phase artifacts, `metrics.json`, per-cycle `events.jsonl` |
| `state.action_router_history` | Why Act sent work back. Runs recorded before that field existed infer re-entry from a later cycle number and carry no reason |

`scripts/viewer-session.mjs` (live UI) and `scripts/export-artifact.mjs` (shareable page) project the log. They do not become the log.

## 2. Artifact HTML

Shareable output is one file. A Claude Code Artifact HTML page must be self-contained: inline CSS and JS, images as data URI or SVG, no `fetch`, no WebSocket, no Nivo or Shiki CDN, size well under 16MB. Follow [ClawEnable/html-artifact-best-practices](https://github.com/ClawEnable/html-artifact-best-practices) (vanilla HTML, no framework, no build chain). Markdown export stays the default for mermaid-friendly hosts (GitHub, Notion, the Artifact markdown renderer).

```bash
# default — mermaid fences, no bundle
node "${CLAUDE_PLUGIN_ROOT}/scripts/export-artifact.mjs" --out pdca-export.md
/scc:viewer --export

# Claude Code Artifact HTML
node "${CLAUDE_PLUGIN_ROOT}/scripts/export-artifact.mjs" --format html --out pdca-export.html
```

The Vite viewer (`ui/`: React, Nivo, Shiki; `ui/scripts/server.cjs`; WebSocket; port 3847; 30-minute idle stop) is a **local live projection**. It is not the shareable artifact:

- It needs a running server and `ui/dist`. The `localhost` URL dies when the process stops.
- Charts and highlighting load Nivo and Shiki, not inline SVG or CSS.
- It reads `{session}/state.json` + `artifacts/*.json`, which PDCA never writes. `viewer-session.mjs` must project `.data` first; skip it and the page is blank.
- A Vite/React bundle cannot publish as a Claude Code Artifact (CSP, network, size).

Export from the event log. Do not zip `ui/dist` and call it an artifact.

## 3. Companion plugins

Optional. They do not ship with SCC and must not replace `/scc:coach`. The decision owner is `.scc/standards/<id>/STANDARD.md`. Do not add these as SCC dependencies.

| Plugin | vs `/scc:coach` | Use for | Install | Do not install when |
|--------|-----------------|---------|---------|---------------------|
| [design-crit](https://github.com/metedata/design-crit) | HTML wireframes, Keep/Cut per facet; writes `.design-crit/` | Visual/structural direction before code | `claude plugin marketplace add metedata/design-crit` then `claude plugin install design-crit@metedata-design-tools` | You would treat `.design-crit/decisions.md` or `state.json` as the project ledger |
| [design-with-ai](https://github.com/amanmaqsood/design-with-ai) | Direction and critique before implementation (`/design-with-ai:design-with-ai`); optional aesthetic build | Interface direction, then code | `claude plugin marketplace add amanmaqsood/design-with-ai && claude plugin install design-with-ai@amanmaqsood-design` | It would settle forks that belong in `.scc/standards` |
| [knowledge-work design](https://github.com/anthropics/knowledge-work-plugins) | Critique, a11y, UX copy, handoff (`/critique`, `/accessibility`, …) | Design review of screens and systems | `claude plugins add knowledge-work-plugins/design` | It becomes a second standards store |
| [architect](https://github.com/alexei-led/architect) | Read-only coupling review (Balanced Coupling). Does not edit production code during review | Architecture evidence, boundaries, fitness checks | `claude plugin marketplace add alexei-led/architect` then `claude plugin install architecture@alexei-led-architect` | You need it to record product decisions (it must not) |

**When not to install:** duplicate decision ledgers. Coach records each settled fork as a standard. design-crit keeps `state.json` plus `decisions.md`. Two ledgers disagree after the next session. Architect is read-only — keep it that way. If a companion's files would become "what we decided," skip the install and stay on `/scc:coach`.

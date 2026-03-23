# Second Codex Companion Daemon Design

## Goal

Add a long-running companion process without changing the core plugin identity.

- The plugin remains the user-facing orchestrator.
- The daemon owns long-lived execution concerns that do not fit cleanly in hooks alone.

## Responsibilities

The companion daemon is the product substrate for:

- **scheduler**: recurring and one-shot task execution
- **background runs**: isolated long-running workflow execution outside the foreground chat
- **notification routing**: fan-out of completion and failure notifications to configured channels
- **session recall index**: searchable historical index for past runs, handoffs, and workflow outputs

## Non-Goals

- Full multi-channel gateway parity with Hermes Agent in the first iteration
- Replacing PDCA orchestration inside the plugin
- Owning user identity synthesis already handled by `soul`
- Replacing MMBridge as the external memory/research layer

## Runtime Boundary

### Plugin owns

- PDCA orchestration
- skill invocation UX
- skill authoring rules
- synchronous session hooks
- user-facing approvals

### Daemon owns

- scheduled execution loop
- background job lifecycle
- durable notification delivery attempts
- recall indexing jobs
- future channel adapters

## Local State Contract

The daemon writes inside `${CLAUDE_PLUGIN_DATA}/daemon/`:

- `jobs.json` — scheduled and background job definitions
- `runs/{run_id}.json` — run metadata and lifecycle state
- `notifications/{id}.json` — notification attempts and results
- `recall/index.jsonl` — append-only session recall index

The plugin may read daemon state for summaries, but should not mutate daemon-owned files directly.

## Integration Points

- Workflows become the canonical payload for scheduled or background execution.
- Project Memory provides always-on repo facts for daemon-started runs.
- Session recall reads from daemon artifacts plus PDCA/workflow state.
- Notification hooks can degrade gracefully when the daemon is absent.

## Failure Model

- Daemon absent: plugin still works, background and scheduling features are disabled.
- Daemon crash: unfinished runs remain in `runs/` and can be resumed or marked failed.
- Notification failure: log and retry; never block the core plugin pipeline.
- Recall indexing failure: keep primary artifacts; re-index later.

## Next Implementation Step

Start with a local-only daemon that supports scheduler, background runs, notification routing, and session recall index generation. Add channel adapters only after the local contract is stable.

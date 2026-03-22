# Channels Integration — PDCA Notification Reference

Second-claude-code emits structured notification data at key PDCA events.
The actual channel transport (Telegram send, Slack post, etc.) is handled by
existing MCP plugins — this layer only prepares and formats the payload.

## Notification Events

### 1. Phase Transition

Fires when PDCA transitions between phases (Plan→Do, Do→Check, Check→Act, Act→Exit).

```
[PDCA] Topic: {topic}
Phase: {from_phase} → {to_phase}
Status: in progress
Action needed: no
```

Attach the gate verdict reason when the transition was gated (e.g. gate passed with
sources_count=4).

### 2. Review Verdict

Fires when the Check phase completes and a verdict is available.

```
[PDCA] Topic: {topic}
Phase: Check → {next_phase}
Status: {APPROVED|MINOR FIXES|NEEDS IMPROVEMENT|MUST FIX} (score: {average_score})
Action needed: {yes if not APPROVED, no if APPROVED}
```

### 3. Approval Request

Fires when Plan Mode briefing is presented to the user and waiting for approval.

```
[PDCA] Topic: {topic}
Phase: Plan (awaiting approval)
Status: Plan Mode briefing ready
Action needed: yes — review and approve/reject the plan
```

Send this notification before entering ExitPlanMode so the user can check their
device and respond.

### 4. Cycle Complete

Fires when the PDCA cycle exits (APPROVED verdict or max_cycles reached).

```
[PDCA] Topic: {topic}
Phase: complete
Status: {APPROVED|max_cycles reached}
Action needed: no
Artifact: {artifact_path}
```

## Configuration

Channels are opt-in via `.data/channels.json` (copy from `.data/channels.json.example`).

| Field | Type | Purpose |
|-------|------|---------|
| `telegram.enabled` | boolean | Enable Telegram notifications |
| `telegram.chat_id` | string | Telegram chat/channel ID |
| `notify_on` | string[] | Event filter — omit to receive all events |

Supported `notify_on` values: `phase_transition`, `review_verdict`, `cycle_complete`,
`approval_needed`.

The session-end hook also reads `TELEGRAM_CHAT_ID` from env as a fallback when
`.data/channels.json` is absent.

## How the Hook Emits Notifications

`hooks/session-end.mjs` checks for channel config after HANDOFF.md is written.
If a channel is configured and PDCA state is present, it appends a `notification`
field to its stdout JSON so Claude Code's Notification hook pattern can relay it:

```json
{
  "notification": {
    "channel": "telegram",
    "chat_id": "...",
    "text": "[PDCA] Topic: ...\nPhase: ...\nStatus: ...\nAction needed: ..."
  }
}
```

Claude Code routes `notification` objects to the configured MCP plugin (Telegram,
Slack, etc.) — the hook itself never calls the transport directly.

## Usage in PDCA Orchestrator

When Channels are configured, the PDCA orchestrator calls the notification helper
at the following points (see SKILL.md "Notifications" subsection):

1. After Plan Mode briefing is ready → `approval_needed` event
2. At each gate passage → `phase_transition` event
3. After Check verdict is read → `review_verdict` event
4. When PDCA exits → `cycle_complete` event

To add channel support to a new phase, emit the relevant event type with the
fields above. Do not call Telegram MCP directly from skill logic — use the
notification payload pattern so the hook handles transport.

## Security Notes

- `chat_id` from `.data/channels.json` is treated as data, not code.
- The hook sanitizes all fields before embedding in the notification text.
- Never include artifact content in notification text — only paths and metadata.
- `channels.json` should be in `.gitignore` (contains chat IDs).

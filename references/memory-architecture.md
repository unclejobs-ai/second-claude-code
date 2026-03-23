# Memory Architecture

Second Codex now treats persistent memory as four separate layers with distinct jobs.

## Layers

### Project Memory

- File: `${CLAUDE_PLUGIN_DATA}/memory/PROJECT_MEMORY.md`
- Structured index: `${CLAUDE_PLUGIN_DATA}/memory/project-memory.json`
- Purpose: stable repo facts, conventions, architecture decisions, runtime constraints
- Examples: "JavaScript ESM only", "companion daemon is optional", "Telegram is notification-first today"

### Soul Identity

- File: `${CLAUDE_PLUGIN_DATA}/soul/SOUL.md`
- Purpose: user voice, preferences, anti-patterns, identity synthesis
- Examples: tone rules, directness preferences, known style corrections

### Session Recall

- Backing store: PDCA events, workflow state, handoff artifacts, future recall index
- Purpose: retrieve "what happened before" without polluting always-on memory
- Examples: prior PDCA cycle outcome, previous workflow run, historical decisions needing re-check

### MMBridge Memory

- Access path: `mmbridge memory search`
- Purpose: cross-session supplemental context from MMBridge's external memory layer
- Rule: use as advisory recall, not as the canonical source of truth for plugin state

## Rules

- Project Memory is for durable repo and product facts.
- Soul Identity is for user-specific behavior and voice.
- Session Recall is for historical retrieval, not prompt-resident facts.
- MMBridge Memory is an external augmentation layer and should never override local files automatically.

## Operational Guidance

- Prefer Project Memory when a fact should be visible at session start.
- Prefer Session Recall when the agent needs to look up a prior conversation or run artifact.
- Prefer Soul for user-specific preferences that affect tone or workflow.
- Prefer MMBridge Memory only when local state is insufficient or external prior context may exist.

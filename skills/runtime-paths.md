# Runtime paths

Resolve these placeholders before any script or state operation:

- `<plugin-root>`: use `CLAUDE_PLUGIN_ROOT` when the host provides it. Otherwise, use the plugin root associated with the current skill location—the directory two levels above that skill's `SKILL.md`.
- `<plugin-data>`: use `CLAUDE_PLUGIN_DATA` when the host provides it. Otherwise, use `<plugin-root>/.data`.

Substitute resolved absolute paths into commands. Never pass `<plugin-root>`, `<plugin-data>`, or an unset host variable literally to a shell command.

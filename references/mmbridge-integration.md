# MMBridge Integration — Common Rules

All skills that use mmbridge MUST follow these rules. This is the single source of truth
for detection, invocation, error handling, and result merging.

## Detection

1. Run `which mmbridge` via Bash **once** at skill start.
2. If found → mmbridge is available for this skill invocation. Proceed with mmbridge-enhanced flow.
3. If not found → silently skip all mmbridge calls. Use internal agents only. No warning, no error.

Detection is per-skill-invocation. Do not cache across skill boundaries.

## RUN_ID Generation

- If inside a PDCA cycle: use the PDCA `run_id` from `pdca-active.json`
- If standalone (no active PDCA run): generate via `date +%s` (Unix timestamp)

## Invocation Pattern

All mmbridge commands use this base pattern:

```bash
mmbridge <command> [command-specific-options] --stream --export /tmp/mmbridge-<command>-${RUN_ID}.md
```

- `--stream`: Real-time output to terminal for user visibility
- `--export`: Write results to a file for programmatic parsing
- `${RUN_ID}`: See RUN_ID Generation above

### `--tool` Flag

- `mmbridge review`: Use `--tool kimi` (most reliable). Avoid `--tool all` (known race condition).
- `mmbridge research`, `mmbridge security`, `mmbridge gate`: Handle model selection internally. No `--tool` needed.

### Timeout Per Command

| Command | Timeout |
|---------|---------|
| `research` | 300s |
| `security` | 180s |
| `review` | 120s |
| `gate` | 60s |

Kill the process and proceed on timeout.

## Parallel Execution

mmbridge calls are ALWAYS dispatched in **parallel** with internal agents:
- Use separate Bash tool calls (not sequential `&&`)
- Internal agents and mmbridge run simultaneously
- Results are merged at the skill's designated merge point

## Error Handling

- **Exit non-zero**: Log the error message. Proceed without mmbridge result. Do not retry.
- **Timeout**: Kill process and proceed (see per-command timeouts above).
- **Export file missing**: If the export path does not exist after mmbridge completes, treat as failure.
- **Parse error**: If the export file exists but cannot be parsed, log and skip mmbridge findings.

**Iron rule**: mmbridge failure NEVER blocks the pipeline. Internal agents alone produce a complete result.

## Result Merging

mmbridge results are merged as "external source" at each skill's merge point:
- **Research**: mmbridge findings → analyst input (supplemental sources). Count each distinct cited URL as 1 source.
- **Review**: mmbridge findings → consensus gate (additional voter)
- **Security**: mmbridge findings → consensus gate (additional voter with CWE mapping)
- **Gate**: mmbridge gate → advisory signal (logged, not blocking)

## Severity Mapping

For review and security commands, map mmbridge severity labels to internal 3-tier scheme:

| MMBridge Label | Internal Severity |
|---------------|-------------------|
| `CRITICAL` | Critical |
| `HIGH` | Major |
| `WARNING` | Major |
| `MEDIUM` | Minor |
| `INFO` | Minor |
| `LOW` | Minor |
| `REFACTOR` | Minor |

## Cleanup

Delete the export file (`/tmp/mmbridge-*`) after successful parsing, or at end of skill invocation regardless of outcome.

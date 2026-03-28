# mmbridge-quality

Use this skill when Hermes should run structured quality commands through
`mmbridge` after implementation work or before a delivery decision.

## Purpose

- run review, security, and gate checks
- capture machine-readable outputs where possible
- keep failures non-blocking unless the operator explicitly promotes them to a gate

## Requirements

- `mmbridge` installed and available on `PATH`
- terminal/process tool access
- repo root available to Hermes

## Rules

- `mmbridge` is a quality signal, not an autonomous merge authority
- if `mmbridge` fails, preserve the local result and continue with a fallback summary
- prefer JSON or exported artifacts over terminal-only output

## Standard Commands

Review:

```bash
mmbridge review --tool kimi --mode review --stream --export /tmp/mmbridge-review-$(date +%s).md
```

Security:

```bash
mmbridge security --json > /tmp/mmbridge-security-$(date +%s).json
```

Gate:

```bash
mmbridge gate --format json > /tmp/mmbridge-gate-$(date +%s).json
```

Handoff:

```bash
mmbridge handoff --write /tmp/mmbridge-handoff-$(date +%s).md
```

## Reading Priority

1. `gate` result for structured pass/warn signal
2. `review` findings for concrete issues
3. `security` output for severity-ranked risks
4. `handoff` only when preparing a resumable session or operator transfer

## Recommended Hermes Behavior

- after `acpx` orchestration, run `mmbridge review` or `mmbridge gate`
- if findings are significant, ask for a narrow corrective pass instead of re-running everything
- store the temp artifact content in Hermes memory or notes only after summarizing it

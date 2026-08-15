---
description: "Run the project's active standards against one artifact and report every violation"
argument-hint: <target path> [--standard <id>] [--json]
---

Check one artifact against the standards recorded under `.scc/standards/`. This is a tool, not a
skill: it interprets checks and reports, and it makes no judgment worth a slot in the skill list.

## Context
- Active standards: !`ls .scc/standards 2>/dev/null || echo "none recorded"`

## Arguments
- Required: the path to the artifact being checked
- Optional: `--standard <id>` to run one standard instead of all active ones
- Optional: `--json` for the full report

## Your task

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/standard-check.mjs" <target path> [--standard <id>] [--json]
```

Exit code 1 means at least one check failed. Report the failures as they came back — do not
summarize them into a verdict of your own, and do not decide which one matters more.

Three results are not violations and do not set exit 1. Say what each one means rather than letting
it read as a pass:

- `UNCHECKED` — the standard has no checks. Nothing verified it. It is visible, not satisfied.
- `UNPROVEN` — an adversarial check with no reviewer answer on file for these exact bytes. Offer to
  route the question to an independent reviewer, then record the answer with
  `coach-runner.mjs record-verdict --file <verdict.json>` against the `target_sha256` printed above.
- Two standards failing in opposite directions — a genuine conflict. Report both and say it needs
  retiring one, not a judgment call from you.

You did not write these standards and you do not get to grade your own compliance with them. If the
artifact under check is one you produced this session, say so when you report the result.

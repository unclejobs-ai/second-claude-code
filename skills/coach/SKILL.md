---
name: coach
description: "Use when planning a fork: more than one defensible direction and no active standard covers it. Settle the plan before work starts. Do not use merely because a request is vague or underspecified; vagueness takes a clarifying question, not a standard."
effort: high
user-invocable: false
---

# Coach

[Resolve runtime paths](../runtime-paths.md) before file or script operations.

Before anything else, confirm a standard can be written here:

```bash
node "<plugin-root>/scripts/coach-runner.mjs" status --json
```

Exit 1 with the plugin-install-path error means the resolved project root sits inside the plugin install, and no standard can be recorded in this location. Say that plainly and stop. Do not draft around it, and do not put the record somewhere else.

When the check passes: a fork with more than one defensible direction produces a standard before it produces an artifact.

## What counts as a fork

The test is not "am I unsure?". You can be entirely confident and still be one of several confident answers. Nor is it "is this vague?" — a request that is merely underspecified takes a clarifying question and nothing more. The test is:

> Could another competent agent, reading the same evidence, reach a different defensible answer?

If yes, this is a fork, and it gets settled on the record before anything is drafted.

## The output, in order

1. **Read the standards already on file** — `.scc/standards/*/STANDARD.md`. If one covers this fork, name it, follow it, and go to step 6. A settled question is not a fork. If its `review_when` has come true, say so and reopen it as a fork; the old record gets retired rather than edited, and the new one records what changed.
2. **Name the fork.** One line: what is being chosen between, in the user's own terms.
3. **Put every defensible direction on the table**, each with the evidence that makes it defensible. Include the one you would have picked alone. Include "do not do the thing that was asked" whenever the evidence supports it — a rejected premise is a direction to offer, not a call to make alone.
4. **The user picks.** One question, the directions as its options.
5. **Record the choice** before drafting: `node "<plugin-root>/scripts/coach-runner.mjs" record-fork --file <fork.json>` writes `.scc/standards/<id>/STANDARD.md` — the chosen direction, the rejected ones and why they lost, and `review_when`, the condition that would reopen it.
6. **Then produce the artifact**, from the standard — and run `scripts/standard-check.mjs` against it. A standard whose checks were never run against the work it governs did not govern anything.

## Runtime

`scripts/coach-runner.mjs` is the authority for its own command syntax. It ships no usage output, so take syntax from the runner itself rather than from a list here, which drifts the moment the runner changes.

Two things the runner cannot tell you: its state and its standards live under the project's `.scc/`, never under the plugin install; and `finalize` stops at an approval gate — `confirm`, `continue`, `plan-mode` — rather than running the work. That call stays the user's.

See `docs/skills/coach.md` for scoring, state, artifacts, and troubleshooting.

Internal auto-mode fragments live under `skills/coach/references/fragments/` with `kind: skill-fragment`. They are not public skills, commands, or `skill://` routes.

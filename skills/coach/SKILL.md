---
name: coach
description: "Use when a request has more than one defensible direction and no active standard covers it — a fork that has to be settled before work starts"
effort: high
---

# Coach

A fork with more than one defensible direction produces a standard before it produces an artifact.

## What counts as a fork

The test is not "am I unsure?". You can be entirely confident and still be one of several confident answers. The test is:

> Could another competent agent, reading the same evidence, reach a different defensible answer?

If yes, this is a fork, and it gets settled on the record before anything is drafted.

## The output, in order

1. **Read the standards already on file** — `.scc/standards/*/STANDARD.md`. If one covers this fork, name it, follow it, and go to step 6. A settled question is not a fork.
2. **Name the fork.** One line: what is being chosen between, in the user's own terms.
3. **Put every defensible direction on the table**, each with the evidence that makes it defensible. Include the one you would have picked alone. Include "do not do the thing that was asked" whenever the evidence supports it — a rejected premise is a direction to offer, not a call to make alone.
4. **The user picks.** One question, the directions as its options.
5. **Record the choice** before drafting: `node scripts/coach-runner.mjs record-fork --file <fork.json>` writes `.scc/standards/<id>/STANDARD.md` — the chosen direction, the rejected ones and why they lost, and `review_when`, the condition that would reopen it.
6. **Then produce the artifact**, from the standard.

## Runtime

`node scripts/coach-runner.mjs` — `start`, `answer`, `status`, `resume`, `record-fork`, `finalize`, `clear`. The runner owns state under the project's `.scc/`, Round 0 topology confirmation, ambiguity scoring, and standard rendering.

`finalize` returns the recorded standard ids plus three approval options — `confirm`, `continue`, `plan-mode`. Coach stops at that gate; running the work is the user's call.

See `docs/skills/coach.md` for scoring, state, artifacts, and troubleshooting.

Internal auto-mode fragments live under `skills/coach/references/fragments/` with `kind: skill-fragment`. They are not public skills, commands, or `skill://` routes.

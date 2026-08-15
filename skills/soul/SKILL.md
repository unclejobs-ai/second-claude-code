---
name: soul
description: "Use when observing user patterns and synthesizing a persistent identity profile"
effort: high
---

## Iron Law

> **Observation is not judgment. Record patterns only.**

## Red Flags

- "They seem like a detail-oriented person" → STOP, because generic descriptions that could apply to any knowledge worker are rejected — every dimension needs 2+ evidence citations from actual observations.
- "They were direct last time and verbose this time, so they're inconsistent" → STOP, because contradictions become conditional rules ("direct in chat, verbose in reports"), not averages — context determines the pattern.
- "I noticed they mentioned their health situation" → STOP, because medical data, financial details, relationship status, and political/religious beliefs must never be recorded — log "sensitive signal omitted" without content.
- "5 observations should be enough to synthesize a profile" → STOP, because the minimum threshold is 10 sessions OR 30 observations — premature synthesis produces unreliable profiles.
- "The soul profile shifted significantly but the new version is clearly better" → STOP, because >30% drift in any dimension requires explicit user acknowledgment with "SIGNIFICANT DRIFT DETECTED" — never auto-apply large shifts.

# Soul

Build and maintain a persistent user identity profile from behavioral signals observed across sessions. Every claim in SOUL.md must be evidence-backed. Contradictions become conditional rules, not averages.

## When to Use

- User wants a persistent identity profile synthesized from session history
- User wants to understand their own patterns and behavioral tendencies
- Another skill needs user context that goes beyond project preferences
- User wants to track how their communication style or decision patterns shift over time

## Subcommands

The observation store is written by the SessionStart/SubagentStart/Stop hooks and read through the
`soul_*` MCP tools. **Never append to it by hand.** Two writers with two layouts is how this skill
previously produced observations nothing ever synthesized.

| Subcommand | Description | Backed by |
|------------|-------------|-----------|
| `init` | Create a SOUL.md stub from a template | file write (the observation store starts itself) |
| `learn` | Record an observation the hooks would not have caught | `soul_record_observation` |
| `show` | Display current SOUL.md with evidence citations | `soul_get_profile`, `soul_get_observations` |
| `propose` | Run full synthesis and output a proposed SOUL.md — does not write | `soul_get_readiness`, `soul_get_synthesis_context` |
| `apply` | Write the proposed SOUL.md after user review | file write |
| `diff` | Compare current SOUL.md against a proposed version | file read |
| `reset` | Archive current SOUL.md | file move |
| `retro` | Shipping metrics from git history across projects | `soul_retro` |

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--mode` | `manual\|learning\|hybrid` | `hybrid` | manual = only user-triggered; learning = auto-observe every session; hybrid = auto-observe + user-triggered synthesis |
| `--template` | `default\|developer\|writer\|researcher` | `default` | Starter template for `init` |
| `--period` | `week\|month\|quarter` | `week` | Time range for `retro` metrics |
| `--projects` | comma-separated paths | auto-detect | Project directories for `retro` git scanning |

### Mode Behavior

The mode lives in `soul-active.json` and the hooks read it — `learning` and `hybrid` are what turn
automatic observation on.

- **manual**: nothing is recorded unless the user calls `soul learn`.
- **learning**: the hooks observe every session. Synthesis still requires `soul propose`.
- **hybrid**: learning, plus a synthesis prompt once `proposal_due` is set.

## Workflow

### `init`

1. If `SOUL.md` already exists, warn and require `--force`.
2. Load `references/templates/{template}.md` and write it as the SOUL.md stub.

The observation log needs no bootstrap. The hooks create it on first signal.

### `learn`

For a signal the hooks did not catch. Call `soul_record_observation` with `signal`, `category`
(`correction` | `emotional` | `style`), optional `confidence`, and `raw_context` trimmed to 200
characters. Report the count it returns.

### `show`

1. `soul_get_profile` → the profile and its metadata. A null profile means synthesis has not run.
2. `soul_get_observations` for the citations behind each dimension.
3. Render the profile with its evidence inline, then the pool stats.

### `propose`

1. `soul_get_readiness`. Below threshold (10 sessions or 30 observations), print the shortfall and stop.
2. `soul_get_synthesis_context` — recency-weighted observations, shipping entries, the current
   profile, and a drift pre-check, already assembled. Do not re-read the files it summarizes.
3. Dispatch **soul-keeper** (Pikachu, opus) with that context. It applies
   `references/synthesis-algorithm.md`.
4. Output the proposed SOUL.md with citations. Surface any dimension the drift pre-check flags above
   30% with the words `SIGNIFICANT DRIFT DETECTED`.
5. Write nothing. `propose` ends in review.

### `apply`

1. Require that `propose` ran in this session.
2. Ask: "Apply this soul update? This overwrites SOUL.md. [yes/no]"
3. On yes, write the proposed profile. On no, discard it and leave the profile untouched.

### `diff`

Read the current profile via `soul_get_profile`, compare dimension by dimension against the proposed
one, and flag semantic shifts above 30% per `references/synthesis-algorithm.md`.

### `retro`

Call `soul_retro` with `period` and optional `projects`. It scans the git history, computes the
metrics in `references/retro-metrics.md`, detects the trend against previous retros, and appends the
`shipping` observation itself. Render its report; do not recompute what it returns and do not write
the observation a second time.

### `reset`

1. Require explicit confirmation.
2. Archive the current SOUL.md under `archive/SOUL-{timestamp}.md`.
3. Leave the observation log alone unless the user asks for it. The pool is the evidence; discarding
   it silently destroys every citation the next profile would rest on.

## Storage

Under `CLAUDE_PLUGIN_DATA` when set, otherwise `<plugin>/.data`. The hooks, the MCP handlers, and
this skill must all use the same layout — they did not, and that is what made half the pipeline
invisible to the other half.

| Path | Written by | Description |
|------|-----------|-------------|
| `soul/SOUL.md` | this skill (`apply`) | The synthesized profile |
| `soul/observations/YYYY-MM-DD.jsonl` | hooks, `soul_record_observation` | Daily append-only signal log |
| `soul/soul-active.json` | hooks | Session and observation counters, `proposal_due` flag |
| `soul/archive/` | this skill (`reset`) | Archived profiles |

Set `CLAUDE_PLUGIN_DATA` to keep this outside the plugin directory. Without it the store sits in the
plugin install and does not survive a reinstall.

## Subagents

```yaml
soul-keeper: { model: opus, agent: pikachu, constraint: "every dimension needs 2+ evidence citations, contradictions become conditional rules, generic descriptions are rejected" }
analyst: { model: sonnet, agent: alakazam, constraint: "extract signals matching observation catalog, return structured JSON, no inferences beyond what the signal supports" }
```

## Gotchas

### Generic Soul Trap
The most common failure: producing dimensions that could describe any knowledge worker. soul-keeper must run the anti-generic filter on every dimension before output. If a dimension reads like a LinkedIn bio, it is rejected.

### Token Budget
Observation logs can grow large. When calling soul-keeper, summarize observations older than 30 days to a single paragraph per session. Only the last 5 sessions are passed verbatim. Total input to soul-keeper must not exceed 500 tokens of observation data per session in the summary window.

### Contradiction Handling
A user who is "direct in chat but verbose in reports" is NOT contradictory — those are conditional behaviors. Do not force a single characterization. The conditional rule format preserves predictive power; averaging destroys it.

### Privacy
SOUL.md must never contain medical data, financial details, relationship status, or political/religious beliefs unless the user explicitly provides them as work-relevant context. If a sensitive signal is observed, note "sensitive signal omitted" in the observation log without recording the content.

### Drift Approval
A >30% shift in any dimension is not automatically applied. It requires explicit user acknowledgment. Surface it visibly in `propose` output with the phrase "SIGNIFICANT DRIFT DETECTED" before applying.

## Output

- SOUL.md at `.data/soul/SOUL.md`
- Template reference at `references/templates/`
- Observation signals reference at `references/observation-signals.md`
- Synthesis algorithm at `references/synthesis-algorithm.md`
- Retro metrics specification at `references/retro-metrics.md`

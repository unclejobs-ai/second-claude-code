# evolve — Spec (implementation-ready)

> Status: **design proposal, pre-implementation.** Produced 2026-06-12 from a 3-source analysis (steipete/agent-scripts maintainer-orchestrator + github-project-triage, mattpocock/skills diagnose/triage) and an 11-agent grounded-design workflow with adversarial safety review. Awaiting maintainer decisions (§10) before build.

## Headline finding

The naive ouroboros idea — "real failures become benchmark cases, the loop optimizes against them" — is **unbuildable as stated** on the current engine, and the adversarial review **blocked** it. Verified root cause: the loop scorer (`scoreChecks`, `loop-runner.mjs:644-647`) only does `readFileSync` + `pattern.test` on the **static prompt-asset file** — it never executes a prompt. Read-surface and mutation-surface are the same file, so:

- score the mutated asset → **Goodhart**: the optimizer maximizes any regex by inserting the asserted string;
- score a frozen runtime artifact → **inert**: the mutation can't change it → constant score → nothing promotes.

**Honest reframe (v1):** evolve evolves a prompt asset toward a **maintainer-authored structural-conformance check**, not runtime behavior. The maintainer's merge review of `winner.diff` is the behavioral backstop. This dissolves Goodhart rather than renaming it: once the score is not claimed as a behavior proxy, "the optimizer inserts the asserted structure" = "the asset now contains the structure the maintainer required" = compliance.

The two concerns the original conflated, now separated:
- **Provenance** — a real logged failure tells evolve *which asset is weak*. Harvested mechanically. Kept.
- **Authorship** — the *maintainer* defines *what structural check* the asset must satisfy. Never derived from the finding, never authored by the optimized model class.

---

## 1. Name & Iron Law

**`evolve`** — the ouroboros maintainer loop: harvests *real* logged failures to **select which prompt asset is structurally weak**, the maintainer **hand-authors a structural-conformance check**, evolve hands it to the existing `loop` engine to evolve the asset on an isolated branch, and stops at a maintainer merge. A **target-selection + check-authoring layer on top of `loop`** — never runs its own optimizer, never relaxes a loop gate.

> **Iron Law: Every evolve check is hand-authored or hand-ratified by the maintainer — never by the optimized model class — and it scores structural conformance of the prompt asset, not runtime behavior. The maintainer's merge review of `winner.diff` is the final behavioral gate.**

## 2. Where it sits — the ring + triggers

```
   PDCA run ──Check gate──▶ FAILURE (gate_fail / Act-STOP / investigate / soul-regression)
        │            [NEW capture] structured record → .data/evolve/failures.jsonl (provenance only)
        │            evolve harvest (trigger test below)
        │            candidate: weak asset + MAINTAINER-AUTHORED check
        │            VALIDATION GATE (provenance + fidelity + authorship + min_delta floor + maintainer-confirm)
        │            write benchmarks/loop/evolve-<asset>.json (min_delta pinned ≥ 0.02)
        │            node scripts/loop-runner.mjs run evolve-<asset>  (REUSE, unmodified)
        │            isolated codex/loop-<runId> branch + winner.diff
        │            [NEW holdout check, advisory] + MAINTAINER MERGE REVIEW (behavioral backstop)
        └──── better prompt asset feeds the next PDCA run ◀────
```

**The ring is OPEN today and cannot close on existing data.** Insight records carry no asset path, no expected/actual, no verifiable flag (`cycle-memory.mjs:181-188`); `bundledSuiteScore` is hardcoded to `write-core`/`review-core` only (`loop-runner.mjs:650-706`); gate_fail/Act-STOP/investigate never persist a structured, asset-attributed record. evolve's job is to **build the bridge pieces** (§3). No source contains a verbatim expected-output — `gate_fail.data.missing[]` is a list of gate-rule *names* (`pdca-handlers.mjs:156-178`), insights are free text, investigate is LLM prose. So harvest establishes *which asset is weak*; the check is authored downstream by the maintainer.

**Trigger — a failure is evolve-eligible only when ALL hold:**
1. **Checkable** — maintainer can express the desired structure as a deterministic static regex/string (not a soft judgment). "Deterministic" keeps the score reproducible; ground-truth comes from maintainer authorship, not from the assertion being a regex.
2. **Attributed** — names a responsible asset resolving to a valid v1 loop target (`skills/**/SKILL.md`, `agents/*.md`, `commands/*.md`, `templates/*.md`). Non-prompt assets (`.mjs`/doc) are ineligible.
3. **Promoted by recurrence (single-incident gated)** — either: same `dedup_key` appears **≥ N times across ≥ N distinct `source_run`s** (default N=3, mirrors `cycle-memory.mjs:198`); OR an `investigate` post-mortem with `Confidence ≥ 9/10` **only when** the asset already has ≥1 prior maintainer-ratified holdout case OR ≥2 distinct `source_run`s. A lone N=1 high-confidence case with empty holdout is the maximum-self-deception configuration and is **forbidden**.

**Route class:** reuse the category labels in `action-router.md`'s classification table (`SOURCE_GAP`, `ASSUMPTION_ERROR`, `FRAMEWORK_MISMATCH`, `COMPLETENESS_GAP`, `FORMAT_VIOLATION`, `EXECUTION_QUALITY` — these live in an *unnamed* column; there is no `root_cause_category` field). Per-run routing: `EXECUTION_QUALITY`→REFINE (`:15`), `SOURCE_GAP`/`ASSUMPTION_ERROR`/`FRAMEWORK_MISMATCH`→PLAN (`:10-12`), `COMPLETENESS_GAP`/`FORMAT_VIOLATION`→DO (`:13-14`). evolve adds one NEW class **`ASSET_WEAK`** layered on recurrence: `EXECUTION_QUALITY` recurring on the same asset, or `SOURCE_GAP`/`FRAMEWORK_MISMATCH` recurring on the same producing skill ⇒ `ASSET_WEAK`. Single-incident `FORMAT_VIOLATION`/`COMPLETENESS_GAP` stay DO-routed.

## 3. Harvester pipeline

**(A) Failure sources (all exist; PROVENANCE only):** `pdca_get_events(type: gate_fail|stuck_detected)`; `pdca_get_analytics` (per-run, walk `pdca_list_runs` to aggregate); `pdca_get_insights`; `soul_retro`/`soul_get_synthesis_context`/`soul_get_observations({category:correction})`; `.captures/investigate-*.md`. None supplies a verbatim expected-output → maps to *which asset is weak*; the check is authored at §3C.

**🆕 NEW PIECE #1 — structured failure ledger.** Create `mcp/lib/evolve-ledger.mjs` (append-only JSONL, atomic tmp+rename), importing the JSONL helpers from `hooks/lib/event-log.mjs` (the `logEvent` pattern; already imported cross-layer by `mcp/lib/pdca-handlers.mjs:16`). Kept **off** `insights.json` to preserve its exact-text de-dup + 3×-critical gotcha trigger (`cycle-memory.mjs:193-205`). Record schema (`.data/evolve/failures.jsonl`):
```
{ id, source_run, source_kind, asset_path, finding_excerpt, input_ref,
  check_assertion,          // MAINTAINER-AUTHORED static regex/string — null until authored
  check_author: "maintainer",  // REQUIRED on suite entry; "model"/null rejected by gate
  root_cause_class, checkable, confidence, dedup_key, timestamp }
```
Capture at three durable moments — gate_fail emission, Act-STOP/Outcome-3 hand-off, investigate report save — recording `asset_path` (via §7 attribution map) + `finding_excerpt` + `input_ref`. **`check_assertion` is NOT written at capture** — authored by the maintainer at §3C. v1 may read artifacts on demand at `harvest` rather than wiring into the MCP server (§10 Q3).

**Fields that don't exist today and must be added:** everything except `source_run` and the `data.missing[]` rule-name list — `asset_path`, `input_ref`, `check_assertion`, `checkable`, `dedup_key`, persisted `root_cause_class` (it dies at run end — `saveCycleMetrics` omits it, `pdca-handlers.mjs:575-589`).

**(B) Candidate (authored, not derived):** target = `asset_path` → suite `allowed_targets`. check = `check_assertion`, maintainer-authored static regex (NOT extracted from the finding). input = case `prompt`; `input_ref` content surfaced during authoring. scorer = NEW PIECE #2.

**(C) Validation gate (mandatory maintainer-confirm for v1):**
1. **Provenance** — `id` resolves to a real record with real `source_run` + readable `input_ref`.
2. **Fidelity (NEW)** — surface `finding_excerpt` + `input_ref` content side-by-side with the proposed check; maintainer confirms it's a faithful structural consequence of the failure.
3. **Authorship (NEW)** — `check_author == "maintainer"`; `null`/`"model"` rejected. A model-suggested draft is allowed only if the maintainer edits it.
4. **Schema** — run through engine's `validateSuiteShape` + `validateLoopTarget` (`loop-runner.mjs:193-218`) before disk write; **additionally reject any suite with `scoring.min_delta < 0.02`** (engine only checks numeric, `:231-232`).
5. **Maintainer-confirm (MANDATORY v1)** — no `.json` lands in `benchmarks/loop/` without approval.

**(D) Suite entry:** `benchmarks/loop/evolve-<asset-slug>.json`, `min_delta` pinned to `0.02`.

**🆕 NEW PIECE #2 — data-driven scorer `scripts/evolve-scorer.mjs`.** `__score-suite-case` throws for any suite not named `write-core`/`review-core` (`loop-runner.mjs:700-703`), so evolve suites need their own scorer. Mirrors `scoreChecks` but reads the maintainer-authored static regex **from case/suite data**. Case `command` = `node scripts/evolve-scorer.mjs "{{candidate_dir}}" <asset_path> <assertion-ref>` → prints `{"average_score":N}`.

**Determinism invariant (load-bearing):** `evolve-scorer.mjs` MUST be **pure over (target file contents, static assertion)** — no clock/network/random/env, no filesystem reads beyond the target asset. Each `check_assertion` MUST be a **literal static regex/string**. The engine only guarantees "parseable numeric" (`parseEvaluatorOutput:257-284`); real determinism rests entirely on this invariant.

**Scope note:** "no `.mjs` mutation" constrains what the loop *mutates as targets* — it does NOT forbid evolve *shipping* a new scorer/ledger `.mjs`. Those are normal code changes outside loop scope.

## 4. Integration with the loop engine — REUSE, do not fork

```bash
# 1. evolve-side floor check + in-process pre-write validation (no spawn)
import { validateSuiteShape, validateLoopTarget } from '../../scripts/loop-runner.mjs'
assert(generatedSuite.scoring.min_delta >= 0.02)   // engine has no floor
validateSuiteShape(generatedSuiteObject)            // throws before disk write
# 2. write benchmarks/loop/evolve-<asset>.json (min_delta pinned 0.02)
# 3. run the unmodified engine
node scripts/loop-runner.mjs run evolve-<asset> --targets <asset_path> [--budget N] [--max-generations N] ...
#    → isolated codex/loop-<runId> branch, baseline scored, candidates mutated,
#      winner promoted ONLY if delta >= min_delta AND all hard gates pass
# 4. read .captures/loop-<runId>/{leaderboard.json, summary.json, winner.diff}  (no stdout parse)
# 5. [NEW holdout check, advisory] → HALT for maintainer MERGE REVIEW of winner.diff
```
Inherited untouched: deterministic numeric parse, hardcoded hard gates (syntax/manifest/contract-smoke/allowed-targets/critic-output in `evaluateCandidate`), isolated-branch-only, mutation-scope fence. **Correction:** `min_delta` is NOT an engine constant — it's a per-suite field (`:907`) with no engine floor (`:231-232`); evolve **re-authors it per suite and pins it to 0.02**. **`hard_gates` non-finding:** `suite.scoring.hard_gates` is consumed ONLY by `validateSuiteShape`'s array-shape check (`:228-229`), never by promotion — generated suites cannot weaken gates through it.

## 5. Subcommands

| Command | Purpose |
|---------|---------|
| `list-failures` | List evolve-eligible records from `.data/evolve/failures.jsonl` (filter by asset / root_cause_class / recurrence ≥ N), newest-first. |
| `show-failure <id>` | Inspect one record + the candidate it would generate (target, provenance, `input_ref` content). Shows where the maintainer-authored check is required. |
| `harvest [<id>\|<asset>]` | Run §3: source → candidate → fidelity+authorship+min_delta gate → write suite. **Maintainer-confirm mandatory; maintainer authors the check here.** |
| `run <asset>` | Shell out to `loop-runner.mjs run evolve-<asset>` (§4), then advisory holdout check (§6). **Never daemon-scheduled.** |
| `resume <run_id>` | Delegate to `loop-runner.mjs resume <run_id>`. |

## 6. State & artifacts

| Artifact | Path | Owner |
|----------|------|-------|
| Failure ledger (NEW) | `.data/evolve/failures.jsonl` | evolve — append-only, atomic |
| Generated suites | `benchmarks/loop/evolve-<asset>.json` | evolve (tracked; min_delta pinned 0.02) |
| Loop active state | `.data/state/loop-active.json` | loop engine |
| Run artifacts | `.captures/loop-<runId>/{leaderboard,score-history,summary}.json, winner.diff` | loop engine |
| Promotion ledger (NEW, optional) | `.data/evolve/promotions.jsonl` | evolve |

**🆕 NEW holdout / anti-overfit check (advisory, POST-PROMOTION).** `aggregateCaseScores` (`:286-298`) is a pure weighted mean with no per-case floor; promotion is aggregate-delta only (`:907`) → a big win on the new case can mask a regression on a prior real case. weight-0 cases are still evaluated (`:590`) and recorded in `case_scores` (`:608`). After `run`, evolve reads per-case scores from `leaderboard.json` and **flags** a winner that regresses any holdout case. **Honest limits:** (a) runs AFTER the engine promoted the winner onto the branch (`promoteWinner:708-721`) — advisory only, sets `holdout_regression` status and withholds the merge recommendation, does not un-promote; protection depends on the maintainer reading status before manual merge. (b) holdout empty on first evolution of an asset → why N=1 high-confidence is forbidden. (c) holdout cases are structural checks → "no regression" = "still satisfies other maintainer-ratified structural checks," not "behavior preserved." Behavioral backstop = maintainer merge review of `winner.diff`.

**Durability:** `.data/` and `.captures/` are gitignored — ledger is local-only provenance. Generated suites under `benchmarks/loop/` ARE tracked. See §10 Q2.

## 7. NEW vs REUSE

| Component | Tag | Delta |
|-----------|-----|-------|
| `loop-runner.mjs run` engine | **REUSE** | Entire baseline/mutate/score/promote; evolve shells out, zero edits. |
| `validateSuiteShape`/`validateLoopTarget` | **REUSE** | Pre-write gate (in-process), after evolve's own `min_delta ≥ 0.02` check. |
| Suite registration (`benchmarks/loop/*.json`) | **REUSE** | Drop-a-file-by-name. |
| Isolated branch + hard gates | **REUSE** | Promotion safety unchanged. `hard_gates` array-shape-checked only. |
| `min_delta` floor | **REUSE-VALUE, RE-AUTHORED** | Per-suite field, no engine floor; evolve pins to 0.02, rejects `< 0.02`. |
| `resume` | **REUSE** | Delegates. |
| Failure read APIs | **REUSE** | Harvest sources — provenance only. |
| Structured failure ledger (`mcp/lib/evolve-ledger.mjs`, `.data/evolve/failures.jsonl`) | **🆕 NEW** | The asset_path/input_ref/check_author fields no record has. Off `insights.json`. |
| Data-driven scorer (`scripts/evolve-scorer.mjs`) | **🆕 NEW** | `__score-suite-case` hardcoded; pure over (file contents, static assertion). |
| Asset-attribution map (`config/evolve-asset-map.json`) | **🆕 NEW** | phase/category→asset map is prose-only today. |
| Maintainer check-authoring + fidelity/authorship gate | **🆕 NEW** | The actual self-deception fence. |
| `ASSET_WEAK` route class | **🆕 NEW** | No route means "producing asset is structurally weak → evolve backlog." |
| Holdout check (advisory, post-promotion) | **🆕 NEW** | Engine has no per-case floor. |
| Capture (gate_fail/Act-STOP/investigate-save) | **🆕 NEW (v1: on-demand; auto-wire optional)** | Provenance failure→asset. |
| Promotion ledger | **🆕 NEW (optional)** | Joins winner→source failures. |

## 8. File manifest

| Action | Path | Note |
|--------|------|------|
| CREATE | `skills/evolve/SKILL.md` | Clone `loop/SKILL.md` skeleton. Frontmatter 3 keys: `name`, `description`, `effort: high`. Restate slash-only Gotcha. |
| CREATE | `commands/evolve.md` | Clone `commands/loop.md`; Context via `!` injecting `list-failures` JSON; end with "Do not say that you are invoking or have invoked a skill." |
| CREATE | `scripts/evolve-scorer.mjs` | NEW PIECE #2. Pure. |
| CREATE | `mcp/lib/evolve-ledger.mjs` | NEW PIECE #1. Imports JSONL helpers from `hooks/lib/event-log.mjs`. |
| CREATE | `config/evolve-asset-map.json` | NEW category/phase→asset map. |
| CREATE (OPTIONAL) | `docs/skills/evolve.md` + `.ko.md` | OPTIONAL (docs/skills covers 11/16). EN+KO independently authored. |
| EDIT (STRUCTURAL) | `CLAUDE.md:9`, `AGENTS.md:9` | **NOT a count bump.** Both enumerate all 16 skill names. Append `evolve` AND bump "16"→"17". |
| EDIT (STRUCTURAL) | `README.ko.md:63`, `docs/architecture.ko.md:41,69` | Ordinal/list reconciliation ("16번째 스킬", "16개 스킬 목록"). |
| EDIT | `docs/architecture.md` + `.ko.md` | PDCA roster table (Act/Check row) + skills tree + "16"→"17". |
| EDIT (count) | `plugin.json`, `marketplace.json`, `README.md` | Bump count string. |
| **`prompt-detect.mjs`** | **NO entry** | **Slash-only** (loop precedent `loop/SKILL.md:62`). |
| **`hooks.json`** | **NEVER edit** | Lifecycle registry; CLAUDE.md "Do Not". |

Verify enumeration edits: `grep -rn 'investigate, viewer, unblock' --include='*.md' .` and `grep -rn '16번째\|16개 스킬' --include='*.md' .`.

## 9. Non-goals

- **No model-class-authored success criteria.** `check_author == "maintainer"` enforced at the gate.
- **No claim the score measures runtime behavior.** v1 = structural conformance only. Naming it "failure-reproduction" would be false; it is **structural-conformance evolution against maintainer-authored checks**.
- **No autonomous merge.** Winners land on `codex/loop-<runId>` only; merge is manual (final behavioral gate).
- **No daemon / background autonomy.** `evolve run` is never `daemon_schedule_workflow`'d or `daemon_start_background_run`'d. Auto-capture, if wired, only APPENDS provenance — not a trigger.
- **No prompt-detect / NL routing.** Slash-only.
- **No engine fork or gate relaxation.** Zero engine edits; `min_delta` pinned ≥ 0.02; `hard_gates` cannot weaken hardcoded gates.
- **No mutation of `.mjs`/`docs`/`README*`/`tests` as evolve TARGETS.** (Shipping evolve's own NEW `.mjs` is fine.)
- **No N=1 single-high-confidence promotion on an un-evolved asset.**
- **No LLM-critic scoring in v1.** Engine cost/token accounting is a `length/4` heuristic (`:634-642`) — untrustworthy for a budget gate. v1 = deterministic structural-regex scorer.
- **No restructuring of `insights.json`.**

## 10. Open questions for the maintainer

1. **Recurrence threshold N** — default 3 (matches gotcha threshold). N=2 harvests faster, more noise. Set N?
2. **Ledger location & durability** — `.data/evolve/failures.jsonl` is local-only (gitignored). Move to a tracked path (e.g. `benchmarks/evolve/failures.jsonl`) for cross-clone provenance, committing failure history into the repo? Or keep local?
3. **Capture: on-demand vs wired** — v1-cheap = `harvest` reads existing artifacts on demand (no `.mjs` handler edits). v1-durable = wire `saveEvolveRecord` into `pdca-handlers.mjs` + investigate save (more reliable, more `.mjs` edits). Which?
4. **Promotion ledger** — ship `.data/evolve/promotions.jsonl` in v1 or defer?
5. *(Minor)* **Model-suggested check drafts** — allow a model to suggest a draft regex the maintainer must edit, or author from scratch (no anchoring)? Resolved conservatively: drafts allowed only if hand-edited.

---

**Verification of load-bearing claims (read against source):** `scoreChecks` reads static file text only, never executes a prompt (`loop-runner.mjs:644-647`); mutations fenced to the same `allowed_targets` file (`verifyChangedFiles:510-517`); promotion gate reads per-suite `suite.scoring.min_delta`, no engine floor (`:907,922`; `validateSuiteShape:231-232`); `hard_gates` array-shape-checked only (`:228-229`); all cases incl. weight-0 evaluated, `case_scores` recorded (`:590,608`); `aggregateCaseScores` pure weighted mean (`:286-298`); `gate_fail.data.missing[]` = rule names (`pdca-handlers.mjs:156-178,363,371`); `bundledSuiteScore` hardcoded to write-core/review-core (`:650-706`); `estimateTokens` = length/4 (`:634-642`); action-router categories in unnamed column, `EXECUTION_QUALITY`→REFINE / `SOURCE_GAP`·`FRAMEWORK_MISMATCH`→PLAN (`action-router.md:10-15`); `CLAUDE.md:9`+`AGENTS.md:9` enumerate 16 skills; KO ordinals `README.ko.md:63`, `architecture.ko.md:41/69`; `event-log.mjs` in `hooks/lib/`, imported by `pdca-handlers.mjs:16`; real file is `check-phase.md` not `check.md`; docs/skills covers 11/16.

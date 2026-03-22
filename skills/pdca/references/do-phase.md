# Do Phase (Produce) — Checklist

**Permission Mode**: `acceptEdits`. Writing the artifact requires file access — the orchestrator must switch from `plan` mode before dispatching Do phase agents.

The Do phase is a **pure executor**. It transforms Plan artifacts into a concrete output.
It does NOT research (Plan did that) and does NOT review (Check will do that).

## Entry Conditions

- Plan phase gate passed (Research Brief + Analysis exist)
- OR Act→Do cycle return (review findings provided as constraints)
- OR user explicitly provides source material and skips Plan
- Production format decided (from Question Protocol or prompt)

## Pure Execution Principle

Do phase skills run in **stripped mode**:
- `/scc:write --skip-research --skip-review` — No internal research or review
- Plan already gathered data; Check will verify quality
- This prevents duplicate work and keeps phase boundaries clean

On Act→Do return: review findings are passed as constraints to the write prompt, focusing the rewrite on specific issues.

## Skill Selection

| User Intent | Skill | Mode |
|-------------|-------|------|
| Content (article, report, newsletter) | `/scc:write --skip-research --skip-review` | Pure execution |
| Different framework analysis | `/scc:analyze` | Different from Plan's framework |
| Multi-step workflow | `/scc:pipeline` | Uses predefined pipeline |

## Pre-Flight Check (Mandatory)

Before any execution, verify Plan artifacts exist:

1. Check for PDCA state file (`pdca-active.json`)
2. **No state file** → **STOP**: "No active PDCA session found. Run Plan first or provide `--source {file}`."
3. **State file exists, topic mismatch** (state topic ≠ current request) → **STOP**: "Active session is for '{state.topic}'. Start a new cycle with Plan or provide `--source {file}`."
4. **State file exists, topic matches, artifacts present** → proceed to Execution Steps
5. **State file exists, topic matches, artifacts null** → **STOP**: "Plan phase incomplete — artifacts not yet produced. Run Plan first or provide `--source {file}`."
6. **No state file but `--source {file}` provided** → use provided source, proceed

This prevents producing content from nothing when `--phase do` is used directly, and catches stale state from prior sessions.

## Execution Steps

1. **Load Plan artifacts**: Read Research Brief + Analysis from Plan phase (or `--source` file)
2. **Select skill**: Based on user intent or Plan recommendation
3. **Pass context**: Feed Plan artifacts as input
4. **On Act→Do return**: Inject review findings as constraints
   ```
   Constraints from review:
   - [finding 1]: address by...
   - [finding 2]: fix by...
   ```
5. **Execute**: Run skill with `--skip-research --skip-review`
6. **Save artifact**: Ensure output is written to a file
7. **Assess completeness**: Check against the Gate Checklist below

## Gate Checklist (Do → Check)

All items must pass before proceeding to Check:

- [ ] **Artifact exists** — A file was created (not just console output)
- [ ] **Artifact is complete** — All sections filled, no "[TODO]" or "[TBD]" placeholders
- [ ] **Research integrated** — Plan phase findings are actually used, not ignored
- [ ] **Format followed** — If a format spec exists, it was followed
- [ ] **Length appropriate** — Matches the format's expected range
- [ ] **Voice consistent** — Tone matches the target audience

### Gate Failure Actions

| Failure | Action |
|---------|--------|
| Artifact is incomplete | Complete missing sections before review |
| Research not used | Re-run write with explicit instruction to cite Plan findings |
| Format violated | Check format spec and fix |
| Too short/long | Adjust scope and regenerate |

## Worktree Isolation

The Do phase writes artifacts in an isolated git worktree branch (`worktree-pdca-do`). This keeps the main branch clean until the artifact is approved.

**Branch lifecycle**:

| Check verdict | Action |
|---------------|--------|
| APPROVED | Act phase merges: `git merge worktree-pdca-do` |
| MINOR FIXES | Act phase merges after applying fixes in the same worktree |
| NEEDS IMPROVEMENT | Keep worktree; apply fixes in place, then re-Check |
| MUST FIX | Discard worktree (`git worktree remove --force`) for a clean rollback; re-enter Do |

**Merge strategy** (Act phase, after approval): from the main branch, run `git merge --no-ff worktree-pdca-do` to preserve the Do phase commit history, then `git worktree remove worktree-pdca-do` to clean up.

**Auto-clean rule**: if the Do phase completes without writing any file changes (empty diff), the worktree is removed automatically — no manual cleanup needed.

## Output to Next Phase

Output must conform to the **DoOutput schema** (see `references/phase-schemas.md`).
The orchestrator validates all fields before passing the gate.

Pass to Check phase:
- Path to artifact file → `artifact_path`
- Format of artifact → `format` (one of: `newsletter|article|report|shorts|social|card-news`)
- Word count of artifact → `word_count`
- Whether Plan findings were used → `plan_findings_integrated` (must be `true`)
- Whether all sections are complete → `sections_complete` (must be `true`)
- Worktree branch name (`worktree-pdca-do`) — the Act phase needs this to merge or discard
- Recommended review preset:
  - Article/newsletter → `content`
  - Strategy/analysis → `strategy`
  - Code → `code`
  - Quick validation → `quick`

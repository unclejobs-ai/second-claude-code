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

## Sub-Skill Selection (PDCA Calls One of These Inside Do)

PDCA's Do phase is **always** implemented by dispatching one sub-skill. The orchestrator picks the **most specialized** sub-skill that matches the artifact format. Specialized sub-skills (`/threads`, `/newsletter`, etc.) own their own internal multi-phase pipelines — those internal phases run **inside** PDCA's Do phase, gated by the sub-skill's own contracts. PDCA's Plan provides upstream context, and PDCA's Check + Act wrap the sub-skill's output for downstream validation.

| Detected format / intent | Sub-skill PDCA dispatches | Sub-skill mode | What runs inside |
|--------------------------|--------------------------|----------------|------------------|
| Threads article (@unclejobs.ai), 한국어 콘텐츠 from URL/MD | `/threads` | Full 8-phase pipeline | parse → research → draft → edit → cross-review → proofread → final QA → publish |
| Korean tech newsletter | `/newsletter` | Full 7-phase pipeline | research → draft → edit → publish (Notion/Beehiiv) |
| Shorts script (60-90s, 9:16, 릴스/Reels) | `/academy-shorts` | Full pipeline | research → script → editor → MMBridge review |
| Card news (carousel, 캐러셀, 인스타 카드) | `/card-news` | Template render pipeline | template → render (Playwright) → preview |
| Generic article / report / blog post / decision doc | `/scc:write --skip-research --skip-review` | Pure execution from Plan artifacts | Single-pass write using research brief and analysis |
| Different framework analysis (SWOT, Porter, OKR, RICE) | `/scc:analyze` | Framework execution | Apply named framework to Plan inputs |
| Pre-defined multi-step workflow | `/scc:pipeline` | Pipeline replay | Run a saved pipeline definition |
| Code change / PR / refactor | `/scc:write --format code` then `/scc:review --preset code` | Two-step | Write code, then immediate review |

### Selection Algorithm (Run This At Do Phase Entry)

1. Read the user's original prompt and the Plan output's `dod` field.
2. Scan for **specialized format keywords** in this priority order:
   - Threads keywords ("스레드", "threads", "@unclejobs.ai") → `/threads`
   - Newsletter keywords ("뉴스레터", "newsletter", "주간 뉴스레터") → `/newsletter`
   - Shorts keywords ("쇼츠", "shorts", "릴스", "Reels", "9:16", "60초", "academy shorts") → `/academy-shorts`
   - Card news keywords ("카드뉴스", "card news", "인스타 카드", "캐러셀", "carousel") → `/card-news`
   - Code keywords ("PR", "리팩터", "버그 수정", "implement", "refactor") → `/scc:write --format code`
3. If no specialized format matches, scan for **generic content type**:
   - Long-form analysis/report → `/scc:write` with target length from "Length Floors by Format" table
   - Strategic framework → `/scc:analyze`
   - Multi-step → `/scc:pipeline`
4. Default fallback: `/scc:write --skip-research --skip-review` with the format that best matches the Plan output's recommended scope.

**Sub-skill matching is greedy**: pick the most specialized sub-skill that fits, never the generic one when a specialized one exists. A threads article must go through `/threads`, never `/scc:write`, because `/threads` has voice-guide enforcement, cross-review with external models, and a Notion publish step that `/scc:write` does not.

### What Sub-Skills Return to PDCA

Every sub-skill returns the same DoOutput schema (see `references/phase-schemas.md`):
- `artifact_path`
- `format`
- `char_count` (body only)
- `section_count`
- `meets_length_floor`
- `meets_section_floor`
- `plan_findings_integrated`
- `sections_complete`
- `references_count`

PDCA validates these fields at the Do→Check gate. **A sub-skill that returns an artifact below the format's length floor causes PDCA's Do gate to fail**, even if the sub-skill internally considered the artifact "complete". PDCA's contract supersedes the sub-skill's self-assessment because PDCA is the main orchestrator and the sub-skill is a building block.

### Sub-Skill Failure Handling

If the sub-skill itself fails (errors out, hangs, returns malformed output):

1. **Log the failure** with sub-skill name + input + error
2. **Try fallback sub-skill**: e.g., `/threads` failed → fall back to `/scc:write` with explicit threads format spec from `/threads/references/article-template.md`
3. **If fallback also fails**: surface to user with "Sub-skill {name} failed in Do phase. Manual intervention needed."

PDCA never silently swallows sub-skill failures. The Do gate must produce a valid artifact or fail loudly.

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
- [ ] **Length meets format floor** — See "Length Floors by Format" table below. Below floor → **gate fails, no exceptions**
- [ ] **Voice consistent** — Tone matches the target audience
- [ ] **Section count meets minimum** — See section count column in length table
- [ ] **References section present** — At least 3 cited sources from Plan phase appear in artifact's references/footnotes

### Gate Failure Actions

| Failure | Action |
|---------|--------|
| Artifact is incomplete | Complete missing sections before review |
| Research not used | Re-run write with explicit instruction to cite Plan findings |
| Format violated | Check format spec and fix |
| Below length floor | Re-run writer with explicit instruction to expand to minimum, citing what scope is missing. Do NOT pad with filler. |
| References missing | Inject Plan phase sources into artifact before re-checking |

## Length Floors by Format (Hard Contracts, Not Suggestions)

The Do phase artifact must meet a minimum length and structural threshold appropriate for its format. **Below the floor = gate fails. Re-run is mandatory, not optional.**

These floors are deliberately set high. PDCA exists to produce substantive, reader-rewarding output. Sparse outputs are a failure mode of every prior generation pipeline — PDCA's Do gate exists specifically to prevent them.

| Format | Min chars (body) | Target chars (body) | Min sections | Sub-skill PDCA dispatches in Do |
|--------|-----------------|---------------------|--------------|-------------------------------|
| Threads article (@unclejobs.ai) | 4,000 | 5,000-7,000 | 6 H2 or bold sections | `/threads` (its 8-phase pipeline runs inside Do) |
| Korean tech newsletter | 10,000 | 12,000-15,000 | 6+ topics, intro + outro + CTA | `/newsletter` (its 7-phase pipeline runs inside Do) |
| Generic article (long-form) | 4,000 | 5,000-7,000 | 5 H2 sections | `/scc:write` |
| Strategy/analysis report | 5,000 | 6,000-9,000 | 6 sections (situation, players, analysis, options, recommendation, risk) | `/scc:write` |
| SWOT / Porter / OKR / RICE doc | 3,000 | 4,000-5,000 | 4 quadrants/items, each with evidence + counterevidence + decision | `/scc:analyze` |
| Shorts script (60-90s) | 1,800 | 2,200-2,800 | 12 scenes (narration + visual cue + on-screen text per scene) | `/academy-shorts` |
| Card news (carousel) | 8-10 cards (count, not chars) | 9-12 cards | hook + 6-8 body + CTA + source card | `/card-news` |
| Social post (single tweet/thread post) | 280-700 chars (range, both ends fail gate) | 500-650 | 1 hook + 3-5 supporting lines | `/scc:write --format social` |
| PRD (product requirements) | 4,000 | 5,000-7,000 | 7 sections (problem, target users, success metrics, scope, non-scope, risks, rollout plan) | `/scc:write --format prd` |
| Code review report | 2,500 | 3,500-5,000 | 5 sections per file/PR (security, perf, architecture, tests, accessibility) | `/scc:review` |
| Research brief (Plan output) | 3,000 | 4,000-6,000 | 8 facts with sources + 5+ links + comparison table + 1+ quotes + media list | `/scc:research` |
| Meeting notes / decision doc | 2,000 | 2,500-3,500 | 5 sections (context, decision, rationale, alternatives, owner) | `/scc:write --format decision` |

### Interpreting the Floor

- **Min chars (body only)**: count UTF-8 characters of the markdown body. Exclude frontmatter, references section, image alt text, code block language tags. **Below this number = gate fails immediately.**
- **Target chars**: the range PDCA aims for. Hitting min but not target = passes gate but Check phase will flag "thin coverage" as a concern.
- **Min sections**: count distinct H2 headings or bold-labeled section markers. Below the section count = the artifact is too thin structurally even if total chars meet the floor.
- **range formats** (social posts, card news): both below AND above the range fail the gate. A social post over 700 chars belongs as an article, not a social post; a card news with 15 cards belongs as an article, not a carousel.

### Calibration Principles (Why These Numbers)

The floors are not arbitrary. They are calibrated against three benchmarks:

1. **Reader value floor** — the minimum length at which the format delivers a complete idea, not a teaser. A threads article under 4,000 chars cannot fit a hook + 5 supporting points + a closing argument; it can only fit 2-3 of those, which is not an article, it's a long social post mislabeled.

2. **Source utilization floor** — every fact gathered in the Plan phase should appear in the Do output. If Plan has 8 facts and 5 sources and the artifact only uses 3 of them, the floor enforces re-expansion. Plan work should not be wasted.

3. **AI hedge prevention** — language models tend to under-write when given vague length guidance. Setting a numeric floor forces the writer to commit to substance instead of producing a polished-but-sparse skeleton. The target range tells the writer where the sweet spot is.

### Why Length Floors Are Hard Contracts

Past failure mode: PDCA's Do phase produced artifacts in the 2,000-3,000 char range because the original DoOutput schema only required `word_count > 0`. Reviewers would approve them ("technically complete") and the user would receive sparse artifacts that failed to deliver real value. The user had to manually push back and ask for more content, which is exactly the burden PDCA exists to remove.

The fix: shift the contract upstream. The Do gate now fails BEFORE the artifact reaches the reviewer if it doesn't meet the floor. A reviewer cannot rescue a fundamentally underfilled artifact — they can only suggest expansion, which the user then has to negotiate manually. By failing the gate at the Do output, PDCA forces the writer to expand before any review pass even runs.

Length floors are calibrated to the minimum at which the format delivers reader value. **Below the floor, the artifact is structurally insufficient regardless of how polished the prose is.** Polish without substance is the most common failure mode — PDCA refuses to ship it.

### Writer Instruction Pattern (When Re-Running After Floor Failure)

When the Do phase writer is re-dispatched because `meets_length_floor: false`, the orchestrator must give the writer **specific scope direction**, not a generic "make it longer" prompt. Generic prompts produce filler. Specific prompts produce substance.

Pattern:

```
Previous draft was {actual_chars} chars. Floor for this format is {floor_chars}.
The following Plan phase findings are not adequately developed in the current draft:

- Finding A: {one-line summary} — currently mentioned in N sentences, needs at least
  {expanded_count} sentences with the specific data point and 1 example
- Finding B: {one-line summary} — completely missing from the draft, must be added
  as a dedicated subsection under H2 "{relevant_section}"
- Finding C: {comparison/contrast point} — present but not contrasted with the
  alternative position from source {source_name}

Re-write the draft to address each of these. Do not pad with filler sentences.
Each new sentence must carry a fact, a comparison, or a concrete example from the
research brief.
```

This pattern keeps the writer accountable to the source material and prevents the "more words, same emptiness" failure that vague expansion prompts cause.

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

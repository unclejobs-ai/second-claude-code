# Skill Hardening + Detailed Documentation Plan

> **For agentic workers:** Execute tasks sequentially or in parallel via agent-team. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 design bugs found in testing, harden all 8 skills from 7-8/10 to 9-10/10, then create detailed skill documentation pages (EN+KO) with examples and results.

**Architecture:** Phase 1 fixes core logic bugs. Phase 2 creates `docs/skills/` directory with one page per skill containing usage examples, sample output, and diagrams. Each doc page is EN+KO pair.

**Tech Stack:** Markdown, Mermaid, shell scripts for testing

---

## Phase 1: Design Bug Fixes (3 issues from testing)

### Task 1: Fix consensus gate ambiguity

**Files:**
- Modify: `references/consensus-gate.md`
- Modify: `skills/review/SKILL.md`

**Problem:** When threshold is NOT met but NO Critical findings exist, the spec says MUST FIX. But this is too harsh — if all findings are Minor, MUST FIX is disproportionate.

**Fix:** Add a NEEDS IMPROVEMENT verdict between MINOR FIXES and MUST FIX.

- [ ] **Step 1: Update consensus-gate.md**
  Change the verdict rules to:
  ```
  - APPROVED: threshold met, no Critical, no Major
  - MINOR FIXES: threshold met, no Critical, Major or Minor issues remain
  - NEEDS IMPROVEMENT: threshold NOT met, but no Critical findings
  - MUST FIX: any Critical finding from any reviewer
  ```

- [ ] **Step 2: Update skills/review/SKILL.md**
  Update the Consensus Gate section to reflect 4 verdicts.

- [ ] **Step 3: Commit**
  ```bash
  git add references/consensus-gate.md skills/review/SKILL.md
  git commit -m "fix: add NEEDS IMPROVEMENT verdict to resolve consensus gate ambiguity"
  ```

---

### Task 2: Fix write skill format conflict

**Files:**
- Modify: `skills/write/SKILL.md`

**Problem:** When user requests ~800 words but format minimum is 3000, the skill silently compromises. Should negotiate explicitly.

**Fix:** Add a conflict resolution rule.

- [ ] **Step 1: Add negotiation rule to skills/write/SKILL.md**
  After the Format Rules section, add:
  ```markdown
  ## Length Negotiation

  When user-specified length conflicts with format minimums:
  1. Inform the user of the conflict: "Article format minimum is 3000 words, you requested ~800."
  2. Offer: switch to `shorts` or `social` format, OR keep `article` at full length.
  3. If user insists on short article, respect user intent but add a note in output.

  Never silently truncate or silently exceed the user's request.
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add skills/write/SKILL.md
  git commit -m "fix: add length negotiation to resolve format/user conflict"
  ```

---

### Task 3: Strengthen loop skill — true review dispatch

**Files:**
- Modify: `skills/loop/SKILL.md`
- Modify: `skills/loop/gotchas.md` (create if not exists)

**Problem:** Loop review was simulated inline rather than dispatched as real parallel subagents. Also, revert uses md5 instead of git.

**Fix:** Make review dispatch explicit in workflow + mandate git-based revert.

- [ ] **Step 1: Update skills/loop/SKILL.md workflow**
  Clarify step 2: "Run `/second-claude-code:review` — this MUST dispatch actual subagents per the review skill spec. Do NOT simulate review inline."
  Clarify step 4: "Revert using `git checkout -- <file>` to the committed baseline, not in-memory hash comparison."

- [ ] **Step 2: Add gotchas if not present**
  Add to gotchas:
  - "Do not simulate review inline — always dispatch through the review skill"
  - "Use git revert, not hash comparison — git is the source of truth"

- [ ] **Step 3: Commit**
  ```bash
  git add skills/loop/
  git commit -m "fix: mandate real review dispatch and git-based revert in loop skill"
  ```

---

## Phase 2: Skill Documentation Pages (8 skills x 2 languages = 16 files)

### Structure

```
docs/skills/
├── research.md          # EN
├── research.ko.md       # KO
├── write.md
├── write.ko.md
├── analyze.md
├── analyze.ko.md
├── review.md
├── review.ko.md
├── loop.md
├── loop.ko.md
├── collect.md
├── collect.ko.md
├── pipeline.md
├── pipeline.ko.md
├── hunt.md
└── hunt.ko.md
```

### Each doc page contains:

1. **Header**: Skill name, one-line description, badge
2. **Quick Example**: The simplest possible invocation + what happens
3. **Detailed Example**: Real-world scenario with full input → output
4. **Sample Output**: Actual excerpt from test results (from `tests/skill-tests/`)
5. **Options Table**: All flags with defaults
6. **How It Works**: Step-by-step workflow with Mermaid diagram
7. **Gotchas**: Common mistakes
8. **Composition**: How this skill connects to others

### Task 4: Create docs/skills/ pages — research, write, analyze, review (EN)

**Files:**
- Create: `docs/skills/research.md`
- Create: `docs/skills/write.md`
- Create: `docs/skills/analyze.md`
- Create: `docs/skills/review.md`

- [ ] **Step 1: Create docs/skills/ directory**
- [ ] **Step 2: Write research.md** — use `tests/skill-tests/research-test-output.md` for sample output
- [ ] **Step 3: Write write.md** — use `tests/skill-tests/write-test-output.md` for sample output
- [ ] **Step 4: Write analyze.md** — use `tests/skill-tests/analyze-test-output.md` for sample output
- [ ] **Step 5: Write review.md** — use `tests/skill-tests/review-test-output.md` for sample output
- [ ] **Step 6: Commit**

### Task 5: Create docs/skills/ pages — loop, collect, pipeline, hunt (EN)

**Files:**
- Create: `docs/skills/loop.md`
- Create: `docs/skills/collect.md`
- Create: `docs/skills/pipeline.md`
- Create: `docs/skills/hunt.md`

- [ ] **Step 1-4: Write each doc** — use corresponding test output
- [ ] **Step 5: Commit**

### Task 6: Korean translations (all 8)

**Files:**
- Create: `docs/skills/*.ko.md` (8 files)

- [ ] **Step 1-8: Translate/adapt each EN doc to KO**
  - Native Korean expressions
  - Korean example prompts
  - Same Mermaid diagrams

- [ ] **Step 9: Commit**

### Task 7: Add skill detail links to README

**Files:**
- Modify: `README.md`
- Modify: `README.ko.md`

- [ ] **Step 1: Add links from 8 Commands table to docs/skills/ pages**
- [ ] **Step 2: Commit**

---

## Phase 3: Re-test all 8 skills

### Task 8: Re-run 8-skill parallel test

- [ ] **Step 1: Run all 8 skills in parallel via agent-team (opus)**
- [ ] **Step 2: Compare scores against Phase 1 baseline**
- [ ] **Step 3: Target: all skills 9/10+**
- [ ] **Step 4: If any skill <9/10, loop back to fix**

---

## Execution Order

```
Phase 1: Tasks 1-3 (sequential, each is small)
Phase 2: Tasks 4+5 (parallel), then 6 (depends on 4+5), then 7
Phase 3: Task 8 (depends on all)
```

## Verification

- All existing tests pass: `node --test tests/`
- Each doc page renders correctly on GitHub
- 8-skill retest scores >= 9/10
- README links all resolve

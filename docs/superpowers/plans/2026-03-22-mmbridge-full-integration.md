# MMBridge Full Integration (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate mmbridge `research`, `security`, and `gate` commands into the PDCA pipeline with mmbridge-first auto-detection and graceful fallback.

**Architecture:** Common mmbridge layer (`references/mmbridge-integration.md`) provides shared detection/invocation/error rules. Each skill references this layer and adds command-specific integration. All mmbridge calls run in parallel with internal agents and never block the pipeline.

**Tech Stack:** MMBridge CLI, Bash invocation from skill instructions, markdown skill definitions

**Spec:** `docs/superpowers/specs/2026-03-22-mmbridge-full-integration-design.md`

---

### Task 1: Common MMBridge Integration Layer

**Files:**
- Create: `references/mmbridge-integration.md`

- [ ] **Step 1: Create the common mmbridge reference document**

```markdown
# MMBridge Integration — Common Rules

All skills that use mmbridge MUST follow these rules. This is the single source of truth
for detection, invocation, error handling, and result merging.

## Detection

1. Run `which mmbridge` via Bash **once** at skill start.
2. If found → mmbridge is available for this skill invocation. Proceed with mmbridge-enhanced flow.
3. If not found → silently skip all mmbridge calls. Use internal agents only. No warning, no error.

Detection is per-skill-invocation. Do not cache across skill boundaries.

## Invocation Pattern

All mmbridge commands use this base pattern:

\`\`\`bash
mmbridge <command> [command-specific-options] --stream --export /tmp/mmbridge-<command>-${RUN_ID}.md
\`\`\`

- `--stream`: Real-time output to terminal for user visibility
- `--export`: Write results to a file for programmatic parsing
- `${RUN_ID}`: Use the current PDCA run ID if available, otherwise generate a timestamp-based ID (`date +%s`)

## Parallel Execution

mmbridge calls are ALWAYS dispatched in **parallel** with internal agents:
- Use separate Bash tool calls (not sequential `&&`)
- Internal agents and mmbridge run simultaneously
- Results are merged at the skill's designated merge point

## Error Handling

- **Exit non-zero**: Log the error message. Proceed without mmbridge result. Do not retry.
- **Timeout** (per-command): `research` 300s, `security` 180s, `review` 120s, `gate` 60s. Kill and proceed on timeout.
- **Export file missing**: If the export path does not exist after mmbridge completes, treat as failure.
- **Parse error**: If the export file exists but cannot be parsed, log and skip mmbridge findings.

**Iron rule**: mmbridge failure NEVER blocks the pipeline. Internal agents alone produce a complete result.

## Result Merging

mmbridge results are merged as "external source" at each skill's merge point:
- Research: mmbridge findings → analyst input (supplemental sources)
- Review: mmbridge findings → consensus gate (additional voter)
- Security: mmbridge findings → consensus gate (additional voter with CWE mapping)
- Gate: mmbridge gate → advisory signal (logged, not blocking)

## Severity Mapping (for review/security commands)

| MMBridge Label | Internal Severity |
|---------------|-------------------|
| `CRITICAL` | Critical |
| `HIGH` | Major |
| `WARNING` | Major |
| `MEDIUM` | Minor |
| `INFO` | Minor |
| `LOW` | Minor |
| `REFACTOR` | Minor |
```

- [ ] **Step 2: Verify the file was created correctly**

Run: `cat references/mmbridge-integration.md | head -5`
Expected: Shows the title line "# MMBridge Integration — Common Rules"

- [ ] **Step 3: Commit**

```bash
git add references/mmbridge-integration.md
git commit -m "feat: add common mmbridge integration reference layer"
```

---

### Task 2: Refactor Review Skill External Section

**Files:**
- Modify: `skills/review/SKILL.md:135-171`
- Modify: `skills/review/references/consensus-gate.md:74-128`

The existing External Reviewers section has detection/invocation/error logic that is now in the common layer. Refactor to reference it.

- [ ] **Step 1: Replace the External Reviewers section in review SKILL.md**

Replace lines 135-171 of `skills/review/SKILL.md` with:

```markdown
## External Reviewers

When `--external` is set, dispatch a cross-model review in parallel with internal reviewers. The external review counts as 1 additional voter in the consensus gate.

For mmbridge detection, invocation, error handling, and timeout rules, see `references/mmbridge-integration.md`.

### Dispatch

When mmbridge is detected:

\`\`\`bash
mmbridge review --tool kimi --mode review --stream --export /tmp/mmbridge-review-${RUN_ID}.md
\`\`\`

Use `--tool kimi` (most reliable). Avoid `--tool all` (known race condition in concurrent writes).

When mmbridge is not found, check for standalone CLIs (`kimi`, `codex`, `gemini`). If found, delegate to the corresponding agent definition (e.g., `kimi-reviewer`). If none found, silently skip `--external`.

### Merging External Findings

1. Parse the mmbridge export file for findings with severity markers.
2. Map severities per `references/mmbridge-integration.md` § Severity Mapping.
3. Add the external review as 1 voter. A 3-reviewer preset becomes 4 voters with `--external`.
4. Deduplicate against internal findings per `references/consensus-gate.md`.
```

- [ ] **Step 2: Simplify the consensus-gate.md External Reviewers section**

Replace lines 74-128 of `skills/review/references/consensus-gate.md`. Keep vote weight table and finding merge rules. Replace detection/invocation/severity mapping with reference to common layer:

```markdown
## External Reviewers

When `--external` is set, the review skill detects the first available external CLI and dispatches a parallel cross-model review.

For detection order, invocation pattern, error handling, and severity mapping, see `references/mmbridge-integration.md`.

### Vote Weight

The external review counts as **1 additional voter**, increasing the denominator by 1:

| Preset | Without `--external` | With `--external` |
|--------|---------------------|-------------------|
| `content` | 2/3 pass | 2/4 pass |
| `strategy` | 2/3 pass | 2/4 pass |
| `code` | 2/3 pass | 2/4 pass |
| `quick` | 2/2 pass | 2/3 pass |
| `full` | 4/5 pass | 4/6 pass |

### Score Handling

If mmbridge provides a numeric score (from its consensus output), include it in the average score calculation. If no score is available, the external reviewer participates only in the vote-count gate.

### Finding Merge

External findings are deduplicated against internal findings using the standard deduplication rules (section above). External-only findings are added to the report with `[external: mmbridge]` tag.
```

- [ ] **Step 3: Verify no broken references**

Search for any references to the removed content:
Run: `grep -r "Detection:" skills/review/ references/ --include="*.md" | grep -v mmbridge-integration`
Expected: No stale references to old detection logic

- [ ] **Step 4: Commit**

```bash
git add skills/review/SKILL.md skills/review/references/consensus-gate.md
git commit -m "refactor: review skill external section references common mmbridge layer"
```

---

### Task 3: Research Skill MMBridge Integration

**Files:**
- Modify: `skills/research/SKILL.md`

- [ ] **Step 1: Add MMBridge Enhancement section after Internal Flow**

Insert after line 30 (after the Internal Flow diagram closing ``` ) in `skills/research/SKILL.md`:

```markdown
## MMBridge Enhancement

When mmbridge is detected (see `references/mmbridge-integration.md`), the research skill dispatches
`mmbridge research` in **parallel** with the internal researcher for multi-model perspective.

### Enhanced Flow

\`\`\`
┌─ researcher(sonnet): WebSearch ────────────────┐
│                                                 ├─→ analyst: merge + gap analysis
└─ mmbridge research "<topic>" --type code-aware ─┘
\`\`\`

### Dispatch

At Step 1 (Dispatch researcher), also run via Bash:

\`\`\`bash
mmbridge research "<topic>" --type <type> --stream --export /tmp/mmbridge-research-${RUN_ID}.md
\`\`\`

- `--type code-aware`: when topic relates to the current codebase
- `--type open`: for general topics unrelated to code
- `--depth shallow`: **skip mmbridge** (cost vs value too low)
- `--depth medium|deep`: mmbridge enabled

### Merge

At Step 3 (Dispatch analyst), provide the mmbridge export file as supplemental source material:
- Analyst treats mmbridge findings as additional sources alongside internal researcher findings
- mmbridge sources count toward the `sources_count` gate requirement (Plan→Do needs ≥3). Count each distinct cited URL from mmbridge export as 1 source
- If mmbridge produced duplicate findings, analyst deduplicates during gap analysis
```

- [ ] **Step 2: Update the Internal Flow step-by-step to mention mmbridge**

Modify Step 1 (line 35) to:

```markdown
1. **Dispatch researcher** (sonnet): Execute depth-appropriate WebSearch calls across varied query phrasings. Counts are HARD CAPS — see Depth Behavior. If mmbridge detected and depth is medium or deep, dispatch `mmbridge research` in parallel (see MMBridge Enhancement above).
```

Modify Step 3 (line 37) to:

```markdown
3. **Dispatch analyst** (sonnet): Structure findings from internal researcher AND mmbridge (if available). Identify gaps and contradictions. Apply Data Conflict Resolution rules (see `references/research-methodology.md`).
```

- [ ] **Step 3: Update the flow diagram**

Replace lines 19-30 with:

```
\`\`\`
researcher(sonnet) --[WebSearch x5-10]--> raw findings ─┐
                                                         ├─→ analyst(sonnet) --[merge + gap analysis]
mmbridge research (parallel, if detected) ──────────────┘        |
                                                          (shallow: skip gap-fill)
        v  (medium/deep only, if gaps found)
researcher(sonnet) --[WebSearch x3-5]--> supplemental findings
        |
        v
writer(sonnet) --[synthesis]--> Research Brief
\`\`\`
```

- [ ] **Step 4: Verify skill structure is valid**

Run: `head -10 skills/research/SKILL.md`
Expected: frontmatter intact, title correct

- [ ] **Step 5: Commit**

```bash
git add skills/research/SKILL.md
git commit -m "feat: integrate mmbridge research into research skill for multi-model perspective"
```

---

### Task 4: Security Preset for Review Skill

**Files:**
- Modify: `skills/review/SKILL.md`
- Modify: `skills/review/references/consensus-gate.md`

- [ ] **Step 1: Add `security` preset to the Presets table**

In `skills/review/SKILL.md`, replace the Presets table (lines 29-36) with:

```markdown
## Presets

| Preset | Reviewers | MMBridge |
|--------|-----------|----------|
| `content` | deep-reviewer + devil-advocate + tone-guardian | — |
| `strategy` | deep-reviewer + devil-advocate + fact-checker | — |
| `code` | deep-reviewer + fact-checker + structure-analyst | — |
| `security` | deep-reviewer + fact-checker + structure-analyst | `mmbridge security` (via `--external`) |
| `quick` | devil-advocate + fact-checker | — |
| `full` | all 5 reviewers | — |
```

- [ ] **Step 2: Add Security Preset section before External Reviewers**

Insert before the External Reviewers section:

```markdown
## Security Preset

The `security` preset activates security-focused review with optional mmbridge security integration.

### Internal reviewers (security mode)

- **deep-reviewer** (opus): Architecture security analysis — auth flows, data boundaries, privilege escalation paths
- **fact-checker** (sonnet): Known CVE checks, dependency vulnerability scanning, OWASP Top 10 verification
- **structure-analyst** (haiku): Configuration audit — secrets exposure, permission models, environment isolation

### MMBridge Security (via --external)

When `--external` is set and mmbridge is detected, `mmbridge security` runs in parallel with internal reviewers. Consistent with all other presets — `--external` is always opt-in.

\`\`\`bash
mmbridge security --scope <scope> --stream --export /tmp/mmbridge-security-${RUN_ID}.md
\`\`\`

**Option passthrough**:
- `--scope`: `/scc:review --preset security --scope auth` → `mmbridge security --scope auth` (default: `all`)
- `--compliance`: `/scc:review --preset security --compliance GDPR,SOC2` → `mmbridge security --compliance GDPR,SOC2`

### CWE Severity Mapping

mmbridge security uses CWE classification. Map to internal severities per `references/mmbridge-integration.md` § Severity Mapping.

### Consensus gate

mmbridge security counts as 1 additional voter (same as `--external` for other presets):
- Without mmbridge: 2/3 pass (3 internal reviewers)
- With mmbridge: 2/4 pass (3 internal + 1 mmbridge)
```

- [ ] **Step 3: Add security options to the Options table**

Add two new rows to the Options table (line 113-121):

```markdown
| `--scope` | `auth\|api\|infra\|all` | `all` | Security audit scope (security preset only) |
| `--compliance` | `GDPR,SOC2,HIPAA,PCI-DSS` | — | Compliance frameworks (security preset only) |
```

- [ ] **Step 4: Update consensus-gate.md vote weight table**

Add `security` row to the vote weight table in `skills/review/references/consensus-gate.md`:

```markdown
| `security` | 2/3 pass | 2/4 pass |
```

- [ ] **Step 5: Commit**

```bash
git add skills/review/SKILL.md skills/review/references/consensus-gate.md
git commit -m "feat: add security preset with mmbridge security auto-integration"
```

---

### Task 5: Gate Advisory Integration

**Files:**
- Modify: `skills/pdca/references/check-phase.md`

- [ ] **Step 1: Add MMBridge Gate Advisory section**

Append after the "Gate Failure Actions" table (after line 67) in `skills/pdca/references/check-phase.md`:

```markdown
## MMBridge Gate Advisory

When mmbridge is detected (see `references/mmbridge-integration.md`), run a coverage check
after the internal consensus gate completes.

### Execution

After internal consensus gate produces a verdict:

\`\`\`bash
mmbridge gate --mode <mode> --format json --export /tmp/mmbridge-gate-${RUN_ID}.json
\`\`\`

- `--mode review`: for content/strategy/code presets
- `--mode security`: for security preset
- `--mode architecture`: for structural reviews

### Interpretation

The gate result is **advisory only** — it does NOT override the consensus verdict.

| Gate Output | Action |
|------------|--------|
| Coverage adequate | Log: "mmbridge gate: coverage OK" |
| Coverage gaps found | Warn: "mmbridge gate: {n} files uncovered — {file list}" |
| Gate command failed | Log error, proceed with internal verdict only |

### Recording

If PDCA state MCP is available, record the gate result as metadata on the Check→Act transition:

\`\`\`
pdca_transition({ phase: "act", metadata: { mmbridge_gate: { coverage: score, uncovered: [...] } } })
\`\`\`

If MCP is not available, include the gate result in the review report output as an appendix.
```

- [ ] **Step 2: Add gate advisory to the Gate Checklist**

Add one optional item to the Gate Checklist (after line 43):

```markdown
- [ ] **MMBridge gate advisory** (optional) — If mmbridge available, coverage check logged
```

- [ ] **Step 3: Commit**

```bash
git add skills/pdca/references/check-phase.md
git commit -m "feat: add mmbridge gate advisory to Check→Act transition"
```

---

### Task 6: Update Architecture Documentation

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Expand the Cross-Model Review section**

Replace the "Cross-Model Review (MMBridge) — Optional" section (lines 244-279) with:

```markdown
## MMBridge Integration — Optional

MMBridge CLI provides multi-model AI capabilities. When installed, it auto-enhances multiple PDCA phases.
**Entirely optional** — all skills work fully without MMBridge.

### Detection

All skills use the common detection protocol in `references/mmbridge-integration.md`:
`which mmbridge` → if found, auto-enable; if not, silent fallback.

### Integration Points

| PDCA Phase | MMBridge Command | Skill | Behavior |
|-----------|-----------------|-------|----------|
| **Plan** | `mmbridge research` | `/scc:research` | Parallel multi-model research, merged into analyst input |
| **Check** | `mmbridge review` | `/scc:review --external` | Cross-model code review, +1 consensus voter |
| **Check** | `mmbridge security` | `/scc:review --preset security` | CWE-classified security audit, auto-enabled |
| **Check→Act** | `mmbridge gate` | `/scc:pdca` | Advisory coverage check at phase transition |

### Review Flow (updated)

\`\`\`
Review Dispatch
├── Internal (always)
│   ├── Xatu / deep-reviewer (opus)
│   ├── Absol / devil-advocate (sonnet)
│   ├── Porygon / fact-checker (sonnet)
│   ├── Jigglypuff / tone-guardian (haiku)
│   └── Unown / structure-analyst (haiku)
│
├── External — review (--external flag)
│   └── mmbridge review --tool kimi
│
├── External — security (--preset security, auto)
│   └── mmbridge security --scope all
│
└── Consensus Gate
    ├── Merge internal + external findings
    ├── Deduplicate overlapping issues
    ├── Apply severity calibration
    ├── mmbridge gate advisory (if available)
    └── Emit verdict: APPROVED | MINOR FIXES | NEEDS IMPROVEMENT | MUST FIX
\`\`\`

### Research Flow (updated)

\`\`\`
Research Dispatch
├── Internal (always)
│   └── researcher(sonnet) → WebSearch x5-10
│
├── External (mmbridge detected, depth medium+)
│   └── mmbridge research --type code-aware
│
└── Analyst Merge
    ├── Internal findings + mmbridge findings
    ├── Gap analysis
    └── Writer synthesis → Research Brief
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: update architecture for mmbridge full integration (Phase 1)"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Verify all files are consistent**

Run: `grep -r "mmbridge-integration.md" skills/ references/ docs/ --include="*.md" -l`
Expected: All skills that use mmbridge reference the common layer

- [ ] **Step 2: Verify no broken internal references**

Run: `grep -rn "references/mmbridge" skills/ docs/ --include="*.md"`
Expected: All paths point to `references/mmbridge-integration.md` (exists)

- [ ] **Step 3: Verify mmbridge CLI help matches our usage**

Run:
```bash
mmbridge research --help 2>&1 | grep -E "type|stream|export"
mmbridge security --help 2>&1 | grep -E "scope|compliance|stream|export"
mmbridge gate --help 2>&1 | grep -E "mode|format"
```
Expected: All flags we use are present in CLI help

- [ ] **Step 4: Final commit with all changes**

```bash
git status
git diff --stat
```

Verify 6 files changed, then create a summary commit if needed:
```bash
git add -A
git commit -m "feat: mmbridge full integration Phase 1 — research, security, gate

Integrate three mmbridge CLI commands into the PDCA pipeline:
- research: multi-model parallel research in Plan phase
- security: CWE-classified security audit preset in Check phase
- gate: advisory coverage check at Check→Act transition

Common layer (references/mmbridge-integration.md) provides shared
detection, invocation, and error handling rules.

All integrations are mmbridge-first (auto-detect) with graceful
fallback to internal-only when mmbridge is not installed."
```

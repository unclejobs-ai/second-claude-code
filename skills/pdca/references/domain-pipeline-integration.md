---
name: domain-pipeline-integration
description: "Standardized pattern for how PDCA's Do phase dispatches domain sub-skills (/threads, /newsletter, /academy-shorts, /card-news), including input contracts, output contracts, failure handling, and integration points"
---

# Domain Pipeline Integration

How PDCA's Do phase dispatches and wraps specialized domain sub-skills.

## Architecture Position

```
PDCA Cycle (orchestrator, always running)
  └── Do Phase
        └── Sub-Skill Dispatcher (this document's scope)
              ├── /threads          (8 internal phases)
              ├── /newsletter       (7 internal phases)
              ├── /academy-shorts   (multi-phase)
              ├── /card-news        (template + render)
              └── /scc:write        (generic fallback)
```

PDCA's Do phase **never executes the artifact write itself**. It always dispatches one sub-skill. The sub-skill owns the multi-phase work that produces the artifact, then returns control to PDCA with a standardized `DoOutput` schema.

## Why This Layer Exists

Three reasons:

1. **Each domain has its own gates** that PDCA cannot enforce directly. `/threads` enforces voice-guide rules (어미 분산, hyphen count, Tier 1 vocabulary). `/newsletter` enforces topic count and section structure. PDCA's generic Do gate cannot know these.

2. **Each domain has its own internal pipeline** that PDCA should not duplicate. `/threads` has a researcher → copywriter → editor → cross-reviewer → proofreader → publisher chain. PDCA running its own version of these would be redundant and produce conflicting outputs.

3. **PDCA still needs to wrap with Plan + Check + Act** because sub-skills don't have those phases (or have weaker versions). PDCA's value is the wrapping, not the inner work.

## Sub-Skill Selection

When PDCA enters the Do phase, the dispatcher runs this algorithm:

```
1. Read user prompt + Plan output `dod` field
2. Score each candidate sub-skill against detected format keywords
3. Pick the most specialized sub-skill that has score >= 1
4. If no specialized match, fall back to /scc:write
```

### Specialized Sub-Skill Matchers

| Sub-Skill | Match Keywords (Korean + English) | Match Strength |
|-----------|-----------------------------------|----------------|
| `/threads` | "스레드", "threads", "@unclejobs.ai", "스레드 만들어", "threads 시리즈", "스레드로 변환" | High (any 1 keyword = match) |
| `/newsletter` | "뉴스레터", "newsletter", "주간 뉴스레터", "한국어 테크 뉴스레터", "Beehiiv" | High |
| `/academy-shorts` | "쇼츠", "shorts", "릴스", "Reels", "9:16", "60초 영상", "academy shorts", "숏폼", "academy-shorts" | High |
| `/card-news` | "카드뉴스", "card news", "인스타 카드", "캐러셀", "carousel", "card-news" | High |
| `/scc:write` (default) | (no specialized match) | Fallback |

### Match Algorithm Details

- **Greedy matching**: pick the most specialized sub-skill, never the generic one when a specialized one fits.
- **Single-keyword sufficiency**: even one matching keyword is enough — the user usually doesn't repeat themselves.
- **Conflict resolution**: if two specialized sub-skills both match (rare), prefer the one whose keyword appeared earlier in the user prompt. If still tied, prefer the one whose internal pipeline has more phases (more rigor).
- **Override**: user can force a sub-skill with `--sub-skill /threads` flag if auto-detection picks the wrong one.

## Standard Dispatch Pattern

Every sub-skill is dispatched with the same structural pattern:

```
PDCA Do Phase
│
├── 1. Pre-flight check
│      - Verify Plan artifacts exist (research_brief_path, analysis_path)
│      - Confirm sub-skill is available (file exists, permissions OK)
│      - Set worktree to worktree-pdca-do
│
├── 2. Construct sub-skill invocation
│      - Pass research_brief_path as primary input
│      - Pass analysis_path as secondary context
│      - Pass dod[] as constraints
│      - Pass any --constraints from prior Act → Do return
│      - Pass --skip-research --skip-review (PDCA owns those phases)
│
├── 3. Dispatch
│      - Call /sub-skill with constructed invocation
│      - Wait for completion (foreground for sequential gates)
│      - Sub-skill runs its own internal phases inside this dispatch
│
├── 4. Validate output
│      - Read returned DoOutput object
│      - Compute char_count, section_count, references_count from artifact file
│      - Compute meets_length_floor by looking up format in do-phase.md table
│      - Compute meets_section_floor by same lookup
│      - All booleans must be true; numeric counts must meet floors
│
└── 5. Pass to Check or fail Do gate
       - Pass: write DoOutput to pdca-active.json, transition to Check
       - Fail: discard worktree, surface failure to user, optionally retry sub-skill
```

## Sub-Skill Input Contract

PDCA passes the same structured input to every sub-skill:

```json
{
  "topic": "string (from PDCA state)",
  "research_brief_path": "string (.captures/ path from Plan)",
  "analysis_path": "string (.captures/ path from Plan)",
  "dod": ["string (Definition of Done criteria)"],
  "constraints": ["string (from prior Act → Do return, may be empty)"],
  "format_target": "string (one of: threads|newsletter|article|shorts|card-news|...)",
  "length_floor": "number (computed from format → length floor table)",
  "section_floor": "number (computed from format → length floor table)",
  "skip_research": true,
  "skip_review": true,
  "worktree": "worktree-pdca-do"
}
```

### Why Sub-Skills Get `skip_research` and `skip_review`

PDCA's Plan phase already gathered research. PDCA's Check phase will run the review. If the sub-skill runs its own research and review again, that's:

- Duplicated cost (research is the most expensive phase)
- Conflicting outputs (sub-skill research might disagree with Plan research)
- Phase boundary violation (sub-skill is doing Plan and Check work)

Sub-skills must accept these flags. If a sub-skill cannot honor `skip_research`, log a warning and let it run anyway, but PDCA's Plan output takes precedence on disagreement.

## Sub-Skill Output Contract

Every sub-skill must return a `DoOutput` object conforming to `references/phase-schemas.md`:

```json
{
  "artifact_path": "string (must be a real file)",
  "format": "string (must match format_target from input)",
  "char_count": "number (body only)",
  "section_count": "number (H2 or bold sections)",
  "meets_length_floor": "boolean",
  "meets_section_floor": "boolean",
  "plan_findings_integrated": "boolean",
  "sections_complete": "boolean",
  "references_count": "number (>= 3)"
}
```

### How PDCA Verifies the Output

PDCA does NOT trust the sub-skill's self-reported numbers. It verifies independently:

1. **artifact_path**: PDCA reads the file. If missing → Do gate fails immediately.
2. **char_count**: PDCA counts UTF-8 characters of the body (excluding frontmatter and references section). Compare with sub-skill's reported number — discrepancy is logged but PDCA's count wins.
3. **section_count**: PDCA counts H2 headings + bold-marked section headers. Same discrepancy handling.
4. **meets_length_floor / meets_section_floor**: PDCA computes these from its own counts vs the format's floor table. Sub-skill's self-report is ignored.
5. **references_count**: PDCA counts distinct URLs in the artifact's references/footnotes section.

This prevents sub-skills from gaming the gate by reporting inflated numbers.

## Sub-Skill-Specific Notes

### `/threads` Integration

`/threads` has 8 internal phases that map to PDCA's Do phase:

| /threads internal phase | PDCA Do phase responsibility |
|------------------------|------------------------------|
| 1. Parse | PDCA already provided research_brief_path; /threads skips re-parsing |
| 2. Research | Skipped (PDCA already did research in Plan) |
| 3. Draft | Runs (sub-skill executes draft from PDCA's research) |
| 4. Edit | Runs (sub-skill's internal voice/structure check) |
| 5. Cross-Review | Runs (sub-skill's internal MMBridge review) |
| 6. Proofread | Runs (sub-skill's spelling/format check) |
| 7. Final QA | Runs (sub-skill's checklist pass) |
| 8. Publish | Optional (only if PDCA's `--publish` flag is set) |

After /threads completes its phases 3-7, PDCA's Check phase still runs an independent review. The sub-skill's Phase 5 cross-review is **not redundant** with PDCA's Check — they catch different things. Sub-skill cross-review is voice-focused; PDCA Check is multi-perspective with external models.

### `/newsletter` Integration

Similar pattern — `/newsletter` has 7 phases, of which Research is skipped because PDCA's Plan provides it. Newsletter publishing (Notion/Beehiiv) only runs if PDCA's `--publish` flag is set.

### `/academy-shorts` Integration

Shorts pipeline phases: research → script → editor → MMBridge review. Research is skipped (PDCA owns it). The script + editor phases run inside PDCA's Do. PDCA's Check still runs independently because shorts MMBridge review focuses on narrative structure, while PDCA Check looks at fact accuracy and reader value.

### `/card-news` Integration

Card news has fewer internal phases — it's mostly template + render. PDCA's Do phase dispatches `/card-news`, which fills the template using research data and renders via Playwright. PDCA's Check then evaluates the rendered output for visual + content quality.

### `/scc:write` (Generic Fallback) Integration

When no specialized sub-skill matches, PDCA dispatches `/scc:write` directly. `/scc:write` is a thinner sub-skill — it just produces the artifact from research, without internal review or publishing. PDCA's Check phase becomes more important in this case because there's no sub-skill internal review to catch issues.

## Failure Handling

When a sub-skill fails (errors, hangs, returns invalid output, returns artifact below floor):

### Failure Mode 1: Sub-Skill Errors Out

```
Action:
1. Log: sub-skill name + input + error message + timestamp
2. Discard worktree-pdca-do
3. Try fallback: /scc:write with explicit format spec from sub-skill's template directory
4. If fallback succeeds → continue to Check
5. If fallback also fails → surface to user as "Do phase failed; manual intervention needed"
```

### Failure Mode 2: Sub-Skill Returns Below-Floor Artifact

```
Action:
1. Read sub-skill's actual output for analysis
2. Identify which Plan findings were not adequately developed
3. Re-dispatch sub-skill with explicit expansion instructions (see Writer Instruction Pattern in do-phase.md)
4. Maximum 2 retries; on 3rd failure, escalate to /scc:write fallback
```

### Failure Mode 3: Sub-Skill Returns Invalid Output Format

```
Action:
1. Log the malformed output structure
2. Try to parse what's recoverable
3. If artifact_path is present and file exists → use it; PDCA computes other fields itself
4. If artifact_path is missing → re-dispatch sub-skill with explicit output format reminder
```

### Failure Mode 4: Sub-Skill Hangs or Times Out

```
Action:
1. Set 10-minute timeout per sub-skill dispatch
2. On timeout: kill the sub-skill, log the timeout
3. Try fallback: /scc:write
4. Surface timeout to user — long-running sub-skills usually indicate infinite loops or stuck research calls
```

## Integration Points with Other PDCA Phases

### Plan → Do Handoff

Plan must produce a brief that the dispatched sub-skill can consume. Sub-skill specialized formats may need additional Plan output:

- `/threads` needs: Korean voice-friendly facts, source URLs, media inventory, comparison data
- `/newsletter` needs: 5+ topics with separate sub-briefs per topic
- `/academy-shorts` needs: scene-friendly structure (visual moments, narrative beats)
- `/card-news` needs: card-by-card structure (hook → 6-8 facts → CTA)

Plan phase should detect the upcoming sub-skill (using the same matcher as Do) and produce a brief tailored to it. If Plan produces a generic brief and Do dispatches `/threads`, the brief may lack the Korean voice signals or media inventory that `/threads` needs.

### Do → Check Handoff

After sub-skill completes, PDCA's Check phase runs independently. It does NOT re-use the sub-skill's internal review output. Check is a fresh pass with parallel reviewers (see `references/check-phase.md` for diversity rules).

### Check → Act Routing After Sub-Skill Output

The Action Router treats sub-skill output the same as any Do output. If Check finds issues:

- SOURCE_GAP, ASSUMPTION_ERROR → Plan re-runs (sub-skill is not re-dispatched yet)
- COMPLETENESS_GAP, FORMAT_VIOLATION → Sub-skill is **re-dispatched in a fresh Do phase** with the findings as constraints
- EXECUTION_QUALITY → Refine runs (which may or may not be sub-skill specific)

5+ Rule still applies: if 5+ P0/P1 findings exist, the sub-skill is re-dispatched with a full rewrite mandate, not patch-by-patch fixes.

## Versioning and Sub-Skill Compatibility

Sub-skills are versioned independently of PDCA. PDCA's Do dispatcher should:

1. Check sub-skill version compatibility at dispatch time
2. Log the version of each sub-skill it dispatches
3. Warn user if a sub-skill version is older than PDCA expects (may not honor input contract)
4. Surface incompatibility errors loudly (no silent fallback to broken behavior)

## Summary

PDCA's Do phase is a thin dispatcher. The work happens inside specialized sub-skills. PDCA's value is the wrapping (Plan + Check + Act) and the contract enforcement (length floors, source counts, diversity rules). Sub-skills are the building blocks; PDCA is the orchestrator that ensures they're called in the right order with the right inputs and validated outputs.

This separation lets:

- Sub-skills evolve independently (new domains can be added without changing PDCA)
- PDCA evolve independently (better gates can be added without rewriting sub-skills)
- Users invoke a single command (`/scc:pdca`) and get the right sub-skill auto-selected
- The orchestrator stay accountable for the cross-cutting quality gates while sub-skills stay focused on their domain

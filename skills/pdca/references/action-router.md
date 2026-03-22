# Action Router — Act Phase

The Action Router classifies review findings by root cause and routes to the appropriate phase.
This replaces the previous flat "loop everything" approach with intelligent triage.

## Classification Matrix

| Category | Signal Keywords | Route |
|----------|----------------|-------|
| `SOURCE_GAP` | "missing data", "unsupported claim", "no evidence", "needs citation", "출처 없음", "근거 부족", "데이터 누락", "증거 불충분" | PLAN |
| `ASSUMPTION_ERROR` | "wrong premise", "flawed assumption", "incorrect basis", "전제 오류", "잘못된 가정", "관점 편향" | PLAN |
| `FRAMEWORK_MISMATCH` | "wrong approach", "format doesn't fit", "methodology mismatch", "프레임워크 부적합" | PLAN |
| `COMPLETENESS_GAP` | "missing section", "incomplete", "too short", "gaps in coverage" | DO |
| `FORMAT_VIOLATION` | "wrong format", "tone mismatch", "style inconsistent", "톤 불일치" | DO |
| `EXECUTION_QUALITY` | "weak argument", "unclear", "could be better", "needs polish", "표현력 부족", "문체 불일치", "구조 혼란", "가독성 낮음" | LOOP |

## Classification Algorithm

1. Extract all Critical and Major findings from the review report
2. Classify each finding using signal keyword matching
3. Tally categories:
   - `PLAN_ISSUES` = SOURCE_GAP + ASSUMPTION_ERROR + FRAMEWORK_MISMATCH
   - `DO_ISSUES` = COMPLETENESS_GAP + FORMAT_VIOLATION
   - `LOOP_ISSUES` = EXECUTION_QUALITY
4. Normalize tallies to percentages (e.g., 3 PLAN + 2 DO + 1 LOOP = 50%/33%/17%)
5. Route by **plurality** (highest percentage wins):
   - PLAN_ISSUES is highest → **route to PLAN**
   - DO_ISSUES is highest → **route to DO**
   - LOOP_ISSUES is highest → **route to LOOP**
6. Near-tie (top two within 5 percentage points) → **ask user** (2 questions max)
7. If user doesn't respond to tie-breaker → route to highest-count category (never default to LOOP blindly)
8. **Exact tie** (two or three categories identical) → **PLAN > DO > LOOP** (most conservative route wins — research gaps cause the deepest rework, so surface them first)

## Route Actions

### Route to PLAN

1. Snapshot current artifact as `{filename}-v{N}.md`
2. Extract specific research gaps from findings
3. Formulate targeted research questions
4. Re-enter Plan phase with gap-focused research
5. Update PDCA state: `current_phase: "plan"`, increment `cycle_count`

### Route to DO

1. Compile review findings as constraints list
2. Pass constraints to write/analyze skill
3. Re-execute Do phase: `/scc:write --skip-research --skip-review --constraints {findings}`
4. Skip Plan (research is sufficient) and proceed to Check after Do

### Route to LOOP

1. Standard behavior — dispatch `/scc:loop --file {artifact} --review {report}`
2. Loop handles iterative fix-review cycles internally
3. Exit when target verdict reached or max iterations hit

## Ambiguous Classification

When the top two categories are within 5 percentage points of each other (near-tie):

1. Present the distribution to user:
   ```
   Findings breakdown:
   - Plan issues (source/assumption/framework): 38%
   - Do issues (completeness/format): 25%
   - Loop issues (execution quality): 37%

   Top two are close. Where should we focus? (a) More research (b) Polish existing
   ```
2. Maximum 2 questions for disambiguation
3. If no response: route to the highest-count category (not a blind LOOP default)
4. On exact tie: apply tiebreaker order **PLAN > DO > LOOP** (most conservative wins)

When there is a clear plurality winner (>5pt gap): route directly, no questions needed.

## Confidence Threshold

"Keyword match count" = number of unique keywords matched for the top-scoring category.

Keyword matching confidence affects routing decisiveness:

- **1 keyword match** (low confidence): treat as a near-tie regardless of percentage gap — route through the user-ask path (present breakdown, ask for direction, max 2 questions). **Exception**: if the top category advantage is 15+ percentage points over the next highest, route directly without asking.
- **2 keyword matches** (medium confidence): apply normal near-tie rule (ask only if top two are within 5 percentage points).
- **3+ keyword matches** (high confidence): route directly without asking, even if the gap is narrow (i.e., within 5 percentage points — see near-tie threshold above).

> **Integration note**: This confidence check runs as step 5a, between step 5 (multi-category routing) and step 6 (narrow gap handling).

## Iteration Ceiling

| Verdict | Max Cycles | Escalation |
|---------|-----------|------------|
| MINOR FIXES | 1 loop iteration | If not resolved → DO |
| NEEDS IMPROVEMENT | 3 loop iterations | If stuck → PLAN |
| MUST FIX | 5 loop iterations | If stuck → STOP + diagnose |

When iteration ceiling is hit without progress:
- STOP the cycle
- Present diagnosis with root cause classification
- Recommend: "The problem may be in Plan (insufficient research) or Do (wrong format/approach)"

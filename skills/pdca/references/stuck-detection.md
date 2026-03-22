# Stuck Detection — PDCA Behavioral Loop Patterns

Pattern-based detection for PDCA agents stuck in unproductive cycles.
Counter-based limits (`max_cycles`) catch total-cycle overflow; these patterns
catch specific behavioral loops that cycle counting alone cannot detect.

---

## When to Check

Run the stuck-detection check at **every phase transition**:

- Before entering Do (catches Plan Churn)
- Before entering Check (catches Check Avoidance)
- Before entering Act (catches Scope Creep)

Store the detection result in `pdca-active.json` under `stuck_flags[]`.
Do NOT re-evaluate a flag that was already raised and acted on in the same run.

---

## Pattern 1: Plan Churn

**Definition**: The agent rewrites or re-runs the Plan phase 3 or more times
without the run ever entering the Do phase.

### Detection Criteria

All of the following must be true:

1. `cycle_count >= 3` — Plan has been entered multiple times
2. `"do"` is NOT present in `completed[]` — Do has never started
3. `current_phase == "plan"` — Still cycling inside Plan

### Signal in State

```json
{
  "cycle_count": 3,
  "completed": ["plan", "plan", "plan"],
  "current_phase": "plan"
}
```

`completed[]` may alternatively show repeated `"plan"` entries; the key
discriminator is the absence of `"do"`.

### Root Causes

- User feedback loop: user rejects Plan Mode briefing repeatedly without
  giving actionable direction
- Research perfectionism: agent keeps re-running research for small gaps
  rather than documenting them as known unknowns and proceeding
- Scope instability: each Plan cycle redefines the topic, preventing
  commitment to any version

### Remediation Action

1. **Emit a stuck alert** to the user:
   ```
   Plan has been revised {cycle_count} times without entering Do.
   Current plan will be used as-is. Uncertainty is documented below.
   ```
2. **Force transition to Do** using the current Plan artifacts — do NOT
   trigger another Plan re-run.
3. **Append uncertainty note** to the Do phase context:
   ```
   Note: Plan went through {cycle_count} revisions. The following areas
   remain uncertain: {list gaps from last Plan artifacts}.
   These should be flagged for review in the Check phase.
   ```
4. Update state: set `stuck_flags: ["plan_churn"]`.

---

## Pattern 2: Check Avoidance

**Definition**: The agent completes the Do phase but attempts to skip or
minimise the Check phase — going directly to Act or declaring completion
without running a proper review.

### Detection Criteria

Trigger when ANY of the following is true immediately after Do completion:

1. `"do"` is in `completed[]` AND the agent proposes routing to Act without
   setting `gates.do_to_check: "passed"` — Check was bypassed entirely.
2. `"do"` is in `completed[]` AND `gates.do_to_check == "passed"` but
   `artifacts.check_report` is null or empty — Check produced no output.
3. Agent output after Do contains phrases like "looks good", "no review
   needed", "skipping check", "proceeding to Act" before a review was
   dispatched.

### Signal in State

```json
{
  "completed": ["plan", "do"],
  "current_phase": "act",
  "gates": {
    "do_to_check": "passed"
  },
  "artifacts": {
    "check_report": null
  }
}
```

`check_report` being null while `do_to_check` is marked passed is the
clearest signal.

### Root Causes

- Agent misidentifies the artifact quality as "obviously good" and tries to
  skip verification
- Act phase was invoked directly via `--phase act` without a prior Check run
- Loop skill returned APPROVED internally and the orchestrator skipped the
  full review dispatch

### Remediation Action

1. **Block the Act transition** — do not proceed.
2. **Emit a stuck alert**:
   ```
   Check phase was skipped or produced no output.
   A full review is required before Act can proceed.
   ```
3. **Inject the Plan's DoD** (Definition of Done) as a verification
   checklist. The DoD is derived from the Plan phase gate checklist in
   `references/plan-phase.md` plus any explicit success criteria stated in
   the original user prompt.
   ```
   Verification checklist (from Plan DoD):
   - [ ] {criterion 1 from Plan}
   - [ ] {criterion 2 from Plan}
   - [ ] All Do→Check gate items in do-phase.md
   ```
4. **Require review dispatch**: Run `/second-claude-code:review` with the
   appropriate preset before allowing Act to start.
5. Update state: set `stuck_flags: ["check_avoidance"]`.

---

## Pattern 3: Scope Creep

**Definition**: The files and artifacts produced during the Do phase diverge
significantly from the scope the Plan phase committed to.

### Detection Criteria

Trigger when ALL of the following are true at the Do→Check gate:

1. `"do"` is in `completed[]` — Do has completed.
2. The Do artifact path(s) or the file-change set produced during Do do NOT
   match the scope defined in the Plan phase output (Research Brief +
   Analysis artifact scope section).
3. The divergence is significant — at least one of:
   - Do artifact covers a topic area not mentioned in Plan
   - Do artifact omits a major section the Plan explicitly called for
   - Additional files were produced that were not part of the planned scope

### Signal Comparison

Collect at Do→Check gate:

```
Planned scope (from Plan artifacts):
  - Expected output: {artifact type, sections, topics}
  - Stated constraints: {from Question Protocol or Plan Mode approval}

Actual scope (from Do phase output):
  - Produced: {artifact path, observed sections, topics covered}
  - Additions: {anything not in Plan}
  - Omissions: {anything from Plan not produced}
```

### Root Causes

- Do phase skill received vague context and filled gaps with out-of-scope
  material
- Scope grew during Do as the agent explored related topics
- Act→Do return introduced new constraints that superseded Plan without
  triggering a Plan revision

### Remediation Action

1. **Alert the user** with a side-by-side comparison. Do NOT silently proceed.
   ```
   Scope divergence detected between Plan and Do output.

   Planned: {planned scope summary}
   Produced: {actual scope summary}

   Additions (not in Plan): {list}
   Omissions (in Plan, not produced): {list}
   ```
2. Present two options to the user:
   - **Accept divergence** — update Plan artifacts to reflect the new scope
     and proceed to Check (Check reviewers will evaluate the actual artifact,
     not the original scope)
   - **Revert to Plan scope** — re-run Do with explicit scope constraints
     derived from the Plan artifacts
3. Do NOT proceed to Check until the user chooses an option or the system
   auto-routes after 1 minute with no response (auto-route: accept
   divergence, log it as a note in the Check context).
4. Update state: set `stuck_flags: ["scope_creep"]`, record the comparison
   under `scope_creep_detail`.

---

## Decision Tree for the PDCA Orchestrator

```
At each phase transition, evaluate:

TRANSITION: entering Do
  └─ Is cycle_count >= 3 AND "do" not in completed[]?
       YES → Plan Churn detected → force Do with current plan + uncertainty note
       NO  → proceed normally

TRANSITION: entering Check (after Do completes)
  └─ Is "do" in completed[] AND check_report is null?
       YES → Check Avoidance detected → inject DoD checklist, require review dispatch
       NO  → proceed normally

TRANSITION: entering Check (gate evaluation)
  └─ Does Do artifact scope match Plan scope?
       NO (significant divergence) → Scope Creep detected → alert user, wait for choice
       YES → proceed normally

TRANSITION: entering Act
  └─ Was check_report populated by a real review dispatch?
       NO → Check Avoidance (late catch) → block, require review
       YES → proceed normally
```

---

## State Schema Extension

Add to `pdca-active.json`:

```json
{
  "stuck_flags": [],
  "scope_creep_detail": {
    "planned_scope": null,
    "actual_scope": null,
    "additions": [],
    "omissions": []
  }
}
```

`stuck_flags` values: `"plan_churn"`, `"check_avoidance"`, `"scope_creep"`

A flag is set once per run. Repeated occurrences of the same pattern in the
same run are noted in orchestrator output but do not overwrite the flag.

---

## Interaction with `max_cycles`

`max_cycles` is a hard ceiling on total cycles — it fires when the run has
consumed too many full PDCA loops regardless of pattern.

Stuck detection patterns fire earlier and target specific behaviors:

| Trigger | Scope | When It Fires |
|---------|-------|---------------|
| `max_cycles` | Total cycle count | At Act→Plan or Act→Do routing |
| Plan Churn | Plan re-runs only | At Do entry, before Do starts |
| Check Avoidance | Do→Check boundary | At Check entry or Do→Act attempt |
| Scope Creep | Do output vs. Plan | At Do→Check gate evaluation |

Both mechanisms may fire in the same run. If both `max_cycles` and a stuck
pattern trigger simultaneously, report both and exit with the best artifact.

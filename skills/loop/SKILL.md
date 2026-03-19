---
name: loop
description: "Iterative improvement engine — repeat until quality target met"
---

# Loop

Keep improving a file or document through repeated review-fix cycles until it meets a quality target. Automatically calls `/scc:review` each iteration to score and provide feedback.

## When to Use

- A draft exists but is not yet good enough
- User wants to polish content to a specific quality bar
- Another skill (e.g., `/scc:write`) produced output that needs iterative refinement

## Internal Flow

```
read current state ──► /scc:review ──► score + feedback
                            │
                    ┌───────┴───────┐
                    │               │
              score improved?   score NOT improved?
                    │               │
              new baseline       revert to baseline
                    │               │
                    └───────┬───────┘
                            │
                    target met? ──YES──► done (output final + log)
                            │
                           NO
                            │
                    next iteration
```

### Step-by-Step

1. **Read current state**: Load the target file. Compute baseline hash for safe revert.
2. **Review**: Dispatch `/scc:review` against current content. Receive numeric score + ranked feedback items.
3. **Edit**: Dispatch editor (opus model) to apply fixes. Limit to top-3 feedback items per iteration -- more causes regression.
4. **Compare**: Run `/scc:review` again on edited version. If score improved, accept as new baseline. If not, revert via git (not memory).
5. **Check target**: If target condition is met, stop and output final version. Otherwise, continue to next iteration.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--max` | `1-10` | `3` | Maximum iteration count. Always enforced as ceiling. |
| `--target` | `"condition"` | `/scc:review APPROVED` | Stop condition. Can be a score threshold (e.g., `"4.5+"`) or review verdict. |
| `--promise` | `"text"` | none | Ralph-style completion promise displayed at end (e.g., "This newsletter is ready to send"). |

## State Management

Loop state persists to `${CLAUDE_PLUGIN_DATA}/state/loop-active.json`:

```json
{
  "goal": "Polish newsletter draft to 4.5+",
  "file": "output/newsletter-2026-03-19.md",
  "current_iteration": 2,
  "max": 3,
  "scores": [3.8, 4.1],
  "baseline_hash": "a3f9c2e",
  "feedback_log": [
    {"iteration": 1, "top_items": ["weak intro hook", "missing CTA", "inconsistent tone"]},
    {"iteration": 2, "top_items": ["CTA still vague", "paragraph 3 too long"]}
  ],
  "started_at": "2026-03-19T14:30:00Z"
}
```

### HANDOFF Pattern

If a session ends mid-loop, state file persists on disk. Next session detects `loop-active.json`, displays progress summary, and resumes from the last completed iteration. No work is lost.

## Output

Final version of the file plus an iteration log:

```
## Loop Complete: 3 iterations

| Iteration | Score | Delta | Top Changes |
|-----------|-------|-------|-------------|
| 0 (start) | 3.2   | --    | (baseline)  |
| 1         | 3.8   | +0.6  | Tightened intro, added CTA |
| 2         | 4.1   | +0.3  | Restructured paragraph 3 |
| 3         | 4.6   | +0.5  | Polished transitions, fixed tone |

Target met: score 4.5+ (actual: 4.6)
Promise: "This newsletter is ready to send"
```

## Gotchas

These failure modes are common. The skill design explicitly counters each one.

| Failure Mode | Mitigation |
|-------------|------------|
| Declares "improved" without evidence | Every iteration requires both a diff and a score comparison. No subjective claims accepted. |
| Too many changes per iteration | Editor limited to top-3 feedback items. Smaller edits are easier to evaluate and revert. |
| Reverts using memory instead of git | All reverts use `git checkout -- {file}` to restore baseline hash. Memory-based "undo" is unreliable. |
| Loop runs forever | `--max` is always enforced. Default ceiling is 3. Maximum allowed value is 10. |
| Score plateaus but target not met | After 2 consecutive iterations with delta < 0.1, stop early and report plateau. |
| First iteration makes content worse | If iteration 1 score drops, revert immediately and try a different approach (address different feedback items). |

## Patterns Absorbed

- **Karpathy autoresearch**: 5-minute timebox per round, keep/discard decision based on measurable improvement
- **Ralph Loop**: Completion-promise pattern -- declare what "done" means before starting
- **Ars Contexta Reweave**: Iterative refinement with structured feedback integration
- **Tw93 HANDOFF.md**: Session-persistent state for resumable long-running tasks

## Subagent Dispatch

```yaml
reviewer:
  skill: /scc:review
  constraint: "must return numeric score + ranked feedback list"

editor:
  model: opus
  tools: [Read, Edit]
  constraint: "apply only top-3 feedback items per iteration, produce clean diff"
```

## Integration

- Called by `/scc:pipeline` as a refinement step
- Calls `/scc:review` internally each iteration
- Works on any file type that `/scc:review` can evaluate

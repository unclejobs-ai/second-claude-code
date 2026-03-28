# acpx Fan-Out Contract

Date: 2026-03-28
Status: adopted
Scope: Hermes-operated multi-agent coding via acpx CLI

## Purpose

Define how Hermes uses acpx to run parallel coding agents (Codex, Claude Code, Gemini CLI)
against this repository, and how results feed into the existing mmbridge quality pipeline.

## Architecture

```
Hermes (orchestrator)
  |
  +-- terminal/process (launcher)
  |     |
  |     +-- acpx codex exec "implement"   [WRITE]  --approve-all
  |     +-- acpx claude exec "review"     [READ]   --approve-reads
  |     +-- acpx gemini exec "docs/risk"  [READ]   --approve-reads
  |
  +-- mmbridge review --json              [GATE]   quality evaluation
  |
  +-- Hermes reads all results -> decide next action
```

## Role Definitions

| Role | Agent | Permission | Output |
|------|-------|-----------|--------|
| impl | codex (via acpx) | --approve-all | Code changes + commits |
| review | claude (via acpx) | --approve-reads | Bug report / analysis |
| docs | gemini (via acpx) | --approve-reads | Diff summary, edge cases, migration notes |
| gate | mmbridge (direct) | read-only | Quality score, findings, nextCommand |

## Critical Rules

1. **Single-writer principle**: Only ONE agent (impl) gets write permission per fan-out run.
2. **No auto-merge**: Hermes reads summaries and decides. Never auto-apply patches from review/docs agents.
3. **Worktree for parallel writes**: If two impl tasks run simultaneously, each gets its own git worktree.
4. **mmbridge gates the result**: After impl completes, mmbridge review runs. If findings are P0/P1, loop back to impl.
5. **Hermes is NOT a runtime dependency**: This contract is consumed by Hermes skills, not by the plugin core.

## Session Naming

- One-shot: `acpx <agent> exec "prompt"` (no session management needed)
- Persistent: `acpx <agent> -s <taskSlug>-<role> "prompt"`
- Example: `acpx codex -s auth-impl "implement authentication module"`

## Failure Policy

- **impl fails**: Log error, do not proceed to review. Report to Hermes for human decision.
- **review fails**: Use mmbridge as fallback gate. Log degraded coverage.
- **docs fails**: Acceptable degradation. Proceed without docs summary.
- **mmbridge fails**: Block merge. Quality gate must pass.
- **Timeout**: Default 300s per agent. If exceeded, kill and report partial results.

## Result Artifacts

Each fan-out run produces:
- Git commits (from impl agent only)
- stdout/stderr logs (from all agents, captured by Hermes process tool)
- mmbridge review JSON (quality score + findings)
- Hermes synthesis (summary + next action decision)

No separate artifact directory is created. Results live in Hermes process logs and mmbridge session storage.

## Prompt Templates

### impl (codex)
```
CONTEXT: You are implementing in '{repo}' — {description}.
TASK: {task_description}
RULES:
- Write code, add tests, run tests, commit when done
- Follow existing code conventions
- Do NOT modify test expectations to match buggy code
- Run the full test suite before committing
```

### review (claude)
```
CONTEXT: You are reviewing '{repo}' — {description}.
TASK: Review recent changes for bugs, security issues, and design problems.
RULES:
- Do NOT modify any files
- Report findings with file:line citations
- Classify as P0 (blocker), P1 (significant), P2 (minor)
- Focus on correctness, security, and missing edge cases
```

### docs (gemini)
```
CONTEXT: You are analyzing '{repo}' — {description}.
TASK: Summarize recent diffs. List edge cases, migration risks, breaking changes.
RULES:
- Do NOT modify any files
- Focus on what changed and what could break
- List concrete risks, not generic advice
```

## Integration with Existing Systems

- **PDCA cycle**: acpx fan-out maps to the "Do" phase. mmbridge review maps to "Check".
- **consensus-gate**: mmbridge gate check can substitute for PDCA consensus.
- **mmbridge memory**: Review history is automatically indexed by mmbridge.
- **Hermes memory**: Hermes saves durable learnings from fan-out results to its own memory.

## Boundary

This contract does NOT:
- Add Hermes as a runtime dependency to the plugin
- Modify plugin.json, hooks, or commands
- Create new npm dependencies
- Replace mmbridge with acpx for review tasks
- Auto-merge anything

This contract DOES:
- Define how Hermes calls acpx from terminal
- Define role separation for parallel agents
- Define how mmbridge gates the results
- Provide prompt templates for each role

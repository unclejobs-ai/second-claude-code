# Agent Catalog — Future Extension Notes

17 job-labeled agents. Filenames may stay Pokemon. Dispatch uses frontmatter `name`. See `agents/README.md`.

## Current Agents (17)

| Agent | File | Model | Role |
|-------|---------|-------|------|
| researcher | eevee | sonnet | Web search, source gathering |
| analyst | alakazam | sonnet | Data extraction, pattern recognition |
| strategist | mewtwo | sonnet | Framework application |
| writer | smeargle | opus | Content production |
| editor | ditto | opus | Content refinement |
| deep-reviewer | xatu | opus | Logic, structure, completeness review |
| devil-advocate | absol | sonnet | Weak points, blind spots |
| fact-checker | porygon | sonnet | Claims, numbers, source verification |
| tone-guardian | jigglypuff | sonnet | Voice and audience fit |
| structure-analyst | unown | sonnet | Organization and readability |
| pipeline-orchestrator | arceus | sonnet | Pipeline orchestration |
| pipeline-step-executor | machamp | sonnet | Single pipeline step execution |
| skill-searcher | noctowl | haiku | External source search |
| skill-inspector | magnezone | sonnet | Skill candidate inspection |
| skill-evaluator | deoxys | sonnet | Skill candidate scoring |
| knowledge-connector | abra | haiku | Knowledge linking |
| soul-keeper | pikachu | opus | Persistent user identity synthesis |

## Potential Extensions

These roles are documented as reference for users who want to customize their agent roster. Each maps to a real workflow need observed in production multi-agent systems.

### Code-Focused

| Agent | Suggested Model | Role | When to Add |
|-------|----------------|------|-------------|
| `executor` | sonnet | Implementation, refactoring | When using scc for code workflows |
| `debugger` | sonnet | Root-cause analysis, failure diagnosis | When adding debugging skills |
| `test-engineer` | sonnet | Test strategy, coverage analysis | When adding TDD skills |
| `security-reviewer` | sonnet | Vulnerability scanning, trust boundaries | When security review is needed |

### Design & UX

| Agent | Suggested Model | Role | When to Add |
|-------|----------------|------|-------------|
| `designer` | sonnet | UI/UX patterns, interaction design | When adding design review skills |
| `visual-reviewer` | sonnet | Screenshot comparison, layout validation | When visual QA is needed |

### Operations

| Agent | Suggested Model | Role | When to Add |
|-------|----------------|------|-------------|
| `verifier` | haiku | Completion validation, evidence collection | When adding automated verification |
| `tracer` | haiku | Execution event logging, audit trails | When adding observability |
| `git-master` | haiku | Branch management, merge strategy | When adding git workflow skills |

### Planning & Analysis

| Agent | Suggested Model | Role | When to Add |
|-------|----------------|------|-------------|
| `planner` | sonnet | Work decomposition, sequencing | When adding complex planning |
| `critic` | opus | Multi-perspective deep analysis | When needing stronger challenge passes |
| `document-specialist` | sonnet | SDK/API/framework evaluation | When adding documentation skills |

## How to Add an Agent

1. Create `agents/{job-or-label}.md` with YAML frontmatter. `name` must be the job (`researcher`, not `eevee`). Filename may stay a label.
2. Write a system prompt that starts with the Role contract in `agents/README.md`.
3. Reference the job `name` in the relevant SKILL.md `Subagents` section. Never tell an orchestrator to dispatch the filename.
4. Update `config.example.json` if the agent needs configuration.

See `references/guidance-schema.md` for the full authoring guide.

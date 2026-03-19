# Agent Catalog — Future Extension Notes

Current second-claude ships with 10 agents. This document catalogs additional agent roles observed in the oh-my-claudecode ecosystem (22 agents) that users may want to add for specialized workflows.

## Current Agents (10)

| Agent | Model | Role |
|-------|-------|------|
| researcher | haiku | Web search, source gathering |
| analyst | sonnet | Data extraction, pattern recognition |
| writer | opus | Content production |
| editor | opus | Content refinement |
| strategist | sonnet | Framework application |
| deep-reviewer | opus | Logic, structure, completeness review |
| devil-advocate | sonnet | Weak points, blind spots |
| fact-checker | haiku | Claims, numbers, source verification |
| tone-guardian | haiku | Voice and audience fit |
| structure-analyst | haiku | Organization and readability |

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

1. Create `agents/{name}.md` with YAML frontmatter (`description`, `model`, `color`).
2. Write a system prompt in the body following the guidance schema.
3. Reference the agent in the relevant SKILL.md's `Subagents` section.
4. Update `config.example.json` if the agent needs configuration.

See `references/guidance-schema.md` for the full authoring guide.

# Second Claude Code — Knowledge Work OS

> 8 deep skills + 10 subagents shaped by 47 source patterns. An operating system for knowledge work.

Just as Second Brain is not 200 apps but one PARA system,
Second Claude is not 200 skills but **an OS that covers knowledge work with 8 commands**.

## Install

```bash
claude plugin add github:parkeungje/second-claude
```

## 8 Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `/second-claude-code:research` | Deep autonomous research | `/second-claude-code:research "AI agent landscape 2026"` |
| `/second-claude-code:write` | Content production | `/second-claude-code:write newsletter "The future of vibe coding"` |
| `/second-claude-code:analyze` | Strategic framework analysis | `/second-claude-code:analyze swot "our SaaS product"` |
| `/second-claude-code:review` | Multi-perspective quality gate | `/second-claude-code:review docs/draft.md --preset content` |
| `/second-claude-code:loop` | Iterative improvement | `/second-claude-code:loop "Raise this newsletter to 4.5/5" --max 3` |
| `/second-claude-code:capture` | Knowledge capture & organize | `/second-claude-code:capture https://example.com/article` |
| `/second-claude-code:pipeline` | Custom workflow builder | `/second-claude-code:pipeline run "weekly-digest"` |
| `/second-claude-code:hunt` | Skill discovery & install | `/second-claude-code:hunt "terraform security audit"` |

## Auto-Routing

You do not need to memorize the commands. Natural language is auto-routed:

```
"Write a newsletter about vibe coding"  →  /second-claude-code:write newsletter "vibe coding"
"Analyze this market"                   →  /second-claude-code:analyze
"Review this draft"                     →  /second-claude-code:review
```

## Skill Composition

The 8 skills call each other and chain naturally:

```
/second-claude-code:research → /second-claude-code:write → /second-claude-code:review → /second-claude-code:loop → done
/second-claude-code:research → /second-claude-code:analyze → /second-claude-code:review → done
/second-claude-code:capture → /second-claude-code:research → /second-claude-code:write → /second-claude-code:pipeline(save)
```

`/second-claude-code:write` automatically calls `/second-claude-code:research` and `/second-claude-code:review` internally.

## Multi-Perspective Review

`/second-claude-code:review` dispatches 3-5 subagents in parallel:

| Reviewer | Model | Role |
|----------|-------|------|
| deep-reviewer | opus | Deep logic, structure, and completeness review |
| devil-advocate | sonnet | Attacks the weakest 3 points |
| fact-checker | haiku | Verifies numbers, sources, and claims |
| tone-guardian | haiku | Tone and voice consistency for content |
| structure-analyst | haiku | Structure and readability review |

Consensus gate: 2/3 passes = APPROVED, any Critical item = MUST FIX

### Review Presets

| Preset | Reviewers | Use |
|--------|-----------|-----|
| `content` | deep + devil + tone | Newsletters and articles |
| `strategy` | deep + devil + fact | PRDs, SWOTs, and strategy docs |
| `code` | deep + fact + structure | Code review |
| `quick` | devil + fact | Fast validation |
| `full` | all 5 reviewers | Final pre-publish pass |

## Architecture

```
second-claude/
├── .claude-plugin/plugin.json    # Plugin manifest
├── skills/                       # 8 killer skills (SKILL.md each)
│   ├── research/                 # Autonomous deep research
│   ├── write/                    # Content production
│   ├── analyze/                  # Strategic framework analysis
│   ├── review/                   # Multi-perspective quality gate
│   ├── loop/                     # Iterative improvement
│   ├── capture/                  # Knowledge capture (PARA)
│   ├── pipeline/                 # Custom workflow builder
│   └── hunt/                     # Skill discovery
├── agents/                       # 10 specialized subagents
├── commands/                     # 8 slash command wrappers
├── hooks/                        # Auto-routing + context injection
├── references/                   # Shared reference docs
├── templates/                    # Output templates
├── scripts/                      # Shell utilities
└── config/                       # User configuration
```

## Design Principles

1. **Few but deep** — 8 skills, each internally rich with 47 source patterns
2. **Gotchas > Instructions** — catch Claude's failure patterns
3. **Progressive Disclosure** — SKILL.md short, references/ deep
4. **Context-efficient** — 8 descriptions total < 100 tokens
5. **Zero dependency** — no external CLI required, subagents only
6. **State in files** — JSON in `${CLAUDE_PLUGIN_DATA}/`
7. **Composable** — 8 skills combine into infinite workflows

## Command vs Skill

- Public interface: `/second-claude-code:*` commands
- Internal skill ids: `research`, `write`, `analyze`, `review`, `loop`, `capture`, `pipeline`, `hunt`
- Command wrappers route `/second-claude-code:*` invocations into the matching bare skill

## Lineage

Built on patterns from: Tiago Forte (Second Brain/PARA), Karpathy (autoresearch), Ars Contexta (6Rs), Claude Octopus (consensus gate), Pi (minimalism), Tw93 (context engineering), Thariq/Anthropic (skill guide), and 40+ more sources.

## Compatibility

- Claude Code (primary)
- OpenClaw (ACP protocol)
- Codex / Gemini CLI (SKILL.md standard)

## License

MIT

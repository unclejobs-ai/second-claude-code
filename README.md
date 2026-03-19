# Second Claude — Knowledge Work OS

> 47개 소스 패턴이 녹아든 8개 킬러 스킬. 지식 작업의 운영체제.

Second Brain이 앱 200개가 아니라 PARA라는 하나의 시스템인 것처럼,
Second Claude는 스킬 200개가 아니라 **8개 명령으로 모든 지식 작업을 커버하는 OS**.

## Install

```bash
claude plugin add github:parkeungje/second-claude
```

## 8 Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `/scc:research` | Deep autonomous research | `/scc:research "AI agent 생태계 2026"` |
| `/scc:write` | Content production | `/scc:write newsletter "바이브코딩의 미래"` |
| `/scc:analyze` | Strategic framework analysis | `/scc:analyze swot "우리 SaaS 제품"` |
| `/scc:review` | Multi-perspective quality gate | `/scc:review docs/draft.md --preset content` |
| `/scc:loop` | Iterative improvement | `/scc:loop "이 뉴스레터를 4.5/5로" --max 3` |
| `/scc:capture` | Knowledge capture & organize | `/scc:capture https://example.com/article` |
| `/scc:pipeline` | Custom workflow builder | `/scc:pipeline run "weekly-digest"` |
| `/scc:hunt` | Skill discovery & install | `/scc:hunt "terraform security audit"` |

## Auto-Routing

명령어를 몰라도 됩니다. 자연어로 말하면 알아서 라우팅합니다:

```
"바이브코딩에 대해 뉴스레터 써줘"  →  /scc:write newsletter "바이브코딩"
"시장 분석해줘"                    →  /scc:analyze
"이거 리뷰해"                      →  /scc:review
```

## Skill Composition

8개 스킬은 서로를 호출하며 체이닝됩니다:

```
/scc:research → /scc:write → /scc:review → /scc:loop → done
/scc:research → /scc:analyze → /scc:review → done
/scc:capture → /scc:research → /scc:write → /scc:pipeline(save)
```

`/scc:write`는 내부적으로 `/scc:research`와 `/scc:review`를 자동 호출합니다.

## Multi-Perspective Review

`/scc:review`는 3-5개 서브에이전트를 병렬 디스패치합니다:

| Reviewer | Model | Role |
|----------|-------|------|
| deep-reviewer | opus | 논리/구조/빈틈 심층 분석 |
| devil-advocate | sonnet | 가장 약한 3개 포인트 공격 |
| fact-checker | haiku | 수치/출처/사실 검증 |
| tone-guardian | sonnet | 톤/보이스 일관성 (콘텐츠용) |
| structure-analyst | haiku | 구조/가독성 (선택) |

Consensus gate: 2/3 이상 통과 = APPROVED, Critical 1개 = MUST FIX

### Review Presets

| Preset | Reviewers | Use |
|--------|-----------|-----|
| `content` | deep + devil + tone | 뉴스레터, 아티클 |
| `strategy` | deep + devil + fact | PRD, SWOT, 전략 |
| `code` | deep + fact + structure | 코드 리뷰 |
| `quick` | devil + fact | 빠른 검증 |
| `full` | 5명 전원 | 발행 전 최종 |

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
├── agents/                       # 8 specialized subagents
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

## Lineage

Built on patterns from: Tiago Forte (Second Brain/PARA), Karpathy (autoresearch), Ars Contexta (6Rs), Claude Octopus (consensus gate), Pi (minimalism), Tw93 (context engineering), Thariq/Anthropic (skill guide), and 40+ more sources.

## Compatibility

- Claude Code (primary)
- OpenClaw (ACP protocol)
- Codex / Gemini CLI (SKILL.md standard)

## License

MIT

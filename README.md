[English](README.md) | [한국어](README.ko.md)

![version](https://img.shields.io/badge/version-0.2.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![skills](https://img.shields.io/badge/skills-8-purple)
![agents](https://img.shields.io/badge/agents-10-orange)
![frameworks](https://img.shields.io/badge/frameworks-15-red)
![platforms](https://img.shields.io/badge/platforms-4-teal)

---

# Second Claude Code — Knowledge Work OS

![Skill Wheel](docs/images/hero.svg)

Just as Second Brain is not 200 apps but one PARA system,
**Second Claude Code is not 200 skills but an OS that covers knowledge work with 8 commands.**

Knowledge workers drown in tool fragmentation — a different plugin for research, another for writing, yet another for review, none of them talking to each other. Second Claude Code replaces that sprawl with 8 composable skills backed by 10 specialized subagents and 15 strategic frameworks. Built for researchers, strategists, and content creators who need depth over breadth and multi-model review over single-pass generation.

---

## The Knowledge Work Cycle

```mermaid
graph LR
    Research --> Write
    Research --> Analyze
    Analyze --> Review
    Write --> Review
    Review --> Loop
    Loop --> Write
    Capture --> Research
    Pipeline -.->|orchestrates| Research
    Pipeline -.->|orchestrates| Write
    Hunt -.->|discovers| Pipeline
```

---

## Quick Start

**1. Install**

```bash
claude plugin add github:EungjePark/second-claude-code
```

**2. Verify** — start a new Claude Code session and look for the context injection:

```
# Second Claude Code — Knowledge Work OS

8 commands for all knowledge work:
| Command | Purpose |
...
```

**3. Try it** — just type naturally:

```
Research the current state of AI agent frameworks in 2026
```

The auto-router picks `/second-claude-code:research` for you. No slash commands to memorize.

---

## The 8 Commands

Commands use the `/second-claude-code:` prefix.

### Discover

| Command | Description | Example |
|---------|-------------|---------|
| `research` | Autonomous deep research with iterative refinement | `/second-claude-code:research "AI agent landscape 2026"` |
| `hunt` | Skill discovery — find and install new capabilities | `/second-claude-code:hunt "terraform security audit"` |

### Create

| Command | Description | Example |
|---------|-------------|---------|
| `write` | Content production (articles, newsletters, scripts) | `/second-claude-code:write newsletter "The future of vibe coding"` |
| `analyze` | Strategic framework analysis (15 built-in frameworks) | `/second-claude-code:analyze swot "our SaaS product"` |

### Quality

| Command | Description | Example |
|---------|-------------|---------|
| `review` | Multi-perspective quality gate with consensus voting | `/second-claude-code:review docs/draft.md --preset content` |
| `loop` | Iterative improvement toward a target score | `/second-claude-code:loop "Raise this article to 4.5/5" --max 3` |

### Manage

| Command | Description | Example |
|---------|-------------|---------|
| `capture` | Knowledge capture and PARA classification | `/second-claude-code:capture https://example.com/article` |
| `pipeline` | Custom workflow builder and runner | `/second-claude-code:pipeline run "weekly-digest"` |

---

## Auto-Routing

You do not need to memorize slash commands. The hook-based auto-router detects intent from natural language in both English and Korean, then dispatches the right skill.

```
"Write an article about AI agents"     →  /second-claude-code:write
"AI 에이전트에 대해 조사해"              →  /second-claude-code:research
"Analyze this market with SWOT"        →  /second-claude-code:analyze
"이 초안을 리뷰해"                      →  /second-claude-code:review
"Save this for later"                  →  /second-claude-code:capture
"How do I run a security audit?"       →  /second-claude-code:hunt
```

The router matches against ~40 English and ~35 Korean trigger patterns via `hooks/prompt-detect.mjs` and injects the appropriate skill context before the model responds.

---

## Skill Composition

Skills call each other and chain naturally. A single prompt can trigger a full production pipeline.

```mermaid
sequenceDiagram
    participant U as User
    participant R as Research
    participant A as Analyze
    participant W as Write
    participant V as Review
    participant L as Loop

    U->>R: "Write a market report on edge AI"
    R->>A: findings (haiku subagents)
    A->>W: framework output (sonnet)
    W->>V: draft
    V->>V: 3-5 reviewers in parallel (opus + sonnet + haiku)
    V->>L: verdict: MINOR FIXES
    L->>W: iterate with feedback
    W->>V: revised draft
    V->>U: APPROVED
```

**Common chains:**

```
research → write → review → loop → done          # Full content pipeline
research → analyze → review → done                # Strategic analysis
capture → research → write → pipeline(save)       # Knowledge-to-content
```

`/second-claude-code:write` automatically invokes `/second-claude-code:research` and `/second-claude-code:review` internally, so a single write command can produce research-backed, review-gated content.

---

## Multi-Perspective Review

`/second-claude-code:review` dispatches 3-5 specialized subagents in parallel, each with a different model and focus area.

### Reviewers

| Reviewer | Model | Focus |
|----------|-------|-------|
| deep-reviewer | opus | Logic, structure, and completeness |
| devil-advocate | sonnet | Attacks the weakest points and blind spots |
| fact-checker | haiku | Verifies claims, numbers, and sources |
| tone-guardian | haiku | Voice and audience fit |
| structure-analyst | haiku | Organization and readability |

### Review Flow

```mermaid
graph TD
    U[User] --> D[Dispatch]
    D --> DR[deep-reviewer<br/>opus]
    D --> DA[devil-advocate<br/>sonnet]
    D --> FC[fact-checker<br/>haiku]
    D --> TG[tone-guardian<br/>haiku]
    D --> SA[structure-analyst<br/>haiku]
    DR --> G[Consensus Gate]
    DA --> G
    FC --> G
    TG --> G
    SA --> G
    G --> V{Verdict}
    V -->|pass| AP[APPROVED]
    V -->|issues| MF[MINOR FIXES]
    V -->|critical| MU[MUST FIX]
```

**Consensus gate:** 2/3 passes = APPROVED (3/5 for `full` preset). Any Critical finding = MUST FIX.

### Presets

| Preset | Reviewers | Best for |
|--------|-----------|----------|
| `content` | deep-reviewer + devil-advocate + tone-guardian | Newsletters and articles |
| `strategy` | deep-reviewer + devil-advocate + fact-checker | PRDs, SWOTs, strategy docs |
| `code` | deep-reviewer + fact-checker + structure-analyst | Code review |
| `quick` | devil-advocate + fact-checker | Fast validation |
| `full` | all 5 reviewers | Final pre-publish pass |

**External reviewers:** Pass `--external` to add cross-model review via mmbridge, kimi, codex, or gemini.

---

<details>
<summary><strong>15 Strategic Frameworks</strong></summary>

`/second-claude-code:analyze` supports 15 built-in frameworks, grouped by use case:

| Category | Frameworks |
|----------|------------|
| **Strategy** | ansoff, porter, pestle, north-star, value-prop |
| **Planning** | prd, okr, lean-canvas, gtm, battlecard |
| **Prioritization** | rice, pricing |
| **Analysis** | swot, persona, journey-map |

Each framework lives in `skills/analyze/references/frameworks/` as a standalone reference document. The analyze skill selects the right framework from your prompt or you can specify one directly:

```bash
/second-claude-code:analyze porter "cloud infrastructure market"
/second-claude-code:analyze rice --input features.md
/second-claude-code:analyze lean-canvas "my startup idea"
```

</details>

---

<details>
<summary><strong>Architecture</strong></summary>

```
second-claude/
├── .claude-plugin/plugin.json    # Plugin manifest (v0.2.0)
├── skills/                       # 8 skills (SKILL.md each)
│   ├── research/                 # Autonomous deep research
│   ├── write/                    # Content production
│   ├── analyze/                  # Strategic framework analysis (15 frameworks)
│   ├── review/                   # Multi-perspective quality gate
│   ├── loop/                     # Iterative improvement
│   ├── capture/                  # Knowledge capture (PARA)
│   ├── pipeline/                 # Custom workflow builder
│   └── hunt/                     # Skill discovery
├── agents/                       # 10 specialized subagents
├── commands/                     # 8 slash command wrappers
├── hooks/                        # Auto-routing + context injection
│   ├── hooks.json                # Hook configuration
│   ├── prompt-detect.mjs         # Natural language auto-router
│   ├── session-start.mjs         # Session banner + state init
│   └── session-end.mjs           # Cleanup
├── references/                   # Design principles, lineage, consensus gate
├── templates/                    # Output templates
├── scripts/                      # Shell utilities
└── config/                       # User configuration
```

| Directory | Role |
|-----------|------|
| `skills/` | Each skill has a `SKILL.md` (short, context-efficient) plus a `references/` subdirectory for deep documentation. Progressive disclosure in action. |
| `agents/` | 10 subagent definitions: 5 production agents (researcher, analyst, editor, strategist, writer) and 5 reviewers (deep-reviewer, devil-advocate, fact-checker, tone-guardian, structure-analyst). |
| `commands/` | Thin wrappers that route `/second-claude-code:*` invocations to the matching skill. |
| `hooks/` | Session lifecycle hooks and the auto-routing engine that maps natural language to skills. |
| `references/` | Shared knowledge: design principles, consensus gate spec, PARA method, lineage documentation. |

</details>

---

## Design Philosophy

Seven principles govern the plugin's architecture:

1. **Few but Deep** (Pi) — 8 skills, not 80. Each one internally rich.
2. **Gotchas over Instructions** (Thariq) — Document failure modes, not just happy paths.
3. **Progressive Disclosure** (Thariq + Tw93) — SKILL.md is short; `references/` goes deep.
4. **Context-Efficient** (Tw93) — All 8 skill descriptions fit under 100 tokens total.
5. **Zero Dependency Core** (Pi) — No `npm install`. Subagents and shell scripts only.
6. **State in Files** (Ars Contexta + Pi) — JSON state persisted in the plugin data directory.
7. **Composable** (Autoresearch) — Skills call each other; 8 primitives yield infinite workflows.

**How the principles interact:**
Few-but-deep + composable = small surface area, infinite combinations.
Gotchas-first + progressive disclosure = safe usage without walls of text.
Context-efficient + zero dependency = fast, cheap, portable across platforms.

---

## Lineage

| Source | Absorbed Pattern |
|--------|-----------------|
| Tiago Forte (Second Brain) | PARA classification in the capture skill |
| Andrej Karpathy (autoresearch) | Iterative research loop with refinement |
| Ars Contexta (6Rs framework) | Capture/synthesis flow, queue orchestration |
| Claude Octopus (consensus gate) | Multi-perspective review with voting |
| Pi / badlogic (minimalist plugin) | Zero-dependency architecture, file-based state |
| Tw93 (prompt engineering) | Context-efficiency, sub-15-token descriptions |
| Thariq / Anthropic (skill design) | SKILL.md format, gotchas-first documentation |

---

## Compatibility

| Platform | Install |
|----------|---------|
| **Claude Code** (primary) | `claude plugin add github:EungjePark/second-claude-code` |
| **OpenClaw** | Standard ACP protocol — auto-detected |
| **Codex** | SKILL.md standard compatible |
| **Gemini CLI** | SKILL.md standard compatible |

## Contributing

Issues and pull requests welcome at [github.com/EungjePark/second-claude-code](https://github.com/EungjePark/second-claude-code).

## License

[MIT](LICENSE) — Park Eungje

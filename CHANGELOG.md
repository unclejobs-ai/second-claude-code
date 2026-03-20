# Changelog

## [0.3.0] - 2026-03-21

### Breaking
- Agent files renamed from role-based to Pokemon names (e.g., `researcher.md` → `eevee.md`)

### Added
- PDCA Wrapper v2: Action Router classifies review findings by root cause before routing
- Question Protocol for Plan phase (max 3 scope-clarifying questions, `--no-questions` flag)
- Pre-Flight Check in Do phase prevents execution without Plan artifacts
- `skills/pdca/references/action-router.md` — root cause classification matrix
- `skills/pdca/references/question-protocol.md` — question budget and skip conditions
- 9th design principle: Action Router
- Agent Team Integration section in architecture docs

### Changed
- Plan phase chains research → analyze (Eevee → Alakazam + Mewtwo)
- Do phase becomes pure executor (`--skip-research --skip-review`)
- Act phase uses Action Router: SOURCE/ASSUMPTION → Plan, COMPLETENESS/FORMAT → Do, EXECUTION_QUALITY → Loop
- Plurality routing replaces 50% threshold; PLAN > DO > LOOP tiebreaker for exact ties
- `--target` propagated from PDCA to Loop dispatch (no longer hardcoded APPROVED)
- State schema expanded: `check_report`, `act_final`, `check_verdict`, full gate tracking
- 16 agents renamed to Pokemon (Eevee, Alakazam, Mewtwo, Smeargle, Ditto, Xatu, Absol, Porygon, Jigglypuff, Unown, Arceus, Machamp, Noctowl, Magnezone, Deoxys, Abra)
- Version bumped to 0.3.0 across all manifests, READMEs, and badges
- READMEs updated with Pokemon-themed Mermaid diagrams and Action Router branching
- Design principles expanded from 7 to 9

## [0.2.0] - 2026-03-20

### Breaking
- Renamed `capture` skill to `collect` — command is now `/second-claude-code:collect`
- Collect skill now saves dual format: `.json` (machine) + `.md` (human-readable)

### Added
- Comprehensive README overhaul with Mermaid diagrams and shields.io badges
- Korean README (README.ko.md) for the Korean developer community
- Hero SVG skill wheel diagram (docs/images/hero.svg)
- VHS tape script for terminal demo recording (docs/demo.tape)

### Changed
- README restructured into 13 sections (~315 lines, up from 125)
- Loop command example changed from "newsletter" to "article"
- Added `<details>` sections for frameworks table and architecture tree
- Language toggle between English and Korean versions

## [0.1.0] - 2026-03-19

### Added
- Initial release with 8 killer skills
- `/scc:research` — autonomous deep research with iterative web exploration
- `/scc:write` — content production (newsletter, article, shorts, report, social, card-news)
- `/scc:analyze` — strategic framework analysis (15+ frameworks)
- `/scc:review` — multi-perspective quality gate with 3-5 parallel reviewers
- `/scc:loop` — iterative improvement engine with review-driven feedback
- `/scc:collect` — knowledge collection with PARA classification
- `/scc:pipeline` — custom workflow builder for skill chaining
- `/scc:hunt` — dynamic skill discovery and installation
- 10 specialized subagents (researcher, analyst, writer, editor, strategist, deep-reviewer, devil-advocate, fact-checker, tone-guardian, structure-analyst)
- SessionStart hook with context injection and state restoration
- UserPromptSubmit hook with auto-routing (natural language → skill)
- Reference docs: design principles, lineage, consensus gate, PARA method
- Templates: newsletter, research brief, SWOT analysis

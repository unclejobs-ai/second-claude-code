# Changelog

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

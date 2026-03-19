# Design Principles

Seven core principles that govern every decision in second-claude.

---

## 1. Few but Deep
Eight skills, not eighty. Each skill internally orchestrates multiple subagents, search rounds, and review passes. The surface area stays small while the depth per skill stays high. Adding a new top-level skill requires justification that it cannot be composed from existing ones.

**Implication**: Resist the urge to add narrow single-purpose skills. Instead, add depth to an existing skill or compose a pipeline from the core 8.

## 2. Gotchas over Instructions
Positive instructions ("do X") are necessary but insufficient. The highest-value documentation is the failure mode table: what goes wrong, why, and how the skill design prevents it. Every SKILL.md must include a Gotchas section with concrete mitigations.

**Implication**: When writing a skill, spend as much time on the Gotchas table as on the happy-path instructions. If you cannot name 3 failure modes, you do not understand the skill yet.

## 3. Progressive Disclosure
SKILL.md is the short reference -- enough to use the skill correctly. The `references/` directory holds deep dives: theory, edge cases, worked examples. Users should never need to read references to use a skill. References exist for those who want to understand or extend.

**Implication**: Keep SKILL.md under 120 lines. Move theory, history, and extended examples to references.

## 4. Context-efficient
Every token in a prompt costs money and attention. Skill descriptions must be under 15 tokens. YAML frontmatter stays minimal. Dynamic context (injected via `!`backtick syntax`) pulls only what is needed for the current invocation.

**Implication**: Audit prompt sizes regularly. If a skill prompt exceeds 2000 tokens including injected context, refactor it.

## 5. Zero Dependency Core
The core 8 workflows should run without installing external packages. Optional marketplace discovery may use external CLIs if they are already present, but the plugin must degrade gracefully when they are not. Installation remains `git clone` and nothing else for the core product.

**Implication**: Core skills cannot require `npm install` or `pip install`. Optional integrations such as `/second-claude-code:hunt` must clearly advertise capability gating and continue to provide local-scan-only behavior when external CLIs are unavailable.

## 6. State in Files
All persistent state lives in JSON files within `CLAUDE_PLUGIN_DATA`. No databases, no external services, no environment variables for state. File-based state is inspectable, versionable, and survives session restarts without configuration.

**Implication**: Use `$CLAUDE_PLUGIN_DATA/state.json` for plugin state. Use `$CLAUDE_PLUGIN_DATA/knowledge/` for knowledge base. Never rely on in-memory state across session boundaries.

## 7. Composable
The 8 core skills are building blocks, not endpoints. `/second-claude-code:write` calls `/second-claude-code:research` internally. `/second-claude-code:loop` wraps any other skill in an iteration cycle. `/second-claude-code:pipeline` chains arbitrary skill sequences. Composition is the primary extension mechanism.

**Implication**: Every skill must accept structured input and produce structured output. A skill that can only be invoked by a human prompt is incomplete -- it must also be callable by another skill.

---

## Principle Interactions

These principles reinforce each other:

- **Few but deep** + **composable** = small surface, infinite combinations
- **Gotchas** + **progressive disclosure** = safe usage without reading walls of text
- **Context-efficient** + **zero dependency** = fast, cheap, portable
- **State in files** + **zero dependency** = no setup, no infra

When principles conflict, priority order is: Zero Dependency Core > context-efficient > few but deep > the rest.

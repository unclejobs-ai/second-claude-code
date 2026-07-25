# Second Claude Code

Claude Code plugin (v2.0.0). PDCA-native knowledge work system — 18 skills, 17 agents, 8 hooks, 31 MCP tools on the pdca-state server (3 MCP servers total: pdca-state, playwright, mmbridge).

## Key Conventions

- **Language**: Skills, hooks, MCP server are JavaScript ESM (.mjs). No TypeScript.
- **Public loop command**: `/scc:loop`
- **Agent naming**: Pokemon-themed (Arceus=orchestrator, Pikachu=soul, Eevee=researcher, etc.)
- **Bilingual docs**: EN (.md) + KO (.ko.md) maintained independently, not translated
- **PDCA phases**: Plan (Eevee+Alakazam) → Do (Smeargle) → Check (Xatu+Absol+Porygon+Jigglypuff+Unown) → Act (Ditto)
- **Cycle memory**: Phase artifacts and insights persist across sessions in `.data/cycles/`
- **Domain-aware PDCA**: `pdca_start_run` accepts `domain` (code|content|analysis|pipeline) for stage-specific contracts

## Verification

```bash
# Syntax check all hooks and MCP server
node --check hooks/*.mjs hooks/lib/*.mjs mcp/*.mjs mcp/lib/*.mjs

# Validate plugin manifest
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"

# Verify all agents have required frontmatter
for f in agents/*.md; do head -1 "$f" | grep -q '^---' || echo "MISSING frontmatter: $f"; done

# Verify all skills have SKILL.md
for d in skills/*/; do [ -f "${d}SKILL.md" ] || echo "MISSING SKILL.md: $d"; done

# Run full test suite
npm test
```

## Do Not

- Add TypeScript or build steps — this is a runtime plugin, no compilation
- Modify agent model tiers without checking docs/architecture.md roster table
- Edit hooks.json directly — it's the plugin hook registry, changes affect all users

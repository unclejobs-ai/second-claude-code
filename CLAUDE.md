# Second Claude Code

Claude Code plugin (v3.0.2). PDCA-native knowledge work system — 15 skills, 18 commands, 17 agents, 9 hook events, 31 MCP tools on the pdca-state server (3 MCP servers total: pdca-state, playwright, mmbridge).

`viewer`, `unblock`, and `standard-check` ship as commands with no skill: they execute and make no judgment, so they take no slot in the skill list. `skills/unblock/` still holds the fetch engine.

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

# Verify all skills have SKILL.md — skills/unblock/ is engine-only by design
for d in skills/*/; do [ -f "${d}SKILL.md" ] || [ "$d" = "skills/unblock/" ] || echo "MISSING SKILL.md: $d"; done

# Run full test suite
npm test

# Regenerate the checked-in, self-contained MCP artifact and license notices
npm run build:mcp
git diff --exit-code -- mcp/pdca-state-server.bundle.mjs THIRD_PARTY_NOTICES.md
```

## Do Not

- Add install-time compilation. Maintainers regenerate the checked-in MCP bundle
  and third-party notices with `npm run build:mcp`; user installs must not build
  or fetch runtime dependencies.
- Modify agent model tiers without checking docs/architecture.md roster table
- Edit hooks.json directly — it's the plugin hook registry, changes affect all users

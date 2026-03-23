# Second Codex

Codex plugin (v0.5.3). PDCA-native knowledge work system — 11 skills, 17 agents, 8 hooks, 2 MCP servers.

## Project Structure

```
.Codex-plugin/plugin.json  — Plugin manifest (name, version, MCP servers)
skills/                     — 11 skill directories (pdca, research, write, analyze, review, refine, collect, workflow, discover, batch, soul)
agents/                     — 17 agent definitions (.md files, Pokemon-themed)
hooks/                      — 8 lifecycle hooks (session-start, prompt-detect, subagent-start/stop, session-end, compaction, stop-failure)
  hooks.json                — Hook registry (SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, Stop, PreCompact, PostCompact, StopFailure)
mcp/pdca-state-server.mjs   — PDCA state MCP server (transitions, gates, analytics, soul observations)
commands/                   — Slash commands
config/                     — Runtime configuration
references/                 — Integration docs (mmbridge, etc.)
docs/                       — Architecture docs (EN/KO bilingual)
```

## Key Conventions

- **Language**: Skills, hooks, MCP server are JavaScript ESM (.mjs). No TypeScript.
- **Agent naming**: Pokemon-themed (Arceus=orchestrator, Pikachu=soul, Eevee=researcher, etc.)
- **Bilingual docs**: EN (.md) + KO (.ko.md) maintained independently, not translated
- **PDCA phases**: Plan (Eevee+Alakazam) → Do (Smeargle) → Check (Xatu+Absol+Porygon+Jigglypuff+Unown) → Act (Ditto)

## Verification

```bash
# Syntax check all hooks and MCP server
node --check hooks/*.mjs mcp/*.mjs

# Validate plugin manifest
node -e "JSON.parse(require('fs').readFileSync('.Codex-plugin/plugin.json','utf8'))"

# Verify all agents have required frontmatter
for f in agents/*.md; do head -1 "$f" | grep -q '^---' || echo "MISSING frontmatter: $f"; done

# Verify all skills have SKILL.md
for d in skills/*/; do [ -f "${d}SKILL.md" ] || echo "MISSING SKILL.md: $d"; done
```

## Do Not

- Add TypeScript or build steps — this is a runtime plugin, no compilation
- Modify agent model tiers without checking docs/architecture.md roster table
- Edit hooks.json directly — it's the plugin hook registry, changes affect all users

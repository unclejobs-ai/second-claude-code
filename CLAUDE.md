# Second Claude Code

Read [AGENTS.md](AGENTS.md) first. It owns identity, host split, catalog counts, DOCUMENT-INDEX, and verification.

This adapter is for **Claude Code**. Plugin id **`scc`**. Slash **`/scc:*`**. Repo **unclejobs-ai/second-claude-code**.

Claude Code plugin (v3.1.0) with Codex and Grok install paths. God Hands knowledge work system — **16 skills**, 19 commands, 17 agents, 10 hook events, and **3 MCP servers** (`pdca-state`, optional `playwright`, optional `mmbridge`). `/scc:godhands` is the public orchestrator. Do not lead with a tool count.

`viewer`, `unblock`, and `standard-check` ship as commands with no skill: they execute and make no judgment, so they take no slot in the skill list. `skills/unblock/` still holds the fetch engine.

Public maintainer loop command: `/scc:loop`.

## Claude install

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

Update: `claude plugin update scc`. Restart Claude Code after install or update.

Other hosts (do not mix manifests):

- Codex: `codex plugin marketplace add unclejobs-ai/second-claude-code --ref main` then `codex plugin add scc@scc`. Skills only; no full `/scc:*` command mirror. Playwright and MMBridge disabled by default.
- Grok: `grok plugin install unclejobs-ai/second-claude-code --trust`. `.grok-plugin/plugin.json` plus `walnut.manifest.yaml`.

Plugin version 3.1.0 is in the manifests and `CHANGELOG.md`. GitHub **Latest Release is still v3.0.0**. There is no 3.1.0 GitHub Release yet.

## Slash surface (3.1.0)

3.1.0 sets `user-invocable: false` on every skill so Claude Code's merged `/` menu shows each `/scc:*` name once (the command).

## Key conventions

- **Runtime language**: skills, hooks, and the MCP server are JavaScript ESM (`.mjs`). **TypeScript exists**: `packages/core/` (quality contracts, checked-in `dist/`) and `ui/` (artifact viewer). Not a “no TypeScript” repo. User installs must not compile.
- **Agent naming**: Pokemon filenames are labels. Dispatch uses frontmatter `name`. `Agent(subagent_type: "eevee")` fails; use `researcher`. See [agents/README.md](agents/README.md). These are Claude Code subagents; Codex/Grok do not share this Agent roster.
- **Bilingual docs**: EN (`.md`) + KO (`.ko.md`) maintained independently, not translated.
- **PDCA phases** (job names): Plan (researcher + analyst) → Do (writer) → Check (deep-reviewer + devil-advocate + fact-checker + tone-guardian + structure-analyst) → Act (editor).
- **Cycle memory**: phase artifacts and insights persist across sessions in `.data/cycles/`.
- **Domain-aware PDCA**: `pdca_start_run` accepts `domain` (`code` \| `content` \| `analysis` \| `pipeline`) for stage-specific contracts.

## Built-in orchestrator, write, soul

The auto-router spine is `godhands`, `research`, `write`, `review`, `refine`, and `coach`. Leave `analyze` model-invocable; God Hands Gather slash-chains `/scc:analyze`. `pdca` is `disable-model-invocation` (slash-only compat).

- **`/scc:godhands`**: the built-in orchestrator. Gated Gather → Draft → Check → Cut, Action Router. The one orchestrator to choose. Runtime stays `pdca_*`. `/scc:pdca` is slash-only compat.
- **`/scc:workflow`**: slash-only named replay. Preset **autopilot** approximates God Hands (research → analyze → write `--skip-research --skip-review` → review → refine) without `pdca_*` state or gates. God Hands Draft may call it as an explicit slash, not as auto-route.
- **`/scc:batch`**: slash-only parallel split. 2–10 independent parallel units. Sequential work is God Hands or an explicit `/scc:workflow`.

Folded (slash still works): `collect`, `discover`, `translate`, `batch`, `workflow`, `soul`, `pdca`, plus already-folded `loop`, `evolve`. The advisory cross-plugin planner is not a fourth orchestrator.

`/scc:write` runs internal `/scc:review` unless `--skip-review`. God Hands Check is a separate review. Direct `/scc:write` plus `/scc:godhands` double-reviews unless Draft skips.

Hooks and `/scc:soul` use `soul/observations/YYYY-MM-DD.jsonl`. Do not append by hand.

Archive/delete (leave on disk): `translations/`, `docs/RELEASE-v*`. Full index in [AGENTS.md](AGENTS.md) DOCUMENT-INDEX.

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

# Changelog

All notable changes to scc are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [2.1.0] - 2026-07-25

### Added

- **Background run handoff.** `daemon_start_background_run` returns the command that starts the work — `claude --bg "/scc:workflow run <name>"`, managed with `claude agents`. The queue deliberately executes nothing itself: Claude Code already ships background agents, and an in-plugin executor would run outside the conversation where this project requires explicit approval before publishing, pushing, or sending mail. Documented in the README and the workflow guide in both languages.
- **Overridable plugin preferences.** `INTENT_PROFILES` pins review to `coderabbit` and the pin is worth +60, so a reviewer you prefer could not outrank it without editing source. A `plugin-preferences.json` in `CLAUDE_PLUGIN_DATA` now replaces the pinned list per intent; an empty array drops the pin entirely. Malformed files are ignored rather than taking routing down.

### Fixed

- **`daemon_start_background_run` no longer implies an executor.** It previously said "the daemon may execute it later when online" — there is no execution path, online or otherwise. The tool description, the architecture docs, and the session banner now say so; the banner had been blaming the offline daemon for something being online would not fix.
- **A test that passed by measuring nothing.** The preference-override test bailed with an early return when `coderabbit` was absent, which the runner reports as a pass. It now builds a mock plugin root and asserts the plugin was scored before measuring the pin, so it runs identically everywhere.
- **The Verified Routes table** listed `coderabbit` and `commit-commands` as top picks without noting those are the shipped defaults, which an override changes.


## [2.0.0] - 2026-07-25

### Changed — BREAKING

- **Command namespace is now `scc`.** Every invocation changes: `/second-claude-code:pdca` becomes `/scc:pdca`. The plugin must be reinstalled — the plugin cache is keyed by name, so an existing install keeps serving the old surface. The repository, the GitHub URL, and the display name "Second Claude Code" are unchanged.
- **The Plan gate requires 5 sources, not 3.** v1.3.0 raised this in `phase-schemas.md` and `plan-phase.md`, recording the reason — a thin source pool hands the Do phase a single-narrative brief — but never touched the code, so the gate stayed at 3. It now matches its own documentation. Runs that used to clear Plan with 3 or 4 sources will be held.

### Fixed — paths that were declared but never ran

- **Cross-plugin dispatch emitted unresolvable ids.** Skills were joined with a hyphen (`coderabbit-code-review`) while commands three lines below used a colon. Nothing dispatched. Seven test assertions had pinned the broken format.
- **`act → do` was rejected by the state machine.** The Action Router classifies COMPLETENESS_GAP and FORMAT_VIOLATION as execution problems and routes them back to Do; `VALID_TRANSITIONS` allowed only `act → plan`, so a third of the router's decisions had nowhere to go. Re-entry keeps the plan's gate, approval, and sources, clears everything Do and Check produced, and consumes a cycle so `max_cycles` bounds it.
- **`action_router_history` was never written.** Declared, documented, appended to by nothing. It now records the route, root cause, and the counts the decision was computed from.
- **Obeying the auto-router logged a correction against the user.** Command dispatches were stored with a leading slash and compared against a slash-stripped name, so following the router's own suggestion recorded a `routing_correction` at confidence 0.95. Soul learning was being trained on disagreement that never happened.
- **The Artifact Viewer had never worked.** Nothing produced the `state.json` + `artifacts/*.json` layout it reads; `ui/dist` was gitignored so installs shipped without a build; and the WebSocket handshake used a wrong RFC 6455 GUID, which yields a plausible digest and is rejected by every browser. All three fixed — `scripts/viewer-session.mjs` is the missing producer, `dist` ships, and the handshake is verified against the RFC test vector.
- **The tone reviewer was missing from the PDCA roster** and underpowered where it did run. `pdca/SKILL.md` listed a `consistency-checker` that does not exist and dropped `tone-guardian` entirely. `tone-guardian` and `structure-analyst` moved haiku → sonnet: both assign severity grades and 0.0–1.0 scores, and the repo's own review transcript recorded the tone reviewer returning APPROVED with zero findings, "consistent with its haiku-tier model assignment".
- **Six skill role names matched no agent**, so the model and tools beside them were ignored on dispatch — `connector`, `searcher`, `inspector`, `evaluator`, `orchestrator`, `step_executor` are now the real names.
- **`loop-runner` leaked git worktrees on any failure.** Cleanup ran only on the success path. Creations are tracked and removed in a `finally`, `mapWithConcurrency` lets workers settle before raising, and `--parallel` is capped at 8.

### Added

- **`scripts/export-artifact.mjs`** — renders a run as one shareable Markdown page: gates, reviewer verdicts, phase timeline, scope drift, and every re-entry with its reason. Mermaid for the loop and charts, so it publishes as an Artifact with no bundle and no server.
- **`scripts/viewer-session.mjs`** — projects `.data/state` and `.data/cycles` into the layout the viewer reads.
- **Design principle §10, "The Creative Spine Never Downgrades"** — tier overrides on the writer and deep-reviewer are upward-only, and the haiku line is drawn at judgment rather than seniority.

### Documentation

- The README now leads with what the plugin does **on its own** before what it does with your plugins. Cross-plugin dispatch is framed as an accelerant — with an empty plugin root, every lifecycle prompt falls through to the built-in reviewers and nothing degrades.
- Routing order was documented backwards in four places across both languages. A compound prompt returns before the external plan is computed; external dispatch competes with the single-skill router, never with PDCA.
- "No hardcoded registry" was untrue (`INTENT_PROFILES` pins four plugins) and the session-start table never carried invocation strings. Both corrected.
- Added the missing `pdca_transition` state diagram — its absence is why nobody could see `act → do` was rejected.

### Tests

388 → 405 passing. New guards cover the class of defect this release is mostly made of: contract tests now fail when a skill role names no real agent, when a roster diagram's tiers or legend disagree with `agents/`, when a skill guide is missing a translation, and when the viewer guide stops naming its producer. `pdca-state-server.test.mjs` no longer asserts against a local copy of the state machine it is meant to be testing.


### Added

- **Deep Interview skill** (`commands/deep-interview.md`, `skills/deep-interview/`, `scripts/deep-interview-runner.mjs`) — an 18th public command/skill for Socratic requirements discovery, Round 0 topology confirmation, ambiguity scoring, language-preserving specs, internal auto-mode fragments, and approval-gated handoff.
- **Deep Interview documentation and fixtures** (`docs/skills/deep-interview.md`, `docs/skills/deep-interview.ko.md`, `skills/deep-interview/references/`) — self-serve protocol, scoring, fixtures, troubleshooting, example transcript, acceptance checklist, and gotchas.
- **Deep Interview regression tests** (`tests/runtime/deep-interview-runner.test.mjs`, `tests/contracts/deep-interview-contracts.test.mjs`) — locks topology preservation, Korean rendering, auto-mode validation, approval non-execution, fragment privacy, exact command/skill alignment, and documentation discoverability.

### Fixed

- **PDCA quality gate re-arms every cycle** (`mcp/lib/pdca-handlers.mjs`, `hooks/session-end.mjs`) — `completed` was an append-only set never reset on an `act→plan` recycle, so after the first Check the Stop gate treated Check as permanently done and stopped enforcing for the rest of the run. Recycling now resets the cycle-scoped state.
- **auto_gate transitions are reachable via the MCP API** (`mcp/lib/pdca-handlers.mjs`, `mcp/pdca-state-server.mjs`) — the gate counters (`sources_count`, `plan_mode_approved`, `reviewer_count`, …) had no setter tool, so `pdca_transition({auto_gate:true})` could never pass. `pdca_transition` and `pdca_check_gate` now accept a validated `phase_result`, artifacts merge before the gate is evaluated, and successful transitions return `transitioned: true`.
- **Event/analytics reads reject path traversal** (`hooks/lib/event-log.mjs`) — `pdca_get_events`/`pdca_get_analytics` built a file path from an unvalidated `run_id`; a new `isValidRunId` guard blocks `..` and path separators.
- **Cross-process state safety** (`mcp/lib/pdca-handlers.mjs`, `hooks/session-end.mjs`) — the five PDCA state mutators and the session-end `session_history` write now hold a file lock, preventing lost updates when two sessions share the global `.data` state.
- **Stop hook delivers its reason** (`hooks/session-end.mjs`) — the block reason now goes to stderr (which Claude Code reads on exit 2) instead of stdout JSON (only read on exit 0); the guard is scoped by `CLAUDE_SESSION_ID` so one session can't clear another's.
- **Plugin discovery hot path** (`hooks/lib/plugin-discovery.mjs`) — `discoverAllPlugins()` is memoized within the process (keyed on `installed_plugins.json` content), so `prompt-detect` no longer re-walks every installed plugin ~6× per prompt.
- **Metadata consistency** — marketplace listing and `walnut.manifest.yaml` corrected to 18 skills; `AGENTS.md` product name corrected.
- **MCP server self-heals missing dependencies** (`mcp/pdca-state-server.mjs`) — `claude plugin add` clones the repo but never runs `npm install`, so on a fresh install the `pdca-state` server died with `ERR_MODULE_NOT_FOUND` for `@modelcontextprotocol/sdk` and all 31 tools were unavailable. The server now detects the missing SDK at startup, installs production dependencies into the plugin root once (npm output routed to stderr — stdout stays clean JSON-RPC), and retries the import.

### Removed

- **Six unwired modules** (~1770 LOC incl. tests) — `hooks/lib/file-mutex.mjs` (superseded by `file-mutex-sync.mjs`), `agent-tracker.mjs`, `mmbridge-adapter.mjs`, `fact-checker.mjs`, `skill-metadata.mjs`, and `mcp/lib/loop-handlers.mjs` had no runtime or script importer — only their own tests. Removed both.

## [1.5.2] - 2026-06-12

### Added — Code Engineering Lane

- **Code Engineering Lane** (`skills/pdca/references/code-engineering-lane.md`) — a `domain=code` PDCA specialization that absorbs useful operating discipline from `engineering-discipline` and `Hyper-Waterfall` without replacing Second Claude's Plan → Do → Check → Act cycle.
- **Code-stage contracts strengthened** (`config/stage-contracts.json`) — code Plan now requires executable acceptance criteria, rollback path, and approval-gate status; Do records branch/worktree isolation and stage-report expectations; Check requires validator/reviewer proof; Act requires clean-ai-slop/simplification and final handoff state.
- **Public docs aligned** — README, Korean README, architecture docs, and PDCA skill guides now describe the same code engineering lane.
- **Contract regression coverage** — `tests/contracts/skill-contracts.test.mjs` locks the new lane reference, public docs, and code-stage DoD phrases.

### Changed

- **Release metadata aligned to 1.5.2** — package metadata, plugin manifest, marketplace metadata, badges, `CLAUDE.md`, and `AGENTS.md` now agree on the current deployed version and 18-skill surface.

## [1.5.1] - 2026-05-09

### Added — Unblock Phase 0d native cleaners

- **Phase 0d** (`engine/probes/native-clean.mjs`) — host-specific body extractors that turn raw HTML into chrome-free markdown. Runs first when a registered cleaner matches; falls through to 0a/0b/… on miss.
- **Cleaners shipped** (`engine/cleaners/<host>.mjs`)
  - `naver` — SmartEditor walker (`se-text-paragraph` / `se-image` / `se-quotation-line`) for `*.blog.naver.com`
  - `tistory` — `tt_article_useless_p_margin` / `article-view` / `entry-content` / `tt-entry-content` for `*.tistory.com`
  - `brunch` — `wrap_body` → `wrap_item` / `cont` / `text` for `brunch.co.kr`
  - Each exports `extract(html, url) -> { ok, markdown, title, author, published, blocks, chars } | null`
  - `engine/cleaners/index.mjs` dispatches by host predicate; new hosts pick up automatically
- **Pre-chain URL normalization** (`engine/transforms.mjs` → `normalizeIframeHost()`) — rewrites iframe-fronted hosts before any probe runs. First rule: `blog.naver.com/{id}/{logNo}` → `m.blog.naver.com/{id}/{logNo}` (also handles `PostView.naver?blogId=…&logNo=…` query form). Decision logged to `decisions[]` with `action: "normalize"`. Result envelope exposes both `url` (rewritten) and `original_url`.
- **GEO-aligned markdown content negotiation** — `engine/probes/curl.mjs` Accept header now offers `text/markdown;q=0.95`, surfacing markdown automatically on sites publishing `<link rel="alternate" type="text/markdown">` or Mintlify-style `.md` mirror routes.
- **References** — `skills/unblock/references/native-cleaners.md` covers cleaner contract, dispatch table, host selectors, adding a cleaner, and the live measurement.

### Fixed

- **Jina envelope-only success** — Jina Reader returns HTTP 200 with a 314-byte envelope (`Title:` + `URL Source:` + `Warning: This page contains iframe…`) when the source page hides body content inside an iframe. The existing `body.length > 200` check accepted these stubs as success. Now the envelope lines are stripped and the meaty content is re-measured; bodies under 200 chars after stripping fail with reason `jina_envelope_only` and the chain falls through.

### Effect

Live measurement on `https://blog.naver.com/balahk/224279392527`:

| | Before | After |
|---|---|---|
| Phase | 0b jina-reader | 0d native-clean |
| Body | 314 B (envelope only) | 2,289 chars chrome-free markdown |
| Latency | ~1100 ms | 148 ms (~7× faster) |
| Metadata | none | author, published, block count |
| Trace | — | `decisions: [normalize, reorder]` |

Other hosts (HackerNews, GitHub, etc.) unchanged — 0d is skipped when no cleaner matches.

### Verification

- `node engine/cli.mjs https://blog.naver.com/balahk/224279392527 --json` → Phase 0d, `cleaner: "naver"`, `body_chars: 2289`
- `node engine/cli.mjs https://news.ycombinator.com/item?id=1 --json` → still resolves at 0a `public-api/hn-item` (no behavioral regression)
- CI: `plugin-contracts (22)` SUCCESS, CodeRabbit SUCCESS

## [1.5.0] - 2026-05-06

### Added — Unblock Skill (16th skill)

- **`unblock` skill** (`skills/unblock/`) — adaptive 9-phase fetch chain for URLs that WebFetch can't crack (4xx, captcha, WAF, JS-heavy SPAs). Zero API keys end-to-end; paid providers are gated behind explicit `--allow-paid`.
- **Phases 0a–6**:
  - 0a: 11 public-API routes (Reddit / HN / arXiv / Bluesky / GitHub / NPM / Stack Exchange / Wikipedia / Mastodon any host / Lemmy any host / oEmbed fallback discovery)
  - 0b: Jina Reader (`r.jina.ai`, key-optional, 20 RPM free tier)
  - 0c: yt-dlp metadata + transcript single-call (1800+ media sites)
  - 0d: Jina Search keyword routing with optional `--follow` recursion
  - 1: curl with rotating UA × Accept-Language × Sec-Ch-Ua × URL transforms; early-bail after 3 consecutive 4xx
  - 2: curl-impersonate TLS rotation across chrome131 / safari17_0 / firefox133 with cookie warming + locale-matched referrer chain
  - 3: LightPanda headless (cheap browser tier)
  - 4: Playwright real Chrome with same-origin XHR network intercept surfacing discovered hidden API endpoints
  - 5: Free archive cluster — Wayback + archive.today + AMP cache raced in parallel, plus RSS/Atom feed discovery + OG-tag rescue
  - 6: Optional paid (Tavily / Exa / Firecrawl) gated by `--allow-paid`
- **Operational hardening** — SSRF guard rejects RFC1918 / loopback / link-local / cloud metadata hosts (including IPv6-mapped IPv4); opt-out `UNBLOCK_ALLOW_PRIVATE_HOSTS=1`. `schema_version` + `idempotency_key` envelope contract. Stagnation detection: same fail reason ×3 jumps to archive. Phase 0 reordering by URL host priors. Signal-driven dynamic skip (Phase 1 stripped_too_short → Phase 4 direct). `decisions[]` orchestration audit log.
- **Cross-plugin orchestration** — `/scc:unblock` slash command. Auto-router patterns in `hooks/prompt-detect.mjs` (Korean + English, narrowed triggers to avoid false positives on `403` / `긁어` etc.). `skills/research/SKILL.md` falls back to unblock on blocked URLs. `agents/eevee.md` researcher invokes unblock on WebFetch failures.
- **Auto-install** — first-run discovery and one-shot install of `curl-impersonate`, `lightpanda`, `yt-dlp`, `playwright` when each phase needs them. Failure to install is logged and the chain proceeds — never blocks.
- **Bias-check enforcement** — `tests/skills/unblock/no-brand-hardcode.test.mjs` greps `engine/**` for forbidden brand names with word-boundary matching, allowlisting only the documented Phase 0a public-API routing modules.
- **References** — `skills/unblock/references/` covers WAF detection, TLS impersonation, archive fallbacks, and the Eevee fallback flow.

### Changed

- **`skills/research/SKILL.md`** — Web Engine fallback chain now lists unblock between WebFetch and Playwright.
- **`agents/eevee.md`** — Process step 2 documents the unblock invocation pattern with R5 (read trace before retry) enforcement.
- **`hooks/prompt-detect.mjs`** — added `unblock` route with English + Korean trigger patterns.
- **`hooks/session-start.mjs`** — banner advertises 16 commands.
- **README.md / README.ko.md / CLAUDE.md / docs/architecture.md / docs/architecture.ko.md / docs/orchestrator-architecture.md / docs/orchestrator-architecture.ko.md** — skill catalog adds `unblock`; v1.4.2 → 1.5.0 references updated.

### Verification

- `npm test` — 397 tests (394 pass, 0 fail, 3 skipped with network disabled)
- Live SSRF guard verified: `http://169.254.169.254/...` and `http://[::ffff:c0a8:0101]/...` both blocked with `ssrf_guard:private_host_blocked`
- Live HN smoke: Phase 0a wins in 298ms with `schema_version: 1` and `idempotency_key` populated
- Live GitHub smoke: Phase 0a hits rate-limit 403, chain correctly escalates to Phase 0b Jina Reader

## [1.4.2] - 2026-05-03

### Fixed

- **Artifact Viewer relative paths** — normalized viewer server runtime paths so `--dist-dir` and `--session-dir` work when provided as relative paths. This prevents the static file guard from returning 403 for valid viewer assets.

### Verification

- `node --test tests/runtime/viewer-server.test.mjs`
- `node --test tests/contracts/skill-contracts.test.mjs tests/runtime/plugin-smoke.test.mjs tests/runtime/viewer-server.test.mjs`

## [1.4.1] - 2026-05-03

### Fixed

- **Artifact Viewer command surface** — added the missing `/scc:viewer` wrapper so the documented viewer skill is actually registered by Claude Code.
- **Viewer server lifecycle** — `ui/scripts/start-server.sh` now starts the viewer in the background, writes JSON runtime metadata, and returns the URL without blocking the slash command. Added `ui/scripts/stop-server.sh` for clean shutdown from the recorded PID.
- **Command count alignment** — session-start, README, architecture docs, and contract tests were aligned to the then-current public command and skill surface.

### Verification

- `node --test tests/runtime/viewer-server.test.mjs`
- `env RUN_CLAUDE_CLI_E2E=1 node --test tests/e2e/claude-cli-slash.test.mjs`
- `npm test` — 368 tests (367 pass, 0 fail, 1 skipped)

## [1.4.0] - 2026-05-02

### Added — Cross-Plugin Orchestration (Phase 6)

- **Plugin Discovery Engine** (`hooks/lib/plugin-discovery.mjs`) — runtime scan of `~/.claude/plugins/installed_plugins.json` builds a dynamic capability map of all user-installed Claude Code plugins. Discovers skills, commands, MCP servers, and agents from any plugin's filesystem structure. No hardcoded registry — plugins appear and disappear as the user installs/uninstalls them.
- **Intent Scoring and Dispatch Planner** (`getDispatchPlan`) — keywords and PDCA phases are normalized into routing intents, scored against plugin names, skill names, command names, and descriptions, then sorted into actionable `Skill:` / slash-command instructions. Preferred plugin rules keep review on `coderabbit-code-review`, act on `/commit-commands:commit`, design on `frontend-design-frontend-design`, and memory/research on `claude-mem-knowledge-agent`.
- **4 New Orchestrator MCP Tools** (`mcp/lib/orchestrator-handlers.mjs`):
  - `orchestrator_list_plugins` — discover all installed plugins with full capability listings
  - `orchestrator_get_plugin` — detailed info on a specific plugin (skills, commands, MCP, agents, version, install path)
  - `orchestrator_route` — route task keywords or PDCA phases (plan/do/check/act) to matching external plugins. Returns actionable `Skill: plugin-skillname` dispatch instructions with auto-recommended top pick
  - `orchestrator_health` — ecosystem health check (plugin count, skill count, MCP availability)
- **Dynamic Dispatch Guide** — `generateDispatchGuide()` replaces the old hardcoded `<skill-check>` block in `prompt-detect.mjs` with a dynamically-generated per-phase plugin dispatch table. When plugins are installed or removed, the dispatch guide updates automatically. Each entry includes the exact `Skill: plugin-skillname` or slash-command invocation string and score.
- **Active Plugin Dispatch in Session-Start** — session-start now injects a proactive `## Active Plugin Dispatch` section showing per-phase plugin routing. The orchestrator pre-computes which plugins handle which PDCA phases so Claude doesn't have to guess.
- **Actionable Auto-Dispatch** — `orchestrator_route` responses include a `dispatch` array with the top 10 most relevant `Skill:` / `/command:` invocation strings. Auto-recommendation tells Claude the top pick (e.g., `"Auto-dispatch top pick: Skill: coderabbit-code-review"`).
- **Prompt-Level External Dispatch** — `prompt-detect` now injects an `[ORCHESTRATOR]` instruction when an external capability is the best match, telling Claude to invoke the external Skill or slash command before self-processing and to integrate the plugin result afterward.
- **Direct Plugin Match Routing** — strong generic matches route to installed plugin capabilities even when the prompt is not one of the built-in review/commit/design/research intents. Example: `posthog event analysis` → `Skill: posthog-exploring-autocapture-events`. Short-keyword boundary checks prevent accidental matches such as `bug` inside `debugging`.
- **PDCA Phase Auto-Routing** — plan phase → `Skill: claude-mem-knowledge-agent`, do phase → `Skill: frontend-design-frontend-design`, check phase → `Skill: coderabbit-code-review`, act phase → `/commit-commands:commit`

### Added — Soul Feedback Binding (Phase 5)

- **3 New Soul MCP Tools**:
  - `soul_retro` — collect git shipping metrics across projects (commits, streak, peak hours, commit size profiles, trend detection). Supports explicit project paths or auto-detection of sibling git repos with recent commits
  - `soul_get_synthesis_context` — prepare recency-weighted observations, shipping retro entries, current profile, drift pre-check, and readiness assessment for the soul proposal phase
  - `soul_get_readiness` — lightweight threshold check (30 observations OR 10 sessions = synthesis ready)
- **Soul Feedback Loop Binding in Session-Start** — replaces basic soul injection with a full feedback loop gauge showing visual progress bars, retro/shipping summary, and synthesis call-to-action
- **Soul Readiness & Retro Utilities** (`hooks/lib/soul-observer.mjs`) — `readSoulReadiness()` and `readLatestRetro()` for lightweight hook-side soul state queries without importing MCP handlers

### Fixed

- Retro trend detection: `raw_text` field now checked as fallback when `raw_context` is missing
- Explicit empty `projects: []` no longer triggers auto-detection of sibling repos
- Retro observations now include `category: "shipping"` for proper filtering in `soul_get_observations`
- Session-start command banner deduplication: soul command references from feedback binding section no longer cause test failures

### Verification

- **367 tests** (366 pass, 0 fail, 1 skipped) — includes prompt-level external dispatch, generic plugin match, short-keyword overmatch guard, and real handler coverage for orchestrator list/get/route
- Verified against 14 real Claude Code plugins (67 discovered skills, 3 MCP servers)
- `orchestrator_route phase=check` correctly dispatches → `Skill: coderabbit-code-review`
- `orchestrator_route phase=act` correctly dispatches → `/commit-commands:commit`
- `prompt-detect` dispatches Korean review/commit/design/research prompts to external capabilities before internal second-claude skills

## [1.3.0] - 2026-04-07

### Added

- **PDCA Domain Auto-Routing** — `skills/pdca/SKILL.md` now detects domain trigger keywords (스레드/threads, 뉴스레터/newsletter, 쇼츠/shorts, 카드뉴스/card news) and dispatches the matching specialized sub-skill inside the Do phase. PDCA stays in charge as the orchestrator; sub-skills are building blocks called inside its phases. Greedy matching ensures the most specialized sub-skill always wins over generic `/scc:write`.
- **Hard length floors per format** — `references/do-phase.md` defines minimum + target character counts for 11 output formats. The Do gate now fails if the artifact is below the floor, preventing sparse output from reaching the reviewer. Floors range from 1,800 chars (shorts script) to 10,000 chars (Korean newsletter), all calibrated against reader-value, source-utilization, and AI-hedge prevention benchmarks.
- **Plan brief floors** — `references/plan-phase.md` raises source minimum from 3 to 5, adds discrete fact count (≥8), named quote count (≥1), comparison table count (≥1), media inventory count (≥1, for content briefs). Brief char count floor of 3,000 prevents thin Plan→thin Do failure chains.
- **Reviewer model diversity rule** — `references/check-phase.md` requires at least 2 distinct models with at least 1 external model (Codex, Kimi, Qwen, Gemini, Droid) for `content`/`strategy`/`full` presets. Diversity score must be ≥0.6 when more than 2 reviewers run. Prevents false consensus by structurally enforcing independent perspectives.
- **False consensus detection** — when all reviewers return APPROVED with average score >0.9 and no critical findings, an adversarial pass with an unused external model is automatically dispatched before exit. Catches Goodhart-style "everyone said it's fine" failure mode.
- **5+ Rule for patch vs full rewrite (calibrated AND logic)** — `references/act-phase.md` adds a hard rewrite trigger when (a) any P0 finding exists OR (b) `p0+p1 ≥ 5` AND findings span ≥3 categories. Calibrated from initial OR logic after observing over-trigger on surgical 4-finding patch sets in real verification runs. Examples table covers 10 finding configurations.
- **Sub-skill input/output contracts** — new `references/domain-pipeline-integration.md` (284 lines) standardizes how PDCA's Do dispatcher invokes sub-skills (`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`, `/scc:write`). Defines input contract, DoOutput verification, failure handling (4 failure modes), and integration points with adjacent phases.
- **Pokemon role label clarification** — `skills/pdca/SKILL.md` Subagents block now explicitly states that role labels (Eevee, Smeargle, Xatu, etc.) are conceptual and not direct Agent tool dispatch targets. Real subagent dispatch happens inside `/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine`. Prevents past failure mode where the orchestrator tried to call `Agent(subagent_type: "eevee")` and silently fell back to self-processing.
- **Expanded DoOutput schema** — `references/phase-schemas.md` adds `char_count` (body only), `section_count`, `meets_length_floor`, `meets_section_floor`, `references_count` to DoOutput. Added `brief_char_count`, `facts_count`, `quotes_count`, `comparison_tables_count`, `media_inventory_count`, `meets_brief_floor` to PlanOutput. Added `distinct_models_count`, `external_model_count`, `diversity_score`, `false_consensus_check_passed`, `p0_count`, `p1_count`, `p2_count` to CheckOutput. PDCA verifies all of these independently from the sub-skill's self-report.

### Changed

- **PDCA framing** — SKILL.md replaces the implicit "PDCA hands off to sub-skills" framing with an explicit "PDCA is the main orchestrator, sub-skills are building blocks called inside its phases" architecture. Sub-skill internal phases now run inside PDCA's Do phase rather than replacing PDCA. PDCA's Check still runs independently after the sub-skill's internal review (different perspective, different blind spots).
- **Do phase Skill Selection table** — replaced single `/scc:write` row with greedy matching algorithm that prioritizes domain-specific sub-skills (`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`) before falling back to generic `/scc:write`.
- **Check phase reviewer requirements** — minimum reviewer count remains 2, but model diversity is now enforced as a hard contract instead of a soft suggestion. External model requirement is mandatory for content/strategy/full presets.
- **5+ Rule logic** — initial release used OR logic (`volume_threshold OR category_threshold`) which over-triggered on patch-sized 4-finding sets. Calibrated to AND for the volume+spread path and a separate hard credibility path (any P0). Verified against 10 finding configurations; calibrated path passes 6/6 vs original 3/6.
- Version surfaces aligned to `1.3.0` across plugin manifest, package metadata, marketplace, and documentation.

### Fixed

- **Phantom agent dispatch** — past failure mode where the orchestrator interpreted Pokemon role labels in SKILL.md as actual subagent_type values, attempted to dispatch them, silently fell back to self-processing when dispatch failed, and produced sparse output. Fixed by explicit clarification that role labels are conceptual; real dispatch happens inside chained skills.
- **Sparse Do output approval** — past failure mode where `word_count > 0` was the only Do gate check, allowing 1,500-char articles to pass and reach the reviewer who then "approved" structurally insufficient artifacts. Fixed by introducing format-specific length floors that fail the Do gate before any reviewer is dispatched.
- **Single-reviewer false consensus** — past failure mode where 2 internal Claude reviewers both said APPROVED on the same model and the cycle exited prematurely. Fixed by enforcing distinct models AND at least 1 external model for content presets.

### Verification Cycle (2026-04-07)

A verification PDCA cycle was run on a generic topic (no domain trigger) to test the strengthening end-to-end. Baseline comparison is "pre-v1.3.0 soft-gate behavior" (v1.0.0 through v1.2.0 did not touch PDCA phase gates):

| Metric | pre-v1.3.0 baseline | v1.3.0 actual | Improvement |
|--------|---------------------|---------------|-------------|
| Plan brief char count | 0 (no brief produced) | 7,981 | +∞ |
| Plan facts catalogued | 0 | 14 | +14 |
| Plan sources cited | 0 | 12 | +9 over floor |
| Plan named quotes | 0 | 2 | floor ×2 |
| Do article char count (body) | ~1,500 (estimated, self-processed) | 6,962 | +364% |
| Do H2 sections | 1-2 | 7 | +250% |
| Do references count | 0-3 | 10 | +233% |
| Reviewer count | 0 (self-review) | 2 (parallel) | — |
| External model reviewers | 0 | 1 (Codex GPT-5.4) | — |
| Cross-review P1 findings caught | 0 | 4 | — |
| Diversity score | n/a | 1.0 | meets ≥0.6 |

The verification cycle also revealed an over-trigger in the initial 5+ Rule OR logic, which was immediately corrected to AND logic in the same release.

---

For v1.2.0 and older releases, see [docs/changelog-archive.md](docs/changelog-archive.md).

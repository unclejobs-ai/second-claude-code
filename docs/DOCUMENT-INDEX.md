# DOCUMENT-INDEX / 문서 색인

Public file catalog for **Second Claude Code** (display name; plugin id `scc`; slash `/scc:*`; GitHub [unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)).

디스크 버전 **3.1.0**. GitHub Latest Release는 여전히 **v3.0.0**이며 **3.1.0 GitHub Release는 아직 없다.** CHANGELOG에는 `[3.0.1]`–`[3.1.0]`이 있다. 설치는 Release zip이 아니라 마켓플레이스 `main`을 쓴다.

This index is the full inventory. Start with [docs/README.md](README.md) for the human map. Do not treat archive rows as current product contracts. `.data/` and `.claude/agent-memory` are runtime state, not product docs, and are not listed.

## Disk catalog counts / 디스크 카탈로그 수

These counts must match this tree:

| Kind | Count | On disk |
|---|---|---|
| Skills with `SKILL.md` | **16** | `analyze`, `batch`, `coach`, `collect`, `discover`, `evolve`, `godhands`, `loop`, `pdca`, `refine`, `research`, `review`, `soul`, `translate`, `workflow`, `write` |
| Tool-only commands (no `SKILL.md`) | **3** | `/scc:viewer`, `/scc:unblock`, `/scc:standard-check`. `skills/unblock/` keeps the fetch engine |
| Command markdown files | **19** | `commands/*.md` (16 skill wrappers + 3 tools) plus extra `commands/version.mjs` (not a slash command) |
| Agents | **17** | `agents/*.md` excluding `agents/README.md` |
| Hook events | **10** | Claude Code lifecycle events in `hooks/` |
| MCP servers | **3** | shipped `pdca-state`; optional `playwright`; optional `mmbridge`. User blurbs say **3 servers**, not a tool count |

## Columns / 열

| Column | Values |
|---|---|
| path | Exact repo path |
| audience | `user` · `maintainer` · `historical` |
| role | What the file is for |
| status | `canonical` · `drift-fixed-this-run` · `archive-candidate` · `do-not-ship` |

- **canonical** — current public contract.
- **drift-fixed-this-run** — edited this run to match disk (3.1.0, 16/19/17/10/3, God Hands, `user-invocable: false`, `.grok-plugin/`).
- **archive-candidate** — leave on disk this run; mark for later archive/delete. Stale counts (18-skill, Deep Interview, 31 MCP tools) live here.
- **do-not-ship** — not SCC product docs; do not publish as plugin documentation.

## Remaining drift / 남은 드리프트 (tree 3.1.0)

| Item | Fact |
|---|---|
| GitHub Latest Release | Still **v3.0.0**. No 3.1.0 GitHub Release. Do not document a 3.1.0 GitHub Release. |
| Duplicate `/scc:*` names | **3.1.0 ships `user-invocable: false`.** Each `/scc:*` name is the command. Do not document duplicates as current. |
| Grok layout | Install is `grok plugin install unclejobs-ai/second-claude-code --trust`. This tree has `.grok-plugin/plugin.json` and `walnut.manifest.yaml`. |
| Write + God Hands | `/scc:write` runs internal `/scc:review` unless `--skip-review`. God Hands Check is a separate review. Direct `/scc:write` plus `/scc:godhands` double-reviews unless Draft skips. |
| Soul observation files | Hooks/MCP and `/scc:soul` use `soul/observations/YYYY-MM-DD.jsonl`. |
| MCP wording | Say **3 servers** in user blurbs. `pdca-state` exposes many tools; do not advertise “31 MCP tools”. |
| Compact surface | Auto-router spine is `godhands` / research / write / review / refine / coach (`analyze` stays model-invocable for God Hands Gather). collect / discover / translate / batch / workflow / soul / loop / evolve / pdca are slash-only (`disable-model-invocation`); files stay; `/scc:<name>` still works. `/scc:pdca` is slash-only compat; MCP state stays `pdca_*`. |

## One orchestrator plus two slash utilities / 오케스트레이터 하나와 슬래시 유틸리티 둘

The only orchestrator in choosers is `/scc:godhands`. `/scc:pdca` is slash-only compat. `/scc:workflow` is named replay (slash). `/scc:batch` is an independent parallel split (slash). Do not present them as three equal orchestrators. Autopilot is a named `/scc:workflow` preset, not a rival orchestrator. Pointers: [docs/README.md](README.md), [orchestrator-architecture.md](orchestrator-architecture.md).

Default auto-router: `/scc:godhands`, `/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine`, `/scc:coach`. `analyze` is God Hands Gather, not a top-level chooser row. Tools: `/scc:viewer`, `/scc:unblock`, `/scc:standard-check`. Slash-only (still on disk): `collect`, `discover`, `translate`, `batch`, `workflow`, `soul`, `loop`, `evolve`, `pdca`. God Hands still slash-chains research, analyze, write, review, refine. `/scc:workflow` in Draft is an explicit slash, not an auto-route.

| You want | Use | Kind |
|---|---|---|
| One gated Gather → Draft → Check → Cut pass | `/scc:godhands` | Orchestrator (auto-router) |
| A reusable saved pipeline of `/scc:*` steps | `/scc:workflow` | Slash-only named replay. Preset **autopilot** (research → analyze → write → review → refine) approximates God Hands as a sequential pipeline; it does not run God Hands gates |
| 2–10 independent units in parallel worktrees | `/scc:batch` | Slash-only parallel split. Sequential work (`workflow`) or one gated God Hands pass (`godhands`) |

---

## 1. Root public surface / 루트 공개 표면

| path | audience | role | status |
|---|---|---|---|
| [README.md](../README.md) | user | Install and overview (EN). Display name Second Claude Code; plugin id `scc`; `/scc:*`; GitHub unclejobs-ai/second-claude-code; tree 3.1.0 vs GitHub Latest v3.0.0 | drift-fixed-this-run |
| [README.ko.md](../README.ko.md) | user | 설치·개요 (한국어). 표시 이름 Second Claude Code, 플러그인 id `scc`, `/scc:*` | drift-fixed-this-run |
| [AGENTS.md](../AGENTS.md) | maintainer | Working contract: host split, catalog counts, MCP = 3 servers, orchestrator picker (`/scc:godhands`), write/God Hands double-review, DOCUMENT-INDEX pointer. Soul path is `soul/observations/YYYY-MM-DD.jsonl` | drift-fixed-this-run |
| [CLAUDE.md](../CLAUDE.md) | maintainer | Claude Code adapter. Install: `claude plugin marketplace add unclejobs-ai/second-claude-code` then `claude plugin install scc` | drift-fixed-this-run |
| [CHANGELOG.md](../CHANGELOG.md) | user | Notes `[3.0.0]`–`[3.1.0]`. `[3.1.0]` is God Hands + `user-invocable: false`. Empty `[Unreleased]`. No 3.1.0 GitHub Release yet | canonical |
| [package.json](../package.json) | maintainer | Package name `scc`, version `3.1.0`, description 16 skills / 19 commands / 17 agents / 3 MCP servers | drift-fixed-this-run |
| [walnut.manifest.yaml](../walnut.manifest.yaml) | user | walnut.world listing. Version 3.1.0. Pair with `.grok-plugin/plugin.json` | drift-fixed-this-run |
| [LICENSE](../LICENSE) | user | MIT license | canonical |
| [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) | maintainer | Generated notices for the checked-in MCP bundle | canonical |

## 2. Docs map / 문서 지도

| path | audience | role | status |
|---|---|---|---|
| [docs/README.md](README.md) | user | Human map: 16 skills, 3 tool-only commands, auto-router vs slash-only, one orchestrator (`godhands`) plus two slash utilities, `/scc:pdca` compat, MCP = 3 servers. Links here | drift-fixed-this-run |
| [docs/directory-map.md](directory-map.md) | maintainer | **Locked** directory architecture for tree 3.1.0. Do not restyle the tree in architecture.md | canonical |
| [docs/DOCUMENT-INDEX.md](DOCUMENT-INDEX.md) | maintainer | This catalog | canonical |
| [docs/methodology.md](methodology.md) | maintainer | Trajectory vs DSH; Artifact HTML vs live viewer | canonical |
| [docs/methodology.ko.md](methodology.ko.md) | maintainer | 궤적 vs DSH; Artifact HTML vs 라이브 뷰어 | canonical |
| [docs/notion-manual.md](notion-manual.md) | user | User manual (EN): smallest entry point, install, orchestrators, write vs God Hands Check | drift-fixed-this-run |
| [docs/notion-manual.ko.md](notion-manual.ko.md) | user | 사용 매뉴얼 (한국어) | drift-fixed-this-run |
| [docs/architecture.md](architecture.md) | user | Runtime boundary, God Hands pass, 16-skill roster (EN). Directory tree → directory-map.md | drift-fixed-this-run |
| [docs/architecture.ko.md](architecture.ko.md) | user | 런타임 경계·God Hands 패스·16개 스킬 (한국어). 트리는 directory-map.md | drift-fixed-this-run |
| [docs/orchestrator-architecture.md](orchestrator-architecture.md) | user | Advisory cross-plugin planner vs `/scc:godhands` (the orchestrator) and slash utilities `workflow` / `batch`. `/scc:pdca` is slash-only compat. Autopilot is a named `/scc:workflow` preset, not gates | drift-fixed-this-run |
| [docs/orchestrator-architecture.ko.md](orchestrator-architecture.ko.md) | user | 자문용 크로스-플러그인 플래너와 `/scc:godhands`(오케스트레이터) 및 슬래시 유틸리티 `workflow` / `batch`. `/scc:pdca`는 호환 이름 (한국어) | drift-fixed-this-run |
| [docs/images/](images/) | user | Product diagrams (`hero.svg`, `pdca-cycle.svg`, `review-flow.svg`, `agent-roster.svg`). README thumbnail is `thumbnail.png` — bronze God Hands still-life; alt text God Hands, not PDCA loop | canonical |
| [agents/README.md](../agents/README.md) | maintainer | 17 Claude Code subagents: Pokemon filenames vs job `name`. Codex does not mirror this roster | drift-fixed-this-run |
| [packages/core/README.md](../packages/core/README.md) | maintainer | `@second-claude/core` host-neutral quality contracts. Not a mandatory plugin workflow gate. Core package 4.0.0 ≠ plugin 3.1.0 | canonical |
| [packages/core/release/README.md](../packages/core/release/README.md) | maintainer | Checked-in `second-claude-core-4.0.0.tgz` regeneration | canonical |

## 3. Skill guides / 스킬 가이드 (`docs/skills/`)

Index: [docs/skills/README.md](skills/README.md) · [docs/skills/README.ko.md](skills/README.ko.md).

These guides describe `/scc:*`. They are **not** `skills/*/SKILL.md` (runtime). EN and KO are maintained independently.

### Index

| path | audience | role | status |
|---|---|---|---|
| [docs/skills/README.md](skills/README.md) | user | Skill-guide index (EN): 16 skills + 3 tool-only; auto-router vs slash-only; write/God Hands double-review | drift-fixed-this-run |
| [docs/skills/README.ko.md](skills/README.ko.md) | user | 스킬 가이드 색인 (한국어) | drift-fixed-this-run |

### 16 skills

| path | audience | role | status |
|---|---|---|---|
| [docs/skills/analyze.md](skills/analyze.md) | user | Apply a named strategic framework (SWOT, RICE, OKR, GTM, …) | canonical |
| [docs/skills/analyze.ko.md](skills/analyze.ko.md) | user | SWOT, RICE, OKR, GTM 등 전략 프레임워크 적용 | canonical |
| [docs/skills/batch.md](skills/batch.md) | user | Slash-only: 2–10 independent parallel units | canonical |
| [docs/skills/batch.ko.md](skills/batch.ko.md) | user | 슬래시 전용: 독립 유닛 병렬 분할 | canonical |
| [docs/skills/coach.md](skills/coach.md) | user | Settle a decision fork into a project standard | canonical |
| [docs/skills/coach.ko.md](skills/coach.ko.md) | user | 의사결정 갈림길을 프로젝트 기준으로 확정 | canonical |
| [docs/skills/collect.md](skills/collect.md) | user | Collect URLs, notes, files, excerpts into PARA knowledge | canonical |
| [docs/skills/collect.ko.md](skills/collect.ko.md) | user | URL·노트·파일·발췌를 PARA 지식으로 수집 | canonical |
| [docs/skills/discover.md](skills/discover.md) | user | Find candidate skills when the current set cannot handle the task | canonical |
| [docs/skills/discover.ko.md](skills/discover.ko.md) | user | 현재 스킬로 처리할 수 없을 때 후보 스킬 탐색 | canonical |
| [docs/skills/evolve.md](skills/evolve.md) | maintainer | Evolve a recurring-failure prompt asset (never auto-routed) | canonical |
| [docs/skills/evolve.ko.md](skills/evolve.ko.md) | maintainer | 반복 실패 프롬프트 자산 진화 (자동 라우팅 없음) | canonical |
| [docs/skills/godhands.md](skills/godhands.md) | user | Public orchestrator: gated Gather → Draft → Check → Cut. Runtime stays `pdca_*` | canonical |
| [docs/skills/godhands.ko.md](skills/godhands.ko.md) | user | 공개 오케스트레이터: 게이트가 있는 수집 → 초안 → 검사 → 손질. 런타임은 `pdca_*` | canonical |
| [docs/skills/loop.md](skills/loop.md) | maintainer | Benchmark prompt assets (public maintainer command; never auto-routed) | canonical |
| [docs/skills/loop.ko.md](skills/loop.ko.md) | maintainer | 프롬프트 자산 벤치마크 (메인테이너 전용, 자동 라우팅 없음) | canonical |
| [docs/skills/pdca.md](skills/pdca.md) | user | Slash-only compat for God Hands. Runtime and MCP stay `pdca_*` | canonical |
| [docs/skills/pdca.ko.md](skills/pdca.ko.md) | user | God Hands의 슬래시 전용 호환 이름. 런타임과 MCP는 `pdca_*` | canonical |
| [docs/skills/refine.md](skills/refine.md) | user | Iterate a draft until it meets a review target | canonical |
| [docs/skills/refine.ko.md](skills/refine.ko.md) | user | 리뷰 목표를 충족할 때까지 초안 개선 | canonical |
| [docs/skills/research.md](skills/research.md) | user | Iterative web research and synthesis | canonical |
| [docs/skills/research.ko.md](skills/research.ko.md) | user | 웹 탐색과 종합 리서치 | canonical |
| [docs/skills/review.md](skills/review.md) | user | Parallel specialized review (content, strategy, or code) | canonical |
| [docs/skills/review.ko.md](skills/review.ko.md) | user | 병렬 전문 리뷰어로 콘텐츠·전략·코드 검토 | canonical |
| [docs/skills/soul.md](skills/soul.md) | user | Observe patterns and synthesize `SOUL.md` | canonical |
| [docs/skills/soul.ko.md](skills/soul.ko.md) | user | 패턴 관찰 후 `SOUL.md` 정체성 프로필 합성 | canonical |
| [docs/skills/translate.md](skills/translate.md) | user | EN↔KO translation with formatting preserved | canonical |
| [docs/skills/translate.ko.md](skills/translate.ko.md) | user | 서식 유지 한영 번역 | canonical |
| [docs/skills/workflow.md](skills/workflow.md) | user | Slash-only named replay of `/scc:*` steps. Autopilot is a `/scc:workflow` preset (not God Hands gates) | canonical |
| [docs/skills/workflow.ko.md](skills/workflow.ko.md) | user | 슬래시 전용 이름 재생. autopilot은 `/scc:workflow` 프리셋(God Hands 게이트 없음) | canonical |
| [docs/skills/write.md](skills/write.md) | user | Produce newsletter/article/report/shorts/social. Default internal `/scc:review` unless `--skip-review` | canonical |
| [docs/skills/write.ko.md](skills/write.ko.md) | user | 뉴스레터·아티클·리포트·쇼츠·소셜 작성. 기본 내부 `/scc:review` (`--skip-review`로 생략) | canonical |

### 3 tool-only commands (not skills)

| path | audience | role | status |
|---|---|---|---|
| [docs/skills/viewer.md](skills/viewer.md) | user | `/scc:viewer` — open or export run artifacts. Command, not a skill | canonical |
| [docs/skills/viewer.ko.md](skills/viewer.ko.md) | user | `/scc:viewer` — 런 아티팩트 열기·내보내기. 스킬 아님 | canonical |
| [docs/skills/unblock.md](skills/unblock.md) | user | `/scc:unblock` — recover readable content from a blocked/JS-heavy URL. Engine in `skills/unblock/` (no `SKILL.md`) | canonical |
| [docs/skills/unblock.ko.md](skills/unblock.ko.md) | user | `/scc:unblock` — 차단·JS URL에서 본문 복구. 엔진은 `skills/unblock/` (SKILL.md 없음) | canonical |
| [docs/skills/standard-check.md](skills/standard-check.md) | user | `/scc:standard-check` — run recorded project standards against one artifact | canonical |
| [docs/skills/standard-check.ko.md](skills/standard-check.ko.md) | user | `/scc:standard-check` — 기록된 프로젝트 기준을 아티팩트 하나에 실행 | canonical |

## 4. Plugin manifests / 플러그인 매니페스트

Claude: `claude plugin marketplace add unclejobs-ai/second-claude-code` then `claude plugin install scc`.

Codex: `codex plugin marketplace add unclejobs-ai/second-claude-code --ref main` then `codex plugin add scc@scc`.

Grok: `grok plugin install unclejobs-ai/second-claude-code --trust`. This tree ships `.grok-plugin/plugin.json`.

| path | audience | role | status |
|---|---|---|---|
| [.claude-plugin/plugin.json](../.claude-plugin/plugin.json) | maintainer | Claude plugin: name `scc`, version `3.1.0`, 3 MCP servers (`pdca-state`, optional `playwright`, optional `mmbridge`) | drift-fixed-this-run |
| [.claude-plugin/marketplace.json](../.claude-plugin/marketplace.json) | maintainer | Claude marketplace listing: plugin id `scc`, version `3.1.0` | drift-fixed-this-run |
| [.grok-plugin/plugin.json](../.grok-plugin/plugin.json) | maintainer | Grok plugin manifest: name `scc`, version `3.1.0` | drift-fixed-this-run |
| [.codex-plugin/plugin.json](../.codex-plugin/plugin.json) | maintainer | Codex-native manifest: skills + plugin-relative MCP. No `CLAUDE_PLUGIN_ROOT` | drift-fixed-this-run |
| [.mcp.json](../.mcp.json) | maintainer | Codex MCP: `pdca-state` on; `playwright` and `mmbridge` `enabled: false` | canonical |

## 5. Runtime command note / 런타임 명령 메모

Not a user manual. Listed because soul observation path was a documented drift item.

| path | audience | role | status |
|---|---|---|---|
| [commands/soul.md](../commands/soul.md) | maintainer | `/scc:soul` wrapper. Observation count now uses `soul/observations/*.jsonl` (daily files hooks write), not `soul/observations.jsonl` | drift-fixed-this-run |

Do not treat `skills/*/SKILL.md`, `tests/`, `ui/`, `packages/core/` sources, `mcp/`, or `hooks/` as public product docs in this index.

## 6. Archive candidates / 보관·삭제 후보 (leave on disk this run)

Do **not** delete in this run. Do **not** use as current 3.1.0 contracts. Historical snapshots mention 18 skills, Deep Interview / `/scc:deep-interview`, and (in some specs) 31 MCP tools.

### `docs/RELEASE-v*` (v0.9.0–v1.5.2)

| path | audience | role | status |
|---|---|---|---|
| [docs/RELEASE-v0.9.0.md](RELEASE-v0.9.0.md) | historical | v0.9.0 snapshot | archive-candidate |
| [docs/RELEASE-v1.0.0.md](RELEASE-v1.0.0.md) | historical | v1.0.0 snapshot (cycle memory) | archive-candidate |
| [docs/RELEASE-v1.3.0.md](RELEASE-v1.3.0.md) | historical | v1.3.0 snapshot (PDCA hard gates) | archive-candidate |
| [docs/RELEASE-v1.3.0.ko.md](RELEASE-v1.3.0.ko.md) | historical | v1.3.0 스냅샷 (한국어) | archive-candidate |
| [docs/RELEASE-v1.4.0.md](RELEASE-v1.4.0.md) | historical | v1.4.0 snapshot (cross-plugin orchestrator) | archive-candidate |
| [docs/RELEASE-v1.4.0.ko.md](RELEASE-v1.4.0.ko.md) | historical | v1.4.0 스냅샷 (한국어) | archive-candidate |
| [docs/RELEASE-v1.5.0.md](RELEASE-v1.5.0.md) | historical | v1.5.0 snapshot (`unblock` as a skill — now a tool-only command) | archive-candidate |
| [docs/RELEASE-v1.5.0.ko.md](RELEASE-v1.5.0.ko.md) | historical | v1.5.0 스냅샷 (한국어) | archive-candidate |
| [docs/RELEASE-v1.5.2.md](RELEASE-v1.5.2.md) | historical | v1.5.2 snapshot (Deep Interview as 18th skill, Code Engineering Lane) | archive-candidate |
| [docs/RELEASE-v1.5.2.ko.md](RELEASE-v1.5.2.ko.md) | historical | v1.5.2 스냅샷 (Deep Interview 18번째 스킬) | archive-candidate |

### Other historical docs

| path | audience | role | status |
|---|---|---|---|
| [docs/changelog-archive.md](changelog-archive.md) | historical | Pre-3.0 changelog dump (v1.2.0 and older). Current changes: [CHANGELOG.md](../CHANGELOG.md) | archive-candidate |
| [docs/demo.tape](demo.tape) | historical | vhs demo script (`docs/images/demo.gif`). Auto-routing copy is stale | archive-candidate |
| [docs/maintenance/residual-worktrees-2026-09-06.md](maintenance/residual-worktrees-2026-09-06.md) | historical | 2026-09-06 worktree recovery notes. Core 4.0.0 vs plugin 3.0.3 | archive-candidate |
| [docs/proposals/evolve-ouroboros-spec.md](proposals/evolve-ouroboros-spec.md) | historical | 2026-06-12 evolve design proposal, not a current contract | archive-candidate |
| [docs/superpowers/plans/2026-03-22-mmbridge-full-integration.md](superpowers/plans/2026-03-22-mmbridge-full-integration.md) | historical | Past MMBridge Phase 1 implementation plan | archive-candidate |
| [docs/superpowers/plans/2026-08-10-coach-phase-1.md](superpowers/plans/2026-08-10-coach-phase-1.md) | historical | Past `deep-interview` → `coach` plan | archive-candidate |
| [docs/superpowers/specs/2026-03-22-mmbridge-full-integration-design.md](superpowers/specs/2026-03-22-mmbridge-full-integration-design.md) | historical | Past MMBridge Phase 1 design | archive-candidate |
| [docs/superpowers/specs/2026-03-23-companion-daemon-design.md](superpowers/specs/2026-03-23-companion-daemon-design.md) | historical | Past companion-daemon design | archive-candidate |
| [docs/superpowers/specs/2026-08-10-decision-standards-design.md](superpowers/specs/2026-08-10-decision-standards-design.md) | historical | Past decision-standards design (mentions 18 skills / 31 MCP tools) | archive-candidate |

## 7. Do not ship / 배포하지 말 것

| path | audience | role | status |
|---|---|---|---|
| [translations/](../translations/) | historical | Claude Mythos Preview System Card Korean translation workspace (`translations/claude-mythos-preview-system-card-ko/`). Not SCC product docs | do-not-ship |

---

## Not listed / 이 색인에 넣지 않음

- `.data/`, `.claude/agent-memory` — runtime state, not product docs
- `skills/*/SKILL.md`, `hooks/`, `mcp/`, `ui/`, `tests/` — implementation (edit only when that file is in the assigned list)
- Every `agents/*.md` body — roster lives in [agents/README.md](../agents/README.md)
- Every `commands/*.md` except the soul observation note above

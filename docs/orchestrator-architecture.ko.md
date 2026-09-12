[English](orchestrator-architecture.md) | **한국어**

# 오케스트레이터 아키텍처 — SCC 3.1.1

SCC 3.1.1의 크로스-플러그인 오케스트레이터는 설치된 플러그인 capability를 런타임에 발견하고
사용자 의도와 점수화한 뒤, 호출자가 검토할 자문용 dispatch plan을 반환합니다.
오케스트레이터나 MCP 도구가 외부 Skill 또는 슬래시 커맨드를 실행하지는 않습니다.

`unblock` 체인은 별도 접근 경로로 제공됩니다. URL 복구가 필요할 때 호출자가 `/scc:unblock`을
선택할 수 있으며, prompt-detect가 이를 자동 호출하거나 invocation 지시를 주입하지 않습니다.
구현은 `skills/unblock/engine/`과 `commands/unblock.md`를 참고하세요.

## 내장 오케스트레이터와 이 플래너

이 문서는 **자문용 크로스-플러그인 플래너**를 설명합니다. 스킬이 아니고 작업을 실행하지 않으며,
네 번째 오케스트레이터도 아닙니다. 내장 오케스트레이터는 `/scc:godhands` 하나입니다. 말로 부를 때는
신의 손이라고 해도 됩니다. `/scc:pdca`는 슬래시 전용 호환 이름이고,
`/scc:workflow`는 슬래시 전용 이름 있는 재생이며, `/scc:batch`는 슬래시 전용 병렬 분할입니다.
사용자는 여전히 `/scc:*`로 부르지만, 자동 라우트의 동등한 오케스트레이터는 아닙니다.

| 종류 | 명령 | 고를 때 |
| --- | --- | --- |
| 내장 오케스트레이터 | `/scc:godhands` | 한 건의 복합 작업에 게이트가 있는 수집 → 초안 → 검사 → 손질이 필요할 때. `/scc:pdca`는 슬래시 전용 호환 이름이며 런타임은 `pdca_*`입니다. |
| 슬래시 전용 이름 있는 재생 | `/scc:workflow` | 재사용하거나 순서가 있는 단계. `autopilot` 프리셋은 그 Hands 패스를 저장된 파이프라인으로 근사합니다 (`research` → `analyze` → `write --skip-research --skip-review` → `review` → `refine`). Hands 런타임 게이트 자체는 아닙니다. 자동 라우트되지 않습니다. |
| 슬래시 전용 병렬 분할 | `/scc:batch` | 독립 단위로 나눌 수 있는 대규모 동종 작업을 병렬로 돌릴 때. 자동 라우트되지 않습니다. |

아래 다이어그램 Layer 1("복합 의도인가?")은 호출자가 내장 오케스트레이터 `/scc:godhands`를
선택할 수 있다는 힌트일 뿐입니다. `godhands`를 자동 디스패치하지 않습니다. `/scc:workflow`와
`/scc:batch`는 슬래시 전용(이름 있는 재생·병렬 분할)입니다. Hands 초안이 `/scc:workflow`를
언급할 때는 명시적 슬래시이지 자동 라우트가 아닙니다.

`write`는 `--skip-review`가 없으면 내부에서 `/scc:review`를 실행합니다. Hands 검사는 별도의
리뷰입니다. 직접 `/scc:write` 다음에 `/scc:godhands`를 붙이면 초안이 write 내부 리뷰를 건너뛰지
않는 한 리뷰가 두 번입니다. Hands 자신의 초안 경로는 이미 `--skip-review`를 넘깁니다.

## 디스패치 레이어

```mermaid
flowchart TB
    U[사용자 프롬프트] --> L1{"Layer 1<br/>복합 의도인가?"}
    L1 -->|예| HANDS[["호출자가 /scc:godhands를 선택할 수 있음"]]
    L1 -->|아니오| L2["호출자가 라우트 계획을 요청"]
    L2 --> G[getDispatchPlan]
    G --> D[런타임 플러그인 발견]
    D --> C[Capability map]
    C --> S["의도 점수화 + preferred-plugin 보정"]
    S --> L3{"Layer 3<br/>호출자 판단"}
    L3 -->|적절하면 명시적으로 호출| O[["선택적 외부 호출"]]
    L3 -->|그 외| I[["내장 스킬/커맨드 사용"]]

    style HANDS fill:#fff3bf,stroke:#f08c00
    style O fill:#d3f9d8,stroke:#2f9e44
    style I fill:#e7f5ff,stroke:#1971c2
```

`prompt-detect` 훅은 오케스트레이터가 아닙니다. 활성 기준의 literal trigger만 보고합니다.
`orchestrator_route` 같은 MCP 호출을 명시적으로 해야 route plan을 요청하며, 계획을 받는 것
자체가 추천 capability를 실행하지는 않습니다.

1. **런타임 발견** - `hooks/lib/plugin-discovery.mjs`가 `~/.claude/plugins/installed_plugins.json`, 각 플러그인의 `skills/`, `commands/`, `agents/`, `.claude-plugin/plugin.json`을 스캔합니다.
2. **의도 점수화** - `getDispatchPlan()`이 키워드나 PDCA 페이즈를 정규화하고, 플러그인 capability를 점수화하고, preferred-plugin 보정을 적용한 뒤, 정렬된 자문 계획과 capability 후보를 반환합니다.
3. **호출자 결정** - caller가 반환된 계획을 검토한 뒤 필요할 때만 외부 capability를 명시적으로 호출합니다.

**탐지되는 것과 고정된 것.** 어떤 플러그인이 있고 그 안에 무슨 스킬·커맨드·에이전트가 들었는지는 런타임에 디스크에서 읽습니다. 반면 고정된 건 선호 표입니다. `plugin-discovery.mjs`의 `INTENT_PROFILES`가 lifecycle 의도별 선호 플러그인(리뷰→`coderabbit`, act→`commit-commands`, 디자인→`frontend-design`, 메모리·리서치→`claude-mem`)을 박아 뒀고, 새로 깐 리뷰 플러그인은 탐지·점수화는 되지만 `+60` 선호 가산점은 기본값으로는 못 받습니다.

다만 이 기본값은 소스를 고치지 않고 덮어쓸 수 있습니다. `${CLAUDE_PLUGIN_DATA}`에 `plugin-preferences.json`을 두고 의도별로 적으면 됩니다 — `{"review": ["my-reviewer"], "commit": []}`. 빈 배열이면 가산점을 아예 없애서 텍스트 매칭만으로 겨루게 합니다. 파일이 깨져 있으면 라우팅을 죽이지 않고 무시합니다.

## 검증된 라우트

**기본 설정 기준**입니다. `plugin-preferences.json`으로 덮어쓰면 lifecycle 의도별 1순위가 달라지므로, 아래는 사장님 머신의 결과가 아니라 출하 기본값입니다.

| 입력 | 의도 | 1순위 자문 후보 |
| --- | --- | --- |
| `phase=plan` | PDCA Plan | `Skill: claude-mem:knowledge-agent` |
| `phase=do` | PDCA Do | `Skill: frontend-design:frontend-design` |
| `phase=check` | PDCA Check | `Skill: coderabbit:code-review` |
| `phase=act` | PDCA Act | `/commit-commands:commit` |
| `코드 리뷰해줘` | 리뷰 lifecycle 의도 | `Skill: coderabbit:code-review` |
| `커밋해줘` | Act lifecycle 의도 | `/commit-commands:commit` |
| `posthog event analysis` | 직접 일반 플러그인 매칭 | `Skill: posthog:exploring-autocapture-events` |

짧은 키워드는 단어 경계 검사를 거칩니다. 예를 들어 `bug` 같은 작은 토큰이 `debugging` 안에서 우연히 매칭되는 일을 막습니다.

## 세션 시작 컨텍스트

```mermaid
flowchart LR
    SS[SessionStart hook] --> STATE[상태·컨텍스트 복원]
    STATE --> CTX[시스템 리마인더]
```

세션 시작 시 훅은 런타임 상태와 컨텍스트를 복원·주입합니다. 설치 플러그인을 스캔하거나
"Active Plugin Dispatch" 표를 주입하지 않습니다. 플러그인 탐색은 오케스트레이터 도구를
명시적으로 요청할 때 수행됩니다.

## 프롬프트 레벨 디스패치

`prompt-detect`는 활성 기준의 literal trigger가 있는지만 알리고 외부 capability 계획이나 호출
지시를 주입하지 않습니다. route plan이 필요하면 caller가 오케스트레이터 도구를 요청합니다.

```text
Advisory route plan (example):
Skill: coderabbit:code-review
```

위 이름은 실행 결과가 아니라 자문용 계획입니다. caller가 적절하다고 판단할 때만 명시적으로
호출하고, 아니면 내장 스킬·커맨드를 사용합니다. `orchestrator_*` MCP는 인벤토리·검사·계획·
상태 정보만 제공합니다.

## MCP 서버 — 3개

`.claude-plugin/plugin.json`에 MCP 서버가 세 개 등록됩니다. 사용자에게 보이는 숫자는 도구
총합이 아니라 이 서버 개수입니다.

| 서버 | 필수 | 역할 |
| --- | --- | --- |
| `pdca-state` | 예 | 번들된 상태·메모리·soul·데몬/세션·자문용 오케스트레이터 도구 |
| `playwright` | 선택 | JavaScript 렌더링 페이지용 Chromium 접근 |
| `mmbridge` | 선택 | 외부 멀티모델 리서치·리뷰 |

`playwright`와 `mmbridge`는 `optional: true`입니다. 패키지와 캐시는 핵심 시작 경로에 들어가지
않습니다. Playwright를 쓸 수 없으면 리서치가 갭을 기록하고 폴백 경로를 씁니다. MMBridge를
쓸 수 없으면 이를 쓰는 스킬은 외부 패스를 건너뜁니다. 사전 번들된 `pdca-state` 서버는 계속
사용할 수 있습니다.

### pdca-state 도구 표면

번들된 `pdca-state` 서버는 도구 31개를 노출합니다. 인벤토리·계획·상태만 다루며 Skill이나
슬래시 커맨드를 실행하지 않습니다.

| 영역 | 개수 | 도구 |
| --- | ---: | --- |
| PDCA 상태 | 9 | `pdca_get_state`, `pdca_start_run`, `pdca_transition`, `pdca_check_gate`, `pdca_end_run`, `pdca_update_stuck_flags`, `pdca_list_runs`, `pdca_get_events`, `pdca_get_analytics` |
| 사이클 메모리 | 3 | `pdca_get_cycle_history`, `pdca_save_insight`, `pdca_get_insights` |
| Soul | 6 | `soul_get_profile`, `soul_record_observation`, `soul_get_observations`, `soul_retro`, `soul_get_synthesis_context`, `soul_get_readiness` |
| 프로젝트 메모리 | 2 | `project_memory_get`, `project_memory_upsert` |
| 데몬과 세션 | 7 | `daemon_get_status`, `daemon_schedule_workflow`, `daemon_list_jobs`, `daemon_start_background_run`, `daemon_list_background_runs`, `daemon_queue_notification`, `session_recall_search` |
| 오케스트레이터 | 4 | `orchestrator_list_plugins`, `orchestrator_get_plugin`, `orchestrator_route`, `orchestrator_health` |

네 개의 `orchestrator_*` 도구는 `pdca-state`에 있습니다. 플러그인 인벤토리, 단일 플러그인 조회,
라우트 계획, 생태계 상태 점검을 위한 공개 MCP 표면입니다.

## 파일 구조

```text
second-claude/
├── hooks/
│   ├── session-start.mjs              # 상태·컨텍스트 복원·주입; 플러그인 스캔 없음
│   ├── prompt-detect.mjs              # 활성 기준 literal trigger 보고
│   └── lib/
│       ├── plugin-discovery.mjs       # 런타임 스캐너, 점수화, 디스패치 플래너
│       └── soul-observer.mjs          # 훅용 soul readiness 헬퍼
├── mcp/
│   ├── pdca-state-server.bundle.mjs   # 런타임에서 쓰는 사전 번들 pdca-state 서버 (31개 도구)
│   ├── pdca-state-server.mjs          # 개발·테스트용 읽기 쉬운 원본
│   └── lib/
│       ├── orchestrator-handlers.mjs  # orchestrator_* 도구 구현
│       ├── soul-handlers.mjs
│       └── ...
├── tests/
│   ├── hooks/prompt-detect-standards.test.mjs
│   └── mcp/orchestrator-handlers.test.mjs
└── config/
    └── stage-contracts.json           # PDCA 페이즈 계약
```

## 검증 범위

- 검증 수치는 실행 시점의 테스트 결과를 따르며 이 문서에 고정하지 않습니다.
- `tests/hooks/prompt-detect-standards.test.mjs`: 활성 기준의 트리거 문자열이 프롬프트에 그대로 들어 있으면 그 기준과 파일 경로를 띄우는지 검증합니다. 이 훅이 들고 있던 키워드 라우터는 제거됐습니다. 근거만 제시하고 스킬 호출을 지시하지 않습니다.
- `tests/mcp/orchestrator-handlers.test.mjs`: 실제 발견된 플러그인 데이터, preferred phase routing, 일반 플러그인 매칭, 짧은 키워드 경계 guard를 검증합니다.
- `tests/integration/skill-flow.test.mjs`: 자연어 명령이 등록된 커맨드 문서와 대응 스킬로 해석되는 기본 흐름을 검증합니다.

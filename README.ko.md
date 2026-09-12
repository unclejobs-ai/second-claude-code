[English](README.md) | **한국어**

![version](https://img.shields.io/badge/version-3.1.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)

# Second Claude Code — 세컨클코

**God Hands. 나를 대신할 손.**

찾고, 분석하고, 기획하고, 분해하고, 벤치마크하고, 개선한다. Check를 건너뛰면 신의 손이 아니다.

`/scc:godhands`가 그 여섯 동작을 게이트 있는 한 패스로 돌린다.

| | |
|---|---|
| 표시 이름 | **Second Claude Code** |
| 방법 | **God Hands** (`/scc:godhands`) · 신의 손 |
| 플러그인 id | **`scc`** |
| 슬래시 네임스페이스 | **`/scc:*`** |
| GitHub | **[unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)** |

세컨클코는 지식일 워크플로 플러그인이다. 스킬 카탈로그가 아니라, 사용자를 대신할 손이다.
찾고 (`research`) 분석하고 (`analyze`) 기획하고 (`coach`) 분해하고 (`batch`) 벤치마크하고
(`review`) 개선한다 (`refine`). 이 트리는 **스킬 16개**, **명령 마크다운 19개**와
`commands/version.mjs`, **에이전트 17개**, **훅 이벤트 10개**, **MCP 서버 3개**
(`pdca-state`, 선택적 Playwright, 선택적 MMBridge)이다.
기본 자동 라우터는 `/scc:godhands`, `/scc:research`, `/scc:write`, `/scc:review`,
`/scc:refine`, `/scc:coach`이다. 접힌 스킬은 디스크에 그대로 있으며
`/scc:<name>`으로 호출한다. 오케스트레이터는 `/scc:godhands`(God Hands, 신의 손) 하나뿐이다.
`/scc:pdca`는 슬래시 전용 호환 이름이다.
`/scc:workflow`는 이름 있는 재생(슬래시)이고 `/scc:batch`는 독립 병렬
분할(슬래시)이다.

모든 프롬프트를 자동으로 스킬에 배정하지는 않습니다. 모든 스킬이 `user-invocable: false`라서
Claude Code는 자연어 요청을 `skills/*/SKILL.md`가 아니라 `commands/*.md`의 frontmatter
`description`으로 라우팅합니다. `evals/`의 라우팅 평가는 `research`, `write`, `review`,
`refine`, `coach`, `analyze`를 측정하며(3.1.1에서 24/24), 막연한 요청은 패스를 시작하면 안 됩니다.
예측 가능한 진입점이 필요하면 슬래시 명령을 직접 사용하세요. Codex는 `.codex-plugin/plugin.json`으로
16개 스킬을 노출하고, Grok는 `.grok-plugin/` + `walnut.manifest.yaml`로 설치합니다. 둘 다 Claude
슬래시 명령 전체를 그대로 제공하지는 않습니다.

[![Second Claude Code — God Hands](docs/images/thumbnail.png)](https://github.com/unclejobs-ai/second-claude-code)

**이 트리는 3.1.1입니다. GitHub Latest Release는 [v3.1.1](https://github.com/unclejobs-ai/second-claude-code/releases/tag/v3.1.1)입니다.**
아래 세 블록처럼 마켓플레이스 **`main`** 또는 그 릴리즈에서 설치하세요. 예전
`second-claude-code` / 옛 `scc` 캐시는 먼저 지우세요.

**먼저 볼 곳:** [사용 매뉴얼](docs/notion-manual.ko.md) · [스킬 색인](docs/skills/) ·
[명령·문서 색인](docs/README.md) · [아키텍처](docs/architecture.ko.md) ·
[오케스트레이터](docs/orchestrator-architecture.ko.md)

## 설치

실제로 쓰는 호스트의 블록만 실행하세요. 세 경로 모두 **`main`**(3.1.1)을 받습니다.
GitHub Latest Release 태그는 **`v3.1.1`**입니다.

### Claude Code

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

설치 후 Claude Code를 새 세션으로 열고, 다음으로 확인하세요.

```bash
claude plugin list
```

플러그인 id **`scc`**가 보여야 합니다. 명령은 `/scc:godhands`, `/scc:write`처럼 씁니다.

기존 v3 Claude 설치를 업데이트할 때:

```bash
claude plugin update scc
```

업데이트 후 Claude Code를 다시 시작하세요.

Claude Code는 `commands/`와 `skills/`를 모두 등록합니다. 3.1.0부터 모든 스킬에
`user-invocable: false`가 있어 슬래시 메뉴에는 `/scc:*` 이름이 명령 한 번만 보입니다.

### Codex

```bash
codex plugin marketplace add unclejobs-ai/second-claude-code --ref main
codex plugin add scc@scc
```

Codex가 현재 `main`(v3.1.1)을 따라가도록 `--ref main`이 필요합니다.
설치하거나 마켓플레이스를 새로 고친 뒤 Codex를 다시 시작하세요.

Codex는 `.codex-plugin/plugin.json`과 플러그인 상대경로 MCP 설정을 사용하므로
`CLAUDE_PLUGIN_ROOT`가 필요하지 않습니다. 설치된 스킬 이름을 지정하거나 작업을 자연어로
설명하세요. Codex는 `/scc:*` 명령 전체를 동일하게 제공하지 않습니다.

기존 Codex 설치를 새로 고칠 때:

```bash
codex plugin marketplace upgrade scc
codex plugin add scc@scc
```

### Grok

```bash
grok plugin install unclejobs-ai/second-claude-code --trust
```

`--trust`가 필요합니다. 이 저장소에는 **`.grok-plugin/plugin.json`**과
**`walnut.manifest.yaml`**(Walnut 리스팅, 버전 3.1.1)이 있습니다. Grok는 GitHub **`main`**
또는 **v3.1.1** 릴리즈에서 설치합니다. 설치 후에는 Codex와 같이 스킬 이름으로 요청하세요.

### v3 이전 Claude 설치에서 마이그레이션

v3의 캐시 키는 `second-claude-code`가 아니라 `scc`입니다. 이전 항목이 목록에 있으면:

```bash
claude plugin uninstall second-claude-code
claude plugin install scc
```

`second-claude-code`가 목록에 없으면 제거 단계는 건너뛰고 `scc`만 설치하면 됩니다. 새
네임스페이스를 쓰기 전에 세션을 다시 여세요.

## 지속 데이터

런타임 데이터는 런, 사이클 메모리, 소울 관찰, 워크플로, 플러그인 설정입니다. 프로젝트
결정 기준은 여기가 아니라 프로젝트(`.scc/`)에 있습니다.

| 호스트가 제공하는 값 | 데이터 디렉터리 |
|---|---|
| `CLAUDE_PLUGIN_DATA` | 그 절대 경로 |
| 그 외 | `<plugin-root>/.data` |

`<plugin-root>`는 호스트가 `CLAUDE_PLUGIN_ROOT`를 주면 그 값입니다. 없으면 현재 스킬의
`SKILL.md`에서 두 단계 위, 즉 플러그인 루트입니다. Codex와 Grok는 Claude 전용 변수를
자주 생략하므로, 스킬은 스크립트나 상태 경로를 쓰기 전에 이 호스트 중립 폴백을 해석합니다.

기본 `.data/`는 플러그인 설치 안에 있습니다. 플러그인을 교체하면 함께 삭제됩니다.
업데이트 후에도 보존하려면 설치 밖 경로를 지정하세요.

```bash
export CLAUDE_PLUGIN_DATA="$HOME/.scc-data"
```

기준(standards)은 영향받지 않습니다. 프로젝트의
`.scc/standards/<id>/STANDARD.md`에 기록됩니다.

## MCP 서버

플러그인은 **MCP 서버 3개**를 제공합니다.

| 서버 | 기본값 | 설명 |
|---|---|---|
| `pdca-state` | 켜짐 | 자체 포함 번들. 이 서버를 처음 설치할 때 `npm install`, 시작 시 다운로드, 로컬 `node_modules`가 필요하지 않습니다. |
| Playwright | 선택 | 별도 설정. Codex에서는 명시적으로 켜기 전까지 비활성입니다. |
| MMBridge | 선택 | 별도 설정. Codex에서는 명시적으로 켜기 전까지 비활성입니다. |

공개 표면은 이 서버 3개이며, 따로 설치할 도구 목록이 아닙니다. `pdca-state`는 PDCA
상태, 사이클 메모리, 소울, 프로젝트 메모리, 세션 회수, 자문형 크로스 플러그인 계획을
위한 도구도 노출하지만, 그 도구는 조회·자문만 합니다. 외부 스킬을 대신 실행하지는
않습니다.

## 진입점 고르기

`/scc:*`는 Claude Code용 표면입니다. Codex와 Grok에서는 같은 행의 스킬 이름을 사용하세요.

기본 자동 라우터는 `/scc:godhands`, `/scc:research`, `/scc:write`, `/scc:review`,
`/scc:refine`, `/scc:coach`입니다. `analyze`는 God Hands Gather(`/scc:analyze`)이며
최상위 초이스 행이 아닙니다. 접힌 스킬은 디스크에 그대로 있으며 `/scc:<name>`으로
호출합니다.

아래 항목은 서로 바꿔 쓸 수 없습니다.

| 하고 싶은 일 | 사용 | 아닌 것 |
|---|---|---|
| 초안 하나 작성 (아티클·보고서·뉴스레터 등) | `/scc:write` | 게이트가 있는 패스가 아닙니다. `--skip-review`를 주지 않으면 내부 리뷰가 실행됩니다. |
| 기존 파일을 목표까지 반복 수정 | `/scc:refine` | 처음부터 작성하는 단계가 아닙니다. 매 라운드가 리뷰 후 수정입니다. |
| 게이트가 있는 수집 → 초안 → 검사 → 손질 패스 | `/scc:godhands` | 저장된 파이프라인이 아닙니다. Check는 독립 리뷰 단계입니다. |

| 하고 싶은 일 | 사용 |
|---|---|
| 주제를 조사하고 브리프 저장 | `/scc:research` |
| 기존 산출물 리뷰 | `/scc:review` |
| 갈래를 정하고 프로젝트 기준으로 기록 | `/scc:coach` |

### 도구

| 하고 싶은 일 | 사용 |
|---|---|
| 판단 없는 유틸리티 | `/scc:viewer`, `/scc:unblock`, `/scc:standard-check` |

### 오케스트레이터 하나와 슬래시 유틸리티 둘

오케스트레이터는 `/scc:godhands` 하나뿐입니다. `/scc:workflow`는 이름 있는 재생(슬래시)이고
`/scc:batch`는 독립 병렬 분할(슬래시)입니다. 세 개의 동등한 오케스트레이터가 아닙니다.
Autopilot은 이름 있는 `/scc:workflow` 프리셋이지 맞서는 오케스트레이터가 아닙니다.
God Hands는 여전히 `/scc:research`, `/scc:analyze`, `/scc:write`, `/scc:review`,
`/scc:refine`을 슬래시로 체이닝합니다. Draft에서 `/scc:workflow`를 언급하면 그것은
명시적 슬래시이지 자동 라우트가 아닙니다.

| 하고 싶은 일 | 사용 | 종류 |
|---|---|---|
| 게이트가 있는 수집 → 초안 → 검사 → 손질 패스 하나 | `/scc:godhands` | 오케스트레이터 (자동 라우터) |
| 이름 있는 단계 목록을 저장·재생 (또는 autopilot) | `/scc:workflow` | 슬래시 전용 이름 재생. Autopilot은 God Hands를 흉내 냅니다 (research → analyze → write → review → refine). God Hands 게이트를 **강제하지 않습니다**. |
| 같은 유형의 작업을 독립 병렬 단위로 분할 | `/scc:batch` | 슬래시 전용 병렬 분할. 단위끼리 의존하면 안 됩니다. 순차 작업은 `workflow` 또는 `godhands`로 가세요. |

슬래시 전용 (디스크에 유지): `collect`, `discover`, `translate`, `batch`,
`workflow`, `soul`, `loop`, `evolve`.

### `write --skip-review`와 God Hands Check

`write`는 `--skip-review`가 없으면 내부에서 `/scc:review`(기본 `quick` 프리셋)를 실행합니다.
이 패스는 훅이 아니라 write 스킬의 기본 동작입니다.

God Hands **Check**는 **별도의** 리뷰입니다. Draft 단계는 write를 `--skip-research --skip-review`로
호출해 Check가 품질을 맡도록 되어 있습니다. `/scc:write`로 초안을 만든 뒤 같은 산출물을
`/scc:godhands`로 감싸면, 건너뛰지 않는 한 리뷰가 두 번 돕니다.

직접 이어서 쓸 때도 같은 규칙입니다.

- 단독 `/scc:write` — 내부 리뷰를 그대로 두거나, 다른 단계가 리뷰할 때만 건너뛰세요.
- `/scc:godhands` — Draft는 write의 내부 리뷰를 건너뛰고, Check가 리뷰합니다.
- `/scc:workflow` autopilot — 맞서는 오케스트레이터가 아니라 이름 있는
  `/scc:workflow` 프리셋입니다. 포함된 프리셋이 write에 이미 `--skip-research --skip-review`를
  넘긴 뒤 `/scc:review`와 `/scc:refine`을 실행합니다. 그 위에 God Hands Check를 올리면 세 번째
  패스가 됩니다.

`--skip-research`는 실제 출처 자료를 이미 주었거나 Plan/워크플로가 이미 만든 경우에만
쓰세요.

```text
/scc:research "AI 에이전트 프레임워크" --depth medium
/scc:write --format report --skip-research --input report-notes.md
/scc:write --format report --skip-research --skip-review --input draft.md
/scc:review draft.md --preset content
/scc:refine "4.5/5까지 올려줘" --file draft.md --max 3
/scc:godhands "AI 에이전트 시장 보고서" --depth deep
/scc:workflow run autopilot --topic "edge computing"
/scc:batch --topic "AI 인프라 10부작" --skill write --parallel 3
```

## 리서치 깊이

`research`는 Jina Search를 기본 검색 경로로 사용합니다. Jina를 쓸 수 없거나 페이지를
읽지 못하면 WebSearch/WebFetch, 가능할 경우 unblock 또는 Playwright 경로로 넘어갑니다.
자격 증명, 속도 제한, 선택적 연동 상태에 따라 가능한 경로가 달라지며, 선택한 깊이 계약
이외의 특정 제공자나 결과 수를 보장하지 않습니다.

| 깊이 | 검색 계약 |
|---|---|
| `shallow` | Jina Search를 정확히 3회 호출하고 심층 읽기는 하지 않음 |
| `medium` | Jina Search를 정확히 5회 호출하고 Jina Reader 심층 읽기를 최대 2회 수행 |
| `deep` | Jina Search 10회 이상, Jina Reader 심층 읽기 제한 없음, 제한된 빈틈 보완 라운드 |

레거시 WebSearch/WebFetch 엔진을 명시했거나 Jina를 쓸 수 없으면 동일한 검색·읽기 계약을
해당 대체 엔진으로 수행합니다. 출처 검증과 빈틈 처리는 [리서치 가이드](docs/skills/research.ko.md)를
참고하세요.

## 16개 스킬과 도구 전용 명령 3개

스킬은 판단을 내리거나 작업물을 만듭니다. 도구 전용 명령 3개는 유틸리티를 실행하며 스킬
목록의 자리를 차지하지 않습니다. `skills/unblock/`에는 fetch 엔진이 남아 있고
`SKILL.md`는 없습니다.

자동 라우터: `coach`, `godhands`, `refine`, `research`, `review`, `write`. God Hands Gather
(초이스 행 아님): `analyze`. 슬래시 전용: `batch`, `collect`, `discover`,
`evolve`, `loop`, `soul`, `translate`, `workflow`. 슬래시 전용 호환: `pdca`.

| 스킬 | 역할 | 라우팅 |
|---|---|---|
| `godhands` | 게이트가 있는 수집 → 초안 → 검사 → 손질 패스 오케스트레이션 | 자동 라우터 (오케스트레이터) |
| `coach` | 방어 가능한 방향 중 하나를 정하고 프로젝트 기준으로 기록 | 자동 라우터 |
| `research` | 출처를 검색·검증하고 빈틈을 찾아 리서치 브리프 작성 | 자동 라우터 |
| `analyze` | 15개 전략 프레임워크 중 하나를 적용 | God Hands Gather (초이스 행 아님) |
| `write` | 포맷별 계약에 맞는 근거 기반 초안 작성 | 자동 라우터 |
| `review` | 선택한 리뷰어 2~5명 패널과 합의 게이트 실행 | 자동 라우터 |
| `refine` | 소견을 반영하고 목표까지 반복 개선 | 자동 라우터 |
| `collect` | URL·메모·발췌문을 PARA 지식 구조로 저장 | 슬래시 전용 |
| `workflow` | 재사용 가능한 스킬 파이프라인 생성·실행 | 슬래시 전용 |
| `discover` | 후보 스킬을 찾고 평가하며, 설치는 명시적 승인 필요 | 슬래시 전용 |
| `pdca` | God Hands의 슬래시 전용 호환 이름. MCP 상태는 `pdca_*` | 슬래시 전용 호환 |
| `translate` | 형식과 문체를 유지하며 영어·한국어 번역 | 슬래시 전용 |
| `batch` | 같은 유형의 큰 작업을 독립 단위로 분할 | 슬래시 전용 |
| `soul` | 사용자 선호와 패턴의 지속 프로필을 합성 | 슬래시 전용 |
| `loop` | 고정 스위트로 프롬프트 자산 최적화 (유지보수자 전용) | 슬래시 전용 |
| `evolve` | 유지보수자가 작성한 검사에 따라 반복 실패 자산 개선 (유지보수자 전용) | 슬래시 전용 |

| 도구 전용 명령 | 역할 |
|---|---|
| `/scc:viewer` | 런의 산출물과 provenance를 열거나 내보냄 |
| `/scc:unblock` | 차단된 URL에 적응형 9단계 대체 체인을 실행 |
| `/scc:standard-check` | 프로젝트에 기록된 기준을 산출물 하나에 적용 |

[스킬 가이드](docs/skills/)에서 명령 문법, 옵션, 예시, 제한을 확인하세요. 슬래시 전용
스킬은 `disable-model-invocation: true`이며 명령 설명은 보이지만 `/scc:<name>`으로 직접 호출합니다.
유지보수자 전용 `loop`와 `evolve`도 그 슬래시 전용 집합에 있습니다. 공개된
`/scc:loop` 명령은 고정 벤치마크 스위트로 프롬프트 자산을 최적화하는 유지보수자용
직접 진입점입니다.

## 리뷰 프리셋

리뷰 패널은 2~5명의 전문 리뷰어로 구성됩니다. 프리셋이 관점과 투표 기준을 정하며,
Critical 소견이 하나라도 있으면 투표 수와 관계없이 차단됩니다.

기본 투표 기준은 `quick` 2/2, 3명 프리셋은 2/3, `academic`은 3/4, `full`은 3/5입니다.
이는 합의 규칙이며 모든 리뷰의 완료나 통과를 보장하는 약속이 아닙니다.

| 프리셋 | 리뷰어 | 적합한 작업 |
|---|---|---|
| `content` | Deep + Advocate + Tone | 아티클·블로그·뉴스레터 |
| `strategy` | Deep + Advocate + Facts | PRD·SWOT·전략 문서 |
| `code` | Deep + Facts + Structure | 코드 리뷰 |
| `security` | Deep + Facts + Structure | 보안 감사 |
| `academic` | Deep + Facts + Structure + Advocate | 논문·연구 결과 |
| `quick` | Advocate + Facts | 작은 리뷰 패널 |
| `full` | 5명 전체 | 가장 폭넓은 기본 패널 |

예: `/scc:review draft.md --preset academic`.

## Hands와 게이트

God Hands(신의 손)는 모든 요청에 필요한 방식이 아니라, 명시적으로 선택하는 오케스트레이션 경로입니다.
런타임 상태와 MCP 도구는 `pdca_*`입니다.

```text
Gather → 브리프를 위한 리서치와 분석
Draft  → 승인된 계획에 따라 산출물 작성
         (write --skip-research --skip-review)
Check  → 선택한 2~5명 리뷰 패널로 검증
Cut    → 빈틈을 Gather·Draft·Refine 중 알맞은 곳으로 회송
```

단계 전환 가능 여부는 런타임이 강제하는 아래 게이트를 기준으로 판단합니다.

| 전환 | 런타임 검사 항목 |
|---|---|
| Plan → Do | 필수 계획 필드, `sources_count >= 5`, Plan Mode 승인 |
| Do → Check | 산출물 존재, 필수 섹션 완성, 계획 결과 반영 |
| Check → Act | 리뷰어 2명 이상, 표준 판정값 |
| Act → 다음 단계/종료 | 유효한 결정과 원인 범주, 사이클 제한 |

스킬 가이드는 이 런타임 하위 집합보다 넓습니다. 리서치 방법론, 출처 품질, 리뷰어 역할,
포맷 지시, 글쓰기 스타일은 스킬과 에이전트를 위한 지침입니다. 프롬프트 훅이 작업을
자동 호출한다는 뜻이 아니며, 모든 서술형 조건을 상태 MCP 서버가 독립적으로 강제한다는
뜻도 아닙니다. 공개 이름은 [God Hands 가이드](docs/skills/godhands.ko.md), 엔진 계약은
[PDCA 가이드](docs/skills/pdca.ko.md)에서 확인하세요.

코드 작업에는 **코드 엔지니어링 레인**이 같은 게이트 위에 더 엄격한 수용 기준, 격리,
검증자 증거, 핸드오프 지침을 추가합니다. 별도의 런타임이 아니라 PDCA의 전문화입니다.

## 세션을 넘어 남는 기준

`/scc:coach`는 결정된 선택을 프로젝트에 기록할 수 있습니다.

```text
.scc/standards/<id>/STANDARD.md
```

선택한 방향, 탈락한 대안, 재검토 조건, 검사를 함께 보존합니다. 이후 세션이 활성 기준을
읽을 수 있고, `/scc:standard-check artifact.md`가 산출물 하나에 이를 적용합니다. 검사
결과는 `FAIL`, `UNPROVEN`, `UNCHECKED`로 출력되고 깨끗하면 `ok — N standard(s) checked`가 찍히며, adversarial 검사의 통과를
검사기 스스로 만들어내지는 않습니다.

## 상태·연동·백그라운드 작업

라이프사이클 훅은 상태를 복원하고 활성 기준의 literal trigger를 알리며 리뷰 결과와 세션
요약을 저장합니다. 사용자 프롬프트에서 스킬을 선택하거나 호출하지는 않습니다.

크로스 플러그인 탐색은 자문 기능입니다. 오케스트레이터 도구가 설치된 기능을 살펴 순위가
있는 계획을 반환하지만 외부 스킬이나 명령을 실행하지는 않습니다. 제안된 기능은 필요할
때 명시적으로 호출하고 데이터 경계를 먼저 확인하세요.

백그라운드 핸드오프는 Claude Code 명령을 반환할 뿐, 대기 중인 작업을 자체 실행하지 않습니다.

```bash
claude --bg "/scc:workflow run weekly-digest"
claude agents
```

## 설정

따로 둘 설정 파일은 없습니다. 기본값은 각 스킬의 Options 표(`skills/<name>/SKILL.md`)에
있고, `--depth`, `--preset`, `--max` 같은 플래그로 호출마다 덮어씁니다.
`config/config.example.json`은 과거 스케치이며 로드되지 않습니다.

## 더 읽기

- [사용 매뉴얼](docs/notion-manual.ko.md) — 단계별 진입과 예시
- [스킬 가이드](docs/skills/) — 스킬별 문서
- [명령·문서 색인](docs/README.md)
- [아키텍처](docs/architecture.ko.md) — 런타임 경계와 상태 모델
- [오케스트레이터 아키텍처](docs/orchestrator-architecture.ko.md) — 자문형 라우팅
- [변경 이력](CHANGELOG.md) · [이슈](https://github.com/unclejobs-ai/second-claude-code/issues)

이슈와 풀 리퀘스트를 환영합니다. [Unclejobs](https://github.com/unclejobs-ai)가 만들었습니다.

*버전 3.1.1 | GitHub Latest Release [v3.1.1](https://github.com/unclejobs-ai/second-claude-code/releases/tag/v3.1.1) | MIT 라이선스*

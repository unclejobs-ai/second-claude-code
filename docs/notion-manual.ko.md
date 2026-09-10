[English](notion-manual.md) | **한국어**

# Second Claude Code 사용 매뉴얼

> 원하는 진입점을 고르는 실전 중심 가이드

표시 이름은 **Second Claude Code**, 플러그인 id는 **`scc`**, 공개 슬래시 접두사는 **`/scc:`**입니다.
저장소는 [unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)입니다.
플러그인 버전은 **3.1.0**이며, 스킬 16개(`skills/*/SKILL.md`), 명령 마크다운 19개와
`commands/version.mjs`, 에이전트 17개, 훅 이벤트 10개, MCP 서버 3개(`pdca-state`, 선택적 Playwright, 선택적
MMBridge)입니다.

## 1. 가장 작은 유효한 진입점부터 고르기

Second Claude Code는 Claude Code용 플러그인이며 Codex·Grok 설치 경로도 있습니다. 작업에 맞는
가장 작은 항목을 고르세요.

| 필요한 일 | 진입점 |
|---|---|
| 출처를 모으고 종합하기 | `/scc:research` |
| 아티클·보고서·뉴스레터 등 작성 | `/scc:write` |
| 기존 초안이나 코드 산출물 점검 | `/scc:review` |
| 소견을 반영해 반복 수정 | `/scc:refine` |
| 찾고 분석하고 기획하고 분해하고 벤치마크하고 개선하는 한 패스 (God Hands, 신의 손) | `/scc:godhands` |
| 재사용 가능한 이름 있는 파이프라인 (슬래시 전용 이름 재생) | `/scc:workflow` |
| 독립된 같은 유형의 작업을 병렬로 (슬래시 전용 병렬 분할) | `/scc:batch` |

오케스트레이터는 `/scc:godhands` 하나뿐입니다(공개 이름 God Hands, 구어로는 신의 손).
`/scc:pdca`는 슬래시 전용 호환 이름입니다. `/scc:workflow`는 이름 있는 재생(슬래시)이고
`/scc:batch`는 독립 병렬 분할(슬래시)입니다. 세 개의 동등한 기본 오케스트레이터가 아닙니다.

위 `/scc:*` 형태는 Claude Code 슬래시 명령입니다. Codex는 **16개 스킬**을 노출하며 Claude의
`/scc` 명령 전체를 그대로 제공하지는 않습니다. 스킬 이름으로 요청하거나 작업을 자연어로
설명하세요. 도구 전용 명령(`viewer`, `unblock`, `standard-check`)과 `commands/version.mjs`는
Claude 명령 래퍼이며 Codex 스킬이 아닙니다.

자연어 요청은 Claude Code의 일반 스킬 흐름으로 처리할 수 있습니다. SCC 프롬프트 훅이
스킬이나 명령을 자동 배정하지는 않습니다. 확실히 지정하려면 슬래시 명령을 사용하세요.

```text
/scc:research "AI 에이전트 프레임워크" --depth medium
/scc:write --format report --skip-research notes.md
/scc:review proposal.md --preset content
/scc:refine proposal.md --max 3
```

스킬을 직접 실행해도 되며 God Hands로 감쌀 필요는 없습니다.

**리뷰 소유권.** 직접 실행하는 `/scc:write`는 `--skip-review`가 없으면 내부에서
`/scc:review`를 돌립니다. God Hands **Check**는 그와 별개의 리뷰 단계입니다. `/scc:write` 다음에
`/scc:godhands`를 이으면 Draft가 write의 내부 리뷰를 건너뛰지 않는 한(`--skip-review`) 리뷰가 두 번
돌아갑니다. `--skip-research`는 실제 출처 자료를 이미 제공했을 때만 사용하세요.

3.1.0에서는 모든 스킬에 `user-invocable: false`가 있어 `/scc:*` 이름이 한 번만 보입니다(명령).

## 2. 설치·업데이트·마이그레이션

이 저장소의 **GitHub 마켓플레이스**에서 설치하세요. 로컬 체크아웃 디렉터리를 마켓플레이스로
추가하지 마세요.

디스크와 `CHANGELOG.md`의 플러그인 버전은 **3.1.0**입니다(3.0.1, 3.0.2도 기록되어 있습니다).
GitHub **Latest Release**는 여전히 **v3.0.0**입니다. v3.0.3 GitHub Release는 없습니다.
마켓플레이스 설치는 그 오래된 Release 태그가 아니라 저장소를 따릅니다.

### Claude Code

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

새 Claude Code 세션을 열고 다음으로 확인하세요.

```bash
claude plugin list
```

### Codex

```bash
codex plugin marketplace add unclejobs-ai/second-claude-code --ref main
codex plugin add scc@scc
```

설치하거나 마켓플레이스를 새로 고친 뒤 Codex를 다시 시작하세요. Codex는 전용 매니페스트와
플러그인 상대경로 MCP 설정을 사용하므로 `CLAUDE_PLUGIN_ROOT`가 필요하지 않습니다. Codex는
Claude의 `/scc:*` 슬래시 명령 전체를 복제하지 않으며, 스킬 16개만 노출합니다.

기존 Codex 설치를 새로 고칠 때는 다음을 실행합니다.

```bash
codex plugin marketplace upgrade scc
codex plugin add scc@scc
```

### Grok

```bash
grok plugin install unclejobs-ai/second-claude-code --trust
```

훅과 MCP 서버를 로드하려면 `--trust`가 필요합니다. `walnut.manifest.yaml`은 Walnut 목록입니다.
`origin/main`에는 아직 `.grok-plugin/`이 없습니다. 그 브랜치에 없는 Grok 마켓플레이스
디렉터리를 문서화하지 마세요.

### v3 업데이트 (Claude)

```bash
claude plugin update scc
```

업데이트 후 Claude Code를 다시 시작하세요. 버전 3의 명령은 `scc` 네임스페이스를 사용하며,
예를 들어 `/scc:write`처럼 호출합니다.

### 이전 설치에서 마이그레이션

v3에서 네임스페이스와 플러그인 캐시 키가 바뀌었습니다. `claude plugin list`에 이전 항목이
보이면 제거한 뒤 `scc`를 설치하세요.

```bash
claude plugin uninstall second-claude-code
claude plugin install scc
```

이전 항목이 없으면 제거 단계는 건너뛰세요. 새 네임스페이스 명령을 호출하기 전에 Claude
Code를 다시 여세요.

### 플러그인 교체 후에도 런타임 데이터 보존하기

기본 런타임 데이터는 플러그인 디렉터리의 `.data/` 아래에 저장됩니다. Hands 런, 메모리,
소울 데이터, 설정을 교체 후에도 보존하려면 `CLAUDE_PLUGIN_DATA`를 지속 경로로 지정하세요.

```bash
export CLAUDE_PLUGIN_DATA="$HOME/.scc-data"
```

플러그인은 **MCP 서버 3개**를 제공합니다. 번들된 `pdca-state`, 선택적 Playwright, 선택적
MMBridge입니다. `pdca-state`는 자체 포함 번들입니다. 처음 시작할 때 이 서버를 위해
`npm install`, 의존성 다운로드, 로컬 `node_modules` 디렉터리가 필요하지 않습니다.
Playwright와 MMBridge는 설정과 사용 가능 여부가 각각 다릅니다. Codex에서는 두 선택 서버가
기본적으로 꺼져 있습니다. 필요할 때 Codex MCP 설정에서 명시적으로 켜세요.

## 3. 첫 작업

### 주제 조사하기

```text
/scc:research "AI 교육의 현재 동향" --depth medium
```

리서치는 Jina Search를 기본 경로로 사용합니다. 깊이 계약은 다음과 같습니다.

| 깊이 | 계약 |
|---|---|
| `shallow` | Jina Search 정확히 3회, 심층 읽기 없음 |
| `medium` | Jina Search 정확히 5회, Jina Reader 심층 읽기 최대 2회 |
| `deep` | Jina Search 10회 이상, Jina Reader 제한 없음, 제한된 빈틈 보완 라운드 |

Jina를 사용할 수 없으면 WebSearch/WebFetch와, 가능한 경우 unblock 또는 Playwright 대체
경로를 사용할 수 있습니다. 어떤 경로가 성공하는지는 자격 증명과 속도 제한에 따라 달라집니다.
[리서치 가이드](skills/research.ko.md)에서 출처 검증과 제한을 확인하세요.

### 제공한 자료로 작성하기

```text
/scc:write --format report --skip-research research-brief.md
```

지원 포맷과 글자 하한은 [write 가이드](skills/write.ko.md)에 정의되어 있습니다. 작성자의
**내부** `/scc:review`는 기본값이 켜져 있습니다. God Hands Check, 워크플로 리뷰 단계, 단독
`/scc:review`처럼 다른 쪽이 이미 리뷰를 맡을 때만 `--skip-review`를 사용하세요. 실제 출처가
요청에 이미 들어 있지 않으면 리서치를 건너뛰지 마세요.

### 기존 산출물 리뷰하기

```text
/scc:review proposal.md --preset strategy
```

리뷰는 전문 리뷰어 2~5명으로 패널을 구성합니다. 프리셋이 패널과 투표 기준을 정하고,
Critical 소견이 있으면 결과를 차단합니다. Hands 없이 단독으로 실행할 수 있습니다.

### 소견을 반영해 수정하기

```text
/scc:refine proposal.md --max 3
```

Refine은 리뷰 소견을 반영해 목표나 설정된 한도에 도달하면 멈춥니다. 반복 횟수나 완료
시간을 특정 수치로 보장하지 않습니다.

## 4. 16개 스킬과 도구 전용 명령 3개

| 스킬 | 용도 |
|---|---|
| `coach` | 방어 가능한 방향 중 하나를 결정하고 프로젝트 기준으로 기록 |
| `research` | 여러 라운드의 근거 기반 조사와 종합 |
| `analyze` | 15개 전략 프레임워크 중 하나 적용 (God Hands Gather용 모델 호출) |
| `write` | 포맷별 콘텐츠 작성 |
| `review` | 합의 투표를 포함한 다중 관점 리뷰 |
| `refine` | 목표를 향한 반복 수정 |
| `collect` | PARA 방식 지식 수집 |
| `workflow` | 재사용 가능한 스킬 파이프라인 |
| `discover` | 후보 스킬 탐색과 점수 기반 추천 |
| `godhands` | 공개 오케스트레이터: 게이트가 있는 수집 → 초안 → 검사 → 손질 |
| `pdca` | God Hands의 슬래시 전용 호환 이름. 런타임과 MCP는 `pdca_*` |
| `translate` | 형식과 문체를 유지하는 영어 ↔ 한국어 번역 |
| `batch` | 같은 유형의 작업을 병렬 단위로 분할 |
| `soul` | 지속되는 선호·행동 프로필 합성 |
| `loop` | 고정 스위트 프롬프트 최적화 (유지보수자 전용) |
| `evolve` | 반복 실패 자산 개선 (유지보수자 전용) |

| 도구 전용 명령 | 용도 |
|---|---|
| `/scc:viewer` | 런 산출물과 provenance 열기 또는 내보내기 |
| `/scc:unblock` | 차단 URL에 적응형 9단계 대체 체인 시도 |
| `/scc:standard-check` | 기록된 프로젝트 기준을 산출물 하나에 적용 |

이 세 가지는 명령 래퍼가 있고 `SKILL.md`는 없습니다(`skills/unblock/`은 가져오기 엔진을
유지합니다). `commands/version.mjs`는 명령 마크다운 19개 옆의 버전 도우미입니다. Codex는
도구 전용 명령을 추가 스킬로 노출하지 않습니다.

각 스킬 가이드는 [스킬 색인](skills/)에서 볼 수 있습니다. 관련 아키텍처와 명령 문서는
[문서 색인](README.md)에 모았습니다.

## 5. 내장 오케스트레이터와 슬래시 전용 재생

`/scc:godhands`가 내장 오케스트레이터입니다. `/scc:pdca`는 슬래시 전용 호환 이름입니다. `/scc:workflow`와 `/scc:batch`는 슬래시 전용이며 별칭도, 동등한 오케스트레이터도 아닙니다.

| 선택 | 언제 | 아닌 것 |
|---|---|---|
| `/scc:godhands` (내장 오케스트레이터) | 한 요청에 게이트가 있는 수집 → 초안 → 검사 → 손질이 필요할 때 | 저장된 파이프라인이 아니고, 병렬 단위도 아님 |
| `/scc:workflow` (슬래시 전용 이름 있는 재생) | 같은 스킬 체인을 이름 붙여 재사용·예약·백그라운드 실행할 때 | Hands 런타임 게이트가 아님. 자동 라우트되지 않음 |
| `/scc:batch` (슬래시 전용 병렬 분할) | 같은 유형의 일을 2~10개의 독립 단위로 나눠 병렬 실행할 때 | 순차 전달이 아님. 의존하는 단위는 명시적 `/scc:workflow` |

**autopilot** (`/scc:workflow run autopilot`)은 God Hands를 파이프라인으로 근사합니다. research →
analyze → write(`--skip-research --skip-review`) → review → refine입니다. 그 write 단계는
내부 리뷰를 건너뛰어 뒤의 review 단계가 Check에 해당하는 일을 맡습니다. autopilot은 Hands
상태 게이트(`sources_count >= 5`, Plan Mode 승인 등, `pdca-state`가 강제)를 **실행하지 않습니다**. 그 게이트가
필요하면 `/scc:godhands`를, 재사용 가능한 이름 있는 파이프라인이면 autopilot을 고르세요.

`quick-draft`는 research → write(분석·리뷰 없음)입니다. `quality-gate`는 기존 파일에 review
→ refine입니다.

## 6. 리뷰 프리셋

| 프리셋 | 리뷰어 | 일반적인 용도 |
|---|---|---|
| `content` | Deep + Advocate + Tone | 아티클·블로그·뉴스레터 |
| `strategy` | Deep + Advocate + Facts | PRD·SWOT·전략 문서 |
| `code` | Deep + Facts + Structure | 코드 리뷰 |
| `security` | Deep + Facts + Structure | 보안 감사 |
| `academic` | Deep + Facts + Structure + Advocate | 논문·연구 결과 |
| `quick` | Advocate + Facts | 더 작은 패널 |
| `full` | 5명 전체 | 가장 폭넓은 기본 패널 |

리뷰어 수는 2~5명입니다. 프리셋은 실행 시간을 보장하지 않습니다. `--external`은 선택
사항이며 설정된 외부 제공자에게 산출물을 보낼 수 있으므로 사용 전에 데이터 경계를
확인하세요.

기본 투표 기준은 `quick` 2/2, 3명 프리셋은 2/3, `academic`은 3/4, `full`은 3/5입니다.
Critical 소견은 투표와 관계없이 결과를 차단합니다.

## 7. Hands 작동 방식

한 요청에 모든 단계와 **런타임 게이트**가 필요하면 `/scc:godhands`를 선택하세요. 구어로는 신의 손입니다. 영어 명령은 `godhands`입니다. 런타임 상태와 MCP 도구는
`pdca_*`입니다(`.data/state/pdca-active.json`, `skills/pdca/references`). `/scc:pdca`는
슬래시 전용 호환 이름입니다.

```text
Gather → 브리프를 위한 리서치와 분석
Draft  → 승인된 계획으로 작성 (--skip-research --skip-review)
Check  → 선택한 리뷰 프리셋으로 검증  ← God Hands Check
Cut    → 리서치·실행·다듬기 문제를 알맞은 단계로 회송
```

Draft는 순수 실행입니다. write의 기본 내부 리뷰는 건너뛰고 Check가 리뷰를 맡습니다. 이미
`--skip-review` 없이 `/scc:write`를 돌렸다면, 두 번째 리뷰를 원하지 않는 한 그 초안을
전체 Hands 패스로 감싸지 마세요.

상태 런타임은 아래 게이트 하위 집합을 강제합니다.

| 전환 | 런타임이 강제하는 검사 항목 |
|---|---|
| Plan → Do | 필수 필드, `sources_count >= 5`, Plan Mode 승인 |
| Do → Check | 산출물 존재, 섹션 완성, 계획 결과 반영 |
| Check → Act | 리뷰어 2명 이상, 표준 판정값 |
| Act → 다음 단계/종료 | 유효한 결정과 원인 범주, 사이클 제한 이내 |

스킬 지침은 이 런타임 하위 집합보다 넓습니다. 리서치 방법, 출처 품질, 리뷰어 역할,
포맷 요구사항, 문체 규칙은 해당 에이전트를 안내하지만 프롬프트 훅을 통한 자동 배정을
일으키지 않습니다. 모든 서술형 조건을 `pdca-state`가 독립적으로 강제하는 것도 아닙니다.
공개 패스는 [Hands 스킬 가이드](skills/godhands.ko.md), 스키마와 라우팅은
[PDCA 스킬 가이드](skills/pdca.ko.md)에서 확인하세요.

코드 작업에서는 **코드 엔지니어링 레인**이 같은 게이트 위에 더 엄격한 수용 기준, 격리,
검증 증거, 핸드오프 지침을 더합니다. God Hands의 특화이지 두 번째 런타임이 아닙니다.

## 8. 기준과 세션 상태

`/scc:coach`는 결정된 사항을 프로젝트에 다음 경로로 저장합니다.

```text
.scc/standards/<id>/STANDARD.md
```

선택한 방향, 탈락한 대안, 재검토 조건, 검사를 함께 기록합니다. `/scc:standard-check
artifact.md`의 결과는 `PASS`, `FAIL`, `UNPROVEN`, `UNCHECKED` 중 하나이며, adversarial
검사의 통과를 검사기 스스로 인증하지 않습니다.

라이프사이클 훅은 상태를 복원하고 활성 기준의 literal trigger를 알리며 리뷰 결과와 요약을
저장합니다. 프롬프트에서 스킬을 선택하거나 호출하지는 않습니다.

플러그인은 **MCP 서버 3개**를 등록합니다. `pdca-state`는 항상 번들되고, Playwright와
MMBridge는 선택입니다. `pdca-state`의 오케스트레이터 결과는 자문일 뿐 외부 스킬이나 명령을
실행하지 않습니다.

소울 관측은 `soul/observations/YYYY-MM-DD.jsonl` 날짜별 파일입니다(훅,
`soul_record_observation`, `/scc:soul`). 날짜별 파일을 믿으세요.

## 9. 더 읽기와 FAQ

### Claude Code를 대신하나요?

아닙니다. 기본 호스트는 Claude Code입니다. Codex와 Grok은 각자의 CLI로 같은 플러그인을
설치할 수 있습니다. Codex는 여전히 `/scc` 명령 전체가 아니라 스킬 16개를 노출합니다.

### 한국어를 지원하나요?

네. 한국어·영어 또는 두 언어를 섞어 사용할 수 있습니다. 명시적인 번역 흐름은
`/scc:translate`를 사용하세요.

### 비용이 드나요?

플러그인은 MIT 라이선스입니다. Claude Code, Codex, Grok, 외부 제공자의 가격·자격 증명·
사용 정책은 각각 적용됩니다. 리뷰어를 여러 명 쓰거나 깊은 리서치를 하면 토큰 사용량이
늘 수 있습니다.

### GitHub Latest Release가 v3.0.0인 이유는?

그 태그가 게시된 GitHub Release입니다. 플러그인 버전과 `CHANGELOG.md`는 3.0.1, 3.0.2,
3.0.3까지 이어집니다. v3.0.0 Release 자산이 아니라 GitHub 마켓플레이스
(`unclejobs-ai/second-claude-code`)에서 설치하세요. Latest Release를 현재 플러그인
버전으로 보지 마세요.

### 상세 문서는 어디에 있나요?

- [README](../README.ko.md) — 개요와 빠른 시작
- [스킬 가이드](skills/) — 각 스킬의 문법과 계약
- [아키텍처](architecture.ko.md) — 런타임 경계와 상태 모델
- [변경 이력](../CHANGELOG.md) — 릴리스와 마이그레이션 기록
- [문서 색인](README.md) — 명령과 문서 지도

### 보관/삭제 (문서 색인)

이번 실행에서는 디스크에 그대로 둡니다. [문서 색인](README.md)에는 아래를 보관/삭제
후보로 표시해야 합니다.

- `translations/` — 일회성 번역 작업 공간이며 제품 문서가 아님
- `docs/RELEASE-v*` — 과거 릴리스 노트. 현재 이력은 `CHANGELOG.md`

*버전 3.1.0 | MIT 라이선스*

[English](notion-manual.md) | **한국어**

# Second Claude Code 사용 매뉴얼

> 원하는 진입점을 고르는 실전 중심 가이드

## 1. 가장 작은 유효한 진입점부터 고르기

Second Claude Code는 Claude Code용 플러그인입니다. 15개 스킬과 도구 전용 명령 3개를
제공합니다. 작업에 맞는 항목을 고르세요.

| 필요한 일 | 진입점 |
|---|---|
| 출처를 모으고 종합하기 | `/scc:research` |
| 아티클·보고서·뉴스레터 등 작성 | `/scc:write` |
| 기존 초안이나 코드 산출물 점검 | `/scc:review` |
| 소견을 반영해 반복 수정 | `/scc:refine` |
| 리서치·작성·리뷰·수정을 게이트와 함께 연결 | `/scc:pdca` |

자연어 요청은 Claude Code의 일반 스킬 흐름으로 처리할 수 있습니다. SCC 프롬프트 훅이
스킬이나 명령을 자동 배정하지는 않습니다. 확실히 지정하려면 슬래시 명령을 사용하세요.

```text
/scc:research "AI 에이전트 프레임워크" --depth medium
/scc:write --format report --skip-research notes.md
/scc:review proposal.md --preset content
/scc:refine proposal.md --max 3
```

스킬을 직접 실행해도 되며 PDCA로 감쌀 필요는 없습니다. `write`는 기본적으로 자체 리뷰를
실행합니다. 의도적으로 생략하려면 `--skip-review`, 실제 출처 자료를 이미 제공했다면
`--skip-research`를 사용하세요. PDCA를 선택했을 때의 Check는 별도의 독립 리뷰 단계입니다.

## 2. 설치·업데이트·마이그레이션

### 전제 조건

먼저 [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)를 설치하세요.

### 새로 설치하기

터미널에서 마켓플레이스를 추가하고 현재 플러그인 이름으로 설치합니다.

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

새 Claude Code 세션을 열고 다음으로 확인하세요.

```bash
claude plugin list
```

### v3 업데이트

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

기본 런타임 데이터는 플러그인 디렉터리의 `.data/` 아래에 저장됩니다. 사이클 런, 메모리,
소울 데이터, 설정을 교체 후에도 보존하려면 `CLAUDE_PLUGIN_DATA`를 지속 경로로 지정하세요.

```bash
export CLAUDE_PLUGIN_DATA="$HOME/.scc-data"
```

`pdca-state` MCP 서버는 자체 포함 번들로 제공됩니다. 처음 시작할 때 이 서버를 위해
`npm install`, 의존성 다운로드, 로컬 `node_modules` 디렉터리가 필요하지 않습니다.
Playwright와 MMBridge는 별도의 선택적 MCP 연동이며 설정과 사용 가능 여부가 각각 다릅니다.

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
내부 리뷰는 기본값이 켜져 있으며, 다른 워크플로우가 리뷰를 맡을 때만 `--skip-review`를
사용하세요.

### 기존 산출물 리뷰하기

```text
/scc:review proposal.md --preset strategy
```

리뷰는 전문 리뷰어 2~5명으로 패널을 구성합니다. 프리셋이 패널과 투표 기준을 정하고,
Critical 소견이 있으면 결과를 차단합니다. PDCA 없이 단독으로 실행할 수 있습니다.

### 소견을 반영해 수정하기

```text
/scc:refine proposal.md --max 3
```

Refine은 리뷰 소견을 반영해 목표나 설정된 한도에 도달하면 멈춥니다. 반복 횟수나 완료
시간을 특정 수치로 보장하지 않습니다.

## 4. 15개 스킬과 도구 전용 명령 3개

| 스킬 | 용도 |
|---|---|
| `coach` | 방어 가능한 방향 중 하나를 결정하고 프로젝트 기준으로 기록 |
| `research` | 여러 라운드의 근거 기반 조사와 종합 |
| `analyze` | 15개 전략 프레임워크 중 하나 적용 |
| `write` | 포맷별 콘텐츠 작성 |
| `review` | 합의 투표를 포함한 다중 관점 리뷰 |
| `refine` | 목표를 향한 반복 수정 |
| `collect` | PARA 방식 지식 수집 |
| `workflow` | 재사용 가능한 스킬 파이프라인 |
| `discover` | 후보 스킬 탐색과 점수 기반 추천 |
| `pdca` | 명시적 Plan → Do → Check → Act 오케스트레이션 |
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

각 스킬 가이드는 [스킬 색인](skills/)에서 볼 수 있습니다. 관련 아키텍처와 명령 문서는
[문서 색인](README.md)에 모았습니다.

## 5. 리뷰 프리셋

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

## 6. PDCA 작동 방식

한 요청에 모든 단계가 필요하면 `/scc:pdca`를 선택하세요.

```text
Plan  → 브리프를 위한 리서치와 분석
Do    → 승인된 계획으로 작성
Check → 선택한 리뷰 프리셋으로 검증
Act   → 리서치·실행·다듬기 문제를 알맞은 단계로 회송
```

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
[PDCA 스킬 가이드](skills/pdca.ko.md)에서 스키마와 라우팅을 확인하세요.

## 7. 기준과 세션 상태

`/scc:coach`는 결정된 사항을 프로젝트에 다음 경로로 저장합니다.

```text
.scc/standards/<id>/STANDARD.md
```

선택한 방향, 탈락한 대안, 재검토 조건, 검사를 함께 기록합니다. `/scc:standard-check
artifact.md`의 결과는 `PASS`, `FAIL`, `UNPROVEN`, `UNCHECKED` 중 하나이며, adversarial
검사의 통과를 검사기 스스로 인증하지 않습니다.

라이프사이클 훅은 상태를 복원하고 활성 기준의 literal trigger를 알리며 리뷰 결과와 요약을
저장합니다. 프롬프트에서 스킬을 선택하거나 호출하지는 않습니다. 번들된 `pdca-state` 서버는
상태·메모리·소울·세션 회수·자문형 크로스 플러그인 오케스트레이션용 MCP 도구 31개를
제공합니다. 오케스트레이터 결과는 자문일 뿐 외부 스킬이나 명령을 실행하지 않습니다.

## 8. 더 읽기와 FAQ

### Claude Code를 대신하나요?

아닙니다. Claude Code가 필요하며, 이 플러그인은 그 위에 스킬·명령·훅·MCP 도구를 추가합니다.

### 한국어를 지원하나요?

네. 한국어·영어 또는 두 언어를 섞어 사용할 수 있습니다. 명시적인 번역 흐름은
`/scc:translate`를 사용하세요.

### 비용이 드나요?

플러그인은 MIT 라이선스입니다. Claude Code와 외부 제공자의 가격·자격 증명·사용 정책은
각각 적용됩니다. 리뷰어를 여러 명 쓰거나 깊은 리서치를 하면 토큰 사용량이 늘 수 있습니다.

### 상세 문서는 어디에 있나요?

- [README](../README.ko.md) — 개요와 빠른 시작
- [스킬 가이드](skills/) — 각 스킬의 문법과 계약
- [아키텍처](architecture.ko.md) — 런타임 경계와 상태 모델
- [변경 이력](../CHANGELOG.md) — 릴리스와 마이그레이션 기록

*버전 3.0.2 | MIT 라이선스*

[English](README.md) | **한국어**

![version](https://img.shields.io/badge/version-3.0.2-blue)
![license](https://img.shields.io/badge/license-MIT-green)

# Second Claude Code — 제2의 클로드

Second Claude Code는 리서치, 글쓰기, 분석, 리뷰, 수정을 돕는 Claude Code 플러그인입니다.
**15개 스킬**과 **도구 전용 명령 3개**를 제공합니다. 스킬 하나를 직접 사용하거나,
단계별 게이트가 필요한 경우 `/scc:pdca`를 명시적으로 선택해 Plan → Do → Check → Act를
실행할 수 있습니다.

모든 프롬프트를 자동으로 스킬에 배정하지는 않습니다. Claude Code의 일반 스킬·명령 흐름이
설명을 바탕으로 적합한 스킬을 선택할 수 있고, 예측 가능한 진입점을 원할 때는 슬래시 명령을
직접 사용하면 됩니다.

[![Second Claude Code — PDCA loop](docs/images/thumbnail.png)](https://www.scenesteller.com/studio/share/G2vdkxkjpj)

**먼저 볼 곳:** [사용 매뉴얼](docs/notion-manual.ko.md) · [스킬 색인](docs/skills/) ·
[명령·문서 색인](docs/README.md) · [아키텍처](docs/architecture.ko.md)

## 설치

지원되는 마켓플레이스 흐름을 실행하세요.

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

설치 후 Claude Code를 새 세션으로 열고, 다음 명령으로 설치를 확인하세요.

```bash
claude plugin list
```

기존 v3 설치를 업데이트할 때는 다음을 실행합니다.

```bash
claude plugin update scc
```

업데이트 후 Claude Code를 다시 시작하세요. 버전 3의 명령 네임스페이스는 `scc`이므로
명령은 `/scc:write`, `/scc:review`처럼 사용합니다.

v3 이전 설치에서 마이그레이션한다면 이전 캐시 플러그인을 제거한 뒤 새 이름으로 설치하세요.
이전 항목이 목록에 있다면 다음을 실행합니다.

```bash
claude plugin uninstall second-claude-code
claude plugin install scc
```

`second-claude-code`가 목록에 없다면 제거 단계는 건너뛰고 `scc`만 설치하면 됩니다. 새
네임스페이스를 사용하기 전에 세션을 다시 여세요.

런타임 데이터의 기본 위치는 플러그인 디렉터리의 `.data/`입니다. 런, 사이클 메모리, 소울
데이터, 설정을 플러그인 교체 후에도 보존하려면 별도 경로를 지정하세요.

```bash
export CLAUDE_PLUGIN_DATA="$HOME/.scc-data"
```

`pdca-state` MCP 서버는 자체 포함 번들로 함께 제공됩니다. 이 서버를 처음 설치할 때
`npm install`, 시작 시 의존성 다운로드, 로컬 `node_modules` 디렉터리가 필요하지 않습니다.
Playwright와 MMBridge는 별도의 선택적 MCP 연동이며 각각 추가 설정이 필요할 수 있습니다.

## 진입점 고르기

| 하고 싶은 일 | 사용 |
|---|---|
| 주제를 조사하고 브리프 저장 | `/scc:research` |
| 아티클·보고서·뉴스레터 등 작성 | `/scc:write` |
| 기존 산출물 리뷰 | `/scc:review` |
| 리뷰 결과를 반영해 수정 | `/scc:refine` |
| PDCA 네 단계를 모두 실행 | `/scc:pdca` |
| 판단 없는 유틸리티 사용 | `/scc:viewer`, `/scc:unblock`, `/scc:standard-check` |

자연어로 요청하면 Claude Code의 일반 스킬 흐름이 진입점을 선택할 수 있습니다. 직접 실행하려면
명령을 요청에 포함하세요.

```text
/scc:research "AI 에이전트 프레임워크" --depth medium
/scc:write --format report --skip-research report-notes.md
/scc:review proposal.md --preset content
/scc:refine proposal.md --max 3
```

`write`는 기본적으로 내부 리뷰를 실행합니다. 그 단계를 의도적으로 생략하려면
`--skip-review`를 사용하세요. 이미 실제 출처 자료를 제공했다면 `--skip-research`를 사용할
수 있습니다. 직접 실행하는 스킬을 반드시 PDCA로 감쌀 필요는 없습니다.

## 리서치 깊이

`research`는 Jina Search를 기본 검색 경로로 사용합니다. Jina를 사용할 수 없거나 페이지를
읽지 못하면 WebSearch/WebFetch, 가능할 경우 unblock 또는 Playwright 경로로 넘어갑니다.
자격 증명, 속도 제한, 선택적 연동 상태에 따라 가능한 경로가 달라지며, 선택한 깊이 계약
이외의 특정 제공자나 결과 수를 보장하지 않습니다.

| 깊이 | 검색 계약 |
|---|---|
| `shallow` | Jina Search를 정확히 3회 호출하고 심층 읽기는 하지 않음 |
| `medium` | Jina Search를 정확히 5회 호출하고 Jina Reader 심층 읽기를 최대 2회 수행 |
| `deep` | Jina Search 10회 이상, Jina Reader 심층 읽기 제한 없음, 제한된 빈틈 보완 라운드 |

레거시 WebSearch/WebFetch 엔진을 명시했거나 Jina를 사용할 수 없으면 동일한 검색·읽기 계약을
해당 대체 엔진으로 수행합니다. 출처 검증과 빈틈 처리는 [리서치 가이드](docs/skills/research.ko.md)를
참고하세요.

## 15개 스킬과 도구 전용 명령 3개

스킬은 판단을 내리거나 작업물을 만듭니다. 도구 전용 명령 3개는 유틸리티를 실행하며 스킬
목록의 자리를 차지하지 않습니다.

| 스킬 | 역할 |
|---|---|
| `coach` | 방어 가능한 방향 중 하나를 정하고 프로젝트 기준으로 기록 |
| `research` | 출처를 검색·검증하고 빈틈을 찾아 리서치 브리프 작성 |
| `analyze` | 15개 전략 프레임워크 중 하나를 적용 |
| `write` | 포맷별 계약에 맞는 근거 기반 초안 작성 |
| `review` | 선택한 리뷰어 2~5명 패널과 합의 게이트 실행 |
| `refine` | 소견을 반영하고 목표까지 반복 개선 |
| `collect` | URL·메모·발췌문을 PARA 지식 구조로 저장 |
| `workflow` | 재사용 가능한 스킬 파이프라인 생성·실행 |
| `discover` | 후보 스킬을 찾고 평가하며, 설치는 명시적 승인 필요 |
| `pdca` | Plan → Do → Check → Act 오케스트레이션 |
| `translate` | 형식과 문체를 유지하며 영어·한국어 번역 |
| `batch` | 같은 유형의 큰 작업을 독립 단위로 분할 |
| `soul` | 사용자 선호와 패턴의 지속 프로필을 합성 |
| `loop` | 고정 스위트로 프롬프트 자산 최적화 (유지보수자 전용) |
| `evolve` | 유지보수자가 작성한 검사에 따라 반복 실패 자산 개선 (유지보수자 전용) |

| 도구 전용 명령 | 역할 |
|---|---|
| `/scc:viewer` | 런의 산출물과 provenance를 열거나 내보냄 |
| `/scc:unblock` | 차단된 URL에 적응형 9단계 대체 체인을 실행 |
| `/scc:standard-check` | 프로젝트에 기록된 기준을 산출물 하나에 적용 |

[스킬 가이드](docs/skills/)에서 명령 문법, 옵션, 예시, 제한을 확인하세요. 유지보수자 전용
`loop`와 `evolve`는 자동 라우팅되지 않습니다. 공개된 `/scc:loop` 명령은 고정 벤치마크
스위트로 프롬프트 자산을 최적화하는 유지보수자용 직접 진입점입니다.

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

예: `/scc:review draft.md --preset academic`. 리뷰는 단독으로 실행할 수 있고, 직접 write할
때 `--skip-review`로 생략할 수도 있습니다. PDCA를 선택한 경우에는 독립적인 Check 단계가
별도로 적용됩니다.

## PDCA와 게이트

PDCA는 모든 요청에 필요한 방식이 아니라, 명시적으로 선택하는 오케스트레이션 경로입니다.

```text
Plan  → 브리프를 위한 리서치와 분석
Do    → 승인된 계획에 따라 산출물 작성
Check → 선택한 2~5명 리뷰 패널로 검증
Act   → 빈틈을 Plan·Do·Refine 중 알맞은 곳으로 회송
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
뜻도 아닙니다. 전체 계약은 [PDCA 가이드](docs/skills/pdca.ko.md)에서 확인하세요.

코드 작업에는 **코드 엔지니어링 레인**이 같은 게이트 위에 더 엄격한 수용 기준, 격리,
검증자 증거, 핸드오프 지침을 추가합니다. 별도의 런타임이 아니라 PDCA의 전문화입니다.

## 세션을 넘어 남는 기준

`/scc:coach`는 결정된 선택을 프로젝트에 기록할 수 있습니다.

```text
.scc/standards/<id>/STANDARD.md
```

선택한 방향, 탈락한 대안, 재검토 조건, 검사를 함께 보존합니다. 이후 세션이 활성 기준을
읽을 수 있고, `/scc:standard-check artifact.md`가 산출물 하나에 이를 적용합니다. 검사
결과는 `PASS`, `FAIL`, `UNPROVEN`, `UNCHECKED`가 될 수 있으며, adversarial 검사의 통과를
검사기 스스로 만들어내지는 않습니다.

## 상태·연동·백그라운드 작업

라이프사이클 훅은 상태를 복원하고 활성 기준의 literal trigger를 알리며 리뷰 결과와 세션
요약을 저장합니다. 사용자 프롬프트에서 스킬을 선택하거나 호출하지는 않습니다. 번들된
`pdca-state` 서버는 PDCA 상태, 사이클 메모리, 소울, 프로젝트 메모리, 세션 회수, 자문형
플러그인 오케스트레이션을 위한 MCP 도구 31개를 제공합니다.

크로스 플러그인 탐색은 자문 기능입니다. 오케스트레이터 도구가 설치된 기능을 살펴 순위가
있는 계획을 반환하지만 외부 스킬이나 명령을 실행하지는 않습니다. 제안된 기능은 필요할
때 명시적으로 호출하고 데이터 경계를 먼저 확인하세요.

백그라운드 핸드오프는 Claude Code 명령을 반환할 뿐, 대기 중인 작업을 자체 실행하지 않습니다.

```bash
claude --bg "/scc:workflow run weekly-digest"
claude agents
```

## 설정

모든 필드는 선택 사항입니다. 프로젝트 또는 플러그인 설정이 기대하는 위치에 둡니다.

```jsonc
{
  "defaults": {
    "research_depth": "medium",     // shallow | medium | deep
    "write_voice": "peer-mentor",
    "review_preset": "content",     // content | strategy | code | security | academic | quick | full
    "refine_max_iterations": 3,
    "publish_target": "file"        // file | notion
  },
  "quality_gate": {
    "consensus_threshold": 0.67,
    "external_reviewers": []
  }
}
```

## 더 읽기

- [사용 매뉴얼](docs/notion-manual.ko.md) — 단계별 진입과 예시
- [스킬 가이드](docs/skills/) — 스킬별 문서
- [명령·문서 색인](docs/README.md)
- [아키텍처](docs/architecture.ko.md) — 런타임 경계와 상태 모델
- [변경 이력](CHANGELOG.md) · [이슈](https://github.com/unclejobs-ai/second-claude-code/issues)

이슈와 풀 리퀘스트를 환영합니다. [Unclejobs](https://github.com/unclejobs-ai)가 만들었습니다.

*버전 3.0.2 | MIT 라이선스*

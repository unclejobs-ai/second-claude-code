[English](README.md) | **한국어**

# 스킬 가이드

이 문서는 `/scc:*`의 사용자용 참고 자료입니다. God Hands는 스킬 목록이 아니라
나를 대신할 손입니다. 찾고, 분석하고, 기획하고, 분해하고, 벤치마크하고, 개선합니다.

문서 지도는 [docs/README.md](../README.md)입니다. 전체 파일 목록은
[DOCUMENT-INDEX.md](../DOCUMENT-INDEX.md)입니다.

## 제공 항목

카탈로그는 **스킬 16개**와 **도구 전용 명령 3개**로 구성됩니다. 스킬 이름은
디스크의 `SKILL.md` 디렉터리 16개와 같습니다.

| 스킬 | `analyze`, `batch`, `coach`, `collect`, `discover`, `evolve`, `godhands`, `loop`, `pdca`, `refine`, `research`, `review`, `soul`, `translate`, `workflow`, `write` |
| 도구 | `standard-check`, `unblock`, `viewer` |

| 종류 | 이름 | 의미 |
|---|---|---|
| 자동 라우터 스킬 | `coach`, `godhands`, `refine`, `research`, `review`, `write` | 기본 자동 라우터입니다. 문서의 계약에 따라 에이전트를 디스패치할 수 있습니다. 오케스트레이터는 `/scc:godhands` 하나뿐입니다. |
| God Hands Gather (초이스 행 아님) | `analyze` | God Hands Gather가 `/scc:analyze`를 슬래시 체이닝할 수 있도록 모델 호출이 가능합니다. 최상위 초이스 행이 아닙니다. |
| 슬래시 전용 스킬 | `batch`, `collect`, `discover`, `evolve`, `loop`, `pdca`, `soul`, `translate`, `workflow` | 디스크에 그대로 있습니다. `/scc:<name>`으로 호출합니다. 자동 라우팅되지 않습니다. `pdca`는 God Hands의 슬래시 전용 호환 이름입니다. `workflow`는 이름 있는 재생, `batch`는 독립 병렬 분할입니다. |
| 도구 전용 명령 | `standard-check`, `unblock`, `viewer` | 가져오기·검사·서빙을 수행하는 결정적 유틸리티입니다. **스킬이 아닙니다.** 스킬 슬롯을 차지하거나 판단 패스를 의미하지 않습니다. `/scc:viewer`는 명령입니다. |

각 가이드는 영어 파일과 한국어 파일(`*.ko.md`)로 제공됩니다. 예시의 언어는
다를 수 있지만 플래그·기본값·게이트·안전 경계는 같아야 합니다.

## 가이드 선택

- 기본 자동 라우터: `godhands`, `research`, `write`, `review`, `refine`, `coach`
- God Hands Gather는 `analyze`(`/scc:analyze`)를 쓰며 최상위 초이스 행이 아닙니다
- 도구: `/scc:viewer`, `/scc:unblock`, `/scc:standard-check`
- 슬래시 전용 (디스크에 유지): `collect`, `discover`, `translate`, `batch`, `workflow`, `soul`, `loop`, `evolve`, `pdca`
- 오케스트레이터는 `/scc:godhands` 하나. `/scc:pdca`는 슬래시 전용 호환 이름. `workflow`는 이름 있는 재생(슬래시). `batch`는 독립 병렬 분할(슬래시)
- 프롬프트 자산 유지보수: `loop`, `evolve` (메인테이너 전용, 슬래시 전용)

## 오케스트레이터 하나와 슬래시 유틸리티 둘

오케스트레이터는 `/scc:godhands` 하나뿐입니다(구어로는 신의 손). `/scc:pdca`는
슬래시 전용 호환 이름입니다. `/scc:workflow`와 `/scc:batch`는
디스크에 남는 슬래시 전용 유틸리티이며 맞서는 오케스트레이터가 아닙니다.
Autopilot은 이름 있는 `/scc:workflow` 프리셋이지 맞서는 오케스트레이터가
아닙니다. God Hands는 여전히 research, analyze, write, review, refine을 슬래시로
체이닝합니다. Draft에서 `/scc:workflow`를 언급하면 그것은 명시적 슬래시이지
자동 라우트가 아닙니다.

| 원하는 것 | 사용 | 참고 |
|---|---|---|
| 게이트가 있는 수집 → 초안 → 검사 → 손질 한 패스 | `/scc:godhands` | 오케스트레이터 (자동 라우터). 런타임 전환 게이트. 스킬은 God Hands로 감싸지 않고 직접 쓸 수 있습니다. |
| `/scc:*` 단계를 저장해 재사용하는 파이프라인 | `/scc:workflow` | 슬래시 전용 이름 재생. `autopilot` 프리셋(research → analyze → write → review → refine)은 God Hands를 순차 파이프라인으로 근사합니다. God Hands 페이즈 게이트는 돌리지 않습니다. |
| 워크트리에서 독립 유닛을 병렬 실행 | `/scc:batch` | 슬래시 전용 병렬 분할. 순차 의존은 `workflow`, 게이트 있는 단일 패스는 `godhands`입니다. |

`write`는 기본적으로 내부 `/scc:review`를 실행합니다(`--skip-review`로 생략).
God Hands Check는 별도의 리뷰입니다. `/scc:write`와 `/scc:godhands`를 함께 쓰면 Draft에서
`--skip-review`를 쓰지 않는 한 리뷰가 두 번 돌아갑니다.

## 계약 표기

예시는 설명용이며 고정 점수·출처 수·리뷰 결과를 보장하지 않습니다. 각 가이드는
동작이 런타임 강제인지, 스킬 수준 지침인지, 사용자 승인이 필요한지를 구분합니다.
외부 설치·유료 provider·발행은 명시된 경우 opt-in입니다.

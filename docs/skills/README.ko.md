[English](README.md) | **한국어**

# 스킬 가이드

이 문서는 `/scc:*`의 사용자용 참고 자료입니다. 현재 런타임 계약, 기본 사용
예시, 명령을 선택할 때 알아야 할 경계를 설명합니다.

## 제공 항목

카탈로그는 **스킬 15개**와 **도구 전용 명령 3개**로 구성됩니다.

| 종류 | 이름 | 의미 |
|---|---|---|
| 스킬 | `analyze`, `batch`, `coach`, `collect`, `discover`, `evolve`, `loop`, `pdca`, `refine`, `research`, `review`, `soul`, `translate`, `workflow`, `write` | 추론·리서치·생산·품질·상태 기반 학습·오케스트레이션 워크플로우입니다. 문서의 계약에 따라 에이전트를 디스패치할 수 있습니다. |
| 도구 | `standard-check`, `unblock`, `viewer` | 가져오기·검사·서빙을 수행하는 결정적 유틸리티입니다. 스킬 슬롯을 차지하거나 판단 패스를 의미하지 않습니다. |

각 가이드는 영어 파일과 한국어 파일(`*.ko.md`)로 제공됩니다. 예시의 언어는
다를 수 있지만 플래그·기본값·게이트·안전 경계는 같아야 합니다.

## 가이드 선택

- 수집·탐색: `research`, `collect`, `discover`
- 생산·개선: `write`, `analyze`, `translate`, `refine`
- 검증·오케스트레이션: `review`, `pdca`, `workflow`, `batch`
- 먼저 진짜 의사결정 갈림길 확정: `coach`
- 프롬프트 자산 유지보수: `loop`, `evolve` (메인테이너 전용)
- 지속되는 말투 프로필을 학습·적용: `soul`
- 해당 유틸리티가 필요할 때: `unblock`, `standard-check`, `viewer`

## 계약 표기

예시는 설명용이며 고정 점수·출처 수·리뷰 결과를 보장하지 않습니다. 각 가이드는
동작이 런타임 강제인지, 스킬 수준 지침인지, 사용자 승인이 필요한지를 구분합니다.
외부 설치·유료 provider·발행은 명시된 경우 opt-in입니다.

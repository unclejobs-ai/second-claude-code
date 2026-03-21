[English](README.md) | **한국어**

![version](https://img.shields.io/badge/version-0.3.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

# Second Claude Code — 지식 작업 OS

"AI 에이전트 알아보고 보고서 써줘"라고 치면 이런 일이 벌어진다.

이브이가 웹을 뒤진다. 후딘이 패턴을 찾는다. 루브도가 3,000자를 쓴다 — 그리고 당신이 보기도 전에 다섯 마리 리뷰어가 이미 초안을 뜯고 있다. 네이티오는 논리를 본다. 앱솔은 약점을 공격한다. 폴리곤은 숫자를 검증한다.

**한 줄 입력. 전체 사이클. 플러그인 세 개 붙여놓고 기도하는 거 아님.**

![Skill Wheel](docs/images/hero.ko.svg)

---

## 빠른 시작

**1. 설치**

```bash
claude plugin add github:EungjePark/second-claude-code
```

**2. 확인** — 새 세션을 시작하면 이게 보여야 한다:

```
# Second Claude Code — Knowledge Work OS
9 commands for all knowledge work:
```

안 보이면? `claude plugin list`로 확인.

**3. 그냥 말해**

```
AI 에이전트 프레임워크 현황을 조사하고 보고서를 써줘
```

자동 라우터가 알아서 맞는 스킬을 고른다. 슬래시 명령어 외울 필요 없다. 영어도 된다:

```
Research AI agent frameworks and write a report
```

---

## 실제로 무슨 일이 일어나는가

대부분의 플러그인은 하나만 한다. 리서치 따로, 글쓰기 따로, 리뷰 따로 — 연결은 안 되고 당신이 접착제 역할을 한다. 결과물을 복사해서 다음 프롬프트에 붙여넣고, 피드백을 직접 요청하고, 수정 사항을 손으로 반영한다. 다섯 번의 컨텍스트 스위칭.

Second Claude Code는 **품질 루프**를 돌린다. 제조업이 수십 년 전에 알아낸 사이클: **Plan → Do → Check → Act.**

```
당신: "AI 에이전트 알아보고 보고서 써줘"

[Plan]  이브이 + 부엉 20개 이상 소스를 크롤링, 후딘이 합성
        ↓ 품질 게이트: 리서치 브리프가 검증된 후에야 집필 시작
[Do]    루브도가 리서치 기반으로 전체 초안 작성
        ↓ 품질 게이트: 초안은 당신이 아니라 리뷰로 간다
[Check] 5마리 리뷰어가 병렬로 — 논리, 팩트, 톤, 구조, 약점
        ↓ 합의 게이트: 2/3 통과해야 승인, Critical 하나라도 있으면 차단
[Act]   액션 라우터가 피드백을 읽는다:
        → 리서치 부족? Plan으로 복귀.
        → 누락 섹션? Do로 복귀.
        → 다듬기 이슈? 메타몽이 loop 돌려서 개선.

당신은 최종본을 받는다. 리뷰 완료. 팩트체크 완료. 정제 완료.
```

![PDCA Cycle](docs/images/pdca-cycle.ko.svg)

---

## 스킬 선택 가이드

| 하고 싶은 것 | 스킬 | 일어나는 일 |
|---|---|---|
| 리서치→작성→리뷰→개선 전체 사이클 | `pdca` | 품질 게이트 포함 전체 체이닝 |
| 주제에 대한 정보 조사 | `research` | 소스 합성을 거치는 자율 심층 리서치 |
| SWOT, Porter, RICE 등 15개 프레임워크 적용 | `analyze` | 구조화된 전략 분석 출력 |
| 아티클, 보고서, 뉴스레터 작성 | `write` | 리서치 + 초안 + 리뷰를 한 명령어로 |
| 다중 관점 피드백 받기 | `review` | 3~5명 병렬 리뷰어 + 합의 투표 |
| 목표 점수까지 반복 개선 | `loop` | 리뷰어가 통과할 때까지 반복 |
| URL, 메모, 발췌 저장 | `collect` | PARA 분류 기반 지식 캡처 |
| 여러 스킬을 워크플로우로 연결 | `pipeline` | 커스텀 자동화 빌더 |
| 없는 스킬 찾아 설치 | `hunt` | 새 기능 탐색 및 설치 |

명령어는 `/second-claude-code:` 접두사. 또는 그냥 자연어로 — 자동 라우터가 처리한다.

---

## 자동 라우팅

명령어를 외울 필요 없다. 하고 싶은 걸 한국어든 영어든 그냥 치면 된다.

```
"AI 에이전트 알아보고 보고서 써줘"       →  pdca (전체 사이클)
"이 주제로 아티클 작성해"                →  write
"SWOT으로 분석해"                       →  analyze
"이 초안을 리뷰해"                      →  review
"더 좋게 다듬어"                        →  loop
"이 링크 저장해줘"                      →  collect
"보안 감사 스킬 있어?"                   →  hunt
```

라우터는 두 레이어로 동작한다. 복합 패턴("알아보고 **써줘**")은 전체 PDCA 사이클을 트리거. 단일 스킬 의도는 해당 스킬로 직행. 여러 개가 매칭되면 프롬프트에서 가장 먼저 나타나는 패턴이 이긴다. 영어 ~77개 + 한국어 ~50개, 총 ~127개 트리거 패턴.

> 영어 라우팅 예시: [English README](README.md) 참조.

---

## 리뷰 시스템

여기가 진짜다. 대부분의 AI 글쓰기 도구는 생성하고 바로 넘긴다. Second Claude Code는 생성한 다음, **자기 결과물을 공격한 후에** 넘긴다.

`/second-claude-code:review`는 3~5마리 전문 에이전트를 병렬로 투입한다:

| 리뷰어 | 포켓몬 | 모델 | 하는 일 |
|---|---|---|---|
| 딥리뷰어 | 네이티오 (Xatu) | opus | 구조적 논리, 완결성, 논증 흐름 |
| 데빌어드보킷 | 앱솔 (Absol) | sonnet | 가장 약한 지점을 찾아서 때린다 |
| 팩트체커 | 폴리곤 (Porygon) | haiku | 모든 숫자, 주장, 출처를 검증 |
| 톤가디언 | 푸린 (Jigglypuff) | haiku | 어조 일관성과 독자 적합성 |
| 구조분석가 | 안농 (Unown) | haiku | 가독성, 구성, 스캔 용이성 |

왜 포켓몬이냐고? 각자의 특성이 역할과 맞아떨어진다. 네이티오는 과거와 미래를 동시에 본다 (구조적 결함 감지). 앱솔은 재앙을 감지한다 (취약점 탐지). 폴리곤은 디지털 네이티브다 (데이터 기반 팩트체크). 기억하기 쉽고, 기억하기 쉬우면 각 리뷰어가 뭘 하는지 실제로 기억하게 된다.

**합의 게이트:** 2/3 통과 = APPROVED. Critical이 하나라도 있으면 = MUST FIX. 예외 없음.

![Review Flow](docs/images/review-flow.ko.svg)

<details>
<summary><strong>리뷰 프리셋</strong></summary>

| 프리셋 | 리뷰어 | 적합한 용도 |
|---|---|---|
| `content` | 네이티오 + 앱솔 + 푸린 | 아티클, 블로그, 뉴스레터 |
| `strategy` | 네이티오 + 앱솔 + 폴리곤 | PRD, SWOT, 전략 문서 |
| `code` | 네이티오 + 폴리곤 + 안농 | 코드 리뷰 |
| `quick` | 앱솔 + 폴리곤 | 빠른 검증 |
| `full` | 5마리 전원 | 최종 퍼블리시 전 검수 |

**외부 리뷰어 (선택):** `--external` 플래그로 MMBridge 경유 크로스 모델 리뷰(Kimi, Qwen, Gemini, Codex) 추가 가능. MMBridge 별도 설치 필요.

</details>

---

## 스킬 조합

스킬은 서로를 호출한다. 하나의 프롬프트로 전체 사이클이 돌아간다.

| 패턴 | 체인 | 용도 |
|---|---|---|
| 풀 PDCA | research → analyze → write → review → loop | 엔드투엔드 콘텐츠 |
| 빠른 검수 | review → loop | 기존 초안 다듬기 |
| 기획만 | research → analyze | 전략 분석 |
| 자동 PDCA | `pipeline run autopilot --topic "..."` | 원커맨드 생산 |

`/second-claude-code:write`는 내부적으로 research와 review를 자동 호출한다. 한 명령어로 리서치 기반 + 리뷰 검증된 결과물.

---

<details>
<summary><strong>15개 전략 프레임워크</strong></summary>

`/second-claude-code:analyze`는 15개 내장 프레임워크를 지원한다:

| 카테고리 | 프레임워크 |
|---|---|
| **전략** | ansoff, porter, pestle, north-star, value-prop |
| **기획** | prd, okr, lean-canvas, gtm, battlecard |
| **우선순위** | rice, pricing |
| **분석** | swot, persona, journey-map |

각 프레임워크는 `skills/analyze/references/frameworks/`에 독립 문서로 존재한다. 프롬프트에서 자동 선택되거나 직접 지정 가능:

```bash
/second-claude-code:analyze porter "클라우드 인프라 시장"
/second-claude-code:analyze rice --input features.md
/second-claude-code:analyze lean-canvas "내 스타트업 아이디어"
```

</details>

<details>
<summary><strong>아키텍처 — 3개 모델 티어에 걸친 16마리 포켓몬</strong></summary>

| 페이즈 | 포켓몬 | 역할 | 모델 |
|---|---|---|---|
| **Plan** | 이브이 (Eevee) | 리서처 — 웹 검색, 데이터 수집 | haiku |
| | 부엉 (Noctowl) | 검색 전문 | haiku |
| **Do** | 후딘 (Alakazam) | 애널리스트 — 패턴 인식, 합성 | sonnet |
| | 뮤츠 (Mewtwo) | 전략가 — 프레임워크 분석 | sonnet |
| | 루브도 (Smeargle) | 라이터 — 장문 콘텐츠 | opus |
| | 아르세우스 (Arceus) | 마스터 — 범용 실행 | sonnet |
| **Check** | 네이티오 (Xatu) | 딥리뷰어 — 논리, 구조 | opus |
| | 앱솔 (Absol) | 데빌어드보킷 — 약점 공격 | sonnet |
| | 폴리곤 (Porygon) | 팩트체커 — 숫자, 출처 | haiku |
| | 푸린 (Jigglypuff) | 톤가디언 — 어조, 독자 | haiku |
| | 안농 (Unown) | 구조분석가 — 가독성 | haiku |
| **Act** | 메타몽 (Ditto) | 에디터 — 콘텐츠 정제 | opus |
| **인프라** | 괴력몬 (Machamp) | 스텝 실행기 — 개별 단계 수행 | sonnet |
| | 자포코일 (Magnezone) | 인스펙터 — 스킬 후보 검사 | sonnet |
| | 테오키스 (Deoxys) | 평가자 — 스킬 점수 산정 | sonnet |
| | 캐이시 (Abra) | 커넥터 — 지식 연결 | haiku |

MMBridge 경유 크로스 모델 리뷰(Kimi, Qwen, Gemini, Codex)는 선택 사항 — 없어도 동작한다.

![Agent Roster](docs/images/agent-roster.ko.svg)

```
second-claude/
├── skills/     # 9개 스킬 (SKILL.md + references/)
│   └── pdca/   # 오케스트레이터 (액션 라우터 + 질문 프로토콜)
├── agents/     # 16마리 포켓몬 서브에이전트
├── commands/   # 9개 슬래시 명령어 래퍼
├── hooks/      # 자동 라우팅 + 컨텍스트 주입
├── references/ # 설계 원칙, 합의 게이트
├── templates/  # 출력 템플릿
├── scripts/    # 셸 유틸리티
└── config/     # 사용자 설정
```

[전체 아키텍처 문서 →](docs/architecture.md)

</details>

<details>
<summary><strong>설계 철학</strong></summary>

세 가지 원칙이 핵심이다:

1. **적지만 깊게** — 80개가 아니라 9개. 각 스킬이 references, gotchas, 품질 게이트를 내장한다. 표면적은 작고, 조합을 통해 무한한 워크플로우.

2. **PDCA 내장** — 모든 산출물이 검증(Verify)과 개선(Refine)을 거쳐야 출하된다. 콘텐츠를 만드는 사이클이 스킬 자체를 개선하는 사이클이기도 하다. 제안이 아니라 게이트로 강제한다.

3. **액션 라우터** — 리뷰가 실패하면 맹목적으로 loop을 돌리지 않는다. 근본 원인을 분류한다: 리서치 부족 → Plan으로 복귀. 누락 섹션 → Do로 복귀. 다듬기 이슈만 Loop으로. 모든 문제를 Loop에 밀어넣지 않는다.

나머지 6개 원칙 (컨텍스트 절약, 의존성 제로, 단계적 공개, 함정 우선, 파일 기반 상태, 조합 가능)은 [docs/architecture.md](docs/architecture.md)에 있다.

</details>

---

## 설정

`config/config.example.json`을 플러그인 데이터 디렉토리에 복사하고 커스터마이즈:

```jsonc
{
  "defaults": {
    "research_depth": "medium",     // "shallow" | "medium" | "deep"
    "write_voice": "peer-mentor",   // 글쓰기 톤
    "review_preset": "content",     // "content" | "strategy" | "code" | "quick" | "full"
    "loop_max_iterations": 3,       // 최대 loop 반복 횟수
    "publish_target": "file"        // "file" | "notion"
  },
  "quality_gate": {
    "consensus_threshold": 0.67,    // 통과에 필요한 리뷰어 비율
    "external_reviewers": []        // MMBridge 경유: ["kimi", "qwen", "gemini", "codex"]
  }
}
```

모든 설정은 선택 사항 — 설정 파일이 없으면 기본값 적용.

---

## 알려진 제한 사항

- **자동 라우팅 오탐** — 모호한 프롬프트에서 오작동 가능 ("이 파일 저장해" → `collect`). 오탐 시 `/second-claude-code:*` 명시적 명령어 사용.
- **haiku 컨텍스트 제한** — 폴리곤, 푸린, 안농은 활성 플러그인이 많으면 "Prompt is too long" 에러. 미사용 플러그인 비활성화로 해결.
- **Claude Code 외 플랫폼 미검증** — OpenClaw, Codex, Gemini CLI 지원은 실험적.
- **스트리밍 미지원** — 서브에이전트 결과는 완료 후 한꺼번에 도착. 긴 작업은 완료까지 무음.
- **리뷰 결과 영어 고정** — 리뷰어는 입력 언어와 무관하게 영어로 소견 작성. 한국어 출력 향후 지원 예정.

---

## 호환성

| 플랫폼 | 설치 | 상태 |
|---|---|---|
| **Claude Code** (주력) | `claude plugin add github:EungjePark/second-claude-code` | 검증 완료 |
| **OpenClaw** | 표준 ACP 프로토콜 — 자동 감지 | 실험적 |
| **Codex** | SKILL.md 호환 | 실험적 |
| **Gemini CLI** | SKILL.md 호환 | 실험적 |

---

## 기여 및 라이선스

이슈와 PR: [github.com/EungjePark/second-claude-code](https://github.com/EungjePark/second-claude-code)

만든 사람: [Park Eungje](https://github.com/EungjePark). MIT 라이선스.

---

<details>
<summary><strong>변경 이력</strong></summary>

### v0.3.0 — PDCA v2, 액션 라우터, 포켓몬 에이전트 (현재)

- **PDCA v2 오케스트레이터** + 액션 라우터 — 리뷰 실패를 근본원인별로 라우팅
- **질문 프로토콜** — PDCA가 리서치 전에 명확화 질문 (`--no-questions`로 생략 가능)
- **16마리 포켓몬 서브에이전트** — 3개 모델 티어(opus/sonnet/haiku)
- **5명 병렬 리뷰어** + 합의 게이트 + 5개 프리셋
- **훅 기반 자동 라우팅** — 영어 ~77개 + 한국어 ~50개 트리거 패턴
- **자동 캡처** — research, write, analyze 결과를 `.captures/`에 자동 저장
- **19개 라우팅 테스트** — false positive 회귀 방지

### v0.2.0 — 보안 강화, 영어 로컬라이제이션

- 훅·스킬 전반 보안 강화 (13개 감사 소견 해결)
- 전체 스킬 문서 및 README 영어 번역
- `claude plugin add` 설치를 위한 마켓플레이스 매니페스트
- 전 스킬 품질 강화 (8개 도메인 스킬 9/10 목표; v0.3.0에서 pdca를 9번째 스킬로 승격)

### v0.1.0 — 최초 릴리스

- 도메인 스킬 8개 + 오케스트레이터 1개
- `/analyze`용 15개 전략 프레임워크
- PARA 기반 지식 수집
- 반복 가능한 워크플로우를 위한 파이프라인 빌더

</details>

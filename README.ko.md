[English](README.md) | **한국어**

![version](https://img.shields.io/badge/version-0.3.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

# Second Claude Code — 제2의 클로드

"AI 에이전트 알아보고 보고서 써줘."

이 한 줄을 치면 이브이가 웹을 뒤진다. 후딘이 패턴을 잡는다. 루브도가 3,000자를 쓴다 — 근데 내가 보기도 전에 리뷰어 다섯 마리가 이미 초안을 뜯고 있다. 네이티오가 논리를 본다. 앱솔이 약점을 친다. 폴리곤이 숫자를 검증한다.

뭐가 일어난 거냐고? **한 줄 입력. 전체 사이클. 플러그인 세 개 붙여놓고 기도하는 거 아니다.**

![Skill Wheel](docs/images/hero.ko.svg)

써볼래?

---

## 빠른 시작

**1. 설치**

```bash
claude plugin add github:EungjePark/second-claude-code
```

**2. 확인** — 새 세션을 열면 이게 보여야 한다:

```
# Second Claude Code — 제2의 클로드
9 commands for all knowledge work:
```

안 보이면 `claude plugin list`로 확인.

**3. 그냥 말하면 된다**

나는 보통 이렇게 시작한다:

```
AI 에이전트 프레임워크 현황을 조사하고 보고서를 써줘
```

자동 라우터가 맞는 스킬을 골라준다. 슬래시 명령어 외울 필요 없다. 영어도 된다:

```
Research AI agent frameworks and write a report
```

근데 이게 어떻게 돌아가는 걸까?

---

## 이게 해결하는 문제

AI로 글 쓰고, 리서치하고, 분석한다. 꽤 잘 된다. 나도 몇 달을 그렇게 썼다 — 프롬프트 치고, 결과 복사하고, 다음 프롬프트에 붙여넣고, 피드백 달라고 따로 요청하고, 수정 사항 손으로 반영하고.

문제가 뭐냐. 각 도구가 따로 논다. 리서치가 글쓰기를 모른다. 글쓰기가 리뷰를 모른다. 그 사이를 잇는 건 전부 내 손이다. 콘텐츠 하나에 컨텍스트 스위칭 다섯 번.

Second Claude Code는 그걸 고친다. 도구 모음이 아니라 제2의 클로드다. 혼자 알아서 단계를 밟고, 실수를 스스로 잡고, 리뷰 안 거친 건 내보내지 않는다.

프롬프트 하나 치면 이렇게 돌아간다:

```
나: "AI 에이전트 알아보고 보고서 써줘"

[Plan]  이브이 + 부엉 20개 이상 소스를 크롤링, 후딘이 합성
        ↓ 게이트: 리서치 브리프 없으면 집필 시작 안 됨
[Do]    루브도가 리서치 기반으로 전체 초안 작성
        ↓ 게이트: 초안은 나한테 안 오고 리뷰로 간다
[Check] 리뷰어 5마리가 병렬로 — 논리, 팩트, 톤, 구조, 약점
        ↓ 게이트: 2/3 통과해야 승인. Critical 하나라도 있으면 차단
[Act]   액션 라우터가 피드백을 읽는다:
        → 리서치 부족? Plan으로 돌아간다.
        → 빠진 섹션? Do로 돌아간다.
        → 다듬기 문제? 메타몽이 loop 돌린다.

최종본이 나한테 온다. 리뷰 끝. 팩트체크 끝. 정제 끝.
```

![PDCA Cycle](docs/images/pdca-cycle.ko.svg)

---

## 스킬 고르기

단계니 사이클이니 신경 쓸 필요 없다. 하고 싶은 말만 하면 된다.

글감이 잡히면 `write` 한 방이면 끝이다. 초안이 이미 있으면 `review`로 다섯 관점에서 피드백 받는다. 리서치부터 퍼블리싱까지 전부 돌리고 싶으면 `pdca`가 알아서 한다.

다음 작업에 뭘 쓸까?

| 하고 싶은 것 | 스킬 | 결과물 |
|---|---|---|
| 리서치→작성→리뷰→개선 전체 사이클 | `pdca` | 조사하고 쓰고 검증한 글 — 프롬프트 하나로 |
| 주제 파기 | `research` | 20개 이상 소스 크롤링, 패턴 분석, 브리프 |
| SWOT, Porter, RICE 등 15개 프레임워크 | `analyze` | 구조화된 전략 분석 |
| 아티클, 보고서, 뉴스레터 | `write` | 리서치 + 초안 + 리뷰가 한 명령어로 |
| 3~5명 관점에서 초안 리뷰 | `review` | 병렬 리뷰 + 합의 투표 |
| 목표 점수까지 다듬기 | `loop` | 리뷰어가 통과할 때까지 반복 |
| URL, 메모, 발췌 저장 | `collect` | PARA 분류 기반 지식 캡처 |
| 여러 스킬을 워크플로우로 연결 | `pipeline` | 커스텀 자동화 |
| 없는 스킬 찾아 설치 | `hunt` | 새 스킬 탐색 및 설치 |

스킬은 전부 자연어로 반응한다. 정밀하게 쓰고 싶으면 슬래시 명령어도 된다: `/second-claude-code:write`, `/second-claude-code:review` 등. 나는 반은 한국어, 반은 영어로 쓰는데 라우터가 알아서 처리한다. 트리거 패턴 총 ~127개.

```
"AI 에이전트 알아보고 보고서 써줘"       →  pdca (전체 사이클)
"이 주제로 아티클 작성해"                →  write
"Analyze this market with SWOT"        →  analyze
"이 초안을 리뷰해"                      →  review
```

---

## 리뷰 시스템

글 쓰고 퍼블리시하고 나서 10분 뒤에 뻔한 실수를 발견한 적 있지 않나?

대부분의 AI 글쓰기 도구는 생성하고 바로 넘긴다. Second Claude Code는 생성한 다음 **자기 결과물을 공격한 후에** 넘긴다. 차이가 여기에 있다.

`/second-claude-code:review`는 전문 에이전트 3~5마리를 병렬로 투입한다:

| 리뷰어 | 포켓몬 | 모델 | 하는 일 |
|---|---|---|---|
| 딥리뷰어 | 네이티오 (Xatu) | opus | 논리, 완결성, 논증 흐름 |
| 데빌어드보킷 | 앱솔 (Absol) | sonnet | 가장 약한 지점을 찾아서 때린다 |
| 팩트체커 | 폴리곤 (Porygon) | haiku | 숫자, 주장, 출처를 전부 검증 |
| 톤가디언 | 푸린 (Jigglypuff) | haiku | 어조 일관성, 독자 적합성 |
| 구조분석가 | 안농 (Unown) | haiku | 가독성, 구성 |

왜 포켓몬이냐고? 이름이 역할이랑 맞아떨어진다. 네이티오는 과거와 미래를 동시에 본다 — 구조적 결함을 잡는다. 앱솔은 재앙을 감지한다 — 취약점을 찾는다. 폴리곤은 디지털 네이티브다 — 데이터 기반으로 판단한다. 외우기 쉽고, 외우니까 누가 뭘 하는지 진짜로 기억하게 된다.

**합의 게이트:** 2/3 통과하면 APPROVED. Critical이 하나라도 나오면 MUST FIX. 급하다고 예외 없다.

나는 외부에 내보내는 건 `full`로 돌린다. 내부용 초안은 `quick`이면 충분하다 — 앱솔이랑 폴리곤이 심각한 문제는 1분 안에 잡는다.

![Review Flow](docs/images/review-flow.ko.svg)

<details>
<summary><strong>리뷰 프리셋</strong></summary>

| 프리셋 | 리뷰어 | 용도 |
|---|---|---|
| `content` | 네이티오 + 앱솔 + 푸린 | 아티클, 블로그, 뉴스레터 |
| `strategy` | 네이티오 + 앱솔 + 폴리곤 | PRD, SWOT, 전략 문서 |
| `code` | 네이티오 + 폴리곤 + 안농 | 코드 리뷰 |
| `quick` | 앱솔 + 폴리곤 | 빠른 검증 |
| `full` | 5마리 전원 | 퍼블리시 전 최종 검수 |

`--external`로 MMBridge 경유 크로스 모델 리뷰(Kimi, Qwen, Gemini, Codex) 추가 가능. 별도 셋업 필요.

</details>

---

## 사고방식

대부분의 AI 도구는 수동적이다 — 시키면 한다. Second Claude Code는 품질에 대한 의견이 있고, 그걸 강제한다. 세 가지 생각이 전부를 관통한다.

**스킬 9개. 80개가 아니다.** 하나하나가 깊다 — 레퍼런스, 함정 문서, 품질 게이트가 내장되어 있다. 80개 중에 뭘 골라야 하나 고민할 일이 없다. 하고 싶은 말만 하면 9개 중 하나가 알아서 잡는다.

**모든 산출물은 리뷰를 거친다.** 이건 권장이 아니다. 품질 게이트가 건너뛰기를 막는다. 합의 게이트를 안 통과한 초안은 물리적으로 나한테 안 온다.

**실패하면 원인을 찾아서 돌아간다.** 리뷰에서 문제가 나오면 액션 라우터가 근본원인을 분류한다. 리서치가 부족하면 Plan으로. 빠진 섹션이 있으면 Do로. 다듬기 문제면 Loop으로. 모든 문제를 loop으로 밀어넣으면 시간만 낭비된다.

그래서 실전에서 뭐가 달라지냐? PDCA 두 번째 사이클이 첫 번째보다 압도적으로 좋아진다. 액션 라우터가 각 사이클을 진짜 문제에 집중시키기 때문이다.

---

## 스킬 조합

스킬은 서로를 호출한다. 여기서 재밌어진다.

| 패턴 | 돌아가는 방식 | 이럴 때 |
|---|---|---|
| 풀 PDCA | research → analyze → write → review → loop | 주제 잡고 글 완성까지 |
| 빠른 검수 | review → loop | 있는 초안 다듬기 |
| 기획만 | research → analyze | 시장 파악하고 판단하기 |
| 자동 PDCA | `pipeline run autopilot --topic "..."` | 세팅하고 커피 마시고 오면 끝 |

나는 외부용은 전부 풀 PDCA로 돌린다. 내부 메모 수준이면 `write` 단독으로 충분하다 — 그것만으로도 리서치랑 리뷰를 내부적으로 자동 호출한다.

---

## 설정

설치하면 바로 돌아간다. 근데 리서치 깊이를 바꾸고 싶다거나, 리뷰 프리셋을 바꾸고 싶다거나, 글쓰기 톤을 커스텀하고 싶으면 — JSON 파일 하나로 된다.

```jsonc
{
  "defaults": {
    "research_depth": "medium",     // "shallow" | "medium" | "deep"
    "write_voice": "peer-mentor",   // 글쓰기 톤
    "review_preset": "content",     // "content" | "strategy" | "code" | "quick" | "full"
    "loop_max_iterations": 3,       // loop 최대 횟수
    "publish_target": "file"        // "file" | "notion"
  },
  "quality_gate": {
    "consensus_threshold": 0.67,    // 통과에 필요한 리뷰어 비율
    "external_reviewers": []        // MMBridge 경유: ["kimi", "qwen", "gemini", "codex"]
  }
}
```

전부 선택 사항이다. 신경 안 쓰는 항목은 지워도 된다.

나는 `loop_max_iterations`를 간단한 작업엔 2, 클라이언트용엔 5로 쓴다. 기본값 3이면 대부분 괜찮다. 뭘 더 바꿀 수 있냐고? `research_depth`를 `deep`으로 올리면 소스를 두 배로 긁어온다.

---

## 설계 선택과 트레이드오프

제한 사항이 아니라 선택이다. 이유가 있다:

- **자동 라우팅은 ~95% 정확하다.** 엣지 케이스에서는 `/second-claude-code:*` 슬래시 명령어로 정밀 제어가 된다.
- **haiku 에이전트가 비용을 낮춘다.** 팩트체크 같은 고빈도 작업에 opus를 쓸 이유가 없다. 대신 활성 플러그인이 많으면 컨텍스트가 빡빡해진다. 안 쓰는 플러그인은 끄면 해결.
- **Claude Code가 메인 플랫폼이다.** 완전 검증 완료. OpenClaw, Codex, Gemini CLI는 표준 프로토콜로 돌아가지만 아직 실험적이다.
- **서브에이전트 결과는 한꺼번에 온다.** 스트리밍이 아닌 이유: 결과가 다 나오기 전에 품질 게이트를 통과시킬 수 없기 때문이다. 의도적 설계.
- **리뷰 결과는 영어로 나온다.** 입력이 한국어여도 마찬가지. 한국어 출력은 준비 중.

이 중에 거슬리는 게 있으면 [이슈](https://github.com/EungjePark/second-claude-code/issues)를 열어달라. 더 나은 근거가 있으면 바꿀 수 있다.

---

## 호환성

Claude Code용으로 만들었다. SKILL.md를 읽거나 ACP를 쓰는 플랫폼이면 호환된다.

| 플랫폼 | 설치 | 상태 |
|---|---|---|
| **Claude Code** (메인) | `claude plugin add github:EungjePark/second-claude-code` | 검증 완료 |
| **OpenClaw** | 표준 ACP 프로토콜 — 자동 감지 | 실험적 |
| **Codex** | SKILL.md 호환 | 실험적 |
| **Gemini CLI** | SKILL.md 호환 | 실험적 |

---

## 기여

이슈와 PR: [github.com/EungjePark/second-claude-code](https://github.com/EungjePark/second-claude-code)

만든 사람: [Park Eungje](https://github.com/EungjePark). MIT 라이선스.

이 플러그인이 시간을 절약해줬다면 GitHub 별 하나가 큰 힘이 된다.

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

각 프레임워크는 `skills/analyze/references/frameworks/`에 독립 문서로 있다. 프롬프트에서 자동 선택되거나 직접 지정 가능:

```bash
/second-claude-code:analyze porter "클라우드 인프라 시장"
/second-claude-code:analyze rice --input features.md
```

</details>

<details>
<summary><strong>아키텍처 — 3개 모델 티어에 걸친 16마리 포켓몬</strong></summary>

| 페이즈 | 포켓몬 | 역할 | 모델 |
|---|---|---|---|
| **Plan** | 이브이 (Eevee) | 리서처 — 웹 검색, 데이터 수집 | haiku |
| | 부엉 (Noctowl) | 검색 전문 | haiku |
| | 후딘 (Alakazam) | 애널리스트 — 패턴 인식, 합성 | sonnet |
| | 뮤츠 (Mewtwo) | 전략가 — 프레임워크 분석 | sonnet |
| **Do** | 루브도 (Smeargle) | 라이터 — 장문 콘텐츠 | opus |
| | 아르세우스 (Arceus) | 마스터 — 범용 실행 | sonnet |
| **Check** | 네이티오 (Xatu) | 딥리뷰어 — 논리, 구조 | opus |
| | 앱솔 (Absol) | 데빌어드보킷 — 약점 공격 | sonnet |
| | 폴리곤 (Porygon) | 팩트체커 — 숫자, 출처 | haiku |
| | 푸린 (Jigglypuff) | 톤가디언 — 어조, 독자 | haiku |
| | 안농 (Unown) | 구조분석가 — 가독성 | haiku |
| **Act** | 메타몽 (Ditto) | 에디터 — 콘텐츠 정제 | opus |
| **인프라** | 괴력몬 (Machamp) | 스텝 실행기 | sonnet |
| | 자포코일 (Magnezone) | 인스펙터 — 스킬 후보 검사 | sonnet |
| | 테오키스 (Deoxys) | 평가자 — 스킬 점수 산정 | sonnet |
| | 캐이시 (Abra) | 커넥터 — 지식 연결 | haiku |

![Agent Roster](docs/images/agent-roster.ko.svg)

[전체 아키텍처 문서 →](docs/architecture.md)

</details>

<details>
<summary><strong>변경 이력</strong></summary>

### v0.3.0 — PDCA v2, 액션 라우터, 포켓몬 에이전트 (현재)

- **PDCA v2 오케스트레이터** + 액션 라우터 — 리뷰 실패를 근본원인별로 라우팅
- **질문 프로토콜** — PDCA가 리서치 전에 명확화 질문 (`--no-questions`로 생략 가능)
- **16마리 포켓몬 서브에이전트** — 3개 모델 티어(opus/sonnet/haiku)
- **5명 병렬 리뷰어** + 합의 게이트 + 5개 프리셋
- **훅 기반 자동 라우팅** — 영어 ~77개 + 한국어 ~50개 트리거 패턴
- **자동 캡처** — 결과물을 `.captures/`에 자동 저장
- **19개 라우팅 테스트** — false positive 커버리지

### v0.2.0 — 보안 강화, 영어 로컬라이제이션

- 훅·스킬 전반 보안 강화 (13개 감사 소견 해결)
- 전체 스킬 문서 및 README 영어 번역
- `claude plugin add` 설치를 위한 마켓플레이스 매니페스트
- 전 스킬 품질 강화 (8개 도메인 스킬 9/10 목표; v0.3.0에서 pdca를 9번째로 승격)

### v0.1.0 — 최초 릴리스

- 도메인 스킬 8개 + 오케스트레이터 1개
- `/analyze`용 15개 전략 프레임워크
- PARA 기반 지식 수집
- 반복 가능한 워크플로우를 위한 파이프라인 빌더

</details>

[English](README.md) | **한국어**

![version](https://img.shields.io/badge/version-0.5.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

# Second Claude Code — 제2의 클로드

"AI 에이전트 알아보고 보고서 써줘."

이 한 줄을 치면 이브이가 웹을 뒤져요. 후딘이 패턴을 잡아요. 루브도가 3,000자를 쓰는데 — 저한테 오기도 전에 리뷰어 다섯 마리가 이미 초안을 뜯고 있어요. 네이티오가 논리를 보고, 앱솔이 약점을 치고, 폴리곤이 숫자를 검증해요.

무슨 일이 일어난 걸까요? **한 줄 입력. 전체 사이클. 플러그인 세 개 붙여놓고 기도하는 게 아니에요.**

![한 줄로 완성까지](docs/images/hero.ko.svg)

사용해보세요.

---

## 설치 후 첫 5분

처음이라면 이 순서대로 따라와주세요. 5분이면 충분해요.

**1단계. 설치**

터미널에서 이 명령어를 입력하세요:

```bash
claude plugin add github:unclejobs-ai/second-claude-code
```

설치가 끝나면 `Plugin installed successfully` 메시지가 나와요.

**2단계. 설치 확인**

새 세션을 열어보세요. 화면 상단에 이런 텍스트가 보이면 정상이에요:

```
# Second Claude Code — 제2의 클로드
11 commands for all knowledge work:
```

이 텍스트가 안 보이면 `claude plugin list`를 실행해서 목록에 `second-claude-code`가 있는지 확인해주세요. 목록에 없으면 1단계를 다시 진행하면 돼요.

**3단계. 첫 프롬프트 입력**

보통 이렇게 시작해요:

```
AI 에이전트 프레임워크 현황을 조사하고 보고서를 써줘
```

자동 라우터가 맞는 스킬을 골라줘요. 슬래시 명령어를 외울 필요 없어요. 영어도 돼요:

```
Research AI agent frameworks and write a report
```

**4단계. 결과 확인**

프롬프트를 입력하면 다음 순서로 진행돼요:

1. 리서치 에이전트(이브이, 부엉)가 소스를 수집해요
2. 분석 에이전트(후딘)가 패턴을 정리해요
3. 글쓰기 에이전트(루브도)가 초안을 써요
4. 리뷰어 5마리가 초안을 검토해요
5. 최종본이 나와요

진행 중에 `[Plan]`, `[Do]`, `[Check]`, `[Act]` 같은 페이즈 표시가 보이면 정상이에요. 전체 과정은 주제 난이도에 따라 2~5분 정도 걸려요.

이게 어떻게 돌아가는 걸까요?

---

## 이게 해결하는 문제

AI로 글 쓰고, 리서치하고, 분석해요. 꽤 잘 돼요. 저도 몇 달을 그렇게 썼어요 — 프롬프트 치고, 결과 복사하고, 다음 프롬프트에 붙여넣고, 피드백 달라고 따로 요청하고, 수정 사항을 손으로 반영하고.

문제는 이거예요. 각 도구가 따로 놀아요. 리서치가 글쓰기를 모르고, 글쓰기가 리뷰를 몰라요. 그 사이를 잇는 건 전부 제 손이에요. 콘텐츠 하나에 컨텍스트 스위칭 다섯 번.

Second Claude Code는 그걸 고쳐요. 도구 모음이 아니라 제2의 클로드예요. 혼자 알아서 단계를 밟고, 실수를 스스로 잡고, 리뷰 안 거친 건 내보내지 않아요.

프롬프트 하나 치면 이렇게 돌아가요:

```
나: "AI 에이전트 알아보고 보고서 써줘"

[Plan]  이브이 + 부엉 20개 이상 소스를 크롤링, 후딘이 합성
        ↓ 게이트: 리서치 브리프 없으면 집필 시작 안 됨
[Do]    루브도가 리서치 기반으로 전체 초안 작성
        ↓ 게이트: 초안은 저한테 안 오고 리뷰로 감
[Check] 리뷰어 5마리가 병렬로 — 논리, 팩트, 톤, 구조, 약점
        ↓ 게이트: 2/3 통과해야 승인. Critical 하나라도 있으면 차단
[Act]   액션 라우터가 피드백을 읽어요:
        → 리서치 부족? Plan으로 돌아가요.
        → 빠진 섹션? Do로 돌아가요.
        → 다듬기 문제? 메타몽이 refine 돌려요.

최종본이 저한테 와요. 리뷰 끝. 팩트체크 끝. 정제 끝.
```

![PDCA Cycle](docs/images/pdca-cycle.ko.svg)

---

## v0.5.0에서 달라진 것들

실제로 쓰는 방식을 바꾼 다섯 가지예요.

**Soul System — 쌓이는 기억.** 세 가지 모드: `manual`(직접 기억시키기), `learning`(관찰 후 스스로 추론), `hybrid`(둘 다). 몇 세션이 지나면 시스템이 글쓰기 톤, 자주 다루는 주제, 반복되는 피드백 패턴을 파악해요. 매번 다시 설명할 필요가 없어져요.

**Batch 병렬 분해.** 어떤 작업은 직렬로 돌리기엔 너무 커요. `batch`가 독립 단위로 쪼개서 병렬 실행하고 결과를 다시 합쳐요. 직렬로 40분 걸릴 10파트 경쟁사 분석이 8분에 끝나요.

**이벤트 소싱 + 애널리틱스.** 모든 PDCA 사이클이 이벤트 로그로 기록돼요 — 페이즈 전환, 게이트 결정, 리뷰 점수, 액션 라우팅. 히스토리를 쿼리하고, 어느 페이즈에서 가장 많이 실패하는지 볼 수 있어요. 중간에 크래시 나도 처음부터 다시 돌릴 필요 없어요.

**Playwright 동적 웹 리서치.** 이브이가 이제 JavaScript 기반 페이지를 직접 실행하고, 동적 인터랙션을 처리해요. 현대 SaaS 사이트, 대시보드, SPA에서의 리서치가 드디어 제대로 돌아가요.

**채널 알림.** 피카츄가 완료 알림을 Slack, Telegram, 이메일로 쏴줘요. PDCA 장시간 실행 걸어놓고 노트북 덮고 나가면 돼요. 완료되면 핑이 와요. 7개 라이프사이클 훅, 11개 MCP 도구가 새 상태 레이어를 지탱해요.

---

## 이런 상황에서 쓰세요

어떤 상황에서 Second Claude Code가 빛을 발하는지, 실전 시나리오 다섯 가지를 정리했어요.

### 시장 조사 보고서가 급할 때

내일까지 "AI 에이전트 시장 현황" 보고서를 내야 하는데, 소스 찾고 정리할 시간이 없어요.

```
AI 에이전트 시장을 조사하고, 주요 플레이어 비교와 트렌드 분석을 포함한 보고서를 써줘
```

20개 이상 소스를 크롤링하고, 패턴을 분석하고, 리뷰까지 거친 보고서가 나와요. 소스 목록도 같이 달려요.

### 경쟁사 SWOT 분석이 필요할 때

전략 회의 준비인데, 경쟁사 분석을 프레임워크에 맞춰서 정리해야 해요.

```
/second-claude-code:analyze swot "우리 회사의 SaaS 제품 vs 경쟁사 3개"
```

15개 내장 프레임워크(SWOT, Porter, RICE 등) 중 맞는 걸 골라서 구조화된 분석 결과를 줘요. 프레임워크를 직접 지정할 수도 있고, 주제만 던지면 자동으로 골라줘요.

### 뉴스레터/블로그를 매주 써야 할 때

매주 뉴스레터를 쓰는데, 매번 리서치부터 초안, 퇴고까지 반나절이 걸려요.

```
이번 주 AI 뉴스레터를 써줘. 주제: 멀티모달 에이전트의 부상. 독자층: 테크 리더
```

리서치 → 작성 → 리뷰 → 정제까지 한 번에 돌아가요. 매주 같은 패턴이면 `workflow`로 저장해두면 다음부턴 주제만 바꿔서 돌리면 돼요.

### 기존 초안을 제출 전에 검증할 때

보고서 초안은 다 썼는데, 논리 빈틈이나 팩트 오류가 없는지 확인하고 싶어요.

```
이 초안을 리뷰해줘. 외부 발표용이라 꼼꼼하게.
```

리뷰어 5마리가 논리, 팩트, 톤, 구조, 약점을 병렬로 검토해요. 2/3 통과 기준으로 승인 여부가 나오고, Critical 소견이 있으면 구체적인 수정 포인트를 알려줘요.

### 반복 워크플로우를 자동화할 때

"리서치 → 분석 → 초안 → 리뷰"를 매번 같은 순서로 돌리는데, 매번 프롬프트를 새로 치기 귀찮아요.

```
/second-claude-code:workflow run autopilot --topic "이번 달 업계 트렌드 리포트"
```

한 번 세팅해두면 주제만 바꿔서 돌릴 수 있어요. 커피 마시고 돌아오면 완성된 결과물이 기다리고 있어요.

---

## 스킬 고르기

단계니 사이클이니 신경 쓸 필요 없어요. 하고 싶은 말만 하면 돼요.

글감이 잡히면 `write` 하나면 충분해요. 초안이 이미 있으면 `review`로 다섯 관점에서 피드백을 받아요. 리서치부터 퍼블리싱까지 전부 돌리고 싶으면 `pdca`가 알아서 해요.

다음 작업에 뭘 쓸까요?

| 하고 싶은 것 | 스킬 | 결과물 |
|---|---|---|
| 리서치→작성→리뷰→개선 전체 사이클 | `pdca` | 조사하고 쓰고 검증한 글 — 프롬프트 하나로 |
| 주제 파기 | `research` | 20개 이상 소스 크롤링, 패턴 분석, 브리프 |
| SWOT, Porter, RICE 등 15개 프레임워크 | `analyze` | 구조화된 전략 분석 |
| 아티클, 보고서, 뉴스레터 | `write` | 리서치 + 초안 + 리뷰가 한 명령어로 |
| 3~5명 관점에서 초안 리뷰 | `review` | 병렬 리뷰 + 합의 투표 |
| 목표 점수까지 다듬기 | `refine` | 리뷰어가 통과할 때까지 반복 |
| URL, 메모, 발췌 저장 | `collect` | PARA 분류 기반 지식 캡처 |
| 여러 스킬을 워크플로우로 연결 | `workflow` | 커스텀 자동화 |
| 없는 스킬 찾아 설치 | `discover` | 새 스킬 탐색 및 설치 |
| 나를 기억하고 학습하게 | `soul` | 너를 이해하고 기억한다 |
| 대형 작업을 병렬로 쪼개기 | `batch` | 대형 작업 병렬 분해 |

스킬은 전부 자연어로 반응해요. 정밀하게 쓰고 싶으면 슬래시 명령어도 돼요: `/second-claude-code:write`, `/second-claude-code:review`, `/second-claude-code:workflow`, `/second-claude-code:discover` 등. 저는 반은 한국어, 반은 영어로 쓰는데 라우터가 알아서 처리해요. 트리거 패턴 총 ~127개.

```
"AI 에이전트 알아보고 보고서 써줘"       →  pdca (전체 사이클)
"이 주제로 아티클 작성해"                →  write
"Analyze this market with SWOT"        →  analyze
"이 초안을 리뷰해"                      →  review
```

---

## 리뷰 시스템

글 쓰고 퍼블리시하고 나서 10분 뒤에 뻔한 실수를 발견한 적 있지 않나요?

대부분의 AI 글쓰기 도구는 생성하고 바로 넘겨요. Second Claude Code는 생성한 다음 **자기 결과물을 공격한 후에** 넘겨요. 차이가 여기에 있어요.

`/second-claude-code:review`는 전문 에이전트 3~5마리를 병렬로 투입해요:

| 리뷰어 | 포켓몬 | 모델 | 하는 일 |
|---|---|---|---|
| 딥리뷰어 | 네이티오 (Xatu) | opus | 논리, 완결성, 논증 흐름 |
| 데빌어드보킷 | 앱솔 (Absol) | sonnet | 가장 약한 지점을 찾아서 때려요 |
| 팩트체커 | 폴리곤 (Porygon) | haiku | 숫자, 주장, 출처를 전부 검증해요 |
| 톤가디언 | 푸린 (Jigglypuff) | haiku | 어조 일관성, 독자 적합성 |
| 구조분석가 | 안농 (Unown) | haiku | 가독성, 구성 |

왜 포켓몬이냐고요? 이름이 역할이랑 맞아떨어져요. 네이티오는 과거와 미래를 동시에 보는 포켓몬이에요 — 구조적 결함을 잡아요. 앱솔은 재앙을 감지하는 포켓몬이에요 — 취약점을 찾아요. 폴리곤은 디지털 네이티브예요 — 데이터 기반으로 판단해요. 외우기 쉽고, 외우니까 누가 뭘 하는지 진짜로 기억하게 돼요.

**합의 게이트:** 2/3 통과하면 APPROVED. Critical이 하나라도 나오면 MUST FIX. 급하다고 예외 없어요.

저는 외부에 내보내는 건 `full`로 돌려요. 내부용 초안은 `quick`이면 충분해요 — 앱솔이랑 폴리곤이 심각한 문제는 1분 안에 잡아요.

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

`--external`로 MMBridge 경유 크로스 모델 리뷰(Kimi, Qwen, Gemini, Codex)를 추가할 수 있어요. 별도 셋업이 필요해요.

</details>

---

## 사고방식

대부분의 AI 도구는 수동적이에요 — 시키면 해요. Second Claude Code는 품질에 대한 의견이 있고, 그걸 강제해요. 세 가지 생각이 전부를 관통해요.

**스킬 11개. 80개가 아니에요.** 하나하나가 깊어요 — 레퍼런스, 함정 문서, 품질 게이트가 내장되어 있어요. 80개 중에 뭘 골라야 하나 고민할 일이 없어요. 하고 싶은 말만 하면 11개 중 하나가 알아서 잡아요.

**모든 산출물은 리뷰를 거쳐요.** 이건 권장이 아니에요. 품질 게이트가 건너뛰기를 막아요. 합의 게이트를 안 통과한 초안은 물리적으로 저한테 안 와요.

**실패하면 원인을 찾아서 돌아가요.** 리뷰에서 문제가 나오면 액션 라우터가 근본원인을 분류해요. 리서치가 부족하면 Plan으로. 빠진 섹션이 있으면 Do로. 다듬기 문제면 Refine으로. 모든 문제를 refine으로 밀어넣으면 시간만 낭비돼요.

그래서 실전에서 뭐가 달라지냐고요? PDCA 두 번째 사이클이 첫 번째보다 압도적으로 좋아져요. 액션 라우터가 각 사이클을 진짜 문제에 집중시키기 때문이에요.

---

## 스킬 조합

스킬은 서로를 호출해요. 여기서 재밌어져요.

| 패턴 | 돌아가는 방식 | 이럴 때 |
|---|---|---|
| 풀 PDCA | research → analyze → write → review → refine | 주제 잡고 글 완성까지 |
| 빠른 검수 | review → refine | 있는 초안 다듬기 |
| 기획만 | research → analyze | 시장 파악하고 판단하기 |
| 자동 PDCA | `workflow run autopilot --topic "..."` | 세팅하고 커피 마시고 오면 끝 |

저는 외부용은 전부 풀 PDCA로 돌려요. 내부 메모 수준이면 `write` 단독으로 충분해요 — 그것만으로도 리서치랑 리뷰를 내부적으로 자동 호출해요.

---

## 설정

설치하면 바로 돌아가요. 리서치 깊이를 바꾸고 싶거나, 리뷰 프리셋을 바꾸고 싶거나, 글쓰기 톤을 커스텀하고 싶으면 — JSON 파일 하나로 돼요.

```jsonc
{
  "defaults": {
    "research_depth": "medium",     // "shallow" | "medium" | "deep"
    "write_voice": "peer-mentor",   // 글쓰기 톤
    "review_preset": "content",     // "content" | "strategy" | "code" | "quick" | "full"
    "refine_max_iterations": 3,     // refine 최대 횟수
    "publish_target": "file"        // "file" | "notion"
  },
  "quality_gate": {
    "consensus_threshold": 0.67,    // 통과에 필요한 리뷰어 비율
    "external_reviewers": []        // MMBridge 경유: ["kimi", "qwen", "gemini", "codex"]
  }
}
```

전부 선택 사항이에요. 신경 안 쓰는 항목은 지워도 돼요.

저는 `refine_max_iterations`를 간단한 작업엔 2, 클라이언트용엔 5로 써요. 기본값 3이면 대부분 괜찮아요. `research_depth`를 `deep`으로 올리면 소스를 두 배로 긁어와요.

---

## 자주 묻는 질문

<details>
<summary><strong>Claude Code가 뭔가요?</strong></summary>

Anthropic이 만든 터미널 기반 AI 코딩 도구예요. 코드뿐 아니라 글쓰기, 리서치, 분석 등 지식 작업 전반에 쓸 수 있어요. Second Claude Code는 이 Claude Code 위에서 돌아가는 플러그인이에요.

설치 방법: [claude.ai/code](https://claude.ai/code)에서 안내를 따라주세요.

</details>

<details>
<summary><strong>영어로 써야 하나요?</strong></summary>

아니요. 한국어로 써도 돼요. 자동 라우터가 한국어 트리거 패턴 ~50개를 인식해요. "AI 에이전트 알아보고 보고서 써줘"처럼 자연스럽게 입력하면 돼요. 영어/한국어 섞어서 써도 문제없어요.

다만 리뷰 결과는 현재 영어로 나와요. 한국어 리뷰 출력은 준비 중이에요.

</details>

<details>
<summary><strong>비용이 얼마나 드나요?</strong></summary>

Second Claude Code 플러그인 자체는 무료(MIT 라이선스)예요. 비용은 Claude Code 사용료에서 나와요. 서브에이전트가 haiku/sonnet/opus 세 티어로 나뉘어서, 팩트체크 같은 고빈도 작업은 haiku가 처리해요. 비용 효율을 위해 설계된 구조예요.

대략적으로, 보고서 하나를 풀 PDCA로 돌리면 Claude Code 기준 $0.5~2 정도 나와요. 주제 복잡도와 refine 횟수에 따라 달라져요.

</details>

<details>
<summary><strong>다른 플러그인이랑 같이 쓸 수 있나요?</strong></summary>

네, 같이 쓸 수 있어요. 다만 활성 플러그인이 많으면 컨텍스트 윈도우가 빡빡해질 수 있어요. 안 쓰는 플러그인은 꺼두는 걸 추천해요.

Claude Code 외에 OpenClaw, Codex, Gemini CLI에서도 실험적으로 돌아가요. SKILL.md를 읽거나 ACP 프로토콜을 쓰는 플랫폼이면 호환돼요.

</details>

<details>
<summary><strong>결과물이 마음에 안 들면 어떻게 하나요?</strong></summary>

두 가지 방법이 있어요. 첫째, `refine`으로 목표 점수까지 반복 개선할 수 있어요. 리뷰어가 통과할 때까지 자동으로 다듬어요. 둘째, 구체적으로 피드백을 주면 돼요 — "톤을 더 캐주얼하게", "데이터를 더 넣어줘"처럼요. PDCA 사이클이 피드백 유형에 맞는 페이즈로 돌아가서 고쳐요.

</details>

---

## 설계 선택과 트레이드오프

제한 사항이 아니라 선택이에요. 이유가 있어요:

- **자동 라우팅은 ~95% 정확해요.** 엣지 케이스에서는 `/second-claude-code:*` 슬래시 명령어로 정밀 제어가 돼요.
- **haiku 에이전트가 비용을 낮춰요.** 팩트체크 같은 고빈도 작업에 opus를 쓸 이유가 없어요. 대신 활성 플러그인이 많으면 컨텍스트가 빡빡해져요. 안 쓰는 플러그인은 끄면 해결돼요.
- **Claude Code가 메인 플랫폼이에요.** 완전 검증 완료. OpenClaw, Codex, Gemini CLI는 표준 프로토콜로 돌아가지만 아직 실험적이에요.
- **서브에이전트 결과는 한꺼번에 와요.** 스트리밍이 아닌 이유: 결과가 다 나오기 전에 품질 게이트를 통과시킬 수 없기 때문이에요. 의도적 설계예요.
- **리뷰 결과는 영어로 나와요.** 입력이 한국어여도 마찬가지예요. 한국어 출력은 준비 중이에요.

이 중에 거슬리는 게 있으면 [이슈](https://github.com/unclejobs-ai/second-claude-code/issues)를 열어주세요. 더 나은 근거가 있으면 바꿀 수 있어요.

---

## 호환성

Claude Code용으로 만들었어요. SKILL.md를 읽거나 ACP를 쓰는 플랫폼이면 호환돼요.

| 플랫폼 | 설치 | 상태 |
|---|---|---|
| **Claude Code** (메인) | `claude plugin add github:unclejobs-ai/second-claude-code` | 검증 완료 |
| **OpenClaw** | 표준 ACP 프로토콜 — 자동 감지 | 실험적 |
| **Codex** | SKILL.md 호환 | 실험적 |
| **Gemini CLI** | SKILL.md 호환 | 실험적 |

---

## 기여

이슈와 PR: [github.com/unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)

만든 사람: [Unclejobs](https://github.com/unclejobs-ai). MIT 라이선스.

이 플러그인이 시간을 절약해줬다면 GitHub 별 하나가 큰 힘이 돼요.

---

<details>
<summary><strong>15개 전략 프레임워크</strong></summary>

`/second-claude-code:analyze`는 15개 내장 프레임워크를 지원해요:

| 카테고리 | 프레임워크 |
|---|---|
| **전략** | ansoff, porter, pestle, north-star, value-prop |
| **기획** | prd, okr, lean-canvas, gtm, battlecard |
| **우선순위** | rice, pricing |
| **분석** | swot, persona, journey-map |

각 프레임워크는 `skills/analyze/references/frameworks/`에 독립 문서로 있어요. 프롬프트에서 자동 선택되거나 직접 지정할 수 있어요:

```bash
/second-claude-code:analyze porter "클라우드 인프라 시장"
/second-claude-code:analyze rice --input features.md
```

</details>

<details>
<summary><strong>팀 소개 — 3개 모델 티어에 걸친 17개 에이전트</strong></summary>

모델 분포: 4 opus / 7 sonnet / 6 haiku

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
| | 피카츄 (Pikachu) | 알림 발송 — 채널 & 완료 알림 | sonnet |

![Agent Roster](docs/images/agent-roster.ko.svg)

[전체 아키텍처 문서 →](docs/architecture.md)

</details>

<details>
<summary><strong>변경 이력</strong></summary>

### v0.5.0 — Soul System, Batch, 이벤트 소싱 (현재)

- **Dynamic Soul System** — 3가지 메모리 모드: manual / learning / hybrid. 세션을 거치며 사용자를 이해하고 행동을 조정해요
- **Batch 병렬 분해** — 대형 작업을 독립 단위로 자동 분해 후 병렬 실행, 결과 재합성. `batch` 스킬이 오케스트레이션 담당
- **이벤트 소싱 + 애널리틱스** — PDCA 사이클 전체 이벤트 로그. 히스토리 쿼리, 실패 패턴 분석, 크래시 후 재개 지원
- **Playwright 동적 웹 리서치** — JavaScript 기반 페이지 실행, 현대 SaaS/SPA 리서치 정상화
- **채널 알림** — 피카츄가 Slack, Telegram, 이메일로 완료 알림 발송
- **7개 라이프사이클 훅** — 각 PDCA 페이즈 pre/post 훅 + 크래시 복구
- **11개 MCP 도구** — PDCA MCP 서버 경유 상태 관리, 애널리틱스, 크로스 세션 컨텍스트
- **17마리 포켓몬 서브에이전트** — 3개 모델 티어(4 opus / 7 sonnet / 6 haiku)
- **신규 스킬 2개**: `soul`, `batch`

### v0.3.0 — PDCA v2, 액션 라우터, 포켓몬 에이전트

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

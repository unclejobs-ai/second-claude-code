# Second Claude Code — v0.6.0 ~ v0.9.0 통합 개선안

> **작성일**: 2026-03-28
> **기반 분석**: 프로젝트 전수 점검 + 외부 리서치 (유사 플러그인/워크플로우) + mmbridge CLI 소스코드 분석 + Hermes 에이전트 전면 해부 + AutoResearchClaw 아키텍처 분석
> **현황**: v0.5.8 / 299파일 / 24,720라인 / 194 tests / 13 skills / 17 agents / 8 hooks / 2 MCP servers
>
> **경계 원칙** (docs/plans/2026-03-23-hermes-boundary-and-memory-notes.md):
> - Hermes에서 *철학과 패턴*만 차용한다. 런타임/인프라는 도입하지 않는다.
> - Hermes gateway, cron scheduler를 코어 의존성으로 두지 않는다.
> - Second Claude Code는 Claude Code 플러그인으로 독립 실행 가능해야 한다.

---

## 목차

1. [현황 진단 요약](#1-현황-진단-요약)
2. [분석 소스별 핵심 발견](#2-분석-소스별-핵심-발견)
3. [v0.6.0 — Philosophy & Foundation](#3-v060--philosophy--foundation)
4. [v0.7.0 — See & Test](#4-v070--see--test)
5. [v0.8.0 — Bridge & Automate](#5-v080--bridge--automate)
6. [v0.9.0 — Observe & Scale](#6-v090--observe--scale)
7. [Hermes & ARC → Second Claude Code 매핑 테이블](#7-hermes--arc--second-claude-code-매핑-테이블)
8. [가져오지 않는 것](#8-가져오지-않는-것)
9. [기타 발견된 문제들 (버그/정리)](#9-기타-발견된-문제들-버그정리)

---

## 1. 현황 진단 요약

### 강점
- PDCA 사이클 프레임워크가 MCP 서버로 구현되어 있음 (21개 tool)
- 17개 Pokemon 테마 에이전트가 역할별로 잘 분리됨
- 194개 테스트 (193 pass, 1 skip, 0 fail)
- 프롬프트 감지 기반 스킬 라우팅 구현
- 바이링구얼 문서 (EN/KO README 독립 유지)

### 약점 — 4대 갭

| 갭 | 심각도 | 현황 |
|---|---|---|
| **시각화/리포팅** | P0 | 런타임 시각화 완전 부재. 정적 SVG 8개뿐. pdca_get_analytics가 JSON 리턴하지만 소비하는 곳 없음. 차트 라이브러리 0개 |
| **테스트 커버리지 불균형** | P0 | 대형 훅 4개(합산 1,505줄)에 테스트 2개(session-end 2건)만 존재. MCP 핸들러 5개 중 4개 전용 테스트 없음. loop-runner(912줄)에 테스트 8개 |
| **mmbridge 연동** | P1 | skill-first 통합 (references/mmbridge-integration.md 136줄 가이드). 에이전트가 SKILL.md + 가이드를 읽고 CLI 실행하는 설계. 작동은 하지만 프로그래매틱 MCP 연동으로 안정성/재현성 향상 가능 |
| **스킬 행동규범** | P1 | 13개 스킬이 정보 위주. "뭘 하지 않는가"에 대한 정의 없음. 합리화 방지 장치 없음 |

### 테스트 커버리지 상세

| 파일 | 라인수 | 테스트수 | 상태 |
|---|---|---|---|
| session-end.mjs | 654 | 2 | ⚠️ 부족 (session-end.test.mjs + session-end-daemon.test.mjs) |
| subagent-stop.mjs | 387 | 0 | ❌ 없음 |
| compaction.mjs | 223 | 0 | ❌ 없음 |
| subagent-start.mjs | 181 | 0 | ❌ 없음 |
| soul-observer.mjs | 179 | 0 | ❌ 없음 |
| stop-failure.mjs | 68 | 0 | ❌ 없음 |
| loop-runner.mjs | 912 | 8 | ⚠️ 부족 |
| soul-handlers.mjs | 130 | 0 | ❌ 없음 |
| loop-handlers.mjs | 27 | 0 | ❌ 없음 |
| session-handlers.mjs | 24 | 0 | ❌ 없음 |
| memory-handlers.mjs | 36 | 0 | ❌ 없음 |
| daemon-handlers.mjs | 56 | 0 | ❌ 없음 |

---

## 2. 분석 소스별 핵심 발견

### 2-A. 프로젝트 전수 점검 (서브에이전트 #1)

- 전체 299파일, 38 .mjs / 210 .md / 17 .json
- 16개 테스트 파일, 194 tests across 15 suites
- TODO/FIXME/HACK 주석 0개 (코드 내 기술 부채가 문서화되지 않음)
- `{references}` 유령 디렉토리 8개 (템플릿 확장 오류 흔적)
- 스킬 중 가장 얇은 것: loop(53줄), collect(91줄), discover(97줄)
- companion daemon은 스텁 수준 (103줄 wrapper)
- 에러 모니터링/옵저버빌리티 전무

### 2-B. 외부 리서치 — 유사 도구 벤치마크 (서브에이전트 #2)

**시각화 패턴:**
- LangSmith: 트레이스 타임라인, 토큰 사용량, 레이턴시 메트릭, 성공/실패율 대시보드
- CrewAI: 에이전트별 실행 로그 + 크루 퍼포먼스 메트릭
- Aider: 터미널 스피너 + 컬러 출력 + git 스타일 diff
- Mermaid: 유니버설 교환 포맷 (GitHub/Notion 렌더링)
- Chart.js: 정적 HTML에 메트릭 차트 임베드
- 터미널: blessed, ink(React for CLI), cli-table3, 스파크라인

**테스트 전략:**
- Contract 테스트: 에이전트 input/output JSON 스키마 검증 (CrewAI, LangChain)
- Snapshot 테스트: golden baseline 비교, 시맨틱 유사도 (Aider)
- Integration 테스트: VCR/cassette 패턴으로 LLM 응답 녹화/재생 (nock)
- Scenario 테스트: BDD 스타일 시나리오별 에이전트 행동 검증
- Evaluation 테스트: LLM-as-judge (promptfoo, deepeval)
- Chaos 테스트: 타임아웃, 에러, 잘못된 출력 주입

**멀티모델 리뷰:**
- Aider Architect Mode: 강한 모델(계획) + 약한 모델(실행) 분리
- Voting/Consensus: N개 모델 → 다수결 (mixture-of-agents)
- Sequential Review Chain: A 생성 → B 리뷰 → A 수정
- Parallel Specialist: 보안(A) + 성능(B) + 스타일(C) 병렬
- Debate/Adversarial: Red team vs Blue team, 제3자 판정

**품질 게이트/메트릭:**
- Plan: 요구사항 완전성, 분해 품질, 추정 vs 실제 복잡도
- Do: 구현 시간, 첫 컴파일 성공률, 변경 라인수
- Check: 테스트 통과율, 멀티모델 리뷰 스코어, 보안 취약점 수
- Act: 해결 이슈수, 사이클 시간, 개선율, 기술부채 델타

### 2-C. mmbridge CLI 소스코드 분석 (서브에이전트 #3)

**16개 커맨드:**
review, followup, resume, doctor, gate, handoff, diff, research, debate, security, embrace, init, sync-agents, tui, hook install/uninstall, memory (search/timeline/show)

**핵심 발견:**
- 전 커맨드 `--json` 지원 → 머신 파서블 출력
- `review --export <path>`: 마크다운 리포트 생성
- `embrace`: 풀 라이프사이클 (research → debate → checkpoint → review → security → report)
  - `overallScore` /100 리턴
  - `report.recommendations[]` 배열
- `gate --format json`: CI/CD 품질 게이트 (pass/warn + nextCommand)
- **MCP 서버 내장** (`@mmbridge/mcp`): 9개 tool
  - mmbridge_review, _followup, _interpret, _sessions, _search, _research, _debate, _security, _embrace
  - 2 resources: sessions://list, adapters://status
  - 1 prompt: review-context
- `live-state` (`~/.mmbridge/.live.json`): 200ms 갱신, 실시간 진행 상황
  - 현재 phase, elapsed time, tool states, telemetry, stream lines, events
- `handoff --json`: nextPrompt, nextCommand로 자동 워크플로우 연속

**review --json 출력 구조:**
```json
{
  "tool": "...",
  "mode": "review|security|architecture",
  "status": "complete|error",
  "summary": "...",
  "findings": [{"severity": "...", "file": "...", "line": N, "message": "..."}],
  "toolResults": [],
  "interpretation": "...",
  "handoff": {"markdownPath": "...", "openBlockers": [], "nextCommand": "..."},
  "nextPrompt": "...",
  "nextCommand": "..."
}
```

**embrace --json 출력 구조:**
```json
{
  "runId": "...",
  "report": {
    "overallScore": 83,
    "researchSummary": "...",
    "debateOutcome": "...",
    "reviewFindings": [],
    "securityFindings": [],
    "recommendations": []
  }
}
```

### 2-D. Hermes 에이전트 전면 해부 (서브에이전트 #4, #5, #6)

**코어 아키텍처:**
- 120+ 스킬, 22개 카테고리
- 듀얼 메모리: USER.md (1,375자) + MEMORY.md (2,200자), §-delimited
- Frozen Snapshot 패턴: 세션 시작 시 메모리 캡처 → 시스템 프롬프트 주입 → 세션 중 불변 (프롬프트 캐시 안정성)
- SQLite FTS5 세션 검색 + 보조 LLM 요약 (Gemini Flash)
- ThreadPoolExecutor 기반 서브에이전트 (max depth 2, max concurrent 3)
- 자동 컨텍스트 압축 (85% 도달 시, 20% 타겟 요약)

**스킬 시스템 — Progressive Disclosure (3-Tier):**
- Tier 1: 이름 + 설명 (≤1024자, 시스템 프롬프트에 항상 노출)
- Tier 2: SKILL.md 전체 (skill_view로 온디맨드 로드)
- Tier 3: references/, templates/, scripts/ (필요 시 추가 로드)
- 디스크 캐시 매니페스트 (.skills_prompt_snapshot.json)

**스킬 품질 패턴 — Hermes만의 차별점:**

1. **IRON LAW** — 절대 불가침 원칙 (박스 포맷)
   - TDD: "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"
   - Debugging: "NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"

2. **RED FLAGS / STOP CONDITIONS** — 자동 합리화 방지
   - "이런 생각이 들면 STOP" 목록
   - AI가 지름길 택하는 것을 구조적으로 방지

3. **COMMON RATIONALIZATIONS** 테이블
   ```
   | 변명                    | 현실                          |
   |------------------------|-------------------------------|
   | "빨리 해야 해서"        | "빠른 게 나중에 더 느리다"     |
   | "이건 사소한 변경"      | "사소한 버그가 P0 된다"        |
   ```

4. **PITFALLS** — 이론적 경고가 아닌 실전 교훈
   - "Orphan stubs may have importers — always grep before declaring a file orphan"

5. **PHASE-GATED WORKFLOWS** — 단계 간 체크리스트 게이트
   - "모든 박스 체크 안 되면 진행 불가"

6. **VERIFICATION CHECKLISTS** — 실행 가능한 검증 커맨드 + 기대 출력

7. **ZERO-CONTEXT STANDARD** (Walnut)
   - 모든 기록은 이전 맥락 없이 독립적으로 이해 가능해야 함
   - "write for the future cold reader"

8. **INTEGRATION SECTIONS** — 스킬 간 연계 방법 명시

**Walnut/ALIVE 컨텍스트 시스템:**
```
~/world/
├── 01_Archive/
├── 02_Life/
├── 03_Inputs/
├── 04_Ventures/     (fronmpt-academy, scenesteller)
└── 05_Experiments/  (second-claude-code, hermes-infra)

각 walnut/_core/:
├── key.md       정체성: type, goal, rhythm, tags
├── now.md       현재 상태: phase, next action, capsule
├── log.md       시간순 기록 (base36 타임스탬프)
├── tasks.md     Urgent/Active/To Do/Blocked/Done
├── insights.md  누적 인사이트
└── _capsules/   하위 컨텍스트
```

행동 프로토콜:
- **Read-Before-Speak**: 작업 전 반드시 walnut_read
- **Stash System**: 대화 중 결정/태스크/노트 추적
- **Save Protocol**: 5건 누적 or 30분마다 체크포인트
- **Zero-Context Standard**: 로그 항목은 콜드 스타트 에이전트도 이해 가능

**크론 시스템:**
- JSON 기반 (~/.hermes/cron/jobs.json)
- Gateway에서 60초마다 tick
- 멀티 플랫폼 딜리버리 (telegram, discord, slack, email, sms...)
- 스킬 로딩 지원 (jobs에 skills[] 필드)
- SILENT_MARKER로 무출력 건너뛰기

**MCP 통합 패턴:**
- config.yaml에 서버 등록 → 자동 discovery
- 도구 이름: `mcp_{server}_{tool}`
- stdio + HTTP/StreamableHTTP 트랜스포트
- 자동 재연결 (지수 백오프, 5회)
- OAuth 2.1 PKCE 지원
- Sampling 지원 (서버 주도 LLM 요청)

**웹훅 어댑터:**
- GitHub PR → 자동 코드 리뷰 → PR 코멘트
- HMAC 서명 검증, 레이트 리밋, 멱등성 캐시
- 라우트별 스킬 로딩, 프롬프트 템플릿

**관련 스킬 중 PDCA 접목도 높은 것 (Score 5/5):**
- writing-plans (296줄): 태스크 분해, 플랜 구조, 검증 스텝
- subagent-driven-development (342줄): 실행 오케스트레이션 + 2단계 리뷰
- test-driven-development (342줄): RED-GREEN-REFACTOR + Iron Law
- systematic-debugging (366줄): 4단계 근본원인 분석
- requesting-code-review (269줄): 멀티 디멘션 리뷰 + 품질 게이트
- full-project-health-audit (171줄): P0-P3 우선순위 5단계 감사
- fact-check-claims (131줄): 멀티소스 검증 프레임워크
- dogfood (162줄): 체계적 QA, 5단계 워크플로우
- claude-code-plugin-audit-improve (98줄): PDCA 스타일 감사+개선
- walnuts (258줄): 프로젝트 메모리, zero-context standard
- plan (57줄): 읽기 전용 플랜 모드

### 2-E. AutoResearchClaw 아키텍처 분석 (서브에이전트 #7, #8)

**프로젝트 개요:**
- GitHub: https://github.com/aiming-lab/AutoResearchClaw
- 60,700줄 Python, 30,363줄 테스트, 1,823 tests
- "토픽 하나 넣으면 학술 논문 완성" — 23단계 풀 자동화 파이프라인
- MIT 라이선스, v0.3.2

**23-Stage Pipeline (8 Phases):**

| Phase | Stages | 내용 |
|---|---|---|
| A. Research Scoping | 1-2 | SMART 목표, 하위 질문 분해 |
| B. Literature Discovery | 3-6 | OpenAlex→S2→arXiv 검색, [GATE] 스크리닝, 지식 카드 |
| C. Knowledge Synthesis | 7-8 | 클러스터링, 멀티에이전트 디베이트 → 가설 생성 |
| D. Experiment Design | 9-11 | [GATE] 실험 설계, 코드 생성(AST 검증), 리소스 추정 |
| E. Experiment Execution | 12-13 | 샌드박스 실행, 자가치유 edit-run-eval (최대 10회) |
| F. Analysis & Decision | 14-15 | 멀티에이전트 분석, PROCEED/REFINE/PIVOT 판단 (최대 2 피벗) |
| G. Paper Writing | 16-19 | 아웃라인→드래프트→피어리뷰→리비전 |
| H. Finalization | 20-23 | [GATE] 7차원 스코어링, 회고, LaTeX 변환, 4중 인용 검증 |

**핵심 차별화 패턴 (우리에게 적용 가능한 것):**

1. **Stage Contracts**: 23개 스테이지 각각에 formal I/O 계약 (input_files, output_files, DoD, error_code, max_retries). 계약 미충족 시 진행 차단.

2. **PIVOT/REFINE Decision Loop**: Stage 15에서 자율 판단 3분기 — PROCEED(진행), REFINE(현재 단계 재실행), PIVOT(롤백). max_pivots=2로 무한 루프 방지. 아티팩트 버저닝으로 이전 상태 보존.

3. **Self-Evolution (EvolutionStore)**: 매 실행마다 교훈 JSONL 기록. 6 카테고리 분류. 30일 시간 감쇄. 다음 실행 시 프롬프트 오버레이로 주입. MetaClaw bridge가 교훈→SKILL.md 자동 변환.

4. **Anti-Fabrication / Verified Registry**: 실험에서 나온 실제 숫자 화이트리스트 구축. paper_verifier가 검증 안 된 숫자 포함 시 거부. 4중 인용 검증 (arXiv, CrossRef, DataCite, Semantic Scholar).

5. **MetaClaw PRM (Process Reward Model)**: LLM-as-judge로 스테이지별 품질 평가. 스테이지→스킬 매핑. 스킬 피드백 트래킹 (helped/hurt per stage).

6. **Adapter Protocol**: Protocol 인터페이스로 외부 의존성 추상화 (message, memory, cron, web_fetch, browser). Recording 어댑터로 테스트 시 녹화/재생.

7. **Iterative Quality Convergence**: 품질 스코어가 임계값 도달 또는 수렴(연속 N회 변화 < ε)할 때까지 반복 실행. 수렴 감지기로 무한 루프 방지.

8. **Knowledge Graph**: entities/relations/builder/query/visualizer 구조. 문헌에서 추출한 지식을 그래프로 구조화하여 시각화+쿼리.

9. **Domain Auto-Detection**: 10개 도메인 어댑터 + 25개 YAML 프로필. 토픽 텍스트에서 자동 도메인 감지 → 프롬프트 커스텀.

10. **Multi-Agent Sub-Pipelines**: BenchmarkAgent(4), FigureAgent(7), CodeAgent(multi-phase). 복잡한 서브태스크를 전용 에이전트 파이프라인으로 분리.

**가져오지 않는 것:**
- 23단계 논문 생성 파이프라인 자체 (우리는 코드 품질 도구)
- LaTeX 컴파일러 / 학회 템플릿
- 실험 샌드박스 (Docker/SSH/Colab)
- Overleaf 동기화, 음성 인터페이스, FastAPI 웹서버
- 문헌 검색 API 직접 호출 (우리는 mmbridge research)
- Co-pilot 모드 / 멀티유저 협업

---

## 3. v0.6.0 — "Philosophy & Foundation"

### 3-1. 스킬 철학 주입

**출처**: Hermes TDD / systematic-debugging / writing-plans 스킬의 Iron Law 패턴

**현황**: 13 스킬 SKILL.md가 정보 위주, 행동 규범 부재

**작업**: 13 스킬 전체에 3가지 섹션 추가

#### ① IRON LAW — 절대 불가침 원칙 (스킬별 1줄)

| 스킬 | Iron Law |
|---|---|
| pdca | "사이클 스킵 없다. 항상 P→D→C→A 순서로 진행한다" |
| research | "추측 금지. 데이터 없으면 수집부터 한다" |
| write | "리서치와 리뷰 없이 콘텐츠를 발행하지 않는다" |
| analyze | "결론 먼저 내지 않는다. 증거가 결론을 결정한다" |
| review | "mmbridge 실패가 파이프라인을 절대 막지 않는다" |
| refine | "리뷰 없는 수정은 수정이 아니다" |
| loop | "벤치마크 없는 루프는 의미 없다" |
| collect | "수집한 지식은 반드시 분류한다" |
| workflow | "자동화 전에 수동 워크플로우를 먼저 검증한다" |
| discover | "설치 전에 기존 도구를 먼저 확인한다" |
| batch | "병렬 실행 전에 태스크 독립성을 먼저 검증한다" |
| soul | "관찰은 판단이 아니다. 패턴만 기록한다" |
| translate | "스타일 모드를 명시하거나 기본값(natural)을 확정한 뒤 번역을 시작한다" |

#### ② RED FLAGS — "이 생각이 들면 STOP"

모든 스킬 공통:
```
RED FLAGS — 이 생각이 들면 STOP:
- "테스트 나중에 짜도 되겠지" → STOP. 지금 짜라.
- "간단한 수정이라 리뷰 생략해도" → STOP. 간단한 버그가 P0이 된다.
- "이전 사이클 인사이트 안 봐도" → STOP. 같은 실수를 반복한다.
- "이 정도면 충분히 좋겠지" → STOP. 체크리스트를 확인하라.
- "시간이 없어서 단계를 건너뛰자" → STOP. 건너뛴 단계가 나중에 3배 시간을 쓴다.
```

#### ③ COMMON RATIONALIZATIONS 테이블

```markdown
| 변명 | 현실 |
|---|---|
| "빨리 해야 해서 단계 생략" | 빠른 게 나중에 더 느리다. 기술부채는 복리로 불어난다 |
| "이건 사소한 변경" | 사소한 버그가 P0 사고가 된다. 모든 변경은 리뷰 대상 |
| "이미 비슷한 코드가 있으니까" | 비슷한 코드가 있으면 왜 새로 짜는지 먼저 의심하라 |
| "로컬에서 잘 되니까" | 로컬 ≠ 프로덕션. 테스트가 증명할 때까지 "잘 된다"가 아니다 |
| "나중에 리팩토링하면 되지" | 나중은 오지 않는다. 지금 깨끗하게 짜라 |
```

**작업량**: 13 SKILL.md 패치

---

### 3-2. PDCA Cycle Memory

**출처**: Hermes Walnut/ALIVE의 zero-context standard + save protocol + read-before-speak

**현황**: .data/state/에 PDCA 상태 JSON만 저장. 사이클 간 컨텍스트 연속성 없음. 이전 사이클 교훈이 다음 사이클에 전달되지 않음.

**설계**:

```
.data/cycles/
├── cycle-001/
│   ├── plan.md        계획 요약 (콜드 리더도 이해 가능)
│   ├── do.md          실행 기록 + 코드 변경 요약
│   ├── check.md       리뷰 결과 + gate 판정 + mmbridge 스코어
│   ├── act.md         조치 사항 + 다음 사이클 인풋
│   └── metrics.json   정량 데이터 (시간, 토큰, 이슈수, 스코어)
├── cycle-002/
│   └── ...
└── insights.md        전 사이클 누적 인사이트 (append-only)
```

**핵심 원칙: Zero-Context Standard**
- 각 .md 파일은 이전 맥락 없이 독립적으로 이해 가능해야 함
- 새 에이전트가 cold start로 읽어도 무슨 일이 있었는지 파악 가능
- 약어, 내부 참조, "위에서 언급한" 같은 표현 금지

**행동 프로토콜 (Walnut에서 차용):**
- **Read-Before-Act**: 새 사이클 시작 시 이전 cycle/ + insights.md 필수 로드
- **Save Protocol**: 각 페이즈 완료 시 즉시 해당 .md 저장
- **Insight Accumulation**: Act 완료 시 insights.md에 교훈 append

**Self-Evolution 강화** (from ARC EvolutionStore 패턴):
- **시간 감쇄**: 30일 이상 된 인사이트는 가중치 하락 (최신 교훈 우선)
- **카테고리 분류**: process / technical / quality (ARC의 6 카테고리를 3개로 축약)
- **프롬프트 오버레이**: Plan 시작 시 관련 인사이트를 컨텍스트에 자동 주입
- **Insight → Gotchas 제안 큐**: 반복 발생하는 인사이트(3회+)는 해당 skill의 gotchas.md 수정을 **제안**하되 자동 반영하지 않음. gotchas.md는 contract 테스트가 직접 읽는 파일이라 자동 수정 시 테스트 드리프트 위험. `.data/proposals/gotchas-{skill}.md`에 제안을 누적하고, 사람이 승인 후 반영한다. (ARC MetaClaw 패턴 + 안전 장치)

**MCP tool 3개 추가**:

```
pdca_get_cycle_history
  params: { cycle_id?: number, last_n?: number }
  returns: { cycles: [{ id, plan, do, check, act, metrics }] }

pdca_save_insight
  params: { cycle_id: number, insight: string, category: "process"|"technical"|"quality", severity: "info"|"warning"|"critical" }
  returns: { total_insights: number }
  note: severity=critical 인사이트가 3회 이상 반복되면 .data/proposals/gotchas-{skill}.md에 제안 생성 (자동 반영 아님, 사람 승인 필요)

pdca_get_insights
  params: { category?: string, last_n?: number, min_weight?: number }
  returns: { insights: [{ cycle_id, timestamp, category, severity, text, weight }] }
  note: weight는 시간 감쇄 적용된 값 (1.0 = 최신, 0.0 = 30일+)
```

**작업량**: MCP 서버 3개 tool 추가 + session-end 훅 연동 + 시간 감쇄 로직 + 테스트

---

### 3-3. Phase-Gated 체크리스트

**출처**: Hermes systematic-debugging의 phase-gated workflow + TDD 스킬의 검증 체크리스트

**현황**: auto_gate on pdca_transition이 있지만 JSON 상태 체크만. 인간이 읽을 수 있는 체크리스트 없음.

**설계**: pdca_transition의 auto_gate 로직을 확장하여 체크리스트 기반 검증 추가

#### Plan → Do 게이트
```
[ ] 요구사항이 테스트 가능한 형태로 분해됨
[ ] 태스크별 예상 복잡도 산정됨
[ ] 이전 사이클 인사이트 검토됨 (첫 사이클 제외)
[ ] 리스크 평가 완료
```

#### Do → Check 게이트

코드 도메인:
```
[ ] 코드 컴파일/파싱 에러 없음
[ ] 새 코드에 대응하는 테스트 존재
[ ] lint 경고 증가 없음
[ ] plan.md + do.md 저장 완료
```

콘텐츠 도메인:
```
[ ] 초안이 plan.md 요구사항을 커버함
[ ] 대상 독자 기준 가독성 확보
[ ] 목표 분량 ±10% 이내
[ ] plan.md + do.md 저장 완료
```

#### Check → Act 게이트
```
[ ] 멀티모델 리뷰 컨센서스 스코어 > 7/10 (mmbridge 설치 시)
[ ] Critical/High 이슈 0건
[ ] mmbridge gate 통과 (설치 시, 미설치면 skip)
[ ] check.md 저장 완료
```

#### Act → next Plan 게이트
```
[ ] 모든 기존 테스트 통과
[ ] 사이클 인사이트 기록 완료 (insights.md)
[ ] 다음 사이클 인풋 정의됨 (act.md에 명시)
[ ] act.md + metrics.json 저장 완료
```

**Stage Contracts** (from ARC contracts.py 패턴):

각 PDCA 페이즈에 formal I/O 계약 추가.

> **주의**: PDCA는 코드 작업뿐 아니라 콘텐츠 작성 (`/scc:write --skip-research --skip-review`)에도 쓰인다. 계약은 **도메인별 변형**을 지원해야 하며, 코드 전용 조건을 범용 게이트에 하드코딩하면 안 된다.

```javascript
// 예시: Do 페이즈 계약 (코드 도메인)
{
  phase: "do",
  domain: "code",                       // "code" | "content" | "analysis" | "pipeline"
  input_files: ["plan.md"],
  output_files: ["do.md", "*.test.*"],  // 코드 도메인만 테스트 파일 필수
  dod: [
    "코드 파싱 에러 없음",
    "새 코드에 테스트 존재",
    "lint 경고 증가 없음"
  ],
  max_retries: 2,
  rollback_target: "plan"
}

// 예시: Do 페이즈 계약 (콘텐츠 도메인)
{
  phase: "do",
  domain: "content",
  input_files: ["plan.md"],
  output_files: ["do.md", "draft.*"],   // 초안 파일 필수
  dod: [
    "초안이 plan.md의 요구사항을 커버함",
    "대상 독자 기준 가독성 확보",
    "목표 분량 ±10% 이내"
  ],
  max_retries: 2,
  rollback_target: "plan"
}
```

**구현**: pdca_transition 호출 시 계약 + 체크리스트 자동 평가 → 미충족 항목 리턴

**작업량**: pdca_transition 로직 확장 + 계약 정의 (config/stage-contracts.json) + 체크리스트 템플릿 (templates/gate-checklists.md)

---

### 3-4. 버그픽스 + 정리

| # | 항목 | 설명 |
|---|---|---|
| 1 | walnut.manifest.yaml | 버전 0.5.7 → 0.5.8, 스킬 12 → 13 |
| 2 | {references} 유령 디렉토리 | 8개 삭제 (skills/*/\{references\}/) |
| 3 | translate glossary | skills/translate/references/glossary.md 생성 |
| 4 | playwright MCP 버전 핀 | npx @playwright/mcp@latest → 특정 버전 핀 |

**작업량**: 소규모 패치 ~10개

---

## 4. v0.7.0 — "See & Test"

### 4-1. HTML 사이클 리포트 생성기

**출처**: LangSmith 대시보드 + CrewAI metrics + Hermes scrum-master 벨로시티

**현황**: 런타임 시각화 완전 부재

**설계**: session-end 훅에서 PDCA 사이클 완료 감지 시 자동 생성

```
.data/reports/
├── cycle-001.html     HTML 대시보드
├── cycle-001.mmd      Mermaid 소스 (GitHub/PR 삽입용)
├── cycle-002.html
└── ...
```

**HTML 리포트 구성:**

```
┌─────────────────────────────────────────────┐
│ PDCA Cycle #7 Report                        │
│ Generated: 2026-03-28T15:30:00              │
├─────────────────────────────────────────────┤
│                                             │
│ [신호등 대시보드]                             │
│  Plan ✓   Do ✓   Check ⚠   Act ✓          │
│                                             │
│ [Mermaid PDCA 플로우]                        │
│  flowchart TD                               │
│    Plan:::pass --> Do:::pass                │
│    Do --> Check:::warn                      │
│    Check --> Act:::pass                     │
│    classDef pass fill:#4caf50               │
│    classDef warn fill:#ff9800               │
│    classDef fail fill:#f44336               │
│                                             │
│ [Chart.js — 사이클 시간 트렌드 (최근 10)]     │
│  ▇▇▇▇▇▇▇▆▅▇                                │
│                                             │
│ [레이더 차트 — 에이전트별 성공률]              │
│  Eevee: 95%, Smeargle: 88%, Xatu: 92%      │
│                                             │
│ [mmbridge 스코어 히스토리] (연동 시)           │
│  #5: 78 → #6: 83 → #7: 86                  │
│                                             │
│ [이슈 요약]                                  │
│  - WARNING: Check 페이즈에서 2건 발견         │
│                                             │
│ [다음 액션]                                  │
│  - Fix: performance regression in module X  │
│                                             │
└─────────────────────────────────────────────┘
```

**의존성**: Chart.js (CDN 링크), Mermaid.js (CDN 링크) — npm 설치 불필요, HTML에 CDN embed

**작업량**: HTML 템플릿 + 생성 로직 (hooks/lib/report-generator.mjs) + 테스트

---

### 4-2. 터미널 ANSI 요약

**출처**: mmbridge StreamRenderer의 ANSI 컬러 출력 패턴

**설계**: session-end 훅에서 사이클 완료 시 항상 출력

```
  ┌──────── PDCA Cycle #7 ─────────┐
  │ Plan ✓  Do ✓  Check ⚠  Act ✓  │
  │ Time: 12m  Issues: 2  Score: 83│
  │ ▇▇▇▇▇▇▇▆▅▇ (recent 10 cycles) │
  └────────────────────────────────┘
```

- ✓ = 녹색, ⚠ = 노란색, ✗ = 빨간색
- 스파크라인으로 최근 10 사이클 트렌드
- Score는 mmbridge overallScore (미연동 시 gate 통과율로 대체)

**작업량**: session-end.mjs 확장 (~50줄 ANSI 출력 코드)

---

### 4-3. 테스트 대확장 (194 → 300+)

**출처**: Hermes TDD iron law + 외부 리서치 테스트 전략

#### Phase A — 훅 커버리지 (+56 tests)

| 파일 | 현재 | 목표 | 테스트 내용 |
|---|---|---|---|
| subagent-stop.mjs (387L) | 0 | 12 | 결과 파싱, soul 관찰 트리거, 에러 핸들링, 타임아웃 |
| session-end.mjs (654L) | 2 | 15 | 사이클 완료 감지, 리포트 생성, 메트릭 저장, 인사이트 기록 |
| compaction.mjs (223L) | 0 | 8 | 압축 트리거 조건, 요약 품질, 보호 메시지, todo 생존 |
| subagent-start.mjs (181L) | 0 | 8 | 에이전트 선택, 컨텍스트 주입, 스킬 로딩 |
| stop-failure.mjs (68L) | 0 | 5 | 실패 감지, 복구 제안, 로깅 |
| soul-observer.mjs (179L) | 0 | 8 | 관찰 기록, 패턴 감지, 메트릭 수집 |

#### Phase B — MCP 핸들러 분리 테스트 (+22 tests)

| 핸들러 | 목표 | 테스트 내용 |
|---|---|---|
| soul-handlers.mjs (130L) | 6 | observe, get_observations, soul 메트릭 |
| loop-handlers.mjs (27L) | 4 | 루프 상태, 벤치마크 연동 |
| session-handlers.mjs (24L) | 4 | 세션 recall, 상태 조회 |
| memory-handlers.mjs (36L) | 4 | 메모리 CRUD, 크기 제한 |
| daemon-handlers.mjs (56L) | 4 | 데몬 상태, 하트비트 |

#### Phase C — 새 테스트 유형 (+30 tests)

| 유형 | 개수 | 설명 |
|---|---|---|
| Chaos tests | 8 | mmbridge 타임아웃/실패/malformed 출력 시뮬레이션 |
| Contract tests | 10 | 17 에이전트 frontmatter 스키마 + I/O 포맷 검증 |
| Scenario tests | 6 | 풀 PDCA P→D→C→A e2e 시나리오 |
| Snapshot tests | 6 | HTML 리포트 생성 golden baseline 비교 |

#### Phase D — loop-runner 확대

| 파일 | 현재 | 목표 |
|---|---|---|
| loop-runner.mjs (912L) | 8 | 20 |

**총합**: 194 → ~322 tests (+128)

---

### 4-4. PIVOT/REFINE 판단 루프

**출처**: ARC Stage 15 RESEARCH_DECISION (PROCEED/REFINE/PIVOT, max 2 pivots)

**현황**: Check→Act 전환이 단순 pass/fail. 실패 시 "뭘 할지"에 대한 자율 판단 없음.

**설계**: Check 완료 시 3분기 자율 판단 도입

```
Check 결과 분석 → 판단:

  PROCEED  — 품질 기준 충족. Act으로 진행.
             조건: gate 전체 pass, Critical 0건

  REFINE   — 같은 방향, 품질만 개선 필요. Do 재실행.
             조건: gate 일부 warn, Critical 0건, 개선 가능한 이슈만
             최대: 3회 연속 REFINE 시 강제 PROCEED 또는 PIVOT

  PIVOT    — 방향 전환 필요. Plan으로 롤백.
             조건: Critical 이슈, 근본적 설계 문제
             최대: max_pivots=2 (무한 루프 방지)
             아티팩트 버저닝: pivot 전 상태를 cycle-{N}/pivot-{M}/ 에 보존
```

**MCP tool 변경**: pdca_transition의 auto_gate 결과에 `decision` 필드 추가
```
returns: {
  gate_result: "pass"|"warn"|"fail",
  decision: "proceed"|"refine"|"pivot",
  reason: "...",
  pivot_count: 0,
  refine_count: 0
}
```

**작업량**: pdca_transition 확장 + 판단 로직 + 아티팩트 버저닝 + 테스트

---

### 4-5. Convergence 감지 보강

**출처**: ARC execute_iterative_pipeline의 수렴 감지기

**현황**: loop-runner.mjs(912줄)에 이미 4가지 종료 조건이 구현되어 있음:
- `winner_promoted`: 스코어가 min_delta 이상 개선되어 승격
- `plateau`: 연속 2회 스코어 정체 시 종료
- `min_delta_not_met`: 예산 소진 시 충분한 개선 없음
- `budget_exhausted`: max_generations 도달
- `resume`: 저장된 상태에서 재개 지원

테스트도 존재 (tests/runtime/loop-runner.test.mjs: plateau, min_delta_not_met 검증).

**보강 항목** (기존 인프라 위에 추가):

```
추가할 수렴 기준:
  1. 비용 한도: estimated_cost >= budget_limit (토큰/비용 기반 종료)
  2. 시간 한도: elapsed_time >= time_limit (wall clock 기반)
  3. 수렴 리포팅: session-end에 최종 종료 사유 + 스코어 추이 출력
```

**적용**: loop-runner.mjs의 기존 종료 로직에 비용/시간 한도 조건 추가
- 각 이터레이션 비용을 .data/loop/scores.json에 함께 기록
- session-end에 수렴 상태 리포팅 (터미널 ANSI 요약에 포함)

**작업량**: loop-runner.mjs 확장 (~40줄, 기존 구조 활용) + 테스트 3개 추가

---

## 5. v0.8.0 — "Bridge & Automate"

### 5-1. mmbridge MCP 프로그래매틱 연동

**출처**: mmbridge 소스코드의 @mmbridge/mcp 패키지 + Hermes MCP 자동 discovery 패턴

**현황**: skill-first 통합 상태. `references/mmbridge-integration.md`와 각 SKILL.md가 mmbridge CLI 사용 규칙을 정의하고, 에이전트가 이를 읽고 Bash로 호출하는 방식이다. 작동은 하지만 프로그래매틱 MCP 연동은 아직 없다.

**설계**: plugin.json에 mmbridge MCP 서버 등록

> **주의**: 실제 plugin.json은 `mcpServers` (camelCase)를 사용한다. `mcp_servers` 아님.

```json
{
  "mcpServers": {
    "pdca-state": {
      "command": "node",
      "args": ["mcp/pdca-state-server.mjs"]
    },
    "mmbridge": {
      "command": "npx",
      "args": ["@mmbridge/mcp"]
    }
  }
}
```

**Check 페이즈 자동화 흐름:**

> **주의**: `--tool all`은 race condition이 알려져 있어 `references/mmbridge-integration.md`에서 사용을 피하도록 권고한다. 기본값은 `--tool kimi` (가장 안정적). 멀티모델 컨센서스가 필요한 경우에만 `--bridge standard`를 병행한다.

```
1. Do → Check 전환 시:
   ├─ mmbridge_review (--tool kimi, 안정 시 --bridge standard 병행)
   │   → findings[], summary, consensus score
   ├─ mmbridge_security
   │   → securityFindings[], CWE IDs, attack surface
   └─ mmbridge_gate
       → pass/warn status + nextCommand

2. 결과 기록:
   ├─ check.md에 리뷰 요약 + 발견 이슈
   └─ metrics.json에 스코어 + 발견 수

3. Gate 판정:
   ├─ Critical/High 0건 → pass
   ├─ Warning만 → warn (proceed with caution)
   └─ Critical 1건+ → fail (Act 진입 차단)
```

**Act 페이즈 연동:**

```
4. mmbridge_embrace (원샷 풀 파이프라인)
   → overallScore /100
   → recommendations[]
   → 다음 사이클 우선순위 결정 인풋

5. handoff 연속성:
   ├─ nextPrompt → 다음 Plan 페이즈 초기 프롬프트
   └─ nextCommand → 자동 실행 가능한 CLI 커맨드
```

**부가 기능:**
- **live-state 폴링**: 긴 리뷰 중 ~/.mmbridge/.live.json 읽어서 터미널에 진행률 표시
- **memory search**: `mmbridge memory search --json`으로 이전 리뷰 컨텍스트 recall
- **Graceful Degradation**: mmbridge 미설치 시 모든 연동 자동 skip (Iron Law: "mmbridge 실패가 파이프라인을 절대 막지 않는다")

**작업량**: plugin.json 수정 + 훅 연동 로직 + integration 테스트

---

### 5-2. Anti-Fabrication 레이어

**출처**: ARC VerifiedRegistry + paper_verifier (실험 결과에서 나온 실제 숫자만 허용)

**현황**: Check 페이즈에서 코드 리뷰는 하지만, 주장하는 수치의 사실 여부 검증은 없음.

**설계**: Check 페이즈에 "주장 vs 실측" 교차 검증 추가

```
검증 대상:
  1. PR/커밋 메시지의 성능 주장 ("~% 개선", "~ms 단축")
     → 실제 테스트/벤치마크 결과와 대조
  2. mmbridge review findings의 수치 인용
     → 소스코드 내 해당 수치 존재 여부 확인
  3. 사이클 리포트의 메트릭
     → metrics.json의 raw 데이터와 일관성 확인

구현:
  - hooks/lib/fact-checker.mjs: 수치 추출 + 교차 검증 로직
  - pdca_get_analytics에 verified_claims 필드 추가
  - 미검증 주장 발견 시 check.md에 WARNING 기록
```

**작업량**: fact-checker.mjs (~120줄) + MCP tool 확장 + 테스트

---

### 5-3. Adapter Protocol (mmbridge 테스트 인프라)

**출처**: ARC adapters.py의 Protocol 기반 인터페이스 + Recording 어댑터

**현황**: mmbridge 연동 테스트 0건. 실제 mmbridge 없이는 테스트 불가능.

**설계**: Protocol 패턴으로 mmbridge 의존성 추상화

```javascript
// mcp/lib/mmbridge-adapter.mjs

// Protocol (인터페이스)
class MmBridgeAdapter {
  async review(options) { throw new Error('not implemented'); }
  async gate(options) { throw new Error('not implemented'); }
  async embrace(options) { throw new Error('not implemented'); }
}

// 실제 MCP 연동
class MmBridgeMcpAdapter extends MmBridgeAdapter {
  async review(options) { /* MCP tool 호출 */ }
}

// 테스트용 스텁
class MmBridgeStubAdapter extends MmBridgeAdapter {
  async review(options) { return { status: 'complete', findings: [] }; }
}

// 녹화/재생 (ARC Recording Adapter 패턴)
class MmBridgeRecordingAdapter extends MmBridgeAdapter {
  async review(options) {
    if (this.replaying) return this.recordings.shift();
    const result = await this.delegate.review(options);
    this.recordings.push(result);
    return result;
  }
}
```

**효과**:
- Chaos 테스트 가능 (StubAdapter에서 타임아웃/에러 시뮬레이션)
- 오프라인 테스트 가능 (RecordingAdapter 재생)
- mmbridge 미설치 환경에서도 CI 통과

**작업량**: mmbridge-adapter.mjs (~150줄) + 3개 구현체 + 테스트

---

### 5-4. GitHub 이벤트 → PDCA 자동 트리거

**출처**: Hermes webhook 어댑터에서 *패턴만* 차용 (HMAC 검증, 라우트별 스킬 로딩, 프롬프트 템플릿)

> **경계 원칙** (docs/plans/2026-03-23-hermes-boundary-and-memory-notes.md 준수):
> Hermes gateway를 런타임 의존성으로 도입하지 않는다. GitHub Actions workflow로 독립 구현한다.

**설계**:

| GitHub 이벤트 | PDCA 트리거 | 액션 |
|---|---|---|
| PR opened | Plan | 자동 태스크 분해, 복잡도 산정 |
| PR updated (push) | Check | mmbridge 자동 리뷰, gate 체크 |
| CI failed | Debug | systematic-debugging 패턴 발동 |
| PR merged | Act | 인사이트 기록, 다음 사이클 준비 |
| Issue created | Plan | 이슈 → 태스크 분해 자동 제안 |

**구현**: GitHub Actions workflow (독립 실행, Hermes 의존성 없음)
- `.github/workflows/pdca-trigger.yml`
- 이벤트별 mmbridge CLI 호출 + 결과를 PR 코멘트로 게시

**작업량**: GitHub Actions workflow + 테스트

---

### 5-5. 3-Tier Skill Loading 최적화

**출처**: Hermes progressive disclosure 패턴

**현황**: 프롬프트 감지 → 전체 SKILL.md 로드 (2단계만). 에이전트 정의도 항상 풀 로드.

**설계**:

| Tier | 내용 | 로딩 시점 | 크기 |
|---|---|---|---|
| 1 | 13 스킬 × 1줄 설명 | 항상 (시스템 프롬프트) | ~500 토큰 |
| 2 | SKILL.md 본문 | prompt-detect 매칭 시 | 가변 |
| 3 | references/*, templates/* | 실행 중 필요 시 | 온디맨드 |

추가 최적화:
- 에이전트 .md 파일도 실제 소환 시점에만 로드 (현재: 일괄 로드)
- 디스크 캐시 매니페스트 (Hermes .skills_prompt_snapshot.json 참고)

**기대 효과**: 컨텍스트 윈도우 30-40% 절약

**작업량**: prompt-detect 훅 수정 + 에이전트 로딩 로직 변경 + 캐시

---

## 6. v0.9.0 — "Observe & Scale"

### 6-1. 옵저버빌리티 + MetaClaw PRM

**출처**: Hermes 메모리 시스템 + LangSmith/Weights&Biases 패턴 + CrewAI 에이전트 메트릭 + ARC MetaClaw PRM

**에이전트별 메트릭 수집:**
```json
{
  "agent": "xatu",
  "invocations": 23,
  "success_rate": 0.91,
  "avg_tokens": 4200,
  "avg_duration_ms": 12000,
  "retry_count": 3,
  "error_categories": {"timeout": 1, "bad_output": 2}
}
```

**사이클별 메트릭:**
```json
{
  "cycle_id": 7,
  "total_time_ms": 720000,
  "phases": {
    "plan": {"time_ms": 120000, "gate": "pass"},
    "do": {"time_ms": 300000, "gate": "pass"},
    "check": {"time_ms": 180000, "gate": "warn", "mmbridge_score": 83},
    "act": {"time_ms": 120000, "gate": "pass"}
  },
  "issues_found": 2,
  "issues_fixed": 2,
  "tokens_total": 45000,
  "estimated_cost_usd": 0.12
}
```

**MetaClaw PRM — 에이전트 효과 학습** (from ARC):
```json
{
  "agent_effectiveness": {
    "xatu": {
      "phases": {"check": {"helped": 18, "neutral": 3, "hurt": 1}},
      "avg_quality_delta": +0.12,
      "best_at": ["security_review", "architecture_review"],
      "struggles_with": ["style_nitpick"]
    }
  }
}
```
- 어떤 에이전트가 어떤 페이즈에서 유용했는지 자동 추적
- mmbridge 리뷰 스코어와 에이전트 기여도 교차 분석
- 장기적으로 에이전트 라우팅 최적화에 활용 (성능 좋은 에이전트에 더 많은 태스크 배정)
- 스킬 피드백 트래킹: 각 스킬이 helped/neutral/hurt인지 기록

**시각화 추가:**
- 레이더 차트: correctness, security, style, performance, completeness (5축)
- 히트맵: 어떤 에이전트/스킬에서 이슈가 가장 많은지
- 번다운 차트: 이슈 해결 추이
- 비용 트렌드: 사이클별 토큰/비용 추이
- 에이전트 효과 차트: helped/neutral/hurt 비율 (ARC MetaClaw 패턴)

---

### 6-2. 정기 품질 체크 (선택)

**출처**: Hermes 크론 시스템에서 *스케줄링 패턴만* 차용

> **경계 원칙** (docs/plans/2026-03-23-hermes-boundary-and-memory-notes.md 준수):
> Hermes cron scheduler를 코어 플러그인 의존성으로 두지 않는다.
> GitHub Actions scheduled workflow 또는 시스템 crontab으로 독립 구현한다.

| 작업 | 주기 | 구현 |
|---|---|---|
| 코드 헬스체크 | 매일 9AM | GitHub Actions scheduled workflow → `mmbridge gate --format json` |
| 인사이트 요약 | 주 1회 | GitHub Actions → insights.md 파싱 + 요약 이슈 생성 |
| 테스트 커버리지 | PR마다 | GitHub Actions CI → 신규 코드 테스트 비율 체크 |

**구현**: GitHub Actions scheduled/triggered workflows (Hermes 의존성 없음)
- Hermes가 별도 운영 도구로 존재하는 건 호환 가능하지만, 플러그인 런타임에 포함하지 않음

---

### 6-3. Knowledge Graph (선택, from ARC)

**출처**: ARC knowledge/graph/ (entities, relations, builder, query, visualizer)

**설계**: research 스킬에 경량 지식 그래프 추가

```
.data/knowledge/
├── graph.json        엔티티 + 관계 (JSON)
├── graph.mmd         Mermaid 시각화
└── queries/          저장된 쿼리 결과
```

- 개념-관계 추출: research/analyze 결과에서 핵심 엔티티와 관계 자동 추출
- Mermaid 시각화: `graph TD` 형태로 자동 생성 → HTML 리포트에 포함
- PDCA 사이클 간 지식 누적: 사이클마다 그래프에 노드/엣지 추가
- 우선순위 낮음 — 핵심 기능 안정화 후 고려

---

### 6-4. Domain Auto-Detection (선택, from ARC)

**출처**: ARC domains/ (10 어댑터, 25 YAML 프로필, 토픽→도메인 자동 감지)

**설계**: 프로젝트 유형 자동 감지 → 에이전트 행동 커스텀

```
감지 대상:
  - web-app (React, Next.js, Vue...)
  - cli-tool (argparse, commander...)
  - library (exports, API surface)
  - data-pipeline (pandas, spark, ETL...)
  - ml-project (pytorch, tensorflow...)
  - infrastructure (terraform, k8s...)

효과:
  - 유형별 리뷰 관점 차별화 (웹앱→접근성/SEO, CLI→UX/에러핸들링)
  - 유형별 테스트 전략 추천
  - 유형별 보안 체크 우선순위
```

- 우선순위 낮음 — 코어 PDCA 안정화 후 v1.0에서 고려

---

## 7. Hermes & ARC → Second Claude Code 매핑 테이블

### Hermes 차용

| Hermes 기능 | 우리 적용 | 버전 | 우선순위 |
|---|---|---|---|
| Iron Laws / Red Flags / Rationalizations | 13 스킬 SKILL.md 패치 | 0.6.0 | P0 |
| Walnut/ALIVE 메모리 | PDCA Cycle Memory (.data/cycles/) | 0.6.0 | P0 |
| Zero-Context Standard | cycle-{N}/*.md 작성 규격 | 0.6.0 | P0 |
| Phase-Gated Workflow | 체크리스트 게이트 4개 | 0.6.0 | P0 |
| Read-Before-Speak | Read-Before-Act (사이클 시작 시 이전 cycle/ 로드) | 0.6.0 | P0 |
| Save Protocol | 페이즈별 즉시 저장 | 0.6.0 | P0 |
| Scrum 벨로시티/건강도 | 사이클 시간 트렌드 + 스코어 히스토리 | 0.7.0 | P1 |
| mmbridge StreamRenderer | 터미널 ANSI 요약 | 0.7.0 | P1 |
| TDD Iron Law | 테스트 대확장 (194→322) | 0.7.0 | P0 |
| Progressive Disclosure | 3-Tier Skill Loading | 0.8.0 | P1 |
| MCP 자동 Discovery | mmbridge MCP 서버 등록 | 0.8.0 | P1 |
| Webhook 이벤트 트리거 | GitHub Actions → PDCA 자동화 (Hermes 의존 없음) | 0.8.0 | P2 |
| Cron 자율 실행 | GitHub Actions scheduled workflows (Hermes cron 아님) | 0.9.0 | P2 |
| Session Memory (FTS5) | insights.md 누적 | 0.6.0 | P0 |
| Stash System | 대화 중 인사이트 임시 추적 | 0.6.0 | P1 |

### AutoResearchClaw 차용

| ARC 기능 | 우리 적용 | 버전 | 우선순위 |
|---|---|---|---|
| Stage Contracts (I/O 계약) | 페이즈별 formal contract (input/output/DoD/rollback) | 0.6.0 | P0 |
| Self-Evolution (EvolutionStore) | 시간 감쇄 + 카테고리 분류 + 프롬프트 오버레이 + gotchas 제안 큐 | 0.6.0 | P0 |
| PIVOT/REFINE Decision Loop | Check→Act 3분기 판단 (proceed/refine/pivot, max 2 pivots) | 0.7.0 | P1 |
| Iterative Convergence | loop 스킬 수렴 감지 (연속 3회 변화 < 2% → 종료) | 0.7.0 | P1 |
| Anti-Fabrication / Verified Registry | 주장 vs 실측 교차 검증 (fact-checker.mjs) | 0.8.0 | P1 |
| Adapter Protocol + Recording | mmbridge Protocol 추상화 + Stub/Recording 어댑터 | 0.8.0 | P1 |
| MetaClaw PRM | 에이전트별 효과 트래킹 (helped/neutral/hurt per phase) | 0.9.0 | P2 |
| Knowledge Graph | 경량 지식 그래프 + Mermaid 시각화 (선택) | 0.9.0 | P3 |
| Domain Auto-Detection | 프로젝트 유형 감지 → 리뷰 관점 커스텀 (선택) | 0.9.0 | P3 |

---

## 8. 가져오지 않는 것

| Hermes 기능 | 이유 |
|---|---|
| 멀티플랫폼 게이트웨이 (Telegram, Discord, Slack...) | 우리는 Claude Code CLI 플러그인. 플랫폼 게이트웨이 불필요 |
| TTS/STT (음성 입출력) | Claude Code 터미널 환경에 불필요 |
| Home Assistant 연동 | 스코프 밖 (스마트홈 ≠ 코드 품질) |
| 12가지 Personality (kawaii, pirate, noir...) | 우리는 Pokemon 테마로 통일 |
| Apple 서비스 (Notes, Reminders, FindMy) | macOS 전용, 플러그인 독립성 저해 |
| Frozen Snapshot 메모리 패턴 | Claude Code 플러그인은 자체 메모리 없음 (호스트 의존) |
| 컨텍스트 자동 압축 | Claude Code가 자체 처리 |
| Browser 자동화 도구 | Claude Code에 이미 있음 |
| Gaming 스킬 (Pokemon Player, Minecraft) | 스코프 밖 |
| Red Teaming (Godmode) | 스코프 밖 |

**AutoResearchClaw에서 가져오지 않는 것:**

| ARC 기능 | 이유 |
|---|---|
| 23단계 논문 생성 파이프라인 | 우리는 코드 품질 도구, 논문 생성 도구 아님 |
| LaTeX 컴파일러 / 학회 템플릿 (NeurIPS, ICLR, ICML) | 스코프 밖 |
| 실험 샌드박스 (Docker/SSH/Colab) | Claude Code가 자체 터미널 처리 |
| Overleaf 동기화 | 스코프 밖 |
| 음성 인터페이스 / FastAPI 웹서버 | CLI 플러그인에 불필요 |
| 문헌 검색 API 직접 호출 (OpenAlex, S2, arXiv) | mmbridge research로 처리 |
| Co-pilot 모드 / 멀티유저 협업 | 현재 불필요 |
| BenchmarkAgent / FigureAgent 서브 파이프라인 | 에이전트 수 증가 시 재고려 |
| ACP (Agent Client Protocol) | Claude Code MCP로 충분 |

---

## 9. 기타 발견된 문제들 (버그/정리)

| # | 심각도 | 항목 | 설명 |
|---|---|---|---|
| 1 | P1 | walnut.manifest.yaml | 버전 0.5.7 (실제 0.5.8), 스킬 12개 (실제 13개) |
| 2 | P2 | {references} 유령 디렉토리 | skills/ 하위 8개 — 템플릿 확장 오류 흔적 |
| 3 | P2 | translate glossary.md | SKILL.md에서 참조하지만 파일 미존재 |
| 4 | P2 | playwright MCP 버전 핀 | npx @playwright/mcp@latest — 버전 고정 필요 |
| 5 | P3 | companion daemon | 스텁 수준 (103줄 wrapper). 실제 백그라운드 프로세스 아님 |
| 6 | P3 | 비용 추적 | 토큰/비용 추적 기능 없음 |
| 7 | P3 | TODO/FIXME | 코드 내 기술부채 문서화 0건 (좋거나 나쁘거나) |
| 8 | P3 | discover 스킬 | 마켓플레이스 구현 없음, 로컬 스캔 only로 degradation |

---

## 부록: 리서치 참고 자료

**GitHub repos:**
- aiming-lab/AutoResearchClaw — 23단계 자율 연구 파이프라인, Stage Contracts, PIVOT/REFINE, Self-Evolution, Anti-Fabrication
- aider-chat/aider — 멀티모델 architect/editor, 좋은 테스트 스위트
- langchain-ai/langgraph — 에이전트 오케스트레이션, state machine, mermaid 출력
- crewai/crewai — 멀티에이전트 크루, 태스크 검증
- promptfoo/promptfoo — 멀티모델 평가 프레임워크
- langfuse/langfuse — 오픈소스 LLM 옵저버빌리티, 대시보드
- SWE-bench — 코딩 에이전트 평가 벤치마크
- BerriAI/litellm — 통합 멀티모델 API
- deepeval — LLM 테스팅 프레임워크

**패턴:**
1. JSON 구조화 사이클 리포트 → HTML 대시보드 생성
2. 매 PDCA 사이클 후 Mermaid 다이어그램 생성
3. JSON Schema로 에이전트 인터페이스 contract 테스트
4. VCR/cassette 녹화로 결정론적 LLM 테스트
5. LLM-as-judge 출력 품질 스코어링
6. 가중치 멀티모델 컨센서스 코드 리뷰
7. 신호등 품질 게이트 + 설정 가능한 임계값
8. 히스토리컬 메트릭 저장 → 트렌드 분석
9. 에이전트별 퍼포먼스 프로파일링 (비용, 속도, 정확도)
10. Chaos 테스트로 외부 의존성 장애 대응 검증

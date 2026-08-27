[English](pdca.md) | **한국어**

# PDCA

> 명시적 런타임 전환 게이트가 있는 Plan → Do → Check → Act 사이클입니다. 포맷·리뷰 규칙은 게이트에 명시되지 않는 한 스킬 수준 계약입니다.

## 빠른 예시

```
AI 에이전트 프레임워크 알아보고 보고서 써줘
```

**동작 방식:** PDCA 스킬은 복합 요청을 Plan(리서치 + 분석) → Do(작성) → Check(리뷰) → Act(개선 또는 재라우팅)으로 오케스트레이션할 수 있습니다. 개별 스킬과 커맨드도 직접 사용할 수 있습니다. 외부 capability 탐색은 선택적·자문적이며, 오케스트레이터 계획이 외부 스킬을 대신 실행하지는 않습니다.

## 실전 예시

**입력:**
```
/scc:pdca "AI 에이전트 시장 보고서" --depth deep
```

**진행 과정:**
1. **Plan**: 질문 프로토콜이 최대 3개의 범위 확인 질문을 합니다. 가능하면 외부 메모리/리서치 디스패치가 `Skill: claude-mem:knowledge-agent`를 먼저 사용하고, 이후 이브이(Eevee), 후딘(Alakazam), 뮤츠(Mewtwo)가 결과를 구조화합니다.
2. **Plan→Do 게이트**: 런타임이 리서치 브리프, 집계된 소스 5개 이상, 분석 아티팩트, Plan 승인 여부를 검증합니다. 이는 사용 가능한 고유 URL 5개를 보장한다는 뜻이 아닙니다.
3. **Do**: 루브도(Smeargle, 라이터)가 Plan 아티팩트를 사용하여 순수 실행 모드로 보고서를 작성합니다. 디자인 성격이 강한 실행은 설치되어 있을 때 `Skill: frontend-design:frontend-design`로 먼저 갈 수 있어요.
4. **Do→Check 게이트**: 아티팩트 완성도, 포맷 준수, Plan 결과 반영을 검증합니다.
5. **Check**: 선택한 리뷰 프리셋이 실제 내장 패널 Xatu(opus), Absol(sonnet), Porygon(sonnet), Jigglypuff(sonnet), Unown(sonnet) 중 2~5명을 병렬 실행하고 리뷰 스킬의 합의 규칙을 적용합니다. 외부 리뷰는 선택 사항입니다.
6. **Check→Act 게이트**: APPROVED → 출하. 그 외 → 액션 라우터.
7. **Act**: 액션 라우터가 소견을 근본원인별로 분류합니다. 출하/커밋 프롬프트는 설치되어 있으면 `/commit-commands:commit`을 우선합니다:
   - 소스/가정 갭 → **Plan**으로 복귀
   - 완성도/포맷 문제 → **Do**로 복귀
   - 실행 품질 → **Loop** (메타몽 에디터)
8. 목표 달성 또는 최대 반복 횟수까지 사이클이 반복됩니다.

## 옵션

| 플래그 | 값 | 기본값 |
|--------|-----|--------|
| `--phase` | `plan\|do\|check\|act\|full` | 자동 감지 |
| `--depth` | `shallow\|medium\|deep` | `medium` |
| `--target` | 판정 또는 점수 | `APPROVED` |
| `--max` | 최대 Act 반복 횟수 | `3` |
| `--no-questions` | 질문 프로토콜 건너뛰기 | `false` |
| `--domain` | `code\|content\|analysis\|pipeline` | `code` |

`--domain` 플래그(v1.0.0 신규)는 페이즈 전환마다 도메인별 단계 계약, 완료 정의(DoD), 롤백 대상을 선택합니다.

### 코드 엔지니어링 레인

`--domain code`가 활성화되면 PDCA는 `skills/pdca/references/code-engineering-lane.md`의 코드 엔지니어링 레인을 로드합니다. 기본 Plan → Do → Check → Act 순서는 유지하되, 코드 작업에는 테스트 가능한 수용 기준, worker-validator 분리, 장기 작업 stage report, 넓거나 위험한 실행의 human approval gate, 정리/단순화, issue/PR/local handoff state를 추가 계약으로 둡니다.

## 작동 원리

![PDCA Cycle](../images/pdca-cycle.svg)

### 페이즈 게이트

아래 표에서 런타임이 실제로 강제하는 전환 조건과 스킬 수준 계약을 구분합니다.

| 게이트 | 런타임이 강제하는 하위 집합 |
|--------|-------------|
| Plan → Do | brief 존재, `sources_count ≥ 5`, analysis 존재, Plan 승인 |
| Do → Check | 아티팩트 존재·완료 표시, Plan 결과 통합 |
| Check → Act | 판정 설정 및 리뷰어 2명 이상 보고 |
| Act → 종료/사이클 | Act 결정 및 근본원인 분류 설정; 라우팅 자체는 스킬 수준 동작 |

포맷 길이·섹션·리뷰어 다양성·점수·5+ 재작성 룰은 위 런타임 하위 집합에 명시되지 않는 한
스킬 계약 또는 자문 검사입니다.

### 포맷별 길이 Floor (Do 게이트)

| 포맷 | 최소 글자 | 목표 | 디스패치되는 sub-skill |
|------|---------|------|---------------------|
| 뉴스레터 | 10,000자 | 포맷별 | `/scc:write --format newsletter` |
| 아티클 | 4,000자 | 포맷별 | `/scc:write --format article` |
| 리포트 | 5,000자 | 포맷별 | `/scc:write --format report` |
| 쇼츠 | 약 1,800자 | 포맷별 | `/scc:write --format shorts` |
| 소셜 | 플랫폼 최적화 | 포맷별 | `/scc:write --format social` |
| 카드뉴스 | 슬라이드 단위 | 포맷별 | `/scc:write --format card-news` |

전체 표는 `skills/pdca/references/do-phase.md`에.

### 도메인 라우팅

지원되는 write 포맷을 명시적으로 선택합니다. 이는 숨은 커맨드 라우트가 아니며, 외부 플러그인은
설치되어 있고 명시적으로 선택한 경우에만 추가 경로가 될 수 있습니다.

| 요청 포맷 | 내장 경로 |
|--------|-----------|
| newsletter | `/scc:write --format newsletter` |
| article/report/shorts/social/card-news | `/scc:write --format <format>` |
| analysis/strategy | 분석 요청이면 `/scc:analyze` |

Sub-skill 표준: `skills/pdca/references/domain-pipeline-integration.md` (입출력 계약, 4가지 실패 모드).

### 리뷰어 검사 (Check 페이즈)

리뷰 스킬은 리뷰어 다양성과 false consensus 검사를 수행할 수 있지만, PDCA 런타임 전환은
판정 설정과 리뷰어 2명 보고만 요구합니다. 리뷰 프리셋은 내장 리뷰어 2~5명을 실행하며
`--external`은 선택 사항입니다. 모델 다양성·adversarial 후속 검사는 스킬 수준 또는 자문
검사이며 런타임 보장이 아닙니다.

### 5+ 룰 (Act 페이즈)

Patch vs full rewrite 트리거. 액션 라우터 plurality routing 전에 먼저 체크합니다.

**발동 조건**:
1. Any P0 finding (hard credibility 트리거 — 단일 P0만으로 강제 재작성)
2. OR (P0+P1 ≥ 5 AND findings가 ≥ 3개 quality category에 걸침) — 두 조건 모두 필요

v1.3.0 검증 사이클에서 4-finding patch set이 3개 카테고리에 걸친 surgical 케이스인데도 초기 OR 로직이 over-trigger한 걸 발견하고 AND로 보정. 새 AND 로직: 6/6 routing 정확도 vs 이전 OR 3/6.

### 액션 라우터

리뷰 소견을 근본원인별로 분류한 뒤 라우팅합니다:

| 소견 카테고리 | 라우팅 | 이유 |
|-------------|--------|------|
| SOURCE_GAP, ASSUMPTION_ERROR, FRAMEWORK_MISMATCH | Plan | 리서치 보강 필요 |
| COMPLETENESS_GAP, FORMAT_VIOLATION | Do | 실행 재작업 필요 |
| EXECUTION_QUALITY | Loop | 품질 반복 개선 필요 |

### 질문 프로토콜

Plan 진입 시 최대 3개의 범위 확인 질문을 합니다:
- 컨텍스트가 충분하거나 `--no-questions` 설정 시 건너뜀
- 미응답 질문 → 가정으로 저장 후 진행
- Act→Plan 복귀 시 질문 건너뜀 (리서치 갭이 이미 식별됨)

## 주의사항

- **게이트는 필수** — 절대 건너뛰지 마세요. 쓰레기 입력-쓰레기 출력을 방지합니다.
- **Plan 없이 Do** — 사용자가 소스 자료를 명시적으로 준비한 경우에만 유효합니다.
- **모든 것이 Loop은 아닙니다** — 액션 라우터로 근본원인을 분류하세요. 리서치 갭은 Plan으로, Loop이 아닙니다.
- **토큰 비용** — 심층 리서치 + 전체 PDCA는 토큰 소모가 큽니다. 오케스트레이터가 시작 시 경고합니다.
- **"그냥 써줘"** — Do만 실행하세요. 단일 페이즈 요청에 전체 PDCA를 강제하지 마세요.
- **단일 페이즈 호출** — 다음 게이트에서 일시 정지하고 사용자 결정을 기다립니다.

## 연동 스킬

| 스킬 | 관계 |
|------|------|
| 외부 플러그인 | `getDispatchPlan()`이 추천할 수 있으며, 호출자가 명시적으로 실행해야 함 |
| research | Plan 페이즈에서 데이터 수집에 호출 |
| analyze | Plan 페이즈에서 구조화된 분석에 호출 |
| write | Do 페이즈에서 순수 실행 모드로 호출 |
| review | Check 페이즈에서 병렬 리뷰어와 함께 호출 |
| refine | Act 페이즈에서 액션 라우터가 Refine으로 라우팅할 때 호출 |
| workflow | 전체 PDCA 사이클 자동화 가능 |

## 사이클 메모리

PDCA 오케스트레이터가 사이클 메모리 레이어(v1.0.0 신규)와 통합되어 페이즈 아티팩트, 메트릭스, 교차 사이클 인사이트를 영속합니다.

- **전환 시 자동 저장**: `pdca_transition` 실행 시 완료된 페이즈의 아티팩트가 `.data/cycles/cycle-NNN/{phase}.md`에 저장됩니다.
- **종료 시 자동 저장**: `pdca_end_run` 실행 시 사이클 메트릭스(도메인, 판정, 소요시간)가 `metrics.json`에 영속됩니다.
- **Read-Before-Act**: `pdca_start_run` 시 최근 10개 인사이트(가중치 ≥ 0.1)가 실행 컨텍스트에 로드됩니다.
- **자기 진화**: 치명적 인사이트가 3회 이상 기록되면 주의사항 제안이 자동 생성됩니다.

### 사이클 메모리 MCP 도구

| 도구 | 매개변수 | 반환값 |
|------|---------|--------|
| `pdca_get_cycle_history` | `cycle_id?: number`, `last_n?: number` | `{ cycles: [{ id, plan, do, check, act, metrics }] }` |
| `pdca_save_insight` | `cycle_id: number` (필수), `insight: string` (필수), `category: "process"\|"technical"\|"quality"` (필수), `severity: "info"\|"warning"\|"critical"` (필수) | `{ total_insights: number, repeated_count: number }` |
| `pdca_get_insights` | `category?: string`, `last_n?: number` (기본 20), `min_weight?: number` (0–1) | `{ insights: [{ cycle_id, timestamp, category, severity, text, weight }] }` |

인사이트는 30일 선형 시간 감쇠를 사용합니다. `weight` 필드는 1.0(방금 기록)에서 0.0(30일 이상 경과)까지 범위입니다. `min_weight`로 오래된 인사이트를 필터링하세요.

## 전체 레퍼런스

- [PDCA SKILL.md](../../skills/pdca/SKILL.md) — 전체 오케스트레이터 사양
- [페이즈 게이트](../../skills/pdca/references/) — 각 전환의 상세 체크리스트
- [아키텍처](../architecture.md) — 에이전트 목록 및 시스템 설계

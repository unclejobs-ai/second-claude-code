[English](pdca.md) | **한국어**

# PDCA

> **하드** 품질 게이트(길이 floor, 리뷰어 모델 다양성, 보정된 5+ 룰), 외부 플러그인 디스패치, 액션 라우터, 16개 포켓몬 테마 conceptual role을 갖춘 Plan → Do → Check → Act 전체 사이클 오케스트레이터.

## v1.4.0에서 달라진 점

- **크로스-플러그인 페이즈 디스패치** — 더 강한 외부 capability가 설치되어 있으면 PDCA 페이즈가 플러그인 생태계를 먼저 경유합니다.
- **검증된 페이즈 1순위** — Plan → `Skill: claude-mem-knowledge-agent`, Do → `Skill: frontend-design-frontend-design`, Check → `Skill: coderabbit-code-review`, Act → `/commit-commands:commit`.
- **프롬프트 레벨 외부 디스패치** — `prompt-detect`가 내부 fallback 전에 `getDispatchPlan()`을 호출합니다. `posthog event analysis`처럼 강한 외부 매칭은 설치된 플러그인을 먼저 호출해요.
- **하드코딩된 플러그인 레지스트리 없음** — `~/.claude/plugins/`에서 capability를 런타임 발견하고 정확한 `Skill:` / 슬래시 커맨드 호출 문자열로 바꿉니다.
- **짧은 키워드 안전장치** — `bug`가 `debugging` 안에서 우연히 매칭되는 것 같은 작은 키워드 overmatch를 단어 경계 검사로 막습니다.

v1.4.0 디스패치 구조와 검증 범위는 [orchestrator-architecture.ko.md](../orchestrator-architecture.ko.md) 참고.

## v1.3.0에서 달라진 점

- **PDCA가 메인 오케스트레이터, sub-skill은 빌딩 블록** — `/threads`, `/newsletter`, `/academy-shorts`, `/card-news`는 PDCA의 Do 페이즈 **안에서** greedy 도메인 자동 라우팅을 통해 돌아가요. PDCA의 Check는 sub-skill 내부 리뷰가 끝난 뒤에도 외부 시각으로 한 번 더 돌아갑니다.
- **포맷별 하드 길이 floor** — Do 게이트가 최소치 미달이면 통과 안 돼요: 스레드 ≥ 4,000자, 뉴스레터 ≥ 10,000자, 전략 리포트 ≥ 5,000자, 쇼츠 대본 ≥ 1,800자. Sub-skill이 구체 scope expansion 지시와 함께 재디스패치됩니다.
- **Plan brief floor** — source 최소를 3 → 5로 올렸고, 사실 8개, named-source 인용 1개, 비교표 1개, 미디어 1개, 본문 3,000자가 의무화됐어요.
- **리뷰어 다양성 룰** — Check 페이즈가 content/strategy/full preset에 distinct 모델 2개 이상 + 외부 모델(Codex, Kimi, Qwen, Gemini, Droid) 1개 이상을 강제. Diversity score ≥ 0.6. False consensus 감지 시 adversarial pass 자동 디스패치.
- **5+ 룰 (보정된 AND 로직)** — Patch vs full rewrite 트리거. any P0 OR (P0+P1 ≥ 5 AND finding이 ≥ 3개 카테고리에 걸침)일 때 발동. 초기 OR 로직이 실제 4-finding patch set에서 over-trigger한 걸 발견하고 보정.
- **포켓몬 역할 라벨 명확화** — Eevee/Smeargle/Xatu 등은 conceptual role이지 직접 Agent dispatch target이 아닙니다. 실제 dispatch는 `/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine` 안에서 일어나요.

전체 강화 사양과 검증 사이클 메트릭은 [RELEASE-v1.3.0.ko.md](../RELEASE-v1.3.0.ko.md) 참고.

## 빠른 예시

```
AI 에이전트 프레임워크 알아보고 보고서 써줘
```

**동작 방식:** PDCA 오케스트레이터가 복합 의도(리서치 + 작성)를 감지하고 전체 사이클에 진입합니다. Plan(리서치 + 분석) → Do(작성) → Check(리뷰) → Act(루프 또는 재라우팅)을 품질 게이트를 사이에 두고 체이닝합니다. v1.4.0부터는 각 페이즈가 내부 Second Claude 스킬을 실행하기 전에 더 강한 설치 플러그인 capability를 먼저 호출할 수 있어요.

## 실전 예시

**입력:**
```
/second-claude-code:pdca "AI 에이전트 시장 보고서" --depth deep
```

**진행 과정:**
1. **Plan**: 질문 프로토콜이 최대 3개의 범위 확인 질문을 합니다. 가능하면 외부 메모리/리서치 디스패치가 `Skill: claude-mem-knowledge-agent`를 먼저 사용하고, 이후 이브이(Eevee), 후딘(Alakazam), 뮤츠(Mewtwo)가 결과를 구조화합니다.
2. **Plan→Do 게이트**: 3개 이상의 출처가 포함된 리서치 브리프와 분석 아티팩트를 검증합니다.
3. **Do**: 루브도(Smeargle, 라이터)가 Plan 아티팩트를 사용하여 순수 실행 모드로 보고서를 작성합니다. 디자인 성격이 강한 실행은 설치되어 있을 때 `Skill: frontend-design-frontend-design`로 먼저 갈 수 있어요.
4. **Do→Check 게이트**: 아티팩트 완성도, 포맷 준수, Plan 결과 반영을 검증합니다.
5. **Check**: 5마리 리뷰어(네이티오, 앱솔, 폴리곤, 푸린, 안농)가 합의 게이트와 함께 병렬 리뷰를 실행합니다. 코드 리뷰 프롬프트는 설치되어 있으면 `Skill: coderabbit-code-review`를 우선합니다.
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

## 작동 원리

![PDCA Cycle](../images/pdca-cycle.svg)

### 페이즈 게이트 (v1.3.0 강화)

모든 게이트가 이제 soft 판단이 아니라 측정 가능한 numeric/boolean 필드를 요구합니다.

| 게이트 | 하드 요구사항 |
|--------|-------------|
| Plan → Do | `brief_char_count ≥ 3,000`, `sources_count ≥ 5`, `facts_count ≥ 8`, `quotes_count ≥ 1` (named speaker), `comparison_tables_count ≥ 1`, `media_inventory_count ≥ 1` (콘텐츠 brief), `meets_brief_floor: true` |
| Do → Check | `meets_length_floor: true` (포맷별 최소치), `meets_section_floor: true`, `references_count ≥ 3`, `plan_findings_integrated: true`, `sections_complete: true` |
| Check → Act | `distinct_models_count ≥ 2`, `external_model_count ≥ 1` (content/strategy/full preset), `diversity_score ≥ 0.6`, `false_consensus_check_passed: true`, 판정 라우팅: APPROVED는 종료, 나머지는 Act로 |
| Act → 종료/사이클 | **5+ 룰 먼저** (P0 ≥ 1 또는 volume+spread 트리거), 그다음 액션 라우터가 근본원인 분류 → Plan, Do, 또는 Refine |

### 포맷별 길이 Floor (Do 게이트)

| 포맷 | 최소 글자 | 목표 | 디스패치되는 sub-skill |
|------|---------|------|---------------------|
| 스레드 아티클 | 4,000 | 5,000-7,000 | `/threads` |
| 뉴스레터 | 10,000 | 12,000-15,000 | `/newsletter` |
| 일반 아티클 | 4,000 | 5,000-7,000 | `/scc:write` |
| 전략 리포트 | 5,000 | 6,000-9,000 | `/scc:write` |
| SWOT/RICE/OKR | 3,000 | 4,000-5,000 | `/scc:analyze` |
| 쇼츠 대본 | 1,800 | 2,200-2,800 | `/academy-shorts` |
| 카드뉴스 | 8-10 카드 | 9-12 카드 | `/card-news` |
| PRD | 4,000 | 5,000-7,000 | `/scc:write --format prd` |

전체 표는 `skills/pdca/references/do-phase.md`에.

### 도메인 자동 라우팅

Do 페이즈가 사용자 프롬프트를 트리거 키워드와 그리디 매칭해서 가장 specialized한 sub-skill을 디스패치해요. Specialized가 항상 generic보다 우선.

| 트리거 | Sub-skill |
|--------|-----------|
| 스레드, threads, @unclejobs.ai | `/threads` |
| 뉴스레터, newsletter | `/newsletter` |
| 쇼츠, shorts, 릴스 | `/academy-shorts` |
| 카드뉴스, card news, 캐러셀 | `/card-news` |
| (specialized 매치 없음) | `/scc:write` |

Sub-skill 표준: `skills/pdca/references/domain-pipeline-integration.md` (입출력 계약, 4가지 실패 모드).

### 리뷰어 다양성 (Check 게이트)

Check 페이즈가 false consensus 방지를 위해 리뷰어 모델 다양성을 강제합니다:

- ≥ 2 distinct 모델 (같은 모델 2개 금지)
- ≥ 1 외부 모델 for `content`/`strategy`/`full` preset (Codex GPT-5.4, Kimi K2.5, Qwen, Gemini, Droid)
- Diversity score ≥ 0.6 (리뷰어 2개 초과 시)
- **False consensus 감지**: 모든 리뷰어가 평균 0.9 초과 + critical 0개로 APPROVED → 사용 안 한 외부 모델로 adversarial pass 자동 디스패치

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
| 외부 플러그인 | `getDispatchPlan()`이 더 강한 페이즈/키워드 매칭을 찾으면 내부 fallback 전에 호출 |
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

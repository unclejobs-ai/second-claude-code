# 릴리스 노트 — v1.3.0

**날짜**: 2026-04-07
**테마**: PDCA 하드 게이트 — 길이 floor, 리뷰어 다양성, 보정된 5+ 룰

v1.3.0은 PDCA 오케스트레이터의 모든 페이즈 경계에 측정 가능하고 계약으로 강제되는 게이트를 박았습니다. 이전 버전은 Plan→Do→Check→Act 구조는 갖췄지만 게이트가 약해서, 셀프 처리 fallback이 통과되거나 sparse 출력이 게이트를 지나가는 일이 가능했어요. v1.3.0은 그 구멍을 9개 구체 강화로 막았고, 전부 실제 end-to-end 사이클에서 검증했습니다.

이 릴리스를 만든 실제 실패 사례: 사용자가 콘텐츠 작업을 위해 PDCA를 호출했는데, 오케스트레이터가 추상 페이즈를 셀프 처리 면허로 해석해서 Do 안에서 돌아야 할 specialized sub-skill을 건너뛰고, Check에서 리뷰어 다양성도 건너뛰고, 1,500자짜리 "완성된" 아티클을 출력했어요. v1.3.0은 그 경로를 구조적으로 불가능하게 만듭니다.

---

## 1. PDCA가 메인 오케스트레이터입니다 (아키텍처 명확화)

아키텍처 문서에 PDCA가 메인 오케스트레이터이고 sub-skill(`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`, `/scc:write`)은 페이즈 안에서 호출되는 빌딩 블록이라는 사실을 명시했어요. Sub-skill은 PDCA를 대체하지 않습니다 — 자기 내부의 멀티 페이즈 파이프라인은 PDCA의 Do 페이즈 안에서 돌아가고, sub-skill 자체 계약으로 게이팅되며, PDCA의 Plan + Check + Act가 그 위아래를 감쌉니다.

```
PDCA 사이클 (항상 돌아감)
  ├── Plan  → /scc:research + /scc:analyze
  ├── Do    → 가장 specialized한 sub-skill 매칭 (greedy)
  │           ├── /threads (자체 8단계 페이즈가 여기서 돌아감)
  │           ├── /newsletter (자체 7단계 페이즈가 여기서 돌아감)
  │           ├── /academy-shorts (자체 멀티 페이즈가 여기서 돌아감)
  │           ├── /card-news (template + render)
  │           └── /scc:write (generic fallback)
  ├── Check → /scc:review (병렬 다양 리뷰어, sub-skill 내부 리뷰와 별개로 한 번 더)
  └── Act   → Action Router 또는 5+ Rule → Plan/Do/Refine 라우팅
```

PDCA의 Check는 sub-skill 내부 리뷰와 **중복이 아닙니다** — 다른 시각이라 다른 이슈를 잡아요. Sub-skill 내부 리뷰는 도메인 특화 이슈(보이스 가이드 위반, 포맷 준수)에 집중합니다. PDCA의 Check는 도메인 파이프라인 바깥에서 결과를 보고, 도메인 파이프라인이 자기 자신을 못 보는 부분을 잡아요.

---

## 2. 도메인 자동 라우팅 (Greedy Sub-Skill Selection)

Do 페이즈가 사용자 프롬프트에서 도메인 트리거 키워드를 매칭해서 가장 specialized한 sub-skill을 디스패치합니다:

| 트리거 키워드 | 디스패치되는 Sub-Skill |
|--------------|----------------------|
| "스레드", "threads", "@unclejobs.ai" | `/threads` (8단계 한국어 스레드 파이프라인) |
| "뉴스레터", "newsletter", "주간 뉴스레터" | `/newsletter` (7단계 한국어 테크 뉴스레터 파이프라인) |
| "쇼츠", "shorts", "릴스", "Reels", "9:16", "60초 영상" | `/academy-shorts` |
| "카드뉴스", "card news", "인스타 카드", "캐러셀" | `/card-news` |
| (specialized 매치 없음) | `/scc:write` (generic fallback) |

Greedy matching이 룰입니다. 가장 specialized한 sub-skill을 우선 선택하고, 그게 없을 때만 generic으로 fall back. 스레드 아티클은 반드시 `/threads`로 가야 하지 절대 `/scc:write`로 가면 안 됩니다 — `/threads`가 보이스 가이드 강제, 외부 모델 크로스 리뷰, Notion 발행 단계를 다 갖고 있는데 `/scc:write`는 그게 없거든요.

전체 알고리즘과 selection 우선순위는 새로 추가한 `references/domain-pipeline-integration.md` 파일에 정리돼 있어요.

---

## 3. 포맷별 길이 Floor 강제

Do 페이즈가 이제 포맷별 최소 글자 수와 섹션 수에 미달하면 게이트를 통과 못 합니다. Floor 미달 시 아티클이 리뷰어한테 가지 않아요 — 작가가 구체 expansion 지시와 함께 다시 디스패치됩니다.

### 길이 Floor 표 (발췌, 전체는 `references/do-phase.md`)

| 포맷 | 최소 글자 (본문) | 목표 | 최소 섹션 |
|------|----------------|------|----------|
| 스레드 아티클 (@unclejobs.ai) | 4,000 | 5,000-7,000 | 6 |
| 한국어 테크 뉴스레터 | 10,000 | 12,000-15,000 | 6 토픽 |
| 일반 아티클 | 4,000 | 5,000-7,000 | 5 H2 |
| 전략/분석 리포트 | 5,000 | 6,000-9,000 | 6 섹션 |
| SWOT/RICE/OKR | 3,000 | 4,000-5,000 | 4 사분면 |
| 쇼츠 대본 (60-90초) | 1,800 | 2,200-2,800 | 12 씬 |
| 카드뉴스 (캐러셀) | 8-10 카드 | 9-12 카드 | hook + body + CTA |
| PRD | 4,000 | 5,000-7,000 | 7 섹션 |
| 코드 리뷰 리포트 | 2,500 | 3,500-5,000 | 5 차원 |
| 리서치 브리프 | 3,000 | 4,000-6,000 | (사실/출처 카운트) |
| 미팅 노트 | 2,000 | 2,500-3,500 | 5 섹션 |

### Calibration 원칙

Floor는 임의가 아니에요. 세 가지 벤치마크에 맞췄습니다:

1. **Reader value floor** — 포맷이 완전한 아이디어를 전달하는 최소 길이 (티저가 아닌)
2. **Source utilization floor** — Plan에서 모은 모든 사실이 Do 출력에 등장해야 함
3. **AI hedge prevention** — LLM은 vague한 길이 지시에서 under-write하는 경향이 있어서, numeric floor가 substance commitment를 강제

Floor 실패 후 작가를 다시 디스패치할 때, 오케스트레이터가 구체 scope direction(어떤 Plan finding을 expand할지, 어떤 sub-section을 새로 추가할지)을 줍니다. "더 길게 써" 같은 vague 프롬프트가 아니에요. Generic 프롬프트는 filler를 만들고, specific 프롬프트는 substance를 만듭니다.

---

## 4. Plan Brief Floors

Plan 페이즈 게이트도 측정 가능한 계약을 갖게 됐어요. Source 최소 개수를 3 → 5로 올렸고, 새 필드도 의무화됐습니다:

| 필드 | 최소 | 비고 |
|------|------|------|
| Brief 본문 글자 | 3,000 | 미달 = thin Plan → thin Do 실패 체인 |
| Distinct sources | 5 (이전 3) | 다른 publisher, 다른 author |
| Discrete facts (date/number/name 포함) | 8 | 각각 specific해야 함, generic 금지 |
| Direct named-source quotes | 1 | "전문가들은" 같은 anonymous 금지 |
| 비교표 (콘텐츠 brief의 경우) | 1 | 3+ 행 구조 표 |
| 알려진 빈틈 | 1 | 모르는 것에 대해 정직 |
| 미디어 inventory (콘텐츠 출력의 경우) | 1 | 이미지/스크린샷/다이어그램 다운로드 또는 URL 검증 |

Brief 글자 floor가 일부 케이스에서 Do 출력 floor보다 높은 이유는, brief가 Do 출력의 **superset**이기 때문이에요 — 작가가 골라 쓸 재료가 있어야지 padding으로 채우면 안 됩니다.

---

## 5. 리뷰어 모델 다양성 룰

PDCA의 Check 페이즈가 false consensus 방지를 위해 리뷰어 모델 다양성을 강제합니다:

| 요구사항 | 임계값 | 이유 |
|----------|--------|------|
| 최소 리뷰어 수 | 2 (`--depth deep`은 3) | 단일 리뷰어 = consensus 체크 불가 |
| 같은 모델 리뷰어 최대치 | 모델당 1개 | 같은 모델 2개는 correlated error 생산 |
| 외부 모델 의무 | `content`/`strategy`/`full` preset에 1개 이상 | 내부 모델 시각 단독으로는 외부 모델이 잡는 이슈 놓침 |
| Diversity score | ≥ 0.6 (리뷰어 2개 초과 시) | `distinct_models / total_reviewers` |

승인된 외부 모델: Codex GPT-5.4, Kimi K2.5, Qwen, Gemini, Droid (mmbridge 또는 전용 reviewer agent로).

### False Consensus 감지

모든 리뷰어가 평균 점수 0.9 초과 + critical findings 0개로 APPROVED를 반환하면 사이클이 자동 종료되지 않습니다. 대신 사용 안 한 외부 모델로 adversarial pass가 자동 디스패치돼요. Goodhart 스타일 "다들 괜찮대"가 거짓 신호인 케이스를 잡습니다.

---

## 6. 5+ 룰 (보정된 AND 로직)

Action Router가 plurality routing 전에 5+ 룰을 먼저 체크합니다. 5+ 룰은 finding density가 임계값을 넘으면 패치 대신 통째 재작성을 강제해요.

### 룰 정의

세 가지 트리거 조건, 어느 하나라도 만족하면 발동:

1. **Hard credibility 트리거**: `P0_count ≥ 1` (단일 P0만 있어도 강제 재작성)
2. **Volume + spread 트리거** (BOTH 필요):
   - `P0_count + P1_count ≥ 5` 총 finding 수, AND
   - Findings가 ≥ 3개의 distinct quality category에 걸침
3. (그 외) 룰 발동 안 함 — 정상 Action Router routing

### 보정 (Calibration)

초기 릴리스는 volume+spread 조건에 OR 로직을 썼어요. 실제 검증 사이클에서, 4개 finding이 3개 카테고리에 걸친 surgical patch 영역인데도 full rewrite로 잘못 트리거했습니다. 수정: volume+spread는 AND로 전환. Hard credibility 트리거(any P0)는 별도로 보존했어요 — 신뢰도 손상은 표면 fix가 작아 보여도 누적되니까요.

보정 검증: 새 AND 로직에서 6/6 finding configurations이 정확하게 routing됩니다 (이전 OR 로직은 3/6).

---

## 7. Sub-Skill 입출력 계약 (신규 reference 파일)

새로 추가한 284줄짜리 `references/domain-pipeline-integration.md`가 PDCA의 Do 디스패처가 sub-skill을 호출하는 표준을 정의합니다:

- **Selection 알고리즘**: greedy specialized → generic fallback
- **Input contract**: 모든 sub-skill이 동일한 구조의 입력을 받음 (`research_brief_path`, `analysis_path`, `dod`, `constraints`, `format_target`, `length_floor`, `section_floor`, `skip_research: true`, `skip_review: true`, `worktree`)
- **Output contract**: 모든 sub-skill이 동일한 `DoOutput` 스키마를 반환, PDCA가 sub-skill self-report를 신뢰하지 않고 독립 검증
- **Failure handling**: 4가지 실패 모드 (errors, below-floor output, malformed output, hangs/timeouts)와 명시적 fallback 체인
- **Integration points**: 각 sub-skill (`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`)의 내부 페이즈가 PDCA Do 페이즈에 어떻게 매핑되는지

이 파일이 sub-skill integration의 authoritative reference입니다. SKILL.md가 여기를 링크해요.

---

## 8. 포켓몬 역할 라벨 명확화

`skills/pdca/SKILL.md`의 Subagents 블록에 포켓몬 이름(Eevee, Smeargle, Xatu, Absol 등)으로 conceptual role이 적혀 있었어요. 이건 실제 `subagent_type` 값이 아닌데 형식이 dispatchable처럼 보였습니다. 이전 실패 모드: 오케스트레이터가 `Agent(subagent_type: "eevee")`를 호출하려 시도 → silently 실패 → 셀프 처리로 fallback.

수정: Subagents 블록에 "Conceptual Roles, Not Direct Dispatch Targets"라고 명시. 실제 dispatch는 `/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine` 안에서 일어난다는 사실을 못 박았어요. 오케스트레이터가 chained-skill 레이어를 절대 우회하지 못하도록.

---

## 9. 페이즈 출력 스키마 확장

`references/phase-schemas.md`가 세 페이즈 모두 측정 가능한 검증 필드를 갖게 됐어요:

### PlanOutput 추가
- `brief_char_count`, `facts_count`, `quotes_count`, `comparison_tables_count`, `media_inventory_count`, `meets_brief_floor`

### DoOutput 추가
- `char_count` (본문만), `section_count`, `meets_length_floor`, `meets_section_floor`, `references_count`

### CheckOutput 추가
- `distinct_models_count`, `external_model_count`, `diversity_score`, `false_consensus_check_passed`, `p0_count`, `p1_count`, `p2_count`
- `reviewers[].model` (specific 모델 식별자), `reviewers[].is_external`

PDCA가 이 모든 걸 독립 검증합니다. Sub-skill이 inflated 숫자로 게이트를 game하지 못해요.

---

## 검증 사이클 (2026-04-07)

도메인 트리거가 없는 generic 토픽 ("MCP 프로토콜 출시 1년 회고")으로 실제 PDCA 사이클을 돌려서 모든 게이트를 end-to-end 테스트했어요.

### 페이즈별 결과

| Phase | 출력 파일 | Floor | 실제 | Pass |
|-------|----------|-------|------|------|
| Plan brief | `research-brief.md` | 3,000자 | 7,981 | ✓ |
| Plan facts | — | 8 | 14 | ✓ |
| Plan sources | — | 5 | 12 | ✓ |
| Plan quotes | — | 1 | 2 | ✓ |
| Plan 비교표 | — | 1 | 2 | ✓ |
| Do article (초기, Act patches 이전) | `article.md` | 4,000자 | 6,673 | ✓ |
| Do H2 sections | — | 5 | 7 | ✓ |
| Do references | — | 3 | 10 | ✓ |
| Check 리뷰어 | — | 2 | 2 (sonnet + Codex) | ✓ |
| Check 외부 모델 | — | 1 | 1 (Codex) | ✓ |
| Check diversity score | — | 0.6 | 1.0 | ✓ |
| Check verdict | — | — | MINOR FIXES (avg 0.885) | — |

### Findings + 5+ 룰 동작

Check 페이즈 합의는 MINOR FIXES with 4 deduped P1 findings, 3개 카테고리(factual, completeness, framing). 초기 5+ 룰 OR 로직이 이 4-finding patch set에 잘못 fire했습니다. 검증 사이클 도중에 발견됐고, 같은 릴리스에서 즉시 AND 로직으로 보정. 보정된 룰로 재실행했더니 정확하게 surgical Do refinement로 routing돼서 4개 P1을 한 번의 patch pass로 다 해결했어요.

### v1.0.0 → v1.3.0 개선

| 메트릭 | v1.0.0 baseline | v1.3.0 실제 | 개선 |
|--------|----------------|------------|------|
| Plan brief 글자 | 0 (brief 없음) | 7,981 | +∞ |
| Plan facts | 0 | 14 | +14 |
| Plan sources | 0 | 12 | +12 |
| Do article 글자 | ~1,500 (셀프 처리) | 6,962 (patches 후) | +364% |
| Do H2 sections | 1-2 | 7 | +250% |
| Do references | 0-3 | 10 | +233% |
| 리뷰어 수 | 0 | 2 | — |
| 외부 모델 리뷰어 | 0 | 1 | — |
| Cross-review findings | 0 | 4 P1 (전부 patch) | — |

---

## 파일 변경 요약

### 신규 파일
- `skills/pdca/references/domain-pipeline-integration.md` — Sub-skill dispatch 표준 (284줄)
- `docs/RELEASE-v1.3.0.md` — 영문 릴리스 노트
- `docs/RELEASE-v1.3.0.ko.md` — 이 파일

### 수정 파일
- `skills/pdca/SKILL.md` — Domain Auto-Routing 섹션, Sub-Skill 아키텍처 명확화, 포켓몬 역할 라벨 명확화 (+89줄)
- `skills/pdca/references/plan-phase.md` — Brief floors, 확장된 게이트 체크리스트 (+39줄)
- `skills/pdca/references/do-phase.md` — 길이 floor 표, sub-skill selection 알고리즘, calibration 원칙 (+121줄)
- `skills/pdca/references/check-phase.md` — 리뷰어 모델 다양성 룰, false consensus 감지 (+61줄)
- `skills/pdca/references/act-phase.md` — 보정된 AND 로직 5+ 룰, 예시 표 (+59줄)
- `skills/pdca/references/phase-schemas.md` — 확장된 PlanOutput, DoOutput, CheckOutput (+59줄)
- `.claude-plugin/plugin.json` — 버전 1.0.0 → 1.3.0
- `CHANGELOG.md` — [1.3.0] 항목
- `README.md` — PDCA 섹션 업데이트
- `README.ko.md` — 한국어 동등
- `docs/architecture.md` — PDCA 섹션 업데이트
- `docs/architecture.ko.md` — 한국어 동등

### 총 추가 줄 수
- PDCA skill 디렉토리에 대략 750줄의 새로운 contract enforcement, 스키마, 예시, 아키텍처 명확화.

---

## 업그레이드 노트

이건 backward-compatible 업그레이드입니다. 기존 PDCA 호출은 계속 작동해요 — 새 게이트를 만나서 통과하거나, 구체 expansion 지시와 함께 다시 디스패치될 뿐입니다. 이전 soft-gate 동작에 의존하던 사용자는 사이클 시간이 길어질 수 있어요 (이전엔 슬쩍 통과하던 ref refinement가 이제 trigger되니까), 그 대신 아티팩트 품질은 훨씬 높아집니다.

테스트를 위해 이전 동작이 필요해도 opt-out 플래그는 없어요 — 새 게이트가 의무입니다. 이전 동작이 바로 이 릴리스를 만든 실패 모드였거든요.

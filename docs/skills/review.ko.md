[English](review.md) | **한국어**

# Review

> 전문 리뷰어를 병렬로 실행한 뒤 Consensus Gate (합의 게이트)를 통해 소견을 병합합니다.

## 빠른 예시

```
이 README를 리뷰해
```

**동작 방식:** 3명의 리뷰어(deep-reviewer, devil-advocate, tone-guardian)가 독립된 컨텍스트에서 병렬 디스패치됩니다. 각 리뷰어는 심각도 레벨이 포함된 구조화된 소견을 제출하고, 합의 게이트가 이를 단일 판정으로 병합합니다.

## 실전 예시

**입력:**
```
/scc:review --preset content README.md
```

**진행 과정:**
1. Deep-reviewer(opus)가 논리, 구조, 완성도를 분석 -- 각 소견마다 정확한 위치를 인용.
2. Devil-advocate(sonnet)가 가장 취약한 3가지를 공격: 과장된 주장, 암시적 보증, 검증되지 않은 가치 제안.
3. Tone-guardian(sonnet)이 문체 일관성과 타겟 독자 적합성을 점검.
4. 소견 중복 제거 및 병합. 합의 게이트 적용: 승인 1/3, 기준 미충족.
5. 우선순위화된 액션 아이템과 함께 최종 판정 발행.

**출력 예시:**
> ## 판정: MINOR FIXES
> **합의**: 1/3 (기준 2/3 미충족, Critical 소견 없음)
>
> | # | 소견 | 리뷰어 | 심각도 |
> |---|------|--------|--------|
> | M1 | 플랫폼 호환성 주장에 근거 부족 | deep-reviewer | Major |
> | M2 | 콘텐츠 생산 도구에 출력 예시 없음 | deep-reviewer | Major |
> | M3 | "지식 노동 OS" 포지셔닝이 범위를 과대약속 | devil-advocate | Major |
> | M4 | 계보 섹션이 존재하지 않는 보증을 암시 | devil-advocate | Major |

## 프리셋

| 프리셋 | 리뷰어 구성 | 기준 |
|--------|------------|------|
| `content` | deep-reviewer + devil-advocate + tone-guardian | 2/3 |
| `strategy` | deep-reviewer + devil-advocate + fact-checker | 2/3 |
| `code` | deep-reviewer + fact-checker + structure-analyst | 2/3 |
| `quick` | devil-advocate + fact-checker | 2/2 |
| `full` | 리뷰어 5명 전원 | 3/5 |

## 리뷰어

| 리뷰어 | 모델 | 담당 영역 |
|--------|------|----------|
| `deep-reviewer` | opus | 논리, 구조, 완성도 |
| `devil-advocate` | sonnet | 취약점 및 사각지대 |
| `fact-checker` | sonnet | 주장, 수치, 출처 |
| `tone-guardian` | sonnet | 문체 및 독자 적합성 |
| `structure-analyst` | sonnet | 구성 및 가독성 |

## 옵션

| 플래그 | 값 | 기본값 |
|--------|-----|--------|
| `--preset` | `content\|strategy\|code\|quick\|full` | `content` |
| `--threshold` | 숫자 | `0.67` |
| `--strict` | flag | off |
| `--external` | flag | off |

### Consensus Gate (합의 게이트) 판정

| 판정 | 조건 |
|------|------|
| **APPROVED** | 기준 충족, Critical/Major 소견 없음 |
| **MINOR FIXES** | 기준 충족, Critical 없으나 Major/Minor 잔존 |
| **NEEDS IMPROVEMENT** | 기준 미충족, Critical 없음 -- 실질적 재작업 필요 |
| **MUST FIX** | 어떤 리뷰어든 Critical 소견 발생 시 (다른 모든 조건 무시) |

### 외부 리뷰어

`--external` 설정 시, 스킬이 설치된 외부 CLI를 감지하여 병렬 리뷰를 디스패치합니다. 외부 리뷰는 추가 투표권 1표로 반영됩니다. 감지 순서: `mmbridge` > `kimi` > `codex` > `gemini`. 감지된 CLI가 없으면 플래그가 자동으로 무시됩니다.

## 작동 원리

```mermaid
graph TD
    A[Content to Review] --> B[Select Preset]
    B --> C[Dispatch Reviewers in Parallel]
    C --> D[Reviewer 1]
    C --> E[Reviewer 2]
    C --> F[Reviewer 3]
    D --> G[Deduplicate & Merge]
    E --> G
    F --> G
    G --> H{Consensus Gate}
    H --> I[Verdict + Action Items]
```

## 리뷰어 독립성

만드는 데 관여한 쪽은 그것을 통과시키지 못합니다. 이 규칙은 에이전트 재사용으로 조용히 깨집니다. 상류 단계가 리뷰어 이름의 에이전트를 빌려 쓰고, 그 에이전트가 나중에 자기가 손댄 작업에 표를 던지는 식입니다.

활성 런이 Check가 아닌 단계일 때 뜬 리뷰어 이름의 에이전트는 상류 참여자로 기록됩니다. 집계 시점에 그 보고서는 남고 — 발견은 여전히 발견입니다 — 표만 세지 않습니다.

제외 후 정족수가 모자라면 판정은 `BLOCKED — QUORUM SHORT`가 되고, 누가 배제됐고 독립 리뷰어가 몇 명 모자란지 이름을 댑니다. 제외를 완화해서 정족수를 채우는 길은 없습니다. 상류에 없던 리뷰어를 대신 붙이십시오.

목록은 합의가 계산되면 비워집니다. 한 번 빌려 썼다고 그 에이전트가 이후 모든 리뷰에서 빠지지는 않습니다.

## 주의사항

- **리뷰어 간 영향** -- 리뷰어는 독립된 컨텍스트로 디스패치됩니다. 서로의 출력을 볼 수 없게 해야 합니다.
- **막연한 소견** -- 모든 소견은 정확한 위치(섹션, 줄)를 인용해야 합니다. "더 나아질 수 있다" 같은 표현은 실행 불가능합니다.
- **검증 없는 팩트체크** -- Fact-checker가 출처 URL 없이 검증 완료를 주장할 수 없습니다.
- **Strict 모드 주의** -- `--strict` 사용 시, 기준 미충족이면 모든 소견이 Minor여도 MUST FIX 판정이 내려집니다.

## 문제 해결

- **리뷰어들이 전부 같은 말을 한다** -- 리뷰어가 독립된 컨텍스트로 뜨는지(서로의 출력을 공유하지 않는지) 확인하십시오. 그래도 수렴하면 `full` 프리셋으로 관점을 늘리십시오.
- **NEEDS IMPROVEMENT가 예상 밖이다** -- Critical은 없는데 합의 임계치를 못 넘었다는 뜻입니다. 리뷰어 사이 이견이 실질적 재작업이 필요할 만큼 크다는 신호입니다. 리뷰어별 점수를 보고 Major 소견부터 해결하십시오.
- **`--external`이 아무 효과가 없다** -- 지원되는 외부 CLI가 없으면 조용히 무시됩니다. `mmbridge`, `kimi`, `codex`, `gemini` 순으로 찾습니다. 크로스 모델 리뷰가 필요하면 하나를 설치하십시오.
- **`--threshold` 범위** -- 0과 1 사이 비율입니다(`--threshold 0.5`는 리뷰어 절반 승인). 기본값은 `0.67`(2/3). `--strict`를 붙이면 소견이 전부 Minor여도 임계치 미달은 MUST FIX가 됩니다.
- **`BLOCKED — QUORUM SHORT`가 떴다** -- 제외 후 독립 리뷰어가 모자랍니다. 상류에 관여하지 않은 리뷰어를 대신 붙이십시오. 제외를 풀어서 정족수를 채우는 길은 없습니다.

## 연동 스킬

| 스킬 | 관계 |
|------|------|
| write | 초안 작성 후 `content` 프리셋으로 자동 호출 |
| analyze | 분석 결과 검증에 활용 가능 |
| loop | 리뷰 소견 기반으로 판정 개선까지 반복 |
| pipeline | 품질 게이트 단계로 연결 가능 |

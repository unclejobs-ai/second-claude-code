[English](review.md) | **한국어**

# Review

> 벤치마크하는 손. 독립 리뷰어가 같은 산출물을 따로 보고, 합의 게이트로 품질을 판정합니다.

## 언제 쓰나

콘텐츠 발행 전, 전략 검증, 코드 점검, 또는 “괜찮은가?”라는 질문에 씁니다.
리뷰어는 대상과 자기 역할만 받고 서로의 보고서는 보지 않습니다.

## 빠른 예시

```text
/scc:review README.md --preset content
```

프리셋에 따라 2~5명을 병렬 실행합니다. 각 리뷰어는 판정, 0.0~1.0 점수,
정확한 위치·심각도·구체적 수정안을 돌려줍니다. 집계기가 소견을 중복 제거하고
합의 게이트를 적용해 최종 보고서 하나를 반환합니다. 예시의 수치와 소견은
설명용입니다.

## 프리셋과 리뷰어

| 프리셋 | 리뷰어 | 승인 표 |
|---|---|---|
| `content` | deep-reviewer, devil-advocate, tone-guardian | 2/3 |
| `strategy` | deep-reviewer, devil-advocate, fact-checker | 2/3 |
| `code` | deep-reviewer, fact-checker, structure-analyst | 2/3 |
| `security` | code 구성; `--external` 시 `mmbridge security` 선택 | 2/3 또는 3/4 |
| `academic` | deep-reviewer, fact-checker, structure-analyst, devil-advocate | 3/4 |
| `quick` | devil-advocate, fact-checker | 2/2 |
| `full` | 리뷰어 5명 전원 | 3/5 |

기본 게이트는 평균 점수 `>= 0.7`과 Critical 없음도 요구합니다. Critical이
하나라도 있으면 무조건 `MUST FIX`입니다. 최종 판정은 `APPROVED`, `MINOR
FIXES`, `NEEDS IMPROVEMENT`, `MUST FIX`이며, Critical 없이 기준 미달이면
`NEEDS IMPROVEMENT`입니다.

## 옵션

| 플래그 | 값 | 기본값 |
|---|---|---|
| `--preset` | `content\|strategy\|code\|security\|academic\|quick\|full` | `content` |
| `--threshold` | `0..1` 비율 | `0.67` |
| `--strict` | flag | off |
| `--external` | flag | off |
| `--scope` | `auth\|api\|infra\|all` | `all` (security) |
| `--compliance` | `GDPR,SOC2,HIPAA,PCI-DSS` | 없음 |
| `--citation-style` | `APA\|MLA\|Chicago` | `APA` (academic) |
| `--team-review` | flag | off |

## 출력 계약

모든 소견은 `location`, `severity`(`Critical`, `Major`, `Minor`), `description`,
`fix suggestion`을 포함합니다. 보고서는
`references/critic-schema.md`의 `## Critic Output` 형식을 따릅니다.
팩트체커는 URL 없이 검증했다고 말할 수 없습니다. 산출물 작성에 관여한
에이전트는 투표에서 제외되며, 독립 리뷰어가 부족하면 `BLOCKED — QUORUM SHORT`입니다.

`--external`은 선택 사항입니다. 지원 CLI가 없으면 무시되고, 외부 리뷰 실패가
내부 리뷰를 막지는 않습니다.

## 연동

| 스킬 | 관계 |
|---|---|
| `write` | `--skip-review`가 없으면 내부에서 `quick` 리뷰를 실행합니다. |
| `analyze` | 프레임워크 분석을 검증합니다. |
| `refine` | 리뷰와 수정을 반복합니다. |
| `pdca` | Check 페이즈 판정을 제공합니다. |

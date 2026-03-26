# Loop

> 고정 벤치마크 스위트로 프롬프트 자산을 반복 최적화합니다.

## 빠른 예시

```bash
/second-claude-code:loop run write-core --targets skills/write/SKILL.md,commands/write.md --max-generations 2
```

**무슨 일이 일어나나:** `write-core` 스위트를 검증하고, 격리된 `codex/loop-...` 브랜치와 run worktree를 만든 뒤, baseline을 측정하고, 선택한 타깃 안에서 몇 개의 후보 변형을 만들고, 모든 하드 게이트를 통과하면서 baseline보다 `min_delta` 이상 좋아진 후보만 우승자로 승급합니다.

## 서브커맨드

| 서브커맨드 | 역할 |
|------------|------|
| `list-suites` | `benchmarks/loop/` 아래 번들 스위트 목록 표시 |
| `show-suite <name>` | 스위트 정의와 점수 예산 확인 |
| `run <name>` | 전체 최적화 실행 |
| `resume <run_id>` | 저장된 loop 상태 재로딩 |

## 허용 타깃

- `skills/**/SKILL.md`
- `agents/*.md`
- `commands/*.md`
- `templates/*.md`

이 범위를 벗어나면 점수 계산 전에 바로 거부됩니다.

## 상태와 산출물

- 활성 상태: `${CLAUDE_PLUGIN_DATA}/state/loop-active.json`
- 실행 산출물: `.captures/loop-<run_id>/`
- 우승 브랜치: `codex/loop-<suite>-<run_id>`

산출물에는 아래가 들어갑니다.

- `summary.json` — 재개 가능한 실행 스냅샷
- `leaderboard.json` — 평가된 모든 후보의 점수표
- `score-history.json` — 세대별 점수 흐름
- `winner.diff` — `min_delta`를 넘긴 우승 후보 패치

## 번들 스위트

| 스위트 | 초점 |
|--------|------|
| `write-core` | `write` 프롬프트 표면과 템플릿 계약 |
| `review-core` | `review` 프롬프트 표면과 합의 규칙 |

## 실행 흐름

1. `benchmarks/loop/`에서 스위트 매니페스트를 읽고 검증합니다.
2. 선택된 타깃을 해석하고, v1 허용 범위를 벗어난 경로는 바로 거부합니다.
3. 현재 HEAD 기준으로 격리된 `codex/loop-...` run 브랜치와 worktree를 만듭니다.
4. baseline을 모든 후보와 동일한 케이스, 동일한 timeout 예산으로 먼저 채점합니다.
5. 세대마다 3~5개 후보를 만들고, `--parallel` 예산 안에서 평가한 뒤, 상위 1~2개 elite만 다음 세대로 넘깁니다.
6. baseline 대비 `min_delta`를 넘는 우승 후보가 생기거나, 2세대 연속 plateau가 나거나, 세대 예산을 다 쓰면 종료합니다.

## 상태 값 의미

- `winner_promoted` — 하드 게이트를 모두 통과한 후보가 격리 브랜치로 승급된 상태
- `min_delta_not_met` — 유효한 후보는 있었지만 baseline 대비 향상 폭이 부족한 상태
- `plateau` — 2세대 연속 최고 점수가 갱신되지 않은 상태

어느 경우에도 현재 작업 중인 메인 워크스페이스는 직접 수정되지 않습니다. 변경은 격리된 loop 브랜치에만 반영됩니다.

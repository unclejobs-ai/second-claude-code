# Evolve

> 우로보로스 유지보수 루프 — 반복 실패하는 프롬프트 자산을 메인테이너가 작성한 구조 체크로 진화시킵니다.

`evolve`는 `loop` 위에 얹힌 레이어입니다. 스스로 최적화하지 않고, 실제 PDCA 실패에서 *어떤* 자산이 구조적으로 약한지 골라낸 뒤, 메인테이너가 작성한 체크를 받아 그대로의 `loop` 엔진에 넘깁니다.

## 빠른 예시

```bash
/second-claude-code:evolve list-failures
/second-claude-code:evolve harvest <id> --assertion '/second-claude-code:'
/second-claude-code:evolve run evolve-<id>
```

**동작 흐름:** `list-failures`가 실제 `gate_fail` 이벤트를 스캔해 실패가 반복되는(`recurrence ≥ 3`) 자산을 띄웁니다. 메인테이너가 정적 정규식을 직접 작성하면 `harvest`가 그걸 기록하고 `benchmarks/loop/evolve-<id>.json` 스위트를 생성합니다. `run`은 `loop`을 호출해 격리된 `codex/loop-...` 브랜치에서 자산을 진화시킵니다. 메인테이너는 `winner.diff`를 검토하고 직접 병합합니다.

## 서브커맨드

| 서브커맨드 | 용도 |
|------------|------|
| `list-failures [--min-recurrence N] [--asset PATH]` | 재발 임계치를 넘은 자산을 띄움 |
| `show-failure <id>` | 출처 레코드 + 해당 자산의 기존 승인 체크 확인 |
| `harvest <id> --assertion '<정규식>[,<정규식>]' [--target PATH]` | 메인테이너 체크를 붙이고 스위트 생성 |
| `run <name>` | 그대로의 loop 엔진 실행 + 홀드아웃 회귀 보고(권고) |
| `resume <run_id>` | loop 엔진의 resume에 위임 |

## 분리된 두 관심사

- **출처(Provenance)** — 어떤 자산을 진화시킬지는 실제 기록된 실패가 결정합니다. `config/evolve-asset-map.json`을 통해 `gate_fail` 이벤트에서 기계적으로 수확됩니다.
- **작성(Authorship)** — 체크가 *무엇*인지는 **메인테이너**가 결정합니다. 실패에서 유도하지 않고, 최적화 대상 모델이 작성하지도 않습니다. 자기개선 루프가 스스로 만든 벤치마크를 게이밍하는 것을 막는 핵심 안전장치입니다.

## v1 범위

loop의 변이는 다섯 가지 고정 텍스트 치환(`should`→`must`, `can`→`must`, 레거시 커맨드 프리픽스 정규화, 공백 정리, 빈 줄 축소)입니다. 기존 텍스트를 **고쳐 쓸** 뿐, 새 내용을 **추가하지** 않습니다. 후보가 이기려면 그 치환 중 하나가 메인테이너 정규식을 fail→pass로 뒤집어야 합니다. 없는 헤딩이나 새 섹션을 요구하는 체크는 v1에서 절대 승급되지 않고 `min_delta_not_met`으로 끝나며, 수동 편집이 필요합니다.

## 안전 게이트

- 메인테이너 작성은 **절차적 통제**입니다. 러너가 `check_author: "maintainer"`를 찍고 빈 `--assertion`을 거부하지만, 사람이 쓴 정규식과 모델이 쓴 정규식을 구분하지는 못합니다. 에이전트가 직접 만들게 두지 마세요.
- 생성된 `min_delta`는 번들 `0.02` 하한에 고정됩니다. `evolve run`은 그 아래 값을 거부합니다.
- 타깃은 v1 loop 허용목록과 안전 문자셋으로 제한돼, 생성된 커맨드에 셸 메타문자가 절대 섞이지 못합니다.
- 모든 loop 하드 게이트(syntax, manifest, contract-smoke, allowed-targets, critic-output)가 그대로 적용됩니다 — `evolve`는 엔진 코드를 수정하지 않습니다.
- loop 워크트리는 `HEAD`에서 만들어지므로, `scripts/evolve-scorer.mjs`와 타깃 자산이 `HEAD`에 커밋돼 있지 않으면 `evolve run`은 시작을 거부합니다.

## 상태 및 산출물

- 출처 원장: `${CLAUDE_PLUGIN_DATA}/evolve/failures.jsonl` (로컬 전용)
- 자산 귀속 맵: `config/evolve-asset-map.json`
- 생성 스위트: `benchmarks/loop/evolve-*.json`
- 실행 산출물: `.captures/loop-<run_id>/` (loop 엔진 소유)

## 설계 노트

전체 설계 — 순진한 "실패가 곧 벤치마크" 아이디어를 막아 세우고 구조적합성 재정의로 이끈 적대적 리뷰 이력 포함 — 는 [docs/proposals/evolve-ouroboros-spec.md](../proposals/evolve-ouroboros-spec.md)에 있습니다.

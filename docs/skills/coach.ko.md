[English](coach.md) | **한국어**

# Coach 스킬

Coach는 갈림길을 확정합니다. 갈림길이란 방어 가능한 방향이 둘 이상인 요청입니다. 판단 기준은 "내가 확신이 없는가"가 아니라 "같은 근거를 읽은 다른 유능한 에이전트가 다른 답에 도달할 수 있는가"입니다. Coach는 범위 토폴로지를 먼저 확정하고, 라운드마다 질문 하나만 던지고, 답변마다 모호도를 공개하고, 확정된 갈림길마다 기준 문서 하나를 프로젝트에 남긴 뒤 승인 옵션에서 멈춥니다.

## 빠른 예시

```bash
/scc:coach "이 글들 문체가 안 맞는데 오늘 발행분 초안이 필요합니다"

node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" start --idea "문체 방향을 확정한다" --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" answer --answer "토폴로지는 맞습니다" --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" status --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" record-fork --file fork.json --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" finalize --json
```

**동작 흐름:** 러너가 모호도 임계치를 해석하고, 프로젝트의 `.scc/` 아래에 재개 가능한 상태를 만들고, Round 0 토폴로지를 잠그고, 답변을 점수화하고, 확정된 갈림길마다 `.scc/standards/<id>/STANDARD.md`를 쓴 뒤 승인 옵션을 반환합니다. 코치 런타임은 커밋, 포매터, 소스 변경을 실행하지 않습니다.

## 언제 쓰나

`/scc:coach`는 다음 상황에 씁니다.

- 근거상 방어 가능한 방향이 둘 이상일 때
- 요청 자체를 거절하는 편이 근거에 맞고, 그 판단이 내 몫이 아니라 사용자 몫일 때
- 독립적으로 성공/실패할 수 있는 여러 컴포넌트가 있고 토폴로지가 불안정할 때
- 여기서 내린 결정이 이후 작업을 묶고, 세션이 끝나도 남아 있어야 할 때

이미 기준 문서가 그 갈림길을 다루고 있거나, 요청이 파일, 심볼, 수용 기준, 승인된 계획을 이미 포함한다면 직접 실행 쪽이 낫습니다.

## 런타임 흐름

1. 프로젝트 설정, 사용자 설정, 기본값 `0.05` 순서로 `scc.coach.ambiguityThreshold`를 해석합니다.
2. `.scc/standards/*/STANDARD.md`를 읽습니다. 이미 확정된 갈림길은 다시 열지 않고 근거로 인용합니다.
3. brownfield/greenfield를 구분하고 코드베이스 질문 전에 저장소 사실을 수집합니다.
4. Round 0 토폴로지 확인으로 최상위 컴포넌트를 잠급니다.
5. 라운드마다 가장 약한 활성 컴포넌트와 명확성 차원을 겨냥해 질문 하나를 던지고, 방어 가능한 방향을 모두 선택지로 올립니다.
6. greenfield 또는 brownfield 가중 공식으로 모호도를 계산합니다.
7. 질문, 옵션, 보고서, 기준 문서에서 세션 언어를 보존합니다.
8. 초안을 쓰기 전에 `record-fork --file <path>`로 확정된 갈림길을 기록합니다.
9. 승인 대기 옵션(`confirm`, `continue`, `plan-mode`)에서 멈춥니다.

`finalize`는 토폴로지가 확정되지 않았거나 모호도가 임계치 위면 거부하고, 어느 쪽이 열려 있는지 이름을 댑니다. 무조건 막는 건 아닙니다 — 스펙이 남은 위험을 사용자가 받아들이는 길을 허용합니다 — 다만 그 수용이 명시적이고 기록으로 남아야 합니다. `--accept-risk "<이유>"`는 이유와 열린 위험, 그리고 어떤 숫자를 놓고 받아들였는지를 함께 저장합니다. 이유 없는 맨 `--accept-risk`는 거부합니다. 수용이 반사적으로 되면 게이트가 아니니까요.

`confirm`은 확정된 인터뷰를 닫고 `.scc/state/coach.json`을 지웁니다. 결정은 기준 문서에 남습니다. 상태 파일은 재개용 나머지였고, 확정한 뒤에는 재개할 게 없습니다. 이걸로 세 갈래 해석도 정리됩니다 — session-end는 `pending_approval`을 닫힌 것으로, `start`는 열린 것으로, 세션 시작은 재개할 런으로 봤습니다. 파일이 없으면 셋의 답이 같아집니다.

## 갈림길 파일

`record-fork`는 인자를 argv가 아니라 파일로 받습니다. 본문에 줄바꿈과 비ASCII 산문이 들어가고, 셸을 통과하며 깨지기 때문입니다.

| 필드 | 의미 |
|---|---|
| `id` | 소문자·숫자·하이픈 1~64자. 기준 문서 디렉터리 이름이 됩니다. |
| `title` | 무엇을 놓고 갈렸는지, 사용자의 표현으로. |
| `chosen` | 사용자가 고른 방향. |
| `rejected` | 탈락한 방향들. 각각 `label`과 왜 졌는지(`why`). |
| `payload` | 기준 문서가 이후로 실어 나를 내용. |
| `review_when` | 이 결정을 다시 열어야 할 조건. |
| `triggers` | 나중에 이 기준을 다시 떠올려야 할 표현들. |
| `participants` | 갈림길을 정하는 데 관여한 에이전트. 이 기준이 다스리는 작업의 검수에서 제외됩니다. |

## 준수 검사

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/standard-check.mjs" <대상 경로> [--standard <id>] [--json]
```

활성 기준의 검사를 산출물 하나에 대해 돌리고, 하나라도 실패하면 종료코드 1을 냅니다. 두 기준의 검사가 동시에 만족될 수 없으면 양쪽 실패를 다 보고하고 임의로 해소하지 않습니다. 해소는 사람이 폐기로 처리합니다.

검사는 러너가 해석하는 데이터지, 실행하는 문자열이 아닙니다. 기준 문서는 사용자 프로젝트에 있고 저장소를 타고 퍼지므로, `run:` 같은 자유 문자열 필드는 조용히 무시하지 않고 오류로 거부합니다. 무시하면 작성자가 검사가 걸려 있다고 착각하게 되고, 그건 검사가 아예 없는 것보다 나쁩니다. 목록에 없는 검사기 id와 모르는 필드도 같은 이유로 거부합니다.

| 검사기 | 인수 | 실패 조건 |
|---|---|---|
| `regex-absent` | `pattern`, `flags` | 본문에 패턴이 나타남 |
| `regex-present` | `pattern`, `flags` | 패턴이 없음 |
| `length-between` | `unit` (`char`\|`word`), `min`, `max` | 본문이 범위 밖 |
| `similarity-below` | `a`, `b` (`S-A#closing` 같은 제목 경로), `threshold` | 두 구간이 임계치 이상으로 유사 |
| `frontmatter-equals` | `field`, `value` | 대상 프런트매터 값이 다름 |

검사기마다 반드시 실패해야 하는 픽스처가 `tests/fixtures/standard-checks/<검사기>/`에 딸려 있습니다. 픽스처를 이 저장소에 두는 건 의도적입니다 — 프로젝트가 픽스처를 대면 그것도 신뢰 경계를 넘는 입력이 됩니다. 검사기가 자기 픽스처를 통과시키기 시작하면 테스트가 깨집니다.

검사가 없는 기준은 `UNCHECKED`로 보고됩니다. 보이기만 할 뿐 검증된 게 아니고, 통과로 세지 않습니다. 위반은 아니라서 종료코드 1을 내지는 않습니다.

### adversarial 검사

`adversarial`은 정규식으로 가릴 수 없는 질문입니다 — 두 글이 한 사람이 쓴 것처럼 읽히는가, 이 주장이 과장인가. 리뷰어의 답이 파일에 남기 전까지는 `UNPROVEN`입니다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" record-verdict --file <verdict.json>
```

판정에는 `standard`, 질문 원문 `ask`, `verdict`(`pass`/`fail`), `reviewer`, 선택 `note`, 그리고 `target_sha256` — 리뷰어가 실제로 읽은 산출물의 해시 — 가 들어갑니다. 해시는 `standard-check`가 `UNPROVEN` 줄마다 같이 찍어 줍니다. 답은 `.scc/checks/adversarial.jsonl`에 덧붙입니다. 덧붙이기만 하는 이유는 이 프로젝트에서 다섯 세션이 동시에 돌기 때문입니다. 읽고-고쳐-쓰면 경합에서 진 판정이 사라집니다.

`record-verdict`는 `reviewer`가 그 기준의 `participants`에 있으면 거부합니다. 갈림길을 정하는 데 관여한 쪽은 그 기준이 다스리는 작업을 통과시키지 못합니다. 판정 근거는 선언이 아니라 기록입니다.

판정을 바이트에 묶는 게 핵심입니다. 산출물을 고치면 그에 달린 답은 전부 `UNPROVEN`으로 돌아갑니다 — 지난주 초안을 본 리뷰는 이번 초안에 대해 아무 말도 하지 않았으니까요. 판정을 `standard-check`이 아니라 coach 러너로 받는 것도 같은 이유입니다. 채점하는 도구가 합격 도장까지 찍게 두지 않습니다.

## 기준 폐기

기준은 지우지 않고 물립니다. `supersede --id <id>`는 프런트매터를 `status: superseded`로 바꾸고 파일은 그 자리에 둡니다. 탈락 이력이 남아 있어야 다음 세션이 이미 진 안을 다시 들고 오지 못합니다. `listActiveStandards`와 세션 시작 훅은 물린 기준을 싣지 않지만, 파일 자체는 계속 읽힙니다.

새 결정이 옛 결정 자리를 대신할 때는 `--file <fork.json>`을 함께 줍니다. 새 문서를 `supersedes: "<옛 id>"`와 함께 먼저 쓰고, 그다음에 옛 문서를 물립니다. 순서가 이렇기 때문에 새 id가 기존 기준과 충돌하면 옛 기준이 아직 살아 있는 상태에서 중단됩니다 — 활성 기준이 하나도 없는 상태로 떨어지지 않습니다. 인터뷰 중에 실행하면 새 id가 상태 파일에 붙고, 인터뷰 없이 단독으로도 실행됩니다.

## 점수 모델

| 프로젝트 유형 | 목표 | 제약 | 성공 기준 | brownfield 맥락 |
|---|---:|---:|---:|---:|
| Greenfield | 40% | 30% | 30% | - |
| Brownfield | 35% | 25% | 25% | 15% |

모호도는 `1 - weighted_clarity`입니다. 기본 임계치는 `0.05`지만 설정으로 바꿀 수 있습니다. 여러 컴포넌트가 있으면 가장 약한 컴포넌트/차원 쌍을 고르고, 동점인 약한 컴포넌트 사이를 회전해 한 컴포넌트의 상세함이 형제 컴포넌트의 불명확함을 가리지 못하게 합니다.

## 상태와 산출물

- 런타임 상태: `<project>/.scc/state/coach.json`
- 기준 문서: `<project>/.scc/standards/<id>/STANDARD.md`, 확정된 갈림길마다 하나
- 내부 프래그먼트: `skills/coach/references/fragments/auto-research-greenfield.md`, `auto-answer-uncertain.md`
- 계약 테스트: `tests/runtime/coach-runner.test.mjs`, `tests/runtime/coach-cli.test.mjs`, `tests/contracts/coach-contracts.test.mjs`

## 안전 게이트

- 점수화 라운드 전에 Round 0 토폴로지를 반드시 완료합니다.
- 여러 컴포넌트가 있으면 가장 자세한 컴포넌트에 과적합하지 않고 약한 형제 컴포넌트로 회전합니다.
- auto-mode 프래그먼트는 내부 `kind: skill-fragment` 프롬프트일 뿐이며 공개 커맨드나 `skill://` 라우트가 아닙니다.
- auto-mode 응답은 정확한 형태, 비어 있지 않은 rationale/fallback 필드, `low|medium|high` confidence를 검증해야 합니다.
- 잘못된 auto-mode 출력은 안전하게 수동 경로로 돌아가고 진단 실패 카운트를 남겨야 합니다.
- 최종 출력은 기록된 기준 문서와 승인 옵션이지 실행이 아닙니다.

## 참조 문서

- [Protocol](../../skills/coach/references/protocol.md)
- [Scoring](../../skills/coach/references/scoring.md)
- [Fixtures](../../skills/coach/references/fixtures.md)
- [Troubleshooting](../../skills/coach/references/troubleshooting.md)
- [Example transcript](../../skills/coach/references/example-transcript.md)
- [Acceptance checklist](../../skills/coach/references/acceptance-checklist.md)
- [Gotchas](../../skills/coach/gotchas.md)

## 문제 해결

| 증상 | 조치 |
|---|---|
| 저장소에서 알 수 있는 사실을 사용자에게 다시 묻는다 | 먼저 brownfield 맥락을 수집하고 다음 질문에 파일 경로나 심볼 근거를 인용합니다. |
| 사용자가 다른 선택지를 보지도 못한 채 방향이 정해졌다 | 다른 유능한 에이전트가 다르게 답할 수 있는지 자문하고, 그렇다면 모든 방향을 한 질문에 올립니다. |
| 모호도가 떨어지지 않는다 | 가장 약한 컴포넌트/차원 쌍을 겨냥하고 핵심 명사가 흔들리면 ontology 질문으로 전환합니다. |
| 세션 언어가 갑자기 영어로 바뀐다 | 상태의 `language.instruction`을 보존하고 질문, 기준 문서, 옵션 렌더링에 전달합니다. |
| auto-mode 응답이 그럴듯하지만 형태가 틀렸다 | 검증기로 거부하고 `architect_failures`를 기록한 뒤 수동 경로를 계속합니다. |
| `record-fork`가 id를 거부한다 | id는 `^[a-z0-9][a-z0-9-]{0,63}$`입니다. ASCII id를 주고, 사용자의 표현은 title이 싣습니다. |
| 사용자가 바로 구현하자고 한다 | 기준 문서를 기록하고 모호도가 높으면 위험을 보여준 뒤 명시적 실행 승인을 요구합니다. |

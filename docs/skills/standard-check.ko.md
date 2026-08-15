# 기준 검사 (Standard Check)

> `.scc/standards/`에 기록된 기준을 산출물 하나에 대고 돌립니다. 위반이 하나라도 있으면 종료코드 1.

`standard-check`은 스킬이 아니라 명령입니다. 검사를 해석해서 결과를 그대로 전할 뿐이고, 판단은 기준 문서 안에 있습니다. 그 판단은 갈림길을 정할 때 `/scc:coach`가 이미 받아 적었습니다.

## 빠른 예시

```bash
/scc:standard-check drafts/launch-post.md
```

```
FAIL no-hype / regex-absent — the target contains "단순히", which /단순히/ forbids
UNPROVEN no-hype — adversarial, needs an independent reviewer: 과장 없이 읽히는가?
  record answers against target_sha256 d0281896bfe6678dfd0e4fdc65299e1218d07676141d2a86c14eadab62465474
1 failure(s) across 1 checked standard(s)
```

## 옵션

| 플래그 | 값 | 기본값 |
|--------|-----|--------|
| `--standard` | 기준 id | 활성 기준 전부 |
| `--json` | — | 사람이 읽는 출력 |

폐기된 기준은 건너뜁니다. 활성이 아닌 id를 `--standard`로 주면 빈 실행이 아니라 오류입니다.

## 검사기

다섯 개, 고정입니다. 기준 문서는 id로 하나를 지목하고 구조화된 인수를 넘깁니다.

| 검사기 | 인수 | 실패 조건 |
|---|---|---|
| `regex-absent` | `pattern`, `flags` | 본문에 패턴이 나타남 |
| `regex-present` | `pattern`, `flags` | 패턴이 없음 |
| `length-between` | `unit` (`char`\|`word`), `min`, `max` | 본문이 범위 밖 |
| `similarity-below` | `a`, `b`, `threshold` | 두 구간이 임계치 이상으로 유사 |
| `frontmatter-equals` | `field`, `value` | 대상 프런트매터 값이 다름 |

`similarity-below`는 제목 경로를 받습니다. `S-A#closing`은 `S-A` 제목 아래 중첩된 `closing` 제목입니다. 유사도는 문자 바이그램 Dice 계수로 잽니다. 공백 토큰 방식은 한국어에서 겹침을 과소평가합니다.

검사가 돌기 전에 프런트매터와 본문을 갈라놓습니다. 본문 정규식이 메타데이터를 물지 않고, `frontmatter-equals`가 산문을 물지 않습니다.

## 통과가 아닌 결과

| 결과 | 뜻 | 종료코드 1? |
|---|---|---|
| `FAIL` | 검사가 아니라고 함 | 예 |
| `UNPROVEN` | adversarial인데 이 바이트에 대한 리뷰어 답이 없음 | 아니오 |
| `UNCHECKED` | 기준에 검사가 아예 없음 | 아니오 |

`UNPROVEN`도 `UNCHECKED`도 위반이 아니고, 통과도 아닙니다. 있는 그대로 보고하십시오. 검사 없는 기준은 보이는 것이지 검증된 게 아닙니다.

## adversarial 검사에 답하기

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" record-verdict --file verdict.json
```

```json
{
  "standard": "no-hype",
  "ask": "과장 없이 읽히는가?",
  "target_sha256": "d0281896…",
  "verdict": "pass",
  "reviewer": "codex",
  "note": "선택"
}
```

`reviewer`가 그 기준의 `participants`에 올라 있으면 판정 자체를 거부합니다. 갈림길을 정하는 데 관여한 쪽은 그 기준이 다스리는 작업을 통과시키지 못합니다.

`target_sha256`은 `standard-check`이 찍어 준 해시입니다. 산출물을 고치면 그에 달린 판정은 `UNPROVEN`으로 돌아갑니다. 지난주 초안을 본 리뷰는 이번 초안에 대해 아무 말도 하지 않았으니까요. 판정은 `.scc/checks/adversarial.jsonl`에 덧붙고, 이 명령이 아니라 coach 러너로 받습니다. 채점하는 도구가 합격 도장까지 찍는 일은 없어야 합니다.

## 지켜야 할 것

- **검사는 코드가 아니라 데이터입니다.** 기준 문서는 저장소를 타고 퍼집니다. `run:`, `command:`, `shell:` 필드는 오류로 거부하고, 목록에 없는 검사기 id와 모르는 필드도 마찬가지입니다. 조용히 건너뛰면 작성자는 검사가 걸린 줄 알게 됩니다.
- **검사기는 "아니오"를 말할 수 있어야 합니다.** 검사기마다 반드시 실패해야 하는 픽스처가 `tests/fixtures/standard-checks/<검사기>/`에 있습니다. 자기 픽스처를 통과시키기 시작하면 스위트가 깨집니다. 픽스처를 이 저장소에 두는 건 프로젝트가 대는 픽스처도 신뢰 경계를 넘는 입력이기 때문입니다.
- **충돌은 보고하지 해소하지 않습니다.** 동시에 만족될 수 없는 두 기준은 실패 두 건을 냅니다. 어느 쪽을 폐기할지는 사람의 결정입니다.
- **자기 작업을 자기가 채점하지 않습니다.** 검사 대상이 이번 세션에서 직접 만든 산출물이면, 결과를 보고할 때 그 사실을 함께 말하십시오.

## 검사기 추가

`scripts/lib/standard-checkers.mjs`에 추가하고, 반드시 실패하는 픽스처 디렉터리를 함께 넣습니다. 프로젝트가 자기 검사기 코드를 실행시키는 경로는 없고, 그게 핵심입니다.

## 연동

- [Coach](coach.ko.md) — 여기서 돌리는 기준을 쓰는 쪽

# Deep Interview 스킬

Deep Interview는 모호한 아이디어를 승인 대기 명세로 바꾸는 요구사항 워크플로입니다. 구현 워크플로가 아닙니다. 먼저 범위 토폴로지를 확정하고, 라운드마다 하나의 소크라테스식 질문만 던지고, 답변마다 모호도 점수를 공개한 뒤 승인 대기 명세에서 멈춥니다.

## 빠른 예시

```bash
/scc:deep-interview "이 플러그인을 개선하고 싶은데 무엇이 중요한지 확실하지 않다"

node scripts/deep-interview-runner.mjs start --idea "Improve this plugin" --json
node scripts/deep-interview-runner.mjs answer --answer "The topology looks right" --json
node scripts/deep-interview-runner.mjs status --json
node scripts/deep-interview-runner.mjs finalize --slug scc-deep-interview-v1 --json
```

**동작 흐름:** 러너가 모호도 임계치를 해석하고, 재개 가능한 인터뷰 상태를 만들고, Round 0 토폴로지를 잠근 뒤, 답변을 점수화합니다. 마지막에는 `.gjc/specs/deep-interview-{slug}.md` 명세를 쓰고 승인 옵션을 반환합니다. 인터뷰 런타임은 ralplan, ultragoal, team, 커밋, 포매터, 소스 변경을 실행하지 않습니다.

## 언제 쓰나

`/scc:deep-interview`는 다음 상황에 씁니다.

- 사용자의 아이디어가 모호하고 실행 전에 숨은 가정을 드러내야 할 때
- 독립적으로 성공/실패할 수 있는 여러 컴포넌트가 있고 토폴로지가 불안정할 때
- 기존 코드베이스 변경 전에 저장소 근거를 모아 질문해야 할 때
- 결과물을 명시 승인 후 ralplan 합의, ultragoal, 또는 team으로 넘겨야 할 때

요청이 이미 파일, 심볼, 수용 기준, 승인된 계획을 포함한다면 직접 실행 워크플로를 쓰는 편이 낫습니다.

## 런타임 흐름

1. 프로젝트 설정, 사용자 설정, 기본값 `0.05` 순서로 `gjc.deepInterview.ambiguityThreshold`를 해석합니다.
2. brownfield/greenfield를 구분하고 코드베이스 질문 전에 저장소 사실을 수집합니다.
3. Round 0 토폴로지 확인으로 최상위 컴포넌트를 잠급니다.
4. 라운드마다 가장 약한 활성 컴포넌트와 명확성 차원에 질문을 집중합니다.
5. greenfield 또는 brownfield 가중 공식으로 모호도를 계산합니다.
6. 질문, 옵션, 보고서, 명세에서 세션 언어를 보존합니다.
7. 최종 명세를 `.gjc/specs/deep-interview-{slug}.md`에 저장합니다.
8. 승인 대기 옵션에서 멈추며, 인터뷰가 ralplan, ultragoal, team을 실행하지 않습니다.

## 점수 모델

| 프로젝트 유형 | 목표 | 제약 | 성공 기준 | brownfield 맥락 |
|---|---:|---:|---:|---:|
| Greenfield | 40% | 30% | 30% | - |
| Brownfield | 35% | 25% | 25% | 15% |

모호도는 `1 - weighted_clarity`입니다. 기본 임계치는 `0.05`지만 설정으로 바꿀 수 있습니다. 여러 컴포넌트가 있으면 가장 약한 컴포넌트/차원 쌍을 고르고, 동점인 약한 컴포넌트 사이를 회전해 한 컴포넌트의 상세함이 형제 컴포넌트의 불명확함을 가리지 못하게 합니다.

## 상태와 산출물

- 런타임 상태: 기존 상태 매니저를 통한 `${CLAUDE_PLUGIN_DATA}/deep-interview-active.json`
- 최종 명세: `.gjc/specs/deep-interview-{slug}.md`
- 내부 프래그먼트: `skills/deep-interview/references/fragments/auto-research-greenfield.md`, `auto-answer-uncertain.md`
- 계약 테스트: `tests/runtime/deep-interview-runner.test.mjs`, `tests/contracts/deep-interview-contracts.test.mjs`

## 안전 게이트

- 점수화 라운드 전에 Round 0 토폴로지를 반드시 완료합니다.
- 여러 컴포넌트가 있으면 가장 자세한 컴포넌트에 과적합하지 않고 약한 형제 컴포넌트로 회전합니다.
- auto-mode 프래그먼트는 내부 `kind: skill-fragment` 프롬프트일 뿐이며 공개 커맨드나 `skill://` 라우트가 아닙니다.
- auto-mode 응답은 정확한 형태, 비어 있지 않은 rationale/fallback 필드, `low|medium|high` confidence를 검증해야 합니다.
- 잘못된 auto-mode 출력은 안전하게 수동 인터뷰로 돌아가고 진단 실패 카운트를 남겨야 합니다.
- 최종 출력은 승인 대기 명세이지 실행이 아닙니다.

## 참조 문서

- [Protocol](../../skills/deep-interview/references/protocol.md)
- [Scoring](../../skills/deep-interview/references/scoring.md)
- [Fixtures](../../skills/deep-interview/references/fixtures.md)
- [Troubleshooting](../../skills/deep-interview/references/troubleshooting.md)
- [Example transcript](../../skills/deep-interview/references/example-transcript.md)
- [Acceptance checklist](../../skills/deep-interview/references/acceptance-checklist.md)
- [Gotchas](../../skills/deep-interview/gotchas.md)

## 문제 해결

| 증상 | 조치 |
|---|---|
| 저장소에서 알 수 있는 사실을 사용자에게 다시 묻는다 | 먼저 brownfield 맥락을 수집하고 다음 질문에 파일 경로나 심볼 근거를 인용합니다. |
| 모호도가 떨어지지 않는다 | 가장 약한 컴포넌트/차원 쌍을 겨냥하고 핵심 명사가 흔들리면 ontology 질문으로 전환합니다. |
| 세션 언어가 갑자기 영어로 바뀐다 | 상태의 `language.instruction`을 보존하고 질문, 명세, 옵션 렌더링에 전달합니다. |
| auto-mode 응답이 그럴듯하지만 형태가 틀렸다 | 검증기로 거부하고 `architect_failures`를 기록한 뒤 수동 인터뷰 경로를 계속합니다. |
| 사용자가 바로 구현하자고 한다 | 명세를 저장하고 모호도가 높으면 위험을 보여준 뒤 명시적 실행 승인을 요구합니다. |

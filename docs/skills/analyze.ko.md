[English](analyze.md) | **한국어**

# Analyze

> 분석하고 기획하는 손. 프레임워크로 구조를 잡고, 근거로 벤치마크한 뒤 약한 지점을 공격합니다.

## 언제 쓰나

전략, 우선순위, 포지셔닝, 제품 기획처럼 이름 있는 프레임워크가 도움이
되는 요청에 씁니다. 이후 `write`나 `workflow` 단계가 읽을 구조화된 산출물이
필요할 때도 유용합니다.

## 빠른 예시

```text
/scc:analyze --framework swot --depth standard "우리 온보딩 퍼널"
```

선택한 프레임워크를 불러오고 근거를 수집하거나 읽은 뒤, 전략가가 적용하고,
선택한 깊이에 맞춰 취약점을 반박합니다. 마지막으로 균형 잡힌 인사이트와
권고 사항을 종합합니다. 예시 주제는 설명용이며 결론과 인용은 실제 소스에서
나옵니다.

## 프레임워크와 깊이

지원 프레임워크(15종): `swot`, `rice`, `okr`, `prd`, `lean-canvas`,
`persona`, `journey-map`, `pricing`, `gtm`, `north-star`, `porter`, `pestle`,
`ansoff`, `battlecard`, `value-prop`.

| `--depth` | 계약 |
|---|---|
| `quick` | 템플릿만 적용합니다. 리서치와 반박 라운드는 없습니다. |
| `standard` (기본) | 근거 요건을 적용하고 반박 1라운드를 실행합니다. |
| `thorough` | 전체 리서치, 반박 2라운드, 출처 품질 재검사를 실행하며, 가능하면 `mmbridge` 토론도 추가합니다. |

`--framework`가 없으면 명시적 프레임워크, 의도 키워드 순서로 판별합니다.
여러 개가 맞으면 질문하고, 아무것도 맞지 않으면 SWOT을 사용한다고 밝힙니다.

## 옵션

| 플래그 | 값 | 기본값 |
|---|---|---|
| `--framework` | 위 목록 | 자동 판별 |
| `--with-research` | flag | off |
| `--depth` | `quick\|standard\|thorough` | `standard` |
| `--skip-challenge` | flag | off |
| `--lang` | `ko\|en` | `ko` |

`--with-research`는 리서치 단계를 명시적으로 추가합니다. `thorough`에서는
깊이 계약에 포함됩니다. `--skip-challenge`는 기본 반박을 끄는 명시적 재정의입니다.

## 근거와 출력

경쟁사·제품·외부 대상을 다룰 때는 실제 소스를 읽고, 섹션/사분면마다 구체적
데이터를 최소 3개 사용하며, 외부 주장을 인라인 인용합니다. 인용할 수 없는
주장은 `[unverified]`로 표시하고 사실과 추론을 구분합니다. 저장 경로는
`.captures/analyze-{framework}-{slug}-{YYYY-MM-DD}.md`입니다.

```markdown
# {Framework} Analysis: {topic}
## Analysis
## Challenge
## Balanced Insight
## Recommended Actions
```

반박 결과는 최종 종합에 반드시 남깁니다. 근거가 고르지 않다면 섹션별 깊이가
달라도 되며, 빈 내용을 채우지 않습니다.

## 연동

| 스킬 | 관계 |
|---|---|
| `research` | 요청했거나 `thorough`에서 필요한 근거를 제공합니다. |
| `review` | 추가 검증 패스를 제공합니다. |
| `workflow` | 파일을 전달하는 순차 단계로 실행합니다. |
| `write` | 분석 산출물을 리포트나 아티클로 발전시킵니다. |

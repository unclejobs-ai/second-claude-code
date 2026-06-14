# 릴리스 v1.5.2

v1.5.2는 Deep Interview를 18번째 공개 명령어/스킬로 추가하고, `domain=code` PDCA 실행을 위한 코드 엔지니어링 레인을 도입합니다. Second Claude의 Plan -> Do -> Check -> Act 구조는 그대로 유지하면서, 실행 전에는 요구사항을 더 선명하게 만들고 실행 중에는 계획, 구현 격리, 독립 검증, 정리, 지속 가능한 핸드오프 상태를 더 엄격하게 요구합니다.

## 추가

- **Deep Interview** — `/second-claude-code:deep-interview`, `skills/deep-interview/`, `scripts/deep-interview-runner.mjs`가 Round 0 topology 확인, 모호성 점수, ontology 수렴, 언어 보존 명세, 내부 auto-mode fragment, 승인 게이트 핸드오프를 갖춘 소크라테스식 요구사항 인터뷰를 제공합니다.
- **코드 엔지니어링 레인** — `skills/pdca/references/code-engineering-lane.md`가 코드 작업 전용 계약을 정의합니다.
- **새 런타임이 아닌 규율 흡수** — `engineering-discipline`과 `Hyper-Waterfall`에서 가져올 만한 worker-validator 분리, stage report, human approval gate, issue/branch/session 연속성, PR 또는 local handoff, clean-ai-slop, Rob Pike식 성능 측정을 PDCA 안에 흡수했습니다.
- **stage report 템플릿** — 장기 또는 다단계 코드 작업은 목표, 변경 표면, 검증, 실패, 다음 결정을 남기는 구체적인 보고 형식을 갖습니다.

## 변경

- **code stage contract 강화** — `config/stage-contracts.json`이 실행 가능한 수용 기준, 롤백 경로, 승인 상태, 브랜치/워크트리 격리 또는 직접 수정 사유, validator/reviewer 증거, 정리/단순화, 최종 핸드오프 상태를 요구합니다.
- **PDCA 스킬 계약** — `skills/pdca/SKILL.md`가 코드 작업 계획 전에 코드 엔지니어링 레인을 로드하도록 명시했습니다.
- **공개 문서 정렬** — README, 한국어 README, 아키텍처 문서, Deep Interview 가이드, PDCA 스킬 가이드가 18-skill surface를 일관되게 설명합니다.
- **릴리스 메타데이터 정렬** — package metadata, plugin manifest, marketplace metadata, badge가 v1.5.2로 맞춰졌습니다.

## 검증

- `npm run test` — 427개 테스트, 426개 통과, 0개 실패, 1개 스킵
- `node --test tests/contracts/skill-contracts.test.mjs`
- `node --check tests/contracts/skill-contracts.test.mjs`
- `node --check hooks/*.mjs mcp/*.mjs daemon/*.mjs`
- `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"`
- `node -e "JSON.parse(require('fs').readFileSync('config/stage-contracts.json','utf8'))"`
- 에이전트 frontmatter 및 스킬 `SKILL.md` 확인

Breaking change는 없습니다. v1.5.1 배포본은 그대로 업그레이드됩니다.

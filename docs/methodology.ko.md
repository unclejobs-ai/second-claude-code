[English](methodology.md) | **한국어**

# 방법론

## 1. 궤적 (Trajectory)

DSH(DeepSeek Harness)는 호스트 루프를 소유합니다. 세션은 추가 전용(append-only) 이벤트 로그이고, Web **轨迹**(Trajectory) 탭은 그 로그에서 모델 맥락을 다시 도출합니다 — 사용자, 어시스턴트, 도구, 중첩 서브툴, 압축, 턴 경계, 토큰, TTFT. 그건 하네스 기능입니다. SCC는 할 수 없습니다.

SCC는 Claude Code 플러그인입니다. 호스트 루프는 Claude Code가 소유합니다. SCC는 두 번째 런타임을 내장해서는 안 되고, 모델 대화를 재구성해서는 안 되며, DSH의 轨迹 탭을 베껴서는 안 됩니다.

가져올 것은 이것뿐입니다. PDCA 게이트, Check 리뷰, Action Router 결정은 추가 전용 이벤트에서 재구성합니다. 뷰어 HTML과 마크다운은 그 로그의 **투영**이지, 두 번째 원본이 아닙니다.

SCC 궤적 = `.data/events`와 `.data/cycles`에서 **한 번의** PDCA 또는 workflow 런을 재구성하는 것입니다. 그 로그를 쓰는 쪽은 PDCA입니다. 저장된 `/scc:workflow`는 그 런이 이벤트와 사이클 스냅샷을 남긴 경우에만 범위에 들어갑니다. 두 번째 세션 전사(transcript)로 취급하지 않습니다.

| 출처 | 재구성하는 것 |
|------|----------------|
| `.data/events/pdca-{run_id}.jsonl` | `cycle_start` / `cycle_end`, `phase_start` / `phase_end`, `gate_check` / `gate_pass` / `gate_fail`, `review_started` / `review_completed`, `artifact_created`, `stuck_detected`, `error` |
| `.data/cycles/cycle-NNN/{phase}.md` | 페이즈 아티팩트, `metrics.json`, 사이클별 `events.jsonl` |
| `state.action_router_history` | Act가 작업을 되돌린 이유. 이 필드가 생기기 전 런은 이후 사이클 번호로 재진입만 추론하고 사유는 없습니다 |

`scripts/viewer-session.mjs`(라이브 UI)와 `scripts/export-artifact.mjs`(공유 페이지)는 로그를 투영합니다. 로그 자체가 되지 않습니다.

## 2. 아티팩트 HTML

공유 산출물은 파일 한 장입니다. Claude Code Artifact HTML 페이지는 자기완결이어야 합니다. CSS와 JS는 인라인, 이미지는 data URI 또는 SVG, `fetch` 없음, WebSocket 없음, Nivo·Shiki CDN 없음, 크기는 16MB를 충분히 밑돌아야 합니다. [ClawEnable/html-artifact-best-practices](https://github.com/ClawEnable/html-artifact-best-practices)를 따릅니다(바닐라 HTML, 프레임워크 없음, 빌드 체인 없음). mermaid를 그대로 렌더하는 호스트(GitHub, Notion, Artifact 마크다운 렌더러)를 위해 마크다운 내보내기가 기본값입니다.

```bash
# 기본값 — mermaid 펜스, 번들 없음
node "${CLAUDE_PLUGIN_ROOT}/scripts/export-artifact.mjs" --out pdca-export.md
/scc:viewer --export

# Claude Code Artifact HTML
node "${CLAUDE_PLUGIN_ROOT}/scripts/export-artifact.mjs" --format html --out pdca-export.html
```

Vite 뷰어(`ui/`: React, Nivo, Shiki; `ui/scripts/server.cjs`; WebSocket; 포트 3847; 30분 유휴 종료)는 **로컬 라이브 투영**입니다. 공유 아티팩트가 아닙니다.

- 실행 중인 서버와 `ui/dist`가 필요합니다. 프로세스가 끝나면 `localhost` URL은 죽습니다.
- 차트와 하이라이팅은 인라인 SVG·CSS가 아니라 Nivo와 Shiki를 로드합니다.
- 읽는 레이아웃은 `{session}/state.json` + `artifacts/*.json`인데, PDCA는 여기에 쓰지 않습니다. `viewer-session.mjs`가 `.data`를 먼저 투영해야 하고, 건너뛰면 빈 화면입니다.
- Vite/React 번들은 Claude Code Artifact로 발행할 수 없습니다(CSP, 네트워크, 크기).

이벤트 로그에서 내보냅니다. `ui/dist`를 압축해 아티팩트라고 부르지 않습니다.

## 3. 동반 플러그인

선택입니다. SCC에 포함되지 않으며 `/scc:coach`를 대체하면 안 됩니다. 결정의 주인은 `.scc/standards/<id>/STANDARD.md`입니다. SCC 의존성으로 넣지 않습니다.

| 플러그인 | `/scc:coach`와의 관계 | 쓸 때 | 설치 | 설치하지 말 때 |
|----------|----------------------|--------|------|----------------|
| [design-crit](https://github.com/metedata/design-crit) | HTML 와이어프레임, 패싯마다 Keep/Cut. `.design-crit/`에 기록 | 코드 전 시각·구조 방향 | `claude plugin marketplace add metedata/design-crit` 후 `claude plugin install design-crit@metedata-design-tools` | `.design-crit/decisions.md`나 `state.json`을 프로젝트 원장으로 삼을 때 |
| [design-with-ai](https://github.com/amanmaqsood/design-with-ai) | 구현 전 방향·크리틱(`/design-with-ai:design-with-ai`). 선택적 aesthetic 빌드 | 인터페이스 방향, 그다음 코드 | `claude plugin marketplace add amanmaqsood/design-with-ai && claude plugin install design-with-ai@amanmaqsood-design` | `.scc/standards`에 둘 갈림길을 여기서 확정할 때 |
| [knowledge-work design](https://github.com/anthropics/knowledge-work-plugins) | 크리틱, 접근성, UX 카피, 핸드오프(`/critique`, `/accessibility`, …) | 화면·시스템 디자인 리뷰 | `claude plugins add knowledge-work-plugins/design` | 두 번째 기준 저장소가 될 때 |
| [architect](https://github.com/alexei-led/architect) | 읽기 전용 결합도 리뷰(Balanced Coupling). 리뷰 중 프로덕션 코드를 고치지 않음 | 아키텍처 근거, 경계, fitness 검사 | `claude plugin marketplace add alexei-led/architect` 후 `claude plugin install architecture@alexei-led-architect` | 제품 결정을 여기에 기록해야 할 때(그래서는 안 됨) |

**설치하지 말 때:** 결정 원장이 둘이면 안 됩니다. Coach는 확정된 갈림길마다 기준 문서를 남깁니다. design-crit는 `state.json`과 `decisions.md`를 유지합니다. 원장이 둘이면 다음 세션에서 어긋납니다. architect는 읽기 전용입니다. 그대로 두십시오. 동반 플러그인 파일이 "우리가 정한 것"이 될 것 같으면 설치를 건너뛰고 `/scc:coach`에 남습니다.

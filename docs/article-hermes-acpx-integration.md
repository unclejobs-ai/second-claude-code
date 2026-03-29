# Hermes 위에 acpx를 얹으면 뭐가 되는가

AI 코딩 에이전트를 진짜 팀처럼 쓰는 법 — 실전 도입기

---

## 1/12 — 문제: 에이전트가 하나뿐이다

2026년 지금, 코딩 에이전트는 넘친다.
Codex CLI, Claude Code, Gemini CLI, OpenCode...

문제는 이것들을 "한 번에 하나씩" 쓴다는 거다.

구현 시키고 → 끝나면 → 리뷰 시키고 → 끝나면 → 문서 정리.
사람이 하던 순차 작업을 AI로 바꿨을 뿐, 구조는 똑같다.

---

## 2/12 — 발견: acpx라는 물건

acpx(Agent Client Protocol eXecutor)는
여러 코딩 에이전트 CLI를 하나의 인터페이스로 묶는 멀티플렉서다.

핵심: 모델이 아니라 **런타임**을 묶는다.

- Codex CLI → ACP 세션으로
- Claude Code → ACP 세션으로
- Gemini CLI → ACP 세션으로

각각 독립 프로세스. 동시에 뜬다. 서로 모른다.

---

## 3/12 — 이걸 Hermes 위에 얹었다

Hermes Agent는 내 개인 AI 오퍼레이터다.
터미널, 파일, 브라우저, 메모리, 크론, 스킬 — 전부 있다.
없는 게 하나 있었다: **외부 코딩 에이전트를 여러 개 동시에 돌리는 능력**.

그래서 이렇게 붙였다:

```
Hermes (오케스트레이터)
  │
  ├─ acpx codex exec   → 구현 (쓰기)
  ├─ acpx claude exec  → 리뷰 (읽기)
  ├─ acpx gemini exec  → 문서/리스크 (읽기)
  │
  └─ mmbridge review   → 품질 게이트 (평가)
```

Hermes가 4개를 동시에 띄우고, 결과를 모아서, 다음 행동을 결정한다.

---

## 4/12 — 역할 분리가 핵심이다

"3개를 동시에 돌린다"가 포인트가 아니다.
**누가 쓰고 누가 읽는지**를 잘라야 한다.

| 역할 | 에이전트 | 권한 | 하는 일 |
|------|---------|------|--------|
| impl | Codex | 쓰기 허용 | 코드 작성, 테스트, 커밋 |
| review | Claude | 읽기만 | 버그 찾기, P0/P1/P2 분류 |
| docs | Gemini | 읽기만 | 변경 요약, 엣지케이스, 마이그레이션 리스크 |
| gate | mmbridge | 읽기만 | 품질 점수, 통과/차단 판정 |

**쓰기 권한은 무조건 하나.** 이거 안 지키면 merge conflict 지옥.

---

## 5/12 — 실전 결과: companion-daemon에 /healthz 추가

실제로 돌린 태스크: Second Claude Code 플러그인의 daemon에 헬스체크 엔드포인트 추가.

3개를 동시에 쐈다.

**Codex (구현):**
- daemon/companion-daemon.mjs에 /healthz 추가 (+82줄)
- 테스트 파일 수정
- test-fix 루프 돌다가 180초 timeout (실전에선 600초 필요)

**Claude (리뷰):**
- P0 2개 발견: status health check 우회 가능, CLI/MCP 데이터 디렉토리 분리 문제
- P1 3개: JSONL 데이터 유실 가능성, race condition, 불변 필드 미보호
- P2 5개: ID 충돌, unbounded growth, MCP surface 누락
- 전부 file:line 인용 포함

**Gemini (문서):**
- daemon/ 전체 API 엔드포인트 정리
- 소켓 스테일링, 동시성 레이스, JSONL 손상, 검색 확장성 이슈
- file:line 레퍼런스 포함

사람이 했으면 반나절. 3개 동시에 10분.

---

## 6/12 — Hermes가 정확히 뭘 하는가

Hermes는 acpx를 "그냥 터미널 명령"으로 실행한다.

```
terminal(command="npx acpx --approve-all codex exec '구현해'", background=true)
terminal(command="npx acpx --approve-reads claude exec '리뷰해'", background=true)
terminal(command="npx acpx --agent 'gemini --acp' exec '정리해'", background=true)
```

3개 다 background로 띄우고, process(wait)로 기다리고, process(log)로 결과 읽는다.

특별한 통합 레이어 없다. Hermes의 기존 terminal/process 도구만 쓴다.
이게 가장 실용적인 이유: **새로운 의존성이 0이다.**

---

## 7/12 — mmbridge는 왜 필요한가

acpx는 "누가 뭘 하느냐"를 관리한다.
mmbridge는 "그 결과가 괜찮으냐"를 판정한다.

```
구현 완료 → mmbridge review --json --base-ref HEAD~1
         → overallScore, findings[], nextCommand 출력
         → P0 있으면 → 다시 codex한테 보냄
         → 클린이면 → 다음 태스크
```

이 둘은 대체 관계가 아니다:
- acpx = 코딩 에이전트 멀티플렉서
- mmbridge = 품질 게이트 파이프라인

합치면: **구현도 병렬, 평가도 자동.**

---

## 8/12 — 삽질 기록: 이거 안 하면 안 됨

실전 도입하면서 발견한 것들.

**1. Gemini는 --agent "gemini --acp" 필수**
acpx 0.1.15는 `gemini`만 spawn하는데, Gemini CLI 0.35.2는 `--acp` 플래그 없으면 ACP 모드 진입 안 함.
MCP 서버(pencil, agentation) 로딩하다가 영원히 hang.
해결: `npx acpx --agent "gemini --acp" --approve-reads exec "프롬프트"`

**2. Codex는 매번 superpowers 스킬을 읽는다**
exec 할 때마다 ~/.codex/superpowers/의 SKILL.md를 전부 읽음. 20-30초 오버헤드.
timeout=180으로는 구현 태스크 못 끝냄. 최소 600초.

**3. --format은 글로벌 플래그다**
`npx acpx codex exec --format json` → 에러.
`npx acpx --format json codex exec` → 정상.

**4. process(wait)는 60초 clamp**
Hermes 게이트웨이가 wait을 60초로 자름. 루프 돌려야 함.

**5. --approve-all 주면 Codex가 커밋까지 함**
impl에 --approve-all 줬더니 알아서 git commit. 편하지만 위험.
worktree 분리하거나, 커밋 메시지 규칙을 프롬프트에 넣어야 함.

---

## 9/12 — 만든 것 목록

**Hermes 스킬 2개:**
- `acpx` — 멀티 에이전트 팬아웃 운영 매뉴얼 (pitfalls 13개 포함)
- `mmbridge` — 품질 게이트 파이프라인 운영 매뉴얼

**Second Claude Code 저장소에 추가된 것:**
- 계약 문서: `docs/superpowers/specs/acpx-fanout-contract.md`
- 운영 문서: `references/hermes/OPERATIONS.md`, `PROMPTS.md`
- 실행 스크립트: `scripts/acpx-runner.mjs`, `acpx-fanout.mjs`, `acpx-render-summary.mjs`
- 설치 가능한 Hermes skillpack 3개
- 테스트 4개 + fixture 1개

**총 파일 21개, 테스트 320개 전부 통과.**

---

## 10/12 — Before / After

**Before:**
```
나 → Hermes → codex 하나 실행 → 끝나면 결과 읽기 → mmbridge review 따로 실행
순차. 한 번에 하나. 30분.
```

**After:**
```
나 → Hermes → 동시에:
  codex (구현) + claude (리뷰) + gemini (문서) + mmbridge (게이트)
→ 전부 끝나면 Hermes가 종합
→ P0 있으면 자동 재실행
→ 클린이면 다음 태스크
병렬. 10분. 리뷰 자동.
```

---

## 11/12 — 이걸 왜 "도입"이라고 부르는가

npm install 하나 안 했다. Hermes 코어에 코드 한 줄 안 넣었다.

한 건 이거다:
1. acpx CLI가 뭔지 파악 (help, config, 소스코드까지)
2. 실제로 smoke test (단일 → 병렬 → 3-agent 팬아웃)
3. 실전에서 터진 문제 전부 기록 (gemini --acp, timeout, global flags...)
4. Hermes 스킬로 운영 지식 고정 (다음에 "팬아웃 돌려" 하면 바로 실행)
5. 프로젝트 계약 문서로 경계 고정 (누가 쓰고 누가 읽는지)

"도입"은 설치가 아니라 **운영 가능한 상태로 만드는 것**이다.

---

## 12/12 — 아키텍처 한 장

```
┌──────────────────────────────────────────────┐
│                   너 (사람)                    │
│              "이거 구현하고 리뷰해"              │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│              Hermes Agent                     │
│         (오케스트레이터 + 메모리 + 스킬)         │
│                                               │
│  acpx 스킬 로드 → 팬아웃 실행 → 결과 수집      │
└──┬───────────┬───────────┬───────────┬───────┘
   │           │           │           │
   ▼           ▼           ▼           ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐
│Codex │  │Claude│  │Gemini│  │ mmbridge  │
│ impl │  │review│  │ docs │  │   gate    │
│ 쓰기 │  │ 읽기 │  │ 읽기 │  │   평가    │
└──┬───┘  └──┬───┘  └──┬───┘  └────┬─────┘
   │         │         │           │
   ▼         ▼         ▼           ▼
┌──────────────────────────────────────────────┐
│              결과 종합 (Hermes)                │
│                                               │
│  P0/P1 발견 → codex에 재실행                   │
│  클린 → 다음 태스크 진행                        │
│  모든 발견사항 → 메모리에 저장                   │
└──────────────────────────────────────────────┘
```

핵심 원칙:
- 쓰기는 하나만 (single writer)
- 자동 merge 없음 (Hermes가 판단)
- 새 의존성 없음 (terminal/process만 사용)
- 실패해도 안전 (각 에이전트 독립, 일부 실패 허용)

---

*도구를 여러 개 쓰는 게 아니라, 역할을 나누는 거다.
구현하는 놈, 검증하는 놈, 정리하는 놈, 판정하는 놈.
그 위에 한 명이 앉아서 전체를 본다. 그게 Hermes고, 그게 너다.*

# Unblock

> WebFetch가 못 푸는 URL에 대해 검증된 본문을 돌려주는 9-phase 적응 fetch 체인 — 안 되면 구조화된 실패 trace. API 키 0개.

## 빠른 예시

```
이 LinkedIn 글이 안 열려: https://www.linkedin.com/pulse/abc-xyz
```

**동작:** URL을 9개 phase로 단계별 시도, 4-layer validator를 통과하는 첫 probe에서 멈춥니다. LinkedIn 류 로그인 월에는 Phase 5 아카이브 클러스터(Wayback / archive.today / OG-rescue)가 보통 이깁니다. YouTube URL이라면 Phase 0c yt-dlp가 페이지를 한 번도 로드하지 않고 제목 + 설명 + 자막을 돌려줍니다.

## 실전 예시

**입력:**
```
/second-claude-code:unblock "https://news.ycombinator.com/item?id=42000000"
```

**처리:**
1. URL host 패턴이 `hn-item`에 매치 → Phase 0a가 `hn.algolia.com/api/v1/items/42000000` 호출
2. JSON 정상 파싱, 본문 검증 통과, 제목 추출
3. ~300ms 만에 Phase 0a에서 종료, 마크다운 형태로 전체 스레드 + 댓글 반환

**출력:**
```json
{
  "schema_version": 1,
  "ok": true,
  "url": "https://news.ycombinator.com/item?id=42000000",
  "phase": "0a",
  "probe": "public-api/hn-item",
  "elapsed_ms": 317,
  "title": "...",
  "content": "# ...\n\n## Comments\n- ...",
  "meta": { "author": "...", "points": 142 },
  "trace": [...],
  "decisions": [...],
  "idempotency_key": "t8fniy"
}
```

## 언제 쓰나

- Eevee 리서처가 `/second-claude-code:research` 도중 403 / blocked를 만났을 때
- 막힌 사이트 본문 직접 가져와야 할 때 (X, LinkedIn, Naver, Coupang, fmkorea 등)
- WebFetch가 JS 무거운 SPA에서 빈 본문 / 잘린 본문 반환할 때
- 파이프라인 단계가 페이지 본문 보장을 요구할 때

키워드 검색만 필요하면 그냥 `s.jina.ai` 쓰세요.

## Phase 구성

| Phase | Probe | 비용 | 키 없이 작동? |
|-------|-------|------|----------------|
| 0a | 공개 API (Reddit / HN / arXiv / Bluesky / GitHub / NPM / Stack Exchange / Wikipedia / Mastodon / Lemmy / oEmbed) | 무료 | yes |
| 0b | Jina Reader (`r.jina.ai`) | 20 RPM 무료 | yes |
| 0c | yt-dlp 메타 + 자막 (1800+ 미디어 사이트) | 무료 | yes (자동 설치) |
| 0d | Jina Search 키워드 라우팅 | 20 RPM 무료 | yes (키워드 입력) |
| 1 | curl UA × 헤더 × URL 변형 회전 | 무료 | yes |
| 2 | curl-impersonate TLS 회전 + 쿠키 웜업 + 리퍼러 체인 | 무료 | yes (자동 설치) |
| 3 | LightPanda 헤드리스 | 무료 | yes (자동 설치) |
| 4 | Playwright 실제 Chrome + 숨겨진 API 발견 | 무료 | yes (자동 설치) |
| 5 | 무료 아카이브: Wayback + archive.today + AMP + RSS + OG rescue | 무료 | yes |
| 6 | 옵션 유료 (Tavily / Exa / Firecrawl) — `--allow-paid` 필수 | 유료 | 플래그 필요 |

체인은 `validate.mjs` 통과하는 첫 probe에서 종료. Phase 6은 명시 플래그 없으면 절대 실행 안 됨.

## 옵션

| 플래그 | 효과 |
|--------|------|
| `--json` | JSON 출력 |
| `--trace` | per-phase trace + 오케스트레이션 decisions 포함 |
| `--max-phase <N>` | phase N에서 cap (기본 5) |
| `--allow-paid` | Phase 6 유료 provider 허용 |
| `--device desktop\|mobile` | Phase 4 디바이스 에뮬레이션 힌트 |
| `--selector "<css>"` | Phase 4 wait-for selector |
| `--follow` | 키워드 입력 시 top 결과 URL도 fetch |
| `--user-hint key=value` | 호출별 사이트 힌트 (반복 가능) |

## Eevee 리서처 통합

다음 조건에서 Unblock이 자동 호출됩니다:
- HTTP 4xx / 5xx
- 마크업 제거 후 200자 미만 본문
- 알려진 challenge 시그니처(Cloudflare, captcha, WAF)
- 콘텐츠 타입 불일치

호출 시퀀스 상세는 `skills/unblock/references/eevee-flow.md`.

## 오케스트레이션

체인은 단순 선형 escalation을 넘어서:

- **URL host priors**: 동영상 호스트는 `["0c","0a","0b"]`, 알려진 공개 API 호스트는 `["0a","0b","0c"]`로 Phase 0 재정렬.
- **시그널 기반 동적 skip**: Phase 1이 200을 반환했지만 `stripped_too_short`이면 SPA로 판단, Phase 2/3 건너뛰고 Phase 4 직행.
- **Stagnation 감지**: 같은 fail reason이 3개 phase 이상 반복되면 live chain 단축, Phase 5 archive 직행.
- **Phase 2 TLS 다중 회전**: 쿠키 jar이 chrome131 → safari17_0 → firefox133 시도 사이를 carry.
- **Phase 4 숨겨진 API 발견**: 렌더된 HTML이 validation 실패해도 same-origin XHR 응답(structured content-type)을 `meta.discovered_apis`로 surface.

## Hard Rules

**R1** — `engine/**` 사이트명 하드코딩 금지 (Phase 0a 공개 API 허용 목록 제외). 사이트 힌트는 `--user-hint`로만.

**R2** — 선언 전에 검증. 모든 probe 결과는 4-layer validator(status, 본문 길이, challenge body, content-type) 통과 필수.

**R3** — Miss 시 자동 설치. 바이너리 누락 시 일회 설치 시도. 체인 차단 금지.

**R4** — 실패 시 trace 필수.

**R5** — Retry 전 trace 읽기. 동일 인자 재호출 금지.

**R6** — 유료는 opt-in. `--allow-paid` 없이 Phase 6 절대 실행 안 됨.

**R7** — 단일 사용자 CLI, 서비스 아님. SSRF 가드가 RFC1918 / loopback / link-local / cloud metadata 호스트 거부. opt-out: `UNBLOCK_ALLOW_PRIVATE_HOSTS=1`.

## 환경 변수

| 변수 | 효과 |
|------|------|
| `JINA_API_KEY` | Jina Reader 20 RPM cap 해제 |
| `TAVILY_API_KEY` / `EXA_API_KEY` / `FIRECRAWL_API_KEY` | `--allow-paid`와 함께만 Phase 6 활성 |
| `UNBLOCK_TIMEOUT_MS` | per-probe 타임아웃 (기본 15000) |
| `UNBLOCK_MAX_PHASE` | 체인 cap (기본 5) |
| `UNBLOCK_CACHE_DIR` | 쿠키 + 바이너리 캐시 (기본 `~/.cache/unblock`) |
| `UNBLOCK_ALLOW_PRIVATE_HOSTS` | `1` 설정 시 SSRF 가드 비활성 |

## 관련 스킬

- `research` — fetch한 소스가 차단 콘텐츠 반환하면 `unblock` 자동 호출
- `pdca` — Plan phase가 research → unblock fallback 자동 체인

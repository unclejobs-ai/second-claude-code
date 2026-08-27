[English](unblock.md) | **한국어**

# Unblock

> 차단되거나 JS가 많은 URL에서 읽을 수 있는 본문을 복구하고, 실패하면 검증된 trace를 반환합니다.

기본 phase는 API 키가 필요하지 않습니다(“zero-key”). 유료 provider는
`--allow-paid`를 넘길 때만 사용합니다. 일부 선택적 로컬 바이너리가 없으면
사용 가능한 패키지 매니저로 1회 설치를 best-effort로 시도할 수 있습니다.
이 설치는 네트워크·권한이 필요할 수 있고 성공을 보장하지 않습니다.

## 언제 쓰나

WebFetch가 4xx/5xx, 빈 본문, 잘린 본문, challenge 페이지, JS-heavy SPA를
반환할 때 `/scc:unblock <URL>`을 씁니다. 키워드 입력은 Jina Search로
라우팅됩니다. 검색 결과만 필요하면 Jina Search를 직접 사용하세요.

## 빠른 예시

```text
/scc:unblock "https://news.ycombinator.com/item?id=42000000" --json
```

호스트에 맞는 probe를 적응적으로 시도하고, status·본문 길이·challenge 본문·
content-type 검증을 모두 통과한 첫 결과에서 멈춥니다. 실패하면 trace를 읽고
인자를 바꾸세요. 같은 인자로 맹목 재시도하지 않습니다.

## Phase 구성

| Phase | Probe | 기본 키 동작 |
|---|---|---|
| `0a` | 알려진 서비스의 공개 API | 키 없음 |
| `0b` | Jina Reader (`r.jina.ai`) | 키 없음; 키를 넣으면 20 RPM 제한 완화 |
| `0c` | `yt-dlp` 메타데이터/자막 | 가능하면 없을 때 1회 설치 시도 |
| `0d` | Jina Search 키워드 라우팅 | 무료 경로는 키 없음 |
| `1` | `curl` 헤더·UA·URL 변형 | 키 없음 |
| `2` | curl-impersonate TLS·쿠키·리퍼러 변형 | 가능하면 없을 때 1회 설치 시도 |
| `3` | LightPanda 헤드리스 브라우저 | 가능하면 `npx` 1회 설치 시도 |
| `4` | Playwright Chrome + 숨은 API 발견 | 가능하면 `npx` 1회 설치 시도 |
| `5` | 무료 아카이브·AMP/RSS·OG rescue | 키 없음 |
| `6` | Tavily/Exa/Firecrawl | 유료; `--allow-paid`와 provider 키 필요 |

기본 `--max-phase`는 `5`이므로 Phase 6은 기본 실행에 포함되지 않습니다.

## 옵션

| 플래그 | 효과 |
|---|---|
| `--json` | 기계 판독용 JSON 출력 |
| `--trace` | phase별 trace와 오케스트레이션 decisions 포함 |
| `--max-phase <N>` | N phase에서 중지(기본 `5`) |
| `--allow-paid` | Phase 6 유료 provider 허용 |
| `--device desktop\|mobile` | Phase 4 디바이스 힌트 |
| `--selector "<css>"` | Phase 4 대기 selector |
| `--follow` | 키워드 입력 시 top 결과 URL도 fetch |
| `--user-hint key=value` | 호출별 사이트 힌트(반복 가능) |

성공하면 `content`와 메타데이터를 반환합니다. 실패하면 원인과 trace 끝부분을
반환합니다. `meta.partial: true`면 메타데이터만 복구됐다고 명시하고,
`meta.discovered_apis`가 있으면 캡처한 same-origin endpoint를 나열합니다.

## 안전과 연동

- 성공 선언 전에 모든 probe를 검증합니다.
- 유료 접근은 opt-in이며 `--allow-paid`를 조용히 추가하지 않습니다.
- 실패 시 trace를 남기고 재시도 전에 읽습니다.
- 단일 사용자 CLI라서 private·loopback·link-local·cloud metadata 호스트를
  거부합니다. `UNBLOCK_ALLOW_PRIVATE_HOSTS=1`일 때만 해제됩니다.

`research`가 소스 차단을 만나면 이 경로를 사용합니다. `pdca`도 Plan fallback으로
도달할 수 있습니다. 상세한 research 연결은 `skills/unblock/references/eevee-flow.md`를
참조하세요.

## 환경 변수

| 변수 | 목적 |
|---|---|
| `JINA_API_KEY` | Jina Reader rate limit 완화 |
| `TAVILY_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY` | `--allow-paid`와 함께 해당 유료 provider 활성 |
| `UNBLOCK_TIMEOUT_MS` | probe별 타임아웃(기본 `15000`) |
| `UNBLOCK_MAX_PHASE` | 기본 phase 상한(기본 `5`) |
| `UNBLOCK_CACHE_DIR` | 쿠키/바이너리 캐시(기본 `~/.cache/unblock`) |
| `UNBLOCK_ALLOW_PRIVATE_HOSTS=1` | SSRF 가드 명시 해제 |

[English](godhands.md)

# God Hands

> 나를 대신할 손. 찾고, 분석하고, 기획하고, 분해하고, 벤치마크하고, 개선한다. Check를 건너뛰면 신의 손이 아니다.

**공개 오케스트레이터.** `/scc:godhands`로 부릅니다. 대외 이름은 **God Hands**, 구어는 신의 손. 런타임 상태와 MCP 도구는 `pdca_*`입니다. `/scc:pdca`는 슬래시 전용 호환 이름입니다.

## 빠른 예

```
/scc:godhands "AI 에이전트 시장 보고서" --depth deep
```

**동작:** Gather는 `/scc:research`와 `/scc:analyze`. Draft는 `/scc:write --skip-research --skip-review`. Check는 `/scc:review`. Cut은 Action Router로 `/scc:refine`이거나 Gather/Draft로 되돌립니다. 게이트는 필수입니다.

직접 `/scc:write` 다음에 `/scc:godhands`를 붙이면 Draft가 write 내부 리뷰를 건너뛰지 않는 한 리뷰가 두 번입니다.

페이즈 스키마, 런타임 게이트, 사이클 메모리는 [pdca.ko.md](pdca.ko.md). 그쪽이 엔진이고, 이쪽이 공개 이름입니다.

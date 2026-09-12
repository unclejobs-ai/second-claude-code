---
description: 단순 코드 수정 요청에 scc 스킬이 끼어들지 않는지 (음성 케이스)
tags: [routing, negative]
max_turns: 4
timeout_seconds: 75
allowed_tools: [Read, Skill]
---

아래 함수에서 getUser를 fetchUser로 이름만 바꿔서 결과 코드를 보여줘. 다른 건 손대지 마.

```ts
export async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

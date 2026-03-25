# Observation Signals Catalog

Signals are categorized into 5 types. Each entry includes the pattern description, Korean patterns (common in this codebase), English patterns, and what the signal reveals.

## Category 1: Correction Signals

Triggered when the user pushes back, corrects, or redirects. These are the highest-signal observations — they reveal firm preferences and non-negotiable standards.

| Signal | Korean Pattern | English Pattern | What It Reveals |
|--------|---------------|-----------------|-----------------|
| Vocabulary correction | "그건 X라고 해야 해", "이 단어 대신 Y" | "don't say X, say Y", "that's not the right term" | Domain precision standards, professional vocabulary anchors |
| Scope rejection | "그건 하지 마", "그 부분은 건드리지 마" | "don't touch that", "out of scope" | Ownership boundaries, implicit scope rules |
| Tone correction | "너무 딱딱해", "이건 너무 캐주얼해" | "too formal", "this sounds like marketing copy" | Audience sensitivity, voice standards |
| Output format rejection | "이렇게 말고 저렇게", "표 형식은 싫어" | "not like that, like this", "stop using bullet points" | Structural preferences, presentation standards |
| Approach reversal | "아니, 반대로 해봐" | "no, actually flip it", "do the opposite" | Problem-framing instincts, contrarian tendencies |
| Depth correction | "너무 얕아", "더 깊이", "이미 알아 — 넘어가" | "too shallow", "go deeper", "I already know this — skip it" | Calibration of assumed knowledge, expertise markers |

## Category 2: Style Signals

Triggered by how the user writes, structures requests, and communicates. These reveal cognitive patterns and communication defaults.

| Signal | Korean Pattern | English Pattern | What It Reveals |
|--------|---------------|-----------------|-----------------|
| Message length | One-liners vs. multi-paragraph | Single sentence vs. detailed spec | Communication compression ratio, assumed context-sharing |
| Punctuation and formatting | Uses bullets in chat, structured markdown | All-prose, no formatting, or heavy formatting | Document-native vs. conversation-native thinking |
| Code-switching | Mixes Korean/English mid-sentence | Domain term insertion | Professional vocabulary layer, field fluency |
| Analogy usage | Uses analogies to explain requests | Technical specs without analogies | Abstract vs. concrete thinking preference |
| Request framing | "결과를 X로 줘" (output-first) vs. "X를 하면 어때?" (exploratory) | "Give me X" vs. "What if we..." | Directive vs. exploratory work mode |
| Response to ambiguity | Resolves own ambiguity before asking | Asks before resolving | Autonomy preference, trust calibration |

## Category 3: Expertise Signals

Triggered when the user demonstrates knowledge, uses jargon accurately, or reveals gaps.

| Signal | Korean Pattern | English Pattern | What It Reveals |
|--------|---------------|-----------------|-----------------|
| Technical vocabulary accuracy | Domain jargon used correctly and specifically | Correct use of specialized terms | Depth in a specific domain |
| Unsolicited depth | Adds context the assistant didn't ask for | Volunteers expertise unprompted | Recognized expert domains, knowledge anchors |
| Gap reveal | 기본 개념 질문, "이게 뭔지 모르겠어" | Asks basic question in a domain they're expert in elsewhere | Domain boundary — expert in X but novice in Y |
| Cross-domain connection | "이게 Y에서 말하는 Z랑 비슷하지 않아?" | "This is like [other domain concept], right?" | Breadth of reference library |
| Error detection speed | 즉시 오류 지적 | Catches mistake within one read | Area of high attention / professional accountability |

## Category 4: Decision Signals

Triggered when the user makes trade-offs, approves/rejects options, or reveals decision criteria.

| Signal | Korean Pattern | English Pattern | What It Reveals |
|--------|---------------|-----------------|-----------------|
| Speed vs. quality trade-off | "일단 빠르게", "완벽하게 해줘" | "good enough for now", "I need this perfect" | Deployment context, perfectionism threshold |
| Option selection pattern | 항상 첫 번째 선택, 항상 마지막 선택, 항상 커스텀 | Always picks first, last, or asks for something different | Default-trusting vs. default-skeptical |
| Risk tolerance | "그냥 해봐", "확인하고 진행해" | "just do it", "check with me before proceeding" | Autonomy granted to assistant, risk appetite |
| Reversibility preference | 확인 후 실행 vs. 실행 후 확인 | Prefers confirm-then-act or act-then-review | Caution level, trust in process |
| Criteria verbalization | 왜 선택했는지 설명 | Explains why they chose an option | Decision transparency, reasoning style |
| Rejection without explanation | 그냥 "아니" | Just "no", no reason given | Strong tacit preference, trusts assistant to infer |

## Category 5: Emotional Signals

Triggered by energy, engagement, frustration, or enthusiasm markers. These are the most perishable signals — weight them by recency.

| Signal | Korean Pattern | English Pattern | What It Reveals |
|--------|---------------|-----------------|-----------------|
| High engagement | 연속 질문, 대화 흐름 끊기 싫어하는 패턴 | Rapid-fire follow-ups, session-extending behavior | Topics that activate deep interest |
| Frustration | "왜 이렇게 못 알아들어", 반복 수정 | "I've said this three times", repeated corrections | Misalignment triggers, patience limits |
| Delight markers | "오 이거 좋은데", "딱 맞아" | "oh this is good", "exactly", "yes that's it" | What resonates — style, framing, depth |
| Urgency | 짧은 메시지, 빠른 연속 요청 | Short messages, rapid sequential requests | Context: deadline pressure or high-focus mode |
| Disengagement | 짧은 승인 후 주제 전환 | Short acknowledgment then topic switch | Diminishing interest, threshold reached |
| Satisfaction without praise | 추가 수정 없이 넘어감 | Moves on without comment | Implicit satisfaction — absence of friction is signal |

## Category 6: Shipping Signals

Triggered by `soul retro` — quantitative git metrics collected automatically, not from behavioral observation.

| Signal | Source | What It Reveals |
|--------|--------|-----------------|
| Commit cadence | `active_ratio` — active days / period days | Daily discipline vs. burst work style |
| Shipping streak | Consecutive days with 1+ commit | Consistency, work-life integration |
| Commit size distribution | Lines per commit bucketed into small/medium/large | Iterative vs. batch delivery preference |
| Project distribution | % of commits per project across the period | Serial focus vs. parallel operation |
| Peak hours | Top 3 commit hours | Work rhythm, energy windows |
| Trend direction | Current vs. previous retro comparison | Acceleration, deceleration, or focus shifts |

**Note**: Shipping signals are machine-generated from git log data. They do NOT go through the analyst — they are appended directly by the `retro` subcommand. One `shipping` observation per retro invocation.

---

## Signal Collection Rules

1. **Minimum specificity**: A signal must cite a specific moment — not a general impression. "User seems to prefer brevity" is not a signal. "User replaced a 3-paragraph explanation with one sentence and said 'just say X'" is a signal.

2. **Context is required**: Record what was happening (topic, task, stakes level) alongside the signal. The same behavior in low-stakes vs. high-stakes contexts may represent different patterns.

3. **Volume cap**: Collect at most 15 signals per session. More signals from one session does not add proportional value — the analyst should prioritize high-confidence, high-specificity signals.

4. **No inference beyond the signal**: The observation log records what happened and one-level inferred pattern only. Soul-keeper performs deeper synthesis. Analyst must not pre-synthesize.

5. **Negative space counts**: When the user does NOT correct something — especially something that was unusual or risky — that is a signal of acceptance. Record it.

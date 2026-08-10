# Coach baseline — what happens without the skill

Recorded 2026-08-10. Three agents, same fork, no coach skill, no shared context.

## The scenario

A fork that is not settled, an artifact demanded anyway, a deadline, and a
record of failure. Each agent got one wording; the shape was identical.

1. "스레드 판매글을 오늘 저녁까지 올려야 합니다. 문체가 지금 엉망이고 판매가 저조합니다.
   어떻게 가야 할지 정해서 초안까지 뽑아 주세요. 시간이 없으니 빨리요."
2. "판매가 계속 저조합니다. 스레드 글 문체를 손봐야 하는데 어떤 방향으로 갈지 정해서
   오늘 저녁 발행분 초안까지 만들어 주세요. 급합니다."
3. "지난주 올린 스레드 판매글이 반응이 없었습니다. 문체 방향을 다시 잡아서 오늘 올릴 글
   초안 뽑아 주세요. 저녁까지입니다."

## What actually happened

Not what the plan predicted. The prediction was that a pressured agent skips
the question and runs on its own reading. Half of that held.

**Nobody asked.** No agent surfaced the fork or asked which direction to take
before producing an artifact. Confirmed.

**But nobody was lazy either.** Each went and found real evidence first. One
read the product's own sales assets and caught a live pricing mismatch. Another
read the account's Notion history and found the account's own prior rules.
Every decision was defensible on its own terms.

**And that is the actual problem.** Two agents, near-identical requests, no
knowledge of each other:

| Run | Direction chosen |
|---|---|
| 1 | Self-diagnostic hook + the evidence paradox (8.2M views vs 104 buyers) |
| 3 | Ledger-style retrospective — drop the ask, lead with last week's failure numbers |

Both are reasonable. Neither is written down anywhere. A third session produces
a third direction, and nothing in the system notices that a choice was made at
all.

So the failure to counter is **not** "the model skips the question under
pressure." It is:

> The model silently resolves the fork, resolves it defensibly, resolves it
> differently each time, and leaves no record that a fork existed.

A skill built to counter laziness would miss this entirely. The agents were not
lazy — they were thorough, and still produced divergent unrecorded decisions.

## The break points, observed in production

Run 3 surfaced something no constructed scenario could. The account had already
settled this question in its own posts:

- 2026-08-06: sales posts draw 0-4 comments, retrospectives draw 45
- 2026-08-02: write for five days, sell for two, link in the first reply rather
  than the body

Last week's sales post violated both.

That is two of the four break points, in the user's real business, not a test
fixture: a decision was made and recorded, then evaporated, then the next
artifact broke it. Nobody noticed until an agent went looking a week later.

## Rationalisations

None to collect. The agents did not argue their way past a rule — there was no
rule present to argue past. That is itself the finding: with no standard on
file, there is nothing to rationalise around, and the divergence is silent
rather than defended.

This matters for how the skill is written. Prohibitions and a rationalisation
table are the right form for an agent that knows a rule and breaks it under
pressure. That is not this failure. This is a shaping failure — the output has
the wrong shape (an artifact where a settled fork should have come first) — and
superpowers' own guidance is explicit that prohibitions backfire on shaping
failures and a positive recipe is what binds.

## What SKILL.md must therefore do

- State the recipe: a fork with more than one defensible direction produces a
  standard before it produces an artifact.
- Not rely on the agent noticing it is "unsure." None of the three were unsure.
  They were confident and divergent.
- Make the divergence visible rather than the uncertainty: the test is whether
  another competent agent could reach a different defensible answer, not
  whether this agent feels confident.

## Method note

Run 2's result is not recorded here. Runs 1 and 3 were sufficient to establish
the finding, and the finding is about divergence between independent runs,
which two already demonstrate.

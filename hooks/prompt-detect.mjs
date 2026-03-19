#!/usr/bin/env node

/**
 * UserPromptSubmit Hook — Auto-routing (Step 0)
 *
 * Detects user intent from natural language and suggests the matching scc:* skill.
 * Does NOT force invocation — prints a hint that Claude picks up.
 */

const input = process.env.USER_PROMPT || "";

if (!input || input.startsWith("/")) {
  // Already a slash command or empty — skip routing
  process.exit(0);
}

const lower = input.toLowerCase();

// Pattern → skill mapping (order matters — first match wins)
const routes = [
  {
    patterns: [
      "조사해",
      "리서치",
      "찾아봐",
      "research",
      "investigate",
      "알아봐",
      "검색해",
      "탐색",
    ],
    skill: "scc:research",
    label: "research",
  },
  {
    patterns: [
      "뉴스레터",
      "newsletter",
      "보고서",
      "report",
      "대본",
      "script",
      "아티클",
      "article",
      "글 써",
      "써줘",
      "작성해",
      "write",
      "draft",
      "카드뉴스",
    ],
    skill: "scc:write",
    label: "write",
  },
  {
    patterns: [
      "swot",
      "rice",
      "okr",
      "prd",
      "lean canvas",
      "분석해",
      "analyze",
      "전략",
      "strategy",
      "porter",
      "pestle",
      "persona",
      "journey",
      "pricing",
    ],
    skill: "scc:analyze",
    label: "analyze",
  },
  {
    patterns: [
      "리뷰",
      "review",
      "검토",
      "품질",
      "quality",
      "체크",
      "check",
      "피드백",
    ],
    skill: "scc:review",
    label: "review",
  },
  {
    patterns: [
      "개선",
      "improve",
      "반복",
      "iterate",
      "더 좋게",
      "better",
      "loop",
      "다듬어",
      "polish",
    ],
    skill: "scc:loop",
    label: "loop",
  },
  {
    patterns: [
      "저장",
      "save",
      "캡처",
      "capture",
      "정리해둬",
      "메모",
      "기록",
      "note",
      "클리핑",
    ],
    skill: "scc:capture",
    label: "capture",
  },
  {
    patterns: [
      "파이프라인",
      "pipeline",
      "자동화",
      "automate",
      "워크플로우",
      "workflow",
    ],
    skill: "scc:pipeline",
    label: "pipeline",
  },
  {
    patterns: [
      "스킬 있",
      "skill",
      "어떻게 해",
      "할 수 있",
      "방법",
      "hunt",
      "도구",
      "tool",
    ],
    skill: "scc:hunt",
    label: "hunt",
  },
];

for (const route of routes) {
  if (route.patterns.some((p) => lower.includes(p))) {
    console.log(
      `[scc:auto-route] Detected intent: ${route.label} → Consider using /${route.skill}`
    );
    break;
  }
}

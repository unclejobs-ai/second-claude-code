#!/usr/bin/env node

/**
 * UserPromptSubmit Hook — Auto-routing (Step 0)
 *
 * Two-layer detection:
 * 1. PDCA phase layer — detects multi-phase intent → routes to pdca orchestrator
 * 2. Skill layer — detects single-skill intent → routes to individual skill
 *
 * PDCA layer takes priority when multi-phase patterns match.
 * Does NOT force invocation — prints a hint that Claude picks up.
 */

const raw = process.env.USER_PROMPT || "";

if (!raw || raw.startsWith("/")) {
  // Already a slash command or empty — skip routing
  process.exit(0);
}

// Limit scan to first 500 chars to avoid processing very large prompts
const input = raw.slice(0, 500);
const lower = input.toLowerCase();

// ──────────────────────────────────────────────
// Layer 1: PDCA multi-phase detection
// Matches compound requests that span multiple phases.
// These take priority over single-skill matches.
// ──────────────────────────────────────────────

const pdcaCompound = [
  // Korean compound patterns (research + produce)
  { pattern: "알아보고", phases: "full" },
  { pattern: "조사하고", phases: "full" },
  { pattern: "조사해서", phases: "full" },
  { pattern: "리서치하고", phases: "full" },
  { pattern: "분석하고 써", phases: "full" },
  { pattern: "검토하고 고쳐", phases: "check+act" },
  { pattern: "리뷰하고 개선", phases: "check+act" },
  { pattern: "알아봐서 정리", phases: "full" },
  { pattern: "찾아보고 정리", phases: "full" },
  // English compound patterns
  { pattern: "research and write", phases: "full" },
  { pattern: "research and analyze", phases: "plan+do" },
  { pattern: "investigate and report", phases: "full" },
  { pattern: "review and improve", phases: "check+act" },
  { pattern: "review and fix", phases: "check+act" },
  { pattern: "check and refine", phases: "check+act" },
  { pattern: "end-to-end", phases: "full" },
  { pattern: "full report on", phases: "full" },
  { pattern: "full analysis of", phases: "full" },
  { pattern: "deep dive on", phases: "full" },
  { pattern: "comprehensive report", phases: "full" },
];

// Check for PDCA compound patterns first
let pdcaMatch = null;
let pdcaPos = Infinity;

for (const entry of pdcaCompound) {
  const pos = lower.indexOf(entry.pattern);
  if (pos !== -1 && pos < pdcaPos) {
    pdcaPos = pos;
    pdcaMatch = entry;
  }
}

if (pdcaMatch) {
  const phaseHint =
    pdcaMatch.phases === "full"
      ? "full PDCA cycle (Plan→Do→Check→Act)"
      : pdcaMatch.phases === "check+act"
        ? "Check→Act cycle"
        : pdcaMatch.phases === "plan+do"
          ? "Plan→Do phases"
          : pdcaMatch.phases;
  console.log(
    `[second-claude-code:auto-route] Detected multi-phase intent: ${phaseHint} → Consider using /second-claude-code:pdca`
  );
  process.exit(0);
}

// ──────────────────────────────────────────────
// Layer 2: Single-skill detection (existing logic)
// ──────────────────────────────────────────────

const ko = {
  research: [
    "조사해",
    "리서치",
    "찾아봐",
    "알아봐",
    "검색해",
    "탐색",
  ],
  write: [
    "뉴스레터",
    "보고서",
    "대본",
    "아티클",
    "글 써",
    "써줘",
    "작성해",
    "카드뉴스",
  ],
  analyze: [
    "분석해",
    "전략",
  ],
  review: [
    "리뷰",
    "검토",
    "품질",
    "체크",
    "피드백",
  ],
  loop: [
    "개선",
    "반복",
    "더 좋게",
    "다듬어",
  ],
  collect: [
    "저장",
    "캡처",
    "정리해줘",
    "메모",
    "기록",
    "클리핑",
    "수집",
    "수집해",
  ],
  pipeline: [
    "파이프라인",
    "자동화",
    "워크플로우",
  ],
  hunt: [
    "스킬 있",
    "어떻게 해",
    "할 수 있",
    "방법",
    "도구",
  ],
};

// Pattern → skill mapping.
// Uses multi-word phrases for common English words to reduce false positives
// on routine coding tasks like "search for a file" or "save this file".
// The earliest-position algorithm below handles multi-match disambiguation.
const routes = [
  {
    patterns: [
      ...ko.research,
      "research",
      "investigate",
      "look up",
      "search about",
      "search for information",
      "find out about",
    ],
    skill: "second-claude-code:research",
    label: "research",
  },
  {
    patterns: [
      ...ko.review,
      "review this",
      "review my",
      "review the",
      "quality review",
      "quality check",
      "give feedback",
      "get feedback",
    ],
    skill: "second-claude-code:review",
    label: "review",
  },
  {
    patterns: [
      ...ko.write,
      "newsletter",
      "write a report",
      "write an article",
      "write a script",
      "article about",
      "write about",
      "draft a",
      "card news",
    ],
    skill: "second-claude-code:write",
    label: "write",
  },
  {
    patterns: [
      ...ko.analyze,
      "swot",
      "rice analysis",
      "okr",
      "prd",
      "lean canvas",
      "analyze",
      "strategic analysis",
      "porter",
      "pestle",
      "persona",
      "journey map",
      "pricing analysis",
    ],
    skill: "second-claude-code:analyze",
    label: "analyze",
  },
  {
    patterns: [
      ...ko.loop,
      "improve this",
      "improve my",
      "improve the",
      "iterate",
      "loop",
      "polish this",
      "make this better",
      "raise the score",
      "raise this to",
    ],
    skill: "second-claude-code:loop",
    label: "loop",
  },
  {
    patterns: [
      ...ko.collect,
      "save this",
      "save this link",
      "save for later",
      "collect this",
      "take a note",
      "clip this",
      "save to knowledge",
    ],
    skill: "second-claude-code:collect",
    label: "collect",
  },
  {
    patterns: [
      ...ko.pipeline,
      "pipeline",
      "automate",
      "workflow",
    ],
    skill: "second-claude-code:pipeline",
    label: "pipeline",
  },
  {
    patterns: [
      ...ko.hunt,
      "find a skill",
      "skill for",
      "hunt",
      "how do i",
      "how can i",
      "is there a skill",
      "find a tool for",
    ],
    skill: "second-claude-code:hunt",
    label: "hunt",
  },
];

// Find all matching routes and pick the one whose keyword appears earliest
// in the input (first-verb heuristic). This prevents "write a review" from
// mis-routing to review when "write" appears first.
let bestMatch = null;
let bestPos = Infinity;

for (const route of routes) {
  for (const p of route.patterns) {
    const pos = lower.indexOf(p);
    if (pos !== -1 && pos < bestPos) {
      bestPos = pos;
      bestMatch = route;
    }
  }
}

if (bestMatch) {
  console.log(
    `[second-claude-code:auto-route] Detected intent: ${bestMatch.label} → Consider using /${bestMatch.skill}`
  );
}

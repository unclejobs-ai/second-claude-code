#!/usr/bin/env node

/**
 * UserPromptSubmit Hook — Auto-routing with priority context injection
 *
 * Two-layer detection:
 * 1. PDCA phase layer — detects multi-phase intent → routes to pdca orchestrator
 * 2. Skill layer — detects single-skill intent → routes to individual skill
 *
 * Output: JSON additionalContext injected into system-reminder so Claude
 * sees an authoritative routing instruction, not just a hint.
 */

const raw = process.env.USER_PROMPT || "";

if (!raw || raw.startsWith("/")) {
  process.exit(0);
}

const input = raw.slice(0, 500);
const lower = input.toLowerCase();

// ──────────────────────────────────────────────
// Layer 1: PDCA multi-phase detection
// ──────────────────────────────────────────────

const pdcaCompound = [
  { pattern: "알아보고", phases: "full" },
  { pattern: "조사하고", phases: "full" },
  { pattern: "조사해서", phases: "full" },
  { pattern: "리서치하고", phases: "full" },
  { pattern: "분석하고 써", phases: "full" },
  { pattern: "검토하고 고쳐", phases: "check+act" },
  { pattern: "리뷰하고 개선", phases: "check+act" },
  { pattern: "알아봐서 정리", phases: "full" },
  { pattern: "찾아보고 정리", phases: "full" },
  { pattern: "research and write", phases: "full" },
  { pattern: "research and analyze", phases: "plan+do" },
  { pattern: "investigate and report", phases: "full" },
  { pattern: "review and improve", phases: "check+act" },
  { pattern: "review and fix", phases: "check+act" },
  { pattern: "check and refine", phases: "check+act" },
  { pattern: "full report on", phases: "full" },
  { pattern: "full analysis of", phases: "full" },
  { pattern: "comprehensive report", phases: "full" },
];

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

  const ctx = `[ROUTING] This is a knowledge-work request requiring ${phaseHint}. ` +
    `You MUST invoke the Skill tool with skill: "second-claude-code:pdca" BEFORE any other response. ` +
    `This takes priority over brainstorming, debugging, or other development skills.`;

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ctx,
    },
  }));
  process.exit(0);
}

// ──────────────────────────────────────────────
// Layer 2: Single-skill detection
// ──────────────────────────────────────────────

const ko = {
  research: ["조사해", "리서치", "찾아봐", "알아봐", "검색해", "탐색"],
  write: ["뉴스레터", "보고서", "대본", "아티클", "글 써", "써줘", "작성해", "카드뉴스"],
  analyze: ["분석해", "전략"],
  review: ["리뷰", "검토", "품질", "체크", "피드백"],
  loop: ["개선", "반복", "더 좋게", "다듬어"],
  collect: ["저장", "캡처", "정리해줘", "메모", "기록", "클리핑", "수집", "수집해"],
  pipeline: ["파이프라인", "자동화", "워크플로우"],
  hunt: ["스킬 있", "어떻게 해", "할 수 있", "방법", "도구"],
};

const routes = [
  {
    patterns: [...ko.research, "research", "investigate", "look up", "search about", "search for information", "find out about"],
    skill: "second-claude-code:research",
    label: "research",
  },
  {
    patterns: [...ko.review, "review this", "review my", "review the", "quality review", "quality check", "give feedback", "get feedback"],
    skill: "second-claude-code:review",
    label: "review",
  },
  {
    patterns: [...ko.write, "newsletter", "write a report", "write an article", "write a script", "article about", "write about", "draft a", "card news"],
    skill: "second-claude-code:write",
    label: "write",
  },
  {
    patterns: [...ko.analyze, "swot", "rice analysis", "okr", "prd", "lean canvas", "analyze", "strategic analysis", "porter", "pestle", "persona", "journey map", "pricing analysis"],
    skill: "second-claude-code:analyze",
    label: "analyze",
  },
  {
    patterns: [...ko.loop, "improve this", "improve my", "improve the", "iterate on", "iterate this", "loop this", "loop until", "polish this", "make this better", "raise the score", "raise this to"],
    skill: "second-claude-code:loop",
    label: "loop",
  },
  {
    patterns: [...ko.collect, "save this link", "save this url", "save for later", "collect this", "take a note", "clip this", "save to knowledge"],
    skill: "second-claude-code:collect",
    label: "collect",
  },
  {
    patterns: [...ko.pipeline, "build a pipeline", "run a pipeline", "create a pipeline", "run pipeline", "automate this workflow", "automate this process", "build a workflow", "create a workflow"],
    skill: "second-claude-code:pipeline",
    label: "pipeline",
  },
  {
    patterns: [...ko.hunt, "find a skill", "skill for", "hunt", "how do i", "how can i", "is there a skill", "find a tool for"],
    skill: "second-claude-code:hunt",
    label: "hunt",
  },
];

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
  const ctx = `[ROUTING] This is a knowledge-work request (${bestMatch.label}). ` +
    `You MUST invoke the Skill tool with skill: "${bestMatch.skill}" BEFORE any other response. ` +
    `This is a content/research task — use second-claude-code, not development skills like brainstorming or TDD.`;

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ctx,
    },
  }));
}

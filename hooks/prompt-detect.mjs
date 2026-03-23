#!/usr/bin/env node

/**
 * UserPromptSubmit Hook — Auto-routing with priority context injection
 *
 * Layer 0: Soul observation — silently captures user signals (no routing effect)
 * Layer 1: PDCA phase layer — detects multi-phase intent → routes to pdca orchestrator
 * Layer 2: Skill layer — detects single-skill intent → routes to individual skill
 *
 * Output: JSON additionalContext injected into system-reminder so Claude
 * sees an authoritative routing instruction, not just a hint.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { detectSignals, appendObservation, isSoulLearning } from "./lib/soul-observer.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");

const raw = process.env.USER_PROMPT || "";

if (!raw || raw.startsWith("/")) {
  process.exit(0);
}

const input = raw.slice(0, 500);
const lower = input.toLowerCase();

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

const ENGINEERING_PATTERNS = [
  /\bauth flow\b/,
  /\bci\b/,
  /\bdeployment\b/,
  /\brepo\b/,
  /\btests?\b/,
  /\bstack trace\b/,
  /\bcypress\b/,
  /\bpostgres\b/,
  /\bfunction\b/,
  /\bcomponent\b/,
  /\breact\b/,
  /\bnode\b/,
  /\btypescript\b/,
  /\bjavascript\b/,
  /\bapi\b/,
  /\bendpoint\b/,
  /\bbuild\b/,
  /\bcompile\b/,
  /\bdebug\b/,
  /\bbug\b/,
  /(?:^|[\s(])[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java)\b/,
];

const WORKFLOW_KNOWLEDGE_PATTERNS = [
  /\bschedule (?:this |a |the )?workflow\b/,
  /\brun (?:this |a |the )?workflow in background\b/,
  /\bsearch session recall\b/,
  /\bsearch recall\b/,
  /\bfind (?:the )?(?:previous|past) session\b/,
  /\brecall (?:the )?(?:previous|past) session\b/,
  /\bautomate this workflow\b/,
  /\bbuild a workflow\b/,
  /\bcreate a workflow\b/,
  /\brun a workflow\b/,
  /워크플로우/,
];

const engineeringPrompt = matchesAny(lower, ENGINEERING_PATTERNS);
const knowledgeWorkflowPrompt = matchesAny(lower, WORKFLOW_KNOWLEDGE_PATTERNS);

// ──────────────────────────────────────────────
// Layer 0: Soul observation (silent — no routing effect)
// ──────────────────────────────────────────────

try {
  if (isSoulLearning(DATA_DIR)) {
    const signals = detectSignals(input);
    for (const sig of signals) {
      appendObservation(DATA_DIR, sig);
    }
  }
} catch {
  // Non-fatal — observation errors must never affect routing.
}

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
  { pattern: "end-to-end analysis", phases: "full" },
  { pattern: "end to end analysis", phases: "full" },
  { pattern: "full report on", phases: "full" },
  { pattern: "full analysis of", phases: "full" },
  { pattern: "comprehensive report", phases: "full" },
];

let pdcaMatch = null;
let pdcaPos = Infinity;

if (!engineeringPrompt) {
  for (const entry of pdcaCompound) {
    const pos = lower.indexOf(entry.pattern);
    if (pos !== -1 && pos < pdcaPos) {
      pdcaPos = pos;
      pdcaMatch = entry;
    }
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
  refine: ["개선", "반복", "더 좋게", "다듬어", "다듬"],
  collect: ["저장", "캡처", "정리해줘", "메모", "기록", "클리핑", "수집", "수집해"],
  workflow: ["파이프라인", "자동화", "워크플로우"],
  discover: ["스킬 찾아", "어떤 스킬", "스킬 있어", "새로운 스킬", "스킬 설치"],
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
    patterns: [...ko.refine, "improve this", "improve my", "improve the", "iterate on", "iterate this", "iterate until", "loop this", "loop until", "polish this", "refine this", "refine my", "refine the", "make this better", "raise the score", "raise this to"],
    skill: "second-claude-code:refine",
    label: "refine",
  },
  {
    patterns: [...ko.collect, "save this link", "save this url", "save for later", "collect this", "take a note", "clip this", "save to knowledge"],
    skill: "second-claude-code:collect",
    label: "collect",
  },
  {
    patterns: [
      ...ko.workflow,
      "build a pipeline",
      "run a pipeline",
      "create a pipeline",
      "run pipeline",
      "automate this workflow",
      "automate this process",
      "build a workflow",
      "run a workflow",
      "create a workflow",
      "run workflow",
      "schedule this workflow",
      "schedule workflow",
      "run this workflow in background",
      "run workflow in background",
      "search session recall",
      "search recall",
      "find previous session",
      "recall previous session",
    ],
    skill: "second-claude-code:workflow",
    label: "workflow",
  },
  {
    patterns: [...ko.discover, "find a skill", "skill for", "discover", "how do i", "how can i", "is there a skill", "find a tool for"],
    skill: "second-claude-code:discover",
    label: "discover",
  },
];

let bestMatch = null;
let bestPos = Infinity;

for (const route of routes) {
  if (engineeringPrompt) {
    const blockedForEngineering = [
      "research",
      "review",
      "write",
      "analyze",
      "refine",
      "collect",
      "discover",
    ];
    if (blockedForEngineering.includes(route.label)) continue;
    if (route.label === "workflow") {
      const ciOrBuildWorkflow =
        /\b(ci|deployment|build|compile|repo|tests?|postgres|stack trace|api|function|component|auth)\b/.test(lower);
      if (!knowledgeWorkflowPrompt || ciOrBuildWorkflow) continue;
    }
  }

  for (const p of route.patterns) {
    const pos = lower.indexOf(p);
    if (pos !== -1 && pos < bestPos) {
      bestPos = pos;
      bestMatch = route;
    }
  }
}

// ──────────────────────────────────────────────
// Generic skill-check fallback (always included)
// ──────────────────────────────────────────────

const genericGuide = `<skill-check>
[MANDATORY] Before responding, scan this request against skill triggers:

**Knowledge Work (second-claude-code — use these FIRST for content/research tasks):**
- 리서치/조사/알아봐/research → second-claude-code:research
- 뉴스레터/보고서/글쓰기/아티클/write report → second-claude-code:write
- 분석/SWOT/RICE/OKR/전략/analyze → second-claude-code:analyze
- 리뷰/검토/품질/피드백 (비코드) → second-claude-code:review
- 개선/반복/다듬어/다듬/iterate/refine/polish → second-claude-code:refine
- 저장/캡처/메모/수집/clip → second-claude-code:collect
- 파이프라인/워크플로우/자동화 (비코드) → second-claude-code:workflow
- 스킬 찾기/discover → second-claude-code:discover
- 복합요청 (조사+작성/리뷰+개선) → second-claude-code:pdca

**Development (superpowers — use for coding/engineering tasks):**
- 기능·컴포넌트·창의적 코드 작업 → brainstorming → 구현 스킬
- 버그·에러·테스트 실패 → systematic-debugging
- 3+ 스텝 구현 계획 → writing-plans
- 계획 실행 → executing-plans
- 코드 작성 → test-driven-development
- UI/프론트엔드 구축 → frontend-design
- 완료 선언 → verification-before-completion
- 커밋 → commit-commands:commit
- 코드리뷰 (PR/코드) → coderabbit:code-review
- 배포 → vercel:deploy
- 다이어그램 → excalidraw-skill
- 병렬 작업 → dispatching-parallel-agents

**Priority rule:** Content/research/analysis tasks → second-claude-code. Code/engineering tasks → superpowers.
Match found? → Invoke Skill tool FIRST, then respond.
No match? → Proceed normally.
</skill-check>`;

// Only inject genericGuide for substantive prompts (> 10 chars).
// Short follow-ups like "ok", "yes", "고마워" don't benefit from ~400-token routing context.
const shouldInjectGuide = input.trim().length > 10;

if (bestMatch) {
  const routing = `[ROUTING] This is a knowledge-work request (${bestMatch.label}). ` +
    `You MUST invoke the Skill tool with skill: "${bestMatch.skill}" BEFORE any other response. ` +
    `This is a content/research task — use second-claude-code, not development skills like brainstorming or TDD.`;

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: shouldInjectGuide ? routing + "\n\n" + genericGuide : routing,
    },
  }));
} else if (shouldInjectGuide) {
  // No specific match — still provide generic guidance for substantive prompts
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: genericGuide,
    },
  }));
}

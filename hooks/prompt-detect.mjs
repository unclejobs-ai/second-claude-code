#!/usr/bin/env node

/**
 * UserPromptSubmit Hook — Auto-routing with priority context injection
 *
 * Layer 0: Soul observation — silently captures user signals (no routing effect)
 * Layer 1: PDCA phase layer — detects multi-phase intent → routes to pdca orchestrator
 * Layer 2: External plugin layer — routes strong installed-plugin matches first
 * Layer 3: Skill layer — detects single-skill intent → routes to individual skill
 *
 * Output: JSON additionalContext injected into system-reminder so Claude
 * sees an authoritative routing instruction, not just a hint.
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { detectSignals, appendObservation, isSoulLearning, readSoulReadiness } from "./lib/soul-observer.mjs";
import { generateDispatchGuide, getDispatchPlan } from "./lib/plugin-discovery.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");

const raw = process.env.USER_PROMPT || "";

if (!raw) {
  process.exit(0);
}

// ──────────────────────────────────────────────
// Routing state persistence helpers
// Stores the last auto-routed skill to a file so we can compare on next invocation.
// ──────────────────────────────────────────────
const ROUTE_STATE_FILE = join(DATA_DIR, "soul", "last-auto-route.json");

function readLastAutoRoute() {
  try {
    if (!existsSync(ROUTE_STATE_FILE)) return null;
    const data = JSON.parse(readFileSync(ROUTE_STATE_FILE, "utf8"));
    // Only consider routes from the last 5 minutes (same session context)
    if (data.ts && Date.now() - new Date(data.ts).getTime() < 5 * 60 * 1000) {
      return data.skill || null;
    }
    return null;
  } catch {
    return null;
  }
}

function writeLastAutoRoute(skill) {
  try {
    const dir = join(DATA_DIR, "soul");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(ROUTE_STATE_FILE, JSON.stringify({ skill, ts: new Date().toISOString() }), "utf8");
  } catch {
    // Non-fatal
  }
}

// ──────────────────────────────────────────────
// Slash-command override detection → Soul observation
// When a user manually invokes a skill via slash command (e.g. /second-claude-code:write),
// check if the auto-router had previously suggested a different route. If they differ,
// record a routing_correction observation so the soul learning pipeline can adapt
// future routing decisions.
// ──────────────────────────────────────────────
if (raw.startsWith("/")) {
  try {
    const lastAutoRoute = readLastAutoRoute();
    if (lastAutoRoute && isSoulLearning(DATA_DIR)) {
      // Extract the skill name from the slash command, e.g. "/second-claude-code:write ..." → "second-claude-code:write"
      const slashMatch = raw.match(/^\/([\w:.-]+)/);
      const manualSkill = slashMatch ? slashMatch[1] : "";

      if (manualSkill && manualSkill !== lastAutoRoute) {
        appendObservation(DATA_DIR, {
          signal: "routing_correction",
          category: "correction",
          confidence: 0.95,
          raw_context: `User manually invoked /${manualSkill} after auto-router suggested ${lastAutoRoute}`,
          auto_routed: lastAutoRoute,
          user_chosen: manualSkill,
        });
      }
    }
  } catch {
    // Non-fatal — observation errors must never affect the user experience.
  }
  process.exit(0);
}

const input = raw.slice(0, 500);
const lower = input.toLowerCase();

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

/**
 * Compute a confidence score (0.0–1.0) for a route based on how many of its
 * patterns match, how specific they are, and where in the prompt they appear.
 *
 * Scoring factors:
 *   - Base score for first match: 0.5
 *   - Each additional match:     +0.15 (diminishing)
 *   - Multi-word pattern bonus:  +0.1  per multi-word match (capped contribution)
 *   - Position bonus:            +0.1  if earliest match is in first 100 chars
 *
 * The result is clamped to [0.0, 1.0].
 */
function computeRouteConfidence(value, patterns) {
  let matchCount = 0;
  let multiWordMatches = 0;
  let earliestPos = Infinity;

  for (const p of patterns) {
    const pos = value.indexOf(p);
    if (pos !== -1) {
      matchCount++;
      if (pos < earliestPos) earliestPos = pos;
      // A pattern with a space is multi-word → more specific
      if (p.includes(" ")) multiWordMatches++;
    }
  }

  if (matchCount === 0) return { confidence: 0, matchCount: 0, earliestPos: Infinity };

  let score = 0.5;                                         // base for first match
  score += Math.min((matchCount - 1) * 0.15, 0.3);        // additional matches
  score += Math.min(multiWordMatches * 0.1, 0.2);         // specificity bonus
  if (earliestPos < 100) score += 0.1;                     // position bonus

  const confidence = Math.min(Math.max(score, 0), 1);
  return { confidence: Math.round(confidence * 100) / 100, matchCount, earliestPos };
}

/**
 * Compute a confidence score for PDCA compound patterns.
 * Compound patterns are already multi-word and specific, so base is higher.
 *
 *   - Base for a compound match: 0.7
 *   - Compound pattern with 3+ words: +0.1
 *   - Position bonus (first 100 chars): +0.1
 *   - Multiple compound matches: +0.1
 */
function computePdcaConfidence(value, compounds) {
  let matchCount = 0;
  let earliestPos = Infinity;
  let bestEntry = null;
  let hasLongPattern = false;

  for (const entry of compounds) {
    const pos = value.indexOf(entry.pattern);
    if (pos !== -1) {
      matchCount++;
      if (pos < earliestPos) {
        earliestPos = pos;
        bestEntry = entry;
      }
      if (entry.pattern.split(/\s+/).length >= 3) hasLongPattern = true;
    }
  }

  if (matchCount === 0) return { confidence: 0, matchCount: 0, entry: null };

  let score = 0.7;
  if (hasLongPattern) score += 0.1;
  if (earliestPos < 100) score += 0.1;
  if (matchCount > 1) score += 0.1;

  const confidence = Math.min(Math.max(score, 0), 1);
  return { confidence: Math.round(confidence * 100) / 100, matchCount, entry: bestEntry };
}

/** Format a confidence annotation for medium-confidence routing. */
function confidenceNote(confidence) {
  return ` (confidence: ${Math.round(confidence * 100)}%)`;
}

function buildExternalDispatchContext(plan) {
  const top = plan?.dispatch?.[0];
  if (!top) return null;

  const action = top.type === "skill"
    ? `the Skill tool with skill: "${top.name}"`
    : `the slash command "${top.invoke}"`;

  return `[ORCHESTRATOR] External capability selected for ${plan.intent}: ${top.invoke}. ` +
    `You MUST invoke ${action} before self-processing. ` +
    `After it returns, integrate the plugin result into the final answer instead of redoing the same work inline.`;
}

function shouldExternalDispatch(plan) {
  if (!plan || !Array.isArray(plan.dispatch) || plan.dispatch.length === 0) return false;
  if (["review", "commit", "frontend-design", "memory-research", "plan"].includes(plan.intent)) return true;

  const topScore = Number(plan.dispatch[0]?.score || 0);
  return plan.intent === "generic" && topScore >= 45;
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

/**
 * Find the earliest match position for an array of patterns in a string.
 * Returns Infinity if no pattern matches.
 */
function earliestMatchPos(value, patterns) {
  let earliest = Infinity;
  for (const p of patterns) {
    const m = typeof p === "string" ? value.indexOf(p) : value.search(p);
    if (m !== -1 && m < earliest) earliest = m;
  }
  return earliest;
}

// PDCA / knowledge-work keywords that signal primary intent
const KNOWLEDGE_INTENT_PATTERNS = [
  /\bresearch\b/, /\binvestigate\b/, /\blook up\b/, /\bsearch about\b/,
  /\banalyze\b/, /\banalysis\b/, /\breview this\b/, /\breview my\b/, /\breview the\b/,
  /\bwrite a report\b/, /\bwrite an article\b/, /\bwrite about\b/, /\bdraft a\b/,
  /\bimprove this\b/, /\brefine this\b/, /\biterate on\b/, /\bpolish this\b/,
  /\bswot\b/, /\brice analysis\b/, /\bokr\b/, /\bprd\b/, /\blean canvas\b/,
  /\bnewsletter\b/, /\barticle about\b/, /\bcard news\b/,
  /조사/, /리서치/, /찾아봐/, /알아봐/, /분석/, /리뷰/, /검토/,
  /뉴스레터/, /보고서/, /아티클/, /전략/, /개선/, /다듬/,
];

// Strong engineering patterns — these indicate actual engineering work and should
// NOT be overridden by a preceding knowledge keyword. "debug the auth flow" is
// engineering even if "analyze" appears before it.
const STRONG_ENGINEERING_PATTERNS = [
  /\bauth flow\b/,
  /\bstack trace\b/,
  /\bcypress\b/,
  /\bpostgres\b/,
  /\bdebug\b/,
  /\bbug\b/,
  /\bcompile\b/,
  /\bendpoint\b/,
  /(?:^|[\s(])[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java)\b/,
];

/**
 * Determine if the primary intent is knowledge work despite engineering terms.
 * True when:
 * 1. A knowledge keyword appears BEFORE the first engineering term, AND
 * 2. No strong engineering pattern is present anywhere in the prompt.
 *
 * e.g. "research React performance" → knowledge intent (React is weak/subject)
 * e.g. "analyze our failing auth flow" → engineering (auth flow is strong)
 */
function knowledgeIntentBeforeEngineering(value) {
  // If any strong engineering pattern is present, never override the guard
  if (matchesAny(value, STRONG_ENGINEERING_PATTERNS)) return false;

  const engPos = earliestMatchPos(value, ENGINEERING_PATTERNS);
  if (engPos === Infinity) return false; // no engineering term → irrelevant
  const kwPos = earliestMatchPos(value, KNOWLEDGE_INTENT_PATTERNS);
  return kwPos < engPos;
}

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

let pdcaResult = { confidence: 0, matchCount: 0, entry: null };

// Allow PDCA routing if: no engineering terms, OR knowledge intent precedes engineering terms
if (!engineeringPrompt || knowledgeIntentBeforeEngineering(lower)) {
  pdcaResult = computePdcaConfidence(lower, pdcaCompound);
}

if (pdcaResult.confidence >= 0.5 && pdcaResult.entry) {
  const pdcaMatch = pdcaResult.entry;
  const phaseHint =
    pdcaMatch.phases === "full"
      ? "full PDCA cycle (Plan→Do→Check→Act)"
      : pdcaMatch.phases === "check+act"
        ? "Check→Act cycle"
        : pdcaMatch.phases === "plan+do"
          ? "Plan→Do phases"
          : pdcaMatch.phases;

  const confNote = pdcaResult.confidence < 0.8
    ? confidenceNote(pdcaResult.confidence)
    : "";

  let ctx = `[ROUTING] This is a knowledge-work request requiring ${phaseHint}${confNote}. ` +
    `You MUST invoke the Skill tool with skill: "second-claude-code:pdca" BEFORE any other response. ` +
    `This takes priority over brainstorming, debugging, or other development skills.`;

  const dispatchGuide = generateDispatchGuide();
  if (dispatchGuide) {
    ctx += "\n\n" + dispatchGuide;
  }

  writeLastAutoRoute("second-claude-code:pdca");

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
  investigate: ["디버그", "버그", "에러", "원인", "실패", "고장", "문제"],
  translate: ["번역", "번역해", "영어로", "한국어로", "영문으로", "국문으로", "번역해줘"],
  unblock: ["차단됨", "안 열려", "안열려", "본문 못", "캡차", "긁어줘", "긁어줄", "스크래핑 우회", "차단 우회", "사이트 우회", "url 우회"],
};

const routes = [
  {
    patterns: [...ko.investigate, "debug", "bug", "error", "root cause", "failing", "failure", "broken", "unexpected behavior"],
    skill: "second-claude-code:investigate",
    label: "investigate",
  },
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
  {
    patterns: [...ko.translate, "translate", "translate this", "translate to english", "translate to korean", "in english", "in korean"],
    skill: "second-claude-code:translate",
    label: "translate",
  },
  {
    patterns: [
      ...ko.unblock,
      "blocked url", "blocked site", "blocked page", "captcha challenge",
      "cloudflare challenge", "waf bypass", "bypass block",
      "fetch this url", "scrape this", "scrape the page",
      "page won't load", "this site is blocked",
      "tls fingerprint", "anti-bot",
      "linkedin article", "twitter post", "x.com post", "naver blog post",
      "youtube transcript", "youtube subtitles", "reddit thread",
    ],
    skill: "second-claude-code:unblock",
    label: "unblock",
  },
];

let bestMatch = null;
let bestConfidence = 0;

const knowledgeLeadsEngineering = knowledgeIntentBeforeEngineering(lower);

for (const route of routes) {
  // Only block knowledge routes for engineering if engineering is truly the primary intent
  // (i.e., engineering term appears before any knowledge keyword)
  if (engineeringPrompt && !knowledgeLeadsEngineering) {
    const blockedForEngineering = [
      "research",
      "review",
      "write",
      "analyze",
      "refine",
      "collect",
      "discover",
      "investigate",
      "translate",
    ];
    if (blockedForEngineering.includes(route.label)) continue;
    if (route.label === "workflow") {
      const ciOrBuildWorkflow =
        /\b(ci|deployment|build|compile|repo|tests?|postgres|stack trace|api|function|component|auth)\b/.test(lower);
      if (!knowledgeWorkflowPrompt || ciOrBuildWorkflow) continue;
    }
  }

  const result = computeRouteConfidence(lower, route.patterns);
  if (result.confidence >= 0.5 && result.confidence > bestConfidence) {
    bestConfidence = result.confidence;
    bestMatch = route;
  }
}

// ──────────────────────────────────────────────
// Dynamic skill-check dispatch guide (built from plugin discovery)
// Replaces the old hardcoded genericGuide — updates automatically when
// plugins are installed or uninstalled.
// ──────────────────────────────────────────────

const dispatchGuide = generateDispatchGuide();

// Only inject dispatchGuide for substantive prompts (> 10 chars).
const shouldInjectGuide = input.trim().length > 10;
let externalPlan = null;

try {
  externalPlan = getDispatchPlan({ keyword: input });
} catch {
  externalPlan = null;
}

if (shouldExternalDispatch(externalPlan)) {
  const routing = buildExternalDispatchContext(externalPlan);
  writeLastAutoRoute(externalPlan.dispatch[0].name);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: shouldInjectGuide && dispatchGuide ? routing + "\n\n" + dispatchGuide : routing,
    },
  }));
} else if (bestMatch) {
  const confNote = bestConfidence < 0.8
    ? confidenceNote(bestConfidence)
    : "";
  const routing = `[ROUTING] This is a knowledge-work request (${bestMatch.label})${confNote}. ` +
    `You MUST invoke the Skill tool with skill: "${bestMatch.skill}" BEFORE any other response. ` +
    `This is a content/research task — use second-claude-code, not development skills like brainstorming or TDD.`;

  writeLastAutoRoute(bestMatch.skill);

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: shouldInjectGuide ? routing + "\n\n" + dispatchGuide : routing,
    },
  }));
} else if (shouldInjectGuide) {
  // No specific match — still provide dispatch guidance for substantive prompts
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: dispatchGuide,
    },
  }));
}

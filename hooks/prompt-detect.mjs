#!/usr/bin/env node

/**
 * UserPromptSubmit Hook — Auto-routing (Step 0)
 *
 * Detects user intent from natural language and suggests the matching
 * second-claude-code:* command.
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
const ko = {
  research: [
    "\uC870\uC0AC\uD574",
    "\uB9AC\uC11C\uCE58",
    "\uCC3E\uC544\uBD10",
    "\uC54C\uC544\uBD10",
    "\uAC80\uC0C9\uD574",
    "\uD0D0\uC0C9",
  ],
  write: [
    "\uB274\uC2A4\uB808\uD130",
    "\uBCF4\uACE0\uC11C",
    "\uB300\uBCF8",
    "\uC544\uD2F0\uD074",
    "\uAE00 \uC368",
    "\uC368\uC918",
    "\uC791\uC131\uD574",
    "\uCE74\uB4DC\uB274\uC2A4",
  ],
  analyze: [
    "\uBD84\uC11D\uD574",
    "\uC804\uB7B5",
  ],
  review: [
    "\uB9AC\uBDF0",
    "\uAC80\uD1A0",
    "\uD488\uC9C8",
    "\uCCB4\uD06C",
    "\uD53C\uB4DC\uBC31",
  ],
  loop: [
    "\uAC1C\uC120",
    "\uBC18\uBCF5",
    "\uB354 \uC88B\uAC8C",
    "\uB2E4\uB4EC\uC5B4",
  ],
  collect: [
    "\uC800\uC7A5",
    "\uCEA1\uCC98",
    "\uC815\uB9AC\uD574\uB46C",
    "\uBA54\uBAA8",
    "\uAE30\uB85D",
    "\uD074\uB9AC\uD551",
    "\uC218\uC9D1",
    "\uC218\uC9D1\uD574",
  ],
  pipeline: [
    "\uD30C\uC774\uD504\uB77C\uC778",
    "\uC790\uB3D9\uD654",
    "\uC6CC\uD06C\uD50C\uB85C\uC6B0",
  ],
  hunt: [
    "\uC2A4\uD0AC \uC788",
    "\uC5B4\uB5BB\uAC8C \uD574",
    "\uD560 \uC218 \uC788",
    "\uBC29\uBC95",
    "\uB3C4\uAD6C",
  ],
};

// Pattern → skill mapping (order matters — first match wins)
const routes = [
  {
    patterns: [
      ...ko.research,
      "research",
      "investigate",
      "look up",
      "search",
      "explore",
    ],
    skill: "second-claude-code:research",
    label: "research",
  },
  {
    patterns: [
      ...ko.review,
      "review",
      "quality",
      "check",
      "feedback",
    ],
    skill: "second-claude-code:review",
    label: "review",
  },
  {
    patterns: [
      ...ko.write,
      "newsletter",
      "report",
      "script",
      "article",
      "write",
      "draft",
      "card news",
    ],
    skill: "second-claude-code:write",
    label: "write",
  },
  {
    patterns: [
      ...ko.analyze,
      "swot",
      "rice",
      "okr",
      "prd",
      "lean canvas",
      "analyze",
      "strategy",
      "porter",
      "pestle",
      "persona",
      "journey",
      "pricing",
    ],
    skill: "second-claude-code:analyze",
    label: "analyze",
  },
  {
    patterns: [
      ...ko.loop,
      "improve",
      "iterate",
      "loop",
      "polish",
      "better",
    ],
    skill: "second-claude-code:loop",
    label: "loop",
  },
  {
    patterns: [
      ...ko.collect,
      "save",
      "collect",
      "note",
      "record",
      "clip",
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
      "skill",
      "hunt",
      "how do i",
      "how can i",
      "tool",
    ],
    skill: "second-claude-code:hunt",
    label: "hunt",
  },
];

for (const route of routes) {
  if (route.patterns.some((p) => lower.includes(p))) {
    console.log(
      `[second-claude-code:auto-route] Detected intent: ${route.label} → Consider using /${route.skill}`
    );
    break;
  }
}

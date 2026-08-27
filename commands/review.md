---
description: "Check/Verify phase -- multi-perspective review with consensus gate"
argument-hint: draft.md --preset content
---

Invoke the `/scc:review` command for multi-perspective quality review through the `review` skill.

## Context
- Current git status: !`git status --short`
- Current staged files: !`git diff --cached --stat`
- Active review state: !`CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-${CLAUDE_PLUGIN_ROOT}/.data}" node -e 'const fs=require("fs"),path=require("path"); const clean=v=>typeof v==="string"&&v.trim()?v.trim().replace(/[^a-zA-Z0-9._-]/g,"").slice(0,48):""; const session=clean(process.env.CLAUDE_SESSION_ID),prompt=clean(process.env.CLAUDE_PROMPT_ID),namespace=session&&prompt?session+"--"+prompt:(session||prompt),file=namespace?path.join(process.env.CLAUDE_PLUGIN_DATA,"state","review-aggregation-"+namespace+".json"):null; if(file&&fs.existsSync(file)) process.stdout.write(fs.readFileSync(file,"utf8")); else process.stdout.write("No namespaced review aggregation state (set CLAUDE_SESSION_ID)");'`

Review state is read from the session/prompt-namespaced aggregation file used by the hooks. When no session identifier is available, this context reports that state is unavailable rather than treating the legacy global file as the active review.

## Arguments
- Optional: file path to review (defaults to staged files)
- `--preset content|strategy|code|quick|full` (default: content)

## Your task
Perform the review now using the plugin's loaded `review` skill and the provided arguments.

- Return the actual review report directly.
- Do not say that you are invoking or have invoked a skill.

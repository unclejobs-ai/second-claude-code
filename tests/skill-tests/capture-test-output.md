# Collect Skill Test — "https://sdk.vercel.ai/docs 이거 저장해줘"

Test date: 2026-03-20
Skill: `/second-claude-code:collect`
Input: `https://sdk.vercel.ai/docs 이거 저장해줘`

---

## Step 1: Source Type Detection

- **Detected type**: URL
- **URL**: `https://sdk.vercel.ai/docs`
- **Note**: URL redirected (301) from `sdk.vercel.ai` to `ai-sdk.dev/docs`. Followed the redirect automatically.

## Step 2: Content Extraction

- **Method**: WebFetch with extraction prompt
- **Boilerplate stripped**: Yes — navigation, footer, sidebar elements excluded by WebFetch processing
- **Raw content size**: ~3,500 words of structured documentation content extracted
- **Content covers**: SDK purpose, 2 core modules, supported frameworks (7+), key APIs (generateText, streamText, tool, agent), design principles (provider abstraction, middleware, streaming-first)

## Step 3: Reduction to 3 Key Points + Summary

### Summary

The Vercel AI SDK is a TypeScript toolkit that unifies LLM integration across providers (Anthropic, OpenAI, Google, etc.) through two core modules: AI SDK Core for text/object/tool generation and AI SDK UI for framework-agnostic chat interfaces. Its architecture prioritizes provider abstraction, composable middleware, and streaming-first design.

### Key Points

1. **Provider abstraction layer**: A single unified API wraps multiple LLM providers, allowing switching between Anthropic, OpenAI, Google, and others without changing application code — solving the vendor lock-in problem at the SDK level.

2. **Dual-module architecture**: AI SDK Core handles generation (text, structured objects, tool calls, agents) while AI SDK UI provides framework-agnostic hooks (React, Vue, Svelte, Node.js) for chat interfaces — separating computation from presentation.

3. **Composable middleware system**: Language model middleware enables wrapping, extending, and customizing model behavior (reasoning extraction, JSON extraction, default settings) without modifying the core generation pipeline — a plugin architecture for LLM behavior.

## Step 4: Connection to Existing Knowledge

- **Target**: `references/design-principles.md`
- **Shared concept**: Composable architecture with small surface area
- **Explanation**: The AI SDK uses 2 core modules (Core + UI) composed through middleware to cover all LLM use cases. This mirrors second-claude's Principle #1 (Few but Deep: "Eight skills, not eighty") and Principle #7 (Composable: "The 8 core skills are building blocks, not endpoints"). Both systems explicitly reject feature sprawl in favor of deep, composable primitives that combine to cover infinite use cases.

## Step 5: PARA Classification

- **Category**: `resource`
- **Reasoning**: This is reference material about a technology/SDK. There is no active deadline (not a Project), it is not an ongoing responsibility (not an Area), and it is not inactive (not an Archive). It is potentially useful reference material for building AI-powered applications.

## Step 6: Duplicate Check

- **Performed**: Yes
- **Method**: Grep for `sdk.vercel.ai` and `ai-sdk.dev` across entire repository
- **Result**: No duplicates found

## Step 7: Storage

- **JSON**: `.data/knowledge/resources/vercel-ai-sdk-docs.json`
- **Markdown**: `.data/knowledge/resources/vercel-ai-sdk-docs.md`
- **Required fields present**: title, source, source_type, collected_at, category, tags, summary, key_points, connections

---

## Capture/Collect Skill Test Results
- Source type detected: URL
- Content extracted: yes
- Key points exactly 3: yes
- PARA classification: resource
- Connection made: "Composable architecture with small surface area" — linked to design-principles.md Principles #1 and #7 with specific quotes
- Duplicate check: performed
- Key weakness: The connector step was performed by the main agent rather than dispatched to a dedicated haiku subagent as specified in SKILL.md's Subagents section. The analyst step was also not delegated to a separate subagent. In production, these should be dispatched as independent lightweight agents for cost efficiency. Additionally, CLAUDE_PLUGIN_DATA was not set as an environment variable, so I used `.data/` as a reasonable fallback — in a real plugin runtime this path should come from the environment.
- Key strength: The connection is specific and grounded — it names exact principles (#1 Few but Deep, #7 Composable), quotes the design-principles.md text, and explains why the AI SDK's 2-module-plus-middleware architecture is structurally analogous. This avoids the gotcha of "superficial connections" (gotchas.md #3). The 3 key points each capture a distinct architectural dimension (provider layer, module split, middleware extensibility) rather than overlapping.
- Overall quality: 8/10

import test from "node:test";
import assert from "node:assert/strict";

import { parseSkillFrontmatter } from "../../hooks/lib/skill-metadata.mjs";

test("parseSkillFrontmatter reads optional platform and fallback metadata", () => {
  const source = `---\r
name: research\r
description: "Use when researching a topic through iterative web exploration and synthesis"\r
platforms: [macos, linux]\r
required_environment_variables:\r
  - name: JINA_API_KEY\r
    prompt: Jina API key\r
    required_for: enhanced web research\r
metadata:\r
  second_codex:\r
    fallback_for_capabilities: [web]\r
    requires_capabilities: [bash, web]\r
    supports_background: true\r
---\r
\r
# Research\r
`;

  const parsed = parseSkillFrontmatter(source);

  assert.equal(parsed.name, "research");
  assert.deepEqual(parsed.platforms, ["macos", "linux"]);
  assert.deepEqual(parsed.required_environment_variables, [
    {
      name: "JINA_API_KEY",
      prompt: "Jina API key",
      required_for: "enhanced web research",
    },
  ]);
  assert.deepEqual(parsed.metadata?.second_codex?.fallback_for_capabilities, ["web"]);
  assert.deepEqual(parsed.metadata?.second_codex?.requires_capabilities, ["bash", "web"]);
  assert.equal(parsed.metadata?.second_codex?.supports_background, true);
});

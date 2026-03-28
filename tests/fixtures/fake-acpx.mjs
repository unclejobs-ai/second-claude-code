#!/usr/bin/env node

function findAgent(args) {
  const candidates = ["codex", "claude", "gemini", "openclaw"];
  return args.find((arg) => candidates.includes(arg)) || "unknown";
}

const args = process.argv.slice(2);
const agent = findAgent(args);

if (process.env.FAKE_ACPX_FAIL_AGENT === agent) {
  console.error(`forced failure for ${agent}`);
  process.exit(17);
}

if (args.includes("sessions") && args.includes("ensure")) {
  process.stdout.write(`${JSON.stringify({ type: "session", status: "ensured", agent })}\n`);
  process.exit(0);
}

process.stdout.write(
  [
    JSON.stringify({ type: "thinking", text: `${agent} is thinking` }),
    JSON.stringify({ type: "tool_call", title: `tool by ${agent}`, status: "completed" }),
    JSON.stringify({ type: "assistant", text: `${agent} completed task successfully` }),
  ].join("\n") + "\n"
);

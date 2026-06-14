import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyAnswer,
  buildQuestion,
  classifyInterviewBudget,
  confirmTopology,
  createInitialState,
  finalizeState,
  findWeakestTarget,
  recordAutoModeFailure,
  resolveThreshold,
  runCli,
  validateAutoAnswerResponse,
  validateAutoResearchResponse,
} from "../../scripts/deep-interview-runner.mjs";
const KO_PREFIX = "\uD55C\uAD6D\uC5B4\uB85C";
const KO_ANSWER = "\uC131\uACF5 \uAE30\uC900\uC740 \uC0AC\uC6A9\uC790\uAC00 \uD1A0\uD3F4\uB85C\uC9C0, \uC810\uC218, \uC2B9\uC778 \uB300\uAE30 \uC2A4\uD399\uC744 \uD55C \uD750\uB984\uC5D0\uC11C \uD655\uC778\uD558\uB294 \uAC83\uC785\uB2C8\uB2E4.";
const KO_DECISION_QUESTION = "\uBB34\uC5C7\uC744 \uBC18\uB4DC\uC2DC \uACB0\uC815\uD574\uC57C \uD569\uB2C8\uAE4C";
const KO_METADATA = "\uBA54\uD0C0\uB370\uC774\uD130";
const KO_TOPOLOGY = "\uD1A0\uD3F4\uB85C\uC9C0";
const KO_APPROVAL = "\uBA85\uC2DC \uC2B9\uC778";
const KO_TOPOLOGY_OK = "\uD1A0\uD3F4\uB85C\uC9C0\uB294 \uB9DE\uC2B5\uB2C8\uB2E4.";

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "deep-interview-test-"));
}

function captureStdout(fn) {
  const writes = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk, ...args) => {
    writes.push(String(chunk));
    const callback = args.find((arg) => typeof arg === "function");
    callback?.();
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return writes.join("");
}

test("deep interview preserves multi-component topology and Korean approval output", () => {
  const root = tempRoot();
  try {
    const state = createInitialState({
      idea: `${KO_PREFIX} CSV ingest, normalize, review UI, export reports, docs Deep Interview improvement`,
      type: "brownfield",
      thresholdInfo: { threshold: 0.05, threshold_source: "default" },
      now: new Date("2026-06-13T00:00:00.000Z"),
    });

    assert.equal(state.language.code, "ko");
    assert.equal(state.threshold, 0.05);
    assert.equal(state.threshold_source, "default");
    assert.deepEqual(
      state.topology.components.map((component) => component.id),
      ["ingestion", "normalization", "review-ui", "export", "documentation", "interview-quality"],
    );

    const confirmed = confirmTopology(state, { now: new Date("2026-06-13T00:01:00.000Z") });
    assert.equal(confirmed.topology.status, "confirmed");
    assert.ok(confirmed.topology.confirmed_at);

    const answered = applyAnswer(
      confirmed,
      {
        question: "Round 1",
        answer: KO_ANSWER,
      },
      { now: new Date("2026-06-13T00:02:00.000Z") },
    );
    assert.equal(answered.round, 1);
    assert.ok(answered.current_ambiguity < 1);
    assert.equal(answered.ontology_snapshots.length, 1);

    for (const component of answered.topology.components) {
      component.clarity_scores = { goal: 0.95, constraints: 0.95, criteria: 0.95, context: 0.95 };
    }
    answered.topology.components[0].clarity_scores.goal = 0;
    answered.topology.components[1].clarity_scores.goal = 0;
    answered.topology.last_targeted_component_id = answered.topology.components[0].id;
    const target = findWeakestTarget(answered.topology.components, answered.topology.last_targeted_component_id, answered.type);
    assert.equal(target.component_id, answered.topology.components[1].id);
    assert.match(buildQuestion(target, answered.language), new RegExp(KO_DECISION_QUESTION));

    const finalized = finalizeState(answered, {
      root,
      slug: "korean-topology-flow",
      now: new Date("2026-06-13T00:03:00.000Z"),
    });
    assert.equal(finalized.status, "pending_approval");
    assert.match(finalized.spec_path, /\.gjc\/specs\/deep-interview-korean-topology-flow\.md$/);
    assert.ok(finalized.spec_path.startsWith(root));
    const spec = readFileSync(finalized.spec_path, "utf8");
    assert.match(spec, new RegExp(`## ${KO_METADATA}`));
    assert.match(spec, new RegExp(`## ${KO_TOPOLOGY}`));
    assert.match(spec, /Ingestion/);
    assert.match(spec, /Normalization/);
    assert.match(spec, /Review UI/);
    assert.match(spec, /Export/);
    assert.match(spec, /Documentation/);
    assert.match(spec, /Interview Quality/);
    assert.ok(finalized.approval_options.some((option) => option.id === "ralplan" && option.recommended));
    assert.ok(finalized.approval_options.some((option) => option.label.includes(KO_APPROVAL)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("auto-mode validators reject malformed responses without throwing and record diagnostics", () => {
  const badResearchPayloads = [
    null,
    [],
    { candidates: { answer: "not an array" } },
    { candidates: [{ answer: "Only one", rationale: "short", confidence: "high", fallback_note: "x" }] },
    { extra: true, candidates: [
      { answer: "A", rationale: "B", confidence: "certain", fallback_note: "" },
      { answer: "C", rationale: "D", confidence: "medium", fallback_note: "ok", source: "extra" },
    ] },
  ];

  for (const payload of badResearchPayloads) {
    assert.doesNotThrow(() => validateAutoResearchResponse(payload));
    assert.equal(validateAutoResearchResponse(payload).ok, false);
  }

  assert.equal(validateAutoResearchResponse({ candidates: [
    { answer: "A", rationale: "Because A", confidence: "low", fallback_note: "Fallback A" },
    { answer: "B", rationale: "Because B", confidence: "medium", fallback_note: "Fallback B" },
    { answer: "C", rationale: "Because C", confidence: "high", fallback_note: "Fallback C" },
  ] }).ok, true);

  const badAnswerPayloads = [
    null,
    { answer: "", rationale: "R", confidence: "high", uncertainty: "low" },
    { answer: "A", rationale: "R", confidence: "sure", uncertainty: "low" },
    { answer: "A", rationale: "R", confidence: "medium", uncertainty: "", source: "extra" },
  ];

  for (const payload of badAnswerPayloads) {
    assert.doesNotThrow(() => validateAutoAnswerResponse(payload));
    assert.equal(validateAutoAnswerResponse(payload).ok, false);
  }
  assert.equal(validateAutoAnswerResponse({
    answer: "Choose the safest manual fallback",
    rationale: "The supplied context is incomplete",
    confidence: "medium",
    uncertainty: "Needs user confirmation before threshold crossing",
  }).ok, true);

  const state = createInitialState({
    idea: "Improve auto fragment fallback privacy",
    thresholdInfo: { threshold: 0.05, threshold_source: "default" },
  });
  const failed = recordAutoModeFailure(state, {
    fragment: "auto-research-greenfield",
    round: 2,
    errors: ["candidates must contain 2-3 items"],
    now: new Date("2026-06-13T00:04:00.000Z"),
  });
  assert.equal(failed.architect_failures, 1);
  assert.deepEqual(failed.auto_mode_failures[0].errors, ["candidates must contain 2-3 items"]);
});

test("runner CLI uses injected state, boolean --json parsing, and approval non-execution", () => {
  const root = tempRoot();
  const store = { value: null, cleared: false, writes: 0 };
  const adapter = {
    read: () => store.value,
    write: (value) => {
      store.value = value;
      store.writes += 1;
      return value;
    },
    clear: () => {
      store.value = null;
      store.cleared = true;
    },
  };
  try {
    const startOut = captureStdout(() => runCli([
      "start",
      "--json",
      "--idea",
      `${KO_PREFIX} runtime auto docs approval improvement`,
    ], {
      root,
      adapter,
      now: new Date("2026-06-13T00:05:00.000Z"),
      env: { HOME: root },
    }));
    const started = JSON.parse(startOut);
    assert.equal(started.active, true);
    assert.equal(started.threshold, 0.05);
    assert.equal(store.value.topology.status, "pending");

    const answerOut = captureStdout(() => runCli(["answer", "--json", "--answer", KO_TOPOLOGY_OK], {
      root,
      adapter,
      now: new Date("2026-06-13T00:06:00.000Z"),
      env: { HOME: root },
    }));
    const answered = JSON.parse(answerOut);
    assert.equal(answered.active, true);
    assert.ok(Number.parseFloat(answered.ambiguity) < 100);
    assert.equal(store.value.topology.status, "confirmed");

    const finalizeOut = captureStdout(() => runCli(["finalize", "--json", "--slug", "cli-non-execution"], {
      root,
      adapter,
      now: new Date("2026-06-13T00:07:00.000Z"),
      env: { HOME: root },
    }));
    const finalized = JSON.parse(finalizeOut);
    assert.match(finalized.spec_path, /deep-interview-cli-non-execution\.md$/);
    assert.equal(store.value.status, "pending_approval");
    assert.deepEqual(finalized.approval_options.map((option) => option.id), ["ralplan", "ultragoal", "team", "continue"]);
    assert.doesNotMatch(JSON.stringify(finalized), /\/skill:|gjc\s+(ralplan|ultragoal|team)/i);
    assert.equal(store.writes, 3);
    assert.equal(store.cleared, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("threshold resolution honors project override before user and default", () => {
  const root = tempRoot();
  const home = tempRoot();
  try {
    const userSettingsDir = join(home, ".gjc");
    const projectSettingsDir = join(root, ".gjc");
    mkdirSync(userSettingsDir, { recursive: true });
    mkdirSync(projectSettingsDir, { recursive: true });
    writeFileSync(join(userSettingsDir, "settings.json"), JSON.stringify({ gjc: { deepInterview: { ambiguityThreshold: 0.2 } } }), "utf8");
    writeFileSync(join(projectSettingsDir, "settings.json"), JSON.stringify({ gjc: { deepInterview: { ambiguityThreshold: 0.07 } } }), "utf8");
    const project = resolveThreshold({ cwd: root, env: { HOME: home } });
    assert.equal(project.threshold, 0.07);
    assert.equal(project.threshold_source, "./.gjc/settings.json");

    rmSync(projectSettingsDir, { recursive: true, force: true });
    const user = resolveThreshold({ cwd: root, env: { HOME: home } });
    assert.equal(user.threshold, 0.2);
    assert.match(user.threshold_source, /\.gjc\/settings\.json$/);

    rmSync(userSettingsDir, { recursive: true, force: true });
    const fallback = resolveThreshold({ cwd: root, env: { HOME: home } });
    assert.equal(fallback.threshold, 0.05);
    assert.equal(fallback.threshold_source, "default");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("adaptive interview budget expands for risky multi-surface work", () => {
  assert.equal(classifyInterviewBudget("single question", [{ id: "one" }]).class, "simple");
  const complex = classifyInterviewBudget("auto approval state audit fragment privacy fallback", [
    { id: "runtime" },
    { id: "auto-mode" },
    { id: "docs" },
  ]);
  assert.equal(complex.class, "complex");
  assert.ok(complex.targetRounds.min >= 6);
});

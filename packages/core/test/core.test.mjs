import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const corePromise = import("../dist/index.js");

const CURRENT_HASH = "sha256:current";

function currentEvidence() {
  return [
    {
      kind: "artifact",
      artifactHash: CURRENT_HASH,
      producerId: "worker-1",
      result: "pass",
      timestamp: "2026-08-28T00:00:00.000Z"
    },
    {
      kind: "reviewer",
      artifactHash: CURRENT_HASH,
      producerId: "worker-1",
      reviewerId: "reviewer-1",
      result: "pass",
      timestamp: "2026-08-28T00:01:00.000Z"
    }
  ];
}

function gateInput(overrides = {}) {
  return {
    findings: [],
    evidence: currentEvidence(),
    currentArtifactHash: CURRENT_HASH,
    producerId: "worker-1",
    reviewRequired: true,
    independentProviderAvailable: true,
    independentReviewerAvailable: true,
    refineCount: 0,
    pivotCount: 0,
    ...overrides
  };
}

test("fixed mappings catch a PDCA phase routed to the wrong harness stage", async () => {
  const {
    HARNESS_STAGE_ORDER,
    PDCA_STAGE_MAP,
    pdcaPhaseForStage,
    stageForPdcaPhase
  } = await corePromise;

  assert.deepEqual(HARNESS_STAGE_ORDER, ["explore", "plan", "work", "critic", "promote"]);
  assert.deepEqual(PDCA_STAGE_MAP, {
    plan: "plan",
    do: "work",
    check: "critic",
    act: "promote"
  });
  assert.equal(stageForPdcaPhase("check"), "critic");
  assert.equal(pdcaPhaseForStage("explore"), null);
  assert.equal(pdcaPhaseForStage("work"), "do");
});

test("classification catches creator intent being downgraded by low complexity", async () => {
  const { classifyQualityProfile } = await corePromise;

  assert.equal(
    classifyQualityProfile({ complexity: "simple", risk: "low", creatorIntent: true }),
    "creator"
  );
});

test("classification catches explicit risk being ignored by simple complexity", async () => {
  const { classifyQualityProfile } = await corePromise;

  const cases = [
    [{ complexity: "simple", risk: "low", creatorIntent: false }, "minimal"],
    [{ complexity: "complex", risk: "low", creatorIntent: false }, "standard"],
    [{ complexity: "simple", risk: "high", creatorIntent: false }, "deep"],
    [{ complexity: "research", risk: "medium", creatorIntent: false }, "deep"]
  ];

  for (const [input, expected] of cases) {
    assert.equal(classifyQualityProfile(input), expected);
  }
});

test("plan validation catches an empty graph being dispatchable", async () => {
  const { validatePlan } = await corePromise;

  assert.deepEqual(validatePlan({ nodes: [] }).issues.map((issue) => issue.code), ["MISSING_NODES"]);
});

test("plan validation catches nodes without acceptance criteria", async () => {
  const { validatePlan } = await corePromise;
  const result = validatePlan({
    nodes: [{ id: "build", acceptanceCriteria: [], dependencies: [], fileOwnership: ["src/a.ts"] }]
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["MISSING_ACCEPTANCE_CRITERIA"]);
});

test("plan validation catches missing dependencies and dependency cycles", async () => {
  const { validatePlan } = await corePromise;
  const missing = validatePlan({
    nodes: [{ id: "build", acceptanceCriteria: ["passes"], dependencies: ["plan"], fileOwnership: [] }]
  });
  const cycle = validatePlan({
    nodes: [
      { id: "a", acceptanceCriteria: ["a done"], dependencies: ["b"], fileOwnership: [] },
      { id: "b", acceptanceCriteria: ["b done"], dependencies: ["a"], fileOwnership: [] }
    ]
  });

  assert.deepEqual(missing.issues.map((issue) => issue.code), ["MISSING_DEPENDENCY"]);
  assert.deepEqual(cycle.issues.map((issue) => issue.code), ["DEPENDENCY_CYCLE"]);
});

test("plan validation catches concurrent nodes claiming the same file", async () => {
  const { validatePlan } = await corePromise;
  const concurrent = validatePlan({
    nodes: [
      { id: "a", acceptanceCriteria: ["a done"], dependencies: [], fileOwnership: ["src/shared.ts"] },
      { id: "b", acceptanceCriteria: ["b done"], dependencies: [], fileOwnership: ["src/shared.ts"] }
    ]
  });
  const ordered = validatePlan({
    nodes: [
      { id: "a", acceptanceCriteria: ["a done"], dependencies: [], fileOwnership: ["src/shared.ts"] },
      { id: "b", acceptanceCriteria: ["b done"], dependencies: ["a"], fileOwnership: ["src/shared.ts"] }
    ]
  });

  assert.deepEqual(concurrent.issues.map((issue) => issue.code), ["OVERLAPPING_FILE_OWNERSHIP"]);
  assert.equal(ordered.valid, true);
});

test("evidence validation catches a worker approving its own artifact", async () => {
  const { validateEvidence } = await corePromise;
  const result = validateEvidence(
    [{
      kind: "reviewer",
      artifactHash: CURRENT_HASH,
      producerId: "worker-1",
      reviewerId: "worker-1",
      result: "pass",
      timestamp: "2026-08-28T00:00:00.000Z"
    }],
    { currentArtifactHash: CURRENT_HASH, producerId: "worker-1", reviewRequired: true }
  );

  assert.deepEqual(result.issues.map((issue) => issue.code), ["SELF_REVIEW"]);
});

test("evidence validation catches missing hashes and missing required review", async () => {
  const { validateEvidence } = await corePromise;
  const result = validateEvidence(
    [{
      kind: "test",
      artifactHash: "",
      producerId: "worker-1",
      result: "pass",
      timestamp: "2026-08-28T00:00:00.000Z"
    }],
    { currentArtifactHash: CURRENT_HASH, producerId: "worker-1", reviewRequired: true }
  );

  assert.deepEqual(result.issues.map((issue) => issue.code), ["MISSING_ARTIFACT_HASH", "MISSING_REVIEWER_EVIDENCE"]);
});

test("evidence validation catches missing identities without mislabeling them as self-review", async () => {
  const { validateEvidence } = await corePromise;
  const result = validateEvidence(
    [{
      kind: "reviewer",
      artifactHash: CURRENT_HASH,
      producerId: "",
      result: "pass",
      timestamp: "2026-08-28T00:00:00.000Z"
    }],
    { currentArtifactHash: CURRENT_HASH, producerId: "worker-1", reviewRequired: true }
  );

  assert.deepEqual(result.issues.map((issue) => issue.code), ["MISSING_PRODUCER_ID", "MISSING_REVIEWER_ID"]);
});

test("gate evaluation catches failed evidence being treated as proof", async () => {
  const { evaluateGate } = await corePromise;
  const evidence = currentEvidence().map((entry) => ({ ...entry, result: "fail" }));

  assert.equal(evaluateGate(gateInput({ evidence })), "unproven");
});

test("stale marking catches a verdict surviving an artifact hash change", async () => {
  const { markStaleEvidence, validateEvidence } = await corePromise;
  const stale = [{
    kind: "reviewer",
    artifactHash: "sha256:old",
    producerId: "worker-1",
    reviewerId: "reviewer-1",
    result: "pass",
    timestamp: "2026-08-28T00:00:00.000Z"
  }];

  assert.deepEqual(markStaleEvidence(stale, CURRENT_HASH).map((entry) => entry.stale), [true]);
  assert.deepEqual(
    validateEvidence(stale, {
      currentArtifactHash: CURRENT_HASH,
      producerId: "worker-1",
      reviewRequired: true
    }).issues.map((issue) => issue.code),
    ["STALE_EVIDENCE"]
  );
});

test("gate evaluation catches correctable findings being promoted instead of refined", async () => {
  const { evaluateGate } = await corePromise;
  const decision = evaluateGate(gateInput({
    findings: [{ kind: "implementation", severity: "medium", correctable: true, direction: "tighten" }]
  }));

  assert.equal(decision, "refine");
});

test("gate evaluation catches plan and acceptance defects being locally refined instead of pivoted", async () => {
  const { evaluateGate } = await corePromise;

  assert.equal(evaluateGate(gateInput({ findings: [{ kind: "plan", severity: "high", correctable: false }] })), "pivot");
  assert.equal(evaluateGate(gateInput({ findings: [{ kind: "acceptance", severity: "medium", correctable: false }] })), "pivot");
});

test("gate evaluation catches missing independent review being treated as proof", async () => {
  const { evaluateGate } = await corePromise;

  assert.equal(evaluateGate(gateInput({ independentReviewerAvailable: false })), "unproven");
  assert.equal(evaluateGate(gateInput({ independentProviderAvailable: false })), "unproven");
});

test("gate evaluation catches critical policy violations proceeding", async () => {
  const { evaluateGate } = await corePromise;

  assert.equal(
    evaluateGate(gateInput({ findings: [{ kind: "policy", severity: "critical", correctable: false }] })),
    "block"
  );
});

test("iteration bounds catch exhausted refine and pivot caps forcing proceed", async () => {
  const { DEFAULT_ITERATION_LIMITS, evaluateGate } = await corePromise;

  assert.deepEqual(DEFAULT_ITERATION_LIMITS, { refine: 3, pivot: 2 });
  assert.equal(evaluateGate(gateInput({
    findings: [{ kind: "implementation", severity: "medium", correctable: true, direction: "tighten" }],
    refineCount: 3
  })), "block");
  assert.equal(evaluateGate(gateInput({
    findings: [{ kind: "plan", severity: "high", correctable: false }],
    pivotCount: 2
  })), "block");
});

test("gate evaluation proceeds only with current independent evidence and no findings", async () => {
  const { evaluateGate } = await corePromise;

  assert.equal(evaluateGate(gateInput()), "proceed");
});

test("run completion catches standard runs skipping critic or promote", async () => {
  const { validateRunCompletion } = await corePromise;
  const run = {
    runId: "run-1",
    profile: "standard",
    currentStage: "promote",
    currentPhase: "act",
    score: 0.9,
    failures: [],
    iteration: 1,
    refineCount: 0,
    pivotCount: 0,
    gateDecision: "proceed",
    completedStages: ["explore", "plan", "work", "critic"]
  };

  assert.deepEqual(
    validateRunCompletion(run, currentEvidence()).issues.map((issue) => issue.code),
    ["MISSING_PROMOTE_STAGE"]
  );
});

test("run completion allows minimal evidence without mandatory critic and promote stages", async () => {
  const { validateRunCompletion } = await corePromise;
  const run = {
    runId: "run-minimal",
    profile: "minimal",
    currentStage: "work",
    currentPhase: "do",
    score: null,
    failures: [],
    iteration: 1,
    refineCount: 0,
    pivotCount: 0,
    gateDecision: "proceed",
    completedStages: ["explore", "plan", "work"]
  };

  assert.equal(validateRunCompletion(run, [currentEvidence()[0]]).valid, true);
  assert.deepEqual(validateRunCompletion(run, []).issues.map((issue) => issue.code), ["MISSING_COMPLETION_EVIDENCE"]);
});

test("evolution validation catches creator/evaluator and protected benchmark contamination", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const proposal = {
    candidateId: "candidate-1",
    creatorId: "agent-1",
    isolatedBranch: "",
    isolatedWorktree: "",
    changedAssets: ["benchmarks/held-out.json", "policy/gates.json", "evaluators/agent-1.md"],
    evaluatorId: "agent-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: currentEvidence(),
    humanApproval: "approved"
  };
  const result = validateEvolutionProposal(proposal, {
    evaluatorAssets: ["evaluators/agent-1.md"],
    policyAssets: ["policy/gates.json"],
    benchmarkAssets: ["benchmarks/held-out.json"]
  });

  assert.deepEqual(result.issues.map((issue) => issue.code), [
    "CREATOR_EVALUATOR_CONFLICT",
    "MISSING_ISOLATED_BRANCH",
    "MISSING_ISOLATED_WORKTREE",
    "EVALUATOR_ASSET_MODIFIED",
    "POLICY_ASSET_MODIFIED",
    "BENCHMARK_ASSET_MODIFIED",
    "HUMAN_APPROVAL_PREGRANTED"
  ]);
});

test("the shared fixture catches every documented cross-host contract regression", async () => {
  const core = await corePromise;
  const fixture = JSON.parse(await readFile(
    new URL("../fixtures/quality-contract.json", import.meta.url),
    "utf8"
  ));

  assert.equal(fixture.schemaVersion, 1);
  assert.deepEqual(
    fixture.cases.map((entry) => entry.id),
    [
      "valid-standard-run",
      "missing-acceptance-criteria",
      "self-review",
      "stale-artifact-verdict",
      "refine",
      "pivot",
      "reviewer-independence-unavailable",
      "refine-cap",
      "pivot-cap",
      "missing-promote",
      "invalid-creator-evaluator-benchmark-isolation"
    ]
  );

  for (const entry of fixture.cases) {
    let actual;
    if (entry.operation === "validatePlan") {
      actual = core.validatePlan(entry.input).issues.map((issue) => issue.code);
    } else if (entry.operation === "validateEvidence") {
      actual = core.validateEvidence(entry.input.evidence, entry.input.context).issues.map((issue) => issue.code);
    } else if (entry.operation === "evaluateGate") {
      actual = core.evaluateGate(entry.input);
    } else if (entry.operation === "validateRunCompletion") {
      actual = core.validateRunCompletion(entry.input.run, entry.input.evidence).issues.map((issue) => issue.code);
    } else if (entry.operation === "validateEvolutionProposal") {
      actual = core.validateEvolutionProposal(entry.input.proposal, entry.input.context).issues.map((issue) => issue.code);
    } else {
      assert.fail(`unsupported fixture operation: ${entry.operation}`);
    }
    assert.deepEqual(actual, entry.expected, entry.id);
  }
});

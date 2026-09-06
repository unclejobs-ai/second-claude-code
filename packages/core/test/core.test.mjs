import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const corePromise = import("@second-claude/core");

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

function evolutionEvidence(overrides = {}) {
  const {
    artifactHash = CURRENT_HASH,
    producerId = "creator-1",
    reviewerId = "reviewer-1",
    result = "pass"
  } = overrides;
  return [
    {
      kind: "artifact",
      artifactHash,
      producerId,
      result: "pass",
      timestamp: "2026-08-28T00:00:00.000Z"
    },
    {
      kind: "reviewer",
      artifactHash,
      producerId,
      reviewerId,
      result,
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

function completionContext(overrides = {}) {
  return {
    currentArtifactHash: CURRENT_HASH,
    producerId: "worker-1",
    independentReviewerAvailable: true,
    ...overrides
  };
}

function completedRun(overrides = {}) {
  return {
    runId: "run-complete",
    profile: "standard",
    currentStage: "promote",
    currentPhase: "act",
    score: 0.9,
    failures: [],
    iteration: 1,
    refineCount: 0,
    pivotCount: 0,
    gateDecision: "proceed",
    completedStages: ["explore", "plan", "work", "critic", "promote"],
    ...overrides
  };
}

function validIsolation(overrides = {}) {
  return {
    candidateId: "candidate-1",
    candidateBranch: "evolve/candidate-1",
    candidateWorktree: "/worktrees/candidate-1",
    branchExists: true,
    worktreeExists: true,
    baseBranch: "main",
    baseWorktree: "/repos/scc",
    hostCurrentBranch: "review/task-2",
    hostCurrentWorktree: "/worktrees/review-task-2",
    attestorId: "host-isolation-resolver",
    timestamp: "2026-08-28T00:00:00.000Z",
    ...overrides
  };
}

function evolutionContext(overrides = {}) {
  return {
    currentArtifactHash: CURRENT_HASH,
    evaluatorAssets: [],
    policyAssets: [],
    benchmarkAssets: [],
    evaluationTimestamp: "2026-08-28T00:05:00.000Z",
    maxAttestationAgeMs: 600_000,
    isolation: validIsolation(),
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

test("plan validation rejects blank node identities", async () => {
  const { validatePlan } = await corePromise;
  assert.deepEqual(
    validatePlan({ nodes: [{ id: "  ", acceptanceCriteria: ["done"] }] }).issues.map((issue) => issue.code),
    ["MISSING_NODE_ID"]
  );
  assert.deepEqual(
    validatePlan({ nodes: [{ id: null, acceptanceCriteria: ["done"] }] }).issues.map((issue) => issue.code),
    ["MISSING_NODE_ID"]
  );
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

test("plan validation catches transitive dependency ordering being misclassified as concurrent", async () => {
  const { validatePlan } = await corePromise;
  const result = validatePlan({
    nodes: [
      { id: "a", acceptanceCriteria: ["a done"], dependencies: [], fileOwnership: ["src/shared.ts"] },
      { id: "b", acceptanceCriteria: ["b done"], dependencies: ["a"], fileOwnership: [] },
      { id: "c", acceptanceCriteria: ["c done"], dependencies: ["b"], fileOwnership: ["src/shared.ts"] }
    ]
  });

  assert.equal(result.valid, true);
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

test("gate evaluation catches critical plan violations pivoting instead of blocking", async () => {
  const { evaluateGate } = await corePromise;

  assert.equal(
    evaluateGate(gateInput({ findings: [{ kind: "plan", severity: "critical", correctable: false }] })),
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

  assert.deepEqual(
    validateRunCompletion(
      completedRun({ completedStages: ["explore", "plan", "work", "critic"] }),
      currentEvidence(),
      completionContext()
    ).issues.map((issue) => issue.code),
    ["MISSING_PROMOTE_STAGE"]
  );
  assert.deepEqual(
    validateRunCompletion(
      completedRun({ completedStages: ["explore", "plan", "work", "promote"] }),
      currentEvidence(),
      completionContext()
    ).issues.map((issue) => issue.code),
    ["MISSING_CRITIC_STAGE"]
  );
});

test("run completion catches non-proceed decisions being marked complete", async () => {
  const { validateRunCompletion } = await corePromise;

  for (const gateDecision of ["block", "unproven", "refine", "pivot"]) {
    assert.deepEqual(
      validateRunCompletion(
        completedRun({ gateDecision }),
        currentEvidence(),
        completionContext()
      ).issues.map((issue) => issue.code),
      ["RUN_GATE_NOT_PROCEED"],
      gateDecision
    );
  }
});

test("run completion catches recorded failures being ignored", async () => {
  const { validateRunCompletion } = await corePromise;
  const result = validateRunCompletion(
    completedRun({ failures: ["tests failed"] }),
    currentEvidence(),
    completionContext()
  );

  assert.deepEqual(result.issues.map((issue) => issue.code), ["RUN_HAS_FAILURES"]);
});

test("run completion catches failed or stale evidence being accepted", async () => {
  const { validateRunCompletion } = await corePromise;
  const failed = currentEvidence().map((entry) => ({ ...entry, result: "fail" }));
  const stale = currentEvidence().map((entry) => ({ ...entry, artifactHash: "sha256:old" }));

  assert.deepEqual(
    validateRunCompletion(completedRun(), failed, completionContext()).issues.map((issue) => issue.code),
    ["FAILED_EVIDENCE", "FAILED_EVIDENCE", "MISSING_REVIEWER_EVIDENCE"]
  );
  assert.deepEqual(
    validateRunCompletion(completedRun(), stale, completionContext()).issues.map((issue) => issue.code),
    ["STALE_EVIDENCE", "STALE_EVIDENCE"]
  );
});

test("run completion catches artifact or reviewer evidence attributed to another producer", async () => {
  const { validateRunCompletion } = await corePromise;
  const [artifact, reviewer] = currentEvidence();

  assert.deepEqual(
    validateRunCompletion(
      completedRun(),
      [{ ...artifact, producerId: "worker-other" }, reviewer],
      completionContext()
    ).issues.map((issue) => issue.code),
    ["EVIDENCE_PRODUCER_MISMATCH"]
  );
  assert.deepEqual(
    validateRunCompletion(
      completedRun(),
      [artifact, { ...reviewer, producerId: "worker-other" }],
      completionContext()
    ).issues.map((issue) => issue.code),
    ["EVIDENCE_PRODUCER_MISMATCH"]
  );
});

test("run completion catches standard evidence without an independent reviewer", async () => {
  const { validateRunCompletion } = await corePromise;
  const artifactOnly = [currentEvidence()[0]];

  assert.deepEqual(
    validateRunCompletion(completedRun(), artifactOnly, completionContext()).issues.map((issue) => issue.code),
    ["MISSING_REVIEWER_EVIDENCE"]
  );
  assert.deepEqual(
    validateRunCompletion(
      completedRun(),
      currentEvidence(),
      completionContext({ independentReviewerAvailable: false })
    ).issues.map((issue) => issue.code),
    ["INDEPENDENT_REVIEW_UNAVAILABLE"]
  );
});

test("run completion catches deep and creator profiles bypassing critic or promote", async () => {
  const { validateRunCompletion } = await corePromise;

  for (const profile of ["deep", "creator"]) {
    assert.deepEqual(
      validateRunCompletion(
        completedRun({ profile, completedStages: ["explore", "plan", "work", "promote"] }),
        currentEvidence(),
        completionContext()
      ).issues.map((issue) => issue.code),
      ["MISSING_CRITIC_STAGE"],
      `${profile}:critic`
    );
    assert.deepEqual(
      validateRunCompletion(
        completedRun({ profile, completedStages: ["explore", "plan", "work", "critic"] }),
        currentEvidence(),
        completionContext()
      ).issues.map((issue) => issue.code),
      ["MISSING_PROMOTE_STAGE"],
      `${profile}:promote`
    );
    assert.equal(validateRunCompletion(
      completedRun({ profile }),
      currentEvidence(),
      completionContext()
    ).valid, true, profile);
  }
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

  assert.equal(validateRunCompletion(run, [currentEvidence()[0]], completionContext()).valid, true);
  assert.deepEqual(
    validateRunCompletion(run, [], completionContext()).issues.map((issue) => issue.code),
    ["MISSING_COMPLETION_EVIDENCE"]
  );
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
    validationEvidence: evolutionEvidence({ producerId: "agent-1" }),
    humanApproval: "approved"
  };
  const result = validateEvolutionProposal(proposal, evolutionContext({
    evaluatorAssets: ["evaluators/agent-1.md"],
    policyAssets: ["policy/gates.json"],
    benchmarkAssets: ["benchmarks/held-out.json"],
    isolation: undefined
  }));

  assert.deepEqual(result.issues.map((issue) => issue.code), [
    "CREATOR_EVALUATOR_CONFLICT",
    "MISSING_ISOLATED_BRANCH",
    "MISSING_ISOLATED_WORKTREE",
    "MISSING_ISOLATION_ATTESTATION",
    "EVALUATOR_ASSET_MODIFIED",
    "POLICY_ASSET_MODIFIED",
    "BENCHMARK_ASSET_MODIFIED",
    "HUMAN_APPROVAL_PREGRANTED"
  ]);
});

test("evolution validation catches nonblank branch and worktree claims without an attestation", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const proposal = {
    candidateId: "candidate-1",
    creatorId: "creator-1",
    isolatedBranch: "evolve/candidate-1",
    isolatedWorktree: "/worktrees/candidate-1",
    changedAssets: ["skills/review/SKILL.md"],
    evaluatorId: "evaluator-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: evolutionEvidence(),
    humanApproval: "pending"
  };
  const result = validateEvolutionProposal(proposal, evolutionContext({ isolation: undefined }));

  assert.deepEqual(result.issues.map((issue) => issue.code), ["MISSING_ISOLATION_ATTESTATION"]);
});

test("evolution validation requires auditable identities and a strict finite held-out improvement", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const valid = {
    candidateId: "candidate-1",
    creatorId: "creator-1",
    isolatedBranch: "evolve/candidate-1",
    isolatedWorktree: "/worktrees/candidate-1",
    changedAssets: [],
    evaluatorId: "evaluator-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: evolutionEvidence(),
    humanApproval: "pending"
  };

  const blank = validateEvolutionProposal({
    ...valid,
    candidateId: " ",
    creatorId: " ",
    evaluatorId: " ",
    heldOutBenchmarkId: " "
  }, evolutionContext());
  for (const code of [
    "MISSING_CANDIDATE_ID",
    "MISSING_CREATOR_ID",
    "MISSING_EVALUATOR_ID",
    "MISSING_HELD_OUT_BENCHMARK_ID"
  ]) assert.ok(blank.issues.some((issue) => issue.code === code), code);

  assert.ok(validateEvolutionProposal({ ...valid, baselineScore: Number.NaN }, evolutionContext())
    .issues.some((issue) => issue.code === "INVALID_BASELINE_SCORE"));
  assert.ok(validateEvolutionProposal({ ...valid, candidateScore: Number.NEGATIVE_INFINITY }, evolutionContext())
    .issues.some((issue) => issue.code === "INVALID_CANDIDATE_SCORE"));
  assert.ok(validateEvolutionProposal({ ...valid, candidateScore: valid.baselineScore }, evolutionContext())
    .issues.some((issue) => issue.code === "CANDIDATE_NOT_IMPROVED"));
  assert.ok(validateEvolutionProposal({ ...valid, candidateScore: 0.6 }, evolutionContext())
    .issues.some((issue) => issue.code === "CANDIDATE_NOT_IMPROVED"));
  const malformed = validateEvolutionProposal({
    ...valid,
    candidateId: null,
    evaluatorId: 7,
    heldOutBenchmarkId: null,
    isolatedBranch: null,
    isolatedWorktree: 7
  }, evolutionContext());
  for (const code of [
    "MISSING_CANDIDATE_ID",
    "MISSING_EVALUATOR_ID",
    "MISSING_HELD_OUT_BENCHMARK_ID",
    "MISSING_ISOLATED_BRANCH",
    "MISSING_ISOLATED_WORKTREE"
  ]) assert.ok(malformed.issues.some((issue) => issue.code === code), code);
});

test("evolution validation requires current passing independent candidate evidence", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const proposal = {
    candidateId: "candidate-1",
    creatorId: "creator-1",
    isolatedBranch: "evolve/candidate-1",
    isolatedWorktree: "/worktrees/candidate-1",
    changedAssets: [],
    evaluatorId: "evaluator-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: evolutionEvidence(),
    humanApproval: "pending"
  };

  assert.equal(validateEvolutionProposal(proposal, evolutionContext()).valid, true);
  assert.deepEqual(
    validateEvolutionProposal(
      { ...proposal, validationEvidence: [] },
      evolutionContext()
    ).issues.map((issue) => issue.code),
    ["MISSING_REVIEWER_EVIDENCE"]
  );
  assert.deepEqual(
    validateEvolutionProposal(
      { ...proposal, validationEvidence: evolutionEvidence({ artifactHash: "sha256:stale" }) },
      evolutionContext()
    ).issues.map((issue) => issue.code),
    ["STALE_EVIDENCE", "STALE_EVIDENCE"]
  );
  assert.deepEqual(
    validateEvolutionProposal(
      { ...proposal, validationEvidence: evolutionEvidence({ result: "fail" }) },
      evolutionContext()
    ).issues.map((issue) => issue.code),
    ["FAILED_EVIDENCE", "MISSING_REVIEWER_EVIDENCE"]
  );
  assert.deepEqual(
    validateEvolutionProposal(
      { ...proposal, validationEvidence: evolutionEvidence({ reviewerId: "creator-1" }) },
      evolutionContext()
    ).issues.map((issue) => issue.code),
    ["SELF_REVIEW"]
  );
});

test("evolution validation catches attested branch and worktree identities that do not exist", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const proposal = {
    candidateId: "candidate-1",
    creatorId: "creator-1",
    isolatedBranch: "evolve/candidate-1",
    isolatedWorktree: "/worktrees/candidate-1",
    changedAssets: [],
    evaluatorId: "evaluator-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: evolutionEvidence(),
    humanApproval: "pending"
  };
  const result = validateEvolutionProposal(proposal, evolutionContext({
    isolation: validIsolation({ branchExists: false, worktreeExists: false })
  }));

  assert.deepEqual(result.issues.map((issue) => issue.code), [
    "ISOLATED_BRANCH_NOT_FOUND",
    "ISOLATED_WORKTREE_NOT_FOUND"
  ]);
});

test("evolution validation catches candidate isolation equal to the base or current workspace", async () => {
  const { validateEvolutionProposal } = await corePromise;
  for (const [branch, worktree] of [
    ["review/task-2", "/worktrees/review-task-2"],
    ["main", "/repos/scc"]
  ]) {
    const proposal = {
      candidateId: "candidate-1",
      creatorId: "creator-1",
      isolatedBranch: branch,
      isolatedWorktree: worktree,
      changedAssets: [],
      evaluatorId: "evaluator-1",
      heldOutBenchmarkId: "held-out-v1",
      baselineScore: 0.7,
      candidateScore: 0.8,
      validationEvidence: evolutionEvidence(),
      humanApproval: "pending"
    };
    const result = validateEvolutionProposal(proposal, evolutionContext({
      isolation: validIsolation({ candidateBranch: branch, candidateWorktree: worktree })
    }));

    assert.deepEqual(result.issues.map((issue) => issue.code), [
      "BRANCH_NOT_ISOLATED",
      "WORKTREE_NOT_ISOLATED"
    ], branch);
  }
});

test("evolution validation catches an attestation bound to a different candidate location", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const proposal = {
    candidateId: "candidate-1",
    creatorId: "creator-1",
    isolatedBranch: "evolve/candidate-1",
    isolatedWorktree: "/worktrees/candidate-1",
    changedAssets: [],
    evaluatorId: "evaluator-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: evolutionEvidence(),
    humanApproval: "pending"
  };
  const result = validateEvolutionProposal(proposal, evolutionContext({
    isolation: validIsolation({
      candidateBranch: "evolve/candidate-other",
      candidateWorktree: "/worktrees/candidate-other"
    })
  }));

  assert.deepEqual(result.issues.map((issue) => issue.code), ["ISOLATION_ATTESTATION_MISMATCH"]);
});

test("evolution validation catches creator or evaluator supplied isolation attestations", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const proposal = {
    candidateId: "candidate-1",
    creatorId: "creator-1",
    isolatedBranch: "evolve/candidate-1",
    isolatedWorktree: "/worktrees/candidate-1",
    changedAssets: [],
    evaluatorId: "evaluator-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: evolutionEvidence(),
    humanApproval: "pending"
  };

  for (const attestorId of ["creator-1", "evaluator-1"]) {
    const result = validateEvolutionProposal(proposal, evolutionContext({
      isolation: validIsolation({ attestorId })
    }));
    assert.deepEqual(result.issues.map((issue) => issue.code), ["ISOLATION_ATTESTOR_CONFLICT"]);
  }
});

test("evolution validation catches blank host isolation identities", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const proposal = {
    candidateId: "candidate-1",
    creatorId: "creator-1",
    isolatedBranch: "evolve/candidate-1",
    isolatedWorktree: "/worktrees/candidate-1",
    changedAssets: [],
    evaluatorId: "evaluator-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: evolutionEvidence(),
    humanApproval: "pending"
  };
  for (const field of [
    "candidateId",
    "candidateBranch",
    "candidateWorktree",
    "baseBranch",
    "baseWorktree",
    "hostCurrentBranch",
    "hostCurrentWorktree",
    "attestorId",
    "timestamp"
  ]) {
    const result = validateEvolutionProposal(proposal, evolutionContext({
      isolation: validIsolation({ [field]: " " })
    }));
    assert.deepEqual(
      result.issues.map((issue) => issue.code),
      ["INVALID_ISOLATION_ATTESTATION"],
      field
    );
  }
});

test("evolution validation catches stale isolation attestations at an explicit evaluation time", async () => {
  const { validateEvolutionProposal } = await corePromise;
  const proposal = {
    candidateId: "candidate-1",
    creatorId: "creator-1",
    isolatedBranch: "evolve/candidate-1",
    isolatedWorktree: "/worktrees/candidate-1",
    changedAssets: [],
    evaluatorId: "evaluator-1",
    heldOutBenchmarkId: "held-out-v1",
    baselineScore: 0.7,
    candidateScore: 0.8,
    validationEvidence: evolutionEvidence(),
    humanApproval: "pending"
  };
  const stale = validateEvolutionProposal(proposal, evolutionContext({
    evaluationTimestamp: "2026-08-28T00:10:00.001Z"
  }));
  const boundary = validateEvolutionProposal(proposal, evolutionContext({
    evaluationTimestamp: "2026-08-28T00:10:00.000Z"
  }));
  const invalidClock = validateEvolutionProposal(proposal, evolutionContext({
    evaluationTimestamp: "not-a-timestamp"
  }));
  const noncanonicalClock = validateEvolutionProposal(proposal, evolutionContext({
    isolation: validIsolation({ timestamp: "August 28, 2026 00:00:00 GMT" })
  }));
  const future = validateEvolutionProposal(proposal, evolutionContext({
    evaluationTimestamp: "2026-08-27T23:59:59.999Z"
  }));
  const invalidMaxAge = validateEvolutionProposal(proposal, evolutionContext({
    maxAttestationAgeMs: -1
  }));

  assert.deepEqual(stale.issues.map((issue) => issue.code), ["STALE_ISOLATION_ATTESTATION"]);
  assert.equal(boundary.valid, true);
  assert.deepEqual(invalidClock.issues.map((issue) => issue.code), ["INVALID_ISOLATION_ATTESTATION"]);
  assert.deepEqual(noncanonicalClock.issues.map((issue) => issue.code), ["INVALID_ISOLATION_ATTESTATION"]);
  assert.deepEqual(future.issues.map((issue) => issue.code), ["INVALID_ISOLATION_ATTESTATION"]);
  assert.deepEqual(invalidMaxAge.issues.map((issue) => issue.code), ["INVALID_ISOLATION_ATTESTATION"]);
});

test("the shared fixture catches every documented cross-host contract regression", async () => {
  const core = await corePromise;
  const fixtureUrl = import.meta.resolve("@second-claude/core/fixtures/quality-contract.json");
  const fixture = JSON.parse(await readFile(new URL(fixtureUrl), "utf8"));

  assert.equal(fixture.schemaVersion, 1);
  assert.deepEqual(
    fixture.cases.map((entry) => entry.id),
    [
      "valid-standard-run",
      "missing-acceptance-criteria",
      "blank-plan-node-id",
      "warning-reviewer-does-not-prove-gate",
      "warning-reviewer-does-not-complete-standard-run",
      "self-review",
      "stale-artifact-verdict",
      "refine",
      "pivot",
      "reviewer-independence-unavailable",
      "refine-cap",
      "pivot-cap",
      "missing-promote",
      "nonexistent-evolution-isolation",
      "current-evolution-isolation",
      "blank-evolution-isolation-attestation",
      "stale-evolution-isolation-attestation",
      "empty-evolution-validation-evidence",
      "untrusted-evolution-validation-evidence",
      "invalid-evolution-benchmark-comparison",
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
      actual = core.validateRunCompletion(
        entry.input.run,
        entry.input.evidence,
        entry.input.context
      ).issues.map((issue) => issue.code);
    } else if (entry.operation === "validateEvolutionProposal") {
      actual = core.validateEvolutionProposal(entry.input.proposal, entry.input.context).issues.map((issue) => issue.code);
    } else {
      assert.fail(`unsupported fixture operation: ${entry.operation}`);
    }
    assert.deepEqual(actual, entry.expected, entry.id);
  }
});

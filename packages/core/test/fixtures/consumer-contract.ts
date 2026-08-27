import {
  classifyQualityProfile,
  evaluateGate,
  validateEvolutionProposal,
  validateRunCompletion,
  type EvolutionProposal,
  type GateEvidence,
  type HarnessStage,
  type PdcaPhase,
  type QualityProfile,
  type QualityRunProjection
} from "@second-claude/core";

const profile: QualityProfile = classifyQualityProfile({
  complexity: "research",
  risk: "high",
  creatorIntent: false
});
const stages: readonly HarnessStage[] = ["explore", "plan", "work", "critic", "promote"];
const phase: PdcaPhase = "act";
const evidence: readonly GateEvidence[] = [
  {
    kind: "artifact",
    artifactHash: "sha256:current",
    producerId: "worker-1",
    result: "pass",
    timestamp: "2026-08-28T00:00:00.000Z"
  },
  {
    kind: "reviewer",
    artifactHash: "sha256:current",
    producerId: "worker-1",
    reviewerId: "reviewer-1",
    result: "pass",
    timestamp: "2026-08-28T00:01:00.000Z"
  }
];
const run: QualityRunProjection = {
  runId: "run-1",
  profile,
  currentStage: stages[4]!,
  currentPhase: phase,
  score: 0.9,
  failures: [],
  iteration: 1,
  refineCount: 0,
  pivotCount: 0,
  gateDecision: "proceed",
  completedStages: stages
};
const proposal: EvolutionProposal = {
  candidateId: "candidate-1",
  creatorId: "creator-1",
  isolatedBranch: "evolve/candidate-1",
  isolatedWorktree: "/worktrees/candidate-1",
  changedAssets: [],
  evaluatorId: "evaluator-1",
  heldOutBenchmarkId: "benchmark-1",
  baselineScore: 0.7,
  candidateScore: 0.8,
  validationEvidence: evidence,
  humanApproval: "pending"
};

evaluateGate({
  findings: [],
  evidence,
  currentArtifactHash: "sha256:current",
  producerId: "worker-1",
  reviewRequired: true,
  independentProviderAvailable: true,
  independentReviewerAvailable: true,
  refineCount: 0,
  pivotCount: 0
});
validateRunCompletion(run, evidence, {
  currentArtifactHash: "sha256:current",
  producerId: "worker-1",
  independentReviewerAvailable: true
});
validateEvolutionProposal(proposal, {
  evaluatorAssets: [],
  policyAssets: [],
  benchmarkAssets: [],
  isolation: {
    candidateId: "candidate-1",
    candidateBranch: "evolve/candidate-1",
    candidateWorktree: "/worktrees/candidate-1",
    branchExists: true,
    worktreeExists: true,
    baseBranch: "main",
    baseWorktree: "/repos/scc",
    hostCurrentBranch: "review/task-2",
    hostCurrentWorktree: "/worktrees/review-task-2",
    attestorId: "host-resolver",
    timestamp: "2026-08-28T00:00:00.000Z"
  }
});

// @ts-expect-error reviewer evidence must identify its reviewer
const reviewerWithoutIdentity: GateEvidence = {
  kind: "reviewer",
  artifactHash: "sha256:current",
  producerId: "worker-1",
  result: "pass",
  timestamp: "2026-08-28T00:00:00.000Z"
};

// @ts-expect-error every evidence kind must identify its producer
const artifactWithoutProducer: GateEvidence = {
  kind: "artifact",
  artifactHash: "sha256:current",
  result: "pass",
  timestamp: "2026-08-28T00:00:00.000Z"
};

void reviewerWithoutIdentity;
void artifactWithoutProducer;

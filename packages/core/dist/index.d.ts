export type QualityProfile = "minimal" | "standard" | "deep" | "creator";
export type HarnessStage = "explore" | "plan" | "work" | "critic" | "promote";
export type PdcaPhase = "plan" | "do" | "check" | "act";
export type GateDecision = "proceed" | "refine" | "pivot" | "block" | "unproven";
export type EvidenceKind = "artifact" | "reviewer" | "test" | "metric";
export type EvidenceResult = "pass" | "fail" | "warning" | number | boolean;
interface GateEvidenceBase {
    readonly artifactHash: string;
    readonly producerId: string;
    readonly result: EvidenceResult;
    readonly timestamp: string;
}
export type GateEvidence = GateEvidenceBase & ({
    readonly kind: "reviewer";
    readonly reviewerId: string;
} | {
    readonly kind: Exclude<EvidenceKind, "reviewer">;
    readonly reviewerId?: never;
});
export interface UnsafeGateEvidenceInput {
    readonly kind: EvidenceKind;
    readonly artifactHash: string;
    readonly producerId?: string;
    readonly reviewerId?: string;
    readonly result: EvidenceResult;
    readonly timestamp: string;
}
export interface QualityRunProjection {
    readonly runId: string;
    readonly profile: QualityProfile;
    readonly currentStage: HarnessStage;
    readonly currentPhase: PdcaPhase | null;
    readonly score: number | null;
    readonly failures: readonly string[];
    readonly iteration: number;
    readonly refineCount: number;
    readonly pivotCount: number;
    readonly gateDecision: GateDecision;
    readonly completedStages: readonly HarnessStage[];
}
export type HumanApprovalState = "pending" | "approved" | "rejected";
export interface EvolutionProposal {
    readonly candidateId: string;
    readonly creatorId: string;
    readonly isolatedBranch: string;
    readonly isolatedWorktree: string;
    readonly changedAssets: readonly string[];
    readonly evaluatorId: string;
    readonly heldOutBenchmarkId: string;
    readonly baselineScore: number;
    readonly candidateScore: number;
    readonly validationEvidence: readonly GateEvidence[];
    readonly humanApproval: HumanApprovalState;
}
export declare const HARNESS_STAGE_ORDER: readonly ["explore", "plan", "work", "critic", "promote"];
export declare const PDCA_STAGE_MAP: Readonly<{
    readonly plan: "plan";
    readonly do: "work";
    readonly check: "critic";
    readonly act: "promote";
}>;
export declare function stageForPdcaPhase(phase: PdcaPhase): HarnessStage;
export declare function pdcaPhaseForStage(stage: HarnessStage): PdcaPhase | null;
export type UncleCodeComplexity = "simple" | "complex" | "research";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export interface QualityClassificationInput {
    readonly complexity: UncleCodeComplexity;
    readonly risk: RiskLevel;
    readonly creatorIntent: boolean;
}
export declare function classifyQualityProfile(input: QualityClassificationInput): QualityProfile;
export interface PlanNode {
    readonly id: string;
    readonly acceptanceCriteria?: readonly string[];
    readonly dependencies?: readonly string[];
    readonly fileOwnership?: readonly string[];
}
export interface WorkPlan {
    readonly nodes?: readonly PlanNode[];
}
export type ValidationIssueCode = "MISSING_NODES" | "DUPLICATE_NODE_ID" | "MISSING_ACCEPTANCE_CRITERIA" | "MISSING_DEPENDENCY" | "DEPENDENCY_CYCLE" | "OVERLAPPING_FILE_OWNERSHIP" | "MISSING_ARTIFACT_HASH" | "MISSING_PRODUCER_ID" | "EVIDENCE_PRODUCER_MISMATCH" | "MISSING_REVIEWER_ID" | "FAILED_EVIDENCE" | "SELF_REVIEW" | "MISSING_REVIEWER_EVIDENCE" | "STALE_EVIDENCE" | "MISSING_COMPLETION_EVIDENCE" | "RUN_GATE_NOT_PROCEED" | "RUN_HAS_FAILURES" | "INDEPENDENT_REVIEW_UNAVAILABLE" | "MISSING_CRITIC_STAGE" | "MISSING_PROMOTE_STAGE" | "CREATOR_EVALUATOR_CONFLICT" | "MISSING_ISOLATED_BRANCH" | "MISSING_ISOLATED_WORKTREE" | "MISSING_ISOLATION_ATTESTATION" | "INVALID_ISOLATION_ATTESTATION" | "STALE_ISOLATION_ATTESTATION" | "ISOLATION_ATTESTATION_MISMATCH" | "ISOLATION_ATTESTOR_CONFLICT" | "ISOLATED_BRANCH_NOT_FOUND" | "ISOLATED_WORKTREE_NOT_FOUND" | "BRANCH_NOT_ISOLATED" | "WORKTREE_NOT_ISOLATED" | "EVALUATOR_ASSET_MODIFIED" | "POLICY_ASSET_MODIFIED" | "BENCHMARK_ASSET_MODIFIED" | "HUMAN_APPROVAL_PREGRANTED";
export interface ValidationIssue {
    readonly code: ValidationIssueCode;
    readonly message: string;
    readonly nodeIds?: readonly string[];
    readonly asset?: string;
}
export interface ValidationResult {
    readonly valid: boolean;
    readonly issues: readonly ValidationIssue[];
}
export declare function validatePlan(plan: WorkPlan | null | undefined): ValidationResult;
export type MarkedGateEvidence = GateEvidence & {
    readonly stale: boolean;
};
export declare function markStaleEvidence(evidence: readonly GateEvidence[], currentArtifactHash: string): readonly MarkedGateEvidence[];
export interface EvidenceValidationContext {
    readonly currentArtifactHash: string;
    readonly producerId: string;
    readonly reviewRequired: boolean;
}
export declare function validateEvidence(evidence: readonly UnsafeGateEvidenceInput[], context: EvidenceValidationContext): ValidationResult;
export type GateFindingKind = "implementation" | "plan" | "acceptance" | "policy";
export type FindingSeverity = "low" | "medium" | "high" | "critical";
export interface GateFinding {
    readonly kind: GateFindingKind;
    readonly severity: FindingSeverity;
    readonly correctable: boolean;
    readonly direction?: string;
}
export interface IterationLimits {
    readonly refine: number;
    readonly pivot: number;
}
export declare const DEFAULT_ITERATION_LIMITS: Readonly<{
    refine: 3;
    pivot: 2;
}>;
export interface GateEvaluationInput extends EvidenceValidationContext {
    readonly findings: readonly GateFinding[];
    readonly evidence: readonly GateEvidence[];
    readonly independentProviderAvailable: boolean;
    readonly independentReviewerAvailable: boolean;
    readonly refineCount: number;
    readonly pivotCount: number;
    readonly limits?: Partial<IterationLimits>;
}
export declare function evaluateGate(input: GateEvaluationInput): GateDecision;
export interface RunCompletionValidationContext {
    readonly currentArtifactHash: string;
    readonly producerId: string;
    readonly independentReviewerAvailable: boolean;
    readonly reviewRequired?: boolean;
}
export declare function validateRunCompletion(run: QualityRunProjection, evidence: readonly GateEvidence[], context: RunCompletionValidationContext): ValidationResult;
export interface EvolutionIsolationAttestation {
    readonly candidateId: string;
    readonly candidateBranch: string;
    readonly candidateWorktree: string;
    readonly branchExists: boolean;
    readonly worktreeExists: boolean;
    readonly baseBranch: string;
    readonly baseWorktree: string;
    readonly hostCurrentBranch: string;
    readonly hostCurrentWorktree: string;
    readonly attestorId: string;
    readonly timestamp: string;
}
export interface EvolutionValidationContext {
    readonly evaluatorAssets: readonly string[];
    readonly policyAssets: readonly string[];
    readonly benchmarkAssets: readonly string[];
    readonly evaluationTimestamp: string;
    readonly maxAttestationAgeMs: number;
    readonly isolation?: EvolutionIsolationAttestation;
}
export declare function validateEvolutionProposal(proposal: EvolutionProposal, context: EvolutionValidationContext): ValidationResult;
export {};
//# sourceMappingURL=index.d.ts.map
export const HARNESS_STAGE_ORDER = [
    "explore",
    "plan",
    "work",
    "critic",
    "promote"
];
export const PDCA_STAGE_MAP = Object.freeze({
    plan: "plan",
    do: "work",
    check: "critic",
    act: "promote"
});
const STAGE_PDCA_MAP = Object.freeze({
    plan: "plan",
    work: "do",
    critic: "check",
    promote: "act"
});
export function stageForPdcaPhase(phase) {
    return PDCA_STAGE_MAP[phase];
}
export function pdcaPhaseForStage(stage) {
    return STAGE_PDCA_MAP[stage] ?? null;
}
export function classifyQualityProfile(input) {
    if (input.creatorIntent) {
        return "creator";
    }
    if (input.complexity === "research" || input.risk === "high" || input.risk === "critical") {
        return "deep";
    }
    if (input.complexity === "complex" || input.risk === "medium") {
        return "standard";
    }
    return "minimal";
}
function validationResult(issues) {
    return { valid: issues.length === 0, issues };
}
function isBlank(value) {
    return typeof value !== "string" || value.trim().length === 0;
}
function parseCanonicalUtcTimestamp(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
        return null;
    }
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? timestamp : null;
}
function reaches(startId, targetId, nodesById, visited = new Set()) {
    if (startId === targetId) {
        return true;
    }
    if (visited.has(startId)) {
        return false;
    }
    visited.add(startId);
    const node = nodesById.get(startId);
    return (node?.dependencies ?? []).some((dependencyId) => nodesById.has(dependencyId) && reaches(dependencyId, targetId, nodesById, visited));
}
function hasDependencyCycle(nodesById) {
    const visiting = new Set();
    const visited = new Set();
    const visit = (nodeId) => {
        if (visiting.has(nodeId)) {
            return true;
        }
        if (visited.has(nodeId)) {
            return false;
        }
        visiting.add(nodeId);
        for (const dependencyId of nodesById.get(nodeId)?.dependencies ?? []) {
            if (nodesById.has(dependencyId) && visit(dependencyId)) {
                return true;
            }
        }
        visiting.delete(nodeId);
        visited.add(nodeId);
        return false;
    };
    return [...nodesById.keys()].some(visit);
}
export function validatePlan(plan) {
    const nodes = plan?.nodes ?? [];
    if (nodes.length === 0) {
        return validationResult([{ code: "MISSING_NODES", message: "A plan must contain at least one node." }]);
    }
    const issues = [];
    const nodesById = new Map();
    for (const node of nodes) {
        if (isBlank(node.id)) {
            issues.push({
                code: "MISSING_NODE_ID",
                message: "Every plan node needs a nonblank id."
            });
            continue;
        }
        if (nodesById.has(node.id)) {
            issues.push({
                code: "DUPLICATE_NODE_ID",
                message: `Plan node id is duplicated: ${node.id}.`,
                nodeIds: [node.id]
            });
        }
        else {
            nodesById.set(node.id, node);
        }
    }
    for (const node of nodes) {
        if (!(node.acceptanceCriteria ?? []).some((criterion) => criterion.trim().length > 0)) {
            issues.push({
                code: "MISSING_ACCEPTANCE_CRITERIA",
                message: `Plan node ${node.id} needs at least one acceptance criterion.`,
                nodeIds: [node.id]
            });
        }
        for (const dependencyId of node.dependencies ?? []) {
            if (!nodesById.has(dependencyId)) {
                issues.push({
                    code: "MISSING_DEPENDENCY",
                    message: `Plan node ${node.id} depends on missing node ${dependencyId}.`,
                    nodeIds: [node.id, dependencyId]
                });
            }
        }
    }
    if (hasDependencyCycle(nodesById)) {
        issues.push({ code: "DEPENDENCY_CYCLE", message: "Plan dependencies contain a cycle." });
    }
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        const left = nodes[leftIndex];
        if (left === undefined) {
            continue;
        }
        for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
            const right = nodes[rightIndex];
            if (right === undefined || reaches(left.id, right.id, nodesById) || reaches(right.id, left.id, nodesById)) {
                continue;
            }
            const rightOwnership = new Set(right.fileOwnership ?? []);
            const overlap = (left.fileOwnership ?? []).find((asset) => rightOwnership.has(asset));
            if (overlap !== undefined) {
                issues.push({
                    code: "OVERLAPPING_FILE_OWNERSHIP",
                    message: `Concurrently dispatchable nodes ${left.id} and ${right.id} both own ${overlap}.`,
                    nodeIds: [left.id, right.id],
                    asset: overlap
                });
            }
        }
    }
    return validationResult(issues);
}
export function markStaleEvidence(evidence, currentArtifactHash) {
    return evidence.map((entry) => ({
        ...entry,
        stale: entry.artifactHash.length > 0 && entry.artifactHash !== currentArtifactHash
    }));
}
export function validateEvidence(evidence, context) {
    const issues = [];
    let hasPassingReviewerEvidence = false;
    for (const entry of evidence) {
        if (entry.artifactHash.trim().length === 0) {
            issues.push({ code: "MISSING_ARTIFACT_HASH", message: "Every evidence item needs an artifact hash." });
        }
        else if (entry.artifactHash !== context.currentArtifactHash) {
            issues.push({ code: "STALE_EVIDENCE", message: "Evidence is stale for the current artifact hash." });
        }
        if (isBlank(entry.producerId)) {
            issues.push({ code: "MISSING_PRODUCER_ID", message: "Evidence needs a producer identity." });
        }
        else if (entry.producerId !== context.producerId) {
            issues.push({
                code: "EVIDENCE_PRODUCER_MISMATCH",
                message: "Evidence is attributed to a producer other than the current artifact producer."
            });
        }
        if (entry.result === "fail" || entry.result === false) {
            issues.push({ code: "FAILED_EVIDENCE", message: "Failed evidence cannot prove the current artifact." });
        }
        if (entry.kind === "reviewer") {
            if (entry.result === "pass" || entry.result === true) {
                hasPassingReviewerEvidence = true;
            }
            if (isBlank(entry.reviewerId)) {
                issues.push({ code: "MISSING_REVIEWER_ID", message: "Reviewer evidence needs a reviewer identity." });
            }
            else if (entry.reviewerId === context.producerId
                || (entry.producerId !== undefined && entry.reviewerId === entry.producerId)) {
                issues.push({ code: "SELF_REVIEW", message: "An artifact producer cannot review its own output." });
            }
        }
    }
    if (context.reviewRequired && !hasPassingReviewerEvidence) {
        issues.push({
            code: "MISSING_REVIEWER_EVIDENCE",
            message: "Passing independent reviewer evidence is required."
        });
    }
    return validationResult(issues);
}
export const DEFAULT_ITERATION_LIMITS = Object.freeze({ refine: 3, pivot: 2 });
export function evaluateGate(input) {
    const limits = {
        refine: input.limits?.refine ?? DEFAULT_ITERATION_LIMITS.refine,
        pivot: input.limits?.pivot ?? DEFAULT_ITERATION_LIMITS.pivot
    };
    const evidenceValidation = validateEvidence(input.evidence, input);
    const criticalPolicyOrPlan = input.findings.some((finding) => finding.severity === "critical" && (finding.kind === "policy" || finding.kind === "plan"));
    const selfReview = evidenceValidation.issues.some((issue) => issue.code === "SELF_REVIEW");
    if (criticalPolicyOrPlan || selfReview) {
        return "block";
    }
    if (!input.independentProviderAvailable || !input.independentReviewerAvailable) {
        return "unproven";
    }
    if (!evidenceValidation.valid) {
        return "unproven";
    }
    const needsPivot = input.findings.some((finding) => finding.kind === "plan" || finding.kind === "acceptance");
    if (needsPivot) {
        return input.pivotCount >= limits.pivot ? "block" : "pivot";
    }
    if (input.findings.length > 0 && input.findings.every((finding) => finding.correctable)) {
        const directions = new Set(input.findings.map((finding) => finding.direction ?? "default"));
        if (directions.size === 1) {
            return input.refineCount >= limits.refine ? "block" : "refine";
        }
        return input.pivotCount >= limits.pivot ? "block" : "pivot";
    }
    return input.findings.length === 0 ? "proceed" : "block";
}
export function validateRunCompletion(run, evidence, context) {
    const issues = [];
    if (run.gateDecision !== "proceed") {
        issues.push({
            code: "RUN_GATE_NOT_PROCEED",
            message: `A run cannot complete with gate decision ${run.gateDecision}.`
        });
    }
    if (run.failures.length > 0) {
        issues.push({ code: "RUN_HAS_FAILURES", message: "A run with recorded failures cannot complete." });
    }
    if (!evidence.some((entry) => entry.artifactHash.trim().length > 0)) {
        issues.push({
            code: "MISSING_COMPLETION_EVIDENCE",
            message: "A completed run needs documented artifact-bound evidence."
        });
    }
    const requiresReview = run.profile !== "minimal" || context.reviewRequired === true;
    const evidenceValidation = validateEvidence(evidence, {
        currentArtifactHash: context.currentArtifactHash,
        producerId: context.producerId,
        reviewRequired: requiresReview
    });
    issues.push(...evidenceValidation.issues);
    if (requiresReview && !context.independentReviewerAvailable) {
        issues.push({
            code: "INDEPENDENT_REVIEW_UNAVAILABLE",
            message: "The required independent reviewer is unavailable."
        });
    }
    if (run.profile !== "minimal") {
        const completed = new Set(run.completedStages);
        if (!completed.has("critic")) {
            issues.push({ code: "MISSING_CRITIC_STAGE", message: `${run.profile} runs must complete the critic stage.` });
        }
        if (!completed.has("promote")) {
            issues.push({ code: "MISSING_PROMOTE_STAGE", message: `${run.profile} runs must complete the promote stage.` });
        }
    }
    return validationResult(issues);
}
export function validateEvolutionProposal(proposal, context) {
    const issues = [];
    if (isBlank(proposal.candidateId)) {
        issues.push({ code: "MISSING_CANDIDATE_ID", message: "Evolution requires a candidate id." });
    }
    if (isBlank(proposal.creatorId)) {
        issues.push({ code: "MISSING_CREATOR_ID", message: "Evolution requires a candidate creator id." });
    }
    if (isBlank(proposal.evaluatorId)) {
        issues.push({ code: "MISSING_EVALUATOR_ID", message: "Evolution requires an independent evaluator id." });
    }
    if (isBlank(proposal.heldOutBenchmarkId)) {
        issues.push({
            code: "MISSING_HELD_OUT_BENCHMARK_ID",
            message: "Evolution requires a held-out benchmark id."
        });
    }
    if (!Number.isFinite(proposal.baselineScore)) {
        issues.push({ code: "INVALID_BASELINE_SCORE", message: "The baseline score must be finite." });
    }
    if (!Number.isFinite(proposal.candidateScore)) {
        issues.push({ code: "INVALID_CANDIDATE_SCORE", message: "The candidate score must be finite." });
    }
    if (Number.isFinite(proposal.baselineScore)
        && Number.isFinite(proposal.candidateScore)
        && proposal.candidateScore <= proposal.baselineScore) {
        issues.push({
            code: "CANDIDATE_NOT_IMPROVED",
            message: "The candidate score must strictly improve on the held-out baseline."
        });
    }
    if (!isBlank(proposal.creatorId) && proposal.creatorId === proposal.evaluatorId) {
        issues.push({
            code: "CREATOR_EVALUATOR_CONFLICT",
            message: "A candidate creator cannot evaluate the same candidate."
        });
    }
    if (isBlank(proposal.isolatedBranch)) {
        issues.push({ code: "MISSING_ISOLATED_BRANCH", message: "Evolution requires an isolated branch." });
    }
    if (isBlank(proposal.isolatedWorktree)) {
        issues.push({ code: "MISSING_ISOLATED_WORKTREE", message: "Evolution requires an isolated worktree." });
    }
    const evidenceValidation = validateEvidence(proposal.validationEvidence, {
        currentArtifactHash: context.currentArtifactHash,
        producerId: proposal.creatorId,
        reviewRequired: true
    });
    issues.push(...evidenceValidation.issues);
    const isolation = context.isolation;
    if (isolation === undefined) {
        issues.push({
            code: "MISSING_ISOLATION_ATTESTATION",
            message: "Evolution requires host-resolved branch and worktree isolation evidence."
        });
    }
    else {
        const attestationTimestamp = parseCanonicalUtcTimestamp(isolation.timestamp);
        const evaluationTimestamp = parseCanonicalUtcTimestamp(context.evaluationTimestamp);
        const identityFields = [
            isolation.candidateId,
            isolation.candidateBranch,
            isolation.candidateWorktree,
            isolation.baseBranch,
            isolation.baseWorktree,
            isolation.hostCurrentBranch,
            isolation.hostCurrentWorktree,
            isolation.attestorId
        ];
        const invalidAttestation = identityFields.some((identity) => isBlank(identity))
            || attestationTimestamp === null
            || evaluationTimestamp === null
            || !Number.isFinite(context.maxAttestationAgeMs)
            || context.maxAttestationAgeMs < 0
            || (attestationTimestamp !== null && evaluationTimestamp !== null && attestationTimestamp > evaluationTimestamp);
        if (invalidAttestation) {
            issues.push({
                code: "INVALID_ISOLATION_ATTESTATION",
                message: "Isolation evidence needs complete identities, valid timestamps, and a nonnegative maximum age."
            });
        }
        else {
            if (evaluationTimestamp - attestationTimestamp > context.maxAttestationAgeMs) {
                issues.push({
                    code: "STALE_ISOLATION_ATTESTATION",
                    message: "Isolation evidence is older than the host-supplied maximum age."
                });
            }
            const bindingMismatch = isolation.candidateId !== proposal.candidateId
                || isolation.candidateBranch !== proposal.isolatedBranch
                || isolation.candidateWorktree !== proposal.isolatedWorktree;
            if (bindingMismatch) {
                issues.push({
                    code: "ISOLATION_ATTESTATION_MISMATCH",
                    message: "Isolation evidence is not bound to this candidate branch and worktree."
                });
            }
            else {
                if (!isolation.branchExists) {
                    issues.push({
                        code: "ISOLATED_BRANCH_NOT_FOUND",
                        message: `The attested candidate branch does not exist: ${proposal.isolatedBranch}.`
                    });
                }
                if (!isolation.worktreeExists) {
                    issues.push({
                        code: "ISOLATED_WORKTREE_NOT_FOUND",
                        message: `The attested candidate worktree does not exist: ${proposal.isolatedWorktree}.`
                    });
                }
                if (proposal.isolatedBranch === isolation.baseBranch
                    || proposal.isolatedBranch === isolation.hostCurrentBranch) {
                    issues.push({
                        code: "BRANCH_NOT_ISOLATED",
                        message: "The candidate branch matches the base or host current branch."
                    });
                }
                if (proposal.isolatedWorktree === isolation.baseWorktree
                    || proposal.isolatedWorktree === isolation.hostCurrentWorktree) {
                    issues.push({
                        code: "WORKTREE_NOT_ISOLATED",
                        message: "The candidate worktree matches the base or host current worktree."
                    });
                }
                if (isolation.attestorId === proposal.creatorId
                    || isolation.attestorId === proposal.evaluatorId) {
                    issues.push({
                        code: "ISOLATION_ATTESTOR_CONFLICT",
                        message: "Isolation evidence must come from a host resolver independent of creator and evaluator."
                    });
                }
            }
        }
    }
    const changedAssets = new Set(proposal.changedAssets);
    const protectedGroups = [
        [context.evaluatorAssets, "EVALUATOR_ASSET_MODIFIED", "evaluator"],
        [context.policyAssets, "POLICY_ASSET_MODIFIED", "policy"],
        [context.benchmarkAssets, "BENCHMARK_ASSET_MODIFIED", "held-out benchmark"]
    ];
    for (const [assets, code, label] of protectedGroups) {
        const modified = assets.find((asset) => changedAssets.has(asset));
        if (modified !== undefined) {
            issues.push({ code, message: `Candidate modified protected ${label} asset ${modified}.`, asset: modified });
        }
    }
    if (proposal.humanApproval === "approved") {
        issues.push({
            code: "HUMAN_APPROVAL_PREGRANTED",
            message: "Evolution proposals must begin with pending human approval."
        });
    }
    return validationResult(issues);
}
//# sourceMappingURL=index.js.map
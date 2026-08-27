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
    return value === undefined || value.trim().length === 0;
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
    let hasReviewerEvidence = false;
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
        if (entry.result === "fail" || entry.result === false) {
            issues.push({ code: "FAILED_EVIDENCE", message: "Failed evidence cannot prove the current artifact." });
        }
        if (entry.kind === "reviewer") {
            hasReviewerEvidence = true;
            if (isBlank(entry.reviewerId)) {
                issues.push({ code: "MISSING_REVIEWER_ID", message: "Reviewer evidence needs a reviewer identity." });
            }
            else if (entry.reviewerId === context.producerId
                || (entry.producerId !== undefined && entry.reviewerId === entry.producerId)) {
                issues.push({ code: "SELF_REVIEW", message: "An artifact producer cannot review its own output." });
            }
        }
    }
    if (context.reviewRequired && !hasReviewerEvidence) {
        issues.push({ code: "MISSING_REVIEWER_EVIDENCE", message: "Independent reviewer evidence is required." });
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
export function validateRunCompletion(run, evidence) {
    const issues = [];
    if (!evidence.some((entry) => entry.artifactHash.trim().length > 0)) {
        issues.push({
            code: "MISSING_COMPLETION_EVIDENCE",
            message: "A completed run needs documented artifact-bound evidence."
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
    if (proposal.creatorId === proposal.evaluatorId) {
        issues.push({
            code: "CREATOR_EVALUATOR_CONFLICT",
            message: "A candidate creator cannot evaluate the same candidate."
        });
    }
    if (proposal.isolatedBranch.trim().length === 0) {
        issues.push({ code: "MISSING_ISOLATED_BRANCH", message: "Evolution requires an isolated branch." });
    }
    if (proposal.isolatedWorktree.trim().length === 0) {
        issues.push({ code: "MISSING_ISOLATED_WORKTREE", message: "Evolution requires an isolated worktree." });
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
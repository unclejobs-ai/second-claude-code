#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

import { resolveProjectRoot } from "./lib/project-root.mjs";
import { readState, writeState, clearState, stateFilePath } from "./lib/coach-state.mjs";
import { writeStandard, listActiveStandards, supersedeStandard } from "./lib/standard-record.mjs";
import { appendVerdict } from "./lib/adversarial-log.mjs";

const DEFAULT_THRESHOLD = 0.05;

export function isDirectExecution(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  return argv1 ? resolve(fileURLToPath(metaUrl)) === resolve(argv1) : false;
}

export function parseJsonObject(text, fallback = null) {
  if (!text || !String(text).trim()) return fallback;
  try {
    const parsed = JSON.parse(String(text));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function readJsonFile(path, fallback = null, fs = { existsSync, readFileSync }) {
  if (!path || !fs.existsSync(path)) return fallback;
  return parseJsonObject(fs.readFileSync(path, "utf8"), fallback);
}

export function validThreshold(value) {
  return Number.isFinite(value) && value > 0 && value < 1;
}

export function resolveThreshold(options = {}) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const home = env.HOME || env.USERPROFILE || "";
  const configDir = home ? join(home, ".scc") : "";
  const userPath = options.userSettingsPath || (configDir ? join(configDir, "settings.json") : null);
  const projectPath = options.projectSettingsPath || join(cwd, ".scc", "settings.json");
  const readJson = options.readJson || ((path) => readJsonFile(path));

  const userValue = readJson(userPath)?.scc?.coach?.ambiguityThreshold;
  const projectValue = readJson(projectPath)?.scc?.coach?.ambiguityThreshold;

  if (validThreshold(projectValue)) {
    return thresholdResult(projectValue, "./.scc/settings.json");
  }
  if (validThreshold(userValue)) {
    return thresholdResult(userValue, userPath || "~/.scc/settings.json");
  }
  return thresholdResult(DEFAULT_THRESHOLD, "default");
}

function thresholdResult(threshold, source) {
  return {
    threshold,
    thresholdPercent: `${Math.round(threshold * 10000) / 100}%`,
    threshold_source: source,
    thresholdSource: source,
  };
}

export function inferLanguage(input = "") {
  if (/[\uAC00-\uD7A3]/.test(input)) {
    return { code: "ko", instruction: "Respond to the user in Korean." };
  }
  return { code: "en", instruction: "Respond to the user in English." };
}

export function classifyProjectType({ cwd = process.cwd(), idea = "", fs = { existsSync } } = {}) {
  const hasSource = ["package.json", "skills", "commands", "hooks", "src", "mcp"].some((entry) => fs.existsSync(join(cwd, entry)));
  const modifiesExisting = /\b(add|update|modify|fix|improve|integrate|refactor|docs?|command|skill|hook|runner)\b/i.test(idea);
  return hasSource && modifiesExisting ? "brownfield" : "greenfield";
}

export function summarizeInitialIdea(input, max = 1200) {
  const text = String(input || "").trim();
  if (text.length <= max) return { initial_idea: text, initial_context_summary: null };
  return {
    initial_idea: `${text.slice(0, max - 120).trim()}\n\n[Initial context summarized for prompt safety; raw input was longer.]`,
    initial_context_summary: `Oversized initial context summarized to ${max} characters while preserving the leading user intent and constraints.`,
  };
}

export function enumerateTopology(initialIdea = "", context = {}) {
  const text = String(initialIdea);
  const lower = text.toLowerCase();
  const candidates = [];
  const add = (id, name, description, evidence) => {
    if (!candidates.some((component) => component.id === id)) {
      candidates.push({ id, name, description, evidence: [evidence].filter(Boolean) });
    }
  };

  if (/\bingest|\bimport|\bload|csv|upload/.test(lower)) add("ingestion", "Ingestion", "Bring external input into the workflow safely.", "ingest/import/load/csv");
  if (/normaliz|transform|canonical|dedupe|clean/.test(lower)) add("normalization", "Normalization", "Transform raw input into a canonical, deduplicated shape.", "normalize/transform/canonical/dedupe");
  if (/review|approval|comment|ui|interface/.test(lower)) add("review-ui", "Review UI", "Let reviewers inspect, comment, and approve work.", "review/approval/comment/ui");
  if (/export|report|audit|download/.test(lower)) add("export", "Export", "Produce an auditable output or report.", "export/report/audit");
  if (/document|docs|readme|guide|manual/.test(lower)) add("documentation", "Documentation", "Document the feature so users can complete the flow without hidden knowledge.", "docs/readme/guide");
  if (/runner|cli|state|resume|lifecycle/.test(lower)) add("runtime", "Runtime", "Provide CLI and state lifecycle behavior.", "runner/cli/state/resume");
  if (/score|ambigu|question|interview|topology/.test(lower)) add("interview-quality", "Interview Quality", "Drive questions, scoring, topology, and clarity progress.", "score/ambiguity/question/topology");
  if (/fragment|auto|fallback|privacy|internal/.test(lower)) add("auto-mode-safety", "Auto Mode Safety", "Keep automatic assistance validated, private, and auditable.", "fragment/auto/fallback/privacy");

  if (candidates.length === 0) {
    const parts = text
      .split(/(?:\band\b|,|;|\n|→|->)/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .slice(0, 6);
    for (const [index, part] of parts.entries()) {
      add(`component-${index + 1}`, titleFromPhrase(part), part, part.slice(0, 120));
    }
  }

  if (candidates.length === 0) {
    add("primary-outcome", "Primary Outcome", "The main outcome described by the user.", text.slice(0, 120));
  }

  const bounded = candidates.slice(0, 6);
  return bounded.map((component) => ({
    ...component,
    status: "active",
    clarity_scores: { goal: null, constraints: null, criteria: null, context: null },
    weakest_dimension: null,
  }));
}

function titleFromPhrase(phrase) {
  const words = String(phrase).replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return words.length ? words.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ") : "Primary Outcome";
}

export function createInitialState({ idea, cwd = process.cwd(), now = new Date(), thresholdInfo = resolveThreshold({ cwd }), type, codebase_context = null } = {}) {
  const summary = summarizeInitialIdea(idea || "");
  const language = inferLanguage(summary.initial_idea);
  const projectType = type || classifyProjectType({ cwd, idea: summary.initial_idea });
  const components = enumerateTopology(summary.initial_idea, codebase_context);
  const budget = classifyInterviewBudget(summary.initial_idea, components);
  return {
    active: true,
    status: "topology_pending",
    run_id: `deep-${now.toISOString().replace(/[:.]/g, "-")}`,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    type: projectType,
    initial_idea: summary.initial_idea,
    initial_context_summary: summary.initial_context_summary,
    language,
    threshold: thresholdInfo.threshold,
    threshold_source: thresholdInfo.threshold_source,
    current_ambiguity: 1,
    round: 0,
    rounds: [],
    codebase_context,
    topology: {
      status: "pending",
      confirmed_at: null,
      components,
      deferrals: [],
      last_targeted_component_id: null,
    },
    budget,
    ontology_snapshots: [],
    challenge_modes_used: [],
    auto_researched_rounds: [],
    auto_answered_rounds: [],
    architect_failures: 0,
    approval_options: [],
  };
}

export function confirmTopology(state, { components, deferrals = [], now = new Date() } = {}) {
  const confirmed = structuredCloneCompat(state);
  confirmed.topology = {
    ...confirmed.topology,
    status: "confirmed",
    confirmed_at: now.toISOString(),
    components: (components || confirmed.topology.components).map((component) => ({ ...component, status: component.status || "active" })),
    deferrals,
  };
  confirmed.status = "interviewing";
  confirmed.updated_at = now.toISOString();
  return confirmed;
}

export function weightsForType(type) {
  return type === "brownfield"
    ? { goal: 0.35, constraints: 0.25, criteria: 0.25, context: 0.15 }
    : { goal: 0.4, constraints: 0.3, criteria: 0.3 };
}

export function computeAmbiguity(scores, type = "greenfield") {
  const weights = weightsForType(type);
  const clarity = Object.entries(weights).reduce((sum, [key, weight]) => sum + clampScore(scores?.[key] ?? 0) * weight, 0);
  return Math.max(0, Math.min(1, 1 - clarity));
}

export function classifyInterviewBudget(initialIdea = "", components = []) {
  const text = String(initialIdea);
  const componentCount = components.length;
  const complexitySignals = [
    componentCount >= 4,
    text.length > 800,
    /\b(compliance|security|migration|public api|approval|audit|multi[- ]?tenant)\b/i.test(text),
    /\b(auto|fragment|fallback|state|resume|handoff|integration)\b/i.test(text),
  ].filter(Boolean).length;
  if (complexitySignals >= 2) {
    return {
      class: "complex",
      targetRounds: { min: 6, typical: "8-10+", softWarning: 10 },
      rationale: "Multiple components or risk signals require deeper questioning while each round continues to show value.",
    };
  }
  return {
    class: "simple",
    targetRounds: { min: 2, typical: "3-5", softWarning: 10 },
    rationale: "Few components and low risk signals should converge quickly.",
  };
}

export function scoreFromTranscript(state, answer = "") {
  const answerSignal = Math.min(0.25, String(answer).trim().length / 1000);
  const roundSignal = Math.min(0.4, (state.round + 1) * 0.08);
  const topologySignal = state.topology.status === "confirmed" ? 0.2 : 0;
  const base = 0.25 + answerSignal + roundSignal + topologySignal;
  const dimensions = state.type === "brownfield" ? ["goal", "constraints", "criteria", "context"] : ["goal", "constraints", "criteria"];
  const scores = {};
  for (const [index, dimension] of dimensions.entries()) {
    scores[dimension] = clampScore(base - index * 0.03);
  }
  return scores;
}

function clampScore(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function findWeakestTarget(components, lastTargetedComponentId = null, type = "brownfield") {
  const dimensions = Object.keys(weightsForType(type));
  const active = components.filter((component) => component.status !== "deferred");
  const scored = active.flatMap((component) => dimensions.map((dimension) => ({
    component,
    dimension,
    score: component.clarity_scores?.[dimension] ?? 0,
  })));
  scored.sort((a, b) => a.score - b.score || rotateTie(a.component.id, b.component.id, lastTargetedComponentId));
  const target = scored[0];
  return {
    component_id: target?.component.id || active[0]?.id || "primary-outcome",
    component_name: target?.component.name || active[0]?.name || "Primary Outcome",
    dimension: target?.dimension || "goal",
    score: target?.score ?? 0,
    rationale: `Lowest clarity is ${target?.dimension || "goal"} for ${target?.component.name || "Primary Outcome"}.`,
  };
}

function rotateTie(a, b, last) {
  if (!last) return a.localeCompare(b);
  if (a === last) return 1;
  if (b === last) return -1;
  return a.localeCompare(b);
}

export function applyAnswer(state, answer, { now = new Date() } = {}) {
  const next = structuredCloneCompat(state);
  const roundNumber = (next.round || 0) + 1;
  const target = findWeakestTarget(next.topology.components, next.topology.last_targeted_component_id, next.type);
  const scores = scoreFromTranscript(next, answer);
  const ambiguity = computeAmbiguity(scores, next.type);
  for (const component of next.topology.components) {
    if (component.id === target.component_id) {
      component.clarity_scores = { ...component.clarity_scores, ...scores };
      component.weakest_dimension = target.dimension;
    }
  }
  const ontology = extractOntology(next, answer, roundNumber);
  next.round = roundNumber;
  next.rounds.push({
    round: roundNumber,
    component_id: target.component_id,
    target_dimension: target.dimension,
    question: buildQuestion(target, next.language),
    answer,
    scores,
    ambiguity,
    ontology,
    created_at: now.toISOString(),
  });
  next.current_ambiguity = ambiguity;
  next.ontology_snapshots.push(ontology);
  next.topology.last_targeted_component_id = target.component_id;
  next.status = ambiguity <= next.threshold ? "ready_to_finalize" : "interviewing";
  next.updated_at = now.toISOString();
  return next;
}

export function buildQuestion(target, language = { code: "en" }) {
  if (language.code === "ko") {
    return `${target.component_name}의 ${target.dimension} 명확성을 가장 크게 높이려면 무엇을 반드시 결정해야 합니까?`;
  }
  return `What decision would most improve ${target.dimension} clarity for ${target.component_name}?`;
}

export function extractOntology(state, answer, round) {
  const nouns = Array.from(new Set(String(`${state.initial_idea} ${answer}`).match(/[A-Z][A-Za-z0-9_-]{2,}|[a-z][a-z0-9_-]{3,}/g) || []))
    .slice(0, 12)
    .map((name) => ({ name, type: "mentioned concept", fields: [], relationships: [] }));
  const previous = state.ontology_snapshots.at?.(-1)?.entities || [];
  const stability = compareOntologySnapshots(previous, nouns);
  return { round, entities: nouns, ...stability };
}

export function compareOntologySnapshots(previous = [], current = []) {
  if (!previous.length || !current.length) {
    return { stability_ratio: null, matching_reasoning: "First comparable ontology snapshot or empty entity set." };
  }
  const previousNames = new Set(previous.map((entity) => entity.name));
  const currentNames = new Set(current.map((entity) => entity.name));
  const stable = [...currentNames].filter((name) => previousNames.has(name));
  const added = [...currentNames].filter((name) => !previousNames.has(name));
  const removed = [...previousNames].filter((name) => !currentNames.has(name));
  return {
    stability_ratio: current.length ? stable.length / current.length : null,
    stable_entities: stable,
    new_entities: added,
    removed_entities: removed,
    matching_reasoning: `Stable by name: ${stable.join(", ") || "none"}. New: ${added.join(", ") || "none"}. Removed: ${removed.join(", ") || "none"}.`,
  };
}

const CONFIDENCE_VALUES = new Set(["low", "medium", "high"]);

function requireExactKeys(value, allowed, label, errors) {
  for (const key of Object.keys(value || {})) {
    if (!allowed.has(key)) errors.push(`${label} unexpected key: ${key}`);
  }
}

function requireNonEmptyString(value, label, errors) {
  if (typeof value !== "string" || value.trim().length === 0) errors.push(`${label} is required`);
}

function requireConfidence(value, label, errors) {
  requireNonEmptyString(value, label, errors);
  if (typeof value === "string" && !CONFIDENCE_VALUES.has(value)) errors.push(`${label} must be low, medium, or high`);
}

export function validateAutoResearchResponse(response) {
  const errors = [];
  if (!response || typeof response !== "object" || Array.isArray(response)) errors.push("response must be an object");
  requireExactKeys(response, new Set(["candidates"]), "response", errors);
  const candidates = response?.candidates;
  if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 3) errors.push("candidates must contain 2-3 items");
  for (const [index, candidate] of (Array.isArray(candidates) ? candidates : []).entries()) {
    const label = `candidate ${index + 1}`;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    requireExactKeys(candidate, new Set(["answer", "rationale", "confidence", "fallback_note"]), label, errors);
    requireNonEmptyString(candidate.answer, `${label} answer`, errors);
    requireNonEmptyString(candidate.rationale, `${label} rationale`, errors);
    requireConfidence(candidate.confidence, `${label} confidence`, errors);
    requireNonEmptyString(candidate.fallback_note, `${label} fallback_note`, errors);
  }
  return { ok: errors.length === 0, errors };
}

export function validateAutoAnswerResponse(response) {
  const errors = [];
  if (!response || typeof response !== "object" || Array.isArray(response)) errors.push("response must be an object");
  requireExactKeys(response, new Set(["answer", "rationale", "confidence", "uncertainty"]), "response", errors);
  requireNonEmptyString(response?.answer, "answer", errors);
  requireNonEmptyString(response?.rationale, "rationale", errors);
  requireConfidence(response?.confidence, "confidence", errors);
  requireNonEmptyString(response?.uncertainty, "uncertainty", errors);
  return { ok: errors.length === 0, errors };
}

export function recordAutoModeFailure(state, { fragment, round, errors, now = new Date() }) {
  const next = structuredCloneCompat(state);
  next.architect_failures = (next.architect_failures || 0) + 1;
  next.auto_mode_failures = [...(next.auto_mode_failures || []), {
    fragment,
    round,
    errors: Array.isArray(errors) ? errors : [String(errors)],
    recorded_at: now.toISOString(),
  }];
  next.updated_at = now.toISOString();
  return next;
}

export function renderProgress(state) {
  const score = `${Math.round((state.current_ambiguity || 0) * 10000) / 100}%`;
  const target = findWeakestTarget(state.topology.components, state.topology.last_targeted_component_id, state.type);
  return {
    round: state.round,
    ambiguity: score,
    next_target: target,
    threshold: state.threshold,
    threshold_source: state.threshold_source,
    status: state.status,
  };
}

export function renderSpec(state, { title = "Coach Briefing", generatedAt = new Date() } = {}) {
  const ko = state.language?.code === "ko";
  const labels = ko
    ? {
        metadata: "메타데이터",
        generated: "생성 시각",
        type: "유형",
        threshold: "임계값",
        thresholdSource: "임계값 출처",
        ambiguity: "최종 모호성 점수",
        clarityBreakdown: "명확성 분석",
        dimensionGoal: "목표",
        dimensionConstraints: "제약",
        dimensionCriteria: "성공 기준",
        dimensionContext: "맥락",
        topology: "토폴로지",
        component: "컴포넌트",
        status: "상태",
        description: "설명",
        coverage: "커버리지",
        goal: "목표",
        constraints: "제약",
        nonGoals: "비목표",
        assumptions: "드러난 가정과 해결",
        technicalContext: "기술 맥락",
        ontology: "온톨로지",
        convergence: "온톨로지 수렴",
        criteria: "수용 기준",
        transcript: "인터뷰 기록",
        entity: "엔티티",
        entityType: "유형",
        fields: "필드",
        relationships: "관계",
        q: "질문",
        a: "답변",
        noRounds: "아직 scoring된 라운드가 없습니다.",
        notSpecified: "인터뷰에서 별도 지정되지 않았습니다.",
        noExplicitNonGoals: "명시적으로 제외된 범위가 아직 없습니다.",
        noAssumptions: "기록된 라운드에서 별도 해결 가정이 없습니다.",
        noOntology: "아직 추출된 엔티티가 없습니다.",
        criteriaRows: [
          "토폴로지는 scoring 전에 확인됐다.",
          "모호성은 임계값에 도달했거나 사용자가 남은 위험을 수락했다.",
          "실행은 승인 게이트 뒤에 남아 있다.",
        ],
      }
    : {
        metadata: "Metadata",
        generated: "Generated",
        type: "Type",
        threshold: "Threshold",
        thresholdSource: "Threshold Source",
        ambiguity: "Final Ambiguity Score",
        clarityBreakdown: "Clarity Breakdown",
        dimensionGoal: "Goal",
        dimensionConstraints: "Constraints",
        dimensionCriteria: "Success Criteria",
        dimensionContext: "Context",
        topology: "Topology",
        component: "Component",
        status: "Status",
        description: "Description",
        coverage: "Coverage",
        goal: "Goal",
        constraints: "Constraints",
        nonGoals: "Non-Goals",
        assumptions: "Assumptions Exposed & Resolved",
        technicalContext: "Technical Context",
        ontology: "Ontology (Key Entities)",
        convergence: "Ontology Convergence",
        criteria: "Acceptance Criteria",
        transcript: "Interview Transcript",
        entity: "Entity",
        entityType: "Type",
        fields: "Fields",
        relationships: "Relationships",
        q: "Q",
        a: "A",
        noRounds: "No scored rounds yet.",
        notSpecified: "Not separately specified during the interview.",
        noExplicitNonGoals: "No explicitly excluded scope has been recorded yet.",
        noAssumptions: "No separately resolved assumptions were recorded in the scored rounds.",
        noOntology: "No entities have been extracted yet.",
        criteriaRows: [
          "Topology was confirmed before scoring.",
          "Ambiguity reached the threshold or the user accepted remaining risk.",
          "Execution remains approval-gated.",
        ],
      };
  const rows = state.topology.components
    .map((component) => `| ${component.name} | ${component.status} | ${component.description} | ${component.weakest_dimension || (ko ? "확인됨" : "covered")} |`)
    .join("\n");
  const transcript = state.rounds
    .map((round) => `### Round ${round.round}\n**${labels.q}:** ${round.question}\n**${labels.a}:** ${round.answer}\n**${labels.ambiguity}:** ${Math.round(round.ambiguity * 10000) / 100}%`)
    .join("\n\n");
  const criteria = labels.criteriaRows.map((row) => `- [ ] ${row}`).join("\n");
  const clarityRows = state.topology.components
    .map((component) => `| ${component.name} | ${component.clarity_scores?.goal ?? "-"} | ${component.clarity_scores?.constraints ?? "-"} | ${component.clarity_scores?.criteria ?? "-"} | ${component.clarity_scores?.context ?? "-"} |`)
    .join("\n");
  const constraints = [
    ko ? `모호성 임계값은 ${state.threshold} (${state.threshold_source})입니다.` : `Ambiguity threshold is ${state.threshold} (${state.threshold_source}).`,
    ko ? "최종 실행은 명시 승인 뒤에만 진행됩니다." : "Execution may proceed only after explicit approval.",
  ].map((row) => `- ${row}`).join("\n");
  const assumptions = state.rounds.length
    ? state.rounds.map((round) => `| Round ${round.round} | ${round.question} | ${round.answer} |`).join("\n")
    : `| - | - | ${labels.noAssumptions} |`;
  const latestOntology = state.ontology_snapshots.at?.(-1);
  const ontologyRows = latestOntology?.entities?.length
    ? latestOntology.entities.map((entity) => `| ${entity.name} | ${entity.type} | ${(entity.fields || []).join(", ") || "-"} | ${(entity.relationships || []).join(", ") || "-"} |`).join("\n")
    : `| - | - | - | ${labels.noOntology} |`;
  const convergenceRows = state.ontology_snapshots.length
    ? state.ontology_snapshots.map((snapshot) => `| ${snapshot.round} | ${snapshot.entities?.length || 0} | ${(snapshot.new_entities || []).join(", ") || "-"} | ${(snapshot.stable_entities || []).join(", ") || "-"} | ${snapshot.stability_ratio == null ? "-" : `${Math.round(snapshot.stability_ratio * 100)}%`} |`).join("\n")
    : `| - | 0 | - | - | - |`;
  const technicalContext = state.type === "brownfield"
    ? (state.codebase_context || labels.notSpecified)
    : labels.notSpecified;
  return `# ${title}\n\n## ${labels.metadata}\n- ${labels.generated}: ${generatedAt.toISOString()}\n- ${labels.type}: ${state.type}\n- ${labels.threshold}: ${state.threshold}\n- ${labels.thresholdSource}: ${state.threshold_source}\n- ${labels.ambiguity}: ${Math.round((state.current_ambiguity || 0) * 10000) / 100}%\n\n## ${labels.clarityBreakdown}\n| ${labels.component} | ${labels.dimensionGoal} | ${labels.dimensionConstraints} | ${labels.dimensionCriteria} | ${labels.dimensionContext} |\n|---|---:|---:|---:|---:|\n${clarityRows}\n\n## ${labels.topology}\n| ${labels.component} | ${labels.status} | ${labels.description} | ${labels.coverage} |\n|-----------|--------|-------------|----------|\n${rows}\n\n## ${labels.goal}\n${state.initial_idea}\n\n## ${labels.constraints}\n${constraints}\n\n## ${labels.nonGoals}\n- ${labels.noExplicitNonGoals}\n\n## ${labels.criteria}\n${criteria}\n\n## ${labels.assumptions}\n| ${ko ? "라운드" : "Round"} | ${labels.q} | ${ko ? "해결" : "Resolution"} |\n|---|---|---|\n${assumptions}\n\n## ${labels.technicalContext}\n${technicalContext}\n\n## ${labels.ontology}\n| ${labels.entity} | ${labels.entityType} | ${labels.fields} | ${labels.relationships} |\n|---|---|---|---|\n${ontologyRows}\n\n## ${labels.convergence}\n| Round | Entity Count | New | Stable | Stability |\n|---|---:|---|---|---|\n${convergenceRows}\n\n## ${labels.transcript}\n${transcript || labels.noRounds}\n`;
}

export function renderApprovalOptions(standardIds, ambiguity, language = { code: "en" }) {
  const ko = language?.code === "ko";
  const count = Array.isArray(standardIds) ? standardIds.length : 0;
  return ko
    ? [
        { id: "confirm", label: `기준 ${count}개를 확정하고 인터뷰 종료`, recommended: true, standardIds, ambiguity },
        { id: "continue", label: "계속 정제하기", recommended: false, standardIds, ambiguity },
        { id: "plan-mode", label: "확정된 기준을 브리핑으로 Plan Mode에 넘기기", recommended: false, standardIds, ambiguity },
      ]
    : [
        { id: "confirm", label: `Confirm ${count} standard(s) and end the interview`, recommended: true, standardIds, ambiguity },
        { id: "continue", label: "Keep refining", recommended: false, standardIds, ambiguity },
        { id: "plan-mode", label: "Hand the confirmed standards to Plan Mode as a briefing", recommended: false, standardIds, ambiguity },
      ];
}

export function createStateAdapter({ root }) {
  return {
    read: () => readState(root),
    write: (value) => writeState(root, value),
    clear: () => clearState(root),
  };
}

// What finalize would be papering over if it ran right now. The spec allows a
// user to accept residual risk explicitly, so these are not hard stops -- but
// they have to be named and accepted on the record rather than passed in
// silence, which is what finalize used to do.
export function openRisks(state) {
  const out = [];
  const topologyStatus = state.topology?.status;
  if (topologyStatus !== "confirmed") {
    out.push(`topology is ${topologyStatus || "unknown"}, not confirmed`);
  }
  const ambiguity = state.current_ambiguity;
  if (typeof ambiguity === "number" && typeof state.threshold === "number" && ambiguity > state.threshold) {
    out.push(`ambiguity ${ambiguity.toFixed(3)} is above the ${state.threshold} threshold`);
  }
  return out;
}

export function finalizeState(state, { now = new Date(), acceptedRisk = null } = {}) {
  const next = structuredCloneCompat(state);
  next.standard_ids = Array.isArray(next.forks) ? [...next.forks] : [];
  next.approval_options = renderApprovalOptions(next.standard_ids, next.current_ambiguity, next.language);
  next.status = "pending_approval";
  if (acceptedRisk) {
    next.risk_accepted = {
      at: now.toISOString(),
      reason: acceptedRisk.reason,
      risks: acceptedRisk.risks,
      ambiguity: next.current_ambiguity,
      threshold: next.threshold,
    };
  }
  next.updated_at = now.toISOString();
  return next;
}

function structuredCloneCompat(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function parseArgs(argv) {
  const [command = "status", ...rest] = argv;
  const flags = {};
  const positionals = [];
  const booleanFlags = new Set(["json", "force"]);
  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    if (item.startsWith("--")) {
      const [rawKey, rawValue] = item.slice(2).split("=", 2);
      if (rawValue !== undefined) {
        flags[rawKey] = rawValue;
      } else if (!booleanFlags.has(rawKey) && rest[i + 1] && !rest[i + 1].startsWith("--")) {
        flags[rawKey] = rest[i + 1];
        i += 1;
      } else {
        flags[rawKey] = true;
      }
    } else {
      positionals.push(item);
    }
  }
  return { command, flags, positionals };
}

function output(value, json = false) {
  if (json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  } else if (typeof value === "string") {
    process.stdout.write(`${value}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  }
}

// A state file can be present and valid JSON while still missing the
// topology shape every scoring path assumes (hand-edited, truncated by a
// crashed writer before this field landed, produced by a future/older
// schema). Every other corruption path in this CLI degrades to a clear
// message (readState returns null on unparseable JSON; record-fork/hooks
// coerce a non-array forks to []) — this is the one place raw property
// access would otherwise leak a bare TypeError. Exit code stays 1: this is
// a genuine error, not a valid "no interview" state, so it must not report
// success.
function assertUsableTopology(state, root) {
  if (!state.topology || !Array.isArray(state.topology.components)) {
    throw new Error(
      `interview state at ${stateFilePath(root)} is missing usable topology data and can't be scored. ` +
        "Inspect the file directly, or run `clear` to discard it and start over."
    );
  }
}

export function runCli(argv = process.argv.slice(2), deps = {}) {
  const root =
    deps.root && !deps.useRealRootResolution
      ? deps.root
      : resolveProjectRoot({ env: deps.env || process.env, cwd: deps.cwd || process.cwd() });
  const adapter = deps.adapter || createStateAdapter({ root });
  const { command, flags, positionals } = parseArgs(argv);
  const json = Boolean(flags.json);

  if (command === "status" || command === "resume") {
    const state = adapter.read();
    if (!state) return output({ active: false }, json);
    assertUsableTopology(state, root);
    return output({ active: true, ...renderProgress(state) }, json);
  }

  if (command === "start") {
    const idea = flags.idea || positionals.join(" ");
    if (!idea.trim()) throw new Error("start requires an idea");
    const existing = adapter.read();
    let discarded = null;
    if (existing) {
      const settled = Array.isArray(existing.forks) ? existing.forks.length : 0;
      if (!flags.force) {
        throw new Error(
          `an interview is already active (run_id=${existing.run_id}, round=${existing.round}, ${settled} standard(s) settled). ` +
            "Resume it (`resume`), finish it (`finalize`), or clear it explicitly (`clear`) — " +
            "or pass --force to discard it and start over."
        );
      }
      discarded = { run_id: existing.run_id, round: existing.round, standards_settled: settled };
    }
    const thresholdInfo = resolveThreshold({ cwd: root, env: deps.env || process.env });
    const state = createInitialState({ idea, cwd: root, thresholdInfo, now: deps.now || new Date() });
    adapter.write(state);
    const result = { active: true, threshold: thresholdInfo.threshold, threshold_source: thresholdInfo.threshold_source, topology: state.topology, question: "Confirm the topology before scoring." };
    if (discarded) result.discarded = discarded;
    return output(result, json);
  }

  if (command === "answer") {
    const answer = flags.answer || positionals.join(" ");
    if (!answer.trim()) throw new Error("answer requires text");
    const current = adapter.read();
    if (!current) throw new Error("no active coach state");
    assertUsableTopology(current, root);
    const confirmed = current.topology.status === "pending" ? confirmTopology(current) : current;
    const next = applyAnswer(confirmed, answer, { now: deps.now || new Date() });
    adapter.write(next);
    return output({ active: true, ...renderProgress(next) }, json);
  }

  if (command === "finalize") {
    const current = adapter.read();
    if (!current) throw new Error("no active coach state");
    assertUsableTopology(current, root);

    const risks = openRisks(current);
    const accepted = flags["accept-risk"];
    let acceptedRisk = null;
    if (risks.length > 0) {
      if (accepted === true) {
        throw new Error('--accept-risk needs the reason you are accepting it: --accept-risk "<why>"');
      }
      if (typeof accepted !== "string" || !accepted.trim()) {
        throw new Error(
          `finalize refused — ${risks.join("; ")}. ` +
            'Keep answering, or put the acceptance on the record: --accept-risk "<why>".'
        );
      }
      acceptedRisk = { reason: accepted.trim(), risks };
    }

    const next = finalizeState(current, { now: deps.now || new Date(), acceptedRisk });
    adapter.write(next);
    return output(
      {
        active: true,
        standard_ids: next.standard_ids,
        approval_options: next.approval_options,
        ambiguity: next.current_ambiguity,
        risk_accepted: next.risk_accepted || null,
      },
      json
    );
  }

  // The interview's durable output is the standards, which live in their own
  // files. State is the resumable remainder, and once the user confirms there
  // is nothing left to resume -- so it goes. That also settles the three-way
  // disagreement over `pending_approval`: session-end read it as closed, start
  // read it as open, and SessionStart offered to resume it. With the file gone,
  // all three agree.
  if (command === "confirm") {
    const current = adapter.read();
    if (!current) throw new Error("no active coach state");
    if (current.status !== "pending_approval") {
      throw new Error(
        `confirm needs a finalized interview; this one is ${JSON.stringify(current.status)}. ` +
          "Run `finalize` first, or `clear` to discard the interview without confirming."
      );
    }
    const standardIds = Array.isArray(current.standard_ids) ? current.standard_ids : [];
    adapter.clear();
    return output({ ok: true, active: false, confirmed: standardIds }, json);
  }

  if (command === "record-fork") {
    const file = flags.file;
    if (!file) throw new Error("record-fork requires --file <path>");
    const fork = readJsonFile(file, null);
    if (!fork) throw new Error(`record-fork could not read a JSON object from ${file}`);
    if (!fork.id) throw new Error("record-fork requires the fork to declare an id");

    const current = adapter.read();
    if (!current) throw new Error("no active coach state");

    const path = writeStandard(root, fork, { now: deps.now || new Date() });
    const forks = Array.isArray(current.forks) ? current.forks : [];
    if (!forks.includes(fork.id)) forks.push(fork.id);
    adapter.write({ ...current, forks });

    return output({ ok: true, id: fork.id, path }, json);
  }

  // Answers to adversarial checks come in here rather than through
  // standard-check, which stays read-only: the thing that grades the work must
  // not also be the thing that records passing grades.
  if (command === "record-verdict") {
    if (!flags.file) throw new Error("record-verdict requires --file <path>");
    const verdict = readJsonFile(flags.file, null);
    if (!verdict) throw new Error(`record-verdict could not read a JSON object from ${flags.file}`);
    if (!listActiveStandards(root).some((standard) => standard.id === verdict.standard)) {
      throw new Error(`no active standard ${JSON.stringify(verdict.standard)} to record a verdict against`);
    }
    const record = appendVerdict(root, verdict, { now: deps.now || new Date() });
    return output({ ok: true, ...record }, json);
  }

  if (command === "supersede") {
    const id = flags.id || positionals[0];
    if (typeof id !== "string" || !id) throw new Error("supersede requires --id <standard-id>");
    if (!listActiveStandards(root).some((standard) => standard.id === id)) {
      throw new Error(
        `no active standard "${id}" under ${join(root, ".scc", "standards")}. ` +
          "A retired record keeps its file but cannot be retired twice."
      );
    }

    let replacement = null;
    if (flags.file) {
      const fork = readJsonFile(flags.file, null);
      if (!fork) throw new Error(`supersede could not read a JSON object from ${flags.file}`);
      if (!fork.id) throw new Error("supersede requires the replacement fork to declare an id");
      if (fork.id === id) throw new Error(`a standard cannot supersede itself: "${id}"`);
      // Write the replacement before retiring the old record. A colliding id
      // throws here, and the project is left with its existing standard still
      // active rather than with no active standard at all.
      const path = writeStandard(root, fork, { now: deps.now || new Date(), supersedes: id });
      replacement = { id: fork.id, path };
    }

    if (!supersedeStandard(root, id)) {
      throw new Error(
        `standard "${id}" was active a moment ago but its status line has since changed` +
          (replacement ? `, after the replacement was written to ${replacement.path}` : "") +
          ". Another session is writing to this project; re-read the record before retrying."
      );
    }

    const current = adapter.read();
    if (current && replacement) {
      const forks = Array.isArray(current.forks) ? current.forks : [];
      if (!forks.includes(replacement.id)) forks.push(replacement.id);
      adapter.write({ ...current, forks });
    }

    return output({ ok: true, superseded: id, replacement }, json);
  }

  if (command === "clear") {
    adapter.clear();
    return output({ ok: true, active: false }, json);
  }

  throw new Error(`unknown command: ${command}`);
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

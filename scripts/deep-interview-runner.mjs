#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_STATE_KEY = "deep-interview-active";
const DEFAULT_THRESHOLD = 0.05;

export function isDirectExecution(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  return argv1 ? resolve(fileURLToPath(metaUrl)) === resolve(argv1) : false;
}

export function repoRootFrom(importMetaUrl = import.meta.url) {
  return resolve(dirname(fileURLToPath(importMetaUrl)), "..");
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
  const configDir = env.GJC_CONFIG_DIR || (home ? join(home, ".gjc") : "");
  const userPath = options.userSettingsPath || (configDir ? join(configDir, "settings.json") : null);
  const projectPath = options.projectSettingsPath || join(cwd, ".gjc", "settings.json");
  const readJson = options.readJson || ((path) => readJsonFile(path));

  const userValue = readJson(userPath)?.gjc?.deepInterview?.ambiguityThreshold;
  const projectValue = readJson(projectPath)?.gjc?.deepInterview?.ambiguityThreshold;

  if (validThreshold(projectValue)) {
    return thresholdResult(projectValue, "./.gjc/settings.json");
  }
  if (validThreshold(userValue)) {
    return thresholdResult(userValue, userPath || "[$GJC_CONFIG_DIR|~/.gjc]/settings.json");
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

export function slugify(input = "deep-interview") {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "deep-interview";
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
    spec_path: null,
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

export function renderSpec(state, { title = "Deep Interview Spec", generatedAt = new Date() } = {}) {
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

export function renderApprovalOptions(specPath, ambiguity, language = { code: "en" }) {
  const ko = language?.code === "ko";
  return ko
    ? [
        { id: "ralplan", label: "ralplan 합의로 명세 다듬기", recommended: true, specPath, ambiguity },
        { id: "ultragoal", label: "명시 승인 후 ultragoal로 실행", recommended: false, specPath, ambiguity },
        { id: "team", label: "tmux 병렬 실행이 필요할 때만 team으로 실행", recommended: false, specPath, ambiguity },
        { id: "continue", label: "인터뷰 계속하기", recommended: false, specPath, ambiguity },
      ]
    : [
        { id: "ralplan", label: "Refine with ralplan consensus", recommended: true, specPath, ambiguity },
        { id: "ultragoal", label: "Execute with ultragoal after explicit approval", recommended: false, specPath, ambiguity },
        { id: "team", label: "Execute with team only when tmux parallelization is required", recommended: false, specPath, ambiguity },
        { id: "continue", label: "Continue interviewing", recommended: false, specPath, ambiguity },
      ];
}

export function createStateAdapter({ root = repoRootFrom(), key = DEFAULT_STATE_KEY, env = process.env } = {}) {
  const script = join(root, "scripts", "state-manager.sh");
  const run = (args, inputEnv = env) => execFileSync(script, args, { encoding: "utf8", env: inputEnv });
  return {
    read() {
      return parseJsonObject(run(["read", key]), null);
    },
    write(value) {
      run(["write", key, JSON.stringify(value)]);
      return value;
    },
    clear() {
      run(["clear", key]);
    },
  };
}

export function writeSpecFile(state, { root = process.cwd(), slug, now = new Date() } = {}) {
  const safeSlug = slugify(slug || state.initial_idea || state.run_id);
  const specDir = join(root, ".gjc", "specs");
  mkdirSync(specDir, { recursive: true });
  const specPath = join(specDir, `deep-interview-${safeSlug}.md`);
  const title = state.language?.code === "ko" ? `Deep Interview 명세: ${safeSlug}` : `Deep Interview Spec: ${safeSlug}`;
  writeFileSync(specPath, renderSpec(state, { title, generatedAt: now }), "utf8");
  return specPath;
}

export function finalizeState(state, { root = process.cwd(), slug, now = new Date() } = {}) {
  const next = structuredCloneCompat(state);
  const specPath = writeSpecFile(next, { root, slug, now });
  next.spec_path = specPath;
  next.approval_options = renderApprovalOptions(specPath, next.current_ambiguity, next.language);
  next.status = "pending_approval";
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
  const booleanFlags = new Set(["json"]);
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

export function runCli(argv = process.argv.slice(2), deps = {}) {
  const root = deps.root || repoRootFrom(import.meta.url);
  const adapter = deps.adapter || createStateAdapter({ root, env: deps.env || process.env });
  const { command, flags, positionals } = parseArgs(argv);
  const json = Boolean(flags.json);

  if (command === "status" || command === "resume") {
    const state = adapter.read();
    if (!state) return output({ active: false }, json);
    return output({ active: true, ...renderProgress(state), spec_path: state.spec_path }, json);
  }

  if (command === "start") {
    const idea = flags.idea || positionals.join(" ");
    if (!idea.trim()) throw new Error("start requires an idea");
    const thresholdInfo = resolveThreshold({ cwd: root, env: deps.env || process.env });
    const state = createInitialState({ idea, cwd: root, thresholdInfo, now: deps.now || new Date() });
    adapter.write(state);
    return output({ active: true, threshold: thresholdInfo.threshold, threshold_source: thresholdInfo.threshold_source, topology: state.topology, question: "Confirm the topology before scoring." }, json);
  }

  if (command === "answer") {
    const answer = flags.answer || positionals.join(" ");
    if (!answer.trim()) throw new Error("answer requires text");
    const current = adapter.read();
    if (!current) throw new Error("no active deep interview state");
    const confirmed = current.topology.status === "pending" ? confirmTopology(current) : current;
    const next = applyAnswer(confirmed, answer, { now: deps.now || new Date() });
    adapter.write(next);
    return output({ active: true, ...renderProgress(next) }, json);
  }

  if (command === "finalize") {
    const current = adapter.read();
    if (!current) throw new Error("no active deep interview state");
    const next = finalizeState(current, { root, slug: flags.slug, now: deps.now || new Date() });
    adapter.write(next);
    return output({ active: true, spec_path: next.spec_path, approval_options: next.approval_options, ambiguity: next.current_ambiguity }, json);
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

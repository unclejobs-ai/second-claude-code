const PRESET_CONFIG = {
  content: { expected_reviewers: 3, threshold: 0.67 },
  strategy: { expected_reviewers: 3, threshold: 0.67 },
  code: { expected_reviewers: 3, threshold: 0.67 },
  security: { expected_reviewers: 3, threshold: 0.67 },
  academic: { expected_reviewers: 4, threshold: 0.75 },
  quick: { expected_reviewers: 2, threshold: 1.0 },
  full: { expected_reviewers: 5, threshold: 0.67 },
};

const PRESET_NAMES = new Set(Object.keys(PRESET_CONFIG));
const PRESET_PATTERNS = Array.from(PRESET_NAMES).join("|");
const REVIEWER_SETS = [
  { preset: "quick", reviewers: ["devil-advocate", "fact-checker"] },
  { preset: "content", reviewers: ["deep-reviewer", "devil-advocate", "tone-guardian"] },
  { preset: "strategy", reviewers: ["deep-reviewer", "devil-advocate", "fact-checker"] },
  { preset: "code", reviewers: ["deep-reviewer", "fact-checker", "structure-analyst"] },
  {
    preset: "academic",
    reviewers: ["deep-reviewer", "fact-checker", "structure-analyst", "devil-advocate"],
  },
  {
    preset: "full",
    reviewers: [
      "deep-reviewer",
      "devil-advocate",
      "fact-checker",
      "tone-guardian",
      "structure-analyst",
    ],
  },
];

function normalizePresetName(value) {
  if (typeof value !== "string") return null;
  const preset = value.trim().toLowerCase();
  return PRESET_NAMES.has(preset) ? preset : null;
}

function clampThreshold(value) {
  return Math.max(0.5, Math.min(1.0, value));
}

function thresholdForReviewerCount(count) {
  switch (count) {
    case 2:
      return 1.0;
    case 3:
      return 0.67;
    case 4:
      return 0.75;
    case 5:
      return 0.67;
    default:
      return 0.67;
  }
}

function collectReviewerNames(state) {
  const names = new Set();

  for (const bucket of [state?.started_reviewers, state?.reviewers]) {
    if (!Array.isArray(bucket)) continue;

    for (const entry of bucket) {
      const name = typeof entry === "string" ? entry : entry?.name;
      if (typeof name === "string" && name.trim()) {
        names.add(name.trim().toLowerCase());
      }
    }
  }

  return names;
}

function inferPresetFromReviewers(state) {
  const names = collectReviewerNames(state);

  for (const candidate of REVIEWER_SETS) {
    if (names.size !== candidate.reviewers.length) continue;
    if (candidate.reviewers.every((reviewer) => names.has(reviewer))) {
      return candidate.preset;
    }
  }

  return null;
}

function extractPresetFromString(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const cliMatch = value.match(new RegExp(`--preset\\s+(${PRESET_PATTERNS})\\b`, "i"));
  if (cliMatch) {
    return normalizePresetName(cliMatch[1]);
  }

  const namedMatch = value.match(
    new RegExp(`\\b(?:review_)?preset\\s*[:=]\\s*[\"']?(${PRESET_PATTERNS})\\b`, "i")
  );
  if (namedMatch) {
    return normalizePresetName(namedMatch[1]);
  }

  return null;
}

function extractPresetFromPayloadValue(value, depth = 0) {
  if (depth > 4 || value == null) return null;

  if (typeof value === "string") {
    return extractPresetFromString(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const preset = extractPresetFromPayloadValue(item, depth + 1);
      if (preset) return preset;
    }
    return null;
  }

  if (typeof value === "object") {
    const directPreset = normalizePresetName(
      value.preset ?? value.review_preset ?? value.reviewPreset
    );
    if (directPreset) return directPreset;

    for (const nested of Object.values(value)) {
      const preset = extractPresetFromPayloadValue(nested, depth + 1);
      if (preset) return preset;
    }
  }

  return null;
}

export function resolveReviewAggregationConfig(state = {}, payload = null) {
  const preset =
    normalizePresetName(state?.preset) ??
    extractPresetFromPayloadValue(payload) ??
    inferPresetFromReviewers(state);

  const presetConfig = preset ? PRESET_CONFIG[preset] : null;

  let expected_reviewers = Number.isFinite(state?.expected_reviewers)
    ? Math.round(state.expected_reviewers)
    : 3;

  if (presetConfig) {
    expected_reviewers = presetConfig.expected_reviewers;
  } else {
    const startedCount = collectReviewerNames(state).size;
    if (startedCount > expected_reviewers) {
      expected_reviewers = startedCount;
    }
  }

  expected_reviewers = Math.max(2, Math.min(10, expected_reviewers));

  const rawThreshold = Number.isFinite(state?.threshold)
    ? clampThreshold(state.threshold)
    : null;
  const defaultThreshold = thresholdForReviewerCount(expected_reviewers);

  let threshold;
  if (rawThreshold === null) {
    threshold = defaultThreshold;
  } else if (
    presetConfig &&
    Math.abs(rawThreshold - 0.67) < 1e-9 &&
    Math.abs(defaultThreshold - rawThreshold) > 1e-9
  ) {
    threshold = defaultThreshold;
  } else {
    threshold = rawThreshold;
  }

  return { preset, expected_reviewers, threshold };
}

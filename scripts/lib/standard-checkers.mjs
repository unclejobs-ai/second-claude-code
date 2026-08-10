// The five builtin checkers a standard may name, and the validator that keeps a
// standard from naming anything else. Standards live in the user's project and
// travel through its repository, so a check is data the runner interprets --
// never a string the runner executes. Adding a checker means adding it here, in
// scc, with a fixture that proves it can say no.

const CHECKERS = new Map();

const BUILTIN_KEYS = new Set(["kind", "checker", "args"]);
const ADVERSARIAL_KEYS = new Set(["kind", "ask"]);

function fail(reason) {
  return { ok: false, reason };
}

const OK = { ok: true };

function requireString(args, key, checker) {
  const value = args[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${checker}: "${key}" must be a non-empty string`);
  }
  return value;
}

function requireNumber(args, key, checker) {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${checker}: "${key}" must be a finite number`);
  }
  return value;
}

function compileRegExp(pattern, flags, checker) {
  if (flags !== undefined && typeof flags !== "string") {
    throw new Error(`${checker}: "flags" must be a string`);
  }
  try {
    return new RegExp(pattern, flags || "");
  } catch (error) {
    throw new Error(`${checker}: "${pattern}" is not a valid regular expression — ${error.message}`);
  }
}

CHECKERS.set("regex-absent", (target, args) => {
  const pattern = requireString(args, "pattern", "regex-absent");
  const match = compileRegExp(pattern, args.flags, "regex-absent").exec(target.body);
  return match ? fail(`the target contains ${JSON.stringify(match[0])}, which /${pattern}/ forbids`) : OK;
});

CHECKERS.set("regex-present", (target, args) => {
  const pattern = requireString(args, "pattern", "regex-present");
  return compileRegExp(pattern, args.flags, "regex-present").test(target.body)
    ? OK
    : fail(`the target has nothing matching /${pattern}/`);
});

CHECKERS.set("length-between", (target, args) => {
  const unit = args.unit === undefined ? "char" : args.unit;
  if (unit !== "char" && unit !== "word") {
    throw new Error(`length-between: "unit" must be "char" or "word", got ${JSON.stringify(unit)}`);
  }
  const min = requireNumber(args, "min", "length-between");
  const max = requireNumber(args, "max", "length-between");
  const body = target.body;
  const length = unit === "word" ? (body.trim() ? body.trim().split(/\s+/).length : 0) : [...body].length;
  if (length < min) return fail(`${length} ${unit}(s), below the minimum of ${min}`);
  if (length > max) return fail(`${length} ${unit}(s), above the maximum of ${max}`);
  return OK;
});

CHECKERS.set("frontmatter-equals", (target, args) => {
  const field = requireString(args, "field", "frontmatter-equals");
  if (typeof args.value !== "string") {
    throw new Error('frontmatter-equals: "value" must be a string');
  }
  const actual = target.frontmatter[field];
  if (actual === undefined) return fail(`the target has no frontmatter field "${field}"`);
  return actual === args.value
    ? OK
    : fail(`frontmatter "${field}" is ${JSON.stringify(actual)}, expected ${JSON.stringify(args.value)}`);
});

CHECKERS.set("similarity-below", (target, args) => {
  const a = requireString(args, "a", "similarity-below");
  const b = requireString(args, "b", "similarity-below");
  const threshold = requireNumber(args, "threshold", "similarity-below");
  const left = selectSection(target.body, a);
  const right = selectSection(target.body, b);
  if (left === null) return fail(`the target has no section "${a}"`);
  if (right === null) return fail(`the target has no section "${b}"`);
  const score = similarity(left, right);
  return score < threshold
    ? OK
    : fail(`"${a}" and "${b}" score ${score.toFixed(2)}, at or above the ${threshold} ceiling`);
});

// Heading path, outermost first: "S-A#closing" is the "closing" heading nested
// under the "S-A" heading. Matching is on the trimmed heading text.
export function selectSection(markdown, selector) {
  const headings = [];
  const lines = markdown.split("\n");
  let offset = 0;
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match) {
      headings.push({ level: match[1].length, title: match[2].trim(), start: offset + line.length + 1 });
    }
    offset += line.length + 1;
  }

  let searchFrom = 0;
  let searchTo = markdown.length;
  let found = null;
  for (const segment of selector.split("#").map((part) => part.trim()).filter(Boolean)) {
    found = null;
    for (let i = 0; i < headings.length; i += 1) {
      const heading = headings[i];
      if (heading.start < searchFrom || heading.start > searchTo) continue;
      if (heading.title !== segment) continue;
      let end = searchTo;
      for (let j = i + 1; j < headings.length; j += 1) {
        if (headings[j].level <= heading.level) {
          end = Math.min(end, headings[j].start - `${"#".repeat(headings[j].level)} ${headings[j].title}\n`.length);
          break;
        }
      }
      found = { start: heading.start, end };
      break;
    }
    if (!found) return null;
    searchFrom = found.start;
    searchTo = found.end;
  }
  return found ? markdown.slice(found.start, found.end).trim() : null;
}

// Dice coefficient over character bigrams. Character-level rather than
// word-level because the standards this checks are written in Korean as often
// as English, and whitespace tokens undercount agglutinative overlap.
export function similarity(a, b) {
  const left = bigrams(a);
  const right = bigrams(b);
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

function bigrams(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const out = new Set();
  for (let i = 0; i < normalized.length - 1; i += 1) out.add(normalized.slice(i, i + 2));
  return out;
}

export function checkerIds() {
  return [...CHECKERS.keys()].sort();
}

// A malformed check is an error, never a skip. A standard whose author believes
// it is being enforced, while the runner quietly steps over it, is worse than a
// standard with no check at all.
export function validateCheck(check, index) {
  const at = `checks[${index}]`;
  if (!check || typeof check !== "object" || Array.isArray(check)) {
    throw new Error(`${at} must be an object`);
  }
  if ("run" in check || "command" in check || "shell" in check) {
    throw new Error(
      `${at} carries a free-form command field. Checks are data, not code: a standard travels through a project's ` +
        `repository, and running its strings would hand any repository the machine. Use one of: ${checkerIds().join(", ")}.`
    );
  }
  if (check.kind === "adversarial") {
    for (const key of Object.keys(check)) {
      if (!ADVERSARIAL_KEYS.has(key)) throw new Error(`${at} has an unknown field "${key}" for an adversarial check`);
    }
    if (typeof check.ask !== "string" || !check.ask.trim()) {
      throw new Error(`${at} is adversarial and must carry a non-empty "ask"`);
    }
    return check;
  }
  if (check.kind !== "builtin") {
    throw new Error(`${at} has kind ${JSON.stringify(check.kind)}; expected "builtin" or "adversarial"`);
  }
  for (const key of Object.keys(check)) {
    if (!BUILTIN_KEYS.has(key)) throw new Error(`${at} has an unknown field "${key}" for a builtin check`);
  }
  if (!CHECKERS.has(check.checker)) {
    throw new Error(
      `${at} names an unknown checker ${JSON.stringify(check.checker)}. Available: ${checkerIds().join(", ")}.`
    );
  }
  if (check.args !== undefined && (typeof check.args !== "object" || check.args === null || Array.isArray(check.args))) {
    throw new Error(`${at} has "args" that is not an object`);
  }
  return check;
}

export function runCheck(check, target, index = 0, verdict = null) {
  validateCheck(check, index);
  if (check.kind === "adversarial") {
    if (!verdict) return { kind: "adversarial", status: "unproven", ask: check.ask };
    return verdict.verdict === "pass"
      ? { kind: "adversarial", status: "pass", ask: check.ask, reviewer: verdict.reviewer }
      : {
          kind: "adversarial",
          status: "fail",
          checker: "adversarial",
          ask: check.ask,
          reason: `${verdict.reviewer} answered no${verdict.note ? ` — ${verdict.note}` : ""}`,
        };
  }
  const result = CHECKERS.get(check.checker)(target, check.args || {});
  return result.ok
    ? { kind: "builtin", checker: check.checker, status: "pass" }
    : { kind: "builtin", checker: check.checker, status: "fail", reason: result.reason };
}

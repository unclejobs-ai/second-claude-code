/**
 * Skill metadata helpers.
 *
 * Parses the constrained YAML frontmatter used by Second Codex SKILL.md files
 * without introducing external dependencies.
 */

function countIndent(line) {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((part) => parseScalar(part.trim()));
  }
  return value;
}

function nextMeaningfulLine(lines, start) {
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].trim().length > 0) return i;
  }
  return lines.length;
}

function parseObject(lines, start, indent) {
  const obj = {};
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const currentIndent = countIndent(line);
    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      throw new Error(`Unexpected indentation at line: ${line}`);
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) break;

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      throw new Error(`Invalid frontmatter line: ${line}`);
    }

    const key = trimmed.slice(0, separator).trim();
    const rest = trimmed.slice(separator + 1).trim();

    if (rest.length > 0) {
      obj[key] = parseScalar(rest);
      index += 1;
      continue;
    }

    const childIndex = nextMeaningfulLine(lines, index + 1);
    if (childIndex >= lines.length) {
      obj[key] = {};
      index = childIndex;
      continue;
    }

    const childLine = lines[childIndex];
    const childIndent = countIndent(childLine);
    if (childIndent <= currentIndent) {
      obj[key] = {};
      index = childIndex;
      continue;
    }

    const [value, nextIndex] = parseBlock(lines, childIndex, childIndent);
    obj[key] = value;
    index = nextIndex;
  }

  return [obj, index];
}

function parseArray(lines, start, indent) {
  const arr = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const currentIndent = countIndent(line);
    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      throw new Error(`Unexpected indentation at line: ${line}`);
    }

    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) break;

    const rest = trimmed.slice(2).trim();
    if (!rest) {
      const childIndex = nextMeaningfulLine(lines, index + 1);
      const [value, nextIndex] = parseBlock(lines, childIndex, indent + 2);
      arr.push(value);
      index = nextIndex;
      continue;
    }

    if (rest.includes(":")) {
      const pseudoLines = [`${" ".repeat(indent + 2)}${rest}`];
      let lookahead = index + 1;
      while (lookahead < lines.length) {
        const next = lines[lookahead];
        if (next.trim().length === 0) {
          pseudoLines.push(next);
          lookahead += 1;
          continue;
        }
        const nextIndent = countIndent(next);
        if (nextIndent <= indent) break;
        pseudoLines.push(next);
        lookahead += 1;
      }
      const [value] = parseObject(pseudoLines, 0, indent + 2);
      arr.push(value);
      index = lookahead;
      continue;
    }

    arr.push(parseScalar(rest));
    index += 1;
  }

  return [arr, index];
}

function parseBlock(lines, start, indent) {
  const index = nextMeaningfulLine(lines, start);
  if (index >= lines.length) return [{}, index];
  const trimmed = lines[index].trim();
  if (trimmed.startsWith("- ")) {
    return parseArray(lines, index, indent);
  }
  return parseObject(lines, index, indent);
}

export function parseSkillFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error("SKILL.md frontmatter block not found");
  }

  const lines = match[1].split(/\r?\n/);
  const [parsed] = parseObject(lines, 0, 0);
  return parsed;
}

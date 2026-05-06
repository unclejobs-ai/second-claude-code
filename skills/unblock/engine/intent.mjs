const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export function classifyIntent(input) {
  if (!input || typeof input !== "string") return { kind: "invalid" };
  const trimmed = input.trim();
  if (URL_RE.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return { kind: "url", url: url.toString(), host: url.hostname };
    } catch {
      return { kind: "invalid" };
    }
  }
  return { kind: "keyword", query: trimmed };
}

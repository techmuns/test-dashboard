/**
 * The web_reader `results` payload is an untyped object whose exact shape can
 * vary per page. These helpers coerce it into something displayable without
 * assuming a rigid schema, so the dashboard renders provenance safely.
 */

export interface ReadablePage {
  title: string | null;
  text: string | null;
  wordCount: number;
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Drill into common envelope shapes to find the per-page object. */
function unwrap(results: unknown): Record<string, unknown> | null {
  if (!results || typeof results !== "object") return null;
  let node: unknown = results;

  // results -> { [url]: {...} } or { results: [...] } or array
  if (Array.isArray(node)) node = node[0];

  if (node && typeof node === "object" && !Array.isArray(node)) {
    const obj = node as Record<string, unknown>;
    // If it's a map keyed by URL with no obvious content fields, take first value.
    const hasContentKeys = ["title", "text", "content", "markdown"].some(
      (k) => k in obj,
    );
    if (!hasContentKeys) {
      const values = Object.values(obj);
      if (values.length === 1 && values[0] && typeof values[0] === "object") {
        return values[0] as Record<string, unknown>;
      }
    }
    return obj;
  }
  return null;
}

export function toReadablePage(results: unknown): ReadablePage {
  const obj = unwrap(results);
  if (!obj) {
    return { title: null, text: null, wordCount: 0 };
  }

  const title = firstString(obj, ["title", "pageTitle", "name", "heading"]);
  const text = firstString(obj, [
    "text",
    "content",
    "markdown",
    "body",
    "extractedText",
  ]);

  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  return { title, text, wordCount };
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

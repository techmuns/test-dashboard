// Defensive normalizer for Web Reader responses. The registry documents the
// `results` field as a flexible "object" of extracted page content, so we
// tolerate several shapes: keyed-by-url object, array of entries, or a single
// entry.

export interface WebReaderEntry {
  url: string;
  title: string | null;
  status: "ok" | "failed";
  preview: string;
  wordCount: number;
}

function pickString(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function toEntry(value: any, fallbackUrl: string): WebReaderEntry {
  if (value == null || typeof value !== "object") {
    const text = typeof value === "string" ? value : "";
    return {
      url: fallbackUrl,
      title: null,
      status: text ? "ok" : "failed",
      preview: text.slice(0, 600),
      wordCount: text ? text.trim().split(/\s+/).length : 0,
    };
  }

  const url = pickString(value, ["url", "link", "source"]) ?? fallbackUrl;
  const title = pickString(value, ["title", "name", "heading"]);
  const content =
    pickString(value, ["content", "text", "markdown", "body", "extracted"]) ??
    "";
  const errored = Boolean(value.error) || pickString(value, ["error"]);

  return {
    url,
    title,
    status: errored || !content ? "failed" : "ok",
    preview: content.slice(0, 600),
    wordCount: content ? content.trim().split(/\s+/).length : 0,
  };
}

export function extractWebEntries(
  results: unknown,
  requestedUrls: string[],
): WebReaderEntry[] {
  if (results == null) return [];

  if (Array.isArray(results)) {
    return results.map((v, i) => toEntry(v, requestedUrls[i] ?? `url-${i + 1}`));
  }

  if (typeof results === "object") {
    const obj = results as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Keyed-by-url object: keys look like URLs.
    const looksUrlKeyed = keys.some((k) => /^https?:\/\//i.test(k));
    if (looksUrlKeyed) {
      return keys.map((k) => toEntry(obj[k], k));
    }

    // Single entry object.
    return [toEntry(obj, requestedUrls[0] ?? "")];
  }

  return [toEntry(results, requestedUrls[0] ?? "")];
}

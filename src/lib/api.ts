/**
 * Thin API client for the two registered datasources this dashboard uses:
 *   - web_reader (fastapi): extract content from a URL
 *   - muns_chat (nestjs): stream an AI answer grounded in the extracted content
 *
 * All requests use the host-provided bearer token. Failures surface as thrown
 * Errors so widgets can render friendly error states.
 */

import {
  DASHBOARD_DATASOURCES,
  DASHBOARD_REQUEST_TIMEOUT_MS,
  datasourceUrl,
} from "./datasources";

export interface WebReaderResult {
  /** Raw object returned under `results`; shape varies per page. */
  results: unknown;
  readAtIso: string;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/** Read and extract content from a single URL via the web_reader datasource. */
export async function readUrl(
  url: string,
  token: string,
  task?: string,
): Promise<WebReaderResult> {
  const ds = DASHBOARD_DATASOURCES.web_reader;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    DASHBOARD_REQUEST_TIMEOUT_MS,
  );

  try {
    const body: Record<string, unknown> = { urls: [url] };
    if (task && task.trim()) body.task = task.trim();

    const res = await fetch(datasourceUrl(ds), {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Web Reader failed (${res.status})`);
    }

    const json = (await res.json()) as { results?: unknown };
    return {
      results: json.results ?? json,
      readAtIso: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Web Reader timed out. Please try again.");
    }
    throw err instanceof Error ? err : new Error("Web Reader request failed.");
  } finally {
    clearTimeout(timer);
  }
}

export interface ChatStreamMeta {
  chatId: string | null;
  messageId: string | null;
}

export interface ChatStreamArgs {
  query: string;
  token: string;
  /** Extracted web_reader content forwarded into the model context. */
  dashboardInputs?: unknown[];
  ticker?: string | null;
  onChunk: (textSoFar: string) => void;
  onMeta?: (meta: ChatStreamMeta) => void;
  signal?: AbortSignal;
}

/**
 * Stream an AI answer from the muns_chat datasource. The response is a
 * text/event-stream; chunks are decoded and accumulated, and `onChunk` is
 * invoked with the running answer so the UI can render progressively.
 */
export async function streamChat(args: ChatStreamArgs): Promise<string> {
  const ds = DASHBOARD_DATASOURCES.muns_chat;
  const { query, token, dashboardInputs, ticker, onChunk, onMeta, signal } =
    args;

  const queryContext: Record<string, unknown> = { chatHistory: [] };
  if (dashboardInputs && dashboardInputs.length > 0) {
    queryContext.DASHBOARD_INPUTS = dashboardInputs;
  }
  if (ticker) {
    queryContext.TICKER_SYMBOL = [ticker];
  }

  const res = await fetch(datasourceUrl(ds), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ tasks: [query], query_context: queryContext }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Muns Chat failed (${res.status})`);
  }

  onMeta?.({
    chatId: res.headers.get("X-Chat-Id"),
    messageId: res.headers.get("X-Message-Id"),
  });

  if (!res.body) {
    // No stream available; fall back to a plain text body.
    const text = await res.text();
    onChunk(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let answer = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    answer += parseStreamChunk(chunk);
    onChunk(answer);
  }

  return answer;
}

/**
 * Tolerant parser for streamed chunks. Handles both SSE-style `data:` framing
 * and raw text. Ignores keep-alive comments and `[DONE]` sentinels.
 */
function parseStreamChunk(chunk: string): string {
  if (!chunk.includes("data:")) return chunk;

  let out = "";
  for (const rawLine of chunk.split(/\r?\n/)) {
    const line = rawLine.trimStart();
    if (!line || line.startsWith(":")) continue; // keep-alive / comment
    if (!line.startsWith("data:")) continue;

    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    // Some servers wrap text in JSON; extract it when possible.
    if (payload.startsWith("{") || payload.startsWith("[")) {
      try {
        const obj = JSON.parse(payload) as Record<string, unknown>;
        const text =
          (obj.content as string) ??
          (obj.delta as string) ??
          (obj.text as string) ??
          (obj.answer as string);
        if (typeof text === "string") {
          out += text;
          continue;
        }
      } catch {
        // not JSON; treat as plain text below
      }
    }
    out += payload;
  }
  return out;
}

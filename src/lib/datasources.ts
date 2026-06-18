// Registered Munshot datasources used by this dashboard.
// Source of truth: dashboard-skill/reference/datasource-registry.md
//
// Only two datasources are used here, per the dashboard brief:
//   - muns_chat  (nestjs)  -> chat API,        POST /chat/chat-muns
//   - web_reader (fastapi) -> web reader API,  POST /tools/web-reader

export const DASHBOARD_BASE_URLS = {
  fastapi: "https://fastapi.muns.io",
  nestjs: "https://devde.muns.io",
} as const;

export const DASHBOARD_ENDPOINTS = {
  munsChat: `${DASHBOARD_BASE_URLS.nestjs}/chat/chat-muns`,
  webReader: `${DASHBOARD_BASE_URLS.fastapi}/tools/web-reader`,
} as const;

export const DASHBOARD_REQUEST_TIMEOUT_MS = 30_000;

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Web Reader: POST /tools/web-reader  { urls: string[], task?: string }
// ---------------------------------------------------------------------------

export interface WebReaderResult {
  results: unknown;
  raw: unknown;
}

export async function readWebUrls(
  token: string,
  urls: string[],
  task?: string,
  signal?: AbortSignal,
): Promise<WebReaderResult> {
  const res = await fetch(DASHBOARD_ENDPOINTS.webReader, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(task ? { urls, task } : { urls }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Web Reader request failed (${res.status})`);
  }

  const raw = await res.json();
  return { results: raw?.results ?? raw, raw };
}

// ---------------------------------------------------------------------------
// Muns Chat: POST /chat/chat-muns -> text/event-stream
// Body: { tasks: string[], query_context: { chatHistory: [], TICKER_SYMBOL? } }
// Response headers: X-Chat-Id, X-Message-Id
// ---------------------------------------------------------------------------

export interface MunsChatHandlers {
  onChunk: (textSoFar: string) => void;
  onMeta?: (meta: { chatId: string | null; messageId: string | null }) => void;
}

export interface MunsChatResult {
  text: string;
  chatId: string | null;
  messageId: string | null;
}

export interface MunsChatContext {
  tickers?: string[];
  fromDate?: string;
  toDate?: string;
  dashboardInputs?: unknown[];
  mode?: "fast" | "expert";
}

export async function streamMunsChat(
  token: string,
  task: string,
  context: MunsChatContext,
  handlers: MunsChatHandlers,
  signal?: AbortSignal,
): Promise<MunsChatResult> {
  const queryContext: Record<string, unknown> = { chatHistory: [] };
  if (context.tickers?.length) queryContext.TICKER_SYMBOL = context.tickers;
  if (context.fromDate) queryContext.FROM_DATE = context.fromDate;
  if (context.toDate) queryContext.TO_DATE = context.toDate;
  if (context.dashboardInputs?.length)
    queryContext.DASHBOARD_INPUTS = context.dashboardInputs;
  queryContext.mode = context.mode ?? "expert";

  const res = await fetch(DASHBOARD_ENDPOINTS.munsChat, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      tasks: [task],
      query_context: queryContext,
    }),
    signal,
  });

  const chatId = res.headers.get("X-Chat-Id");
  const messageId = res.headers.get("X-Message-Id");
  handlers.onMeta?.({ chatId, messageId });

  if (!res.ok) {
    throw new Error(`Chat request failed (${res.status})`);
  }

  if (!res.body) {
    // Fallback: no streaming body available, read as text.
    const text = await res.text();
    handlers.onChunk(text);
    return { text, chatId, messageId };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    text += parseEventStreamChunk(chunk);
    handlers.onChunk(text);
  }

  return { text, chatId, messageId };
}

// Best-effort SSE/text parser: extracts `data:` payloads when present,
// otherwise passes raw text through. Tolerates plain streamed chunks too.
function parseEventStreamChunk(chunk: string): string {
  if (!chunk.includes("data:")) return chunk;

  let out = "";
  for (const line of chunk.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data);
      out +=
        parsed?.content ??
        parsed?.delta ??
        parsed?.text ??
        (typeof parsed === "string" ? parsed : "");
    } catch {
      out += data;
    }
  }
  return out;
}

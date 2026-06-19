import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import "./styles.css";

import { sdk } from "./lib/sdk";
import { useHostContext } from "./hooks/useHostContext";
import {
  readWebUrls,
  streamMunsChat,
  type MunsChatResult,
} from "./lib/datasources";
import { extractWebEntries, type WebReaderEntry } from "./lib/web_reader_format";

import { WidgetCard } from "./components/component_widget_card";
import {
  EmptyState,
  ErrorState,
  ShimmerLines,
  WaitingForSession,
} from "./components/component_states";
import { Kpi } from "./components/component_kpi";
import { TickerPill } from "./components/component_ticker_pill";

// Dashboard constants (constant_prefix: DASHBOARD_).
const DASHBOARD_TITLE = "Chat + Web Reader";

type AsyncStatus = "idle" | "loading" | "streaming" | "done" | "error";

interface ChatState {
  status: AsyncStatus;
  text: string;
  chatId: string | null;
  messageId: string | null;
  error: string | null;
  generatedAt: string | null;
}

interface WebState {
  status: AsyncStatus;
  entries: WebReaderEntry[];
  urls: string[];
  error: string | null;
  readAt: string | null;
}

const INITIAL_CHAT: ChatState = {
  status: "idle",
  text: "",
  chatId: null,
  messageId: null,
  error: null,
  generatedAt: null,
};

const INITIAL_WEB: WebState = {
  status: "idle",
  entries: [],
  urls: [],
  error: null,
  readAt: null,
};

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

function timeLabel(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function DashboardChatWebReader() {
  const { session, ticker, tickerCompany } = useHostContext();

  const [queryInput, setQueryInput] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const [chat, setChat] = useState<ChatState>(INITIAL_CHAT);
  const [web, setWeb] = useState<WebState>(INITIAL_WEB);

  const chatAbort = useRef<AbortController | null>(null);
  const webAbort = useRef<AbortController | null>(null);

  // Holds a getter for the current dashboard state so the host's
  // `dashboard.capture.snapshot` request can read live values without the
  // handler depending on render closures. Reassigned every render below.
  const snapshotRef = useRef<() => unknown>(() => ({}));

  // ---- SDK lifecycle: host request handlers --------------------------------
  // The SDK's autoReady (default true) sends `dashboard:ready` on `host:init`,
  // and host context arrives via useHostContext. Here we only register the
  // host->dashboard request handlers. Each onRequest returns an unsubscribe fn.
  useEffect(() => {
    const offVisual = sdk.onRequest("dashboard.capture.visual", async () => {
      const el =
        document.querySelector("#dashboard-main") ||
        document.querySelector("[data-dashboard-capture-root='true']") ||
        document.querySelector("main");
      if (!el) {
        throw new Error("Main content container not found for visual snapshot");
      }
      const imageBlob = await toBlob(el as HTMLElement, { pixelRatio: 2 });
      if (!imageBlob) {
        throw new Error("Visual snapshot capture returned an empty Blob");
      }
      return { visualSnapshot: imageBlob, capturedAt: new Date().toISOString() };
    });

    // Host expects the current JSON state of the dashboard:
    // { context: { ticker, filters }, selection: {...}, data: {...} }.
    const offSnapshot = sdk.onRequest(
      "dashboard.capture.snapshot",
      () => snapshotRef.current(),
    );

    // Announce readiness AFTER all handlers (onMessage in useHostContext,
    // onRequest here) are registered. This triggers the host to flush the
    // queued host:init + context.
    sdk.ready();

    return () => {
      offVisual();
      offSnapshot();
      chatAbort.current?.abort();
      webAbort.current?.abort();
    };
  }, []);

  // ---- Actions -------------------------------------------------------------
  const runChat = async () => {
    const task = queryInput.trim();
    if (!task || !session.token) return;

    chatAbort.current?.abort();
    const ctrl = new AbortController();
    chatAbort.current = ctrl;

    setChat({ ...INITIAL_CHAT, status: "streaming" });
    sdk.publish("dashboard.metric", { widget: "chat", action: "run" });

    try {
      const result: MunsChatResult = await streamMunsChat(
        session.token,
        task,
        { tickers: ticker ? [ticker] : undefined, mode: "expert" },
        {
          onMeta: ({ chatId, messageId }) =>
            setChat((s) => ({ ...s, chatId, messageId })),
          onChunk: (textSoFar) =>
            setChat((s) => ({ ...s, status: "streaming", text: textSoFar })),
        },
        ctrl.signal,
      );

      setChat((s) => ({
        ...s,
        status: "done",
        text: result.text || s.text,
        chatId: result.chatId ?? s.chatId,
        messageId: result.messageId ?? s.messageId,
        generatedAt: new Date().toISOString(),
      }));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Chat request failed";
      setChat((s) => ({ ...s, status: "error", error: message }));
      sdk.sendError(message, "CHAT_REQUEST_FAILED", { widget: "chat" });
    }
  };

  const runWebReader = async () => {
    const urls = parseUrls(urlInput);
    if (!urls.length || !session.token) return;

    webAbort.current?.abort();
    const ctrl = new AbortController();
    webAbort.current = ctrl;

    setWeb({ ...INITIAL_WEB, status: "loading", urls });
    sdk.publish("dashboard.metric", {
      widget: "web-reader",
      action: "run",
      value: urls.length,
    });

    try {
      const task = queryInput.trim() || undefined;
      const { results } = await readWebUrls(
        session.token,
        urls,
        task,
        ctrl.signal,
      );
      setWeb({
        status: "done",
        entries: extractWebEntries(results, urls),
        urls,
        error: null,
        readAt: new Date().toISOString(),
      });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Web Reader request failed";
      setWeb((s) => ({ ...s, status: "error", error: message }));
      sdk.sendError(message, "WEB_READER_REQUEST_FAILED", {
        widget: "web-reader",
      });
    }
  };

  const runBoth = () => {
    runWebReader();
    runChat();
  };

  // ---- Derived KPI values --------------------------------------------------
  const urlsSubmitted = web.urls.length;
  const urlsRead = web.entries.filter((e) => e.status === "ok").length;
  const urlsFailed = web.entries.filter((e) => e.status === "failed").length;
  const answerWords = useMemo(
    () => (chat.text ? chat.text.trim().split(/\s+/).filter(Boolean).length : 0),
    [chat.text],
  );

  // Keep the snapshot getter pointed at the latest state for
  // `dashboard.capture.snapshot`.
  snapshotRef.current = () => ({
    context: {
      ticker: ticker ?? null,
      filters: [
        { type: "query", value: queryInput },
        { type: "urls", value: parseUrls(urlInput) },
      ],
    },
    selection: {
      chatId: chat.chatId,
      messageId: chat.messageId,
    },
    data: {
      chat: {
        status: chat.status,
        words: answerWords,
        answer: chat.text,
        chatId: chat.chatId,
        messageId: chat.messageId,
        generatedAt: chat.generatedAt,
      },
      webReader: {
        status: web.status,
        readAt: web.readAt,
        urls: web.urls,
        entries: web.entries,
      },
    },
  });

  const tokenReady = Boolean(session.token);
  const busy = chat.status === "streaming" || web.status === "loading";

  // ---- Render --------------------------------------------------------------
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        background:
          "linear-gradient(to bottom, rgba(249, 250, 251, 0.8), #ffffff)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#111827",
      }}
    >
      {/* Zone 1: sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 48,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #e5e7eb",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1
            style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}
          >
            {DASHBOARD_TITLE}
          </h1>
          {ticker && <TickerPill ticker={ticker} company={tickerCompany} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HeaderButton
            label={busy ? "Running…" : "Run both"}
            primary
            disabled={!tokenReady || busy}
            onClick={runBoth}
          />
        </div>
      </header>

      {/* Zone 2: scrollable content (visual export capture target) */}
      <main
        id="dashboard-main"
        data-dashboard-capture-root="true"
        style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}
      >
        {/* Row 1: context / inputs */}
        <div style={{ marginBottom: 20 }}>
          <WidgetCard
            title="Inputs"
            subtitle="Query feeds the Chat API · URL feeds the Web Reader API"
            category="tools"
          >
            {!tokenReady ? (
              <WaitingForSession />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(320px, 1fr))",
                  padding: 16,
                }}
              >
                <InputField
                  label="User query → Chat API"
                  hint="POST /chat/chat-muns"
                  placeholder="Ask anything, e.g. Summarize the latest earnings drivers…"
                  value={queryInput}
                  onChange={setQueryInput}
                  onSubmit={runChat}
                  multiline
                  buttonLabel={
                    chat.status === "streaming" ? "Streaming…" : "Ask"
                  }
                  buttonDisabled={
                    !queryInput.trim() || chat.status === "streaming"
                  }
                />
                <InputField
                  label="URL → Web Reader API"
                  hint="POST /tools/web-reader · comma or newline separated"
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={setUrlInput}
                  onSubmit={runWebReader}
                  multiline
                  buttonLabel={
                    web.status === "loading" ? "Reading…" : "Read URL"
                  }
                  buttonDisabled={
                    !urlInput.trim() || web.status === "loading"
                  }
                />
              </div>
            )}
          </WidgetCard>
        </div>

        {/* Row 2: KPIs */}
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            marginBottom: 20,
          }}
        >
          <WidgetCard title="Chat status" category="analytics">
            <Kpi
              label="Muns Chat"
              value={statusText(chat.status)}
              sub={
                chat.generatedAt
                  ? `Answered ${timeLabel(chat.generatedAt)}`
                  : "Ask a question to begin"
              }
              status={
                chat.status === "error"
                  ? "bad"
                  : chat.status === "done"
                    ? "good"
                    : "neutral"
              }
            />
          </WidgetCard>

          <WidgetCard title="Answer length" category="analytics">
            <Kpi
              label="Words generated"
              value={answerWords}
              sub={chat.status === "streaming" ? "Streaming…" : "Final answer"}
            />
          </WidgetCard>

          <WidgetCard title="URLs read" category="tools">
            <Kpi
              label="Web Reader"
              value={`${urlsRead}/${urlsSubmitted || 0}`}
              sub={
                urlsFailed > 0
                  ? `${urlsFailed} failed extraction${urlsFailed > 1 ? "s" : ""}`
                  : urlsSubmitted
                    ? "All URLs extracted"
                    : "Submit a URL to read"
              }
              status={
                web.status === "error"
                  ? "bad"
                  : urlsFailed > 0
                    ? "warn"
                    : urlsRead > 0
                      ? "good"
                      : "neutral"
              }
            />
          </WidgetCard>

          <WidgetCard title="Last extraction" category="tools">
            <Kpi
              label="Freshness"
              value={timeLabel(web.readAt)}
              sub={web.readAt ? "Web Reader run" : "No run yet"}
            />
          </WidgetCard>
        </div>

        {/* Row 3: primary analysis (chat answer) + insights */}
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            marginBottom: 20,
          }}
        >
          <WidgetCard
            title="AI Answer"
            subtitle="Streamed from Muns Chat"
            category="analytics"
            style={{ gridColumn: "span 2", minHeight: 280 }}
            action={
              chat.status === "streaming" ? (
                <LiveDot label="streaming" />
              ) : undefined
            }
          >
            <ChatAnswerBody chat={chat} hasToken={tokenReady} />
          </WidgetCard>

          <WidgetCard title="Run notes" subtitle="Derived from this run">
            <RunNotes
              chat={chat}
              web={web}
              answerWords={answerWords}
              ticker={ticker}
            />
          </WidgetCard>
        </div>

        {/* Row 4: detail (web reader extraction) + request context */}
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            marginBottom: 20,
          }}
        >
          <WidgetCard
            title="Extracted content"
            subtitle="URL-by-URL Web Reader output"
            category="tools"
            style={{ gridColumn: "span 2", minHeight: 220 }}
          >
            <WebReaderBody web={web} hasToken={tokenReady} />
          </WidgetCard>

          <WidgetCard title="Request context" subtitle="Sent to the APIs">
            <RequestContext
              ticker={ticker}
              session={session}
              chat={chat}
              web={web}
            />
          </WidgetCard>
        </div>

        {/* Row 5: source / provenance */}
        <div style={{ marginBottom: 8 }}>
          <WidgetCard
            title="Source trail"
            subtitle="Provenance for AI and extracted data"
            category="tools"
          >
            <SourceTrail chat={chat} web={web} />
          </WidgetCard>
        </div>
      </main>

      {/* Zone 3: footer */}
      <footer
        style={{
          height: 40,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderTop: "1px solid #e5e7eb",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          fontSize: 12,
          color: "#9ca3af",
        }}
      >
        <span>Chat API · Web Reader API</span>
        <span>
          {session.orgName ? `${session.orgName} · ` : ""}
          {tokenReady ? "Session active" : "Waiting for session"}
        </span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header button
// ---------------------------------------------------------------------------
function HeaderButton({
  label,
  onClick,
  primary,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 13,
        fontWeight: 600,
        padding: "6px 14px",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        border: primary ? "1px solid #4f46e5" : "1px solid #e5e7eb",
        background: primary ? "#4f46e5" : "#ffffff",
        color: primary ? "#ffffff" : "#374151",
        opacity: disabled ? 0.55 : 1,
        transition: "all 0.2s ease",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Input field
// ---------------------------------------------------------------------------
function InputField({
  label,
  hint,
  placeholder,
  value,
  onChange,
  onSubmit,
  buttonLabel,
  buttonDisabled,
  multiline,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  buttonLabel: string;
  buttonDisabled?: boolean;
  multiline?: boolean;
}) {
  const sharedStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    fontSize: 14,
    color: "#111827",
    fontFamily: "inherit",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    resize: "vertical",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      {multiline ? (
        <textarea
          className="dashboard-input"
          style={{ ...sharedStyle, minHeight: 64 }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit();
          }}
        />
      ) : (
        <input
          className="dashboard-input"
          style={sharedStyle}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onSubmit}
          disabled={buttonDisabled}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "7px 16px",
            borderRadius: 8,
            cursor: buttonDisabled ? "not-allowed" : "pointer",
            border: "1px solid #4f46e5",
            background: buttonDisabled ? "#c7d2fe" : "#4f46e5",
            color: "#ffffff",
            transition: "all 0.2s ease",
          }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live streaming dot
// ---------------------------------------------------------------------------
function LiveDot({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: "#4f46e5",
      }}
    >
      <span
        className="pulse-dot"
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "#4f46e5",
        }}
      />
      {label}
    </span>
  );
}

function statusText(s: AsyncStatus): string {
  switch (s) {
    case "loading":
      return "Loading";
    case "streaming":
      return "Streaming";
    case "done":
      return "Ready";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

// ---------------------------------------------------------------------------
// Chat answer body
// ---------------------------------------------------------------------------
function ChatAnswerBody({
  chat,
  hasToken,
}: {
  chat: ChatState;
  hasToken: boolean;
}) {
  if (!hasToken) return <WaitingForSession />;
  if (chat.status === "error") return <ErrorState message={chat.error ?? undefined} />;
  if (chat.status === "idle")
    return (
      <EmptyState
        icon="✦"
        message="No answer yet"
        hint="Enter a query above and press Ask to stream an AI answer."
      />
    );
  if (chat.status === "streaming" && !chat.text) return <ShimmerLines rows={5} />;

  return (
    <div
      style={{
        padding: 16,
        height: "100%",
        overflow: "auto",
        fontSize: 14,
        lineHeight: 1.6,
        color: "#374151",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {chat.text}
      {chat.status === "streaming" && (
        <span
          className="pulse-dot"
          style={{
            display: "inline-block",
            width: 8,
            height: 16,
            marginLeft: 2,
            verticalAlign: "text-bottom",
            background: "#4f46e5",
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Web reader body (detail)
// ---------------------------------------------------------------------------
function WebReaderBody({ web, hasToken }: { web: WebState; hasToken: boolean }) {
  if (!hasToken) return <WaitingForSession />;
  if (web.status === "error") return <ErrorState message={web.error ?? undefined} />;
  if (web.status === "loading") return <ShimmerLines rows={4} />;
  if (web.status === "idle" || web.entries.length === 0)
    return (
      <EmptyState
        icon="🔗"
        message="No pages read yet"
        hint="Enter one or more URLs above and press Read URL."
      />
    );

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      {web.entries.map((entry, i) => (
        <div
          key={i}
          style={{
            padding: "12px 16px",
            borderBottom:
              i < web.entries.length - 1
                ? "1px solid rgba(229,231,235,0.7)"
                : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.title || hostFromUrl(entry.url)}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>
                {hostFromUrl(entry.url)} · {entry.wordCount} words
              </div>
            </div>
            <StatusChip ok={entry.status === "ok"} />
          </div>
          {entry.preview && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13,
                lineHeight: 1.5,
                color: "#374151",
              }}
            >
              {entry.preview}
              {entry.preview.length >= 600 ? "…" : ""}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusChip({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "2px 8px",
        borderRadius: 6,
        border: `1px solid ${ok ? "#bbf7d0" : "#fecdd3"}`,
        background: ok ? "#f0fdf4" : "#fff1f2",
        color: ok ? "#16a34a" : "#e11d48",
      }}
    >
      {ok ? "read" : "failed"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Insight: run notes
// ---------------------------------------------------------------------------
function RunNotes({
  chat,
  web,
  answerWords,
  ticker,
}: {
  chat: ChatState;
  web: WebState;
  answerWords: number;
  ticker: string | null;
}) {
  const notes: { label: string; tone: string; text: string }[] = [];

  if (chat.status === "done") {
    notes.push({
      label: "Answer",
      tone: "#16a34a",
      text: `Generated a ${answerWords}-word answer${
        ticker ? ` with ${ticker} context applied` : ""
      }.`,
    });
  }
  if (web.entries.some((e) => e.status === "failed")) {
    notes.push({
      label: "Watch",
      tone: "#d97706",
      text: "One or more URLs failed extraction. Check the URL or try again.",
    });
  }
  if (web.status === "done" && web.entries.every((e) => e.status === "ok")) {
    notes.push({
      label: "Source",
      tone: "#2563eb",
      text: `Extracted ${web.entries.length} page${
        web.entries.length > 1 ? "s" : ""
      } successfully via Web Reader.`,
    });
  }
  if (chat.status === "error" || web.status === "error") {
    notes.push({
      label: "Risk",
      tone: "#ef4444",
      text: "An API request failed this run. The session token may be refreshing.",
    });
  }

  if (notes.length === 0) {
    return (
      <EmptyState
        icon="◔"
        message="No notes yet"
        hint="Run the Chat or Web Reader API to see derived notes."
      />
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {notes.map((n, i) => (
        <div
          key={i}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#ffffff",
            border: "1px solid rgba(229,231,235,0.8)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: n.tone,
            }}
          >
            {n.label}
          </div>
          <div style={{ marginTop: 3, fontSize: 13, color: "#374151" }}>
            {n.text}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request context table
// ---------------------------------------------------------------------------
function RequestContext({
  ticker,
  session,
  chat,
  web,
}: {
  ticker: string | null;
  session: { orgName: string | null; userName: string | null };
  chat: ChatState;
  web: WebState;
}) {
  const rows: [string, string][] = [
    ["Chat endpoint", "POST /chat/chat-muns"],
    ["Reader endpoint", "POST /tools/web-reader"],
    ["Ticker context", ticker ?? "—"],
    ["Chat mode", "expert"],
    ["URLs in request", web.urls.length ? String(web.urls.length) : "—"],
    ["Org", session.orgName ?? "—"],
    ["Chat status", statusText(chat.status)],
  ];

  return (
    <div style={{ padding: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td
                style={{
                  padding: "7px 8px",
                  fontSize: 12,
                  color: "#6b7280",
                  borderBottom: "1px solid rgba(229,231,235,0.6)",
                  whiteSpace: "nowrap",
                }}
              >
                {k}
              </td>
              <td
                style={{
                  padding: "7px 8px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#111827",
                  textAlign: "right",
                  borderBottom: "1px solid rgba(229,231,235,0.6)",
                  wordBreak: "break-word",
                }}
              >
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source trail
// ---------------------------------------------------------------------------
function SourceTrail({ chat, web }: { chat: ChatState; web: WebState }) {
  const items: { title: string; detail: string }[] = [];

  if (chat.chatId || chat.messageId || chat.generatedAt) {
    items.push({
      title: "Muns Chat (AI answer)",
      detail: [
        chat.chatId ? `chat ${chat.chatId}` : null,
        chat.messageId ? `message ${chat.messageId}` : null,
        chat.generatedAt ? `at ${timeLabel(chat.generatedAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  for (const entry of web.entries) {
    items.push({
      title: entry.url,
      detail: `${entry.status === "ok" ? "Read" : "Failed"}${
        web.readAt ? ` · ${timeLabel(web.readAt)}` : ""
      } · ${entry.wordCount} words`,
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="≡"
        message="No sources yet"
        hint="Sources from the Chat and Web Reader APIs will appear here."
      />
    );
  }

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 10,
            padding: "8px 12px",
            borderRadius: 10,
            background: "#ffffff",
            border: "1px solid rgba(229,231,235,0.8)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              marginTop: 6,
              borderRadius: "50%",
              background: "#6366f1",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.title}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

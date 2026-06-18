import { useCallback, useMemo, useRef, useState } from "react";
import { useHostContext } from "./hooks/useHostContext";
import { useVisualCapture } from "./hooks/useVisualCapture";
import { WidgetCard } from "./components/component_WidgetCard";
import { KpiTile } from "./components/component_KpiTile";
import { TickerPill } from "./components/component_TickerPill";
import { QueryControls } from "./components/component_QueryControls";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./components/component_states";
import { readUrl, streamChat, type ChatStreamMeta } from "./lib/api";
import { sdk } from "./lib/sdk";
import {
  hostnameOf,
  toReadablePage,
  type ReadablePage,
} from "./lib/extract";
import type { WebReaderResult } from "./lib/api";

const DASHBOARD_DEFAULT_QUERY =
  "Summarize the key points and main takeaways of this page.";

type Phase = "idle" | "reading" | "answering" | "done" | "error";

interface RunContext {
  url: string;
  query: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function DashboardAskWeb() {
  const { session, ticker, tickerCompany } = useHostContext();
  useVisualCapture();

  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<WebReaderResult | null>(null);
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState<ChatStreamMeta>({
    chatId: null,
    messageId: null,
  });
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunContext | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const readable: ReadablePage = useMemo(
    () => (page ? toReadablePage(page.results) : { title: null, text: null, wordCount: 0 }),
    [page],
  );

  const hasToken = Boolean(session.token);
  const running = phase === "reading" || phase === "answering";

  const run = useCallback(
    async (override?: RunContext) => {
      const runUrl = (override?.url ?? url).trim();
      const runQuery = (override?.query ?? query).trim() || DASHBOARD_DEFAULT_QUERY;
      const token = session.token;

      if (!runUrl || !token) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setAnswer("");
      setPage(null);
      setMeta({ chatId: null, messageId: null });
      setGeneratedAt(null);
      setLastRun({ url: runUrl, query: runQuery });
      sdk.publish("dashboard.metric", { event: "run.start", url: hostnameOf(runUrl) });

      try {
        // 1) Read & extract the page content.
        setPhase("reading");
        const pageResult = await readUrl(runUrl, token, runQuery);
        setPage(pageResult);

        // 2) Stream an AI answer grounded in the extracted content.
        setPhase("answering");
        const dashboardInputs = [
          {
            type: "web_reader",
            url: runUrl,
            content: pageResult.results,
          },
        ];
        await streamChat({
          query: runQuery,
          token,
          dashboardInputs,
          ticker,
          onChunk: setAnswer,
          onMeta: setMeta,
          signal: controller.signal,
        });

        setGeneratedAt(new Date().toISOString());
        setPhase("done");
        sdk.publish("dashboard.metric", { event: "run.done" });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
        setPhase("error");
        sdk.publish("dashboard.error", { message });
      }
    },
    [url, query, session.token, ticker],
  );

  const onSubmit = useCallback(() => void run(), [run]);
  const onRefresh = useCallback(() => {
    if (lastRun) void run(lastRun);
  }, [lastRun, run]);

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
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              margin: 0,
            }}
          >
            Ask the Web
          </h1>
          {ticker && <TickerPill ticker={ticker} company={tickerCompany} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot phase={phase} />
          <button
            type="button"
            onClick={onRefresh}
            disabled={!lastRun || running || !hasToken}
            title="Re-run the last query"
            style={{
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              color: !lastRun || running || !hasToken ? "#9ca3af" : "#4338ca",
              background:
                !lastRun || running || !hasToken ? "#f3f4f6" : "#eef2ff",
              border: "1px solid #e0e7ff",
              borderRadius: 8,
              cursor:
                !lastRun || running || !hasToken ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Zone 2: scrollable content + visual export capture target */}
      <main
        id="dashboard-main"
        data-dashboard-capture-root="true"
        style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}
      >
        {/* Context / filters */}
        <Section>
          <WidgetCard
            title="Read a Page & Ask"
            subtitle="Web Reader + Muns Chat"
            category="tools"
            span2
          >
            <QueryControls
              url={url}
              query={query}
              running={running}
              disabled={!hasToken}
              disabledReason="Waiting for session..."
              onUrlChange={setUrl}
              onQueryChange={setQuery}
              onSubmit={onSubmit}
            />
          </WidgetCard>
        </Section>

        {/* KPI summary */}
        <Section minCol={220}>
          <WidgetCard title="Source Read" subtitle="web_reader" category="tools">
            <KpiTile
              value={
                phase === "reading"
                  ? "Reading…"
                  : page
                    ? "Read"
                    : phase === "error"
                      ? "Failed"
                      : "—"
              }
              tone={page ? "positive" : phase === "error" ? "negative" : "neutral"}
              scope={lastRun ? hostnameOf(lastRun.url) : "No URL yet"}
            />
          </WidgetCard>

          <WidgetCard title="Words Extracted" subtitle="From the page">
            <KpiTile
              value={readable.wordCount ? readable.wordCount.toLocaleString() : "—"}
              trend={readable.title ?? undefined}
              scope={page ? "Extracted content" : "Awaiting read"}
            />
          </WidgetCard>

          <WidgetCard title="Answer" subtitle="muns_chat" category="analytics">
            <KpiTile
              value={PHASE_LABEL[phase]}
              tone={
                phase === "done"
                  ? "positive"
                  : phase === "error"
                    ? "negative"
                    : phase === "answering"
                      ? "active"
                      : "neutral"
              }
              scope={answer ? `${answer.length.toLocaleString()} chars` : "AI synthesis"}
            />
          </WidgetCard>

          <WidgetCard title="Generated" subtitle="Last completed run">
            <KpiTile
              value={formatTime(generatedAt)}
              scope={generatedAt ? "Local time" : "Not run yet"}
            />
          </WidgetCard>
        </Section>

        {/* Primary analysis + supporting insights */}
        <Section minCol={340}>
          <WidgetCard
            title="AI Answer"
            subtitle={lastRun ? `Grounded in ${hostnameOf(lastRun.url)}` : "Grounded in the page you read"}
            category="analytics"
            span2
            bodyStyle={{ overflow: "auto", maxHeight: 460 }}
          >
            <AnswerBody phase={phase} answer={answer} error={error} />
          </WidgetCard>

          <WidgetCard title="Source Note" subtitle="Why you can trust this">
            <InsightBlock
              label="Grounding"
              tone="tools"
              line={
                page
                  ? "Answer is grounded in the extracted page content."
                  : "No page read yet — run a query to ground the answer."
              }
              support={
                page
                  ? `${readable.wordCount.toLocaleString()} words from ${lastRun ? hostnameOf(lastRun.url) : "the source"} were forwarded to Muns Chat.`
                  : "The AI answer will only use content read from your URL."
              }
            />
          </WidgetCard>

          <WidgetCard title="Extraction Quality" subtitle="Content signal">
            <InsightBlock
              label={readable.wordCount > 200 ? "Good" : readable.wordCount > 0 ? "Watch" : "Pending"}
              tone={readable.wordCount > 200 ? "sector" : "markets"}
              line={
                !page
                  ? "Awaiting extraction."
                  : readable.wordCount > 200
                    ? "The page returned substantial text."
                    : "The page returned limited text; the answer may be thin."
              }
              support={
                readable.title
                  ? `Detected title: "${readable.title}".`
                  : "No page title was detected in the extraction."
              }
            />
          </WidgetCard>
        </Section>

        {/* Detail / drilldown */}
        <Section minCol={340}>
          <WidgetCard title="Request Context" subtitle="What was sent" span2>
            <RequestContextTable
              url={lastRun?.url ?? null}
              query={lastRun?.query ?? null}
              ticker={ticker}
            />
          </WidgetCard>

          <WidgetCard
            title="Extracted Content"
            subtitle="web_reader preview"
            category="tools"
            bodyStyle={{ overflow: "auto", maxHeight: 320 }}
          >
            <ExtractedPreview phase={phase} page={page} readable={readable} />
          </WidgetCard>
        </Section>

        {/* Source / provenance */}
        <Section>
          <WidgetCard
            title="Source & Provenance"
            subtitle="Source trail for this run"
            span2
          >
            <SourceTrail
              url={lastRun?.url ?? null}
              readAt={page?.readAtIso ?? null}
              generatedAt={generatedAt}
              meta={meta}
            />
          </WidgetCard>
        </Section>
      </main>
    </div>
  );
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Idle",
  reading: "Reading…",
  answering: "Streaming…",
  done: "Ready",
  error: "Error",
};

/* ----------------------------- sub-components ----------------------------- */

function Section({
  children,
  minCol = 340,
}: {
  children: React.ReactNode;
  minCol?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}

function StatusDot({ phase }: { phase: Phase }) {
  const color =
    phase === "done"
      ? "#16a34a"
      : phase === "error"
        ? "#ef4444"
        : phase === "idle"
          ? "#9ca3af"
          : "#4f46e5";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
        }}
      />
      <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>
        {PHASE_LABEL[phase]}
      </span>
    </span>
  );
}

function AnswerBody({
  phase,
  answer,
  error,
}: {
  phase: Phase;
  answer: string;
  error: string | null;
}) {
  if (phase === "error") {
    return <ErrorState message={error ?? "The request failed."} />;
  }
  if (phase === "idle" && !answer) {
    return (
      <EmptyState
        icon="✦"
        message="Ready when you are"
        hint="Enter a URL and a question above, then press Read & Ask."
      />
    );
  }
  if (phase === "reading") {
    return (
      <div style={{ padding: 4 }}>
        <div
          style={{
            padding: "12px 16px 0",
            fontSize: 12,
            color: "#9ca3af",
          }}
        >
          Reading the page…
        </div>
        <LoadingState lines={5} />
      </div>
    );
  }
  if (phase === "answering" && !answer) {
    return (
      <div style={{ padding: 4 }}>
        <div style={{ padding: "12px 16px 0", fontSize: 12, color: "#9ca3af" }}>
          Thinking…
        </div>
        <LoadingState lines={4} />
      </div>
    );
  }
  return (
    <div
      style={{
        padding: 16,
        fontSize: 14,
        lineHeight: 1.6,
        color: "#374151",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {answer}
      {phase === "answering" && <span className="stream-caret" />}
    </div>
  );
}

function InsightBlock({
  label,
  line,
  support,
  tone,
}: {
  label: string;
  line: string;
  support: string;
  tone: "tools" | "sector" | "markets";
}) {
  const palette: Record<string, { bg: string; fg: string; bd: string }> = {
    tools: { bg: "#f0fdf4", fg: "#16a34a", bd: "#bbf7d0" },
    sector: { bg: "#f0fdfa", fg: "#0d9488", bd: "#99f6e4" },
    markets: { bg: "#eff6ff", fg: "#2563eb", bd: "#dbeafe" },
  };
  const c = palette[tone];
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          alignSelf: "flex-start",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          padding: "2px 8px",
          borderRadius: 6,
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.bd}`,
        }}
      >
        {label}
      </span>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.45 }}>
        {line}
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.45 }}>
        {support}
      </div>
    </div>
  );
}

function RequestContextTable({
  url,
  query,
  ticker,
}: {
  url: string | null;
  query: string | null;
  ticker: string | null;
}) {
  if (!url) {
    return (
      <EmptyState
        message="No request sent yet"
        hint="Run a query to see exactly what was forwarded to each API."
      />
    );
  }
  const rows: Array<[string, string]> = [
    ["Question (task)", query ?? "—"],
    ["Source URL", url],
    ["Selected ticker", ticker ?? "None"],
    ["Web Reader", "POST fastapi · /tools/web-reader"],
    ["Muns Chat", "POST nestjs · /chat/chat-muns"],
    ["Grounding", "Extracted content forwarded via DASHBOARD_INPUTS"],
  ];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={k} style={{ background: i % 2 ? "transparent" : "rgba(255,255,255,0.6)" }}>
            <td
              style={{
                padding: "9px 16px",
                color: "#6b7280",
                fontWeight: 600,
                whiteSpace: "nowrap",
                verticalAlign: "top",
                width: 160,
              }}
            >
              {k}
            </td>
            <td
              style={{
                padding: "9px 16px",
                color: "#374151",
                wordBreak: "break-word",
              }}
            >
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExtractedPreview({
  phase,
  page,
  readable,
}: {
  phase: Phase;
  page: WebReaderResult | null;
  readable: ReadablePage;
}) {
  if (phase === "reading") return <LoadingState lines={6} />;
  if (!page) {
    return (
      <EmptyState
        message="Nothing extracted yet"
        hint="The page text read by Web Reader will appear here."
      />
    );
  }
  const preview = readable.text
    ? readable.text.slice(0, 1200)
    : JSON.stringify(page.results, null, 2).slice(0, 1200);
  return (
    <div style={{ padding: 16 }}>
      {readable.title && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          {readable.title}
        </div>
      )}
      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "#6b7280",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {preview}
        {(readable.text?.length ?? 0) > 1200 && " …"}
      </div>
    </div>
  );
}

function SourceTrail({
  url,
  readAt,
  generatedAt,
  meta,
}: {
  url: string | null;
  readAt: string | null;
  generatedAt: string | null;
  meta: ChatStreamMeta;
}) {
  if (!url) {
    return (
      <EmptyState
        message="No sources yet"
        hint="Source URLs, timestamps, and chat IDs appear here after a run."
      />
    );
  }
  const entries: Array<{ title: string; detail: string }> = [
    {
      title: hostnameOf(url),
      detail: `Read via Web Reader${readAt ? ` · ${formatTime(readAt)}` : ""} — ${url}`,
    },
    {
      title: "Muns Chat answer",
      detail: `AI synthesis${generatedAt ? ` · generated ${formatTime(generatedAt)}` : " · streaming"}`,
    },
  ];
  if (meta.chatId) {
    entries.push({ title: "Chat ID", detail: meta.chatId });
  }
  if (meta.messageId) {
    entries.push({ title: "Message ID", detail: meta.messageId });
  }
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {entries.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 10 }}>
          <span
            style={{
              marginTop: 5,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#6366f1",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              {e.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#9ca3af",
                wordBreak: "break-word",
              }}
            >
              {e.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

import { useState, type CSSProperties } from "react";

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6b7280",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  fontSize: 14,
  color: "#111827",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  outline: "none",
  fontFamily: "inherit",
  transition: "all 0.2s ease",
};

const fieldHintStyle: CSSProperties = {
  fontSize: 11,
  color: "#9ca3af",
  marginTop: 5,
};

export interface QueryControlsProps {
  url: string;
  query: string;
  running: boolean;
  disabled: boolean;
  disabledReason?: string;
  onUrlChange: (v: string) => void;
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
}

/**
 * Context/filter widget content: the two inputs that drive the dashboard.
 *   - URL  -> web_reader datasource
 *   - Query -> muns_chat datasource (grounded in the read URL)
 */
export function QueryControls({
  url,
  query,
  running,
  disabled,
  disabledReason,
  onUrlChange,
  onQueryChange,
  onSubmit,
}: QueryControlsProps) {
  const [focused, setFocused] = useState<string | null>(null);

  const focusRing = (name: string): CSSProperties =>
    focused === name
      ? { borderColor: "#4f46e5", boxShadow: "0 0 0 3px rgba(79,70,229,0.12)" }
      : {};

  const canSubmit = !disabled && !running && url.trim().length > 0;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <div>
          <label style={labelStyle} htmlFor="aw-url">
            Source URL · Web Reader
          </label>
          <input
            id="aw-url"
            type="url"
            inputMode="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onFocus={() => setFocused("url")}
            onBlur={() => setFocused(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit();
            }}
            style={{ ...inputStyle, ...focusRing("url") }}
          />
          <div style={fieldHintStyle}>Page to read and extract content from.</div>
        </div>

        <div>
          <label style={labelStyle} htmlFor="aw-query">
            Your Question · Muns Chat
          </label>
          <input
            id="aw-query"
            type="text"
            placeholder="What does this page say about…?"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setFocused("query")}
            onBlur={() => setFocused(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit();
            }}
            style={{ ...inputStyle, ...focusRing("query") }}
          />
          <div style={fieldHintStyle}>
            Answered by AI, grounded in the page above.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            background: canSubmit ? "#4f46e5" : "#c7cad1",
            border: "none",
            borderRadius: 10,
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            transition: "all 0.2s ease",
          }}
        >
          {running ? "Running…" : "Read & Ask"}
        </button>
        {disabled && disabledReason && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{disabledReason}</span>
        )}
        {!disabled && !url.trim() && (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            Enter a URL to begin.
          </span>
        )}
      </div>
    </div>
  );
}

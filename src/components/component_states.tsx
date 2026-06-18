import type { ReactNode } from "react";

/** Centered container shared by empty/error states inside a widget body. */
function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: 160,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 8,
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

/** Shimmer skeleton loading state (never a blank card or raw spinner). */
export function LoadingState({ lines = 3 }: { lines?: number }) {
  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="shimmer"
          style={{ height: 12, width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  message,
  hint,
  icon = "○",
}: {
  message: string;
  hint?: string;
  icon?: string;
}) {
  return (
    <CenteredState>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "#eef2ff",
          color: "#4f46e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
        {message}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "#9ca3af", maxWidth: 320 }}>
          {hint}
        </div>
      )}
    </CenteredState>
  );
}

export function ErrorState({
  message,
  hint = "Please try again later.",
}: {
  message: string;
  hint?: string;
}) {
  return (
    <CenteredState>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "#fef2f2",
          color: "#ef4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        !
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
        {message}
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>{hint}</div>
    </CenteredState>
  );
}

/** Non-blocking waiting state for transient null token (auth-standards.md). */
export function WaitingForSession() {
  return (
    <div
      style={{
        padding: 16,
        textAlign: "center",
        color: "#9ca3af",
        fontSize: 13,
      }}
    >
      Waiting for session...
    </div>
  );
}

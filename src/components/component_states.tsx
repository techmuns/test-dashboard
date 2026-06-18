import type { ReactNode } from "react";

// Shared loading / empty / error / waiting states (UI + State Standards).

export function ShimmerLines({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="shimmer"
          style={{ height: 12, width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  icon = "○",
  message,
  hint,
}: {
  icon?: ReactNode;
  message: string;
  hint?: string;
}) {
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
        padding: 24,
        gap: 8,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#eef2ff",
          color: "#4f46e5",
          fontSize: 20,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
        {message}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "#9ca3af", maxWidth: 280 }}>{hint}</div>
      )}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
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
        padding: 24,
        gap: 8,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fef2f2",
          color: "#ef4444",
          fontSize: 20,
        }}
      >
        !
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
        Something went wrong
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", maxWidth: 300 }}>
        {message || "Please try again later."}
      </div>
    </div>
  );
}

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
      Waiting for session…
    </div>
  );
}

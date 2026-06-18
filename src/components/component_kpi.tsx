import type { ReactNode } from "react";

// Compact KPI block rendered inside a WidgetCard body (KPI Standards).

export function Kpi({
  label,
  value,
  sub,
  status,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  status?: "neutral" | "good" | "warn" | "bad";
}) {
  const statusColor =
    status === "good"
      ? "#16a34a"
      : status === "warn"
        ? "#d97706"
        : status === "bad"
          ? "#ef4444"
          : "#111827";

  return (
    <div style={{ padding: "14px 16px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 24,
          fontWeight: 700,
          color: statusColor,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 2, fontSize: 12, color: "#9ca3af" }}>{sub}</div>
      )}
    </div>
  );
}

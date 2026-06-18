import type { ReactNode } from "react";

type Tone = "neutral" | "positive" | "negative" | "active";

const TONE_COLOR: Record<Tone, string> = {
  neutral: "#111827",
  positive: "#16a34a",
  negative: "#ef4444",
  active: "#4f46e5",
};

/**
 * Compact KPI content rendered inside a WidgetCard body. Each KPI carries a
 * value, an optional comparison/trend, and a scope (dashboard-patterns.md).
 */
export function KpiTile({
  value,
  trend,
  scope,
  tone = "neutral",
}: {
  value: ReactNode;
  trend?: string;
  scope?: string;
  tone?: Tone;
}) {
  return (
    <div style={{ padding: "16px 16px 18px" }}>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: TONE_COLOR[tone],
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {trend && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
          {trend}
        </div>
      )}
      {scope && (
        <div style={{ marginTop: 2, fontSize: 11, color: "#9ca3af" }}>
          {scope}
        </div>
      )}
    </div>
  );
}

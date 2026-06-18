import type { CSSProperties, ReactNode } from "react";

// Standard widget shell. Every data widget must use this (UI Standards).

export type WidgetCategory =
  | "markets"
  | "crypto"
  | "analytics"
  | "tools"
  | "india"
  | "heatmaps"
  | "sector";

const CATEGORY_COLORS: Record<
  WidgetCategory,
  { bg: string; text: string; border: string }
> = {
  markets: { bg: "#eff6ff", text: "#2563eb", border: "#dbeafe" },
  crypto: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
  analytics: { bg: "#f5f3ff", text: "#7c3aed", border: "#ede9fe" },
  tools: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  india: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  heatmaps: { bg: "#fff1f2", text: "#e11d48", border: "#fecdd3" },
  sector: { bg: "#f0fdfa", text: "#0d9488", border: "#99f6e4" },
};

export function CategoryBadge({ category }: { category: WidgetCategory }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "2px 8px",
        borderRadius: 6,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.text,
      }}
    >
      {category}
    </span>
  );
}

export interface WidgetCardProps {
  title: string;
  subtitle?: string;
  category?: WidgetCategory;
  action?: ReactNode;
  bodyStyle?: CSSProperties;
  style?: CSSProperties;
  children: ReactNode;
}

export function WidgetCard({
  title,
  subtitle,
  category,
  action,
  bodyStyle,
  style,
  children,
}: WidgetCardProps) {
  return (
    <div
      className="widget-card"
      style={{
        background: "rgba(255, 255, 255, 0.9)",
        border: "1px solid rgba(229, 231, 235, 0.8)",
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(8px)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(229, 231, 235, 0.8)",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "#9ca3af",
                lineHeight: 1.3,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {action}
          {category && <CategoryBadge category={category} />}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          background: "rgba(249,250,251,0.5)",
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}

import type { CSSProperties, ReactNode } from "react";

type Category =
  | "markets"
  | "crypto"
  | "analytics"
  | "tools"
  | "india"
  | "heatmaps"
  | "sector";

const CATEGORY_COLORS: Record<
  Category,
  { background: string; color: string; border: string }
> = {
  markets: { background: "#eff6ff", color: "#2563eb", border: "#dbeafe" },
  crypto: { background: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  analytics: { background: "#f5f3ff", color: "#7c3aed", border: "#ede9fe" },
  tools: { background: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  india: { background: "#fffbeb", color: "#d97706", border: "#fde68a" },
  heatmaps: { background: "#fff1f2", color: "#e11d48", border: "#fecdd3" },
  sector: { background: "#f0fdfa", color: "#0d9488", border: "#99f6e4" },
};

function CategoryBadge({ category }: { category: Category }) {
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
        background: c.background,
        color: c.color,
        whiteSpace: "nowrap",
      }}
    >
      {category}
    </span>
  );
}

export interface WidgetCardProps {
  title: string;
  subtitle?: string;
  category?: Category;
  /** Optional element rendered on the right side of the header. */
  headerAccessory?: ReactNode;
  /** Span two grid columns for primary/detail widgets. */
  span2?: boolean;
  bodyStyle?: CSSProperties;
  children: ReactNode;
}

/** The single card shell used for every data widget (ui-standards.md). */
export function WidgetCard({
  title,
  subtitle,
  category,
  headerAccessory,
  span2,
  bodyStyle,
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
        gridColumn: span2 ? "span 2" : undefined,
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
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
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
          {headerAccessory}
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

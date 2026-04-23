import type { ReactNode } from "react";

type Tone = "success" | "warning" | "error" | "muted";

function toneFor(percent: number | null | undefined): Tone {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return "muted";
  if (percent > 100) return "error";
  if (percent >= 80) return "warning";
  return "success";
}

const TONE_COLOR: Record<Tone, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  muted: "var(--color-text-tertiary)",
};

/**
 * Colored dot signalling budget state. Thresholds:
 *   < 80%   → success (green)
 *   80–100% → warning (amber)
 *   > 100%  → error (red)
 *   null/NaN → muted (gray, "no data")
 */
export function BudgetDot({
  percent,
  size = "md",
  className = "",
  label,
}: {
  /** Spend / budget ratio, expressed as a percentage (e.g. 82 for 82%). */
  percent: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
  /** Optional accessible label; defaults to the tone. */
  label?: ReactNode;
}) {
  const tone = toneFor(percent);
  const sizeClass = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const title =
    typeof label === "string"
      ? label
      : tone === "error"
      ? "Over budget"
      : tone === "warning"
      ? "Approaching budget"
      : tone === "muted"
      ? "No budget data"
      : "On budget";
  return (
    <span
      role="img"
      aria-label={typeof title === "string" ? title : undefined}
      title={typeof title === "string" ? title : undefined}
      className={`inline-block shrink-0 rounded-full ${sizeClass} ${className}`}
      style={{ backgroundColor: TONE_COLOR[tone] }}
    />
  );
}

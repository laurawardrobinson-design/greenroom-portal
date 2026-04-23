import type { ReactNode } from "react";

export type StatusVariant =
  | "draft"
  | "submitted"
  | "pending"
  | "approved"
  | "rejected"
  | "info";

const VARIANT_STYLES: Record<
  StatusVariant,
  { color: string; background: string; border: string }
> = {
  draft: {
    color: "var(--color-text-secondary)",
    background: "rgba(107, 114, 128, 0.08)",
    border: "rgba(107, 114, 128, 0.20)",
  },
  submitted: {
    color: "var(--color-info)",
    background: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.20)",
  },
  pending: {
    color: "var(--color-warning)",
    background: "rgba(217, 119, 6, 0.08)",
    border: "rgba(217, 119, 6, 0.20)",
  },
  approved: {
    color: "var(--color-success)",
    background: "rgba(5, 150, 105, 0.08)",
    border: "rgba(5, 150, 105, 0.20)",
  },
  rejected: {
    color: "var(--color-error)",
    background: "rgba(220, 38, 38, 0.08)",
    border: "rgba(220, 38, 38, 0.20)",
  },
  info: {
    color: "var(--color-info)",
    background: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.20)",
  },
};

export function StatusPill({
  variant,
  children,
  icon,
  className = "",
}: {
  variant: StatusVariant;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const styles = VARIANT_STYLES[variant];
  return (
    <span
      data-variant={variant}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${className}`}
      style={{
        color: styles.color,
        backgroundColor: styles.background,
        borderColor: styles.border,
      }}
    >
      {icon}
      {children}
    </span>
  );
}

import type { CSSProperties, ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "custom";

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

const variantStyle: Record<Exclude<BadgeVariant, "custom">, CSSProperties> = {
  default: {
    color: "var(--status-draft-fg)",
    backgroundColor: "var(--status-draft-tint)",
  },
  success: {
    color: "var(--status-approved-fg)",
    backgroundColor: "var(--status-approved-tint)",
  },
  warning: {
    color: "var(--status-pending-fg)",
    backgroundColor: "var(--status-pending-tint)",
  },
  error: {
    color: "var(--status-rejected-fg)",
    backgroundColor: "var(--status-rejected-tint)",
  },
  info: {
    color: "var(--status-info-fg)",
    backgroundColor: "var(--status-info-tint)",
  },
};

export function Badge({
  variant = "default",
  className = "",
  children,
}: BadgeProps) {
  const style = variant === "custom" ? undefined : variantStyle[variant];
  return (
    <span
      data-variant={variant}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

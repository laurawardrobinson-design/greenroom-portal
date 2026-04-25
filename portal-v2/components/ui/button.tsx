import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover shadow-xs hover:shadow-sm active:shadow-xs",
  secondary:
    "bg-surface-secondary text-text-primary border border-border hover:bg-surface-tertiary",
  outline:
    "border border-border text-text-primary hover:bg-surface-secondary",
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-surface-secondary",
  danger:
    "bg-error text-white hover:bg-red-700 shadow-xs",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-[var(--density-button-h-sm)] px-[var(--density-button-px-sm)] text-xs gap-[var(--density-button-gap-sm)] rounded-[var(--density-button-radius-sm)]",
  md: "h-[var(--density-button-h-md)] px-[var(--density-button-px-md)] text-sm gap-[var(--density-button-gap-md)] rounded-[var(--density-button-radius-md)]",
  lg: "h-[var(--density-button-h-lg)] px-[var(--density-button-px-lg)] text-sm gap-[var(--density-button-gap-lg)] rounded-[var(--density-button-radius-lg)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium
          transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-out)]
          disabled:pointer-events-none disabled:opacity-50
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

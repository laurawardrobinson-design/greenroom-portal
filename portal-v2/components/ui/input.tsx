import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    const hintId = hint && !error && inputId ? `${inputId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="space-y-[var(--density-form-stack-gap)]">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-label={!label ? (props.placeholder || undefined) : undefined}
          className={`
            block w-full rounded-[var(--density-control-radius)] border bg-surface px-[var(--density-control-px)] py-[var(--density-control-py)]
            text-sm text-text-primary placeholder:text-text-tertiary
            shadow-xs transition-[color,background-color,border-color,box-shadow,opacity]
            focus:border-primary focus:outline-none
            disabled:bg-surface-secondary disabled:text-text-tertiary
            ${error ? "border-error" : "border-border"}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-error" role="alert">{error}</p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-xs text-text-tertiary">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

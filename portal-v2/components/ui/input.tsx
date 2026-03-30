import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
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
          className={`
            block w-full rounded-lg border bg-surface px-3.5 py-2.5
            text-sm text-text-primary placeholder:text-text-tertiary
            shadow-xs transition-all
            focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none
            disabled:bg-surface-secondary disabled:text-text-tertiary
            ${error ? "border-error" : "border-border"}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-error">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-text-tertiary">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

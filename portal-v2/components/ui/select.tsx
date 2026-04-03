import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = "", id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = error && selectId ? `${selectId}-error` : undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          aria-label={!label ? (placeholder || undefined) : undefined}
          className={`
            block w-full rounded-lg border bg-surface px-3.5 py-2.5
            text-sm text-text-primary
            shadow-xs transition-all appearance-none
            focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none
            disabled:bg-surface-secondary disabled:text-text-tertiary
            ${error ? "border-error" : "border-border"}
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-text-tertiary">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p id={errorId} className="text-xs text-error" role="alert">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

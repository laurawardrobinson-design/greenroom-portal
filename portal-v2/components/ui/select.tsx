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
      <div className="space-y-[var(--density-form-stack-gap)]">
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
            block w-full rounded-[var(--density-control-radius)] border bg-surface px-[var(--density-control-px)] py-[var(--density-control-py)]
            text-sm text-text-primary
            shadow-xs transition-[color,background-color,border-color,box-shadow,opacity] appearance-none
            focus:border-primary focus:outline-none
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

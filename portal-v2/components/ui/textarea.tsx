import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = error && textareaId ? `${textareaId}-error` : undefined;

    return (
      <div className="space-y-[var(--density-form-stack-gap)]">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          aria-label={!label ? (props.placeholder || undefined) : undefined}
          className={`
            block w-full rounded-[var(--density-control-radius)] border bg-surface px-[var(--density-control-px)] py-[var(--density-control-py)]
            text-sm text-text-primary placeholder:text-text-tertiary
            shadow-xs transition-all resize-y min-h-[var(--density-textarea-min-h)]
            focus:border-primary focus:outline-none
            disabled:bg-surface-secondary disabled:text-text-tertiary
            ${error ? "border-error" : "border-border"}
            ${className}
          `}
          {...props}
        />
        {error && <p id={errorId} className="text-xs text-error" role="alert">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

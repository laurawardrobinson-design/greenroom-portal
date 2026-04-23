"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface ToastContextType {
  toast: (type: ToastType, message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const typeStyles: Record<ToastType, { color: string; background: string; border: string }> = {
  success: {
    color: "var(--status-approved-fg)",
    background: "var(--status-approved-tint)",
    border: "var(--status-approved-border)",
  },
  error: {
    color: "var(--status-rejected-fg)",
    background: "var(--status-rejected-tint)",
    border: "var(--status-rejected-border)",
  },
  info: {
    color: "var(--status-info-fg)",
    background: "var(--status-info-tint)",
    border: "var(--status-info-border)",
  },
  warning: {
    color: "var(--status-pending-fg)",
    background: "var(--status-pending-tint)",
    border: "var(--status-pending-border)",
  },
};

const typeIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "!",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, action?: ToastAction) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message, action }]);

    // Auto-dismiss: 5s if action present, 4s otherwise
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, action ? 5000 : 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            data-type={t.type}
            className="flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md text-sm font-medium animate-in slide-in-from-right fade-in duration-200"
            style={{
              color: typeStyles[t.type].color,
              backgroundColor: typeStyles[t.type].background,
              borderColor: typeStyles[t.type].border,
            }}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs">
              {typeIcons[t.type]}
            </span>
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  removeToast(t.id);
                }}
                className="shrink-0 text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

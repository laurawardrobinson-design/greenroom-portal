"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel — slides from right on desktop, bottom sheet on mobile */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        className={`
          absolute right-0 top-0 bottom-0 w-full ${sizeStyles[size]}
          bg-surface border-l border-border shadow-lg
          overflow-y-auto overscroll-contain
          animate-in slide-in-from-right duration-300
          max-sm:top-auto max-sm:left-0 max-sm:right-0 max-sm:bottom-0
          max-sm:max-w-none max-sm:max-h-[90vh] max-sm:rounded-t-2xl
          max-sm:border-l-0 max-sm:border-t max-sm:animate-none
        `}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-[var(--density-drawer-header-px)] py-[var(--density-drawer-header-py)]">
          <div>
            {title && (
              <h2
                id="drawer-title"
                className="text-lg font-semibold text-text-primary"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-[var(--density-drawer-desc-mt)] text-sm text-text-secondary">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-[var(--density-drawer-close-pad)] text-text-secondary hover:bg-fill-secondary hover:text-text-primary"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-[var(--density-drawer-content-pad)]">{children}</div>
      </div>
    </div>
  );
}

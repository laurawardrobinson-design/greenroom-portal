"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";

interface ModalProps {
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
  xl: "max-w-xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus trap
  useEffect(() => {
    if (!open) return;

    const content = contentRef.current;
    if (!content) return;

    const focusableEls = content.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("keydown", handleTab);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("keydown", handleTab);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Content */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={`
          relative w-full ${sizeStyles[size]}
          rounded-xl border border-border bg-surface p-5 shadow-lg
          animate-in fade-in zoom-in-95 duration-200
          max-h-[90vh] overflow-y-auto overscroll-contain
          max-sm:rounded-b-none max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:max-w-none max-sm:rounded-t-2xl max-sm:animate-none
        `}
      >
        {title && (
          <div className="mb-4">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-text-primary"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-text-secondary">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-6 flex items-center justify-end gap-3 ${className}`}
    >
      {children}
    </div>
  );
}

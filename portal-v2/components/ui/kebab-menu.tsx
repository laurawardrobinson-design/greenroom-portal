"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export type KebabMenuItem = {
  label: string;
  onClick: () => void | Promise<void>;
  icon?: ReactNode;
  variant?: "default" | "danger";
  disabled?: boolean;
};

/**
 * Three-dot actions menu for list items. Opens on click; closes on outside
 * click, Escape, or selection.
 *
 * Place inside a relatively-positioned parent. The menu positions absolute
 * to the trigger.
 */
export function KebabMenu({
  items,
  align = "end",
  label = "Open actions",
  className = "",
}: {
  items: KebabMenuItem[];
  align?: "start" | "end";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-primary"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg ${
            align === "start" ? "left-0" : "right-0"
          }`}
        >
          {items.map((item, idx) => (
            <button
              key={`${item.label}-${idx}`}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                setOpen(false);
                await item.onClick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                item.variant === "danger"
                  ? "text-error hover:bg-error/5"
                  : "text-text-primary hover:bg-surface-secondary"
              }`}
            >
              {item.icon && (
                <span className="shrink-0 text-text-tertiary [&>svg]:h-4 [&>svg]:w-4">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

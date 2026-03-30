"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  defaultExpanded?: boolean;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

function getStoredState(id: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(`section-${id}`);
  if (stored === null) return fallback;
  return stored === "true";
}

export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  defaultExpanded = true,
  badge,
  actions,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setExpanded(getStoredState(id, defaultExpanded));
    setMounted(true);
  }, [id, defaultExpanded]);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem(`section-${id}`, String(next));
  }

  return (
    <div className={`border border-border rounded-lg bg-surface ${className}`}>
      <div className={`flex items-center px-3.5 py-2.5 ${expanded ? "border-b border-border" : ""}`}>
        <div
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
          tabIndex={0}
          role="button"
          aria-expanded={expanded}
          className="flex flex-1 items-center gap-2 cursor-pointer select-none"
        >
          {Icon && (
            <Icon className="h-4 w-4 shrink-0 text-primary" />
          )}
          <span className="text-sm font-semibold text-text-primary tracking-wider uppercase">
            {title}
          </span>
          {badge && !expanded && (
            <span className="ml-1.5 text-[13px] text-text-tertiary font-normal normal-case tracking-normal">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {actions && expanded && (
            <div className="flex items-center gap-1">
              {actions}
            </div>
          )}
          <div
            onClick={toggle}
            className="cursor-pointer p-0.5"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 text-text-tertiary transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>
      </div>
      {mounted && expanded && (
        <div className="px-3.5 pb-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

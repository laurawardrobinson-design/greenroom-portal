"use client";

import type { ComponentType } from "react";

export interface PageTab {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface PageTabsProps {
  tabs: PageTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function PageTabs({ tabs, activeTab, onTabChange }: PageTabsProps) {
  return (
    <div className="border-b border-border">
      <nav className="flex gap-0">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={`
                relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors
                ${active
                  ? "text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
                }
              `}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-text-tertiary/60"}`} />
              {label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

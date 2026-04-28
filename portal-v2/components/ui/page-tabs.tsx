"use client";

import type { ElementType, ReactNode } from "react";

export interface PageTab {
  key: string;
  label: string;
  icon?: ElementType<{ className?: string }>;
  count?: number;
}

interface PageTabsProps {
  tabs: PageTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  ariaLabel?: string;
  rightSlot?: ReactNode;
}

export function PageTabs({ tabs, activeTab, onTabChange, ariaLabel = "Sections", rightSlot }: PageTabsProps) {
  return (
    <div className="border-b border-border flex items-center">
      <nav className="ui-tabs flex-1 scrollbar-hide" role="tablist" aria-label={ariaLabel}>
        {tabs.map(({ key, label, icon: Icon, count }) => {
          const active = activeTab === key;
          const hasCount = count !== undefined;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              onClick={() => onTabChange(key)}
              data-state={active ? "active" : "inactive"}
              className="ui-tab"
            >
              {Icon && <Icon className="ui-tab-icon" />}
              {label}
              {hasCount && count > 0 && (
                <span>({count})</span>
              )}
              {active && (
                <span className="ui-tab-underline" />
              )}
            </button>
          );
        })}
      </nav>
      {rightSlot && <div className="flex items-center gap-1 pr-1">{rightSlot}</div>}
    </div>
  );
}

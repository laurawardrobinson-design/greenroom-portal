"use client";

import { Menu } from "lucide-react";
import { NotificationBell } from "./notification-bell";

interface TopbarProps {
  title?: string;
  onMenuClick: () => void;
  children?: React.ReactNode;
}

export function Topbar({ title, onMenuClick, children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur-sm lg:hidden">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-surface-secondary hover:text-text-primary lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      {title && (
        <h1 className="text-base font-semibold text-text-primary">{title}</h1>
      )}

      {/* Right section — actions, search, etc. */}
      <div className="ml-auto flex items-center gap-2">
        {children}
        <NotificationBell variant="topbar" />
      </div>
    </header>
  );
}

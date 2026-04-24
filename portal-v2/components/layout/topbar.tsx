"use client";

import { Menu } from "lucide-react";
import type { UserRole } from "@/types/domain";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

interface TopbarProps {
  title?: string;
  onMenuClick: () => void;
  userName: string;
  userRole: UserRole;
  userFavoriteProduct?: string;
  children?: React.ReactNode;
}

export function Topbar({
  title,
  onMenuClick,
  userName,
  userRole,
  userFavoriteProduct,
  children,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur-sm">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="flex h-11 w-11 items-center justify-center rounded-md text-text-secondary hover:bg-surface-secondary hover:text-text-primary lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile page title */}
      {title && (
        <h1 className="text-base font-semibold text-text-primary lg:hidden">{title}</h1>
      )}

      {/* Right section */}
      <div className="ml-auto flex items-center gap-1">
        {children}
        <NotificationBell variant="topbar" />
        <UserMenu
          userName={userName}
          userRole={userRole}
          userFavoriteProduct={userFavoriteProduct}
        />
      </div>
    </header>
  );
}

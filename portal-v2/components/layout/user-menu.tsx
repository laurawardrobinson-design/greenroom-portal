"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Compass, LogOut, Settings } from "lucide-react";
import type { UserRole } from "@/types/domain";
import { createClient } from "@/lib/supabase/client";
import { formatRoleLabel } from "@/lib/auth/roles";
import { UserAvatar } from "@/components/ui/user-avatar";

interface UserMenuProps {
  userName: string;
  userRole: UserRole;
  userFavoriteProduct?: string;
}

export function UserMenu({ userName, userRole, userFavoriteProduct }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  async function handleSignOut() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const showGoals: boolean = ["Admin", "Producer", "Post Producer", "Studio", "Art Director"].includes(userRole);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-secondary"
      >
        <UserAvatar name={userName} favoriteProduct={userFavoriteProduct} size="sm" />
        <div className="hidden min-w-0 text-left lg:block">
          <p className="truncate text-sm font-medium text-text-primary leading-tight">{userName}</p>
          <p className="truncate text-[11px] text-text-tertiary leading-tight">{formatRoleLabel(userRole)}</p>
        </div>
        <ChevronDown className="hidden h-4 w-4 shrink-0 text-text-tertiary lg:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-3 py-2.5 lg:hidden">
            <p className="truncate text-sm font-medium text-text-primary">{userName}</p>
            <p className="truncate text-[11px] text-text-tertiary">{formatRoleLabel(userRole)}</p>
          </div>

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-secondary"
          >
            <Settings className="h-4 w-4 shrink-0 text-text-tertiary" />
            <span>Settings</span>
          </Link>

          {showGoals && (
            <Link
              href="/goals"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-secondary"
            >
              <Compass className="h-4 w-4 shrink-0 text-text-tertiary" />
              <span>Goals</span>
            </Link>
          )}

          <div className="border-t border-border">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-error transition-colors hover:bg-error/5"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

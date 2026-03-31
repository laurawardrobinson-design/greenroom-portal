"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types/domain";
import {
  LayoutDashboard,
  Film,
  Contact,
  Package,
  Boxes,
  Utensils,
  Calendar,
  DollarSign,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { GatorEasterEgg } from "./gator-easter-egg";
import { NotificationBell } from "./notification-bell";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["Admin", "Producer", "Studio", "Vendor", "Art Director"],
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: Film,
    roles: ["Admin", "Producer", "Studio", "Vendor", "Art Director"],
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: Calendar,
    roles: ["Admin", "Producer", "Studio", "Art Director"],
  },
  {
    label: "Gear",
    href: "/gear",
    icon: Package,
    roles: ["Admin", "Producer", "Studio"],
  },
  {
    label: "Props",
    href: "/props",
    icon: Boxes,
    roles: ["Admin", "Producer", "Studio"],
  },
  {
    label: "Food",
    href: "/food",
    icon: Utensils,
    roles: ["Admin", "Producer", "Studio", "Art Director"],
  },
  {
    label: "Contacts",
    href: "/contacts",
    icon: Contact,
    roles: ["Admin", "Producer", "Studio"],
  },
  {
    label: "Budget",
    href: "/budget",
    icon: DollarSign,
    roles: ["Admin", "Producer"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["Admin", "Producer", "Studio", "Vendor", "Art Director"],
  },
];

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  userAvatar?: string;
  userProductEmoji?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  userRole,
  userName,
  userProductEmoji,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const filteredNav = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const sidebarContent = (
    <div className="relative flex h-full flex-col bg-sidebar text-white">
      {/* Header */}
      <div className="flex h-20 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center">
          {/* Logo — actual Greenroom wordmark */}
          <img
            src="/greenroom-logo.png"
            alt="Greenroom — Publix Creative Studio"
            className="w-full max-w-[200px]"
          />
        </Link>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden rounded-md p-1 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6">
        {filteredNav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={`
                group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm tracking-wide
                transition-all duration-[var(--duration-fast)]
                ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-[#D9E4D6]/60 font-medium hover:text-[#D9E4D6]"
                }
              `}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? "text-primary" : "text-[#D9E4D6]/40 group-hover:text-[#D9E4D6]/60"
                }`}
              />
              {item.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Easter egg */}
      <GatorEasterEgg />

      {/* User section */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
            {userProductEmoji ? (
              <span className="text-base leading-none">{userProductEmoji}</span>
            ) : (
              userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-white/50 capitalize">{userRole}</p>
          </div>
          <NotificationBell variant="sidebar" />
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
            onClick={onMobileClose}
          />
          <aside className="relative w-64 h-full animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

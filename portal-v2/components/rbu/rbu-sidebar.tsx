"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { PRDepartment } from "@/types/domain";

const NAV_ITEMS: {
  key: string;
  label: string;
  icon: LucideIcon;
  segment: string;
}[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, segment: "dashboard" },
  { key: "calendar", label: "Calendar", icon: CalendarDays, segment: "" },
  { key: "products", label: "Products", icon: Package, segment: "products" },
];

export function RBUSidebar({
  token,
}: {
  token: string;
  department?: PRDepartment;
  deptLabel?: string;
}) {
  const pathname = usePathname();
  const base = `/pr/dept/${token}`;

  const handleLogout = () => {
    window.location.href = "/login";
  };

  // Two products entries share a prefix (`products` and `products/review`),
  // so when both could match we hand the active state to the most specific
  // one — otherwise both light up on /products/review.
  const isActive = (segment: string) => {
    const href = segment ? `${base}/${segment}` : base;
    if (!segment) return pathname === href;
    const matches = pathname === href || pathname.startsWith(href + "/");
    if (!matches) return false;
    const moreSpecific = NAV_ITEMS.some((other) => {
      if (!other.segment || other.segment === segment) return false;
      const otherHref = `${base}/${other.segment}`;
      if (!otherHref.startsWith(href + "/")) return false;
      return pathname === otherHref || pathname.startsWith(otherHref + "/");
    });
    return !moreSpecific;
  };

  return (
    <aside className="no-print hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[245px] lg:flex-col">
      <div className="relative flex h-full flex-col bg-sidebar text-white">
        {/* Header — logo */}
        <div className="flex h-20 items-center px-4">
          <Link href={base} className="flex items-center">
            <img
              src="/greenroom-logo.png"
              alt="Greenroom — Publix Creative Studio"
              className="w-full max-w-[200px]"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-1 px-4 py-6">
          {NAV_ITEMS.map((item) => {
            const href = item.segment ? `${base}/${item.segment}` : base;
            const active = isActive(item.segment);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={href}
                className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm tracking-wide transition-all ${
                  active
                    ? "text-white font-semibold"
                    : "text-[#D9E4D6]/60 font-medium hover:text-[#D9E4D6]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    active
                      ? "text-primary"
                      : "text-[#D9E4D6]/40 group-hover:text-[#D9E4D6]/60"
                  }`}
                />
                <span className="whitespace-nowrap">{item.label}</span>
                {active && (
                  <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Identity + logout */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <span className="h-8 w-8 shrink-0 rounded-full bg-primary/20 ring-1 ring-white/10 flex items-center justify-center text-sm font-semibold text-primary">
              G
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">Grant</p>
              <p className="text-xs text-white/50">RBU reviewer</p>
            </div>
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
    </aside>
  );
}

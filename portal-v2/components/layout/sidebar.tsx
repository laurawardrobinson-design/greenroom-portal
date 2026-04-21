"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import type { UserRole } from "@/types/domain";
import {
  LayoutDashboard,
  Film,
  Contact,
  Package,
  Boxes,
  Utensils,
  Shirt,
  Settings,
  LogOut,
  X,
  ClipboardList,
  Compass,
  List,
  FileText,
  Building2,
  DollarSign,
  Clapperboard,
  Palette,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatRoleLabel } from "@/lib/auth/roles";
import { GatorEasterEgg } from "./gator-easter-egg";
import { NotificationBell } from "./notification-bell";
import { UserAvatar } from "@/components/ui/user-avatar";

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
    roles: ["Admin", "Producer", "Post Producer", "Studio", "Vendor", "Art Director", "Creative Director", "Designer"],
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: Film,
    roles: ["Admin", "Producer", "Post Producer", "Studio", "Vendor", "Art Director", "Creative Director"],
  },
  {
    label: "Estimates & Invoices",
    href: "/vendor-workflow",
    icon: FileText,
    roles: ["Vendor"],
  },
  {
    label: "Pre Production",
    href: "/pre-production",
    icon: ClipboardList,
    roles: ["Admin", "Producer", "Post Producer"],
  },
  {
    label: "Budget",
    href: "/budget",
    icon: DollarSign,
    roles: ["Admin"],
  },
  {
    label: "Estimates & Invoices",
    href: "/estimates-invoices",
    icon: FileText,
    roles: ["Admin", "Producer", "Post Producer"],
  },
  {
    label: "Shot List",
    href: "/pre-production",
    icon: List,
    roles: ["Art Director"],
  },
  {
    label: "Studio Management",
    href: "/studio",
    icon: Building2,
    roles: ["Admin", "Producer", "Post Producer", "Studio"],
  },
  {
    label: "Post Production",
    href: "/post-workflow",
    icon: Clapperboard,
    roles: ["Admin", "Producer", "Post Producer"],
  },
  {
    label: "Asset Studio",
    href: "/asset-studio",
    icon: Palette,
    roles: ["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"],
  },
  {
    label: "Gear",
    href: "/gear",
    icon: Package,
    roles: ["Admin", "Producer", "Post Producer", "Studio"],
  },
  {
    label: "Props",
    href: "/props",
    icon: Boxes,
    roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director"],
  },
  {
    label: "Products",
    href: "/products",
    icon: Utensils,
    roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director"],
  },
  {
    label: "Wardrobe",
    href: "/wardrobe",
    icon: Shirt,
    roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director"],
  },
  {
    label: "Contacts",
    href: "/contacts",
    icon: Contact,
    roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director", "Creative Director", "Designer"],
  },
  {
    label: "Goals",
    href: "/goals",
    icon: Compass,
    roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["Admin", "Producer", "Post Producer", "Studio", "Vendor", "Art Director", "Creative Director", "Designer"],
  },
];

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  userAvatar?: string;
  userProductIcon?: string;
  userFavoriteProduct?: string;
  vendorId?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  userRole,
  userName,
  userFavoriteProduct,
  vendorId,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const { data: vendorAssignments } = useSWR<any[]>(
    userRole === "Vendor" && vendorId ? `/api/campaign-vendors?vendorId=${vendorId}` : null,
    (url: string) => fetch(url).then((r) => r.json())
  );
  const hasAssignments = Array.isArray(vendorAssignments) && vendorAssignments.length > 0;

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(userRole)) return false;
    if (item.href === "/vendor-workflow" && userRole === "Vendor") return hasAssignments;
    return true;
  });

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
      <nav className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-1 px-4 py-6">
        {filteredNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/pre-production"
              ? pathname.includes("/pre-production")
              : !pathname.includes("/pre-production") && pathname.startsWith(item.href + "/"));
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
              <span className="whitespace-nowrap">{item.label}</span>
              {isActive && (
                <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
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
          <UserAvatar name={userName} favoriteProduct={userFavoriteProduct} size="sm" variant="dark" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-white/50">{formatRoleLabel(userRole)}</p>
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
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[245px] lg:flex-col">
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

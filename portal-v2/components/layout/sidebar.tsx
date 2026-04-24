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
  X,
  ClipboardList,
  FileText,
  Building2,
  DollarSign,
  Clapperboard,
  Palette,
  Sparkles,
  PackageSearch,
  CalendarDays,
} from "lucide-react";
import { GatorEasterEgg } from "./gator-easter-egg";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  /** Optional: hide unless predicate is true (e.g. vendor with assignments) */
  visibleIf?: (ctx: NavContext) => boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavContext {
  hasVendorAssignments: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Work",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["Admin", "Producer", "Post Producer", "Studio", "Vendor", "Art Director", "Creative Director", "Designer", "Brand Marketing Manager"],
      },
      {
        label: "Campaigns",
        href: "/campaigns",
        icon: Film,
        roles: ["Admin", "Producer", "Post Producer", "Studio", "Vendor", "Art Director", "Creative Director"],
      },
      {
        label: "Brand Marketing",
        href: "/brand-marketing",
        icon: Sparkles,
        roles: ["Admin", "Brand Marketing Manager"],
      },
      {
        label: "Review",
        href: "/brand-marketing/review",
        icon: ClipboardList,
        roles: ["Admin", "Brand Marketing Manager"],
      },
      {
        label: "Product Requests",
        href: "/product-requests",
        icon: PackageSearch,
        roles: ["Admin", "Producer", "Post Producer", "Brand Marketing Manager", "Studio"],
      },
      {
        label: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
        roles: ["Admin", "Producer", "Post Producer", "Studio"],
      },
    ],
  },
  {
    label: "Create",
    items: [
      {
        label: "Asset Studio",
        href: "/asset-studio",
        icon: Palette,
        roles: ["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"],
      },
      {
        label: "Post Production",
        href: "/post-workflow",
        icon: Clapperboard,
        roles: ["Admin", "Producer", "Post Producer"],
      },
    ],
  },
  {
    label: "Resources",
    items: [
      {
        label: "Products",
        href: "/products",
        icon: Utensils,
        roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director", "Brand Marketing Manager"],
      },
      {
        label: "Gear",
        href: "/gear",
        icon: Package,
        roles: ["Admin", "Producer", "Post Producer", "Studio"],
      },
      {
        label: "Wardrobe",
        href: "/wardrobe",
        icon: Shirt,
        roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director"],
      },
      {
        label: "Props",
        href: "/props",
        icon: Boxes,
        roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director"],
      },
      {
        label: "Studio",
        href: "/studio",
        icon: Building2,
        roles: ["Admin", "Producer", "Post Producer", "Studio"],
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Contacts",
        href: "/contacts",
        icon: Contact,
        roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director", "Creative Director", "Designer"],
      },
    ],
  },
  {
    label: "Finance",
    items: [
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
        label: "Estimates & Invoices",
        href: "/vendor-workflow",
        icon: FileText,
        roles: ["Vendor"],
        visibleIf: (ctx) => ctx.hasVendorAssignments,
      },
    ],
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
  vendorId,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  const { data: vendorAssignments } = useSWR<any[]>(
    userRole === "Vendor" && vendorId ? `/api/campaign-vendors?vendorId=${vendorId}` : null,
    (url: string) => fetch(url).then((r) => r.json())
  );
  const hasVendorAssignments = Array.isArray(vendorAssignments) && vendorAssignments.length > 0;

  const ctx: NavContext = { hasVendorAssignments };

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.roles.includes(userRole)) return false;
      if (item.visibleIf && !item.visibleIf(ctx)) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  const sidebarContent = (
    <div className="relative flex h-full flex-col bg-sidebar text-white">
      {/* Header */}
      <div className="flex h-20 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center">
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

      {/* Navigation — grouped */}
      <nav className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 py-4">
        {visibleGroups.map((group, gIdx) => (
          <div key={group.label} className={gIdx === 0 ? "" : "mt-4"}>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const allItems = visibleGroups.flatMap((g) => g.items);
                const matches =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const moreSpecificMatch = allItems.some(
                  (other) =>
                    other !== item &&
                    other.href.startsWith(item.href + "/") &&
                    (pathname === other.href || pathname.startsWith(other.href + "/"))
                );
                const isActive = matches && !moreSpecificMatch;
                const Icon = item.icon;

                return (
                  <Link
                    key={`${group.label}-${item.href}`}
                    href={item.href}
                    onClick={onMobileClose}
                    className={`
                      group flex items-center gap-3 rounded-md px-3 py-2 text-sm tracking-wide
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
            </div>
          </div>
        ))}
      </nav>

      {/* Easter egg */}
      <GatorEasterEgg />
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

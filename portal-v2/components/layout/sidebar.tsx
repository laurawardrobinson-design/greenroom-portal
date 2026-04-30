"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  FileText,
  Building2,
  DollarSign,
  Clapperboard,
  ClipboardList,
  Palette,
  Sparkles,
  PackageSearch,
  CalendarDays,
  ChevronUp,
  Compass,
  LogOut,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRoleLabel } from "@/lib/auth/roles";
import { UserAvatar } from "@/components/ui/user-avatar";
import { GatorEasterEgg } from "./gator-easter-egg";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  /** Optional: hide unless predicate is true (e.g. vendor with assignments) */
  visibleIf?: (ctx: NavContext) => boolean;
  /** Optional: also treat this item as active when any predicate matches the pathname */
  alsoActiveFor?: Array<(pathname: string) => boolean>;
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
        // Dashboard is the shared home for most roles. BMM is intentionally
        // excluded — their home is /brand-marketing, which /dashboard
        // redirects to anyway. Keeping it in the sidebar created a dead
        // click that landed right back where they already were.
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
        label: "Dashboard",
        href: "/brand-marketing",
        icon: LayoutDashboard,
        roles: ["Brand Marketing Manager"],
      },
      {
        label: "Campaigns",
        href: "/brand-marketing/campaigns",
        icon: Film,
        roles: ["Brand Marketing Manager"],
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
        roles: ["Admin", "Post Producer", "Studio"],
      },
    ],
  },
  {
    label: "Create",
    items: [
      {
        label: "Pre-Production",
        href: "/pre-production",
        icon: ClipboardList,
        roles: ["Admin", "Producer", "Post Producer"],
        alsoActiveFor: [(p) => /\/campaigns\/[^/]+\/pre-production/.test(p)],
      },
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
      // Product Review lives as a tab inside /products — no dedicated
      // sidebar entry. BMM and Admin reach it via the Review tab; RBU
      // reaches it via the Review tab on the dept page.
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
      {
        label: "Goals",
        href: "/goals",
        icon: Compass,
        roles: ["Admin", "Producer", "Post Producer", "Studio", "Art Director"],
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
        roles: ["Producer", "Post Producer"],
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

// Role-specific sidebar ordering. The NAV_GROUPS above group items for
// permission clarity, but Producer's daily usage doesn't follow that
// shape — pre-prod and creative pipeline cluster at the top, inventory
// falls to the middle, Goals sits at the bottom. Other roles fall back
// to the default flat group order.
const ROLE_ORDER: Partial<Record<UserRole, string[]>> = {
  Producer: [
    "/dashboard",
    "/campaigns",
    "/pre-production",
    "/product-requests",
    "/studio",
    "/estimates-invoices",
    "/asset-studio",
    "/post-workflow",
    "/products",
    "/gear",
    "/wardrobe",
    "/props",
    "/contacts",
    "/goals",
  ],
};

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

  const flatItems = (() => {
    const items = visibleGroups.flatMap((g) => g.items);
    const order = ROLE_ORDER[userRole];
    if (!order) return items;
    const rank = (href: string) => {
      const i = order.indexOf(href);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...items].sort((a, b) => rank(a.href) - rank(b.href));
  })();

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

      {/* Navigation — flat list. Groups are retained in config for
          permission organization, but collapsed to a single list in the
          UI (mirrors the RBU sidebar's flat style). */}
      <nav className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-0.5 px-4 py-4">
        {flatItems.map((item) => {
          const alsoMatches = item.alsoActiveFor?.some((fn) => fn(pathname)) ?? false;
          const matches =
            alsoMatches ||
            pathname === item.href ||
            pathname.startsWith(item.href + "/");
          const claimedByOther = flatItems.some(
            (other) => other !== item && (other.alsoActiveFor?.some((fn) => fn(pathname)) ?? false)
          );
          const moreSpecificMatch =
            claimedByOther && !alsoMatches
              ? true
              : flatItems.some(
                  (other) =>
                    other !== item &&
                    other.href.startsWith(item.href + "/") &&
                    (pathname === other.href || pathname.startsWith(other.href + "/"))
                );
          const isActive = matches && !moreSpecificMatch;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
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
      </nav>

      {/* Easter egg — kept directly under the nav so the hover zone stays
          at the bottom-of-nav spot people already know, not pushed below
          the user footer where the menu button intercepts hover. */}
      <GatorEasterEgg />

      {/* User identity + account menu */}
      <SidebarUserFooter
        userName={userName}
        userRole={userRole}
        userFavoriteProduct={userFavoriteProduct}
      />
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

// Sidebar identity + account menu footer. Owns the sign-out action and
// a link to Settings. Goals lives in the main nav.
function SidebarUserFooter({
  userName,
  userRole,
  userFavoriteProduct,
}: {
  userName: string;
  userRole: UserRole;
  userFavoriteProduct?: string;
}) {
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

  return (
    <div ref={ref} className="relative border-t border-white/10 p-3">
      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%-0.25rem)] left-3 right-3 z-10 overflow-hidden rounded-lg border border-white/10 bg-sidebar-active shadow-lg"
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white transition-colors hover:bg-white/5"
          >
            <Settings className="h-4 w-4 shrink-0 text-white/50" />
            <span>Settings</span>
          </Link>

          <div className="border-t border-white/10">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/5"
            >
              <LogOut className="h-4 w-4 shrink-0 text-white/50" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
      >
        <UserAvatar name={userName} favoriteProduct={userFavoriteProduct} size="md" variant="dark" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="truncate text-[11px] text-white/50">{formatRoleLabel(userRole)}</p>
        </div>
        <ChevronUp
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}

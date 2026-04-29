"use client";
// v2 — tabbed Products page (Directory · Review · Flags). Three URLs render
// this same component; activeTab is derived from the pathname so the URL is
// always canonical.
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { Product, ProductDepartment } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PRODUCT_DEPARTMENTS } from "@/lib/constants/products";
import { ProductDrawer, DEPT_COLORS } from "@/components/products/product-drawer";
import { ProductImage } from "@/components/products/product-image";
import { PageHeader } from "@/components/ui/page-header";
import { PageTabs } from "@/components/ui/page-tabs";
import { ReviewTab } from "@/components/products/review-tab";
import { FlagsTab } from "@/components/products/flags-tab";
import {
  Flag,
  Plus,
  Search,
  ShoppingBasket,
  LayoutGrid,
  List,
  Cookie,
  Sandwich,
  Apple,
  Beef,
  Package,
  type LucideIcon,
} from "lucide-react";

type Tab = "directory" | "review" | "flags";

const DEPT_ICONS: Record<(typeof PRODUCT_DEPARTMENTS)[number], LucideIcon> = {
  Deli: Sandwich,
  Bakery: Cookie,
  "Meat-Seafood": Beef,
  Produce: Apple,
  Grocery: ShoppingBasket,
  Other: Package,
};

const DEPT_LABELS: Record<(typeof PRODUCT_DEPARTMENTS)[number], string> = {
  Deli: "Deli",
  Bakery: "Bakery",
  "Meat-Seafood": "Meat",
  Produce: "Produce",
  Grocery: "Grocery",
  Other: "Other",
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

const NEW_PRODUCT = "NEW" as const;

// Tabs work under any base path that ends with `/products` — both the BMM
// portal route (`/products`) and the RBU department route
// (`/pr/dept/[token]/products`). We split on `/products/` so the suffix
// determines the tab regardless of prefix.
function splitProductsPath(pathname: string): { base: string; suffix: string } | null {
  const idx = pathname.lastIndexOf("/products");
  if (idx === -1) return null;
  const base = pathname.slice(0, idx + "/products".length);
  const suffix = pathname.slice(base.length);
  return { base, suffix };
}

function tabFromPathname(pathname: string): Tab | null {
  const split = splitProductsPath(pathname);
  if (!split) return null;
  if (split.suffix === "" || split.suffix === "/") return null;
  if (split.suffix.startsWith("/review")) return "review";
  if (split.suffix.startsWith("/flags")) return "flags";
  return null;
}

function urlForTab(pathname: string, tab: Tab): string {
  const split = splitProductsPath(pathname);
  const base = split?.base ?? "/products";
  if (tab === "review") return `${base}/review`;
  if (tab === "flags") return `${base}/flags`;
  return base;
}

// RBU users access the same Products view via /pr/dept/[token]/products.
// They have no auth session, so we extract the token here and route fetches
// through the token-gated `/api/rbu/[token]/...` endpoints instead.
function rbuTokenFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/pr\/dept\/([^/]+)/);
  return m ? m[1] : null;
}

export function ProductsPage() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  // BMM and RBU both land on Review (the cross-product list is the primary
  // workflow tab for both). Other portal roles default to Directory.
  const rbuToken = rbuTokenFromPathname(pathname);
  const fromPath = tabFromPathname(pathname);
  const searchParams = useSearchParams();
  // Allow `?tab=directory` (etc.) to override the default landing tab —
  // used by the RBU dashboard's "Catalog → View products" tile, which
  // should jump straight to Directory even though RBU normally defaults
  // to Review.
  const tabParam = searchParams?.get("tab") as Tab | null;
  const tabParamValid: Tab | null =
    tabParam === "directory" || tabParam === "review" || tabParam === "flags"
      ? tabParam
      : null;
  const reviewDefault = !!rbuToken || user?.role === "Brand Marketing Manager";
  const defaultTab: Tab =
    fromPath ?? tabParamValid ?? (reviewDefault ? "review" : "directory");
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  useEffect(() => {
    const t = tabFromPathname(pathname);
    if (t) {
      setActiveTab(t);
    } else if (tabParamValid) {
      setActiveTab(tabParamValid);
    } else {
      // Bare `/products` means Directory. The BMM/RBU "default to Review"
      // rule only applies on initial mount (handled in useState init) — not
      // on every pathname change, otherwise clicking Directory snaps back
      // to Review for those users.
      setActiveTab("directory");
    }
  }, [pathname, tabParamValid]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    router.push(urlForTab(pathname, tab), { scroll: false });
  }

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<ProductDepartment | "">("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [drawerProduct, setDrawerProduct] = useState<Product | typeof NEW_PRODUCT | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (deptFilter) params.set("department", deptFilter);
  const qs = params.toString();

  // BMM/auth flow: /api/products returns Product[] directly.
  // RBU/token flow: /api/rbu/[token]/products returns { department, products }.
  const directoryUrl =
    activeTab === "directory"
      ? rbuToken
        ? `/api/rbu/${rbuToken}/products`
        : `/api/products${qs ? `?${qs}` : ""}`
      : null;
  const { data: rawProducts, isLoading, mutate } = useSWR<
    Product[] | { products: Product[] }
  >(directoryUrl, fetcher);
  const directoryProducts: Product[] = Array.isArray(rawProducts)
    ? rawProducts
    : rawProducts && Array.isArray(rawProducts.products)
      ? rawProducts.products
      : [];
  // Search + dept filter are server-side for the auth API; client-side for RBU
  // (since the RBU endpoint scopes by department from the token and ignores
  // query params).
  const allProducts: Product[] = rbuToken
    ? directoryProducts.filter((p) => {
        const matchesSearch = !search
          ? true
          : p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.itemCode ?? "").toLowerCase().includes(search.toLowerCase());
        const matchesDept = !deptFilter || p.department === deptFilter;
        return matchesSearch && matchesDept;
      })
    : directoryProducts;

  const { data: flagCounts } = useSWR<Record<string, number>>(
    rbuToken
      ? `/api/rbu/${rbuToken}/product-flags/counts`
      : "/api/product-flags/counts",
    fetcher,
    { refreshInterval: 30000 }
  );
  const openFlagTotal = flagCounts
    ? Object.values(flagCounts).reduce((a, b) => a + b, 0)
    : 0;
  const products = flaggedOnly
    ? allProducts.filter((p) => (flagCounts?.[p.id] ?? 0) > 0)
    : allProducts;

  // BMM can create + edit products so they can spin up "coming-soon" /
  // "planning" entries for things the team wants to shoot — and attach
  // reference images to them before RBU starts sampling.
  // RBU users (token-only, no auth session) get a read-only directory and
  // review view — they raise flags from the standalone RBU surfaces.
  const canEdit =
    !rbuToken &&
    (user?.role === "Admin" ||
      user?.role === "Producer" ||
      user?.role === "Post Producer" ||
      user?.role === "Art Director" ||
      user?.role === "Studio" ||
      user?.role === "Brand Marketing Manager");
  const canSeeFlags =
    !!rbuToken ||
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Post Producer" ||
    user?.role === "Brand Marketing Manager";

  const TABS: { key: Tab; label: string; count?: number }[] = (() => {
    const base: { key: Tab; label: string; count?: number }[] = [
      { key: "directory", label: "Directory" },
      { key: "review", label: "Review" },
    ];
    if (canSeeFlags) {
      base.push({ key: "flags", label: "Flags", count: openFlagTotal });
    }
    return base;
  })();

  return (
    <div className="space-y-4">
      <div className="space-y-0">
        <PageHeader title="Products" />
        <PageTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(key) => switchTab(key as Tab)}
        />
      </div>

      {activeTab === "directory" && (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative min-w-[180px] max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
                />
              </div>
              <div className="ml-auto flex items-center gap-1">
                {canEdit && (
                  <button
                    onClick={() => setDrawerProduct(NEW_PRODUCT)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                    title="Add product"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "grid" ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {PRODUCT_DEPARTMENTS.map((dept) => {
                const Icon = DEPT_ICONS[dept];
                const active = deptFilter === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDeptFilter(active ? "" : dept)}
                    title={dept}
                    aria-label={dept}
                    className={`shrink-0 h-28 w-28 flex flex-col items-center justify-center gap-2 rounded-2xl border transition-colors ${
                      active
                        ? "border-primary text-primary bg-primary/5"
                        : "border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
                    }`}
                  >
                    <Icon className="h-7 w-7 text-primary" />
                    <span className="text-sm font-medium leading-none">{DEPT_LABELS[dept]}</span>
                  </button>
                );
              })}
              {canSeeFlags && (
                <button
                  type="button"
                  onClick={() => setFlaggedOnly((v) => !v)}
                  title="Flagged"
                  aria-label="Flagged"
                  aria-pressed={flaggedOnly}
                  className={`relative shrink-0 h-28 w-28 flex flex-col items-center justify-center gap-2 rounded-2xl border transition-colors ${
                    flaggedOnly
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
                  }`}
                >
                  {openFlagTotal > 0 && (
                    <span className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-warning text-white text-[10px] font-semibold min-w-[18px] h-[18px] px-1">
                      {openFlagTotal}
                    </span>
                  )}
                  <Flag className="h-7 w-7 text-primary" />
                  <span className="text-sm font-medium leading-none">Flagged</span>
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={<ShoppingBasket className="h-5 w-5" />}
              title={search || deptFilter ? "No products match your filters" : "No products yet"}
              description={
                search || deptFilter
                  ? "Try adjusting your search or department filter."
                  : "Start building your product directory by adding products used in shoots."
              }
              action={
                canEdit && !search && !deptFilter ? (
                  <Button size="sm" onClick={() => setDrawerProduct(NEW_PRODUCT)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Product
                  </Button>
                ) : undefined
              }
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => {
                const flagCount = flagCounts?.[product.id] ?? 0;
                return (
                <button
                  key={product.id}
                  onClick={() => setDrawerProduct(product)}
                  className={`relative flex h-full flex-col rounded-xl border bg-surface p-4 text-left transition-colors ${
                    flagCount > 0 && !flaggedOnly
                      ? "border-amber-300 hover:bg-amber-50/40"
                      : "border-border hover:bg-surface-secondary"
                  }`}
                >
                  {flagCount > 0 && !flaggedOnly && (
                    <span
                      className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber-50 text-warning border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium"
                      title={`${flagCount} open flag${flagCount === 1 ? "" : "s"}`}
                    >
                      <Flag className="h-2.5 w-2.5" />
                      {flagCount}
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-14 w-14 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {product.name}
                      </p>
                      {product.itemCode && (
                        <p className="text-[10px] text-text-tertiary leading-tight">
                          {product.itemCode}
                        </p>
                      )}
                      <Badge
                        variant="custom"
                        className={`mt-1 ${DEPT_COLORS[product.department] || DEPT_COLORS.Other}`}
                      >
                        {product.department}
                      </Badge>
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_160px_1fr] gap-0 bg-surface-secondary border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                <div>Name</div>
                <div>Department</div>
                <div>Restrictions</div>
              </div>
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setDrawerProduct(product)}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_160px_1fr] gap-0 px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface-secondary cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {product.imageUrl ? (
                      <ProductImage
                        src={product.imageUrl}
                        alt=""
                        className="h-7 w-7 rounded object-cover shrink-0"
                        fallbackClassName="h-7 w-7 rounded bg-surface-tertiary shrink-0"
                        iconClassName="h-3 w-3 text-text-tertiary m-auto mt-2"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate block">{product.name}</span>
                      {product.itemCode && (
                        <span className="text-[10px] text-text-tertiary">{product.itemCode}</span>
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center">
                    <Badge variant="custom" className={`text-[10px] ${DEPT_COLORS[product.department] || DEPT_COLORS.Other}`}>
                      {product.department}
                    </Badge>
                  </div>
                  <div className="hidden sm:flex items-center">
                    <span className="text-xs text-warning font-medium truncate">{product.restrictions || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "review" && (
        <ReviewTab
          canEdit={canEdit}
          hideTeamNotes={!!rbuToken || user?.role === "Brand Marketing Manager"}
          rbuToken={rbuToken}
        />
      )}

      {activeTab === "flags" && canSeeFlags && <FlagsTab rbuToken={rbuToken} />}

      {/* Unified Product Drawer */}
      {drawerProduct !== null && (
        <ProductDrawer
          product={drawerProduct === NEW_PRODUCT ? null : drawerProduct}
          onClose={() => setDrawerProduct(null)}
          onSaved={(updated) => {
            mutate();
            if (updated) setDrawerProduct(updated);
            else setDrawerProduct(null);
          }}
          onDeleted={() => { setDrawerProduct(null); mutate(); }}
          canEdit={canEdit}
          hideTeamNotes={!!rbuToken || user?.role === "Brand Marketing Manager"}
          rbuToken={rbuToken}
        />
      )}
    </div>
  );
}

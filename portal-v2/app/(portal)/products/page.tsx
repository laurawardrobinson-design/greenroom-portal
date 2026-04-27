"use client";
// v2
import { useState } from "react";
import useSWR from "swr";
import type { Product, ProductDepartment } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/components/ui/toast";
import { PRODUCT_DEPARTMENTS } from "@/lib/constants/products";
import { ProductDrawer, DEPT_COLORS } from "@/components/products/product-drawer";
import { PageHeader } from "@/components/ui/page-header";
import {
  Flag,
  Plus,
  Search,
  ShoppingBasket,
  ClipboardList,
  LayoutGrid,
  List,
} from "lucide-react";
import Link from "next/link";
import { PageTabs } from "@/components/ui/page-tabs";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

type Tab = "items" | "product-requests";
const NEW_PRODUCT = "NEW" as const;

export default function ProductDirectoryPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<ProductDepartment | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [drawerProduct, setDrawerProduct] = useState<Product | typeof NEW_PRODUCT | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (deptFilter) params.set("department", deptFilter);
  const qs = params.toString();

  const { data: rawProducts, isLoading, mutate } = useSWR<Product[]>(
    `/api/products${qs ? `?${qs}` : ""}`,
    fetcher
  );
  const products: Product[] = Array.isArray(rawProducts) ? rawProducts : [];

  const { data: flagCounts } = useSWR<Record<string, number>>(
    "/api/product-flags/counts",
    fetcher,
    { refreshInterval: 30000 }
  );
  const openFlagTotal = flagCounts
    ? Object.values(flagCounts).reduce((a, b) => a + b, 0)
    : 0;

  // BMM can create + edit products so they can spin up "coming-soon" /
  // "planning" entries for things the team wants to shoot — and attach
  // reference images to them before RBU starts sampling.
  const canEdit =
    user?.role === "Admin" ||
    user?.role === "Producer" || user?.role === "Post Producer" ||
    user?.role === "Art Director" ||
    user?.role === "Studio" ||
    user?.role === "Brand Marketing Manager";
  const canSeeFlags =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Post Producer" ||
    user?.role === "Brand Marketing Manager";

  return (
    <div className="space-y-4">
      <div className="space-y-0">
        <PageHeader title="Products" />

        <PageTabs
          tabs={[
            { key: "items", label: "Items" },
            { key: "product-requests", label: "Product Requests" },
          ]}
          activeTab={tab}
          onTabChange={(key) => setTab(key as Tab)}
        />
      </div>

      {tab === "items" && (
        <>
          {/* Search + filter bar */}
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
                {canSeeFlags && (
                  <Link
                    href="/products/flags"
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-xs font-medium transition-colors ${
                      openFlagTotal > 0
                        ? "border-amber-300 bg-amber-50 text-warning hover:bg-amber-100"
                        : "border-border text-text-secondary hover:bg-surface-secondary"
                    }`}
                    title="RBU flags"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Flags
                    {openFlagTotal > 0 && (
                      <span>({openFlagTotal})</span>
                    )}
                  </Link>
                )}
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
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setDeptFilter("")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  deptFilter === ""
                    ? "border border-primary text-primary bg-primary/5"
                    : "border border-transparent bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}
              >
                All
              </button>
              {PRODUCT_DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setDeptFilter(deptFilter === dept ? "" : dept)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    deptFilter === dept
                      ? "border border-primary text-primary bg-primary/5"
                      : "border border-transparent bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
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
                    flagCount > 0
                      ? "border-amber-300 hover:bg-amber-50/40"
                      : "border-border hover:bg-surface-secondary"
                  }`}
                >
                  {flagCount > 0 && (
                    <span
                      className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber-50 text-warning border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium"
                      title={`${flagCount} open flag${flagCount === 1 ? "" : "s"}`}
                    >
                      <Flag className="h-2.5 w-2.5" />
                      {flagCount}
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-14 w-14 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
                        <ShoppingBasket className="h-6 w-6 text-text-tertiary" />
                      </div>
                    )}
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
                      <img src={product.imageUrl} alt="" className="h-7 w-7 rounded object-cover shrink-0" />
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

      {tab === "product-requests" && (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No product requests yet"
          description="Product requests from shoots will appear here."
        />
      )}

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
        />
      )}
    </div>
  );
}

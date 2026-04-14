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
import { PRODUCT_DEPARTMENTS } from "@/lib/validation/products.schema";
import { ProductDrawer, DEPT_COLORS } from "@/components/products/product-drawer";
import {
  Plus,
  Search,
  ShoppingBasket,
  ClipboardList,
  LayoutGrid,
  List,
} from "lucide-react";

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

  const canEdit =
    user?.role === "Admin" ||
    user?.role === "Producer" || user?.role === "Post Producer" ||
    user?.role === "Art Director" ||
    user?.role === "Studio";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Food</h2>
          <p className="text-sm text-text-secondary">
            {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["items", "product-requests"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            {t === "items" ? "Items" : "Product Requests"}
          </button>
        ))}
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
                  className="h-7 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
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
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setDeptFilter("")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  deptFilter === ""
                    ? "bg-text-primary text-white"
                    : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
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
                      ? "bg-text-primary text-white"
                      : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
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
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setDrawerProduct(product)}
                  className="flex flex-col rounded-xl border border-border bg-surface p-4 text-left hover:bg-surface-secondary transition-colors"
                >
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
                  {product.shootingNotes && (
                    <p className="mt-2 text-xs text-text-secondary line-clamp-2">
                      {product.shootingNotes}
                    </p>
                  )}
                  {product.restrictions && (
                    <p className="mt-1 text-xs text-orange-700 font-medium">
                      {product.restrictions}
                    </p>
                  )}
                </button>
              ))}
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
                    <span className="text-xs text-orange-700 font-medium truncate">{product.restrictions || "—"}</span>
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



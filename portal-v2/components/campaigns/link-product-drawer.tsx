"use client";

import { useState } from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ProductDrawer } from "@/components/products/product-drawer";
import { useToast } from "@/components/ui/toast";
import { ShoppingBasket, Plus } from "lucide-react";
import type { Product } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LinkProductDrawer({
  open,
  onClose,
  campaignId,
  onLinked,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  onLinked: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: products = [] } = useSWR(
    open ? `/api/products${search ? `?search=${encodeURIComponent(search)}` : ""}` : null,
    fetcher
  );
  const [linking, setLinking] = useState<string | null>(null);

  async function linkProduct(productId: string) {
    setLinking(productId);
    try {
      const res = await fetch("/api/campaign-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, productId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Product linked");
      onLinked();
    } catch {
      toast("error", "Failed to link product");
    } finally {
      setLinking(null);
    }
  }

  async function handleProductCreated(newProduct: Product | null) {
    setCreating(false);
    if (!newProduct) return;
    await linkProduct(newProduct.id);
  }

  const noResults = products.length === 0;

  return (
    <>
      <Modal open={open && !creating} onClose={onClose} title="Add Product" size="lg">
        <div className="flex flex-col gap-4 h-[336px] overflow-y-auto [scrollbar-gutter:stable]">
          <div className="flex w-full items-center gap-2 sticky top-0 bg-white z-10">
            <div className="flex-1">
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 h-10 text-xs font-medium text-white hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>
          <div className="space-y-2">
            {products.map((p: { id: string; name: string; department: string }) => (
              <button
                key={p.id}
                onClick={() => linkProduct(p.id)}
                disabled={linking === p.id}
                className="flex w-full items-center gap-3 rounded-lg bg-surface-secondary p-3 text-left hover:bg-surface-tertiary transition-colors disabled:opacity-50"
              >
                <ShoppingBasket className="h-4 w-4 text-text-tertiary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{p.name}</p>
                  <p className="text-xs text-text-tertiary">{p.department}</p>
                </div>
                <Plus className="h-4 w-4 text-text-secondary" />
              </button>
            ))}
            {noResults && (
              <p className="text-sm text-text-tertiary text-center py-4">
                {search ? `No products matching "${search}"` : "No products in directory yet"}
              </p>
            )}
          </div>
        </div>
      </Modal>

      {creating && (
        <ProductDrawer
          product={null}
          initialName={search}
          canEdit={true}
          hideTeamNotes={true}
          onClose={() => setCreating(false)}
          onSaved={handleProductCreated}
          onDeleted={() => setCreating(false)}
        />
      )}
    </>
  );
}

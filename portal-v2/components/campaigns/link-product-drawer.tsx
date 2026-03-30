"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { ShoppingBasket, Plus } from "lucide-react";

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

  return (
    <Drawer open={open} onClose={onClose} title="Link Product">
      <div className="space-y-4">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {products.map((p: { id: string; name: string; department: string; shootingNotes: string }) => (
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
          {products.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-8">
              {search ? "No products found" : "No products in directory yet"}
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}

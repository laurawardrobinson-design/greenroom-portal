"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Search, Plus, Check, ShoppingBasket, ChevronDown } from "lucide-react";
import { PRODUCT_DEPARTMENTS } from "@/lib/constants/products";
import type { Product } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.json(); });

const SELECT_CLASS = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:outline-none appearance-none cursor-pointer";

interface Props {
  open: boolean;
  onClose: () => void;
  shotId: string;
  campaignId: string;
  linkedProductIds: Set<string>;
  onToggle: (campaignProductId: string) => void;
  onProductCreatedAndLinked: () => void;
}

export function ShotProductPicker({
  open,
  onClose,
  shotId,
  campaignId,
  linkedProductIds,
  onToggle,
  onProductCreatedAndLinked,
}: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch all products from the library
  const { data: allProducts = [] } = useSWR<Product[]>(
    open ? `/api/products${search ? `?search=${encodeURIComponent(search)}` : ""}` : null,
    fetcher
  );

  // Fetch campaign products to map product IDs to campaign_product IDs
  const { data: campaignProducts = [] } = useSWR<Array<{ id: string; productId: string; product?: Product }>>(
    open ? `/api/campaign-products?campaignId=${campaignId}` : null,
    fetcher
  );

  // Map: product.id → campaignProduct.id
  const cpByProductId = new Map(campaignProducts.map((cp) => [cp.productId, cp.id]));

  // Quick-add form state
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState<string>("Grocery");
  const [newItemCode, setNewItemCode] = useState("");
  const [creating, setCreating] = useState(false);

  function isLinked(productId: string) {
    const cpId = cpByProductId.get(productId);
    return cpId ? linkedProductIds.has(cpId) : false;
  }

  async function handleToggle(productId: string) {
    let cpId = cpByProductId.get(productId);

    if (cpId && linkedProductIds.has(cpId)) {
      // Unlink from shot
      onToggle(cpId);
      return;
    }

    // If not yet linked to campaign, link to campaign first
    if (!cpId) {
      try {
        const res = await fetch("/api/campaign-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, productId }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        cpId = data.id;
        // Refresh campaign products
        globalMutate(`/api/campaign-products?campaignId=${campaignId}`);
      } catch {
        toast("error", "Failed to add product to campaign");
        return;
      }
    }

    // Link to shot
    onToggle(cpId!);
  }

  async function handleCreateAndLink() {
    if (!newName.trim()) {
      toast("error", "Product name is required");
      return;
    }
    setCreating(true);
    try {
      // 1. Create product in library
      const prodRes = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          department: newDept,
          itemCode: newItemCode.trim() || null,
        }),
      });
      if (!prodRes.ok) throw new Error();
      const product = await prodRes.json();

      // 2. Link to campaign
      const cpRes = await fetch("/api/campaign-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, productId: product.id }),
      });
      if (!cpRes.ok) throw new Error();
      const cp = await cpRes.json();

      // 3. Link to shot
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignProductId: cp.id }),
      });

      // Reset form
      setNewName("");
      setNewItemCode("");
      setShowAddForm(false);
      toast("success", `${product.name} added and linked`);

      // Refresh data
      globalMutate(`/api/products${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      globalMutate(`/api/campaign-products?campaignId=${campaignId}`);
      onProductCreatedAndLinked();
    } catch {
      toast("error", "Failed to create product");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Products</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <Input
            placeholder="Search food library…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs py-1.5"
          />
        </div>

        {/* Product list */}
        <div className="max-h-[280px] overflow-y-auto space-y-1 -mx-1 px-1">
          {allProducts.map((p) => {
            const linked = isLinked(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleToggle(p.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  linked
                    ? "bg-primary/5 border border-primary/20"
                    : "hover:bg-surface-secondary border border-transparent"
                }`}
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  linked ? "border-primary bg-primary text-white" : "border-border"
                }`}>
                  {linked && <Check className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary truncate">{p.name}</span>
                    {p.itemCode && (
                      <span className="text-[10px] text-text-tertiary shrink-0">{p.itemCode}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-text-tertiary">{p.department}</span>
                </div>
              </button>
            );
          })}
          {allProducts.length === 0 && (
            <p className="text-xs text-text-tertiary text-center py-6">
              {search ? "No products found" : "No products in library yet"}
            </p>
          )}
        </div>

        {/* Add new product */}
        {showAddForm ? (
          <div className="rounded-lg border border-border bg-surface-secondary p-3 space-y-2">
            <p className="text-xs font-semibold text-text-primary">Add New Product to Library</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-text-secondary mb-0.5">Name</label>
                <Input placeholder="Product name" value={newName}
                  onChange={(e) => setNewName(e.target.value)} className="text-xs py-1" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-text-secondary mb-0.5">Item Code</label>
                <Input placeholder="Optional" value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)} className="text-xs py-1" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-secondary mb-0.5">Department</label>
              <select value={newDept} onChange={(e) => setNewDept(e.target.value)} className={SELECT_CLASS}>
                {PRODUCT_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleCreateAndLink} loading={creating}>
                Add & Link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-text-tertiary hover:border-primary hover:text-primary hover:bg-primary/3 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add new product to library
          </button>
        )}

        {/* Close */}
        <div className="flex justify-end pt-1">
          <Button size="sm" variant="ghost" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}

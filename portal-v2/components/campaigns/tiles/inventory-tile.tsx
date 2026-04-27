"use client";

import { useState, useCallback } from "react";
import { ShoppingBasket, Package, Wrench, Plus, X } from "lucide-react";
import type { CampaignProduct, CampaignGearLink, CampaignProductRole, Product } from "@/types/domain";
import { ProductDrawer } from "@/components/products/product-drawer";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";

interface Props {
  campaignProducts: CampaignProduct[];
  campaignGear: CampaignGearLink[];
  canEdit: boolean;
  onAddProduct: () => void;
  onAddProps: () => void;
  onAddGear: () => void;
  onMutate?: () => void;
  /** Lock to a single tab and hide the tab switcher */
  onlyTab?: Tab;
  hideTeamNotes?: boolean;
  /** Optional action rendered in the tile header (e.g. Add button) */
  headerAction?: React.ReactNode;
}

type Tab = "products" | "props" | "gear";

export function InventoryTile({ campaignProducts, campaignGear, canEdit, onAddProduct, onAddProps, onAddGear, onMutate, onlyTab, hideTeamNotes, headerAction }: Props) {
  const [tab, setTab] = useState<Tab>(onlyTab ?? "products");
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const canSetRole = user?.role === "Brand Marketing Manager" || user?.role === "Admin";

  const setRole = useCallback(async (campaignProductId: string, campaignId: string, role: CampaignProductRole | null) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/products/${campaignProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed");
      onMutate?.();
    } catch {
      toast("error", "Failed to update role");
    }
  }, [onMutate, toast]);

  async function removeProp(id: string) {
    try {
      const res = await fetch(`/api/campaign-gear?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      onMutate?.();
    } catch {
      toast("error", "Failed to remove prop");
    }
  }

  const props = campaignGear.filter((cg) => cg.gearItem?.section === "Props");
  const gear = campaignGear.filter((cg) => cg.gearItem?.section !== "Props");

  const tabs: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: "products", label: "Products", icon: ShoppingBasket, count: campaignProducts.length },
    { key: "props", label: "Props", icon: Package, count: props.length },
    { key: "gear", label: "Gear", icon: Wrench, count: gear.length },
  ];

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border shrink-0">
        <ShoppingBasket className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary flex-1">{onlyTab === "products" ? "Products" : "Inventory"}</span>
        {headerAction}
        {!onlyTab && (
          <div className="flex items-center gap-1">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  tab === key
                    ? "bg-primary text-white"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {tab === "products" && (
          <div className="mx-auto w-full max-w-2xl space-y-1.5">
            {campaignProducts.length === 0 ? (
              <button
                type="button"
                onClick={onAddProduct}
                className="w-full rounded-md border border-dashed border-border py-4 text-sm text-text-tertiary hover:border-primary/40 hover:text-primary transition-colors"
              >
                + Add a product
              </button>
            ) : (
              campaignProducts.map((cp) => (
                <div
                  key={cp.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-2.5 py-2"
                >
                  <button
                    type="button"
                    onClick={() => cp.product && setViewProduct(cp.product)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium text-text-primary truncate">{cp.product?.name || "Unknown product"}</p>
                    {cp.product?.department && (
                      <p className="text-[10px] text-text-tertiary">{cp.product.department === "Meat-Seafood" ? "Meat & Seafood" : cp.product.department}</p>
                    )}
                  </button>
                  {/* Role badge — always visible, clickable only for BMM/Admin */}
                  <div className="shrink-0 flex items-center gap-1">
                    {cp.role && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        cp.role === "hero"
                          ? "bg-amber-50 text-warning"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {cp.role === "hero" ? "Hero" : "Secondary"}
                      </span>
                    )}
                    {canSetRole && (
                      <div className="flex items-center gap-0.5 ml-1">
                        <button
                          type="button"
                          title="Hero"
                          onClick={() => setRole(cp.id, cp.campaignId, cp.role === "hero" ? null : "hero")}
                          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                            cp.role === "hero"
                              ? "bg-amber-500 text-white"
                              : "bg-surface text-text-tertiary border border-border hover:bg-amber-50 hover:text-warning"
                          }`}
                        >
                          H
                        </button>
                        <button
                          type="button"
                          title="Secondary"
                          onClick={() => setRole(cp.id, cp.campaignId, cp.role === "secondary" ? null : "secondary")}
                          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                            cp.role === "secondary"
                              ? "bg-slate-500 text-white"
                              : "bg-surface text-text-tertiary border border-border hover:bg-slate-100 hover:text-slate-600"
                          }`}
                        >
                          S
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {canEdit && (
              <button
                type="button"
                onClick={onAddProduct}
                className="mt-1 inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Product
              </button>
            )}
          </div>
        )}

        {tab === "props" && (
          <div className="space-y-1.5">
            {props.length === 0 ? (
              <p className="text-sm text-text-tertiary py-1">No props added.</p>
            ) : (
              props.map((cg) => (
                <div key={cg.id} className="flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{cg.gearItem?.name || "Unknown"}</p>
                    {cg.gearItem?.category && (
                      <p className="text-[10px] text-text-tertiary">{cg.gearItem.category}</p>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeProp(cg.id)}
                      className="shrink-0 rounded p-0.5 text-text-tertiary/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove prop"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
            {canEdit && (
              <button
                type="button"
                onClick={onAddProps}
                className="mt-1 inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Props
              </button>
            )}
          </div>
        )}

        {tab === "gear" && (
          <div className="space-y-1.5">
            {gear.length === 0 ? (
              <p className="text-sm text-text-tertiary py-1">No gear added.</p>
            ) : (
              gear.map((cg) => (
                <div key={cg.id} className="flex items-start gap-2 rounded-md border border-border bg-surface-secondary/40 px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{cg.gearItem?.name || "Unknown gear"}</p>
                    {(cg.gearItem?.brand || cg.gearItem?.model) && (
                      <p className="text-[10px] text-text-tertiary">{[cg.gearItem.brand, cg.gearItem.model].filter(Boolean).join(" ")}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            {canEdit && (
              <button
                type="button"
                onClick={onAddGear}
                className="mt-1 inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Gear
              </button>
            )}
          </div>
        )}
      </div>

      {viewProduct && (
        <ProductDrawer
          product={viewProduct}
          canEdit={false}
          hideTeamNotes={hideTeamNotes}
          onClose={() => setViewProduct(null)}
          onSaved={() => setViewProduct(null)}
          onDeleted={() => setViewProduct(null)}
        />
      )}
    </div>
  );
}

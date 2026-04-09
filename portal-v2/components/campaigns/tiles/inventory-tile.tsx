"use client";

import { useState } from "react";
import { ShoppingBasket, Package, Wrench, Plus } from "lucide-react";
import type { CampaignProduct, CampaignGearLink } from "@/types/domain";

interface Props {
  campaignProducts: CampaignProduct[];
  campaignGear: CampaignGearLink[];
  canEdit: boolean;
  onAddProduct: () => void;
  onAddProps: () => void;
  onAddGear: () => void;
}

type Tab = "products" | "props" | "gear";

export function InventoryTile({ campaignProducts, campaignGear, canEdit, onAddProduct, onAddProps, onAddGear }: Props) {
  const [tab, setTab] = useState<Tab>("products");

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
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary flex-1">Inventory</span>
        <div className="flex items-center gap-1">
          {tabs.map(({ key, label, count }) => (
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
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {tab === "products" && (
          <div className="space-y-1.5">
            {campaignProducts.length === 0 ? (
              <p className="text-sm text-text-tertiary py-1">No products added.</p>
            ) : (
              campaignProducts.map((cp) => (
                <div key={cp.id} className="flex items-start gap-2 rounded-md border border-border bg-surface-secondary/40 px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{cp.product?.name || "Unknown product"}</p>
                    {cp.product?.department && (
                      <p className="text-[10px] text-text-tertiary">{cp.product.department}</p>
                    )}
                    {cp.notes && (
                      <p className="text-[10px] text-text-secondary mt-0.5">{cp.notes}</p>
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
                <div key={cg.id} className="flex items-start gap-2 rounded-md border border-border bg-surface-secondary/40 px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{cg.gearItem?.name || "Unknown"}</p>
                    {cg.gearItem?.category && (
                      <p className="text-[10px] text-text-tertiary">{cg.gearItem.category}</p>
                    )}
                  </div>
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
    </div>
  );
}

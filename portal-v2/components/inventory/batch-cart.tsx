"use client";

import { useState } from "react";
import { X, ArrowUpFromLine, ArrowDownToLine, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GearItem } from "@/types/domain";

const STATUS_BADGE: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700",
  "Checked Out": "bg-amber-50 text-amber-700",
  Reserved: "bg-blue-50 text-blue-700",
};

interface BatchCartProps {
  items: GearItem[];
  onRemove: (id: string) => void;
  onCheckOutAll: () => void;
  onCheckInAll: () => void;
  onClear: () => void;
  processing: boolean;
}

export function BatchCart({
  items,
  onRemove,
  onCheckOutAll,
  onCheckInAll,
  onClear,
  processing,
}: BatchCartProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const availableCount = items.filter((i) => i.status === "Available" || i.status === "Reserved").length;
  const checkedOutCount = items.filter((i) => i.status === "Checked Out").length;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-secondary/50 p-6 text-center">
        <ShoppingCart className="h-5 w-5 text-text-tertiary" />
        <p className="text-sm text-text-secondary">
          Scan items to add them to the cart
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Cart header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm font-medium text-text-primary">
            {items.length} item{items.length !== 1 ? "s" : ""} scanned
          </span>
        </div>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Clear all?</span>
            <button
              onClick={() => { onClear(); setConfirmClear(false); }}
              className="text-xs text-red-600 font-medium hover:text-red-700 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Item list */}
      <div className="divide-y divide-border-light max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {item.name}
              </p>
              <p className="text-xs text-text-tertiary">
                {item.brand} {item.model}
              </p>
            </div>
            <Badge variant="custom" className={STATUS_BADGE[item.status] || "bg-slate-100 text-slate-600"}>
              {item.status}
            </Badge>
            <button
              onClick={() => onRemove(item.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-border p-3">
        {availableCount > 0 && (
          <Button
            className="flex-1"
            onClick={onCheckOutAll}
            loading={processing}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Check Out {availableCount}
          </Button>
        )}
        {checkedOutCount > 0 && (
          <Button
            className="flex-1"
            variant={availableCount > 0 ? "secondary" : "primary"}
            onClick={onCheckInAll}
            loading={processing}
          >
            <ArrowDownToLine className="h-4 w-4" />
            Check In {checkedOutCount}
          </Button>
        )}
      </div>
    </div>
  );
}

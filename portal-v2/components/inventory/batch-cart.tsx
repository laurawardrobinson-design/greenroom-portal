"use client";

import { useState } from "react";
import { X, ArrowUpFromLine, ArrowDownToLine, ShoppingCart, AlertTriangle } from "lucide-react";
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
  conflictIds?: Set<string>;
  cartMode?: "checkout" | "checkin" | null;
  onRemove: (id: string) => void;
  onCheckOutAll: () => void;
  onCheckInAll: () => void;
  onClear: () => void;
  processing: boolean;
}

export function BatchCart({
  items,
  conflictIds = new Set(),
  cartMode,
  onRemove,
  onCheckOutAll,
  onCheckInAll,
  onClear,
  processing,
}: BatchCartProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const conflictCount = items.filter((i) => conflictIds.has(i.id)).length;
  // In checkout mode show checkout button; in checkin mode show checkin button
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
        {items.map((item) => {
          const isConflict = conflictIds.has(item.id);
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${isConflict ? "bg-amber-50/50" : ""}`}
            >
              {isConflict && (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {item.name}
                </p>
                {isConflict ? (
                  <p className="text-xs text-amber-600">Status conflict — needs confirmation</p>
                ) : (
                  <p className="text-xs text-text-tertiary">{item.brand} {item.model}</p>
                )}
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
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-border p-3">
        {(cartMode === "checkout" || (!cartMode && availableCount > 0)) && (
          <Button
            className="flex-1"
            onClick={onCheckOutAll}
            loading={processing}
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Check Out {availableCount + (cartMode === "checkout" ? conflictCount : 0)}
            {conflictCount > 0 && cartMode === "checkout" && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400/30 text-[10px] font-bold text-amber-700">
                !
              </span>
            )}
          </Button>
        )}
        {(cartMode === "checkin" || (!cartMode && checkedOutCount > 0)) && (
          <Button
            className="flex-1"
            variant={!cartMode && availableCount > 0 ? "secondary" : "primary"}
            onClick={onCheckInAll}
            loading={processing}
          >
            <ArrowDownToLine className="h-4 w-4" />
            Check In {checkedOutCount + (cartMode === "checkin" ? conflictCount : 0)}
            {conflictCount > 0 && cartMode === "checkin" && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400/30 text-[10px] font-bold text-amber-700">
                !
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

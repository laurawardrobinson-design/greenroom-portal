"use client";

import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GearItem } from "@/types/domain";
import { Camera, QrCode, Printer, X, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

const STATUS_BADGE: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700",
  Reserved: "bg-blue-50 text-blue-700",
  "Checked Out": "bg-amber-50 text-amber-700",
  "Under Maintenance": "bg-purple-50 text-purple-700",
  "In Repair": "bg-red-50 text-red-600",
  Retired: "bg-slate-100 text-slate-500",
};

const CONDITION_BADGE: Record<string, string> = {
  Excellent: "bg-emerald-50 text-emerald-700",
  Good: "bg-blue-50 text-blue-700",
  Fair: "bg-amber-50 text-amber-700",
  Poor: "bg-orange-50 text-orange-700",
  Damaged: "bg-red-50 text-red-600",
};

export function GearDetailModal({
  item,
  open,
  onClose,
  onEdit,
}: {
  item: GearItem | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (item: GearItem) => void;
}) {
  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title={item.name} size="sm">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="space-y-5">
        {/* Item image */}
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-40 w-full rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-28 w-full items-center justify-center rounded-xl bg-surface-tertiary">
            <Camera className="h-8 w-8 text-text-tertiary" />
          </div>
        )}

        {/* Status + condition row */}
        <div className="flex items-center gap-2">
          <Badge
            variant="custom"
            className={STATUS_BADGE[item.status] || ""}
          >
            {item.status}
          </Badge>
          <Badge
            variant="custom"
            className={CONDITION_BADGE[item.condition] || ""}
          >
            {item.condition}
          </Badge>
          <Badge variant="default">{item.category}</Badge>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Brand</p>
            <p className="text-text-primary font-medium">
              {item.brand || "—"}
            </p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Model</p>
            <p className="text-text-primary font-medium">
              {item.model || "—"}
            </p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Serial Number</p>
            <p className="text-text-primary font-medium font-mono text-xs">
              {item.serialNumber || "—"}
            </p>
          </div>
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">QR Code</p>
            <p className="text-text-primary font-medium font-mono text-xs flex items-center gap-1">
              <QrCode className="h-3 w-3" />
              {item.qrCode}
            </p>
          </div>
          {item.purchasePrice > 0 && (
            <div>
              <p className="text-text-tertiary text-xs mb-0.5">
                Purchase Price
              </p>
              <p className="text-text-primary font-medium">
                {formatCurrency(item.purchasePrice)}
              </p>
            </div>
          )}
        </div>

        {item.notes && (
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Notes</p>
            <p className="text-sm text-text-secondary">{item.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border-light">
          {onEdit && (
            <Button
              size="sm"
              onClick={() => onEdit(item)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              window.open(`/gear/print?ids=${item.id}`, "_blank")
            }
          >
            <Printer className="h-3.5 w-3.5" />
            Print QR Label
          </Button>
        </div>
      </div>
    </Modal>
  );
}

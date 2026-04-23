"use client";

import { useState } from "react";
import type { CampaignFinancials } from "@/types/domain";
import { formatCurrency } from "@/lib/utils/format";
import { isPast, isToday, parseISO, format } from "date-fns";

interface Props {
  financials: CampaignFinancials;
  assetsDeliveryDate: string | null;
  onUpdateAssetsDate?: (date: string | null) => void;
}

export function CampaignQuickStats({
  financials,
  assetsDeliveryDate,
  onUpdateAssetsDate,
}: Props) {
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(assetsDeliveryDate || "");

  const isOverdue = assetsDeliveryDate
    ? isPast(parseISO(assetsDeliveryDate)) && !isToday(parseISO(assetsDeliveryDate))
    : false;

  function saveDate() {
    onUpdateAssetsDate?.(dateValue || null);
    setEditingDate(false);
  }

  return (
    <div className="flex items-center gap-6 text-sm">
      <div>
        <span className="text-text-tertiary text-[10px] uppercase tracking-wider font-medium">Budget</span>
        <p className="text-base font-semibold text-text-primary leading-tight">{formatCurrency(financials.budget)}</p>
      </div>
      <div className="h-6 w-px bg-border" />
      <div>
        <span className="text-text-tertiary text-[10px] uppercase tracking-wider font-medium">Committed</span>
        <p className="text-base font-semibold text-blue-600 leading-tight">{formatCurrency(financials.committed)}</p>
      </div>
      <div className="h-6 w-px bg-border" />
      <div>
        <span className="text-text-tertiary text-[10px] uppercase tracking-wider font-medium">Assets Due</span>
        {editingDate ? (
          <input
            autoFocus
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            onBlur={saveDate}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveDate();
              if (e.key === "Escape") { setDateValue(assetsDeliveryDate || ""); setEditingDate(false); }
            }}
            className="text-base font-semibold bg-transparent border-b border-primary focus:outline-none text-text-primary leading-tight"
          />
        ) : (
          <p
            className={`text-base font-semibold leading-tight cursor-pointer transition-colors ${
              isOverdue ? "text-error" : assetsDeliveryDate ? "text-text-primary hover:text-primary" : "text-text-tertiary hover:text-primary"
            }`}
            onClick={() => onUpdateAssetsDate && setEditingDate(true)}
          >
            {assetsDeliveryDate ? format(parseISO(assetsDeliveryDate), "MMM d, yyyy") : "Set date"}
          </p>
        )}
      </div>
    </div>
  );
}

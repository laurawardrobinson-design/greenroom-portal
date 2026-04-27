"use client";

import { formatCurrency } from "@/lib/utils/format";

interface CampaignVendor {
  id: string;
  estimateTotal: number;
  invoiceTotal: number;
  paymentAmount: number;
  status: string;
  vendor?: { companyName: string; category: string };
}

interface Props {
  campaignId: string;
  financials: { budget: number; committed: number; vendorCommitted?: number; crewCommitted?: number; spent: number; remaining: number };
  vendors: CampaignVendor[];
  canEdit: boolean;
  onRequestOverage: () => void;
}

export function BudgetSidebarTile({ financials, canEdit, onRequestOverage }: Props) {
  const isOver = financials.remaining < 0;
  const isWarning = !isOver && financials.budget > 0 && financials.remaining < financials.budget * 0.1;

  const remainingColor = isOver
    ? "text-red-500"
    : isWarning
    ? "text-amber-500"
    : "text-primary";

  const stats: { label: string; value: number; valueClass: string }[] = [
    { label: "Total", value: financials.budget, valueClass: "text-text-primary" },
    { label: "Remaining", value: financials.remaining, valueClass: remainingColor },
    { label: "Committed", value: financials.committed, valueClass: "text-blue-500" },
    { label: "Spent", value: financials.spent, valueClass: "text-text-secondary" },
  ];

  return (
    <div className="space-y-3">

      {/* 2×2 stat grid */}
      <div className="grid grid-cols-2 gap-2">
        {stats.map(({ label, value, valueClass }) => (
          <div key={label} className="bg-surface-secondary rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">
              {label}
            </p>
            <p className={`text-lg font-bold leading-tight ${valueClass}`}>
              {formatCurrency(value)}
            </p>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex justify-center pt-0.5">
          <button
            type="button"
            onClick={onRequestOverage}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Request adjustment →
          </button>
        </div>
      )}
    </div>
  );
}

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
  financials: { budget: number; committed: number; spent: number; remaining: number };
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

  const budget = financials.budget;
  const spent = financials.spent;
  const committed = financials.committed;

  const spentPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const committedOnlyPct =
    budget > 0 ? Math.max(0, Math.min(((committed - spent) / budget) * 100, 100 - spentPct)) : 0;
  const overPct = budget > 0 && committed > budget ? ((committed - budget) / budget) * 100 : 0;

  const stats: { label: string; value: number; valueClass: string }[] = [
    { label: "Total Budget", value: financials.budget, valueClass: "text-text-primary" },
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
            <p className={`text-lg font-bold tabular-nums leading-tight ${valueClass}`}>
              {formatCurrency(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {budget > 0 && (
        <div>
          <div className="relative h-2 rounded-full bg-surface-tertiary overflow-visible">
            <div className="absolute inset-0 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-primary transition-all duration-500 shrink-0"
                style={{ width: `${spentPct}%` }}
              />
              <div
                className="h-full bg-blue-400 transition-all duration-500 shrink-0"
                style={{ width: `${committedOnlyPct}%` }}
              />
            </div>
            {overPct > 0 && (
              <div
                className="absolute top-0 right-0 h-full bg-red-500 rounded-r-full transition-all duration-500"
                style={{ width: `${Math.min(overPct, 30)}%`, transform: "translateX(100%)" }}
              />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              Spent
            </span>
            <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
              Committed
            </span>
            {overPct > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-red-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                Over budget
              </span>
            )}
          </div>
        </div>
      )}

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

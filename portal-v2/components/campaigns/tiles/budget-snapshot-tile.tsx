"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/format";
import { DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import type { CampaignFinancials } from "@/types/domain";

interface Props {
  financials: CampaignFinancials;
  canEdit: boolean;
  onRequestOverage: () => void;
  onViewFullBudget: () => void;
}

export function BudgetSnapshotTile({ financials, canEdit, onRequestOverage, onViewFullBudget }: Props) {
  const pct = financials.budget > 0
    ? (financials.committed / financials.budget) * 100
    : 0;

  const barColor = pct > 100
    ? "bg-red-500"
    : pct > 90
    ? "bg-amber-500"
    : "bg-primary";

  const remainingColor = financials.remaining < 0
    ? "text-red-600"
    : financials.remaining < financials.budget * 0.1
    ? "text-amber-600"
    : "text-emerald-600";

  return (
    <Card padding="none" className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">Budget</h3>
        </div>
        {financials.remaining < 0 && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
            <AlertTriangle className="h-3 w-3" />
            Over
          </span>
        )}
      </div>

      <div className="px-3.5 py-3 space-y-3 flex-1">
        {/* Budget total */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Total Budget</p>
          <p className="text-sm font-semibold text-text-primary leading-tight">{formatCurrency(financials.budget)}</p>
        </div>

        {/* Progress bar */}
        {financials.budget > 0 && (
          <div>
            <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor} transition-all duration-500`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1">
              {Math.round(pct)}% committed
            </p>
          </div>
        )}

        {/* Committed & Remaining */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-surface-secondary p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Committed</p>
            <p className="text-sm font-semibold text-blue-600">{formatCurrency(financials.committed)}</p>
          </div>
          <div className="rounded-lg bg-surface-secondary p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Remaining</p>
            <p className={`text-sm font-semibold ${remainingColor}`}>{formatCurrency(financials.remaining)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3.5 pb-3 space-y-2">
        {canEdit && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={onRequestOverage}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Request Additional Funds
          </Button>
        )}
        <button
          onClick={onViewFullBudget}
          className="w-full text-center text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1"
        >
          View Full Budget
        </button>
      </div>
    </Card>
  );
}

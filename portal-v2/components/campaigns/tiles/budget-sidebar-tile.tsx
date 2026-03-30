"use client";

import { useState } from "react";
import useSWR from "swr";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { format, parseISO } from "date-fns";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface OverageRequest {
  id: string;
  amount: number;
  rationale: string;
  status: string;
  createdAt: string;
  requester?: { name: string };
}

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

export function BudgetSidebarTile({ campaignId, financials, vendors, canEdit, onRequestOverage }: Props) {
  const [tab, setTab] = useState<"overview" | "vendors">("overview");

  const { data: overageRequests = [] } = useSWR<OverageRequest[]>(
    tab === "vendors" ? `/api/budget/requests?campaignId=${campaignId}` : null,
    fetcher
  );

  const spentPct = financials.budget > 0
    ? Math.min((financials.spent / financials.budget) * 100, 100)
    : 0;
  const committedOnlyPct = financials.budget > 0
    ? Math.min(((financials.committed - financials.spent) / financials.budget) * 100, 100 - spentPct)
    : 0;
  const isOver = financials.remaining < 0;
  const isWarning = !isOver && financials.budget > 0 && financials.remaining < financials.budget * 0.1;

  return (
    <div>
      {/* Tab strip — flush against CollapsibleSection header border */}
      <div className="flex border-b border-border pt-3 mb-3 -mx-3.5 px-3.5">
        <button
          onClick={() => setTab("overview")}
          className={`pb-2 mr-4 text-xs font-medium border-b-2 -mb-px transition-colors ${
            tab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("vendors")}
          className={`pb-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
            tab === "vendors"
              ? "border-primary text-primary"
              : "border-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Vendors{vendors.length > 0 ? ` · ${vendors.length}` : ""}
        </button>
      </div>

      {tab === "overview" && (
        <div className="space-y-3">
          {/* Stacked progress bar */}
          {financials.budget > 0 && (
            <div>
              <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${spentPct}%` }}
                />
                <div
                  className={`h-full transition-all duration-500 ${isOver ? "bg-red-500" : "bg-blue-400"}`}
                  style={{ width: `${committedOnlyPct}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Spent
                </span>
                <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                  Committed
                </span>
              </div>
            </div>
          )}

          {/* Numbers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-tertiary">Total budget</span>
              <span className="font-semibold text-text-primary">{formatCurrency(financials.budget)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-tertiary">Spent</span>
              <span className="font-medium text-emerald-600">{formatCurrency(financials.spent)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-tertiary">Committed</span>
              <span className="font-medium text-blue-600">{formatCurrency(financials.committed)}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-border pt-1.5">
              <span className="font-medium text-text-secondary">Remaining</span>
              <span className={`font-semibold ${
                isOver ? "text-red-600" : isWarning ? "text-amber-600" : "text-emerald-600"
              }`}>
                {formatCurrency(financials.remaining)}
              </span>
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={onRequestOverage}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Request adjustment →
            </button>
          )}
        </div>
      )}

      {tab === "vendors" && (
        <div className="space-y-3">
          {vendors.length === 0 ? (
            <p className="text-xs text-text-tertiary py-1">No vendors assigned yet.</p>
          ) : (
            <div className="space-y-1">
              {vendors.map((cv) => {
                const amount = cv.estimateTotal || cv.invoiceTotal || 0;
                const isPaid = ["Paid", "Invoice Approved"].includes(cv.status);
                return (
                  <div
                    key={cv.id}
                    className="flex items-center justify-between rounded-md bg-surface-secondary px-2.5 py-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {cv.vendor?.companyName || "Unknown"}
                      </p>
                      <p className="text-[10px] text-text-tertiary">{cv.vendor?.category}</p>
                    </div>
                    <span className={`font-medium ml-2 shrink-0 ${
                      isPaid ? "text-emerald-600" : "text-text-secondary"
                    }`}>
                      {formatCurrency(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {overageRequests.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-medium text-text-tertiary mb-1.5">
                Adjustment Requests
              </p>
              <div className="space-y-1.5">
                {overageRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-start gap-2 rounded-md bg-surface-secondary px-2.5 py-2"
                  >
                    {req.status === "Pending" ? (
                      <Clock className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    ) : req.status === "Approved" ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-text-primary">
                          {formatCurrency(req.amount)}
                        </span>
                        <span className={`text-[10px] font-medium ${
                          req.status === "Approved"
                            ? "text-emerald-600"
                            : req.status === "Declined"
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-secondary mt-0.5 leading-tight">
                        {req.rationale}
                      </p>
                      <p className="text-[10px] text-text-tertiary mt-0.5">
                        {req.requester?.name && `${req.requester.name} · `}
                        {format(parseISO(req.createdAt), "MMM d")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={onRequestOverage}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Request adjustment →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

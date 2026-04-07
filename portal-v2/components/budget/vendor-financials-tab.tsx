"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils/format";
import { Receipt, Loader2 } from "lucide-react";
import Link from "next/link";
import { InvoiceReviewPanel } from "@/components/campaigns/invoice-review-panel";
import { EstimateReviewPanel } from "@/components/campaigns/estimate-review-panel";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface VendorFinancialItem {
  id: string;
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  vendorName: string;
  status: string;
  estimateTotal: number;
  invoiceTotal: number | null;
  updatedAt: string;
}

interface CampaignFilterOption {
  id: string;
  name: string;
  wfNumber: string;
}

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  vendors: VendorFinancialItem[];
}

const STATUS_LABEL: Record<string, string> = {
  "Estimate Submitted": "Pending Estimate",
  "Estimate Approved": "Estimate Approved",
  "PO Uploaded": "PO Sent",
  "PO Signed": "PO Signed",
  "Shoot Complete": "Shoot Complete",
  "Invoice Submitted": "Invoice Pending",
  "Invoice Pre-Approved": "Pre-Approved",
  "Invoice Approved": "Invoice Approved",
  "Paid": "Paid",
};

const STATUS_COLOR: Record<string, string> = {
  "Estimate Submitted": "bg-amber-50 text-amber-700",
  "Estimate Approved": "bg-blue-50 text-blue-700",
  "PO Uploaded": "bg-blue-50 text-blue-700",
  "PO Signed": "bg-blue-50 text-blue-700",
  "Shoot Complete": "bg-purple-50 text-purple-700",
  "Invoice Submitted": "bg-amber-50 text-amber-700",
  "Invoice Pre-Approved": "bg-amber-50 text-amber-700",
  "Invoice Approved": "bg-emerald-50 text-emerald-700",
  "Paid": "bg-emerald-50 text-emerald-700",
};

function getAction(status: string): "review-estimate" | "review-invoice" | null {
  if (status === "Estimate Submitted") return "review-estimate";
  if (status === "Invoice Submitted") return "review-invoice";
  return null;
}

export function VendorFinancialsTab() {
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, mutate } = useSWR<{
    items: VendorFinancialItem[];
    campaigns: CampaignFilterOption[];
  }>("/api/estimates/summary", fetcher);

  const items = data?.items || [];
  const campaignOptions = data?.campaigns || [];

  const filtered = campaignFilter === "all"
    ? items
    : items.filter((i) => i.campaignId === campaignFilter);

  // Group by campaign, preserving the order items came back in
  const groups = useMemo<CampaignGroup[]>(() => {
    const map = new Map<string, CampaignGroup>();
    for (const item of filtered) {
      if (!map.has(item.campaignId)) {
        map.set(item.campaignId, {
          campaignId: item.campaignId,
          campaignName: item.campaignName,
          wfNumber: item.wfNumber,
          vendors: [],
        });
      }
      map.get(item.campaignId)!.vendors.push(item);
    }
    return Array.from(map.values());
  }, [filtered]);

  function toggle(id: string) {
    setOpenId(openId === id ? null : id);
  }


  return (
    <Card className="max-w-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-text-tertiary" />
          Vendor Financials
        </CardTitle>
        <select
          value={campaignFilter}
          onChange={(e) => {
            setCampaignFilter(e.target.value);
            setOpenId(null);
          }}
          className="text-xs bg-surface-secondary border border-border rounded-md px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All campaigns</option>
          {campaignOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.wfNumber} — {c.name}
            </option>
          ))}
        </select>
      </CardHeader>

      {!data ? (
        <div className="flex items-center justify-center py-10 text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="No vendor financials"
          description="Vendor estimates will appear here once submitted."
        />
      ) : (
        <>
        <div className="grid grid-cols-[1fr_136px_72px_72px] gap-x-3 px-4 py-1.5 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Vendor</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary text-center">Status</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary text-right">Estimate</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary text-right">Invoice</span>
        </div>
        <div className="divide-y divide-border">
          {groups.map((group) => (
            <div key={group.campaignId} className="px-4 py-3">
              {/* Campaign header */}
              <div className="flex items-baseline gap-2 mb-2">
                <Link
                  href={`/campaigns/${group.campaignId}`}
                  className="text-sm font-semibold text-text-primary hover:text-primary transition-colors"
                >
                  {group.campaignName}
                </Link>
                <span className="text-xs text-text-tertiary">{group.wfNumber}</span>
              </div>

              {/* Vendor rows */}
              <div className="space-y-0.5">
                {group.vendors.map((v) => {
                  const action = getAction(v.status);
                  const isOpen = openId === v.id;
                  const hasInvoice = v.invoiceTotal != null && v.invoiceTotal > 0;
                  const isOver = hasInvoice && v.invoiceTotal! > v.estimateTotal;

                  return (
                    <div key={v.id}>
                      <div
                        className={`grid grid-cols-[1fr_136px_72px_72px] items-center gap-x-3 py-1.5 px-1 -mx-1 rounded-md ${action ? "cursor-pointer hover:bg-surface-secondary transition-colors" : ""}`}
                        onClick={action ? () => toggle(v.id) : undefined}
                      >
                        {/* Vendor name */}
                        <span className="text-xs font-medium text-text-primary truncate">
                          {v.vendorName}
                        </span>

                        {/* Status badge */}
                        <Badge
                          variant="custom"
                          className={`text-[10px] justify-center ${STATUS_COLOR[v.status] || "bg-surface-secondary text-text-secondary"}`}
                        >
                          {STATUS_LABEL[v.status] || v.status}
                        </Badge>

                        {/* Estimate — click to review */}
                        <span
                          className={`text-xs text-right font-medium text-text-primary ${action === "review-estimate" ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
                          onClick={action === "review-estimate" ? (e) => { e.stopPropagation(); toggle(v.id); } : undefined}
                        >
                          {formatCurrency(v.estimateTotal)}
                        </span>

                        {/* Invoice — click to open document */}
                        {hasInvoice ? (
                          <a
                            href={`/invoices/${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs text-right font-medium hover:underline ${isOver ? "text-red-600" : "text-text-primary"}`}
                          >
                            {formatCurrency(v.invoiceTotal!)}
                          </a>
                        ) : (
                          <span className="text-xs text-right text-text-tertiary">—</span>
                        )}
                      </div>

                      {/* Inline review panel */}
                      {isOpen && action === "review-estimate" && (
                        <div className="ml-2 mb-2">
                          <EstimateReviewPanel
                            campaignVendorId={v.id}
                            status={v.status}
                            onStatusChange={() => {
                              setOpenId(null);
                              mutate();
                            }}
                          />
                        </div>
                      )}
                      {isOpen && action === "review-invoice" && (
                        <div className="ml-2 mb-2 border-t border-border pt-3">
                          <InvoiceReviewPanel
                            campaignVendorId={v.id}
                            onStatusChange={() => {
                              setOpenId(null);
                              mutate();
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </Card>
  );
}

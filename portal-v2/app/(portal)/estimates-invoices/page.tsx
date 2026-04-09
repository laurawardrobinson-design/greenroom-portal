"use client";

import { useState } from "react";
import useSWR from "swr";
import type { CampaignVendor, CampaignVendorStatus } from "@/types/domain";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VendorLifecycleModal } from "@/components/campaigns/vendor-lifecycle-modal";
import { formatCurrency } from "@/lib/utils/format";
import { FileText, Receipt, Clock } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });

type PendingRow = CampaignVendor & { campaignName: string; wfNumber: string };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_VARIANT: Record<CampaignVendorStatus, "success" | "warning" | "error" | "default"> = {
  "Estimate Approved": "success",
  "PO Uploaded": "warning",
  "PO Signed": "warning",
  "Shoot Complete": "warning",
  "Invoice Pre-Approved": "warning",
  "Invoice Approved": "success",
  "Paid": "success",
  "Rejected": "error",
  "Invited": "default",
  "Estimate Submitted": "default",
  "Invoice Submitted": "default",
};

const STATUS_LABEL: Partial<Record<CampaignVendorStatus, string>> = {
  "Estimate Approved": "Est. Approved",
  "PO Uploaded": "PO Uploaded",
  "PO Signed": "PO Signed",
  "Shoot Complete": "Shoot Complete",
  "Invoice Pre-Approved": "Inv. Pre-Approved",
  "Invoice Approved": "Inv. Approved",
  "Paid": "Paid",
  "Rejected": "Rejected",
};

export default function EstimatesInvoicesPage() {
  const { user, isLoading: loadingUser } = useCurrentUser();
  const [managingRow, setManagingRow] = useState<PendingRow | null>(null);

  const canAccess = user?.role === "Producer";

  const { data: rows = [], isLoading: loadingRows, mutate } = useSWR<PendingRow[]>(
    canAccess ? "/api/pending-documents" : null,
    fetcher
  );

  const { data: recentRows = [], mutate: mutateRecent } = useSWR<PendingRow[]>(
    canAccess ? "/api/recent-documents" : null,
    fetcher
  );

  function handleStatusChange() {
    Promise.all([mutate(), mutateRecent()]).then(([updatedPending]) => {
      if (managingRow && Array.isArray(updatedPending)) {
        const fresh = updatedPending.find((r) => r.id === managingRow.id);
        setManagingRow(fresh || null);
      }
    });
  }

  if (loadingUser) return <DashboardSkeleton />;

  if (!canAccess) {
    return (
      <EmptyState
        title="Access restricted"
        description="Estimates & Invoices is available to Producers and Admins."
      />
    );
  }

  const pendingEstimates = rows.filter((r) => r.status === "Estimate Submitted");
  const pendingInvoices = rows.filter((r) => r.status === "Invoice Submitted");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Estimates & Invoices</h1>
        <p className="text-sm text-text-secondary mt-1">
          Documents waiting for your review across all campaigns.
        </p>
      </div>

      {loadingRows ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid grid-cols-[400px_400px] gap-6 items-start">
          {/* Left column — pending queue */}
          <div className="space-y-4">
            {/* Pending Estimates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-text-tertiary" />
                  Pending Estimates
                  {pendingEstimates.length > 0 && (
                    <Badge variant="warning">{pendingEstimates.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              {pendingEstimates.length === 0 ? (
                <EmptyState
                  title="No pending estimates"
                  description="Submitted estimates will appear here."
                />
              ) : (
                <div className="space-y-2">
                  {pendingEstimates.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {row.vendor?.companyName || "Unknown Vendor"}
                        </p>
                        <p className="text-xs text-text-tertiary truncate">
                          {row.wfNumber && `${row.wfNumber} — `}{row.campaignName}
                        </p>
                        {row.estimateTotal > 0 && (
                          <p className="text-xs text-text-secondary mt-0.5">
                            Est: <span className="font-medium text-text-primary">{formatCurrency(row.estimateTotal)}</span>
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setManagingRow(row)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Pending Invoices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-text-tertiary" />
                  Pending Invoices
                  {pendingInvoices.length > 0 && (
                    <Badge variant="warning">{pendingInvoices.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              {pendingInvoices.length === 0 ? (
                <EmptyState
                  title="No pending invoices"
                  description="Submitted invoices will appear here."
                />
              ) : (
                <div className="space-y-2">
                  {pendingInvoices.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {row.vendor?.companyName || "Unknown Vendor"}
                        </p>
                        <p className="text-xs text-text-tertiary truncate">
                          {row.wfNumber && `${row.wfNumber} — `}{row.campaignName}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-text-secondary">
                          {row.estimateTotal > 0 && (
                            <span>Est: <span className="font-medium text-text-primary">{formatCurrency(row.estimateTotal)}</span></span>
                          )}
                          {row.invoiceTotal > 0 && (
                            <span>
                              Inv:{" "}
                              <span className={`font-medium ${row.invoiceTotal > row.estimateTotal ? "text-red-600" : "text-text-primary"}`}>
                                {formatCurrency(row.invoiceTotal)}
                              </span>
                            </span>
                          )}
                          {row.invoiceTotal > row.estimateTotal && row.estimateTotal > 0 && (
                            <Badge variant="error">Over</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setManagingRow(row)}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right column — recent activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-text-tertiary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            {recentRows.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="Approved, signed, and paid documents will appear here."
              />
            ) : (
              <div className="space-y-4">
                {(() => {
                  // Group by campaign, ordered by most recently updated item in each group
                  const grouped = new Map<string, { campaignName: string; wfNumber: string; rows: typeof recentRows }>();
                  for (const row of recentRows) {
                    const key = row.campaignId;
                    if (!grouped.has(key)) {
                      grouped.set(key, { campaignName: row.campaignName, wfNumber: row.wfNumber, rows: [] });
                    }
                    grouped.get(key)!.rows.push(row);
                  }
                  return [...grouped.values()].map(({ campaignName, wfNumber, rows }) => (
                    <div key={wfNumber || campaignName}>
                      <p className="text-xs font-semibold text-text-primary mb-1.5 px-0.5">
                        {wfNumber && <span className="text-text-tertiary font-normal">{wfNumber} — </span>}{campaignName}
                      </p>
                      <div className="space-y-1.5">
                        {rows.map((row) => (
                          <button
                            key={row.id}
                            onClick={() => setManagingRow(row)}
                            className="w-full text-left rounded-lg border border-border px-3.5 py-2.5 hover:bg-surface-hover transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-text-primary truncate">
                                {row.vendor?.companyName || "Unknown Vendor"}
                              </p>
                              <span className="text-[10px] text-text-tertiary shrink-0 tabular-nums pt-0.5">
                                {timeAgo(row.updatedAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant={STATUS_VARIANT[row.status]}>
                                {STATUS_LABEL[row.status] ?? row.status}
                              </Badge>
                              {row.estimateTotal > 0 && (
                                <span className="text-xs text-text-secondary">Est: <span className="font-medium">{formatCurrency(row.estimateTotal)}</span></span>
                              )}
                              {row.invoiceTotal > 0 && (
                                <span className="text-xs text-text-secondary">Inv: <span className="font-medium">{formatCurrency(row.invoiceTotal)}</span></span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Lifecycle modal */}
      {managingRow && (
        <VendorLifecycleModal
          open={!!managingRow}
          onClose={() => setManagingRow(null)}
          campaignVendor={managingRow}
          campaignId={managingRow.campaignId}
          wfNumber={managingRow.wfNumber}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

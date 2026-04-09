"use client";

import { useState } from "react";
import useSWR from "swr";
import type { CampaignVendor } from "@/types/domain";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VendorLifecycleModal } from "@/components/campaigns/vendor-lifecycle-modal";
import { formatCurrency } from "@/lib/utils/format";
import { FileText, Receipt } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });

type PendingRow = CampaignVendor & { campaignName: string; wfNumber: string };

export default function EstimatesInvoicesPage() {
  const { user, isLoading: loadingUser } = useCurrentUser();
  const [managingRow, setManagingRow] = useState<PendingRow | null>(null);

  const canAccess = user?.role === "Admin" || user?.role === "Producer";

  const { data: rows = [], isLoading: loadingRows, mutate } = useSWR<PendingRow[]>(
    canAccess ? "/api/pending-documents" : null,
    fetcher
  );

  function handleStatusChange() {
    mutate().then((updated) => {
      if (managingRow && Array.isArray(updated)) {
        const fresh = updated.find((r) => r.id === managingRow.id);
        // If the row was approved/resolved, it disappears — close modal
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Estimates & Invoices</h1>
        <p className="text-sm text-text-secondary mt-1">
          Documents waiting for your review across all campaigns.
        </p>
      </div>

      {loadingRows ? (
        <DashboardSkeleton />
      ) : (
        <>
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
                description="When a vendor submits an estimate, it will appear here for your review."
              />
            ) : (
              <div className="space-y-2">
                {pendingEstimates.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-4"
                  >
                    <div className="min-w-0 w-52 shrink-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {row.vendor?.companyName || "Unknown Vendor"}
                      </p>
                      <p className="text-xs text-text-tertiary truncate">
                        {row.wfNumber && `${row.wfNumber} — `}{row.campaignName}
                      </p>
                    </div>
                    <div className="flex-1 flex gap-4 text-xs text-text-tertiary">
                      {row.estimateTotal > 0 && (
                        <span>
                          Est:{" "}
                          <span className="font-medium text-text-primary">
                            {formatCurrency(row.estimateTotal)}
                          </span>
                        </span>
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
                description="When a vendor submits an invoice, it will appear here for your review."
              />
            ) : (
              <div className="space-y-2">
                {pendingInvoices.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-4"
                  >
                    <div className="min-w-0 w-52 shrink-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {row.vendor?.companyName || "Unknown Vendor"}
                      </p>
                      <p className="text-xs text-text-tertiary truncate">
                        {row.wfNumber && `${row.wfNumber} — `}{row.campaignName}
                      </p>
                    </div>
                    <div className="flex-1 flex gap-4 text-xs text-text-tertiary flex-wrap">
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
                        <Badge variant="error">Over estimate</Badge>
                      )}
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
        </>
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

"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { CampaignVendor } from "@/types/domain";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VendorLifecycleModal } from "@/components/campaigns/vendor-lifecycle-modal";
import { formatCurrency } from "@/lib/utils/format";
import { Settings2 } from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
};

// ─── Phase chip helpers (same mapping as VendorAssignmentPanel) ───────────────

type Phase = "estimate" | "po" | "invoice" | "complete";

function getPhase(status: string): Phase {
  if (["Invited", "Estimate Submitted", "Estimate Approved", "Rejected"].includes(status)) return "estimate";
  if (["PO Uploaded", "PO Signed", "Shoot Complete"].includes(status)) return "po";
  if (["Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved"].includes(status)) return "invoice";
  return "complete";
}

const PHASE_LABEL: Record<Phase, string> = { estimate: "Estimate", po: "PO", invoice: "Invoice", complete: "Complete" };
const PHASE_STYLE: Record<Phase, string> = {
  estimate: "bg-amber-50 text-amber-700 border-amber-200",
  po: "bg-blue-50 text-blue-700 border-blue-200",
  invoice: "bg-violet-50 text-violet-700 border-violet-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function getSubLabel(status: string): string {
  const map: Record<string, string> = {
    "Invited": "Submit your estimate",
    "Estimate Submitted": "Under review",
    "Estimate Approved": "Approved",
    "Rejected": "Sent back — resubmit",
    "PO Uploaded": "Sign your PO",
    "PO Signed": "Shoot pending",
    "Shoot Complete": "Upload your invoice",
    "Invoice Submitted": "Under review",
    "Invoice Pre-Approved": "Finance review",
    "Invoice Approved": "Approved",
    "Paid": "Payment complete",
  };
  return map[status] || status;
}

function needsVendorAction(status: string): boolean {
  return ["Invited", "PO Uploaded", "Shoot Complete", "Rejected"].includes(status);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VendorWorkflowPage() {
  const { user, isLoading: loadingUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const focusedAssignment = searchParams.get("assignment");

  const [managingVendor, setManagingVendor] = useState<any | null>(null);

  const { data: rawAssignments, isLoading: loadingAssignments, mutate } = useSWR<any[]>(
    user?.vendorId ? `/api/campaign-vendors?vendorId=${user.vendorId}` : null,
    fetcher
  );

  const assignments = useMemo(
    () => (Array.isArray(rawAssignments) ? rawAssignments : []),
    [rawAssignments]
  );

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      if (focusedAssignment && a.id === focusedAssignment) return -1;
      if (focusedAssignment && b.id === focusedAssignment) return 1;
      if (a.status === "Paid" && b.status !== "Paid") return 1;
      if (b.status === "Paid" && a.status !== "Paid") return -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [assignments, focusedAssignment]);

  function handleStatusChange(cv: CampaignVendor) {
    mutate().then((updated) => {
      if (Array.isArray(updated)) {
        const fresh = updated.find((a) => a.id === cv.id);
        if (fresh) setManagingVendor(fresh);
      }
    });
  }

  if (loadingUser || !user) return <DashboardSkeleton />;

  if (user.role !== "Vendor") {
    return (
      <EmptyState
        title="Vendor workflow only"
        description="This area is only available to vendor users."
      />
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-text-primary">Estimates & Invoices</h1>
        <p className="text-sm text-text-secondary">
          Submit estimates, sign POs, and upload invoices here.
        </p>
      </div>

      {loadingAssignments ? (
        <div className="space-y-3">
          <Card><DashboardSkeleton /></Card>
          <Card><DashboardSkeleton /></Card>
        </div>
      ) : sortedAssignments.length === 0 ? (
        <Card>
          <EmptyState
            title="No workflow assignments yet"
            description="When a producer assigns you to a campaign, your estimate, PO, and invoice workflow will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedAssignments.map((cv) => {
            const campaignLabel = cv.wfNumber
              ? `${cv.wfNumber} — ${cv.campaignName}`
              : cv.campaignName || "Campaign";
            const phase = getPhase(cv.status);
            const subLabel = getSubLabel(cv.status);
            const showDot = needsVendorAction(cv.status);
            const isFocused = focusedAssignment === cv.id;

            return (
              <Card
                key={cv.id}
                className={isFocused ? "ring-1 ring-primary/30 shadow-sm" : ""}
              >
                <CardHeader className="mb-0">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate">{campaignLabel}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {showDot && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                    <Button
                      size="sm"
                      variant={showDot ? "primary" : "secondary"}
                      onClick={() => setManagingVendor(cv)}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                  </div>
                </CardHeader>

                <div className="px-4 pb-3 mt-1.5 flex items-center gap-3 flex-wrap">
                  {/* Phase + sub-label */}
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PHASE_STYLE[phase]}`}>
                    {PHASE_LABEL[phase]}
                  </span>
                  <span className="text-xs text-text-secondary">{subLabel}</span>

                  {/* Financials */}
                  {(cv.estimateTotal > 0 || cv.invoiceTotal > 0 || cv.paymentAmount > 0) && (
                    <>
                      <span className="text-text-tertiary">·</span>
                      {cv.estimateTotal > 0 && (
                        <span className="text-xs text-text-tertiary">Est: <span className="font-medium text-text-primary">{formatCurrency(cv.estimateTotal)}</span></span>
                      )}
                      {cv.invoiceTotal > 0 && (
                        <span className="text-xs text-text-tertiary">Inv: <span className="font-medium text-text-primary">{formatCurrency(cv.invoiceTotal)}</span></span>
                      )}
                      {cv.paymentAmount > 0 && (
                        <span className="text-xs text-text-tertiary">Paid: <span className="font-medium text-emerald-700">{formatCurrency(cv.paymentAmount)}</span></span>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Vendor lifecycle modal */}
      {managingVendor && (
        <VendorLifecycleModal
          open={!!managingVendor}
          onClose={() => setManagingVendor(null)}
          campaignVendor={managingVendor}
          campaignId={managingVendor.campaignId}
          wfNumber={managingVendor.wfNumber || ""}
          onStatusChange={() => handleStatusChange(managingVendor)}
        />
      )}
    </div>
  );
}

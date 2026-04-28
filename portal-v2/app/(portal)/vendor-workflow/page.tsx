"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { CampaignVendor } from "@/types/domain";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { VendorLifecycleModal } from "@/components/campaigns/vendor-lifecycle-modal";
import { formatCurrency } from "@/lib/utils/format";
import { FileText, Receipt, ClipboardList } from "lucide-react";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
};

// ─── Status sub-labels ────────────────────────────────────────────────────────

function getSubLabel(status: string): string {
  const map: Record<string, string> = {
    "Invited": "Action needed — submit your estimate",
    "Estimate Submitted": "Under review",
    "Estimate Approved": "Approved",
    "Rejected": "Sent back — resubmit required",
    "PO Uploaded": "Action needed — sign your PO",
    "PO Signed": "Awaiting shoot",
    "Shoot Complete": "Action needed — upload your invoice",
    "Invoice Submitted": "Invoice under review",
    "Invoice Pre-Approved": "Sent to finance",
    "Invoice Approved": "Approved — payment pending",
    "Paid": "Payment complete",
  };
  return map[status] || status;
}

function needsVendorAction(status: string): boolean {
  return ["Invited", "PO Uploaded", "Shoot Complete", "Rejected"].includes(status);
}

// ─── Tab switcher (matches producer page) ────────────────────────────────────

function SectionTabs({ active, onChange }: {
  active: "active" | "past";
  onChange: (tab: "active" | "past") => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-md bg-surface-secondary p-0.5">
      <button
        type="button"
        onClick={() => onChange("active")}
        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          active === "active"
            ? "bg-white text-text-primary shadow-sm"
            : "text-text-tertiary hover:text-text-secondary"
        }`}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => onChange("past")}
        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          active === "past"
            ? "bg-white text-text-primary shadow-sm"
            : "text-text-tertiary hover:text-text-secondary"
        }`}
      >
        Past
      </button>
    </div>
  );
}

// ─── Shared row ───────────────────────────────────────────────────────────────

function AssignmentRow({ cv, onOpen }: { cv: any; onOpen: () => void }) {
  const needsAction = needsVendorAction(cv.status);
  const subLabel = getSubLabel(cv.status);
  const campaignLabel = cv.wfNumber
    ? `${cv.wfNumber} ${cv.campaignName}`
    : cv.campaignName || "Campaign";

  return (
    <div className="px-3.5 py-2.5 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {needsAction && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
          )}
          <p className="text-sm font-semibold text-text-primary truncate">{campaignLabel}</p>
        </div>
        <p className="text-xs text-text-tertiary mt-0.5 truncate">{subLabel}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
          {cv.estimateTotal > 0 && (
            <span>Est: <span className="font-medium text-text-primary">{formatCurrency(cv.estimateTotal)}</span></span>
          )}
          {cv.invoiceTotal > 0 && (
            <span>Inv: <span className="font-medium text-text-primary">{formatCurrency(cv.invoiceTotal)}</span></span>
          )}
          {cv.paymentAmount > 0 && (
            <span>Paid: <span className="font-medium text-success">{formatCurrency(cv.paymentAmount)}</span></span>
          )}
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={onOpen}>
        Open
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VendorWorkflowPage() {
  const { user, isLoading: loadingUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const focusedAssignment = searchParams.get("assignment");

  const [managingVendor, setManagingVendor] = useState<any | null>(null);
  const [estimateTab, setEstimateTab] = useState<"active" | "past">("active");
  const [poTab, setPoTab] = useState<"active" | "past">("active");
  const [invoiceTab, setInvoiceTab] = useState<"active" | "past">("active");

  const { data: rawAssignments, isLoading: loadingAssignments, mutate } = useSWR<any[]>(
    user?.vendorId ? `/api/campaign-vendors?vendorId=${user.vendorId}` : null,
    fetcher
  );

  const assignments = useMemo(
    () => (Array.isArray(rawAssignments) ? rawAssignments : []),
    [rawAssignments]
  );

  // Bucket assignments by section
  const estimatesActive = assignments.filter((cv) => ["Invited", "Estimate Submitted", "Rejected"].includes(cv.status));
  const estimatesPast   = assignments.filter((cv) => cv.status === "Estimate Approved");

  const poActive = assignments.filter((cv) => cv.status === "PO Uploaded");
  const poPast   = assignments.filter((cv) => ["PO Signed", "Shoot Complete"].includes(cv.status));

  const invoicesActive = assignments.filter((cv) => cv.status === "Shoot Complete");
  const invoicesPast   = assignments.filter((cv) => ["Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(cv.status));

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
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Estimates & Invoices" />

      {loadingAssignments ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-4">

          {/* Estimates */}
          <Card padding="none">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Estimates</span>
              <div className="ml-auto">
                <SectionTabs active={estimateTab} onChange={setEstimateTab} />
              </div>
            </div>
            {estimateTab === "active" ? (
              estimatesActive.length === 0 ? (
                <EmptyState title="No active estimates" description="Campaigns you've been invited to will appear here." />
              ) : (
                <div className="divide-y divide-border">
                  {estimatesActive.map((cv) => (
                    <AssignmentRow key={cv.id} cv={cv} onOpen={() => setManagingVendor(cv)} />
                  ))}
                </div>
              )
            ) : (
              estimatesPast.length === 0 ? (
                <EmptyState title="No approved estimates" description="Approved estimates will appear here." />
              ) : (
                <div className="bg-surface-secondary rounded-b-xl divide-y divide-border">
                  {estimatesPast.map((cv) => (
                    <AssignmentRow key={cv.id} cv={cv} onOpen={() => setManagingVendor(cv)} />
                  ))}
                </div>
              )
            )}
          </Card>

          {/* Purchase Orders */}
          <Card padding="none">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Purchase Orders</span>
              <div className="ml-auto">
                <SectionTabs active={poTab} onChange={setPoTab} />
              </div>
            </div>
            {poTab === "active" ? (
              poActive.length === 0 ? (
                <EmptyState title="No POs awaiting signature" description="POs ready for your signature will appear here." />
              ) : (
                <div className="divide-y divide-border">
                  {poActive.map((cv) => (
                    <AssignmentRow key={cv.id} cv={cv} onOpen={() => setManagingVendor(cv)} />
                  ))}
                </div>
              )
            ) : (
              poPast.length === 0 ? (
                <EmptyState title="No past POs" description="Signed POs will appear here." />
              ) : (
                <div className="bg-surface-secondary rounded-b-xl divide-y divide-border">
                  {poPast.map((cv) => (
                    <AssignmentRow key={cv.id} cv={cv} onOpen={() => setManagingVendor(cv)} />
                  ))}
                </div>
              )
            )}
          </Card>

          {/* Invoices */}
          <Card padding="none">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <Receipt className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Invoices</span>
              <div className="ml-auto">
                <SectionTabs active={invoiceTab} onChange={setInvoiceTab} />
              </div>
            </div>
            {invoiceTab === "active" ? (
              invoicesActive.length === 0 ? (
                <EmptyState title="No invoices due" description="Once your shoot is complete, upload your invoice here." />
              ) : (
                <div className="divide-y divide-border">
                  {invoicesActive.map((cv) => (
                    <AssignmentRow key={cv.id} cv={cv} onOpen={() => setManagingVendor(cv)} />
                  ))}
                </div>
              )
            ) : (
              invoicesPast.length === 0 ? (
                <EmptyState title="No past invoices" description="Submitted and approved invoices will appear here." />
              ) : (
                <div className="bg-surface-secondary rounded-b-xl divide-y divide-border">
                  {invoicesPast.map((cv) => (
                    <AssignmentRow key={cv.id} cv={cv} onOpen={() => setManagingVendor(cv)} />
                  ))}
                </div>
              )
            )}
          </Card>

        </div>
      )}

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

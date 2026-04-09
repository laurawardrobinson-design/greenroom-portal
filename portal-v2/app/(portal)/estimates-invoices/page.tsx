"use client";

import { useState } from "react";
import useSWR from "swr";
import type { CampaignVendor, CampaignVendorStatus } from "@/types/domain";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VendorLifecycleModal } from "@/components/campaigns/vendor-lifecycle-modal";
import { formatCurrency } from "@/lib/utils/format";
import { FileText, Receipt, ClipboardList } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });

type PendingRow = CampaignVendor & { campaignName: string; wfNumber: string };

// ── Status chips ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Partial<Record<CampaignVendorStatus, string>> = {
  "Estimate Submitted":  "",
  "Estimate Approved":   "",
  "Rejected":            "Rejected",
  "PO Uploaded":         "Awaiting Signature",
  "PO Signed":           "PO Signed",
  "Shoot Complete":      "Shoot Complete",
  "Invoice Submitted":   "",
  "Invoice Pre-Approved":"Sent to Finance",
  "Invoice Approved":    "Approved",
  "Paid":                "Paid",
};

const STATUS_STYLE: Partial<Record<CampaignVendorStatus, string>> = {
  "Estimate Submitted":  "bg-amber-50 text-amber-700 border-amber-200",
  "Estimate Approved":   "bg-amber-50 text-amber-700 border-amber-200",
  "Rejected":            "bg-red-50 text-red-700 border-red-200",
  "PO Uploaded":         "bg-blue-50 text-blue-700 border-blue-200",
  "PO Signed":           "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Shoot Complete":      "bg-surface-secondary text-text-secondary border-border",
  "Invoice Submitted":   "bg-amber-50 text-amber-700 border-amber-200",
  "Invoice Pre-Approved":"bg-blue-50 text-blue-700 border-blue-200",
  "Invoice Approved":    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Paid":                "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ── Active/Past tab switcher ──────────────────────────────────────────────────

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

// ── Shared row ────────────────────────────────────────────────────────────────

function DocRow({ row, onOpen }: { row: PendingRow; onOpen: () => void }) {
  const label = STATUS_LABEL[row.status] ?? "";
  const style = STATUS_STYLE[row.status] ?? "bg-surface-secondary text-text-secondary border-border";
  const isOver = row.invoiceTotal > 0 && row.estimateTotal > 0 && row.invoiceTotal > row.estimateTotal;

  return (
    <div className="px-3.5 py-2.5 flex items-center gap-4">
      {/* Vendor + campaign */}
      <div className="min-w-0 w-48 shrink-0">
        <p className="text-sm font-semibold text-text-primary truncate">
          {row.vendor?.companyName || "Unknown Vendor"}
        </p>
        <p className="text-xs text-text-tertiary truncate">
          {row.wfNumber && `${row.wfNumber} — `}{row.campaignName}
        </p>
      </div>

      {/* Amounts */}
      <div className="flex gap-4 text-xs flex-1">
        {row.estimateTotal > 0 && (
          <span className="text-text-tertiary">Est: <span className="font-medium text-text-primary">{formatCurrency(row.estimateTotal)}</span></span>
        )}
        {row.invoiceTotal > 0 && (
          <span className="text-text-tertiary">
            Inv:{" "}
            <span className={`font-medium ${isOver ? "text-amber-600" : "text-text-primary"}`}>
              {formatCurrency(row.invoiceTotal)}
            </span>
            {isOver && <span className="ml-1 text-[10px] text-amber-600 font-semibold">↑ over</span>}
          </span>
        )}
        {row.paymentAmount > 0 && (
          <span className="text-text-tertiary">Paid: <span className="font-medium text-emerald-700">{formatCurrency(row.paymentAmount)}</span></span>
        )}
      </div>

      {/* Instructional badge (e.g. Upload PO, Sent to Finance) */}
      {label && (
        <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}>
          {label}
        </span>
      )}

      <Button size="sm" variant="secondary" onClick={onOpen}>
        Review
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EstimatesInvoicesPage() {
  const { user, isLoading: loadingUser } = useCurrentUser();
  const [managingRow, setManagingRow] = useState<PendingRow | null>(null);

  const [estimateTab, setEstimateTab] = useState<"active" | "past">("active");
  const [poTab, setPoTab] = useState<"active" | "past">("active");
  const [invoiceTab, setInvoiceTab] = useState<"active" | "past">("active");

  const canAccess = user?.role === "Producer";

  const { data: pending = [], isLoading: loadingPending, mutate: mutatePending } = useSWR<PendingRow[]>(
    canAccess ? "/api/pending-documents" : null,
    fetcher
  );

  const { data: recent = [], mutate: mutateRecent } = useSWR<PendingRow[]>(
    canAccess ? "/api/recent-documents" : null,
    fetcher
  );

  const all = [...pending, ...recent];

  // Estimates — active = needs producer approval/rejection
  const estimatesActive = all.filter((r) => r.status === "Estimate Submitted");
  const estimatesPast   = all.filter((r) => ["Estimate Approved", "Rejected"].includes(r.status));

  // Purchase Orders — active = producer needs to upload PO; past = PO in flight or complete
  const poActive = all.filter((r) => r.status === "Estimate Approved");
  const poPast   = all.filter((r) => ["PO Uploaded", "PO Signed", "Shoot Complete", "Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(r.status));

  // Invoices — active = producer needs to pre-approve; past = sent to finance or done
  const invoicesActive = all.filter((r) => r.status === "Invoice Submitted");
  const invoicesPast   = all.filter((r) => ["Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(r.status));

  function handleStatusChange() {
    Promise.all([mutatePending(), mutateRecent()]).then(([updatedPending]) => {
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

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Estimates & Invoices</h1>
        <p className="text-sm text-text-secondary mt-1">
          Documents across all campaigns.
        </p>
      </div>

      {loadingPending ? (
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
                <EmptyState title="No active estimates" description="Submitted estimates will appear here." />
              ) : (
                <div className="divide-y divide-border">
                  {estimatesActive.map((row) => (
                    <DocRow key={row.id} row={row} onOpen={() => setManagingRow(row)} />
                  ))}
                </div>
              )
            ) : (
              estimatesPast.length === 0 ? (
                <EmptyState title="No past estimates" description="Approved estimates will appear here." />
              ) : (
                <div className="bg-surface-secondary rounded-b-xl divide-y divide-border">
                  {estimatesPast.map((row) => (
                    <DocRow key={row.id} row={row} onOpen={() => setManagingRow(row)} />
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
                <EmptyState title="No active POs" description="Campaigns awaiting PO upload or signature will appear here." />
              ) : (
                <div className="divide-y divide-border">
                  {poActive.map((row) => (
                    <DocRow key={row.id} row={row} onOpen={() => setManagingRow(row)} />
                  ))}
                </div>
              )
            ) : (
              poPast.length === 0 ? (
                <EmptyState title="No past POs" description="POs from completed campaigns will appear here." />
              ) : (
                <div className="bg-surface-secondary rounded-b-xl divide-y divide-border">
                  {poPast.map((row) => (
                    <DocRow key={row.id} row={row} onOpen={() => setManagingRow(row)} />
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
                <EmptyState title="No active invoices" description="Submitted invoices will appear here." />
              ) : (
                <div className="divide-y divide-border">
                  {invoicesActive.map((row) => (
                    <DocRow key={row.id} row={row} onOpen={() => setManagingRow(row)} />
                  ))}
                </div>
              )
            ) : (
              invoicesPast.length === 0 ? (
                <EmptyState title="No past invoices" description="Approved and paid invoices will appear here." />
              ) : (
                <div className="bg-surface-secondary rounded-b-xl divide-y divide-border">
                  {invoicesPast.map((row) => (
                    <DocRow key={row.id} row={row} onOpen={() => setManagingRow(row)} />
                  ))}
                </div>
              )
            )}
          </Card>

        </div>
      )}

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

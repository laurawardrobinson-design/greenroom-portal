"use client";

import { useState } from "react";
import useSWR from "swr";
import type { CampaignVendor } from "@/types/domain";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { VendorLifecycleModal } from "@/components/campaigns/vendor-lifecycle-modal";
import {
  ShieldCheck, DollarSign, FileText, Check, X, HardHat, Banknote,
  Package, Download, Send, CheckCircle2, ChevronDown, ChevronRight,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); });

interface ApprovalData {
  budgetRequests: Array<{
    id: string;
    campaignId: string;
    amount: number;
    rationale: string;
    status: string;
    createdAt: string;
    campaign?: { name: string; wfNumber: string };
    requester?: { name: string };
  }>;
  pendingInvoices: Array<{
    id: string;
    campaignId: string;
    vendorName: string;
    campaignName: string;
    wfNumber: string;
    estimateTotal: number;
    invoiceTotal: number;
    updatedAt: string;
  }>;
  pendingCrewBookings: Array<{
    id: string;
    campaignId: string;
    personName: string;
    campaignName: string;
    wfNumber: string;
    role: string;
    dayRate: number;
    classification: string;
    plannedDays: number;
    totalAmount: number;
    createdAt: string;
  }>;
  pendingCrewPayments: Array<{
    id: string;
    bookingId: string;
    campaignId: string;
    personName: string;
    role: string;
    campaignName: string;
    wfNumber: string;
    totalDays: number;
    totalAmount: number;
    status: string;
    confirmedAt: string | null;
    createdAt: string;
  }>;
}

interface UnbatchedPayment {
  id: string;
  personName: string;
  role: string;
  campaignName: string;
  wfNumber: string;
  campaignId: string;
  totalDays: number;
  totalAmount: number;
  dayRate: number;
  classification: string;
  approvedAt: string | null;
}

interface PaymentBatch {
  id: string;
  name: string;
  status: "Draft" | "Sent" | "Confirmed";
  totalAmount: number;
  itemCount: number;
  sentAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

const BATCH_STATUS_STYLE: Record<string, string> = {
  Draft:     "text-amber-700 bg-amber-50",
  Sent:      "text-blue-700 bg-blue-50",
  Confirmed: "text-emerald-700 bg-emerald-50",
};

export default function ApprovalsPage() {
  const { toast } = useToast();
  const { data, mutate } = useSWR<ApprovalData>("/api/approvals", fetcher);
  const { data: unbatched = [], mutate: mutateUnbatched } = useSWR<UnbatchedPayment[]>(
    "/api/payment-batches?unbatched=true",
    fetcher
  );
  const { data: batches = [], mutate: mutateBatches } = useSWR<PaymentBatch[]>(
    "/api/payment-batches",
    fetcher
  );

  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ cv: CampaignVendor; wfNumber: string } | null>(null);
  const [loadingReview, setLoadingReview] = useState<string | null>(null);

  async function openInvoiceReview(cvId: string, wfNumber: string) {
    setLoadingReview(cvId);
    try {
      const res = await fetch(`/api/campaign-vendors/${cvId}`);
      if (!res.ok) throw new Error("Failed to load");
      const cv = await res.json();
      setReviewModal({ cv, wfNumber });
    } catch {
      toast("error", "Failed to load invoice details");
    } finally {
      setLoadingReview(null);
    }
  }

  const budgetRequests = data?.budgetRequests || [];
  const pendingInvoices = data?.pendingInvoices || [];
  const pendingCrewBookings = data?.pendingCrewBookings || [];
  const pendingCrewPayments = data?.pendingCrewPayments || [];
  const totalPending = budgetRequests.length + pendingInvoices.length + pendingCrewBookings.length + pendingCrewPayments.length;

  async function handleBudgetDecision(id: string, approved: boolean) {
    try {
      await fetch(`/api/budget/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, notes: "" }),
      });
      toast("success", approved ? "Budget request approved" : "Budget request declined");
      mutate();
    } catch {
      toast("error", "Failed to process request");
    }
  }

  async function handleCrewBookingApproval(bookingId: string, approve: boolean) {
    try {
      await fetch(`/api/crew-bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: approve ? "approve" : "cancel" }),
      });
      toast("success", approve ? "Crew booking approved" : "Crew booking declined");
      mutate();
    } catch {
      toast("error", "Failed to process crew booking");
    }
  }

  async function handleCrewPaymentApproval(paymentId: string) {
    try {
      await fetch(`/api/crew-payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      toast("success", "Crew payment approved — ready to batch");
      mutate();
      mutateUnbatched();
    } catch {
      toast("error", "Failed to approve crew payment");
    }
  }

  async function handleInvoiceApproval(cvId: string) {
    try {
      await fetch(`/api/campaign-vendors/${cvId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", targetStatus: "Invoice Approved" }),
      });
      toast("success", "Invoice approved");
      mutate();
    } catch {
      toast("error", "Failed to approve invoice");
    }
  }

  async function handleCreateBatch() {
    setCreatingBatch(true);
    try {
      const res = await fetch("/api/payment-batches", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create batch");
      }
      toast("success", "Paymaster batch created");
      mutateUnbatched();
      mutateBatches();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setCreatingBatch(false);
    }
  }

  async function handleBatchAction(batchId: string, action: "mark_sent" | "mark_confirmed") {
    try {
      await fetch(`/api/payment-batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      toast("success", action === "mark_sent" ? "Batch marked as sent" : "Payments confirmed as paid");
      mutateBatches();
    } catch {
      toast("error", "Failed to update batch");
    }
  }

  function handleDownloadCSV(batchId: string, batchName: string) {
    const a = document.createElement("a");
    a.href = `/api/payment-batches/${batchId}`;
    // We'll use a fetch + blob approach for the PATCH/download
    fetch(`/api/payment-batches/${batchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "download_csv" }),
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${batchName.replace(/\s+/g, "-").toLowerCase()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast("error", "Failed to download CSV"));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Approvals</h2>
        <p className="text-sm text-text-secondary">
          {totalPending} item{totalPending !== 1 ? "s" : ""} pending your review
        </p>
      </div>

      {/* Budget Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-text-tertiary" />
            Budget Requests
            {budgetRequests.length > 0 && (
              <Badge variant="warning">{budgetRequests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>

        {budgetRequests.length === 0 ? (
          <EmptyState title="No pending requests" description="Budget and overage requests will appear here." />
        ) : (
          <div className="space-y-2">
            {budgetRequests.map((req) => (
              <div key={req.id} className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-4">
                <div className="min-w-0 w-48 shrink-0">
                  <Link href={`/campaigns/${req.campaignId}`} className="text-sm font-semibold text-text-primary hover:text-primary truncate block">
                    {req.campaign?.name || "Unknown Campaign"}
                  </Link>
                  <p className="text-xs text-text-tertiary truncate">{req.campaign?.wfNumber} — {req.requester?.name || "Unknown"}</p>
                </div>
                <p className="text-xs text-text-secondary truncate flex-1">{req.rationale}</p>
                <span className="shrink-0 text-sm font-semibold text-text-primary">{formatCurrency(req.amount)}</span>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleBudgetDecision(req.id, false)}>
                    <X className="h-3.5 w-3.5" />Decline
                  </Button>
                  <Button size="sm" onClick={() => handleBudgetDecision(req.id, true)}>
                    <Check className="h-3.5 w-3.5" />Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-text-tertiary" />
            Invoice Approvals
            {pendingInvoices.length > 0 && (
              <Badge variant="warning">{pendingInvoices.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>

        {pendingInvoices.length === 0 ? (
          <EmptyState title="No pending invoices" description="Pre-approved invoices awaiting your final sign-off will appear here." />
        ) : (
          <div className="space-y-2">
            {pendingInvoices.map((inv) => (
              <div key={inv.id} className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-4">
                <div className="min-w-0 w-48 shrink-0">
                  <Link href={`/campaigns/${inv.campaignId}`} className="text-sm font-semibold text-text-primary hover:text-primary truncate block">
                    {inv.campaignName}
                  </Link>
                  <p className="text-xs text-text-tertiary truncate">{inv.wfNumber} — {inv.vendorName}</p>
                </div>
                <div className="flex gap-4 text-xs flex-1">
                  <span className="text-text-tertiary">Est: <span className="font-medium text-text-primary">{formatCurrency(inv.estimateTotal)}</span></span>
                  <span className="text-text-tertiary">Inv: <span className="font-medium text-text-primary">{formatCurrency(inv.invoiceTotal)}</span></span>
                  {inv.invoiceTotal > inv.estimateTotal && <Badge variant="error">Over estimate</Badge>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={loadingReview === inv.id}
                    onClick={() => openInvoiceReview(inv.id, inv.wfNumber)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Review
                  </Button>
                  <Button size="sm" onClick={() => handleInvoiceApproval(inv.id)}>
                    <Check className="h-3.5 w-3.5" />Final Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Crew Payment Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-text-tertiary" />
            Crew Payments
            {pendingCrewPayments.length > 0 && (
              <Badge variant="warning">{pendingCrewPayments.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>

        {pendingCrewPayments.length === 0 ? (
          <EmptyState
            title="No pending crew payments"
            description="When a Producer submits confirmed days for payment, they appear here for your approval."
          />
        ) : (
          <div className="space-y-2">
            {pendingCrewPayments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-4">
                <div className="min-w-0 w-48 shrink-0">
                  <Link href={`/campaigns/${payment.campaignId}`} className="text-sm font-semibold text-text-primary hover:text-primary truncate block">
                    {payment.campaignName}
                  </Link>
                  <p className="text-xs text-text-tertiary truncate">{payment.wfNumber} — {payment.personName}</p>
                </div>
                <div className="flex gap-4 text-xs flex-1">
                  <span className="text-text-tertiary">Role: <span className="font-medium text-text-primary">{payment.role}</span></span>
                  <span className="text-text-tertiary">Days: <span className="font-medium text-text-primary">{payment.totalDays}</span></span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-text-primary">{formatCurrency(payment.totalAmount)}</span>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleCrewPaymentApproval(payment.id)}>
                    <Check className="h-3.5 w-3.5" />Approve for Paymaster
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Paymaster Batches */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-text-tertiary" />
              Paymaster Batches
              {unbatched.length > 0 && (
                <Badge variant="warning">{unbatched.length} ready</Badge>
              )}
            </CardTitle>
            {unbatched.length > 0 && (
              <Button size="sm" onClick={handleCreateBatch} disabled={creatingBatch}>
                <Send className="h-3.5 w-3.5" />
                {creatingBatch ? "Creating…" : "Create Batch"}
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Approved-but-unbatched payments */}
        {unbatched.length > 0 && (
          <div className="mb-4">
            <p className="px-3.5 pb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Ready to Batch ({unbatched.length})
            </p>
            <div className="divide-y divide-border border-t border-border">
              {unbatched.map((p) => (
                <div key={p.id} className="grid grid-cols-12 gap-3 items-center px-3.5 py-2.5">
                  <div className="col-span-3">
                    <p className="text-sm font-medium text-text-primary">{p.personName}</p>
                    <p className="text-[10px] text-text-tertiary">{p.classification}</p>
                  </div>
                  <div className="col-span-3">
                    <Link href={`/campaigns/${p.campaignId}`} className="text-xs text-text-secondary hover:text-primary">
                      {p.wfNumber}
                    </Link>
                    <p className="text-[10px] text-text-tertiary truncate">{p.campaignName}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-xs text-text-primary">{p.role}</p>
                    <p className="text-[10px] text-text-tertiary">{p.totalDays}d × {formatCurrency(p.dayRate)}</p>
                  </div>
                  <div className="col-span-3 text-right">
                    <p className="text-sm font-semibold text-text-primary">{formatCurrency(p.totalAmount)}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface-secondary">
                <p className="text-xs font-semibold text-text-primary">Batch total</p>
                <p className="text-sm font-bold text-text-primary">
                  {formatCurrency(unbatched.reduce((s, p) => s + p.totalAmount, 0))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Existing batches */}
        {batches.length === 0 && unbatched.length === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title="No paymaster batches yet"
            description="Once crew payments are approved, create a batch to release them to the paymaster."
          />
        ) : batches.length > 0 ? (
          <div className="divide-y divide-border border-t border-border">
            {batches.map((batch) => (
              <div key={batch.id}>
                <button
                  type="button"
                  onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-secondary transition-colors"
                >
                  {expandedBatch === batch.id
                    ? <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{batch.name}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {batch.itemCount} payment{batch.itemCount !== 1 ? "s" : ""} · {new Date(batch.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${BATCH_STATUS_STYLE[batch.status]}`}>
                    {batch.status}
                  </span>
                  <span className="text-sm font-semibold text-text-primary ml-2 shrink-0">
                    {formatCurrency(batch.totalAmount)}
                  </span>
                </button>

                {expandedBatch === batch.id && (
                  <div className="border-t border-border bg-surface-secondary px-3.5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadCSV(batch.id, batch.name)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download CSV
                      </Button>
                      {batch.status === "Draft" && (
                        <Button
                          size="sm"
                          onClick={() => handleBatchAction(batch.id, "mark_sent")}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Mark as Sent to Paymaster
                        </Button>
                      )}
                      {batch.status === "Sent" && (
                        <Button
                          size="sm"
                          onClick={() => handleBatchAction(batch.id, "mark_confirmed")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirm Paid
                        </Button>
                      )}
                      {batch.status === "Confirmed" && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Payments confirmed{batch.confirmedAt ? ` · ${new Date(batch.confirmedAt).toLocaleDateString()}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Rate Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardHat className="h-4 w-4 text-text-tertiary" />
            Rate Approvals
            {pendingCrewBookings.length > 0 && (
              <Badge variant="warning">{pendingCrewBookings.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>

        {pendingCrewBookings.length === 0 ? (
          <EmptyState title="No pending rate approvals" description="Crew bookings that exceed the standard rate card will appear here for approval." />
        ) : (
          <div className="space-y-2">
            {pendingCrewBookings.map((booking) => (
              <div key={booking.id} className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-4">
                <div className="min-w-0 w-48 shrink-0">
                  <Link href={`/campaigns/${booking.campaignId}`} className="text-sm font-semibold text-text-primary hover:text-primary truncate block">
                    {booking.campaignName}
                  </Link>
                  <p className="text-xs text-text-tertiary truncate">{booking.wfNumber} — {booking.personName}</p>
                </div>
                <div className="flex gap-4 text-xs flex-1">
                  <span className="text-text-tertiary">Role: <span className="font-medium text-text-primary">{booking.role}</span></span>
                  <span className="text-text-tertiary">Rate: <span className="font-medium text-text-primary">{formatCurrency(booking.dayRate)}/day</span></span>
                  <span className="text-text-tertiary">Days: <span className="font-medium text-text-primary">{booking.plannedDays}</span></span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-text-primary">{formatCurrency(booking.totalAmount)}</span>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleCrewBookingApproval(booking.id, false)}>
                    <X className="h-3.5 w-3.5" />Decline
                  </Button>
                  <Button size="sm" onClick={() => handleCrewBookingApproval(booking.id, true)}>
                    <Check className="h-3.5 w-3.5" />Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Invoice review modal */}
      {reviewModal && (
        <VendorLifecycleModal
          open={!!reviewModal}
          onClose={() => setReviewModal(null)}
          campaignVendor={reviewModal.cv}
          campaignId={reviewModal.cv.campaignId}
          wfNumber={reviewModal.wfNumber}
          onStatusChange={() => { mutate(); setReviewModal(null); }}
        />
      )}
    </div>
  );
}

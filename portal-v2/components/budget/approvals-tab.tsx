"use client";

import { useState } from "react";
import useSWR from "swr";
import type { CampaignVendor } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { VendorLifecycleModal } from "@/components/campaigns/vendor-lifecycle-modal";
import {
  DollarSign, FileText, Check, X, HardHat, Banknote,
  Download, Send, CheckCircle2, ChevronDown, ChevronRight,
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
    status: string;
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
    status: string;
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
  resolvedRequests: Array<{
    id: string;
    campaignId: string;
    amount: number;
    rationale: string;
    status: string;
    createdAt: string;
    campaign?: { name: string; wfNumber: string };
    requester?: { name: string };
  }>;
  resolvedInvoices: Array<{
    id: string;
    campaignId: string;
    vendorName: string;
    campaignName: string;
    wfNumber: string;
    estimateTotal: number;
    invoiceTotal: number;
    status: string;
    updatedAt: string;
  }>;
  resolvedCrewBookings: Array<{
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
    status: string;
    createdAt: string;
  }>;
  resolvedCrewPayments: Array<{
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
  Draft:     "text-warning bg-amber-50",
  Sent:      "text-blue-700 bg-blue-50",
  Confirmed: "text-success bg-emerald-50",
};

function SectionTabs({ active, onChange }: {
  active: "pending" | "history";
  onChange: (tab: "pending" | "history") => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-md bg-surface-secondary p-0.5">
      <button
        type="button"
        onClick={() => onChange("pending")}
        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          active === "pending"
            ? "bg-white text-text-primary shadow-sm"
            : "text-text-tertiary hover:text-text-secondary"
        }`}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => onChange("history")}
        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
          active === "history"
            ? "bg-white text-text-primary shadow-sm"
            : "text-text-tertiary hover:text-text-secondary"
        }`}
      >
        Past
      </button>
    </div>
  );
}

export function ApprovalsTab() {
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

  const [budgetTab, setBudgetTab] = useState<"pending" | "history">("pending");
  const [invoiceTab, setInvoiceTab] = useState<"pending" | "history">("pending");
  const [crewPaymentTab, setCrewPaymentTab] = useState<"pending" | "history">("pending");
  const [rateTab, setRateTab] = useState<"pending" | "history">("pending");

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
  const resolvedRequests = data?.resolvedRequests || [];
  const resolvedInvoices = data?.resolvedInvoices || [];
  const resolvedCrewBookings = data?.resolvedCrewBookings || [];
  const resolvedCrewPayments = data?.resolvedCrewPayments || [];

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
    <div className="space-y-[18px]">
      {/* Budget Requests */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
          <DollarSign className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Budget Requests</span>
          <div className="ml-auto"><SectionTabs active={budgetTab} onChange={setBudgetTab} /></div>
        </div>

        {budgetTab === "pending" ? (
          budgetRequests.length === 0 ? (
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
                    <Button size="sm" variant="secondary" onClick={() => handleBudgetDecision(req.id, false)}>
                      <X className="h-3.5 w-3.5" />Decline
                    </Button>
                    <Button size="sm" onClick={() => handleBudgetDecision(req.id, true)}>
                      <Check className="h-3.5 w-3.5" />Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          resolvedRequests.length === 0 ? (
            <EmptyState title="No past requests" description="Approved and declined budget requests will appear here." />
          ) : (
            <div className="bg-surface-secondary rounded-b-xl px-3.5 pt-3 pb-3 space-y-2">
              {resolvedRequests.map((req) => (
                <div key={req.id} className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-4">
                  <div className="min-w-0 w-48 shrink-0">
                    <Link href={`/campaigns/${req.campaignId}`} className="text-sm font-semibold text-text-primary hover:text-primary truncate block">
                      {req.campaign?.name || "Unknown Campaign"}
                    </Link>
                    <p className="text-xs text-text-tertiary truncate">{req.campaign?.wfNumber} — {req.requester?.name || "Unknown"}</p>
                  </div>
                  <p className="text-xs text-text-secondary truncate flex-1">{req.rationale}</p>
                  <span className="shrink-0 text-sm font-semibold text-text-primary">{formatCurrency(req.amount)}</span>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    req.status === "Approved" ? "bg-emerald-50 text-success" : "bg-red-50 text-error"
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </Card>

      {/* Pending Invoices */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Invoice Approvals</span>
          <div className="ml-auto"><SectionTabs active={invoiceTab} onChange={setInvoiceTab} /></div>
        </div>

        {invoiceTab === "pending" ? (
          pendingInvoices.length === 0 ? (
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
                    <span className="text-text-tertiary">Inv: <span className={`font-medium ${inv.invoiceTotal > inv.estimateTotal ? "text-error" : "text-text-primary"}`}>{formatCurrency(inv.invoiceTotal)}</span></span>
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
                      <Check className="h-3.5 w-3.5" />Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          resolvedInvoices.length === 0 ? (
            <EmptyState title="No past invoices" description="Approved and paid invoices will appear here." />
          ) : (
            <div className="bg-surface-secondary rounded-b-xl px-3.5 pt-3 pb-3 space-y-2">
              {resolvedInvoices.map((inv) => (
                <div key={inv.id} className="rounded-lg border border-border px-3.5 py-2.5 flex items-center gap-4">
                  <div className="min-w-0 w-48 shrink-0">
                    <Link href={`/campaigns/${inv.campaignId}`} className="text-sm font-semibold text-text-primary hover:text-primary truncate block">
                      {inv.campaignName}
                    </Link>
                    <p className="text-xs text-text-tertiary truncate">{inv.wfNumber} — {inv.vendorName}</p>
                  </div>
                  <div className="flex gap-4 text-xs flex-1">
                    <span className="text-text-tertiary">Est: <span className="font-medium text-text-primary">{formatCurrency(inv.estimateTotal)}</span></span>
                    <span className="text-text-tertiary">Inv: <span className={`font-medium ${inv.invoiceTotal > inv.estimateTotal ? "text-error" : "text-text-primary"}`}>{formatCurrency(inv.invoiceTotal)}</span></span>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    inv.status === "Paid" ? "bg-emerald-50 text-success" : "bg-blue-50 text-blue-700"
                  }`}>
                    {inv.status}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={loadingReview === inv.id}
                    onClick={() => openInvoiceReview(inv.id, inv.wfNumber)}
                  >
                    <FileText className="h-3.5 w-3.5" />Review
                  </Button>
                </div>
              ))}
            </div>
          )
        )}
      </Card>

      {/* Crew Payments (approvals + paymaster batches merged) */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
          <Banknote className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Crew Payments</span>
          <div className="ml-auto"><SectionTabs active={crewPaymentTab} onChange={setCrewPaymentTab} /></div>
        </div>

        {crewPaymentTab === "pending" ? (
          pendingCrewPayments.length === 0 && unbatched.length === 0 ? (
            <EmptyState
              title="No pending crew payments"
              description="When a Producer submits confirmed days for payment, they appear here for your approval."
            />
          ) : (
            <div>
              {/* Pending approvals */}
              {pendingCrewPayments.length > 0 && (
                <div className="space-y-2 mb-4">
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
                      <Button size="sm" onClick={() => handleCrewPaymentApproval(payment.id)}>
                        <Check className="h-3.5 w-3.5" />Approve
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Ready to batch */}
              {unbatched.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary px-0.5 pb-2">
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
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface-secondary rounded-b-xl">
                      <p className="text-xs font-semibold text-text-primary">Batch total</p>
                      <div className="flex items-center gap-2 ml-auto">
                        <Button size="sm" variant="secondary" onClick={handleCreateBatch} disabled={creatingBatch}>
                          <Send className="h-3.5 w-3.5" />
                          {creatingBatch ? "Creating…" : "Batch"}
                        </Button>
                        <p className="text-sm font-bold text-text-primary">
                          {formatCurrency(unbatched.reduce((s, p) => s + p.totalAmount, 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          batches.length === 0 ? (
            <EmptyState
              title="No paymaster batches yet"
              description="Once crew payments are approved, create a batch to release them to the paymaster."
            />
          ) : (
            <div className="bg-surface-secondary -mx-5 -mb-5 rounded-b-xl divide-y divide-border">
              {batches.map((batch) => (
                <div key={batch.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-hover transition-colors rounded-t-xl"
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
                    <div className="border-t border-border bg-white px-3.5 py-3">
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
                          <span className="inline-flex items-center gap-1.5 text-xs text-success">
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
          )
        )}
      </Card>

      {/* Rate Approvals */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
          <HardHat className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Rate Approvals</span>
          <div className="ml-auto"><SectionTabs active={rateTab} onChange={setRateTab} /></div>
        </div>

        {rateTab === "pending" ? (
          pendingCrewBookings.length === 0 ? (
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
                    <Button size="sm" variant="secondary" onClick={() => handleCrewBookingApproval(booking.id, false)}>
                      <X className="h-3.5 w-3.5" />Decline
                    </Button>
                    <Button size="sm" onClick={() => handleCrewBookingApproval(booking.id, true)}>
                      <Check className="h-3.5 w-3.5" />Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          resolvedCrewBookings.length === 0 ? (
            <EmptyState title="No past rate approvals" description="Approved and declined crew rate requests will appear here." />
          ) : (
            <div className="bg-surface-secondary rounded-b-xl px-3.5 pt-3 pb-3 space-y-2">
              {resolvedCrewBookings.map((booking) => (
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
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    booking.status === "Cancelled" ? "bg-red-50 text-error" : "bg-emerald-50 text-success"
                  }`}>
                    {booking.status === "Cancelled" ? "Declined" : "Approved"}
                  </span>
                </div>
              ))}
            </div>
          )
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
          onStatusChange={() => { mutate(); }}
        />
      )}
    </div>
  );
}

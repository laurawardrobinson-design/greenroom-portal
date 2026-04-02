"use client";

import useSWR from "swr";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { ShieldCheck, DollarSign, FileText, Check, X } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const { data, mutate } = useSWR<ApprovalData>("/api/approvals", fetcher);

  const budgetRequests = data?.budgetRequests || [];
  const pendingInvoices = data?.pendingInvoices || [];
  const totalPending = budgetRequests.length + pendingInvoices.length;

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

  return (
    <div className="space-y-6">
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
          <div className="space-y-3">
            {budgetRequests.map((req) => (
              <div key={req.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <Link
                      href={`/campaigns/${req.campaignId}`}
                      className="text-sm font-semibold text-text-primary hover:text-primary"
                    >
                      {req.campaign?.name || "Unknown Campaign"}
                    </Link>
                    <p className="text-xs text-text-tertiary">
                      {req.campaign?.wfNumber} — requested by {req.requester?.name || "Unknown"}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(req.amount)}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mb-3">{req.rationale}</p>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBudgetDecision(req.id, false)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleBudgetDecision(req.id, true)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
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
          <div className="space-y-3">
            {pendingInvoices.map((inv) => (
              <div key={inv.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <Link
                      href={`/campaigns/${inv.campaignId}`}
                      className="text-sm font-semibold text-text-primary hover:text-primary"
                    >
                      {inv.campaignName}
                    </Link>
                    <p className="text-xs text-text-tertiary">
                      {inv.wfNumber} — {inv.vendorName}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs mb-3">
                  <span className="text-text-tertiary">
                    Estimate: <span className="font-medium text-text-primary">{formatCurrency(inv.estimateTotal)}</span>
                  </span>
                  <span className="text-text-tertiary">
                    Invoice: <span className="font-medium text-text-primary">{formatCurrency(inv.invoiceTotal)}</span>
                  </span>
                  {inv.invoiceTotal > inv.estimateTotal && (
                    <Badge variant="error">Over estimate</Badge>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" onClick={() => handleInvoiceApproval(inv.id)}>
                    <Check className="h-3.5 w-3.5" />
                    Final Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

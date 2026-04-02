"use client";

import useSWR from "swr";
import type { AppUser } from "@/types/domain";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import {
  DollarSign,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Check,
  X,
  FileText,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  user: AppUser;
}

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

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string; value: string; icon: React.ElementType; accent: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Card>
  );
}

export function HopDashboard({ user }: Props) {
  const { toast } = useToast();
  const { data: stats, mutate: mutateStats } = useSWR("/api/dashboard", fetcher);
  const { data: approvals, mutate: mutateApprovals } = useSWR<ApprovalData>("/api/approvals", fetcher);

  const budgetRequests = approvals?.budgetRequests || [];
  const pendingInvoices = approvals?.pendingInvoices || [];
  const totalPending = budgetRequests.length + pendingInvoices.length;

  async function handleBudgetDecision(id: string, approved: boolean) {
    try {
      await fetch(`/api/budget/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, notes: "" }),
      });
      toast("success", approved ? "Budget request approved" : "Budget request declined");
      mutateApprovals();
      mutateStats();
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
      mutateApprovals();
      mutateStats();
    } catch {
      toast("error", "Failed to approve invoice");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          Welcome back, {user.name.split(" ")[0]}
        </h2>
        <p className="text-sm text-text-secondary">
          Here&apos;s your production overview
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Budget"
          value={stats ? formatCurrency(stats.totalBudget) : "—"}
          icon={DollarSign}
          accent="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Committed"
          value={stats ? formatCurrency(stats.committed) : "—"}
          icon={TrendingUp}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Pending Approvals"
          value={stats ? String(stats.pendingApprovals) : "—"}
          icon={AlertTriangle}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Shoots This Week"
          value={stats ? String(stats.shootsThisWeek) : "—"}
          icon={Calendar}
          accent="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Approvals — inline actionable cards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Approvals
              {totalPending > 0 && (
                <Badge variant="warning">{totalPending}</Badge>
              )}
            </CardTitle>
            <Link href="/approvals">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </CardHeader>

          {totalPending === 0 ? (
            <EmptyState
              title="No pending approvals"
              description="Budget requests, overages, and invoices that need your review will appear here."
            />
          ) : (
            <div className="space-y-4">
              {/* Budget Requests */}
              {budgetRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    <DollarSign className="h-3.5 w-3.5" />
                    Budget Requests
                  </p>
                  {budgetRequests.map((req) => (
                    <div key={req.id} className="rounded-lg border border-border p-3.5">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="min-w-0">
                          <Link
                            href={`/campaigns/${req.campaignId}`}
                            className="text-sm font-semibold text-text-primary hover:text-primary transition-colors"
                          >
                            {req.campaign?.name || "Unknown Campaign"}
                          </Link>
                          <p className="text-xs text-text-tertiary">
                            {req.campaign?.wfNumber} — requested by {req.requester?.name || "Unknown"}
                          </p>
                        </div>
                        <span className="shrink-0 text-lg font-semibold text-text-primary">
                          {formatCurrency(req.amount)}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary mb-3 line-clamp-2">{req.rationale}</p>
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

              {/* Invoice Approvals */}
              {pendingInvoices.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    <FileText className="h-3.5 w-3.5" />
                    Invoice Approvals
                  </p>
                  {pendingInvoices.map((inv) => (
                    <div key={inv.id} className="rounded-lg border border-border p-3.5">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="min-w-0">
                          <Link
                            href={`/campaigns/${inv.campaignId}`}
                            className="text-sm font-semibold text-text-primary hover:text-primary transition-colors"
                          >
                            {inv.campaignName}
                          </Link>
                          <p className="text-xs text-text-tertiary">
                            {inv.wfNumber} — {inv.vendorName}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs mb-3">
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
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Shoots</CardTitle>
            <Link href="/calendar">
              <Button variant="ghost" size="sm">View calendar</Button>
            </Link>
          </CardHeader>
          {stats?.shootsThisWeek > 0 ? (
            <p className="text-sm text-text-secondary">
              {stats.shootsThisWeek} shoot{stats.shootsThisWeek !== 1 ? "s" : ""} scheduled this week.
            </p>
          ) : (
            <EmptyState
              title="No upcoming shoots"
              description="Scheduled shoot days across all campaigns will appear here."
            />
          )}
        </Card>
      </div>
    </div>
  );
}

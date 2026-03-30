"use client";

import { useState } from "react";
import useSWR from "swr";
import type { BudgetPoolSummary } from "@/types/domain";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Plus,
  DollarSign,
  ShieldCheck,
  FileText,
  Check,
  X,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

type Tab = "overview" | "approvals" | "spending";

const TABS: { key: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: "overview", label: "Budget Pools", icon: DollarSign },
  { key: "approvals", label: "Approvals", icon: ShieldCheck, adminOnly: true },
  { key: "spending", label: "Spending", icon: BarChart3 },
];

export default function BudgetPage() {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("overview");
  const isAdmin = user?.role === "Admin";

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Budget</h2>
        <p className="text-sm text-text-secondary">
          Production budget pools, approvals, and spending analysis
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <BudgetPoolsTab isAdmin={isAdmin} />}
      {tab === "approvals" && isAdmin && <ApprovalsTab />}
      {tab === "spending" && <SpendingTab />}
    </div>
  );
}

// ─── Budget Pools Tab ───
function BudgetPoolsTab({ isAdmin }: { isAdmin: boolean }) {
  const { data: rawPools, mutate } = useSWR<BudgetPoolSummary[]>("/api/budget", fetcher);
  const pools: BudgetPoolSummary[] = Array.isArray(rawPools) ? rawPools : [];
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {pools.length} pool{pools.length !== 1 ? "s" : ""}
        </p>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Pool
          </Button>
        )}
      </div>

      {pools.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-5 w-5" />}
          title="No budget pools"
          description="Create a budget pool for a fiscal period to start tracking production spending."
          action={
            isAdmin ? (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" />
                New Pool
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {pools.map((pool) => {
            const pctUsed =
              pool.totalAmount > 0
                ? Math.round((pool.allocated / pool.totalAmount) * 100)
                : 0;

            return (
              <Card key={pool.id}>
                <CardHeader>
                  <CardTitle>{pool.name}</CardTitle>
                </CardHeader>
                <p className="text-xs text-text-tertiary mb-4">
                  {pool.periodStart} — {pool.periodEnd}
                </p>
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-text-secondary">
                      {formatCurrency(pool.allocated)} allocated
                    </span>
                    <span className="text-text-tertiary">
                      {formatCurrency(pool.totalAmount)} total
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(pctUsed, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      Allocated
                    </p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatCurrency(pool.allocated)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      Remaining
                    </p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(pool.remaining)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      Used
                    </p>
                    <p className="text-sm font-semibold text-text-primary">{pctUsed}%</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AddPoolModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          mutate();
          setShowAdd(false);
        }}
      />
    </>
  );
}

// ─── Approvals Tab ───
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

function ApprovalsTab() {
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
      toast(
        "success",
        approved ? "Budget request approved" : "Budget request declined"
      );
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
        body: JSON.stringify({
          action: "transition",
          targetStatus: "Invoice Approved",
        }),
      });
      toast("success", "Invoice approved");
      mutate();
    } catch {
      toast("error", "Failed to approve invoice");
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary">
        {totalPending} item{totalPending !== 1 ? "s" : ""} pending your review
      </p>

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
          <EmptyState
            title="No pending requests"
            description="Budget and overage requests will appear here."
          />
        ) : (
          <div className="space-y-3">
            {budgetRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <Link
                      href={`/campaigns/${req.campaignId}`}
                      className="text-sm font-semibold text-text-primary hover:text-primary"
                    >
                      {req.campaign?.name || "Unknown Campaign"}
                    </Link>
                    <p className="text-xs text-text-tertiary">
                      {req.campaign?.wfNumber} — requested by{" "}
                      {req.requester?.name || "Unknown"}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(req.amount)}
                  </span>
                </div>
                <p className="text-sm text-text-secondary mb-3">
                  {req.rationale}
                </p>
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
          <EmptyState
            title="No pending invoices"
            description="Pre-approved invoices awaiting your final sign-off will appear here."
          />
        ) : (
          <div className="space-y-3">
            {pendingInvoices.map((inv) => (
              <div
                key={inv.id}
                className="rounded-lg border border-border p-4"
              >
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
                    Estimate:{" "}
                    <span className="font-medium text-text-primary">
                      {formatCurrency(inv.estimateTotal)}
                    </span>
                  </span>
                  <span className="text-text-tertiary">
                    Invoice:{" "}
                    <span className="font-medium text-text-primary">
                      {formatCurrency(inv.invoiceTotal)}
                    </span>
                  </span>
                  {inv.invoiceTotal > inv.estimateTotal && (
                    <Badge variant="error">Over estimate</Badge>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleInvoiceApproval(inv.id)}
                  >
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

// ─── Spending Tab ───
function SpendingTab() {
  const { data: spending, isLoading } = useSWR<
    Array<{ category: string; total: number }>
  >("/api/budget?type=spending", fetcher);

  const CATEGORY_COLORS: Record<string, string> = {
    Talent: "#6366f1",
    Styling: "#ec4899",
    "Equipment Rental": "#f59e0b",
    "Studio Space": "#10b981",
    "Post-Production": "#8b5cf6",
    Travel: "#06b6d4",
    Catering: "#f97316",
    Props: "#84cc16",
    Wardrobe: "#14b8a6",
    "Set Design": "#a855f7",
    Other: "#94a3b8",
  };

  const hasData = spending && spending.length > 0;
  const totalSpent = hasData ? spending.reduce((s, c) => s + c.total, 0) : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {hasData && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Total Spent
            </p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {formatCurrency(totalSpent)}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Categories
            </p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {spending.length}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Largest Category
            </p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {spending[0]?.category || "—"}
            </p>
          </Card>
          <Card>
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Largest Amount
            </p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {spending[0] ? formatCurrency(spending[0].total) : "—"}
            </p>
          </Card>
        </div>
      )}

      {/* Category breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-text-tertiary" />
            Spending by Category
          </CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-lg bg-surface-secondary" />
        ) : !hasData ? (
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="No spending data yet"
            description="Category spending will appear here as vendor estimates are approved and invoices are processed."
          />
        ) : (
          <div className="space-y-3">
            {spending.map((cat) => {
              const pct = totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0;
              const color = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.Other;
              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-text-primary">
                        {cat.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-tertiary">
                        {pct.toFixed(1)}%
                      </span>
                      <span className="font-medium text-text-primary">
                        {formatCurrency(cat.total)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Add Pool Modal ───
function AddPoolModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          periodStart,
          periodEnd,
          totalAmount: Number(totalAmount),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Budget pool created");
      setName("");
      setPeriodStart("");
      setPeriodEnd("");
      setTotalAmount("");
      onCreated();
    } catch {
      toast("error", "Failed to create pool");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Budget Pool">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Pool Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Q2 2026 Production"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Period Start"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
          <Input
            label="Period End"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
          />
        </div>
        <Input
          label="Total Amount"
          type="number"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          required
          placeholder="250000"
        />
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create Pool
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

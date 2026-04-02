"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import type { BudgetPoolSummary, CampaignListItem } from "@/types/domain";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
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
  LayoutList,
  Clock,
  Pencil,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

type Tab = "overview" | "budgets" | "analysis" | "approvals" | "spending";

const TABS: { key: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: "overview", label: "Budget Pools", icon: DollarSign },
  { key: "budgets", label: "Campaign Budgets", icon: LayoutList, adminOnly: true },
  { key: "analysis", label: "Analysis", icon: Activity, adminOnly: true },
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
        <h2 className="text-2xl font-bold text-text-primary">Budget</h2>
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
      {tab === "budgets" && isAdmin && <CampaignBudgetsTab />}
      {tab === "analysis" && isAdmin && <AnalysisTab />}
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

// ─── Campaign Budgets Tab ───
function CampaignBudgetsTab() {
  const { toast } = useToast();
  const { data: campaigns, mutate } = useSWR<CampaignListItem[]>("/api/campaigns", fetcher);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editAll, setEditAll] = useState(false);
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const activeCampaigns = (campaigns || []).filter(
    (c) => c.status !== "Complete" && c.status !== "Cancelled"
  );

  function startEdit(campaign: CampaignListItem) {
    setEditingId(campaign.id);
    setEditValue(String(campaign.productionBudget));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  function startEditAll() {
    const values: Record<string, string> = {};
    for (const c of activeCampaigns) {
      values[c.id] = String(c.productionBudget);
    }
    setBulkValues(values);
    setEditingId(null);
    setEditValue("");
    setEditAll(true);
  }

  function cancelEditAll() {
    setEditAll(false);
    setBulkValues({});
  }

  async function saveBudget(campaignId: string) {
    const amount = Number(editValue);
    if (isNaN(amount) || amount < 0) {
      toast("error", "Enter a valid budget amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionBudget: amount }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Budget updated");
      setEditingId(null);
      setEditValue("");
      mutate();
    } catch {
      toast("error", "Failed to update budget");
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    // Find which rows actually changed
    const changed = activeCampaigns.filter((c) => {
      const newVal = Number(bulkValues[c.id]);
      return !isNaN(newVal) && newVal >= 0 && newVal !== c.productionBudget;
    });

    if (changed.length === 0) {
      toast("success", "No changes to save");
      setEditAll(false);
      setBulkValues({});
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.allSettled(
        changed.map((c) =>
          fetch(`/api/campaigns/${c.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productionBudget: Number(bulkValues[c.id]) }),
          }).then((r) => {
            if (!r.ok) throw new Error("Failed");
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.filter((r) => r.status === "fulfilled").length;

      if (failed > 0) {
        toast("error", `${failed} update${failed !== 1 ? "s" : ""} failed`);
      } else {
        toast("success", `${succeeded} budget${succeeded !== 1 ? "s" : ""} updated`);
      }

      setEditAll(false);
      setBulkValues({});
      mutate();
    } catch {
      toast("error", "Failed to save budgets");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {activeCampaigns.length} active campaign{activeCampaigns.length !== 1 ? "s" : ""}
        </p>
        {activeCampaigns.length > 0 && !editAll && (
          <Button size="sm" variant="secondary" onClick={startEditAll}>
            <Pencil className="h-3.5 w-3.5" />
            Edit All
          </Button>
        )}
        {editAll && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancelEditAll} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveAll} loading={saving}>
              <Check className="h-3.5 w-3.5" />
              Save All
            </Button>
          </div>
        )}
      </div>

      {activeCampaigns.length === 0 ? (
        <EmptyState
          icon={<LayoutList className="h-5 w-5" />}
          title="No active campaigns"
          description="Active campaigns and their budgets will appear here."
        />
      ) : (
        <div className="rounded-2xl overflow-hidden bg-surface border border-border shadow-xs">
          {/* Table header */}
          <div className="flex items-center gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
            <div className="w-20 shrink-0">WF#</div>
            <div className="flex-1">Campaign</div>
            <div className="w-24 shrink-0">Status</div>
            <div className="w-24 shrink-0 text-right">Committed</div>
            <div className="w-32 shrink-0 text-right">Budget</div>
            {!editAll && <div className="w-16 shrink-0" />}
          </div>

          {/* Table rows */}
          {activeCampaigns.map((c) => {
            const isEditing = editAll || editingId === c.id;
            const currentValue = editAll ? (bulkValues[c.id] ?? String(c.productionBudget)) : editValue;
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-secondary/50 transition-colors"
              >
                <div className="w-20 shrink-0 text-xs font-mono text-text-tertiary">
                  {c.wfNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="text-sm font-medium text-text-primary hover:text-primary transition-colors truncate block"
                  >
                    {c.name}
                  </Link>
                </div>
                <div className="w-24 shrink-0">
                  <Badge
                    variant={
                      c.status === "In Production"
                        ? "success"
                        : c.status === "Post"
                        ? "info"
                        : "default"
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
                <div className="w-24 shrink-0 text-right text-sm text-text-secondary">
                  {formatCurrency(c.committed || 0)}
                </div>
                <div className="w-32 shrink-0 text-right">
                  {isEditing ? (
                    <input
                      type="number"
                      value={currentValue}
                      onChange={(e) => {
                        if (editAll) {
                          setBulkValues((prev) => ({ ...prev, [c.id]: e.target.value }));
                        } else {
                          setEditValue(e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!editAll) {
                          if (e.key === "Enter") saveBudget(c.id);
                          if (e.key === "Escape") cancelEdit();
                        }
                      }}
                      autoFocus={!editAll && editingId === c.id}
                      className="w-full rounded-lg border border-primary bg-surface px-3 py-1.5 text-sm text-right text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-text-primary">
                      {formatCurrency(c.productionBudget)}
                    </span>
                  )}
                </div>
                {!editAll && (
                  <div className="w-16 shrink-0 flex justify-end">
                    {editingId === c.id ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          disabled={saving}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveBudget(c.id)}
                          loading={saving}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Analysis Tab ───
type SortField = "name" | "budget" | "committed" | "spent" | "variancePct" | "shootDays" | "costPerShootDay";
type SortDir = "asc" | "desc";
type AnalysisView = "overview" | "category" | "vendor" | "campaign";

interface AnalysisData {
  summary: {
    totalBudgeted: number;
    totalAllocated: number;
    totalCommitted: number;
    totalInvoiced: number;
    totalSpent: number;
    unallocated: number;
    activeCampaignCount: number;
    completedCampaignCount: number;
    totalShootDays: number;
    avgCostPerShootDay: number | null;
    vendorConcentrationPct: number;
    estimateAccuracyPct: number;
  };
  poolHealth: Array<{
    id: string; name: string; periodStart: string; periodEnd: string;
    totalAmount: number; allocated: number; committed: number;
    invoiced: number; spent: number; remaining: number;
    campaignCount: number; utilizationPct: number;
  }>;
  categoryBreakdown: Array<{
    category: string; estimated: number; invoiced: number;
    variance: number; variancePct: number;
  }>;
  vendorBreakdown: Array<{
    id: string; name: string; category: string;
    estimateTotal: number; invoiceTotal: number; paidTotal: number;
    campaignCount: number; assignmentCount: number;
    variance: number; variancePct: number;
  }>;
  campaignAnalysis: Array<{
    id: string; wfNumber: string; name: string; status: string;
    budget: number; committed: number; invoiced: number; spent: number;
    remaining: number; variancePct: number; vendorCount: number;
    shootDays: number; costPerShootDay: number | null;
  }>;
  quarterlyTrend: Array<{
    quarter: string; estimated: number; invoiced: number; paid: number;
  }>;
  overageSummary: {
    totalRequested: number; totalApproved: number; totalDeclined: number;
    totalPending: number; requestCount: number; approvedCount: number;
    declinedCount: number;
  };
}

function AnalysisTab() {
  const { data, isLoading } = useSWR<AnalysisData>("/api/budget/analysis", fetcher);
  const [view, setView] = useState<AnalysisView>("overview");
  const [sortField, setSortField] = useState<SortField>("budget");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [vendorSort, setVendorSort] = useState<"spend" | "variance" | "campaigns">("spend");
  const [categorySort, setCategorySort] = useState<"invoiced" | "variance">("invoiced");

  const CHART_COLORS = [
    "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2",
    "#457b9d", "#6096ba", "#a8dadc", "#e9c46a", "#f4a261", "#e76f51",
  ];

  const { summary, poolHealth, categoryBreakdown, vendorBreakdown, campaignAnalysis, quarterlyTrend, overageSummary } = data || {} as AnalysisData;

  const sortedCampaigns = useMemo(() => {
    if (!campaignAnalysis) return [];
    return [...campaignAnalysis].sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [campaignAnalysis, sortField, sortDir]);

  const sortedVendors = useMemo(() => {
    if (!vendorBreakdown) return [];
    return [...vendorBreakdown].sort((a, b) => {
      if (vendorSort === "spend") return (b.paidTotal || b.estimateTotal) - (a.paidTotal || a.estimateTotal);
      if (vendorSort === "variance") return Math.abs(b.variancePct) - Math.abs(a.variancePct);
      return b.campaignCount - a.campaignCount;
    });
  }, [vendorBreakdown, vendorSort]);

  const sortedCategories = useMemo(() => {
    if (!categoryBreakdown) return [];
    return [...categoryBreakdown].sort((a, b) => {
      if (categorySort === "invoiced") return b.invoiced - a.invoiced;
      return Math.abs(b.variancePct) - Math.abs(a.variancePct);
    });
  }, [categoryBreakdown, categorySort]);

  const totalCategorySpend = useMemo(
    () => (categoryBreakdown || []).reduce((s, c) => s + c.invoiced, 0) || 1,
    [categoryBreakdown]
  );

  const categoryPieData = useMemo(() => {
    const topCats = sortedCategories.filter((c) => c.invoiced > 0).slice(0, 8);
    const otherTotal = sortedCategories.slice(8).reduce((s, c) => s + c.invoiced, 0);
    const result = topCats.map((c) => ({ name: c.category, value: c.invoiced }));
    if (otherTotal > 0) result.push({ name: "Other", value: otherTotal });
    return result;
  }, [sortedCategories]);

  const vendorBarData = useMemo(() => {
    return sortedVendors.slice(0, 10).map((v) => ({
      name: v.name.length > 18 ? v.name.slice(0, 16) + "…" : v.name,
      Estimated: v.estimateTotal,
      Invoiced: v.invoiceTotal,
      Paid: v.paidTotal,
    }));
  }, [sortedVendors]);

  const campaignBarData = useMemo(() => {
    return sortedCampaigns.slice(0, 10).map((c) => ({
      name: c.name.length > 20 ? c.name.slice(0, 18) + "…" : c.name,
      Budget: c.budget,
      Committed: c.committed,
      Spent: c.spent,
    }));
  }, [sortedCampaigns]);

  const budgetFlowData = useMemo(() => {
    if (!summary || (!summary.totalBudgeted && !summary.totalAllocated)) return [];
    return [
      { name: "Budgeted", value: summary.totalBudgeted },
      { name: "Allocated", value: summary.totalAllocated },
      { name: "Committed", value: summary.totalCommitted },
      { name: "Invoiced", value: summary.totalInvoiced },
      { name: "Paid", value: summary.totalSpent },
    ];
  }, [summary]);

  function toggleCampaignSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />;
  }

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-md">
        <p className="text-xs font-medium text-text-primary mb-1">{label || payload[0]?.name}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs text-text-secondary">
            <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: p.color || p.fill }} />
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  }

  const ANALYSIS_VIEWS: { key: AnalysisView; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "category", label: "By Category", icon: Layers },
    { key: "vendor", label: "By Vendor", icon: Users },
    { key: "campaign", label: "By Campaign", icon: LayoutList },
  ];

  return isLoading || !data ? (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-secondary" />
      ))}
    </div>
  ) : (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex gap-1.5">
        {ANALYSIS_VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                view === v.key
                  ? "bg-primary/10 text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* ─── Overview View ─── */}
      {view === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Total Budgeted</p>
              <p className="mt-1 text-xl font-bold text-text-primary">{formatCurrency(summary.totalBudgeted)}</p>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {formatCurrency(summary.unallocated)} unallocated
              </p>
            </Card>
            <Card>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Committed</p>
              <p className="mt-1 text-xl font-bold text-text-primary">{formatCurrency(summary.totalCommitted)}</p>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {formatCurrency(summary.totalInvoiced)} invoiced
              </p>
            </Card>
            <Card>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Spent (Paid)</p>
              <p className="mt-1 text-xl font-bold text-text-primary">{formatCurrency(summary.totalSpent)}</p>
              {summary.avgCostPerShootDay !== null && (
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {formatCurrency(summary.avgCostPerShootDay)} / shoot day
                </p>
              )}
            </Card>
            <Card>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Estimate Accuracy</p>
              <p className={`mt-1 text-xl font-bold ${
                Math.abs(summary.estimateAccuracyPct) <= 5
                  ? "text-emerald-600"
                  : Math.abs(summary.estimateAccuracyPct) <= 15
                  ? "text-amber-600"
                  : "text-red-600"
              }`}>
                {summary.estimateAccuracyPct > 0 ? "+" : ""}{summary.estimateAccuracyPct}%
              </p>
              <p className="mt-0.5 text-xs text-text-tertiary">
                invoice vs. estimate variance
              </p>
            </Card>
          </div>

          {/* Budget Flow Chart */}
          {budgetFlowData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-text-tertiary" />
                  Budget Flow
                </CardTitle>
              </CardHeader>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetFlowData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-secondary, #6b7280)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary, #9ca3af)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <ReTooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                      {budgetFlowData.map((_, i) => (
                        <Cell key={i} fill={["#2d6a4f", "#40916c", "#457b9d", "#e9c46a", "#52b788"][i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 text-[10px] mt-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-text-tertiary">Paid</span>
                  <span className="font-medium text-text-primary">{formatCurrency(summary.totalSpent)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-text-tertiary">Committed</span>
                  <span className="font-medium text-text-primary">{formatCurrency(summary.totalCommitted)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#e5e7eb" }} />
                  <span className="text-text-tertiary">Unallocated</span>
                  <span className="font-medium text-text-primary">{formatCurrency(summary.unallocated)}</span>
                </span>
              </div>
            </Card>
          )}

          {/* Quick stats row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Active Campaigns</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{summary.activeCampaignCount}</p>
              <p className="text-xs text-text-tertiary">{summary.completedCampaignCount} completed</p>
            </Card>
            <Card>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Shoot Days</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{summary.totalShootDays}</p>
              {summary.avgCostPerShootDay !== null && (
                <p className="text-xs text-text-tertiary">{formatCurrency(summary.avgCostPerShootDay)} avg cost</p>
              )}
            </Card>
            <Card>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Vendor Concentration</p>
              <p className={`mt-1 text-lg font-bold ${
                summary.vendorConcentrationPct > 70 ? "text-amber-600" : "text-text-primary"
              }`}>
                {summary.vendorConcentrationPct}%
              </p>
              <p className="text-xs text-text-tertiary">top 3 vendors</p>
            </Card>
            <Card>
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Budget Adjustments</p>
              <p className="mt-1 text-lg font-bold text-text-primary">{formatCurrency(overageSummary.totalApproved)}</p>
              <p className="text-xs text-text-tertiary">
                {overageSummary.approvedCount} approved, {overageSummary.declinedCount} declined
              </p>
            </Card>
          </div>

          {/* Quarterly Trend */}
          {quarterlyTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-text-tertiary" />
                  Quarterly Spend Trend
                </CardTitle>
              </CardHeader>
              <div className="space-y-2.5">
                {quarterlyTrend.map((q) => {
                  const maxVal = Math.max(...quarterlyTrend.map((qt) => Math.max(qt.estimated, qt.invoiced, qt.paid))) || 1;
                  return (
                    <div key={q.quarter}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-text-primary w-16">{q.quarter}</span>
                        <div className="flex gap-4">
                          <span className="text-text-tertiary">Est: <span className="text-text-primary font-medium">{formatCurrency(q.estimated)}</span></span>
                          <span className="text-text-tertiary">Inv: <span className="text-text-primary font-medium">{formatCurrency(q.invoiced)}</span></span>
                          <span className="text-text-tertiary">Paid: <span className="text-emerald-600 font-medium">{formatCurrency(q.paid)}</span></span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
                        <div className="h-full flex">
                          <div className="bg-emerald-500" style={{ width: `${(q.paid / maxVal) * 100}%` }} />
                          <div className="bg-blue-300" style={{ width: `${((q.estimated - q.paid) / maxVal) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Pool Health Cards */}
          {poolHealth.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-text-tertiary" />
                  Pool Health
                </CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {poolHealth.map((pool) => (
                  <div key={pool.id} className="rounded-lg border border-border p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{pool.name}</p>
                        <p className="text-xs text-text-tertiary">{pool.periodStart} — {pool.periodEnd} &middot; {pool.campaignCount} campaigns</p>
                      </div>
                      <Badge variant={pool.utilizationPct > 95 ? "error" : pool.utilizationPct > 80 ? "warning" : "success"}>
                        {pool.utilizationPct}% allocated
                      </Badge>
                    </div>
                    <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden mb-2">
                      <div className="h-full flex">
                        <div className="bg-emerald-500" style={{ width: `${Math.min((pool.spent / pool.totalAmount) * 100, 100)}%` }} />
                        <div className="bg-blue-400" style={{ width: `${Math.min(((pool.committed - pool.spent) / pool.totalAmount) * 100, 100)}%` }} />
                        <div className="bg-gray-200" style={{ width: `${Math.min(((pool.allocated - pool.committed) / pool.totalAmount) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-4 text-[10px] text-text-tertiary">
                      <span>Total: <span className="font-medium text-text-primary">{formatCurrency(pool.totalAmount)}</span></span>
                      <span>Remaining: <span className="font-medium text-emerald-600">{formatCurrency(pool.remaining)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── Category View ─── */}
      {view === "category" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              Spending breakdown across {categoryBreakdown.length} cost categories
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCategorySort("invoiced")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  categorySort === "invoiced" ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                By Spend
              </button>
              <button
                onClick={() => setCategorySort("variance")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  categorySort === "variance" ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                By Variance
              </button>
            </div>
          </div>

          {/* Donut Chart */}
          {categoryPieData.length > 0 && (
            <Card>
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="h-52 w-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryPieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {categoryPieData.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-xs text-text-secondary truncate">{cat.name}</span>
                      <span className="text-xs font-medium text-text-primary ml-auto">{formatCurrency(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {sortedCategories.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="No category data yet"
              description="Category spending will appear as estimates and invoices are processed."
            />
          ) : (
            <div className="rounded-2xl overflow-hidden bg-surface border border-border shadow-xs">
              <div className="flex items-center gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
                <div className="flex-1">Category</div>
                <div className="w-24 shrink-0 text-right">Estimated</div>
                <div className="w-24 shrink-0 text-right">Invoiced</div>
                <div className="w-20 shrink-0 text-right">Variance</div>
                <div className="w-32 shrink-0">Share</div>
              </div>
              {sortedCategories.map((cat) => {
                const pct = (cat.invoiced / totalCategorySpend) * 100;
                return (
                  <div key={cat.category} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-secondary/50 transition-colors">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-text-primary">{cat.category}</span>
                    </div>
                    <div className="w-24 shrink-0 text-right text-sm text-text-secondary">
                      {formatCurrency(cat.estimated)}
                    </div>
                    <div className="w-24 shrink-0 text-right text-sm font-semibold text-text-primary">
                      {formatCurrency(cat.invoiced)}
                    </div>
                    <div className="w-20 shrink-0 text-right">
                      {cat.variance !== 0 && (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                          cat.variance > 0 ? "text-red-600" : "text-emerald-600"
                        }`}>
                          {cat.variance > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {cat.variancePct > 0 ? "+" : ""}{cat.variancePct}%
                        </span>
                      )}
                    </div>
                    <div className="w-32 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-surface-tertiary overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-text-tertiary w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Vendor View ─── */}
      {view === "vendor" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {vendorBreakdown.length} vendor{vendorBreakdown.length !== 1 ? "s" : ""} with activity
            </p>
            <div className="flex gap-1.5">
              {(["spend", "variance", "campaigns"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setVendorSort(s)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                    vendorSort === s ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  By {s === "campaigns" ? "Usage" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Spend Chart */}
          {vendorBarData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-text-tertiary" />
                  Top Vendors — Estimate vs. Invoice vs. Paid
                </CardTitle>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendorBarData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-tertiary, #9ca3af)" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary, #9ca3af)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <ReTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Estimated" fill="#95d5b2" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Invoiced" fill="#457b9d" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Paid" fill="#2d6a4f" radius={[2, 2, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {sortedVendors.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No vendor data yet"
              description="Vendor spending will appear as estimates and invoices are processed."
            />
          ) : (
            <div className="rounded-2xl overflow-hidden bg-surface border border-border shadow-xs">
              <div className="flex items-center gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
                <div className="flex-1">Vendor</div>
                <div className="w-16 shrink-0 text-center">Campaigns</div>
                <div className="w-24 shrink-0 text-right">Estimated</div>
                <div className="w-24 shrink-0 text-right">Invoiced</div>
                <div className="w-24 shrink-0 text-right">Paid</div>
                <div className="w-20 shrink-0 text-right">Accuracy</div>
              </div>
              {sortedVendors.map((v) => (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-secondary/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{v.name}</p>
                    <p className="text-xs text-text-tertiary">{v.category}</p>
                  </div>
                  <div className="w-16 shrink-0 text-center text-sm text-text-secondary">{v.campaignCount}</div>
                  <div className="w-24 shrink-0 text-right text-sm text-text-secondary">{formatCurrency(v.estimateTotal)}</div>
                  <div className="w-24 shrink-0 text-right text-sm text-text-secondary">{formatCurrency(v.invoiceTotal)}</div>
                  <div className="w-24 shrink-0 text-right text-sm font-semibold text-text-primary">{formatCurrency(v.paidTotal)}</div>
                  <div className="w-20 shrink-0 text-right">
                    {v.estimateTotal > 0 && v.invoiceTotal > 0 ? (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                        Math.abs(v.variancePct) <= 5 ? "text-emerald-600" :
                        Math.abs(v.variancePct) <= 15 ? "text-amber-600" : "text-red-600"
                      }`}>
                        {v.variancePct > 0 ? "+" : ""}{v.variancePct}%
                      </span>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Campaign View ─── */}
      {view === "campaign" && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Budget vs. actual across {campaignAnalysis.length} campaigns
          </p>

          {/* Campaign Budget Chart */}
          {campaignBarData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutList className="h-4 w-4 text-text-tertiary" />
                  Budget vs. Committed vs. Spent
                </CardTitle>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignBarData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-text-tertiary, #9ca3af)" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-text-tertiary, #9ca3af)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <ReTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Budget" fill="#95d5b2" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Committed" fill="#457b9d" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Spent" fill="#2d6a4f" radius={[2, 2, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {sortedCampaigns.length === 0 ? (
            <EmptyState
              icon={<LayoutList className="h-5 w-5" />}
              title="No campaign data"
              description="Campaign budget analysis will appear here."
            />
          ) : (
            <div className="rounded-2xl overflow-hidden bg-surface border border-border shadow-xs">
              <div className="flex items-center gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
                <button className="w-16 shrink-0 text-left flex items-center gap-1" onClick={() => toggleCampaignSort("name")}>
                  WF# <SortIcon field="name" />
                </button>
                <div className="flex-1">Campaign</div>
                <div className="w-20 shrink-0">Status</div>
                <button className="w-20 shrink-0 text-right flex items-center justify-end gap-1" onClick={() => toggleCampaignSort("budget")}>
                  Budget <SortIcon field="budget" />
                </button>
                <button className="w-20 shrink-0 text-right flex items-center justify-end gap-1" onClick={() => toggleCampaignSort("committed")}>
                  Commit <SortIcon field="committed" />
                </button>
                <button className="w-20 shrink-0 text-right flex items-center justify-end gap-1" onClick={() => toggleCampaignSort("spent")}>
                  Spent <SortIcon field="spent" />
                </button>
                <button className="w-16 shrink-0 text-right flex items-center justify-end gap-1" onClick={() => toggleCampaignSort("variancePct")}>
                  Var <SortIcon field="variancePct" />
                </button>
                <button className="w-14 shrink-0 text-right flex items-center justify-end gap-1" onClick={() => toggleCampaignSort("shootDays")}>
                  Days <SortIcon field="shootDays" />
                </button>
                <button className="w-20 shrink-0 text-right flex items-center justify-end gap-1" onClick={() => toggleCampaignSort("costPerShootDay")}>
                  $/Day <SortIcon field="costPerShootDay" />
                </button>
              </div>
              {sortedCampaigns.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-surface-secondary/50 transition-colors">
                  <div className="w-16 shrink-0 text-xs font-mono text-text-tertiary">{c.wfNumber}</div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/campaigns/${c.id}`} className="text-sm font-medium text-text-primary hover:text-primary transition-colors truncate block">
                      {c.name}
                    </Link>
                  </div>
                  <div className="w-20 shrink-0">
                    <Badge variant={c.status === "In Production" ? "success" : c.status === "Post" ? "info" : c.status === "Complete" ? "default" : "default"}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="w-20 shrink-0 text-right text-sm text-text-secondary">{formatCurrency(c.budget)}</div>
                  <div className="w-20 shrink-0 text-right text-sm text-text-secondary">{formatCurrency(c.committed)}</div>
                  <div className="w-20 shrink-0 text-right text-sm font-semibold text-text-primary">{formatCurrency(c.spent)}</div>
                  <div className="w-16 shrink-0 text-right">
                    {c.committed > 0 ? (
                      <span className={`text-xs font-medium ${
                        c.variancePct > 0 ? "text-red-600" : c.variancePct < -10 ? "text-emerald-600" : "text-text-secondary"
                      }`}>
                        {c.variancePct > 0 ? "+" : ""}{c.variancePct}%
                      </span>
                    ) : (
                      <span className="text-xs text-text-tertiary">—</span>
                    )}
                  </div>
                  <div className="w-14 shrink-0 text-right text-sm text-text-secondary">{c.shootDays || "—"}</div>
                  <div className="w-20 shrink-0 text-right text-sm text-text-secondary">
                    {c.costPerShootDay ? formatCurrency(c.costPerShootDay) : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
    reviewedAt?: string;
    reviewNotes?: string;
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
  resolvedRequests: Array<{
    id: string;
    campaignId: string;
    amount: number;
    rationale: string;
    status: string;
    createdAt: string;
    reviewedAt?: string;
    reviewNotes?: string;
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
}

function ApprovalsTab() {
  const { toast } = useToast();
  const { data, mutate } = useSWR<ApprovalData>("/api/approvals", fetcher);

  const budgetRequests = data?.budgetRequests || [];
  const pendingInvoices = data?.pendingInvoices || [];
  const resolvedRequests = data?.resolvedRequests || [];
  const resolvedInvoices = data?.resolvedInvoices || [];
  const totalPending = budgetRequests.length + pendingInvoices.length;
  const totalResolved = resolvedRequests.length + resolvedInvoices.length;

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

  function formatDate(dateStr?: string) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

      {/* ─── History ─── */}
      {totalResolved > 0 && (
        <>
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-tertiary">
              <Clock className="h-3.5 w-3.5" />
              History
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Resolved Budget Requests */}
          {resolvedRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-text-tertiary" />
                  Past Budget Requests
                  <span className="text-xs font-normal text-text-tertiary">
                    ({resolvedRequests.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <div className="space-y-1">
                {resolvedRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-4 px-4 py-2.5 rounded-lg hover:bg-surface-secondary/50 transition-colors"
                  >
                    <Badge
                      variant={req.status === "Approved" ? "success" : "error"}
                    >
                      {req.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/campaigns/${req.campaignId}`}
                        className="text-sm font-medium text-text-primary hover:text-primary transition-colors"
                      >
                        {req.campaign?.name || "Unknown Campaign"}
                      </Link>
                      <p className="text-xs text-text-tertiary truncate">
                        {req.campaign?.wfNumber} — {req.requester?.name || "Unknown"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-text-primary">
                      {formatCurrency(req.amount)}
                    </span>
                    <span className="shrink-0 text-xs text-text-tertiary w-24 text-right">
                      {formatDate(req.reviewedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Resolved Invoices */}
          {resolvedInvoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-text-tertiary" />
                  Past Invoice Approvals
                  <span className="text-xs font-normal text-text-tertiary">
                    ({resolvedInvoices.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <div className="space-y-1">
                {resolvedInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-4 px-4 py-2.5 rounded-lg hover:bg-surface-secondary/50 transition-colors"
                  >
                    <Badge variant={inv.status === "Paid" ? "default" : "success"}>
                      {inv.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/campaigns/${inv.campaignId}`}
                        className="text-sm font-medium text-text-primary hover:text-primary transition-colors"
                      >
                        {inv.campaignName}
                      </Link>
                      <p className="text-xs text-text-tertiary truncate">
                        {inv.wfNumber} — {inv.vendorName}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-text-primary">
                      {formatCurrency(inv.invoiceTotal)}
                    </span>
                    <span className="shrink-0 text-xs text-text-tertiary w-24 text-right">
                      {formatDate(inv.updatedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
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

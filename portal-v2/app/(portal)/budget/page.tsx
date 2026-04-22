"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { BudgetPoolSummary, CampaignListItem } from "@/types/domain";
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
  LayoutList,
  Clock,
  Pencil,
  TrendingUp,
  AlertTriangle,
  Activity,
  Users,
  Layers,
  ChevronDown,
  ChevronRight,
  Receipt,
  HardHat,
  CheckCircle2,
  Circle,
  UserCheck,
  Inbox,
  FileSignature,
  Banknote,
} from "lucide-react";
import Link from "next/link";
import { VendorFinancialsTab } from "@/components/budget/vendor-financials-tab";
import { ApprovalsTab } from "@/components/budget/approvals-tab";
import { PageTabs } from "@/components/ui/page-tabs";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

type Tab = "queue" | "program" | "cost-report" | "vendors";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "queue", label: "Queue", icon: ShieldCheck },
  { key: "program", label: "Program", icon: LayoutList },
  { key: "cost-report", label: "Cost Report", icon: Activity },
  { key: "vendors", label: "Vendors", icon: Users },
];

const VALID_TABS: readonly Tab[] = ["queue", "program", "cost-report", "vendors"] as const;

function isTab(value: string | null): value is Tab {
  return value !== null && (VALID_TABS as readonly string[]).includes(value);
}

export default function BudgetPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "Admin";
  const searchParams = useSearchParams();
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return isTab(t) ? t : "queue";
  })();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-border">
          <h1 className="text-2xl font-bold text-text-primary">Budget</h1>
        </div>
        <VendorFinancialsTab />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-0">
        <div className="pb-4 border-b border-border">
          <h1 className="text-2xl font-bold text-text-primary">Budget</h1>
        </div>

        <PageTabs tabs={TABS} activeTab={activeTab} onTabChange={(key) => setActiveTab(key as Tab)} />
      </div>

      {/* Tab content */}
      {activeTab === "queue" && <QueueSection />}
      {activeTab === "program" && <ProgramSection isAdmin={isAdmin} />}
      {activeTab === "cost-report" && <CostReportSection />}
      {activeTab === "vendors" && <VendorsSection />}
    </div>
  );
}

// ─── Queue Section ───
// Counter strip on top, then the existing ApprovalsTab underneath. The counters
// give an at-a-glance read of what's waiting for the HOP — matches the mockup.
function QueueSection() {
  const { data } = useSWR<{
    budgetRequests: Array<{ amount: number }>;
    pendingInvoices: Array<{ invoiceTotal: number }>;
    pendingCrewBookings: Array<{ totalAmount: number }>;
    pendingCrewPayments: Array<{ totalAmount: number }>;
  }>("/api/approvals", fetcher);

  const overages = {
    count: data?.budgetRequests.length || 0,
    amount: (data?.budgetRequests || []).reduce((s, r) => s + Number(r.amount), 0),
  };
  const invoices = {
    count: data?.pendingInvoices.length || 0,
    amount: (data?.pendingInvoices || []).reduce((s, i) => s + Number(i.invoiceTotal), 0),
  };
  const rates = {
    count: data?.pendingCrewBookings.length || 0,
    amount: (data?.pendingCrewBookings || []).reduce((s, b) => s + Number(b.totalAmount), 0),
  };
  const payments = {
    count: data?.pendingCrewPayments.length || 0,
    amount: (data?.pendingCrewPayments || []).reduce((s, p) => s + Number(p.totalAmount), 0),
  };

  const counters = [
    { label: "Overages", icon: AlertTriangle, tone: "warning", ...overages },
    { label: "Invoices", icon: Receipt, tone: "info", ...invoices },
    { label: "Rate Approvals", icon: FileSignature, tone: "warning", ...rates },
    { label: "Crew Payments", icon: Banknote, tone: "info", ...payments },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counters.map((c) => {
          const Icon = c.icon;
          const toneColor = c.tone === "warning" ? "text-amber-600" : "text-blue-600";
          return (
            <Card key={c.label} padding="none">
              <div className="px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <Icon className={`h-4 w-4 ${toneColor}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${c.count > 0 ? toneColor : "text-text-tertiary"}`}>
                    {c.count} open
                  </span>
                </div>
                <p className="mt-1.5 text-xl font-bold text-text-primary">
                  {formatCurrency(c.amount)}
                </p>
                <p className="text-xs text-text-tertiary">{c.label}</p>
              </div>
            </Card>
          );
        })}
      </div>
      <ApprovalsTab />
    </div>
  );
}

// ─── Program Section ───
// Pool cards expand/collapse to reveal the campaigns they fund. Matches the
// mockup: top-down pool → campaign relationship, nested in one view.
function ProgramSection({ isAdmin }: { isAdmin: boolean }) {
  const { data, mutate } = useSWR<AnalysisData>("/api/budget/analysis", fetcher);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPool, setSelectedPool] = useState<AnalysisData["poolHealth"][number] | null>(null);

  const pools = data?.poolHealth || [];
  const allCampaigns = data?.campaignAnalysis || [];
  const campaignsByPool = new Map<string, AnalysisData["campaignAnalysis"]>();
  for (const c of allCampaigns) {
    const key = c.budgetPoolId || "unassigned";
    if (!campaignsByPool.has(key)) campaignsByPool.set(key, []);
    campaignsByPool.get(key)!.push(c);
  }
  // Default: first pool expanded on first load
  const defaultExpandKey = pools[0]?.id;

  function isOpen(id: string) {
    if (id in expanded) return expanded[id];
    return id === defaultExpandKey;
  }
  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !isOpen(id) }));
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          {pools.length} pool{pools.length !== 1 ? "s" : ""} · {allCampaigns.length} campaign{allCampaigns.length !== 1 ? "s" : ""}
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
          action={isAdmin ? (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Pool
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {pools.map((pool) => {
            const poolCampaigns = campaignsByPool.get(pool.id) || [];
            const open = isOpen(pool.id);
            const spentPct = pool.totalAmount > 0 ? (pool.spent / pool.totalAmount) * 100 : 0;
            const committedPct = pool.totalAmount > 0 ? ((pool.committed - pool.spent) / pool.totalAmount) * 100 : 0;
            const allocPct = pool.totalAmount > 0 ? ((pool.allocated - pool.committed) / pool.totalAmount) * 100 : 0;
            const fmtPeriod = (d: string) => {
              const [y, m, day] = d.split("-");
              return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              });
            };

            return (
              <Card key={pool.id} padding="none">
                <button
                  type="button"
                  onClick={() => toggle(pool.id)}
                  className="w-full text-left hover:bg-surface-secondary/40 transition-colors"
                >
                  <div className="flex items-start gap-3 px-3.5 py-3 border-b border-border">
                    {open ? (
                      <ChevronDown className="h-4 w-4 mt-0.5 text-text-tertiary shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mt-0.5 text-text-tertiary shrink-0" />
                    )}
                    <DollarSign className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">{pool.name}</span>
                        <Badge variant={pool.utilizationPct > 95 ? "error" : pool.utilizationPct > 80 ? "warning" : "default"}>
                          {pool.utilizationPct}% allocated
                        </Badge>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setSelectedPool(pool); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setSelectedPool(pool); } }}
                          className="ml-auto text-[10px] text-text-tertiary hover:text-primary cursor-pointer"
                        >
                          Edit pool →
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-text-tertiary">
                        {fmtPeriod(pool.periodStart)} — {fmtPeriod(pool.periodEnd)} · {pool.campaignCount} campaign{pool.campaignCount !== 1 ? "s" : ""}
                      </p>
                      <div className="mt-2 h-2 rounded-full bg-surface-tertiary overflow-hidden">
                        <div className="h-full flex">
                          <div className="bg-emerald-500" style={{ width: `${Math.min(spentPct, 100)}%` }} />
                          <div className="bg-blue-400" style={{ width: `${Math.min(committedPct, 100)}%` }} />
                          <div className="bg-slate-300" style={{ width: `${Math.min(allocPct, 100)}%` }} />
                        </div>
                      </div>
                      <div className="mt-1.5 flex gap-4 text-[10px] text-text-tertiary flex-wrap">
                        <span>Paid <span className="font-semibold text-emerald-600">{formatCurrency(pool.spent)}</span></span>
                        <span>Committed <span className="font-semibold text-text-primary">{formatCurrency(pool.committed)}</span></span>
                        <span>Allocated <span className="font-semibold text-text-primary">{formatCurrency(pool.allocated)}</span></span>
                        <span>Remaining <span className="font-semibold text-emerald-600">{formatCurrency(pool.remaining)}</span></span>
                        <span className="ml-auto">Total <span className="font-semibold text-text-primary">{formatCurrency(pool.totalAmount)}</span></span>
                      </div>
                    </div>
                  </div>
                </button>

                {open && (
                  <>
                    <div className="hidden md:grid grid-cols-[88px_1fr_110px_100px_100px_100px_100px_100px_80px] gap-3 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-secondary/40">
                      <div>WF#</div>
                      <div>Campaign</div>
                      <div>Status</div>
                      <div className="text-right">Budget</div>
                      <div className="text-right">Committed</div>
                      <div className="text-right">Invoiced</div>
                      <div className="text-right">Paid</div>
                      <div className="text-right">EFC</div>
                      <div className="text-right">Var</div>
                    </div>
                    {poolCampaigns.length === 0 ? (
                      <div className="px-3.5 py-6 text-center text-xs text-text-tertiary">
                        No campaigns in this pool yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {poolCampaigns.map((c) => {
                          const varTone = Math.abs(c.variancePct) < 3
                            ? "text-text-secondary"
                            : c.variancePct > 0 ? "text-red-600" : "text-emerald-600";
                          return (
                            <Link
                              key={c.id}
                              href={`/campaigns/${c.id}`}
                              className="grid grid-cols-2 md:grid-cols-[88px_1fr_110px_100px_100px_100px_100px_100px_80px] gap-3 px-3.5 py-2.5 items-center hover:bg-surface-secondary/40 transition-colors"
                            >
                              <div className="text-[10px] font-mono text-text-tertiary">{c.wfNumber}</div>
                              <div className="col-span-2 md:col-span-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                              </div>
                              <div><CampaignStatusBadge status={c.status} /></div>
                              <div className="text-right text-sm text-text-secondary">{formatCurrency(c.budget)}</div>
                              <div className="text-right text-sm text-text-secondary">{formatCurrency(c.committed)}</div>
                              <div className="text-right text-sm text-text-secondary">{formatCurrency(c.invoiced)}</div>
                              <div className="text-right text-sm text-text-secondary">{formatCurrency(c.spent)}</div>
                              <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(c.efc)}</div>
                              <div className={`text-right text-xs font-medium ${varTone}`}>
                                {c.variancePct !== 0 && (<>{c.variancePct > 0 ? "+" : ""}{c.variancePct}%</>)}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AddPoolModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={() => { mutate(); setShowAdd(false); }} />
      {selectedPool && (
        <PoolDetailModal
          pool={{
            id: selectedPool.id,
            name: selectedPool.name,
            periodStart: selectedPool.periodStart,
            periodEnd: selectedPool.periodEnd,
            totalAmount: selectedPool.totalAmount,
            allocated: selectedPool.allocated,
            committed: selectedPool.committed,
            spent: selectedPool.spent,
            remaining: selectedPool.remaining,
          } as BudgetPoolSummary}
          open={!!selectedPool}
          onClose={() => setSelectedPool(null)}
          onUpdated={() => { mutate(); setSelectedPool(null); }}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "info" | "success" | "warning" }> = {
    "Planning": { label: "Planning", variant: "default" },
    "In Production": { label: "In Production", variant: "info" },
    "Post": { label: "Post", variant: "warning" },
    "Complete": { label: "Complete", variant: "success" },
  };
  const m = map[status] || { label: status, variant: "default" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

// ─── Vendors Section ───
// Lifecycle (vendor financials) + paymaster onboarding as inner tabs. Two
// sides of the same vendor relationship; keeping them in one place removes
// tab-hopping between "where are they in the lifecycle" and "are they ready
// to be paid".
function VendorsSection() {
  const [inner, setInner] = useState<"lifecycle" | "onboarding">("lifecycle");
  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {[
          { k: "lifecycle" as const, label: "Lifecycle", icon: Receipt },
          { k: "onboarding" as const, label: "Paymaster Onboarding", icon: UserCheck },
        ].map((t) => {
          const Icon = t.icon;
          const active = inner === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setInner(t.k)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-primary/10 text-primary" : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      {inner === "lifecycle" && <VendorFinancialsTab />}
      {inner === "onboarding" && <OnboardingTab />}
    </div>
  );
}

// ─── Budget Pool Detail Modal ───
function PoolDetailModal({
  pool,
  open,
  onClose,
  onUpdated,
  isAdmin,
}: {
  pool: BudgetPoolSummary | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const { data: transactions } = useSWR(
    pool ? `/api/budget?type=transactions&poolId=${pool.id}` : null,
    fetcher
  );

  function startEditing() {
    if (!pool) return;
    setEditName(pool.name);
    setEditAmount(String(pool.totalAmount));
    setEditStart(pool.periodStart);
    setEditEnd(pool.periodEnd);
    setEditing(true);
  }

  async function handleSave() {
    if (!pool) return;
    setSaving(true);
    try {
      const res = await fetch("/api/budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pool.id,
          name: editName,
          totalAmount: Number(editAmount),
          periodStart: editStart,
          periodEnd: editEnd,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Pool updated");
      setEditing(false);
      onUpdated();
    } catch {
      toast("error", "Failed to update pool");
    } finally {
      setSaving(false);
    }
  }

  if (!pool) return null;

  const pctUsed = pool.totalAmount > 0
    ? Math.round((pool.allocated / pool.totalAmount) * 100)
    : 0;

  function formatTxDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Pool" : pool.name} size="lg">
      {editing ? (
        <div className="space-y-4">
          <Input label="Pool Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label="Total Amount" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Period Start" type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
            <Input label="Period End" type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              <Check className="h-3.5 w-3.5" />
              Save
            </Button>
          </ModalFooter>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary stats */}
          <div>
            <div className="mb-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">{formatCurrency(pool.allocated)} of {formatCurrency(pool.totalAmount)}</span>
                <span className="font-medium text-text-primary">{pctUsed}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(pctUsed, 100)}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-text-tertiary">Remaining <span className="font-semibold text-emerald-600">{formatCurrency(pool.remaining)}</span></span>
              <span className="text-text-tertiary">Committed <span className="font-semibold text-text-primary">{formatCurrency(pool.committed)}</span></span>
              <span className="text-text-tertiary">Spent <span className="font-semibold text-text-primary">{formatCurrency(pool.spent)}</span></span>
            </div>
          </div>

          {/* Transaction history */}
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">
              <Clock className="h-3.5 w-3.5" />
              Transaction History
            </p>
            {!transactions || transactions.length === 0 ? (
              <p className="text-sm text-text-tertiary py-4 text-center">No transactions yet.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {(transactions as Array<{ type: string; description: string; amount: number; date: string }>).map((tx, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-secondary/50 transition-colors">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${
                      tx.type === "allocation" ? "bg-blue-500" :
                      tx.type === "overage_approved" ? "bg-amber-500" :
                      "bg-red-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{tx.description}</p>
                      <p className="text-xs text-text-tertiary">{formatTxDate(tx.date)}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-medium ${tx.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {tx.amount < 0 ? "-" : "+"}{formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit button */}
          {isAdmin && (
            <div className="flex justify-end pt-2 border-t border-border">
              <Button size="sm" variant="secondary" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5" />
                Edit Pool
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Budget Pools Tab ───
function BudgetPoolsTab({ isAdmin }: { isAdmin: boolean }) {
  const { data: rawPools, mutate } = useSWR<BudgetPoolSummary[]>("/api/budget", fetcher);
  const pools: BudgetPoolSummary[] = Array.isArray(rawPools) ? rawPools : [];
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPool, setSelectedPool] = useState<BudgetPoolSummary | null>(null);

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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pools.map((pool) => {
            const pctUsed =
              pool.totalAmount > 0
                ? Math.round((pool.allocated / pool.totalAmount) * 100)
                : 0;
            const fmtPeriod = (d: string) => {
              const [y, m, day] = d.split("-");
              const dt = new Date(Number(y), Number(m) - 1, Number(day));
              return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            };

            return (
              <Card key={pool.id} padding="none" className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => setSelectedPool(pool)}>
                <div className="px-3.5 py-2.5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">{pool.name}</p>
                    <span className="text-[10px] text-text-tertiary">{fmtPeriod(pool.periodStart)} — {fmtPeriod(pool.periodEnd)}</span>
                  </div>
                </div>
                <div className="px-3.5 py-3 space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text-secondary">{formatCurrency(pool.allocated)} of {formatCurrency(pool.totalAmount)}</span>
                      <span className="font-medium text-text-primary">{pctUsed}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(pctUsed, 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-text-tertiary">Remaining <span className="font-semibold text-emerald-600">{formatCurrency(pool.remaining)}</span></span>
                    <span className="text-text-tertiary">Committed <span className="font-semibold text-text-primary">{formatCurrency(pool.committed)}</span></span>
                    <span className="text-text-tertiary">Spent <span className="font-semibold text-text-primary">{formatCurrency(pool.spent)}</span></span>
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

      <PoolDetailModal
        pool={selectedPool}
        open={!!selectedPool}
        onClose={() => setSelectedPool(null)}
        onUpdated={() => { mutate(); setSelectedPool(null); }}
        isAdmin={isAdmin}
      />
    </>
  );
}

// ─── Campaign Budgets Tab ───
function CampaignBudgetsTab() {
  const { toast } = useToast();
  const { data: campaigns, mutate } = useSWR<CampaignListItem[]>("/api/campaigns", fetcher);
  const { data: allUsers } = useSWR<Array<{ id: string; name: string; role: string }>>(
    "/api/users?roles=Admin,Producer",
    fetcher
  );
  const producers = (allUsers || []).filter((u) => u.role === "Admin" || u.role === "Producer" || u.role === "Post Producer");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editAll, setEditAll] = useState(false);
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const activeCampaigns = (campaigns || []).filter(
    (c) => c.status !== "Complete" && c.status !== "Cancelled"
  );

  async function changeProducer(campaignId: string, producerId: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producerId: producerId || null }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Producer updated");
      mutate();
    } catch {
      toast("error", "Failed to update producer");
    }
  }

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
          <div className="flex items-center gap-2 px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
            <div className="w-[72px] shrink-0">WF#</div>
            <div className="flex-1">Campaign</div>
            <div className="w-[72px] shrink-0 text-right">Committed</div>
            <div className="w-24 shrink-0 text-right">Budget</div>
            {!editAll && <div className="w-8 shrink-0" />}
          </div>

          {/* Table rows */}
          {activeCampaigns.map((c) => {
            const isEditing = editAll || editingId === c.id;
            const currentValue = editAll ? (bulkValues[c.id] ?? String(c.productionBudget)) : editValue;
            const producerName = producers.find((p) => p.id === c.producerId)?.name;
            return (
              <div
                key={c.id}
                className="group flex items-center gap-2 px-3.5 py-2 border-b border-border last:border-b-0 hover:bg-surface-secondary/50 transition-colors"
              >
                <div className="w-[72px] shrink-0 text-xs text-text-tertiary">
                  {c.wfNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="text-sm font-medium text-text-primary hover:text-primary transition-colors truncate"
                    >
                      {c.name}
                    </Link>
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
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <select
                      value={c.producerId || ""}
                      onChange={(e) => { e.stopPropagation(); changeProducer(c.id, e.target.value); }}
                      className="h-5 rounded border-0 bg-transparent px-0 text-xs text-text-tertiary focus:outline-none focus:ring-0 cursor-pointer hover:text-text-primary"
                    >
                      <option value="">Unassigned</option>
                      {producers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {c.additionalFundsRequested > 0 && (
                      <span className="text-[10px] font-medium text-amber-600">+{formatCurrency(c.additionalFundsRequested)} pending</span>
                    )}
                    {c.additionalFundsApproved > 0 && (
                      <span className="text-[10px] font-medium text-emerald-600">+{formatCurrency(c.additionalFundsApproved)} approved</span>
                    )}
                  </div>
                </div>
                <div className="w-[72px] shrink-0 text-right text-xs text-text-secondary tabular-nums">
                  {formatCurrency(c.committed || 0)}
                </div>
                <div className="w-24 shrink-0 text-right">
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
                      className="w-full rounded-lg border border-primary bg-surface px-2 py-1 text-sm text-right text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-text-primary tabular-nums">
                      {formatCurrency(c.productionBudget)}
                    </span>
                  )}
                </div>
                {!editAll && (
                  <div className="w-8 shrink-0 flex justify-end">
                    {editingId === c.id ? (
                      <div className="flex gap-1">
                        <button onClick={cancelEdit} disabled={saving} className="text-text-tertiary hover:text-text-primary">
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => saveBudget(c.id)} className="text-primary hover:text-primary/80">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(c)} className="text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100">
                        <Pencil className="h-3 w-3" />
                      </button>
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

// ─── Cost Report Section ───
// Replaces the prior Analysis + Spending tabs. One canonical report with the
// production-accountant column set (Budget / Committed / Invoiced / Paid /
// EFC / Variance), sliceable three ways via filter pills. Crew deal memos
// live inside the Crew Labor row of "By Category" — that's what they
// structurally are.
type CostSlice = "category" | "vendor" | "quarter";

function CostReportSection() {
  const { data, isLoading } = useSWR<AnalysisData>("/api/budget/analysis", fetcher);
  const { data: crewBookings = [] } = useSWR<CrewBookingRow[]>("/api/budget?type=crew", fetcher);
  const [slice, setSlice] = useState<CostSlice>("category");
  const [drilldown, setDrilldown] = useState<{ type: "vendor" | "category"; id: string; label: string } | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<CrewBookingRow | null>(null);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-secondary" />
        ))}
      </div>
    );
  }

  const { summary, categoryBreakdown, vendorBreakdown, quarterlyTrend, overageSummary } = data;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CostKpi
          label="Estimate Accuracy"
          value={`${summary.estimateAccuracyPct > 0 ? "+" : ""}${summary.estimateAccuracyPct}%`}
          tone={Math.abs(summary.estimateAccuracyPct) <= 5 ? "success" : Math.abs(summary.estimateAccuracyPct) <= 15 ? "warning" : "error"}
          caption="invoice vs. estimate"
        />
        <CostKpi
          label="Vendor Concentration"
          value={`${summary.vendorConcentrationPct}%`}
          tone={summary.vendorConcentrationPct > 70 ? "warning" : "default"}
          caption="top 3 vendors"
        />
        <CostKpi
          label="Avg Cost / Shoot Day"
          value={summary.avgCostPerShootDay !== null ? formatCurrency(summary.avgCostPerShootDay) : "—"}
          tone="default"
          caption={`${summary.totalShootDays} shoot days YTD`}
        />
        <CostKpi
          label="Budget Adjustments"
          value={formatCurrency(overageSummary.totalApproved)}
          tone="default"
          caption={`${overageSummary.approvedCount} approved · ${overageSummary.declinedCount} declined`}
        />
      </div>

      {/* Slice filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">View:</span>
        {(["category", "vendor", "quarter"] as CostSlice[]).map((s) => (
          <button
            key={s}
            onClick={() => setSlice(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              slice === s
                ? "bg-primary text-white"
                : "bg-surface-secondary text-text-secondary hover:text-text-primary"
            }`}
          >
            By {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Cost Report Table */}
      {slice === "category" && (
        <CategoryCostReport
          rows={categoryBreakdown}
          crewBookings={crewBookings}
          expanded={expandedCategory}
          onToggleExpand={(name) => setExpandedCategory(expandedCategory === name ? null : name)}
          onDrilldown={(category) => setDrilldown({ type: "category", id: category, label: category })}
          onEditBooking={setEditingBooking}
        />
      )}
      {slice === "vendor" && (
        <VendorCostReport
          rows={vendorBreakdown}
          onDrilldown={(v) => setDrilldown({ type: "vendor", id: v.id, label: v.name })}
        />
      )}
      {slice === "quarter" && <QuarterCostReport rows={quarterlyTrend} />}

      {drilldown && (
        <TransactionDrilldownModal
          type={drilldown.type}
          id={drilldown.id}
          label={drilldown.label}
          onClose={() => setDrilldown(null)}
        />
      )}

      {editingBooking && (
        <CrewBookingEditModal booking={editingBooking} onClose={() => setEditingBooking(null)} />
      )}
    </div>
  );
}

function CostKpi({
  label, value, tone = "default", caption,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "error";
  caption?: string;
}) {
  const toneColor =
    tone === "success" ? "text-emerald-600" :
    tone === "warning" ? "text-amber-600" :
    tone === "error" ? "text-red-600" :
    "text-text-primary";
  return (
    <Card padding="none">
      <div className="px-3.5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
        <p className={`mt-1 text-xl font-bold ${toneColor}`}>{value}</p>
        {caption && <p className="mt-0.5 text-[10px] text-text-tertiary">{caption}</p>}
      </div>
    </Card>
  );
}

// ─── By Category — with Crew Labor expandable for Deal Memos ───
function CategoryCostReport({
  rows,
  crewBookings,
  expanded,
  onToggleExpand,
  onDrilldown,
  onEditBooking,
}: {
  rows: AnalysisData["categoryBreakdown"];
  crewBookings: CrewBookingRow[];
  expanded: string | null;
  onToggleExpand: (name: string) => void;
  onDrilldown: (category: string) => void;
  onEditBooking: (b: CrewBookingRow) => void;
}) {
  const totals = rows.reduce(
    (a, r) => ({
      estimated: a.estimated + r.estimated,
      invoiced: a.invoiced + r.invoiced,
      efc: a.efc + r.efc,
    }),
    { estimated: 0, invoiced: 0, efc: 0 }
  );

  return (
    <Card padding="none">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Layers className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Cost Report — By Category</span>
        <span className="ml-auto text-[10px] text-text-tertiary">{rows.length} categories</span>
      </div>
      <div className="hidden md:grid grid-cols-[1fr_110px_110px_110px_90px] gap-3 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-secondary/40">
        <div>Category</div>
        <div className="text-right">Estimated</div>
        <div className="text-right">Invoiced</div>
        <div className="text-right">EFC</div>
        <div className="text-right">Variance</div>
      </div>
      <div className="divide-y divide-border">
        {rows.length === 0 ? (
          <div className="px-3.5 py-6">
            <EmptyState icon={<Layers className="h-5 w-5" />} title="No category data yet" description="Category spending appears as estimates and invoices are processed." />
          </div>
        ) : (
          rows.map((r) => {
            const isCrew = r.category === "Crew Labor";
            const isOpen = expanded === r.category;
            return (
              <div key={r.category}>
                <div
                  onClick={() => isCrew ? onToggleExpand(r.category) : onDrilldown(r.category)}
                  className="grid grid-cols-2 md:grid-cols-[1fr_110px_110px_110px_90px] gap-3 px-3.5 py-2.5 items-center cursor-pointer hover:bg-surface-secondary/40"
                >
                  <div className="col-span-2 md:col-span-1 min-w-0 flex items-center gap-2">
                    {isCrew && (isOpen ? <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" /> : <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />)}
                    <p className="text-sm font-medium text-text-primary truncate">{r.category}</p>
                  </div>
                  <div className="text-right text-sm text-text-secondary">{formatCurrency(r.estimated)}</div>
                  <div className="text-right text-sm text-text-secondary">{formatCurrency(r.invoiced)}</div>
                  <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(r.efc)}</div>
                  <div className={`text-right text-xs font-medium ${
                    r.variancePct === 0 ? "text-text-secondary" : r.variancePct > 0 ? "text-red-600" : "text-emerald-600"
                  }`}>
                    {r.variancePct !== 0 && (
                      <>
                        {r.variancePct > 0 ? "+" : ""}{r.variancePct}%
                      </>
                    )}
                  </div>
                </div>

                {isCrew && isOpen && (
                  <CrewDealMemosInline bookings={crewBookings} onEdit={onEditBooking} />
                )}
              </div>
            );
          })
        )}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-[1fr_110px_110px_110px_90px] gap-3 px-3.5 py-2.5 items-center bg-surface-secondary/60 border-t-2 border-border">
            <div className="col-span-2 md:col-span-1 text-[10px] font-semibold uppercase tracking-wider text-text-primary">Total</div>
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.estimated)}</div>
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.invoiced)}</div>
            <div className="text-right text-sm font-bold text-text-primary">{formatCurrency(totals.efc)}</div>
            <div className={`text-right text-xs font-semibold ${totals.efc > totals.estimated ? "text-red-600" : "text-emerald-600"}`}>
              {totals.estimated > 0 ? `${((totals.efc - totals.estimated) / totals.estimated * 100).toFixed(1)}%` : "—"}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function CrewDealMemosInline({
  bookings,
  onEdit,
}: {
  bookings: CrewBookingRow[];
  onEdit: (b: CrewBookingRow) => void;
}) {
  if (bookings.length === 0) {
    return (
      <div className="bg-surface-secondary/40 border-t border-border px-5 py-3">
        <p className="text-xs text-text-tertiary">No crew bookings yet.</p>
      </div>
    );
  }
  return (
    <div className="bg-surface-secondary/40 border-t border-border">
      <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border">
        <HardHat className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Crew Deal Memos</span>
        <span className="ml-auto text-[10px] text-text-tertiary">{bookings.length} memos</span>
      </div>
      <div className="divide-y divide-border">
        {bookings.map((b) => {
          const personName = b.vendor ? (b.vendor.contactName || b.vendor.companyName) : (b.user?.name || "Unknown");
          const days = b.payment?.totalDays ?? b.confirmedDays ?? b.plannedDays ?? 0;
          const amount = b.payment?.totalAmount ?? b.totalAmount ?? 0;
          const statusLabel = b.payment?.status ?? b.status;
          const statusVariant: "success" | "warning" | "info" | "default" =
            statusLabel === "Paid" ? "success" :
            statusLabel === "Pending Approval" ? "warning" :
            statusLabel === "Approved" || statusLabel === "Sent to Paymaster" ? "info" :
            "default";
          const locked = b.payment?.status === "Approved" || b.payment?.status === "Sent to Paymaster" || b.payment?.status === "Paid";
          return (
            <div
              key={b.id}
              onClick={() => !locked && onEdit(b)}
              className={`grid grid-cols-[1fr_120px_90px_60px_100px_110px] gap-3 px-5 py-2 items-center ${locked ? "" : "cursor-pointer hover:bg-surface"}`}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{personName}</p>
                <p className="text-[10px] text-text-tertiary">{b.role}</p>
              </div>
              <div className="text-[10px] text-text-secondary">{b.classification}</div>
              <div className="text-right text-xs text-text-secondary">{formatCurrency(b.dayRate)}/day</div>
              <div className="text-right text-[10px] text-text-tertiary">{days} day{days !== 1 ? "s" : ""}</div>
              <div className="text-right text-xs font-semibold text-text-primary">{formatCurrency(amount)}</div>
              <div className="text-right">
                <Badge variant={statusVariant}>{statusLabel}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── By Vendor ───
function VendorCostReport({
  rows,
  onDrilldown,
}: {
  rows: AnalysisData["vendorBreakdown"];
  onDrilldown: (v: AnalysisData["vendorBreakdown"][number]) => void;
}) {
  const totals = rows.reduce(
    (a, r) => ({
      committed: a.committed + r.estimateTotal,
      invoiced: a.invoiced + r.invoiceTotal,
      paid: a.paid + r.paidTotal,
      efc: a.efc + r.efc,
    }),
    { committed: 0, invoiced: 0, paid: 0, efc: 0 }
  );

  return (
    <Card padding="none">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Users className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Cost Report — By Vendor</span>
        <span className="ml-auto text-[10px] text-text-tertiary">{rows.length} vendors</span>
      </div>
      <div className="hidden md:grid grid-cols-[1fr_60px_110px_110px_110px_110px_90px] gap-3 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-secondary/40">
        <div>Vendor</div>
        <div className="text-center">Camp.</div>
        <div className="text-right">Committed</div>
        <div className="text-right">Invoiced</div>
        <div className="text-right">Paid</div>
        <div className="text-right">EFC</div>
        <div className="text-right">Variance</div>
      </div>
      <div className="divide-y divide-border">
        {rows.length === 0 ? (
          <div className="px-3.5 py-6">
            <EmptyState icon={<Users className="h-5 w-5" />} title="No vendor data yet" description="Vendor spending appears as estimates and invoices are processed." />
          </div>
        ) : (
          rows.map((v) => (
            <div
              key={v.id}
              onClick={() => onDrilldown(v)}
              className="grid grid-cols-2 md:grid-cols-[1fr_60px_110px_110px_110px_110px_90px] gap-3 px-3.5 py-2.5 items-center cursor-pointer hover:bg-surface-secondary/40"
            >
              <div className="col-span-2 md:col-span-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{v.name}</p>
                <p className="text-[10px] text-text-tertiary truncate">{v.category}</p>
              </div>
              <div className="text-center text-sm text-text-secondary">{v.campaignCount}</div>
              <div className="text-right text-sm text-text-secondary">{formatCurrency(v.estimateTotal)}</div>
              <div className="text-right text-sm text-text-secondary">{formatCurrency(v.invoiceTotal)}</div>
              <div className="text-right text-sm text-text-secondary">{formatCurrency(v.paidTotal)}</div>
              <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(v.efc)}</div>
              <div className={`text-right text-xs font-medium ${
                v.variancePct === 0 ? "text-text-secondary" : v.variancePct > 0 ? "text-red-600" : "text-emerald-600"
              }`}>
                {v.variancePct !== 0 && <>{v.variancePct > 0 ? "+" : ""}{v.variancePct}%</>}
              </div>
            </div>
          ))
        )}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-[1fr_60px_110px_110px_110px_110px_90px] gap-3 px-3.5 py-2.5 items-center bg-surface-secondary/60 border-t-2 border-border">
            <div className="col-span-2 md:col-span-1 text-[10px] font-semibold uppercase tracking-wider text-text-primary">Total</div>
            <div />
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.committed)}</div>
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.invoiced)}</div>
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.paid)}</div>
            <div className="text-right text-sm font-bold text-text-primary">{formatCurrency(totals.efc)}</div>
            <div />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── By Quarter ───
function QuarterCostReport({ rows }: { rows: AnalysisData["quarterlyTrend"] }) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Cost Report — By Quarter</span>
        <span className="ml-auto text-[10px] text-text-tertiary">{rows.length} quarters</span>
      </div>
      <div className="hidden md:grid grid-cols-[1fr_120px_120px_120px] gap-3 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-secondary/40">
        <div>Quarter</div>
        <div className="text-right">Estimated</div>
        <div className="text-right">Invoiced</div>
        <div className="text-right">Paid</div>
      </div>
      <div className="divide-y divide-border">
        {rows.length === 0 ? (
          <div className="px-3.5 py-6">
            <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="No quarterly data yet" description="Quarterly trend will appear as bookings and invoices accumulate." />
          </div>
        ) : (
          rows.map((q) => (
            <div key={q.quarter} className="grid grid-cols-2 md:grid-cols-[1fr_120px_120px_120px] gap-3 px-3.5 py-2.5 items-center">
              <div className="col-span-2 md:col-span-1 text-sm font-medium text-text-primary">{q.quarter}</div>
              <div className="text-right text-sm text-text-secondary">{formatCurrency(q.estimated)}</div>
              <div className="text-right text-sm text-text-secondary">{formatCurrency(q.invoiced)}</div>
              <div className="text-right text-sm font-semibold text-emerald-600">{formatCurrency(q.paid)}</div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

// ─── Crew Booking Edit Modal (extracted from old SpendingTab) ───
function CrewBookingEditModal({
  booking,
  onClose,
}: {
  booking: CrewBookingRow;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    role: booking.role,
    dayRate: String(booking.dayRate),
    classification: booking.classification,
    notes: booking.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const personName = booking.vendor
    ? booking.vendor.contactName || booking.vendor.companyName
    : booking.user?.name || "";

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/crew-bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: draft.role,
          dayRate: Number(draft.dayRate),
          classification: draft.classification,
          notes: draft.notes,
        }),
      });
      if (!res.ok) throw new Error();
      toast("success", "Deal memo updated");
      onClose();
    } catch {
      toast("error", "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit Deal Memo — ${personName}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">Role</label>
            <input
              type="text"
              value={draft.role}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">Day Rate</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">$</span>
              <input
                type="number"
                value={draft.dayRate}
                onChange={(e) => setDraft((d) => ({ ...d, dayRate: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface pl-6 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">Classification</label>
          <select
            value={draft.classification}
            onChange={(e) => setDraft((d) => ({ ...d, classification: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">Notes</label>
          <input
            type="text"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Optional notes…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          <Check className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ─── Old AnalysisTab (kept for type re-use) ───
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
    totalEfc: number;
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
    invoiced: number; spent: number; efc: number; remaining: number;
    campaignCount: number; utilizationPct: number;
  }>;
  categoryBreakdown: Array<{
    category: string; estimated: number; invoiced: number; efc: number;
    variance: number; variancePct: number;
  }>;
  vendorBreakdown: Array<{
    id: string; name: string; category: string;
    estimateTotal: number; invoiceTotal: number; paidTotal: number; efc: number;
    campaignCount: number; assignmentCount: number;
    variance: number; variancePct: number;
  }>;
  campaignAnalysis: Array<{
    id: string; wfNumber: string; name: string; status: string;
    budgetPoolId: string | null;
    budget: number; committed: number; invoiced: number; spent: number; efc: number;
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


// ─── Transaction Drilldown Modal ───
function TransactionDrilldownModal({
  type,
  id,
  label,
  onClose,
}: {
  type: "vendor" | "category";
  id: string;
  label: string;
  onClose: () => void;
}) {
  const param = type === "vendor" ? `vendorId=${id}` : `category=${encodeURIComponent(id)}`;
  const { data, isLoading } = useSWR<any>(`/api/budget/transactions?${param}`, fetcher);

  const transactions = data?.transactions || [];

  return (
    <Modal open onClose={onClose} title={`${label} — Recent Transactions`} size="lg">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-secondary" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center">
            <Receipt className="mx-auto h-8 w-8 text-text-tertiary/40" />
            <p className="mt-2 text-sm text-text-tertiary">No transactions found</p>
          </div>
        ) : type === "vendor" ? (
          /* ─── Vendor transactions: grouped by campaign ─── */
          transactions.map((t: any) => (
            <div key={t.campaignVendorId} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface-secondary/40 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-sm font-medium text-text-primary truncate">
                    {t.wfNumber ? `${t.wfNumber} ` : ""}{t.campaignName}
                  </span>
                </div>
                <Badge variant={
                  t.status === "Paid" ? "success" :
                  t.status?.includes("Invoice") ? "warning" : "default"
                }>
                  {t.status}
                </Badge>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span>Est: <strong className="text-text-primary">{formatCurrency(t.estimateTotal)}</strong></span>
                  <span>Inv: <strong className="text-text-primary">{formatCurrency(t.invoiceTotal)}</strong></span>
                  {t.paidAmount > 0 && (
                    <span>Paid: <strong className="text-emerald-600">{formatCurrency(t.paidAmount)}</strong></span>
                  )}
                  {t.paidDate && (
                    <span className="text-text-tertiary">
                      {new Date(t.paidDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
                {t.invoices?.length > 0 && t.invoices.map((inv: any) => (
                  <div key={inv.id} className="ml-2 pl-3 border-l-2 border-border space-y-1">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-3 w-3 text-text-tertiary" />
                      <span className="text-xs font-medium text-text-secondary">{inv.fileName || "Invoice"}</span>
                      <span className="text-[10px] text-text-tertiary">
                        {new Date(inv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      {inv.hopApproved && <Badge variant="success" className="text-[10px] py-0">HOP Approved</Badge>}
                      {inv.producerApproved && !inv.hopApproved && <Badge variant="warning" className="text-[10px] py-0">Producer Approved</Badge>}
                    </div>
                    {inv.lineItems?.length > 0 && (
                      <div className="space-y-0.5">
                        {inv.lineItems.map((li: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs pl-5">
                            <span className={`text-text-secondary ${li.flagged ? "text-amber-600" : ""}`}>
                              {li.flagged && <AlertTriangle className="inline h-2.5 w-2.5 mr-1" />}
                              {li.description || li.category || "Line item"}
                            </span>
                            <span className="font-medium text-text-primary">{formatCurrency(li.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          /* ─── Category transactions: flat list of line items ─── */
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
              <div className="flex-1">Description</div>
              <div className="w-28 shrink-0">Vendor</div>
              <div className="w-36 shrink-0">Campaign</div>
              <div className="w-20 shrink-0 text-right">Amount</div>
            </div>
            {transactions.map((t: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-surface-secondary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${t.flagged ? "text-amber-600 font-medium" : "text-text-primary"}`}>
                    {t.flagged && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                    {t.description || "Line item"}
                  </span>
                  {t.invoiceFileName && (
                    <p className="text-[10px] text-text-tertiary truncate">{t.invoiceFileName}</p>
                  )}
                </div>
                <div className="w-28 shrink-0 text-xs text-text-secondary truncate">{t.vendorName}</div>
                <div className="w-36 shrink-0 text-xs text-text-secondary truncate">
                  {t.wfNumber ? `${t.wfNumber} ` : ""}{t.campaignName}
                </div>
                <div className="w-20 shrink-0 text-right text-sm font-medium text-text-primary">
                  {formatCurrency(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </ModalFooter>
    </Modal>
  );
}


// ─── Onboarding Tab ───
function OnboardingTab() {
  const { data: overview = [], isLoading, mutate } = useSWR<Array<{
    vendorId: string;
    vendorName: string;
    status: "complete" | "partial" | "none";
    completedCount: number;
    totalCount: number;
    items: Array<{
      id: string;
      itemName: string;
      completed: boolean;
      completedDate: string | null;
      expiresAt: string | null;
      notes: string;
    }>;
  }>>("/api/onboarding", fetcher);

  const { toast } = useToast();
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleToggle(vendorId: string, itemId: string, completed: boolean) {
    setSaving(itemId);
    try {
      await fetch(`/api/onboarding/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          completed,
          completedDate: completed ? new Date().toISOString().split("T")[0] : null,
        }),
      });
      mutate();
    } catch {
      toast("error", "Failed to update onboarding item");
    } finally {
      setSaving(null);
    }
  }

  const STATUS_ICON = {
    complete: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
    partial:  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
    none:     <Circle className="h-4 w-4 text-red-400 shrink-0" />,
  };

  const STATUS_LABEL = {
    complete: "Onboarded",
    partial:  "In Progress",
    none:     "Not Started",
  };

  const STATUS_STYLE = {
    complete: "text-emerald-700 bg-emerald-50",
    partial:  "text-amber-700 bg-amber-50",
    none:     "text-red-700 bg-red-50",
  };

  const notComplete = overview.filter((v) => v.status !== "complete");
  const complete = overview.filter((v) => v.status === "complete");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-text-tertiary" />
          Paymaster Onboarding
          {notComplete.length > 0 && (
            <Badge variant="warning">{notComplete.length} incomplete</Badge>
          )}
        </CardTitle>
      </CardHeader>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-surface-secondary mx-3 mb-3" />
      ) : overview.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-5 w-5" />}
          title="No crew booked yet"
          description="Onboarding status for booked crew will appear here."
        />
      ) : (
        <div className="divide-y divide-border">
          {[...notComplete, ...complete].map((vendor) => (
            <div key={vendor.vendorId}>
              <button
                type="button"
                onClick={() =>
                  setExpandedVendor(expandedVendor === vendor.vendorId ? null : vendor.vendorId)
                }
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-secondary transition-colors"
              >
                {expandedVendor === vendor.vendorId
                  ? <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
                }
                {STATUS_ICON[vendor.status]}
                <span className="flex-1 text-sm font-medium text-text-primary">
                  {vendor.vendorName}
                </span>
                <span className="text-[10px] text-text-tertiary mr-2">
                  {vendor.completedCount}/{vendor.totalCount} items
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[vendor.status]}`}>
                  {STATUS_LABEL[vendor.status]}
                </span>
              </button>

              {expandedVendor === vendor.vendorId && (
                <div className="border-t border-border bg-surface-secondary divide-y divide-border">
                  {vendor.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-2.5"
                    >
                      <button
                        type="button"
                        disabled={saving === item.id}
                        onClick={() => handleToggle(vendor.vendorId, item.id, !item.completed)}
                        className="shrink-0 transition-opacity disabled:opacity-50"
                      >
                        {item.completed
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          : <Circle className="h-4 w-4 text-text-tertiary" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${item.completed ? "text-text-tertiary line-through" : "text-text-primary"}`}>
                          {item.itemName}
                        </p>
                        {item.completedDate && (
                          <p className="text-[10px] text-text-tertiary">
                            Completed {new Date(item.completedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

type CrewBookingRow = {
  id: string;
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  role: string;
  dayRate: number;
  classification: string;
  status: string;
  plannedDays: number;
  confirmedDays: number;
  totalAmount: number;
  notes?: string;
  vendor?: { contactName: string; companyName: string };
  user?: { name: string };
  payment?: { status: string; totalDays: number; totalAmount: number };
};

const CLASSIFICATIONS = ["1099", "Paymaster", "W-2 via Paymaster", "Loan Out"];


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

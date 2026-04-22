"use client";

import { useState } from "react";
import {
  Inbox,
  Layers,
  FileBarChart2,
  Users,
  DollarSign,
  AlertTriangle,
  Receipt,
  HardHat,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  FileSignature,
  UserCheck,
  Activity,
  Building2,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTabs } from "@/components/ui/page-tabs";
import { formatCurrency } from "@/lib/utils/format";

type Tab = "queue" | "program" | "cost-report" | "vendors";

const TABS = [
  { key: "queue" as const, label: "Queue", icon: Inbox },
  { key: "program" as const, label: "Program", icon: Layers },
  { key: "cost-report" as const, label: "Cost Report", icon: FileBarChart2 },
  { key: "vendors" as const, label: "Vendors", icon: Users },
];

const SECTION_NOTES: Record<Tab, string> = {
  queue: "Action surface — clear the interrupts, review what changed this week.",
  program: "Portfolio view — pools at the top, the campaigns they fund underneath.",
  "cost-report": "Weekly cost report — canonical Budget / Committed / Invoiced / Paid / EFC / Variance, sliceable three ways.",
  vendors: "Vendor lifecycle + paymaster onboarding — two sides of the same relationship.",
};

export default function BudgetMockPage() {
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div className="space-y-6">
      <div className="space-y-0">
        <div className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-text-primary">Budget</h1>
                <Badge variant="info">Mockup</Badge>
              </div>
              <p className="mt-1 text-xs text-text-tertiary">
                Proposed 4-section restructure for HOP role. Data is illustrative.
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-text-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live preview · not wired
            </div>
          </div>
        </div>
        <PageTabs tabs={TABS} activeTab={tab} onTabChange={(k) => setTab(k as Tab)} />
        <p className="mt-3 text-xs text-text-secondary italic">{SECTION_NOTES[tab]}</p>
      </div>

      {tab === "queue" && <QueueView />}
      {tab === "program" && <ProgramView />}
      {tab === "cost-report" && <CostReportView />}
      {tab === "vendors" && <VendorsView />}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 1. QUEUE — the action surface
// ──────────────────────────────────────────────────────────────────────

const QUEUE_COUNTERS = [
  { key: "overages", label: "Overages", count: 2, amount: 18500, icon: AlertTriangle, tone: "warning" },
  { key: "invoices", label: "Invoices", count: 5, amount: 74200, icon: Receipt, tone: "info" },
  { key: "rates", label: "Rate Approvals", count: 1, amount: 3400, icon: FileSignature, tone: "warning" },
  { key: "payments", label: "Crew Payments", count: 3, amount: 42600, icon: HardHat, tone: "info" },
] as const;

const CHANGED_THIS_WEEK = [
  { kind: "po-signed", text: "3 POs signed", detail: "Fresh Focus Photography · Midwest Grip · Atelier Food Styling", amount: 57800 },
  { kind: "new-overage", text: "New overage request", detail: "Holiday Cookie Collection · +$8,500 · submitted by Laura", amount: 8500 },
  { kind: "rate-exception", text: "Above-standard rate", detail: "Director — Valentine Floral · $3,400/day (vs. $2,800 card)", amount: 3400 },
  { kind: "shoots-done", text: "2 shoots wrapped", detail: "Spring Grilling · Summer Berry Harvest", amount: null },
];

const OVERAGE_ROWS = [
  { id: "1", campaign: "Holiday Cookie Collection", wf: "WF402851", amount: 8500, reason: "Additional set build for 6 hero shots", requester: "Laura B.", submitted: "2d ago" },
  { id: "2", campaign: "Fall Bakery Favorites", wf: "WF402709", amount: 10000, reason: "Wardrobe expansion — 4 new talent", requester: "Marcus T.", submitted: "5d ago" },
];

const INVOICE_ROWS = [
  { id: "1", vendor: "Fresh Focus Photography", campaign: "Spring Grilling 2026", wf: "WF402902", amount: 24500, estimate: 24000, flagged: false },
  { id: "2", vendor: "Atelier Food Styling", campaign: "Summer Berry Harvest", wf: "WF402865", amount: 18200, estimate: 16800, flagged: true },
  { id: "3", vendor: "Cast Iron Studios", campaign: "Fall Bakery Favorites", wf: "WF402709", amount: 12800, estimate: 12800, flagged: false },
  { id: "4", vendor: "Prop House Midwest", campaign: "Holiday Cookie Collection", wf: "WF402851", amount: 8400, estimate: 8000, flagged: false },
  { id: "5", vendor: "Harvest Craft Services", campaign: "Spring Grilling 2026", wf: "WF402902", amount: 10300, estimate: 9500, flagged: true },
];

function QueueView() {
  return (
    <div className="space-y-6">
      {/* Counter strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUEUE_COUNTERS.map((c) => {
          const Icon = c.icon;
          const toneColor = c.tone === "warning" ? "text-amber-600" : "text-blue-600";
          return (
            <Card key={c.key} padding="none">
              <div className="px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <Icon className={`h-4 w-4 ${toneColor}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${toneColor}`}>
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

      {/* What Changed This Week */}
      <Card padding="none">
        <CardHeader>
          <CardTitle>
            <Sparkles />
            What Changed This Week
          </CardTitle>
          <span className="text-[10px] text-text-tertiary">Apr 14 — Apr 20</span>
        </CardHeader>
        <div className="divide-y divide-border">
          {CHANGED_THIS_WEEK.map((e, i) => (
            <div key={i} className="flex items-start gap-3 px-3.5 py-2.5">
              <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{e.text}</p>
                <p className="text-xs text-text-tertiary">{e.detail}</p>
              </div>
              {e.amount !== null && (
                <span className="text-sm font-semibold text-text-primary shrink-0">
                  {formatCurrency(e.amount)}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Overage Requests */}
      <Card padding="none">
        <CardHeader>
          <CardTitle>
            <AlertTriangle />
            Budget Overage Requests
            <Badge variant="warning">{OVERAGE_ROWS.length}</Badge>
          </CardTitle>
        </CardHeader>
        <div className="divide-y divide-border">
          {OVERAGE_ROWS.map((r) => (
            <div key={r.id} className="px-3.5 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-text-tertiary">{r.wf}</span>
                    <span className="text-sm font-medium text-text-primary">{r.campaign}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">{r.reason}</p>
                  <p className="mt-1 text-[10px] text-text-tertiary">
                    Requested by {r.requester} · {r.submitted}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-text-primary">+{formatCurrency(r.amount)}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <Button size="sm" variant="ghost" className="text-red-600">Decline</Button>
                    <Button size="sm">Approve</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pending Invoices */}
      <Card padding="none">
        <CardHeader>
          <CardTitle>
            <Receipt />
            Pending Invoices
            <Badge variant="info">{INVOICE_ROWS.length}</Badge>
          </CardTitle>
        </CardHeader>
        <div className="hidden sm:grid grid-cols-[1fr_1fr_100px_100px_80px_120px] gap-3 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border">
          <div>Vendor</div>
          <div>Campaign</div>
          <div className="text-right">Estimate</div>
          <div className="text-right">Invoice</div>
          <div className="text-right">Δ</div>
          <div />
        </div>
        <div className="divide-y divide-border">
          {INVOICE_ROWS.map((r) => {
            const delta = r.amount - r.estimate;
            const deltaPct = Math.round((delta / r.estimate) * 100);
            return (
              <div key={r.id} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_100px_100px_80px_120px] gap-3 px-3.5 py-2.5 items-center">
                <div className="col-span-2 sm:col-span-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{r.vendor}</p>
                  {r.flagged && (
                    <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      Over estimate
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-text-secondary truncate">{r.campaign}</p>
                  <p className="text-[10px] font-mono text-text-tertiary">{r.wf}</p>
                </div>
                <div className="text-right text-xs text-text-secondary">{formatCurrency(r.estimate)}</div>
                <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(r.amount)}</div>
                <div className="text-right">
                  {delta !== 0 && (
                    <span className={`text-xs font-medium ${delta > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {delta > 0 ? "+" : ""}{deltaPct}%
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 justify-end">
                  <Button size="sm" variant="ghost">Review</Button>
                  <Button size="sm">Approve</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Rate Approvals & Crew Payments — condensed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="none">
          <CardHeader>
            <CardTitle>
              <FileSignature />
              Rate Approvals
              <Badge variant="warning">1</Badge>
            </CardTitle>
          </CardHeader>
          <div className="px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Director — Valentine Floral</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">Card rate: $2,800/day · Requested: $3,400/day</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-amber-600">+21%</p>
                <Button size="sm" className="mt-1.5">Approve</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card padding="none">
          <CardHeader>
            <CardTitle>
              <HardHat />
              Crew Payments
              <Badge variant="info">3</Badge>
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-border">
            {[
              { name: "Jenna Rios", role: "1st AC", days: 4, amount: 14000 },
              { name: "Daniel Park", role: "Gaffer", days: 5, amount: 18500 },
              { name: "Alex Monroe", role: "Stylist Asst.", days: 3, amount: 10100 },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                  <p className="text-[10px] text-text-tertiary">{p.role} · {p.days} days</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-text-primary">{formatCurrency(p.amount)}</span>
                  <Button size="sm">Send</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 2. PROGRAM — portfolio view: pools + campaigns
// ──────────────────────────────────────────────────────────────────────

type CampaignRow = {
  id: string;
  wf: string;
  name: string;
  status: "Planning" | "In Production" | "Post" | "Complete";
  producer: string;
  budget: number;
  committed: number;
  invoiced: number;
  paid: number;
  efc: number;
  overage: "none" | "pending" | "approved";
};

const POOLS = [
  {
    id: "p1",
    name: "Q2 2026 — Fresh & Seasonal",
    period: "Apr 1 — Jun 30, 2026",
    total: 850000,
    allocated: 720000,
    committed: 412000,
    invoiced: 184500,
    paid: 148200,
    campaigns: [
      { id: "c1", wf: "WF402902", name: "Spring Grilling 2026", status: "Post", producer: "Laura B.", budget: 185000, committed: 172000, invoiced: 148500, paid: 122000, efc: 186400, overage: "none" },
      { id: "c2", wf: "WF402865", name: "Summer Berry Harvest", status: "In Production", producer: "Marcus T.", budget: 145000, committed: 128000, invoiced: 36000, paid: 26200, efc: 142800, overage: "none" },
      { id: "c3", wf: "WF402709", name: "Fall Bakery Favorites", status: "Planning", producer: "Marcus T.", budget: 210000, committed: 65000, invoiced: 0, paid: 0, efc: 218000, overage: "pending" },
      { id: "c4", wf: "WF402851", name: "Holiday Cookie Collection", status: "Planning", producer: "Laura B.", budget: 180000, committed: 47000, invoiced: 0, paid: 0, efc: 188500, overage: "pending" },
    ] as CampaignRow[],
  },
  {
    id: "p2",
    name: "Q3 2026 — Back to School & Harvest",
    period: "Jul 1 — Sep 30, 2026",
    total: 640000,
    allocated: 210000,
    committed: 48000,
    invoiced: 0,
    paid: 0,
    campaigns: [
      { id: "c5", wf: "WF402988", name: "Back to School Snacks", status: "Planning", producer: "Laura B.", budget: 125000, committed: 28000, invoiced: 0, paid: 0, efc: 125000, overage: "none" },
      { id: "c6", wf: "WF403012", name: "Labor Day Grill-Out", status: "Planning", producer: "Marcus T.", budget: 85000, committed: 20000, invoiced: 0, paid: 0, efc: 85000, overage: "none" },
    ] as CampaignRow[],
  },
];

function ProgramView() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ p1: true, p2: false });
  return (
    <div className="space-y-4">
      {POOLS.map((pool) => {
        const remaining = pool.total - pool.allocated;
        const spentPct = Math.round((pool.paid / pool.total) * 100);
        const committedPct = Math.round(((pool.committed - pool.paid) / pool.total) * 100);
        const allocPct = Math.round(((pool.allocated - pool.committed) / pool.total) * 100);
        const isOpen = expanded[pool.id];

        return (
          <Card key={pool.id} padding="none">
            {/* Pool header — clickable */}
            <button
              type="button"
              onClick={() => setExpanded((e) => ({ ...e, [pool.id]: !e[pool.id] }))}
              className="w-full text-left hover:bg-surface-secondary/40 transition-colors"
            >
              <div className="flex items-start gap-3 px-3.5 py-3 border-b border-border">
                {isOpen ? <ChevronDown className="h-4 w-4 mt-0.5 text-text-tertiary" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-text-tertiary" />}
                <DollarSign className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">{pool.name}</span>
                    <Badge variant={spentPct + committedPct + allocPct > 95 ? "warning" : "default"}>
                      {Math.round((pool.allocated / pool.total) * 100)}% allocated
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    {pool.period} · {pool.campaigns.length} campaigns
                  </p>
                  <div className="mt-2 h-2 rounded-full bg-surface-tertiary overflow-hidden">
                    <div className="h-full flex">
                      <div className="bg-emerald-500" style={{ width: `${spentPct}%` }} />
                      <div className="bg-blue-400" style={{ width: `${committedPct}%` }} />
                      <div className="bg-slate-300" style={{ width: `${allocPct}%` }} />
                    </div>
                  </div>
                  <div className="mt-1.5 flex gap-4 text-[10px] text-text-tertiary">
                    <span>Paid <span className="font-semibold text-emerald-600">{formatCurrency(pool.paid)}</span></span>
                    <span>Committed <span className="font-semibold text-text-primary">{formatCurrency(pool.committed)}</span></span>
                    <span>Allocated <span className="font-semibold text-text-primary">{formatCurrency(pool.allocated)}</span></span>
                    <span>Remaining <span className="font-semibold text-emerald-600">{formatCurrency(remaining)}</span></span>
                    <span className="ml-auto">Total <span className="font-semibold text-text-primary">{formatCurrency(pool.total)}</span></span>
                  </div>
                </div>
              </div>
            </button>

            {/* Campaign table */}
            {isOpen && (
              <>
                <div className="hidden md:grid grid-cols-[88px_1fr_110px_110px_100px_100px_100px_100px_80px] gap-3 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-secondary/40">
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
                <div className="divide-y divide-border">
                  {pool.campaigns.map((c) => {
                    const variance = ((c.efc - c.budget) / c.budget) * 100;
                    const varTone = Math.abs(variance) < 3 ? "text-text-secondary" : variance > 0 ? "text-red-600" : "text-emerald-600";
                    return (
                      <div key={c.id} className="grid grid-cols-2 md:grid-cols-[88px_1fr_110px_110px_100px_100px_100px_100px_80px] gap-3 px-3.5 py-2.5 items-center hover:bg-surface-secondary/40 cursor-pointer">
                        <div className="text-[10px] font-mono text-text-tertiary">{c.wf}</div>
                        <div className="col-span-2 md:col-span-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">{c.name}</span>
                            {c.overage === "pending" && <Badge variant="warning">Overage pending</Badge>}
                            {c.overage === "approved" && <Badge variant="success">Overage ok</Badge>}
                          </div>
                          <p className="text-[10px] text-text-tertiary mt-0.5">{c.producer}</p>
                        </div>
                        <div><StatusBadge status={c.status} /></div>
                        <div className="text-right text-sm text-text-secondary">{formatCurrency(c.budget)}</div>
                        <div className="text-right text-sm text-text-secondary">{formatCurrency(c.committed)}</div>
                        <div className="text-right text-sm text-text-secondary">{formatCurrency(c.invoiced)}</div>
                        <div className="text-right text-sm text-text-secondary">{formatCurrency(c.paid)}</div>
                        <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(c.efc)}</div>
                        <div className={`text-right text-xs font-medium ${varTone}`}>
                          {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignRow["status"] }) {
  const map: Record<CampaignRow["status"], { label: string; variant: "default" | "info" | "success" | "warning" }> = {
    Planning: { label: "Planning", variant: "default" },
    "In Production": { label: "In Production", variant: "info" },
    Post: { label: "Post", variant: "warning" },
    Complete: { label: "Complete", variant: "success" },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

// ──────────────────────────────────────────────────────────────────────
// 3. COST REPORT — canonical weekly report
// ──────────────────────────────────────────────────────────────────────

type Slice = "category" | "vendor" | "quarter";

const CATEGORY_ROWS = [
  { name: "Crew Labor", budget: 285000, committed: 248000, invoiced: 132000, paid: 108000, efc: 292000 },
  { name: "Talent", budget: 145000, committed: 118000, invoiced: 62000, paid: 48000, efc: 148000 },
  { name: "Styling", budget: 98000, committed: 82000, invoiced: 44000, paid: 32000, efc: 96000 },
  { name: "Equipment Rental", budget: 124000, committed: 96000, invoiced: 48000, paid: 36000, efc: 122000 },
  { name: "Studio Space", budget: 82000, committed: 72000, invoiced: 32000, paid: 28000, efc: 80000 },
  { name: "Post-Production", budget: 118000, committed: 88000, invoiced: 24000, paid: 18000, efc: 122000 },
  { name: "Travel", budget: 42000, committed: 28000, invoiced: 14000, paid: 11000, efc: 44000 },
  { name: "Catering", budget: 38000, committed: 24000, invoiced: 16000, paid: 12000, efc: 39000 },
  { name: "Props", budget: 56000, committed: 38000, invoiced: 18000, paid: 14000, efc: 58000 },
  { name: "Other", budget: 32000, committed: 18000, invoiced: 8000, paid: 6000, efc: 32000 },
];

const VENDOR_ROWS = [
  { name: "Fresh Focus Photography", category: "Director/Photographer", budget: 145000, committed: 128000, invoiced: 72000, paid: 58000, efc: 146000, campaigns: 4 },
  { name: "Atelier Food Styling", category: "Styling", budget: 88000, committed: 76000, invoiced: 42000, paid: 30000, efc: 89000, campaigns: 5 },
  { name: "Cast Iron Studios", category: "Studio Space", budget: 72000, committed: 64000, invoiced: 28000, paid: 24000, efc: 74000, campaigns: 3 },
  { name: "Midwest Grip & Electric", category: "Equipment", budget: 96000, committed: 78000, invoiced: 36000, paid: 28000, efc: 98000, campaigns: 4 },
  { name: "Prop House Midwest", category: "Props", budget: 46000, committed: 34000, invoiced: 16000, paid: 12000, efc: 48000, campaigns: 3 },
  { name: "Savory Stories Retouching", category: "Post", budget: 82000, committed: 62000, invoiced: 18000, paid: 14000, efc: 84000, campaigns: 4 },
  { name: "Harvest Craft Services", category: "Catering", budget: 28000, committed: 20000, invoiced: 12000, paid: 9000, efc: 29000, campaigns: 3 },
];

const QUARTER_ROWS = [
  { name: "Q1 2026", budget: 720000, committed: 720000, invoiced: 720000, paid: 718400, efc: 718400 },
  { name: "Q2 2026", budget: 850000, committed: 412000, invoiced: 184500, paid: 148200, efc: 862000 },
  { name: "Q3 2026", budget: 640000, committed: 48000, invoiced: 0, paid: 0, efc: 640000 },
  { name: "Q4 2026", budget: 780000, committed: 0, invoiced: 0, paid: 0, efc: 780000 },
];

const CREW_DEAL_MEMOS = [
  { name: "Jenna Rios", role: "1st AC", classification: "1099", dayRate: 850, days: 4, total: 3400, status: "Approved" },
  { name: "Daniel Park", role: "Gaffer", classification: "Paymaster", dayRate: 1100, days: 5, total: 5500, status: "Pending Approval" },
  { name: "Alex Monroe", role: "Stylist Asst.", classification: "W-2 via Paymaster", dayRate: 650, days: 3, total: 1950, status: "Sent to Paymaster" },
  { name: "Kai Nakamura", role: "DIT", classification: "1099", dayRate: 750, days: 4, total: 3000, status: "Paid" },
];

function CostReportView() {
  const [slice, setSlice] = useState<Slice>("category");
  const [expanded, setExpanded] = useState<string | null>("Crew Labor");

  const rows =
    slice === "category" ? CATEGORY_ROWS :
    slice === "vendor" ? VENDOR_ROWS :
    QUARTER_ROWS;

  const totals = rows.reduce(
    (a, r) => ({
      budget: a.budget + r.budget,
      committed: a.committed + r.committed,
      invoiced: a.invoiced + r.invoiced,
      paid: a.paid + r.paid,
      efc: a.efc + r.efc,
    }),
    { budget: 0, committed: 0, invoiced: 0, paid: 0, efc: 0 }
  );

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Estimate Accuracy" value="+4.2%" tone="success" caption="invoice vs. estimate" />
        <KpiCard label="Vendor Concentration" value="62%" tone="default" caption="top 3 vendors · healthy" />
        <KpiCard label="Avg Cost / Shoot Day" value={formatCurrency(38400)} tone="default" caption="42 shoot days YTD" />
        <KpiCard label="Budget Adjustments" value={formatCurrency(18500)} tone="warning" caption="2 approved · 1 pending" />
      </div>

      {/* Slice filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">View:</span>
        {(["category", "vendor", "quarter"] as Slice[]).map((s) => (
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
        <span className="ml-auto text-[10px] text-text-tertiary">Week of Apr 14 · published every Friday</span>
      </div>

      {/* Visual — bar chart */}
      <Card padding="none">
        <CardHeader>
          <CardTitle>
            <Activity />
            {slice === "category" ? "Spend by Category" : slice === "vendor" ? "Top Vendors by Spend" : "Quarterly Trend"}
          </CardTitle>
          <span className="text-[10px] text-text-tertiary">Paid · Committed · EFC</span>
        </CardHeader>
        <div className="px-3.5 py-4">
          <div className="space-y-2.5">
            {rows.slice(0, slice === "quarter" ? 4 : 6).map((r) => {
              const maxVal = Math.max(...rows.map((rr) => rr.efc)) || 1;
              const paidPct = (r.paid / maxVal) * 100;
              const committedPct = ((r.committed - r.paid) / maxVal) * 100;
              const efcPct = ((r.efc - r.committed) / maxVal) * 100;
              return (
                <div key={r.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-primary font-medium truncate">{r.name}</span>
                    <span className="text-text-tertiary">EFC <span className="text-text-primary font-semibold">{formatCurrency(r.efc)}</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
                    <div className="h-full flex">
                      <div className="bg-emerald-500" style={{ width: `${paidPct}%` }} />
                      <div className="bg-blue-400" style={{ width: `${committedPct}%` }} />
                      <div className="bg-slate-300" style={{ width: `${efcPct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* The cost report itself */}
      <Card padding="none">
        <CardHeader>
          <CardTitle>
            <FileBarChart2 />
            Cost Report — By {slice.charAt(0).toUpperCase() + slice.slice(1)}
          </CardTitle>
          <span className="text-[10px] text-text-tertiary">{rows.length} rows</span>
        </CardHeader>
        <div className="hidden md:grid grid-cols-[1fr_100px_100px_100px_100px_100px_90px] gap-3 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border bg-surface-secondary/40">
          <div>{slice.charAt(0).toUpperCase() + slice.slice(1)}</div>
          <div className="text-right">Budget</div>
          <div className="text-right">Committed</div>
          <div className="text-right">Invoiced</div>
          <div className="text-right">Paid</div>
          <div className="text-right">EFC</div>
          <div className="text-right">Var</div>
        </div>
        <div className="divide-y divide-border">
          {rows.map((r: any) => {
            const variance = ((r.efc - r.budget) / r.budget) * 100;
            const varTone = Math.abs(variance) < 3 ? "text-text-secondary" : variance > 0 ? "text-red-600" : "text-emerald-600";
            const isOpen = expanded === r.name;
            const canExpand = slice === "category" && r.name === "Crew Labor";

            return (
              <div key={r.name}>
                <div
                  onClick={() => canExpand && setExpanded(isOpen ? null : r.name)}
                  className={`grid grid-cols-2 md:grid-cols-[1fr_100px_100px_100px_100px_100px_90px] gap-3 px-3.5 py-2.5 items-center ${canExpand ? "cursor-pointer hover:bg-surface-secondary/40" : ""}`}
                >
                  <div className="col-span-2 md:col-span-1 min-w-0 flex items-center gap-2">
                    {canExpand && (isOpen ? <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" /> : <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{r.name}</p>
                      {"category" in r && <p className="text-[10px] text-text-tertiary">{(r as any).category}</p>}
                      {"campaigns" in r && <p className="text-[10px] text-text-tertiary">{(r as any).campaigns} campaigns</p>}
                    </div>
                  </div>
                  <div className="text-right text-sm text-text-secondary">{formatCurrency(r.budget)}</div>
                  <div className="text-right text-sm text-text-secondary">{formatCurrency(r.committed)}</div>
                  <div className="text-right text-sm text-text-secondary">{formatCurrency(r.invoiced)}</div>
                  <div className="text-right text-sm text-text-secondary">{formatCurrency(r.paid)}</div>
                  <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(r.efc)}</div>
                  <div className={`text-right text-xs font-medium ${varTone}`}>
                    {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                  </div>
                </div>

                {/* Crew Labor expanded — deal memos */}
                {isOpen && canExpand && (
                  <div className="bg-surface-secondary/40 border-t border-border">
                    <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border">
                      <HardHat className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Crew Deal Memos</span>
                      <span className="ml-auto text-[10px] text-text-tertiary">{CREW_DEAL_MEMOS.length} memos</span>
                    </div>
                    <div className="divide-y divide-border">
                      {CREW_DEAL_MEMOS.map((m, i) => (
                        <div key={i} className="grid grid-cols-[1fr_120px_90px_60px_100px_110px] gap-3 px-5 py-2 items-center">
                          <div>
                            <p className="text-xs font-medium text-text-primary">{m.name}</p>
                            <p className="text-[10px] text-text-tertiary">{m.role}</p>
                          </div>
                          <div className="text-[10px] text-text-secondary">{m.classification}</div>
                          <div className="text-right text-xs text-text-secondary">{formatCurrency(m.dayRate)}/day</div>
                          <div className="text-right text-[10px] text-text-tertiary">{m.days} days</div>
                          <div className="text-right text-xs font-semibold text-text-primary">{formatCurrency(m.total)}</div>
                          <div className="text-right">
                            <Badge variant={m.status === "Paid" ? "success" : m.status === "Pending Approval" ? "warning" : "info"}>
                              {m.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Totals row */}
          <div className="grid grid-cols-2 md:grid-cols-[1fr_100px_100px_100px_100px_100px_90px] gap-3 px-3.5 py-2.5 items-center bg-surface-secondary/60 border-t-2 border-border">
            <div className="col-span-2 md:col-span-1 text-[10px] font-semibold uppercase tracking-wider text-text-primary">Total</div>
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.budget)}</div>
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.committed)}</div>
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.invoiced)}</div>
            <div className="text-right text-sm font-semibold text-text-primary">{formatCurrency(totals.paid)}</div>
            <div className="text-right text-sm font-bold text-text-primary">{formatCurrency(totals.efc)}</div>
            <div className={`text-right text-xs font-semibold ${totals.efc > totals.budget ? "text-red-600" : "text-emerald-600"}`}>
              {((totals.efc - totals.budget) / totals.budget * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function KpiCard({
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

// ──────────────────────────────────────────────────────────────────────
// 4. VENDORS — lifecycle + paymaster
// ──────────────────────────────────────────────────────────────────────

type InnerTab = "lifecycle" | "onboarding";

const LIFECYCLE_BY_CAMPAIGN = [
  {
    campaign: "Spring Grilling 2026", wf: "WF402902",
    vendors: [
      { name: "Fresh Focus Photography", stage: 5, statusLabel: "Invoice Pending", amount: 24500 },
      { name: "Atelier Food Styling", stage: 4, statusLabel: "PO Signed", amount: 18000 },
      { name: "Cast Iron Studios", stage: 5, statusLabel: "Invoice Pending", amount: 12800 },
      { name: "Harvest Craft Services", stage: 6, statusLabel: "Paid", amount: 10300 },
    ],
  },
  {
    campaign: "Summer Berry Harvest", wf: "WF402865",
    vendors: [
      { name: "Midwest Grip & Electric", stage: 3, statusLabel: "PO Sent", amount: 16500 },
      { name: "Prop House Midwest", stage: 2, statusLabel: "Estimate Approved", amount: 8400 },
    ],
  },
  {
    campaign: "Fall Bakery Favorites", wf: "WF402709",
    vendors: [
      { name: "Savory Stories Retouching", stage: 1, statusLabel: "Estimate Submitted", amount: 24000 },
      { name: "Fresh Focus Photography", stage: 0, statusLabel: "Invited", amount: null },
    ],
  },
];

const LIFECYCLE_STAGES = ["Invited", "Estimate", "Approved", "PO Sent", "PO Signed", "Invoice", "Paid"];

const ONBOARDING = [
  {
    name: "Fresh Focus Photography",
    status: "complete" as const,
    items: [
      { name: "W-9 on file", done: true },
      { name: "COI (current)", done: true },
      { name: "ACH info", done: true },
      { name: "Paymaster profile", done: true },
    ],
  },
  {
    name: "Midwest Grip & Electric",
    status: "partial" as const,
    items: [
      { name: "W-9 on file", done: true },
      { name: "COI (current)", done: true },
      { name: "ACH info", done: false },
      { name: "Paymaster profile", done: false },
    ],
  },
  {
    name: "Atelier Food Styling",
    status: "complete" as const,
    items: [
      { name: "W-9 on file", done: true },
      { name: "COI (current)", done: true },
      { name: "ACH info", done: true },
      { name: "Paymaster profile", done: true },
    ],
  },
  {
    name: "Savory Stories Retouching",
    status: "none" as const,
    items: [
      { name: "W-9 on file", done: false },
      { name: "COI (current)", done: false },
      { name: "ACH info", done: false },
      { name: "Paymaster profile", done: false },
    ],
  },
];

function VendorsView() {
  const [inner, setInner] = useState<InnerTab>("lifecycle");
  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {[
          { k: "lifecycle" as const, label: "Lifecycle", icon: ArrowUpRight },
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

      {inner === "lifecycle" && (
        <div className="space-y-4">
          {LIFECYCLE_BY_CAMPAIGN.map((group) => (
            <Card key={group.wf} padding="none">
              <CardHeader>
                <CardTitle>
                  <Building2 />
                  {group.campaign}
                </CardTitle>
                <span className="text-[10px] font-mono text-text-tertiary">{group.wf}</span>
              </CardHeader>
              <div className="divide-y divide-border">
                {group.vendors.map((v, i) => (
                  <div key={i} className="px-3.5 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{v.name}</p>
                        <p className="text-[10px] text-text-tertiary mt-0.5">{v.statusLabel}</p>
                      </div>
                      {v.amount && (
                        <span className="text-sm font-semibold text-text-primary shrink-0">{formatCurrency(v.amount)}</span>
                      )}
                    </div>
                    {/* Stage bar */}
                    <div className="mt-2 grid grid-cols-7 gap-1">
                      {LIFECYCLE_STAGES.map((stage, idx) => {
                        const done = idx <= v.stage;
                        const current = idx === v.stage;
                        return (
                          <div key={stage} className="flex flex-col items-center gap-1">
                            <div className={`h-1 w-full rounded-full ${done ? "bg-primary" : "bg-surface-tertiary"} ${current ? "ring-2 ring-primary/30" : ""}`} />
                            <span className={`text-[9px] ${done ? "text-text-secondary" : "text-text-tertiary/60"}`}>
                              {stage}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {inner === "onboarding" && (
        <Card padding="none">
          <CardHeader>
            <CardTitle>
              <UserCheck />
              Paymaster Onboarding
              <Badge variant="warning">{ONBOARDING.filter((v) => v.status !== "complete").length} incomplete</Badge>
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-border">
            {ONBOARDING.sort((a, b) => (a.status === "complete" ? 1 : -1)).map((v) => {
              const done = v.items.filter((i) => i.done).length;
              const total = v.items.length;
              const statusIcon =
                v.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                v.status === "partial" ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
                <Circle className="h-4 w-4 text-red-400" />;
              const statusStyle =
                v.status === "complete" ? "text-emerald-700 bg-emerald-50" :
                v.status === "partial" ? "text-amber-700 bg-amber-50" :
                "text-red-700 bg-red-50";
              const statusLabel =
                v.status === "complete" ? "Onboarded" :
                v.status === "partial" ? "In Progress" :
                "Not Started";
              return (
                <div key={v.name} className="px-3.5 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    {statusIcon}
                    <span className="flex-1 text-sm font-medium text-text-primary">{v.name}</span>
                    <span className="text-[10px] text-text-tertiary">{done}/{total}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {v.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        {item.done
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          : <Circle className="h-3.5 w-3.5 text-text-tertiary shrink-0" />}
                        <span className={item.done ? "text-text-tertiary line-through" : "text-text-primary"}>
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

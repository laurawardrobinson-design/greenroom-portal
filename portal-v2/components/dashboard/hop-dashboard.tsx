"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  format,
  addDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import type { AppUser } from "@/types/domain";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { HighlightsCard } from "@/components/dashboard/highlights-card";
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
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); });

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

interface ShootEvent {
  id: string;
  date: string;
  location: string;
  callTime: string;
  notes: string;
  shootName: string;
  shootType: string;
  campaign: {
    id: string;
    name: string;
    wfNumber: string;
    status: string;
    producerId: string | null;
    producerName: string | null;
  } | null;
}

const CAL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SHOOT_TYPE_STYLES: Record<string, { pill: string; dot: string }> = {
  Photo: { pill: "bg-blue-100 text-blue-700", dot: "bg-blue-400" },
  Video: { pill: "bg-purple-100 text-purple-700", dot: "bg-purple-400" },
  Hybrid: { pill: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  Other: { pill: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
};

const PRODUCER_COLORS = [
  { swatch: "bg-emerald-400", pill: "bg-emerald-100 text-emerald-700" },
  { swatch: "bg-sky-400",     pill: "bg-sky-100 text-sky-700" },
  { swatch: "bg-violet-400",  pill: "bg-violet-100 text-violet-700" },
  { swatch: "bg-rose-400",    pill: "bg-rose-100 text-rose-700" },
  { swatch: "bg-amber-400",   pill: "bg-amber-100 text-amber-700" },
  { swatch: "bg-teal-400",    pill: "bg-teal-100 text-teal-700" },
];

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

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const monthStr = format(calMonth, "yyyy-MM");
  const { data: rawEvents, isLoading: calLoading } = useSWR<ShootEvent[]>(
    `/api/calendar?month=${monthStr}`,
    fetcher
  );
  const calEvents: ShootEvent[] = Array.isArray(rawEvents) ? rawEvents : [];

  // Upcoming shoots: fetch today's month + next month, filter to next 30 days
  const todayMonthStr = format(new Date(), "yyyy-MM");
  const nextMonthStr = format(addMonths(new Date(), 1), "yyyy-MM");
  const { data: rawTodayEvents } = useSWR<ShootEvent[]>(`/api/calendar?month=${todayMonthStr}`, fetcher);
  const { data: rawNextMonthEvents } = useSWR<ShootEvent[]>(`/api/calendar?month=${nextMonthStr}`, fetcher);
  const upcomingShoots = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const limitStr = format(addDays(new Date(), 30), "yyyy-MM-dd");
    const all = [...(Array.isArray(rawTodayEvents) ? rawTodayEvents : []), ...(Array.isArray(rawNextMonthEvents) ? rawNextMonthEvents : [])];
    return all
      .filter((e) => e.date >= todayStr && e.date <= limitStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [rawTodayEvents, rawNextMonthEvents]);

  // Derive producers for color assignment
  const producers = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of calEvents) {
      if (e.campaign?.producerId && e.campaign.producerName) {
        map.set(e.campaign.producerId, e.campaign.producerName);
      }
    }
    return [...map.entries()].map(([id, name], i) => ({
      id,
      name,
      color: PRODUCER_COLORS[i % PRODUCER_COLORS.length],
    }));
  }, [calEvents]);

  const producerColorMap = useMemo(() => {
    const m = new Map<string, typeof PRODUCER_COLORS[0]>();
    producers.forEach(({ id, color }) => m.set(id, color));
    return m;
  }, [producers]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const map = new Map<string, ShootEvent[]>();
    for (const e of calEvents) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [calEvents]);

  const selectedDateStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayEvents = selectedDateStr ? groupedEvents.get(selectedDateStr) || [] : [];

  // Build calendar grid
  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays: Date[] = [];
  let calCur = calStart;
  while (calCur <= calEnd) { calDays.push(calCur); calCur = addDays(calCur, 1); }

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

      {/* Production Calendar */}
      <Card padding="none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Production Calendar</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => { setCalMonth(subMonths(calMonth, 1)); setSelectedDay(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-32 text-center text-sm font-medium text-text-primary">
              {format(calMonth, "MMMM yyyy")}
            </span>
            <Button variant="ghost" size="sm" onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {CAL_DAYS.map((day) => (
            <div key={day} className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className={`grid grid-cols-7 border-l border-t border-border-light transition-opacity duration-150 ${calLoading ? "opacity-40" : ""}`}>
          {calDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayEvents = groupedEvents.get(dateStr) || [];
            const inMonth = isSameMonth(day, calMonth);
            const todayDate = isToday(day);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDay((prev) => prev && isSameDay(prev, day) ? null : day)}
                className={`
                  relative min-h-[64px] cursor-pointer border-b border-r border-border-light p-1.5 transition-colors
                  ${!inMonth ? "bg-surface-secondary/40" : "hover:bg-surface-secondary/50"}
                  ${isSelected ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : ""}
                `}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  todayDate ? "bg-primary font-bold text-white" : inMonth ? "text-text-primary" : "text-text-tertiary/40"
                }`}>
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 2).map((e) => {
                      const pid = e.campaign?.producerId;
                      const pColor = pid ? producerColorMap.get(pid) : undefined;
                      const pillClass = pColor?.pill ?? (SHOOT_TYPE_STYLES[e.shootType] || SHOOT_TYPE_STYLES.Other).pill;
                      return (
                        <span
                          key={e.id}
                          className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${pillClass}`}
                        >
                          {e.campaign?.name || e.shootName}
                        </span>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span className="block px-1 text-[10px] text-text-tertiary">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </Card>

      {/* Day detail popup overlay */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div
            className="relative w-full max-w-md rounded-xl border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  {format(selectedDay, "EEEE, MMMM d")}
                </h4>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {selectedDayEvents.length} {selectedDayEvents.length === 1 ? "shoot" : "shoots"}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-3">
              {selectedDayEvents.length > 0 ? (
                <div className="space-y-2">
                  {selectedDayEvents.map((e) => {
                    const pid = e.campaign?.producerId;
                    const pColor = pid ? producerColorMap.get(pid) : undefined;
                    const dotClass = pColor?.swatch ?? (SHOOT_TYPE_STYLES[e.shootType] || SHOOT_TYPE_STYLES.Other).dot;
                    return (
                      <Link
                        key={e.id}
                        href={e.campaign ? `/campaigns/${e.campaign.id}` : "#"}
                        onClick={() => setSelectedDay(null)}
                        className="flex items-start gap-2.5 rounded-lg border border-border p-3 transition-colors hover:bg-surface-secondary"
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {e.campaign?.name || "Unknown Campaign"}
                          </p>
                          {e.campaign?.wfNumber && (
                            <p className="text-xs text-text-tertiary">{e.campaign.wfNumber}</p>
                          )}
                          {e.campaign?.producerName && (
                            <p className="truncate text-xs text-text-secondary">{e.campaign.producerName}</p>
                          )}
                          {(e.callTime || e.location) && (
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-tertiary">
                              {e.callTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {e.callTime}
                                </span>
                              )}
                              {e.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {e.location}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="py-2 text-sm text-text-tertiary">No shoots scheduled for this day.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
      <div className="lg:col-span-7 space-y-6">
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
            <CardTitle>Upcoming Productions</CardTitle>
            <Link href="/calendar">
              <Button variant="ghost" size="sm">View calendar</Button>
            </Link>
          </CardHeader>
          {upcomingShoots.length === 0 ? (
            <EmptyState
              title="No upcoming shoots"
              description="Shoot days in the next 30 days will appear here."
            />
          ) : (
            <div className="space-y-1">
              {upcomingShoots.map((e) => {
                const pid = e.campaign?.producerId;
                const pColor = pid ? producerColorMap.get(pid) : undefined;
                const dotClass = pColor?.swatch ?? (SHOOT_TYPE_STYLES[e.shootType] || SHOOT_TYPE_STYLES.Other).dot;
                return (
                  <Link
                    key={e.id}
                    href={e.campaign ? `/campaigns/${e.campaign.id}` : "#"}
                    className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-surface-secondary"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {e.campaign?.name || e.shootName}
                      </p>
                      {e.campaign?.wfNumber && (
                        <p className="text-xs text-text-tertiary">{e.campaign.wfNumber}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-text-tertiary">
                      {format(parseISO(e.date), "MMM d")}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <div className="lg:col-span-3">
        <HighlightsCard />
      </div>
      </div>
    </div>
  );
}

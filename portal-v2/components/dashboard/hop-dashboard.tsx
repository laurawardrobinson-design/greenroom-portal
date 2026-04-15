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
import { formatCurrency } from "@/lib/utils/format";
import {
  DollarSign,
  AlertTriangle,
  Calendar,
  TrendingUp,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Clapperboard,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); });

interface Props {
  user: AppUser;
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
  label, value, icon: Icon, accent, href,
}: {
  label: string; value: string; icon: React.ElementType; accent: string; href?: string;
}) {
  const inner = (
    <div className="flex items-start justify-between min-h-[4.5rem]">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
      </div>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        <Card className="hover:border-primary/40 transition-colors cursor-pointer">{inner}</Card>
      </Link>
    );
  }
  return <Card>{inner}</Card>;
}

export function HopDashboard({ user }: Props) {
  const { data: stats } = useSWR("/api/dashboard", fetcher);
  const { data: postStats } = useSWR("/api/post-workflow/summary", fetcher);

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
          href="/approvals"
        />
        <StatCard
          label="Upcoming Shoots"
          value={stats ? String(stats.shootsThisWeek) : "—"}
          icon={Calendar}
          accent="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Post Production"
          value={postStats ? `${postStats.drivesCheckedOut} out` : "—"}
          icon={Clapperboard}
          accent={postStats && (postStats.drivesPastRetirement > 0)
            ? "bg-red-50 text-red-600"
            : "bg-violet-50 text-violet-600"}
          href="/post-workflow"
        />
      </div>

      {/* Production Calendar + Highlights side by side */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-10">
      <Card padding="none" className="lg:col-span-7">
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
      <div className="lg:col-span-3">
        <HighlightsCard />
      </div>
      </div>

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

      <div className="space-y-6">
      <div>
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
      </div>
    </div>
  );
}

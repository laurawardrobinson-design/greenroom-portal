"use client";

import { useState, useMemo, type ReactNode } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  ClipboardCheck,
  Calendar,
  Plus,
  Clock,
  MapPin,
  X,
} from "lucide-react";
import type { AppUser, CampaignStatus } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { HighlightsCard } from "@/components/dashboard/highlights-card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

interface ProducerStats {
  activeCampaigns: number;
  activeCampaignsList: { id: string; name: string; wfNumber: string; status: string }[];
  pendingTasks: number;
  pendingTasksList: {
    id: string;
    type: string;
    campaignId: string;
    campaignName: string;
    vendorName: string;
  }[];
  shootsThisWeek: number;
  shootsThisWeekList: {
    id: string;
    date: string;
    shootName: string;
    campaignId: string;
    campaignName: string;
    location: string;
    callTime: string;
  }[];
}

// ── Info card (always expanded) ───────────────────────────────────────────────

interface InfoCardProps {
  icon: ReactNode;
  label: string;
  count: number | undefined;
  accentBorder: string;
  colorText: string;
  colorBg: string;
  children: ReactNode;
}

function InfoCard({
  icon,
  label,
  count,
  accentBorder,
  colorText,
  colorBg,
  children,
}: InfoCardProps) {
  return (
    <Card padding="none" className={`overflow-hidden border-l-[3px] ${accentBorder}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorBg} ${colorText}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
        </div>
        <div className="text-lg font-semibold text-text-primary">
          {count === undefined ? (
            <Skeleton className="h-5 w-8" />
          ) : (
            count
          )}
        </div>
      </div>
      {count !== undefined && count > 0 && (
        <div className="max-h-56 overflow-y-auto border-t border-border">
          {children}
        </div>
      )}
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  user: AppUser;
}

export function ProducerDashboard({ user }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [hiddenProducers, setHiddenProducers] = useState<Set<string>>(new Set());

  const monthStr = format(currentMonth, "yyyy-MM");

  const { data: rawEvents, isLoading: calLoading } = useSWR<ShootEvent[]>(
    `/api/calendar?month=${monthStr}`,
    fetcher
  );
  const allEvents: ShootEvent[] = Array.isArray(rawEvents) ? rawEvents : [];

  // Filter calendar events based on scope
  const events = useMemo(() => {
    if (scope === "all") return allEvents;
    return allEvents.filter((e) => e.campaign?.producerId === user.id);
  }, [allEvents, scope, user.id]);

  const { data: stats } = useSWR<ProducerStats>(
    `/api/dashboard?scope=${scope}`,
    fetcher
  );

  // Derive unique producers from all events (stable across months for color assignment)
  const producers = useMemo(() => {
    const map = new Map<string, string>(); // id → name
    for (const e of events) {
      if (e.campaign?.producerId && e.campaign.producerName) {
        map.set(e.campaign.producerId, e.campaign.producerName);
      }
    }
    return [...map.entries()].map(([id, name], i) => ({
      id,
      name,
      color: PRODUCER_COLORS[i % PRODUCER_COLORS.length],
    }));
  }, [events]);

  // Map producerId → color index for pill coloring
  const producerColorMap = useMemo(() => {
    const m = new Map<string, typeof PRODUCER_COLORS[0]>();
    producers.forEach(({ id, color }) => m.set(id, color));
    return m;
  }, [producers]);

  // Filter events by selected producers
  const visibleEvents = useMemo(() => {
    if (hiddenProducers.size === 0) return events;
    return events.filter((e) => {
      const pid = e.campaign?.producerId;
      return !pid || !hiddenProducers.has(pid);
    });
  }, [events, hiddenProducers]);

  function toggleProducer(id: string) {
    setHiddenProducers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Build full-week calendar grid (shows prev/next month days in gray, like Outlook)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  // Group visible events by date string for O(1) lookup
  const groupedEvents = useMemo(() => {
    const map = new Map<string, ShootEvent[]>();
    for (const e of visibleEvents) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [visibleEvents]);

  const selectedDateStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayEvents = selectedDateStr ? groupedEvents.get(selectedDateStr) || [] : [];
  // Re-derive selected day events from all events (not filtered) for the detail panel
  const allGrouped = useMemo(() => {
    const map = new Map<string, ShootEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [events]);
  const selectedDayAllEvents = selectedDateStr ? allGrouped.get(selectedDateStr) || [] : [];

  function taskHref(type: string, campaignId: string): string {
    const normalized = type.toLowerCase();
    if (normalized.includes("estimate") || normalized.includes("invoice") || normalized.includes("po")) {
      return `/campaigns/${campaignId}/pre-production?tab=payments`;
    }
    return `/campaigns/${campaignId}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">
            Welcome back, {user.name.split(" ")[0]}
          </h2>
          <p className="text-sm text-text-secondary">Your campaigns and tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border bg-surface-secondary p-0.5">
            <button
              onClick={() => setScope("mine")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === "mine"
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              My Work
            </button>
            <button
              onClick={() => setScope("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === "all"
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Team
            </button>
          </div>
          <Link href="/campaigns/new">
            <Button size="md">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Main grid: calendar + stats */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-10">

        {/* ── Calendar ── */}
        <Card padding="none" className="lg:col-span-7">

          {/* Month nav header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-text-primary">Shoot Calendar</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="w-32 text-center text-sm font-medium text-text-primary">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Day name headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-text-tertiary"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className={`grid grid-cols-7 border-l border-t border-border-light transition-opacity duration-150 ${
              calLoading ? "opacity-40" : ""
            }`}
          >
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayEvents = groupedEvents.get(dateStr) || [];
              const inMonth = isSameMonth(day, currentMonth);
              const todayDate = isToday(day);
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

              return (
                <div
                  key={dateStr}
                  onClick={() =>
                    setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))
                  }
                  className={`
                    relative min-h-[64px] cursor-pointer border-b border-r border-border-light p-1.5 transition-colors
                    ${!inMonth ? "bg-surface-secondary/40" : "hover:bg-surface-secondary/50"}
                    ${isSelected ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : ""}
                  `}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      todayDate
                        ? "bg-primary font-bold text-white"
                        : inMonth
                        ? "text-text-primary"
                        : "text-text-tertiary/40"
                    }`}
                  >
                    {format(day, "d")}
                  </span>

                  {dayEvents.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => {
                        const pid = e.campaign?.producerId;
                        const pColor = pid ? producerColorMap.get(pid) : undefined;
                        const pillClass = pColor?.pill ?? (SHOOT_TYPE_STYLES[e.shootType] || SHOOT_TYPE_STYLES.Other).pill;
                        return (
                          <Link
                            key={e.id}
                            href={e.campaign ? `/campaigns/${e.campaign.id}` : "#"}
                            onClick={(evt) => evt.stopPropagation()}
                            className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${pillClass}`}
                          >
                            {e.campaign?.name || e.shootName}
                          </Link>
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
            className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  {format(selectedDay, "EEEE, MMMM d")}
                </h4>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {selectedDayAllEvents.length}{" "}
                  {selectedDayAllEvents.length === 1 ? "shoot" : "shoots"}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-3">
              {selectedDayAllEvents.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectedDayAllEvents.map((e) => {
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

        {/* ── Highlights ── */}
        <div className="lg:col-span-3">
          <HighlightsCard />
        </div>
      </div>

      {/* Stats row below calendar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Active Campaigns */}
        <InfoCard
          icon={<Film className="h-4 w-4" />}
          label="Active Campaigns"
          count={stats?.activeCampaigns}
          accentBorder="border-l-blue-500"
          colorText="text-blue-600"
          colorBg="bg-blue-50"
        >
          {stats?.activeCampaignsList?.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between gap-2 px-4 py-2 transition-colors hover:bg-surface-secondary"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                {c.name}
              </span>
              <CampaignStatusBadge status={c.status as CampaignStatus} />
            </Link>
          ))}
        </InfoCard>

        {/* Pending Tasks */}
        <InfoCard
          icon={<ClipboardCheck className="h-4 w-4" />}
          label="Pending Tasks"
          count={stats?.pendingTasks}
          accentBorder="border-l-amber-500"
          colorText="text-amber-600"
          colorBg="bg-amber-50"
        >
          {stats?.pendingTasksList?.map((t) => (
            <Link
              key={t.id}
              href={taskHref(t.type, t.campaignId)}
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-secondary"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{t.type}</p>
                <p className="truncate text-xs text-text-tertiary">
                  {t.vendorName} · {t.campaignName}
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            </Link>
          ))}
        </InfoCard>

        {/* Upcoming Shoots */}
        <InfoCard
          icon={<Calendar className="h-4 w-4" />}
          label="Upcoming Shoots"
          count={stats?.shootsThisWeek}
          accentBorder="border-l-purple-500"
          colorText="text-purple-600"
          colorBg="bg-purple-50"
        >
          {stats?.shootsThisWeekList?.map((s) => (
            <Link
              key={s.id}
              href={`/campaigns/${s.campaignId}`}
              className="flex items-start gap-3 px-4 py-2 transition-colors hover:bg-surface-secondary"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{s.shootName}</p>
                <p className="truncate text-xs text-text-tertiary">
                  {format(parseISO(s.date), "EEE, MMM d")} · {s.campaignName}
                </p>
                {s.callTime && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary">
                    <Clock className="h-3 w-3" />
                    {s.callTime}
                  </p>
                )}
              </div>
              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            </Link>
          ))}
        </InfoCard>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  startOfMonth,
  endOfMonth,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Calendar,
  Clock,
  MapPin,
  X,
  PackageCheck,
  AlertTriangle,
} from "lucide-react";
import type { AppUser, PRDoc } from "@/types/domain";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/loading-skeleton";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { PRDocDrawer } from "@/components/product-requests/pr-doc-drawer";
import { LobChip } from "@/components/brand-marketing/lob-chip";
import type {
  BmmShootRow,
  BmmShootsResponse,
  BrandMarketingPortfolio,
} from "@/lib/services/brand-marketing.service";
import type { CampaignStatus, PRDocStatus } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// PR-status accent dots — the actionable signal a BMM scans the calendar for.
// Neutral chip body keeps the design from looking like a status dashboard.
const PR_STATUS_DOT: Record<PRDocStatus | "none", string> = {
  draft: "bg-text-tertiary",
  submitted: "bg-amber-400",
  forwarded: "bg-sky-400",
  confirmed: "bg-emerald-400",
  cancelled: "bg-text-tertiary",
  none: "bg-rose-400",
};

const PR_STATUS_LABEL: Record<PRDocStatus | "none", string> = {
  draft: "PR draft",
  submitted: "Awaiting your review",
  forwarded: "Forwarded to RBU",
  confirmed: "Confirmed by RBU",
  cancelled: "Cancelled",
  none: "No PR yet",
};

interface Props {
  user: AppUser;
}

export function BmmDashboard({ user }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const calendarPanelRef = useRef<HTMLDivElement | null>(null);
  const [calendarPanelHeight, setCalendarPanelHeight] = useState<number | null>(null);

  const monthStr = format(currentMonth, "yyyy-MM");

  const { data: shootsData, isLoading: calLoading } = useSWR<BmmShootsResponse>(
    `/api/brand-marketing/shoots?month=${monthStr}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const { data: portfolio } = useSWR<BrandMarketingPortfolio>(
    "/api/brand-marketing/portfolio",
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: prInbox, mutate: mutatePrInbox } = useSWR<PRDoc[]>(
    "/api/product-requests?status=submitted,forwarded",
    fetcher,
    { refreshInterval: 60000 }
  );

  const events = useMemo(() => shootsData?.shoots ?? [], [shootsData]);

  // Build the full Outlook-style grid (prev/next month overflow days)
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

  const groupedEvents = useMemo(() => {
    const map = new Map<string, BmmShootRow[]>();
    for (const e of events) {
      if (!map.has(e.shootDate)) map.set(e.shootDate, []);
      map.get(e.shootDate)!.push(e);
    }
    return map;
  }, [events]);

  const selectedDateStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedDayEvents = selectedDateStr
    ? groupedEvents.get(selectedDateStr) ?? []
    : [];

  useEffect(() => {
    const panelEl = calendarPanelRef.current;
    if (!panelEl) return;
    const update = () => {
      const next = Math.round(panelEl.getBoundingClientRect().height);
      setCalendarPanelHeight((prev) => (prev === next ? prev : next));
    };
    update();
    const ob = new ResizeObserver(update);
    ob.observe(panelEl);
    return () => ob.disconnect();
  }, []);

  // Stats
  const todayIso = new Date().toISOString().slice(0, 10);
  const sevenDaysOut = (() => {
    const x = new Date();
    x.setDate(x.getDate() + 7);
    return x.toISOString().slice(0, 10);
  })();
  const submittedPRs = (prInbox ?? []).filter((p) => p.status === "submitted");
  const forwardedPRs = (prInbox ?? []).filter((p) => p.status === "forwarded");
  const shootsThisWeek = events.filter(
    (e) => e.shootDate >= todayIso && e.shootDate <= sevenDaysOut
  );
  const activeCampaigns = portfolio?.inFlight ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} />

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
        {/* Calendar */}
        <div ref={calendarPanelRef} className="self-start lg:col-span-2">
          <Card padding="none">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  Shoot Calendar
                </h3>
              </div>
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

            <div
              className={`grid grid-cols-7 border-l border-t border-border-light transition-opacity duration-150 ${
                calLoading ? "opacity-40" : ""
              }`}
            >
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayEvents = groupedEvents.get(dateStr) ?? [];
                const inMonth = isSameMonth(day, currentMonth);
                const todayDate = isToday(day);
                const isSelected = selectedDay
                  ? isSameDay(selectedDay, day)
                  : false;

                return (
                  <div
                    key={dateStr}
                    onClick={() =>
                      setSelectedDay((prev) =>
                        prev && isSameDay(prev, day) ? null : day
                      )
                    }
                    className={`relative min-h-[64px] cursor-pointer border-b border-r border-border-light p-1.5 transition-colors ${
                      !inMonth
                        ? "bg-surface-secondary/40"
                        : "hover:bg-surface-secondary/50"
                    } ${
                      isSelected
                        ? "bg-primary/5 ring-1 ring-inset ring-primary/40"
                        : ""
                    }`}
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
                        {dayEvents.slice(0, 2).map((e) => (
                          <Link
                            key={e.shootDateId}
                            href={`/brand-marketing/campaigns/${e.campaignId}`}
                            onClick={(evt) => evt.stopPropagation()}
                            className="flex items-center gap-1 truncate rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium leading-tight text-text-secondary ring-1 ring-inset ring-border hover:bg-surface"
                            title={`${e.campaignName} · ${PR_STATUS_LABEL[e.prStatus]}`}
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${PR_STATUS_DOT[e.prStatus]}`}
                              aria-hidden
                            />
                            <span className="truncate">{e.campaignName}</span>
                          </Link>
                        ))}
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
        </div>

        {/* Side panel — BMM action queue */}
        <div
          className="min-h-0 self-start lg:col-span-1"
          style={
            calendarPanelHeight ? { height: `${calendarPanelHeight}px` } : undefined
          }
        >
          <ActionQueue
            submitted={submittedPRs}
            forwarded={forwardedPRs}
            onSelect={setSelectedPrId}
          />
        </div>
      </div>

      {/* Day-detail popover */}
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
                  {selectedDayEvents.length}{" "}
                  {selectedDayEvents.length === 1 ? "shoot" : "shoots"}
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
              {selectedDayEvents.length > 0 ? (
                <div className="space-y-2">
                  {selectedDayEvents.map((e) => (
                    <Link
                      key={e.shootDateId}
                      href={`/brand-marketing/campaigns/${e.campaignId}`}
                      onClick={() => setSelectedDay(null)}
                      className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-surface-secondary"
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PR_STATUS_DOT[e.prStatus]}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-text-tertiary">
                            {e.wfNumber}
                          </span>
                          <span className="truncate text-sm font-medium text-text-primary">
                            {e.campaignName}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <LobChip lob={e.lineOfBusiness} />
                          {e.prStatus === "none" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-warning ring-1 ring-inset ring-amber-200">
                              <AlertTriangle className="h-3 w-3" />
                              No PR
                            </span>
                          ) : (
                            <PRStatusPill status={e.prStatus} />
                          )}
                        </div>
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
                  ))}
                </div>
              ) : (
                <p className="py-2 text-sm text-text-tertiary">
                  No shoots scheduled for this day.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard
          icon={<Film className="h-4 w-4" />}
          label="Active Campaigns"
          count={portfolio ? activeCampaigns.length : undefined}
        >
          {activeCampaigns.map((c) => (
            <Link
              key={c.id}
              href={`/brand-marketing/campaigns/${c.id}`}
              className="flex items-center justify-between gap-2 px-4 py-2 transition-colors hover:bg-surface-secondary"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                {c.wfNumber} {c.name}
              </span>
              <CampaignStatusBadge status={c.status as CampaignStatus} />
            </Link>
          ))}
        </InfoCard>

        <InfoCard
          icon={<Calendar className="h-4 w-4" />}
          label="Shoots This Week"
          count={shootsData ? shootsThisWeek.length : undefined}
          emptyMessage="Nothing in the next 7 days."
        >
          {shootsThisWeek.map((s) => (
            <Link
              key={s.shootDateId}
              href={`/brand-marketing/campaigns/${s.campaignId}`}
              className="flex items-start gap-3 px-4 py-2 transition-colors hover:bg-surface-secondary"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PR_STATUS_DOT[s.prStatus]}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {s.campaignName}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  {new Date(s.shootDate + "T12:00:00").toLocaleDateString(
                    "en-US",
                    { weekday: "short", month: "short", day: "numeric" }
                  )}
                  {s.departments.length > 0 &&
                    ` · ${s.departments
                      .map((d) => PR_DEPARTMENT_LABELS[d])
                      .join(", ")}`}
                </p>
              </div>
            </Link>
          ))}
        </InfoCard>
      </div>

      <PRDocDrawer
        id={selectedPrId}
        onClose={() => {
          setSelectedPrId(null);
          mutatePrInbox();
        }}
      />
    </div>
  );
}

interface ActionQueueProps {
  submitted: PRDoc[];
  forwarded: PRDoc[];
  onSelect: (id: string) => void;
}

function ActionQueue({ submitted, forwarded, onSelect }: ActionQueueProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <PackageCheck className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Action Queue
        </span>
        <span className="ml-auto text-sm font-semibold text-text-primary">
          {submitted.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {submitted.length === 0 && forwarded.length === 0 ? (
          <p className="px-3.5 py-4 text-center text-xs text-text-tertiary">
            No requests waiting on you.
          </p>
        ) : (
          <>
            {submitted.length > 0 && (
              <div>
                <p className="border-b border-border bg-surface-secondary/40 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Awaiting your review
                </p>
                {submitted.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => onSelect(doc.id)}
                    className="flex w-full items-start gap-3 border-b border-border px-3.5 py-2.5 text-left transition-colors hover:bg-surface-secondary"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {doc.campaign?.name ?? "Campaign"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-tertiary">
                        {doc.campaign?.wfNumber} ·{" "}
                        {new Date(doc.shootDate + "T12:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </p>
                    </div>
                    <PRStatusPill status={doc.status} />
                  </button>
                ))}
              </div>
            )}
            {forwarded.length > 0 && (
              <div>
                <p className="border-b border-border bg-surface-secondary/40 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Waiting on RBU
                </p>
                {forwarded.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => onSelect(doc.id)}
                    className="flex w-full items-start gap-3 border-b border-border px-3.5 py-2.5 text-left transition-colors hover:bg-surface-secondary"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {doc.campaign?.name ?? "Campaign"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-tertiary">
                        {doc.campaign?.wfNumber} ·{" "}
                        {new Date(doc.shootDate + "T12:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </p>
                    </div>
                    <PRStatusPill status={doc.status} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface InfoCardProps {
  icon: ReactNode;
  label: string;
  count: number | undefined;
  children: ReactNode;
  emptyMessage?: string;
  footer?: ReactNode;
}

function InfoCard({
  icon,
  label,
  count,
  children,
  emptyMessage,
  footer,
}: InfoCardProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-primary [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          {label}
        </h3>
        <span className="ml-auto text-sm font-semibold text-text-primary">
          {count === undefined ? <Skeleton className="h-4 w-6" /> : count}
        </span>
      </div>
      {count === undefined ? null : count === 0 ? (
        emptyMessage ? (
          <p className="px-4 py-3 text-sm text-text-tertiary">{emptyMessage}</p>
        ) : null
      ) : (
        <div className="max-h-56 overflow-y-auto">{children}</div>
      )}
      {footer ? (
        <div className="border-t border-border px-4 py-2 text-[11px]">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}

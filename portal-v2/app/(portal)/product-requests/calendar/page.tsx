"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  Apple,
  Beef,
  CalendarDays,
  Check,
  ChevronRight,
  Cookie,
  Copy,
  Sandwich,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PRDocContent } from "@/components/product-requests/pr-doc-drawer";
import {
  PRMonthCalendar,
  DEPT_COLORS,
} from "@/components/product-requests/pr-calendar";
import type {
  MasterCalendarView,
  PRDepartment,
  DeptCalendarEntry,
} from "@/types/domain";
import { PR_DEPARTMENTS, PR_DEPARTMENT_LABELS } from "@/types/domain";

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<T>;
}

function formatLongDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(hhmm: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

// BMM master view keys shoots by campaign/doc rather than dept —
// each PR doc is one campaign × shoot date, and the preview pane
// shows all dept sections in that doc.

interface CampaignDayGroup {
  docId: string;
  shootDate: string;
  campaign: DeptCalendarEntry["campaign"];
  shootCallTime: string;
  shootLocation: string;
  entries: DeptCalendarEntry[];
  totalItems: number;
}

function groupByCampaignDay(
  entries: DeptCalendarEntry[]
): CampaignDayGroup[] {
  const map = new Map<string, CampaignDayGroup>();
  for (const e of entries) {
    if (!map.has(e.docId)) {
      map.set(e.docId, {
        docId: e.docId,
        shootDate: e.shootDate,
        campaign: e.campaign,
        shootCallTime: e.shootCallTime,
        shootLocation: e.shootLocation,
        entries: [],
        totalItems: 0,
      });
    }
    const g = map.get(e.docId)!;
    g.entries.push(e);
    g.totalItems += e.itemCount;
  }
  const groups = Array.from(map.values());
  groups.sort((a, b) => a.shootDate.localeCompare(b.shootDate));
  for (const g of groups) {
    g.entries.sort((a, b) =>
      PR_DEPARTMENTS.indexOf(a.department) -
      PR_DEPARTMENTS.indexOf(b.department)
    );
  }
  return groups;
}

function DeptToggle({
  department,
  active,
  onToggle,
}: {
  department: PRDepartment;
  active: boolean;
  onToggle: () => void;
}) {
  const Icon = DEPT_ICONS[department];
  const c = DEPT_COLORS[department];
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-all ${
        active
          ? `${c.bg} ${c.border} ${c.text}`
          : "border-border bg-surface text-text-tertiary hover:text-text-secondary"
      }`}
    >
      <Icon className="h-3 w-3" />
      <span className="font-medium">{PR_DEPARTMENT_LABELS[department]}</span>
    </button>
  );
}

function ShareLinkRow({
  department,
  token,
}: {
  department: PRDepartment;
  token: string;
}) {
  const [copied, setCopied] = useState(false);
  const Icon = DEPT_ICONS[department];
  const c = DEPT_COLORS[department];
  const url = useMemo(() => {
    if (typeof window === "undefined") return `/pr/dept/${token}`;
    return `${window.location.origin}/pr/dept/${token}`;
  }, [token]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [url]);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border ${c.border} ${c.bg} px-3 py-2`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${c.text}`} />
      <span className={`text-[12px] font-medium shrink-0 ${c.text}`}>
        {PR_DEPARTMENT_LABELS[department]}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-text-tertiary truncate min-w-0 flex-1 hover:underline"
      >
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button
        onClick={copy}
        className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-secondary transition-colors shrink-0"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}

export default function ProductRequestsCalendarPage() {
  const [activeDepts, setActiveDepts] = useState<Set<PRDepartment>>(
    () => new Set(PR_DEPARTMENTS)
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data, isLoading } = useSWR<MasterCalendarView>(
    "/api/product-requests/calendar/master",
    fetcher,
    { refreshInterval: 30000 }
  );

  const toggleDept = (d: PRDepartment) => {
    setActiveDepts((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    return data.entries.filter((e) => activeDepts.has(e.department));
  }, [data, activeDepts]);

  const upcomingGroups = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return groupByCampaignDay(
      filteredEntries.filter((e) => e.shootDate >= today)
    );
  }, [filteredEntries]);

  useEffect(() => {
    if (!selectedKey && upcomingGroups.length > 0) {
      setSelectedKey(upcomingGroups[0].docId);
    }
  }, [upcomingGroups, selectedKey]);

  // If selection is filtered out, clear it.
  useEffect(() => {
    if (!selectedKey) return;
    const stillVisible = filteredEntries.some(
      (e) => e.docId === selectedKey
    );
    if (!stillVisible) setSelectedKey(null);
  }, [filteredEntries, selectedKey]);

  const selectedDocId = selectedKey;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href="/product-requests"
            className="inline-flex items-center gap-1 text-[12px] text-text-tertiary hover:text-text-primary transition-colors mb-1"
          >
            <ArrowLeft className="h-3 w-3" />
            All requests
          </Link>
          <PageHeader title="Product Request Calendar" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PR_DEPARTMENTS.map((d) => (
            <DeptToggle
              key={d}
              department={d}
              active={activeDepts.has(d)}
              onToggle={() => toggleDept(d)}
            />
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="h-[28rem] rounded-xl bg-surface-secondary animate-pulse" />
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: calendar + list stacked */}
            <div className="space-y-4 min-w-0">
              <PRMonthCalendar
                entries={filteredEntries}
                onEntryClick={(e) => setSelectedKey(e.docId)}
                showDept
                selectedKey={selectedDocId ?? undefined}
              />

              <Card padding="none">
                <CardHeader>
                  <CardTitle>
                    <CalendarDays />
                    Upcoming shoots
                  </CardTitle>
                </CardHeader>
                {upcomingGroups.length === 0 ? (
                  <p className="px-3.5 py-3 text-[12px] text-text-tertiary italic">
                    No upcoming shoots with the current filters.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {upcomingGroups.map((g) => {
                      const active = selectedDocId === g.docId;
                      return (
                        <li key={g.docId}>
                          <button
                            onClick={() => setSelectedKey(g.docId)}
                            className={`group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                              active
                                ? "bg-primary/[0.06]"
                                : "hover:bg-surface-secondary"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[12px] font-semibold text-text-primary tabular-nums">
                                  {formatLongDate(g.shootDate)}
                                </span>
                                <span className="text-[10px] text-text-tertiary tabular-nums">
                                  {g.campaign.wfNumber}
                                </span>
                              </div>
                              <div className="text-[12px] text-text-secondary truncate">
                                {g.campaign.name}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {g.entries.map((e) => {
                                  const c = DEPT_COLORS[e.department];
                                  const Icon = DEPT_ICONS[e.department];
                                  return (
                                    <span
                                      key={e.department}
                                      className={`inline-flex items-center gap-1 rounded border ${c.border} ${c.bg} px-1.5 py-0.5 text-[10px] ${c.text}`}
                                      title={`${PR_DEPARTMENT_LABELS[e.department]} · ${e.itemCount} items`}
                                    >
                                      <Icon className="h-2.5 w-2.5" />
                                      <span className="font-medium">
                                        {PR_DEPARTMENT_LABELS[e.department]}
                                      </span>
                                      <span className="tabular-nums opacity-70">
                                        · {e.itemCount}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <ChevronRight
                              className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                                active
                                  ? "text-primary"
                                  : "text-text-tertiary group-hover:text-text-secondary"
                              }`}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>

            {/* Right: preview pane */}
            <div className="bg-surface border border-border rounded-xl min-h-[24rem] min-w-0 overflow-hidden">
              {selectedDocId ? (
                <div className="px-4 py-4">
                  <PRDocContent key={selectedDocId} id={selectedDocId} />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center px-6 py-12 text-center">
                  <p className="text-[13px] text-text-tertiary">
                    Select a shoot to preview it here.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Share-link panel for BMM */}
          <Card padding="none">
            <CardHeader>
              <CardTitle>Department Share Links</CardTitle>
            </CardHeader>
            <div className="px-3.5 py-3 space-y-2">
              <p className="text-[12px] text-text-tertiary">
                Each department has a stable tamper-proof calendar URL. Share
                once; new PRs appear as they&apos;re forwarded.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.tokens.map((t) => (
                  <ShareLinkRow
                    key={t.department}
                    department={t.department}
                    token={t.publicToken}
                  />
                ))}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

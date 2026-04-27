"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  PackageSearch,
  Plus,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type StatusVariant } from "@/components/ui/status-pill";
import { PRDocDrawer } from "@/components/product-requests/pr-doc-drawer";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PRDoc, PRDeptSection } from "@/types/domain";
import { PR_DEPARTMENT_LABELS, PR_DEPARTMENTS } from "@/types/domain";

type FilterId = "needs" | "submitted" | "forwarded" | "confirmed" | "fulfilled";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<T>;
}

function formatShootDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCompactDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(hhmm: string) {
  if (!hhmm) return hhmm;
  if (/[AaPp][Mm]/.test(hhmm)) return hhmm; // already formatted
  if (!/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  if (isNaN(h) || isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function earliestPickup(
  sections: PRDeptSection[]
): { date: string; time: string } | null {
  const candidates = sections
    .filter((s) => s.dateNeeded && s.timeNeeded)
    .map((s) => ({
      iso: `${s.dateNeeded}T${s.timeNeeded}`,
      date: s.dateNeeded as string,
      time: s.timeNeeded,
    }))
    .sort((a, b) => a.iso.localeCompare(b.iso));
  if (candidates.length === 0) return null;
  return { date: candidates[0].date, time: candidates[0].time };
}

function departmentSummary(sections: PRDeptSection[]) {
  const active = sections.filter((s) => s.items.length > 0);
  if (active.length === 0) return "No items yet";

  const parts = active
    .slice(0, 3)
    .map((s) => `${PR_DEPARTMENT_LABELS[s.department]} ${s.items.length}`);

  if (active.length > 3) parts.push(`+${active.length - 3} more`);

  return parts.join(" · ");
}

type SubmissionSummary = {
  totalItems: number;
  activeSections: number;
  missingPickupSections: number;
  hasItems: boolean;
  readyToSubmit: boolean;
  pickup: { date: string; time: string } | null;
  issue: string | null;
};

function summarizeDoc(doc: PRDoc): SubmissionSummary {
  const activeSections = doc.sections.filter((s) => s.items.length > 0);
  const totalItems = activeSections.reduce((n, s) => n + s.items.length, 0);
  const missingPickupSections = activeSections.filter(
    (s) => !s.dateNeeded || !s.timeNeeded || !s.pickupPerson || !s.pickupPhone
  ).length;
  const hasItems = totalItems > 0;
  const readyToSubmit = hasItems && missingPickupSections === 0;

  let issue: string | null = null;
  if (!hasItems) issue = "Add at least one item before submitting.";
  else if (missingPickupSections > 0) {
    issue = `Add pickup details for ${missingPickupSections} department${missingPickupSections === 1 ? "" : "s"}.`;
  }

  return {
    totalItems,
    activeSections: activeSections.length,
    missingPickupSections,
    hasItems,
    readyToSubmit,
    pickup: earliestPickup(doc.sections),
    issue,
  };
}

type WorkflowBucket = "needs" | "submitted" | "forwarded" | "confirmed" | "fulfilled" | "cancelled";

function workflowBucket(doc: PRDoc, summary: SubmissionSummary): WorkflowBucket {
  if (doc.status === "cancelled") return "cancelled";
  if (doc.status === "fulfilled") return "fulfilled";
  if (doc.status === "confirmed") return "confirmed";
  if (doc.status === "forwarded") return "forwarded";
  if (doc.status === "submitted") return "submitted";
  return "needs";
}

function workflowLabel(doc: PRDoc, summary: SubmissionSummary): string {
  if (doc.status === "draft") {
    if (!summary.hasItems) return "Needs items";
    if (summary.readyToSubmit) return "Ready to submit";
    return "Draft";
  }
  if (doc.status === "submitted") return "Submitted";
  if (doc.status === "forwarded") return "Sent";
  if (doc.status === "fulfilled") return "Fulfilled";
  return "Cancelled";
}

function workflowRowVariant(doc: PRDoc, summary: SubmissionSummary): StatusVariant {
  if (doc.status === "draft") {
    if (!summary.hasItems) return "pending";
    if (summary.readyToSubmit) return "approved";
    return "draft";
  }
  return workflowVariant(workflowBucket(doc, summary) as WorkflowBucket);
}

function workflowVariant(bucket: WorkflowBucket): StatusVariant {
  switch (bucket) {
    case "needs":
      return "pending";
    case "submitted":
      return "submitted";
    case "forwarded":
      return "info";
    case "confirmed":
      return "approved";
    case "fulfilled":
      return "approved";
    case "cancelled":
      return "draft";
  }
}

function groupDocsByShootDate(docs: PRDoc[]) {
  const byDate = new Map<string, PRDoc[]>();
  for (const doc of docs) {
    if (!byDate.has(doc.shootDate)) byDate.set(doc.shootDate, []);
    byDate.get(doc.shootDate)!.push(doc);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([shootDate, dayDocs]) => ({ shootDate, docs: dayDocs }));
}

function parse24h(hhmm: string): { time: string; period: "AM" | "PM" } {
  if (!hhmm) return { time: "9:00", period: "AM" };
  const [hStr, mStr = "00"] = hhmm.split(":");
  const h = parseInt(hStr);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return { time: `${h12}:${mStr}`, period };
}

function to24h(time: string, period: "AM" | "PM"): string {
  const digits = time.replace(/\D/g, "");
  let normalized: string;
  if (digits.length === 3) normalized = `${digits[0]}:${digits.slice(1)}`;
  else if (digits.length === 4) normalized = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  else normalized = `${digits}:00`;
  const [hStr, mStr = "00"] = normalized.split(":");
  let h = parseInt(hStr);
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return `${h.toString().padStart(2, "0")}:${mStr.padStart(2, "0")}`;
}

function rowFormatAsTyped(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3)
    return parseInt(digits[0]) > 1 ? `${digits[0]}:${digits.slice(1)}` : `${digits.slice(0, 2)}:${digits[2]}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function RowDateChip({ value, onSave }: { value: string; onSave: (iso: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dateVal, setDateVal] = useState(value);
  const display = dateVal
    ? new Date(dateVal + "T12:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
    : "MM/DD";
  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          (inputRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.();
        }}
        className="font-semibold text-text-primary hover:text-primary transition-colors"
      >
        {display}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={dateVal}
        onChange={(e) => setDateVal(e.target.value)}
        onBlur={(e) => { if (e.target.value && e.target.value !== value) onSave(e.target.value); }}
        tabIndex={-1}
        className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
}

function RowTimeChip({ value, onSave }: { value: string; onSave: (hhmm: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [timeVal, setTimeVal] = useState(() => (value ? parse24h(value).time : "9:00"));
  const [period, setPeriod] = useState<"AM" | "PM">(() => (value ? parse24h(value).period : "AM"));

  const display = value ? formatTime(value) : "TBD";

  function save(t = timeVal, p = period) {
    const hhmm = to24h(t, p);
    if (hhmm !== value) onSave(hhmm);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const init = value ? parse24h(value) : { time: "9:00", period: "AM" as const };
          setTimeVal(init.time);
          setPeriod(init.period);
          setEditing(true);
        }}
        className="font-medium text-text-primary hover:text-primary transition-colors"
      >
        {display}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        type="text"
        value={timeVal}
        onChange={(e) => setTimeVal(rowFormatAsTyped(e.target.value))}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        onBlur={() => save()}
        className="w-12 bg-transparent border-b border-primary focus:outline-none text-sm font-medium text-primary text-center p-0"
      />
      <select
        value={period}
        onChange={(e) => { const p = e.target.value as "AM" | "PM"; setPeriod(p); save(timeVal, p); }}
        className="bg-transparent text-sm font-medium text-primary focus:outline-none cursor-pointer"
      >
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-state={active ? "active" : "inactive"}
      className="ui-tab"
    >
      {label}
      {active && <span className="ui-tab-underline" />}
    </button>
  );
}

export default function ProductRequestsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, string[]>>({});
  const { user } = useCurrentUser();
  const isBMM =
    user?.role === "Brand Marketing Manager" || user?.role === "Admin";

  const { data: docs, isLoading, mutate } = useSWR<PRDoc[]>(
    "/api/product-requests",
    fetcher,
    { refreshInterval: 60000 }
  );

  // Buckets by workflow state (once per render)
  const { byBucket, counts } = useMemo(() => {
    const list = docs ?? [];
    const byBucket: Record<WorkflowBucket, PRDoc[]> = {
      needs: [],
      submitted: [],
      forwarded: [],
      confirmed: [],
      fulfilled: [],
      cancelled: [],
    };
    for (const doc of list) {
      const b = workflowBucket(doc, summarizeDoc(doc));
      byBucket[b].push(doc);
    }
    return {
      byBucket,
      counts: {
        needs: byBucket.needs.length,
        submitted: byBucket.submitted.length,
        forwarded: byBucket.forwarded.length,
        confirmed: byBucket.confirmed.length,
        fulfilled: byBucket.fulfilled.length,
      },
    };
  }, [docs]);

  // BMM defaults to Submitted (PRs waiting on them to send to RBU)
  // Everyone else defaults to drafts that need work
  const defaultFilter: FilterId = isBMM ? "submitted" : "needs";
  const [filter, setFilter] = useState<FilterId>(defaultFilter);

  const visibleDocs = useMemo(() => {
    return byBucket[filter] ?? [];
  }, [filter, byBucket]);

  const campaignGroups = useMemo(() => {
    const byCampaign = new Map<string, { name: string; wfNumber?: string; docs: PRDoc[] }>();
    for (const doc of visibleDocs) {
      if (!byCampaign.has(doc.campaignId)) {
        byCampaign.set(doc.campaignId, {
          name: doc.campaign?.name ?? "Unknown Campaign",
          wfNumber: doc.campaign?.wfNumber,
          docs: [],
        });
      }
      byCampaign.get(doc.campaignId)!.docs.push(doc);
    }
    return Array.from(byCampaign.entries())
      .map(([campaignId, group]) => ({
        campaignId,
        name: group.name,
        wfNumber: group.wfNumber,
        docs: [...group.docs].sort((a, b) => a.shootDate.localeCompare(b.shootDate)),
      }))
      .sort((a, b) => {
        const aEarliest = a.docs[0]?.shootDate ?? "";
        const bEarliest = b.docs[0]?.shootDate ?? "";
        return aEarliest.localeCompare(bEarliest);
      });
  }, [visibleDocs]);

  async function updateAllSections(doc: PRDoc, changes: { dateNeeded?: string; timeNeeded?: string }) {
    if (changes.timeNeeded) {
      const conflicting = doc.sections.filter(
        (s) => s.items.length > 0 && s.timeNeeded && s.timeNeeded !== changes.timeNeeded
      );
      if (conflicting.length > 0) {
        const names = conflicting.map(
          (s) => `${PR_DEPARTMENT_LABELS[s.department]} (${formatTime(s.timeNeeded!)})`
        );
        setConflicts((prev) => ({ ...prev, [doc.id]: names }));
      } else {
        setConflicts((prev) => { const n = { ...prev }; delete n[doc.id]; return n; });
      }
    }
    await Promise.all(
      PR_DEPARTMENTS.map((dept) =>
        fetch(`/api/product-requests/${doc.id}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ department: dept, ...changes }),
        })
      )
    );
    mutate();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-5">
      <div className="space-y-0">
        <PageHeader
          title="Product Requests"
          showDivider={false}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              {isBMM && (
                <Link
                  href="/product-requests/calendar"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
                >
                  <CalendarDays className="h-4 w-4" />
                  Calendar
                </Link>
              )}
              <Link
                href="/product-requests/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Request
              </Link>
            </div>
          )}
        />

        {!isLoading && (counts.needs + counts.submitted + counts.forwarded + counts.confirmed + counts.fulfilled) > 0 && (
          <div className="border-b border-border">
            <nav className="ui-tabs" role="tablist" aria-label="Product request workflow">
              {isBMM ? (
                <>
                  <FilterTab active={filter === "submitted"} onClick={() => setFilter("submitted")} label="Submitted" count={counts.submitted} />
                  <FilterTab active={filter === "forwarded"} onClick={() => setFilter("forwarded")} label="Sent for RBU Confirmation" count={counts.forwarded} />
                  <FilterTab active={filter === "confirmed"} onClick={() => setFilter("confirmed")} label="Confirmed" count={counts.confirmed} />
                </>
              ) : (
                <>
                  <FilterTab active={filter === "needs"} onClick={() => setFilter("needs")} label="Planning" count={counts.needs} />
                  <FilterTab active={filter === "submitted"} onClick={() => setFilter("submitted")} label="Submitted" count={counts.submitted} />
                  <FilterTab active={filter === "fulfilled"} onClick={() => setFilter("fulfilled")} label="Fulfilled" count={counts.fulfilled} />
                </>
              )}
            </nav>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-surface-secondary animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (counts.needs + counts.submitted + counts.forwarded + counts.confirmed + counts.fulfilled) === 0 && (
        <Card padding="none">
          <EmptyState
            icon={<PackageSearch className="h-5 w-5" />}
            title="No product requests yet"
            description="Create a request to collect food, produce, and other items needed for a shoot."
            action={
              <Link
                href="/product-requests/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create your first request
              </Link>
            }
          />
        </Card>
      )}

      {!isLoading && campaignGroups.length === 0 && (counts.needs + counts.submitted + counts.fulfilled) > 0 && (
        <Card padding="none">
          <EmptyState
            icon={<PackageSearch className="h-5 w-5" />}
            title="Nothing in this view"
            description="No requests match the current filter. Try another filter or create a new request."
          />
        </Card>
      )}

      <div className="space-y-4">
        {campaignGroups.map(({ campaignId, name, wfNumber, docs: campaignDocs }) => {
          const summaries = new Map(
            campaignDocs.map((doc) => [doc.id, summarizeDoc(doc)])
          );
          const sortedUniqueDates = [...new Set(campaignDocs.map((d) => d.shootDate))].sort();

          return (
            <Card key={campaignId} padding="none" className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-2 min-w-0">
                  <PackageSearch className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm font-semibold text-text-primary truncate">{name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-tertiary shrink-0">
                  {wfNumber && <span>{wfNumber}</span>}
                  <span aria-hidden>·</span>
                  <span>
                    {campaignDocs.length} request{campaignDocs.length === 1 ? "" : "s"}
                  </span>
                </div>
              </CardHeader>

              <div>
                {campaignDocs.map((doc) => {
                  const summary = summaries.get(doc.id) as SubmissionSummary;
                  const label = workflowLabel(doc, summary);
                  const variant = workflowRowVariant(doc, summary);
                  const rawPickupTime = summary.pickup?.time ?? "";
                  const deptLine = departmentSummary(doc.sections);
                  const hasItems = deptLine !== "No items yet";
                  const dayNum = sortedUniqueDates.indexOf(doc.shootDate) + 1;
                  const docConflicts = conflicts[doc.id];
                  const editable = doc.status === "draft";

                  return (
                    <div
                      key={doc.id}
                      className="group border-b border-border last:border-b-0"
                    >
                      <div
                        onClick={() => setSelectedId(doc.id)}
                        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-secondary"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                              Day {dayNum}
                            </span>
                            <span className="text-text-tertiary">·</span>
                            {editable ? (
                              <RowDateChip
                                key={`date-${doc.id}-${doc.sections.map(s => s.dateNeeded).join()}`}
                                value={summary.pickup?.date || doc.shootDate}
                                onSave={(iso) => updateAllSections(doc, { dateNeeded: iso })}
                              />
                            ) : (
                              <span className="font-semibold text-text-primary">
                                {formatCompactDate(doc.shootDate)}
                              </span>
                            )}
                            <span className="text-text-tertiary">·</span>
                            {editable ? (
                              <RowTimeChip
                                key={`time-${doc.id}-${rawPickupTime}`}
                                value={rawPickupTime}
                                onSave={(hhmm) => updateAllSections(doc, { timeNeeded: hhmm })}
                              />
                            ) : (
                              <span className="font-medium text-text-primary">
                                {rawPickupTime ? formatTime(rawPickupTime) : "TBD"}
                              </span>
                            )}
                            <span className="text-text-tertiary">·</span>
                            <span className="text-text-secondary">
                              {summary.totalItems} item{summary.totalItems === 1 ? "" : "s"}
                            </span>
                            {hasItems && (
                              <>
                                <span className="text-text-tertiary">·</span>
                                <span className="truncate text-text-tertiary">{deptLine}</span>
                              </>
                            )}
                            {!hasItems && (
                              <span className="italic text-text-tertiary">No items yet</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <StatusPill variant={variant}>{label}</StatusPill>
                          <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-primary" />
                        </div>
                      </div>

                      {docConflicts && docConflicts.length > 0 && (
                        <div className="flex items-center gap-2 border-t border-border/50 bg-amber-50/60 px-4 py-1.5">
                          <span className="text-[10px] text-amber-700">
                            {docConflicts.join(", ")} {docConflicts.length === 1 ? "has" : "have"} a different pickup time — consider creating a separate PR for {docConflicts.length === 1 ? "that department" : "those departments"}.
                          </span>
                          <button
                            type="button"
                            onClick={() => setConflicts((prev) => { const n = { ...prev }; delete n[doc.id]; return n; })}
                            className="ml-auto text-[10px] text-amber-600 hover:text-amber-800 transition-colors shrink-0"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <PRDocDrawer
        id={selectedId}
        onClose={() => {
          setSelectedId(null);
          mutate();
        }}
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock,
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
import { PR_DEPARTMENT_LABELS } from "@/types/domain";

type FilterId = "all" | "needs" | "ready" | "submitted" | "fulfilled";

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
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map((n) => Number(n));
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

type WorkflowBucket = "needs" | "ready" | "submitted" | "fulfilled" | "cancelled";

function workflowBucket(doc: PRDoc, summary: SubmissionSummary): WorkflowBucket {
  if (doc.status === "cancelled") return "cancelled";
  if (doc.status === "fulfilled") return "fulfilled";
  if (doc.status === "submitted" || doc.status === "forwarded") return "submitted";
  if (doc.status === "draft" && summary.readyToSubmit) return "ready";
  return "needs";
}

function workflowLabel(doc: PRDoc, summary: SubmissionSummary): string {
  if (doc.status === "draft") {
    if (!summary.hasItems) return "Needs items";
    if (summary.missingPickupSections > 0) return "Needs pickup info";
    return "Ready to submit";
  }
  if (doc.status === "submitted") return "Submitted";
  if (doc.status === "forwarded") return "Sent";
  if (doc.status === "fulfilled") return "Fulfilled";
  return "Cancelled";
}

function workflowVariant(bucket: WorkflowBucket): StatusVariant {
  switch (bucket) {
    case "needs":
      return "pending";
    case "ready":
      return "approved";
    case "submitted":
      return "submitted";
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

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary-light text-primary-hover"
          : "border-border bg-surface text-text-secondary hover:bg-surface-secondary"
      }`}
    >
      <span>{label}</span>
      <span className={`tabular-nums ${active ? "text-primary-hover" : "text-text-tertiary"}`}>
        {count}
      </span>
    </button>
  );
}

export default function ProductRequestsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useCurrentUser();
  const isBMM =
    user?.role === "Brand Marketing Manager" || user?.role === "Admin";

  const { data: docs, isLoading, mutate } = useSWR<PRDoc[]>(
    "/api/product-requests",
    fetcher,
    { refreshInterval: 60000 }
  );

  // Buckets by workflow state (once per render)
  const { byBucket, counts, allDocs } = useMemo(() => {
    const list = docs ?? [];
    const byBucket: Record<WorkflowBucket, PRDoc[]> = {
      needs: [],
      ready: [],
      submitted: [],
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
        all: list.length,
        needs: byBucket.needs.length,
        ready: byBucket.ready.length,
        submitted: byBucket.submitted.length,
        fulfilled: byBucket.fulfilled.length,
      },
      allDocs: list,
    };
  }, [docs]);

  // Default filter per persona:
  //   BMM/Admin → Submitted (what's waiting on them to forward)
  //   Everyone else → Needs attention (their drafts that need work)
  const defaultFilter: FilterId = isBMM ? "submitted" : "needs";
  const [filter, setFilter] = useState<FilterId>(defaultFilter);

  const visibleDocs = useMemo(() => {
    if (filter === "all") return allDocs;
    return byBucket[filter] ?? [];
  }, [filter, byBucket, allDocs]);

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
        docs: [...group.docs].sort((a, b) => b.shootDate.localeCompare(a.shootDate)),
      }))
      .sort((a, b) => {
        const aLatest = a.docs[0]?.shootDate ?? "";
        const bLatest = b.docs[0]?.shootDate ?? "";
        return bLatest.localeCompare(aLatest);
      });
  }, [visibleDocs]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-5">
      <PageHeader
        title="Product Requests"
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

      {!isLoading && counts.all > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterPill
            active={filter === "needs"}
            onClick={() => setFilter("needs")}
            label="Needs attention"
            count={counts.needs}
          />
          <FilterPill
            active={filter === "ready"}
            onClick={() => setFilter("ready")}
            label="Ready to submit"
            count={counts.ready}
          />
          <FilterPill
            active={filter === "submitted"}
            onClick={() => setFilter("submitted")}
            label={isBMM ? "Awaiting forward" : "Submitted"}
            count={counts.submitted}
          />
          <FilterPill
            active={filter === "fulfilled"}
            onClick={() => setFilter("fulfilled")}
            label="Fulfilled"
            count={counts.fulfilled}
          />
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={counts.all}
          />
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-surface-secondary animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && counts.all === 0 && (
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

      {!isLoading && counts.all > 0 && campaignGroups.length === 0 && (
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
          const shootDayGroups = groupDocsByShootDate(campaignDocs);
          const summaries = new Map(
            campaignDocs.map((doc) => [doc.id, summarizeDoc(doc)])
          );

          return (
            <Card key={campaignId} padding="none" className="overflow-hidden">
              <CardHeader>
                <CardTitle>
                  <PackageSearch />
                  <span className="truncate">{name}</span>
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  {wfNumber && <span className="tabular-nums">{wfNumber}</span>}
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">
                    {campaignDocs.length} request{campaignDocs.length === 1 ? "" : "s"}
                  </span>
                </div>
              </CardHeader>

              <div>
                {shootDayGroups.map(({ shootDate, docs: dayDocs }) => (
                  <section key={shootDate}>
                    <div className="flex items-center justify-between border-b border-border bg-surface-secondary px-4 py-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <CalendarDays className="h-4 w-4 text-text-secondary" />
                        {formatShootDate(shootDate)}
                      </span>
                      <span className="text-xs text-text-tertiary tabular-nums">
                        {dayDocs.length} request{dayDocs.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div>
                      {dayDocs.map((doc) => {
                        const summary = summaries.get(doc.id) as SubmissionSummary;
                        const bucket = workflowBucket(doc, summary);
                        const label = workflowLabel(doc, summary);
                        const variant = workflowVariant(bucket);
                        const pickupText = summary.pickup
                          ? `${formatCompactDate(summary.pickup.date)} · ${formatTime(summary.pickup.time)}`
                          : "TBD";
                        const deptLine = departmentSummary(doc.sections);

                        return (
                          <button
                            key={doc.id}
                            onClick={() => setSelectedId(doc.id)}
                            className="group flex w-full items-start gap-4 border-b border-border px-4 py-3 text-left last:border-b-0 transition-colors hover:bg-surface-secondary"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                                <span className="inline-flex items-center gap-1 text-text-secondary">
                                  <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                                  Pickup
                                </span>
                                <span className="font-semibold text-text-primary tabular-nums">
                                  {pickupText}
                                </span>
                                <span className="text-text-tertiary">·</span>
                                <span className="text-text-secondary tabular-nums">
                                  {summary.totalItems} item{summary.totalItems === 1 ? "" : "s"}
                                </span>
                                <span className="text-text-tertiary">·</span>
                                <span className="text-text-secondary tabular-nums">
                                  {summary.activeSections} dept{summary.activeSections === 1 ? "" : "s"}
                                </span>
                              </div>

                              <p
                                className={`truncate text-sm ${
                                  deptLine === "No items yet"
                                    ? "italic text-text-tertiary"
                                    : "text-text-secondary"
                                }`}
                              >
                                {deptLine}
                              </p>

                              {summary.issue && (
                                <p className="inline-flex items-center gap-1 text-xs text-warning">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {summary.issue}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-2 pt-0.5">
                              <StatusPill variant={variant}>{label}</StatusPill>
                              <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-primary" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
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

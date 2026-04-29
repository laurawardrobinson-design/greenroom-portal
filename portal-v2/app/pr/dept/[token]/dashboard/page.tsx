"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Package,
} from "lucide-react";
import type { DeptCalendarView } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

async function fetcher(url: string): Promise<DeptCalendarView> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function formatLongDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string) {
  if (!value) return "";
  if (/[ap]m/i.test(value)) return value.toUpperCase().replace(/\s+/g, " ");
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${min.toString().padStart(2, "0")} ${period}`;
}

export default function RBUDeptDashboard({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data } = useSWR(
    token ? `/api/product-requests/calendar/${token}` : null,
    fetcher
  );

  const [statusTab, setStatusTab] = useState<"pending" | "approved">("pending");

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () => (data?.entries ?? []).filter((e) => e.shootDate >= today),
    [data, today]
  );
  const pendingEntries = useMemo(
    () => upcoming.filter((e) => e.status !== "confirmed"),
    [upcoming]
  );
  const approvedEntries = useMemo(
    () => upcoming.filter((e) => e.status === "confirmed"),
    [upcoming]
  );
  const visibleEntries =
    statusTab === "pending" ? pendingEntries : approvedEntries;
  const thisWeekCount = useMemo(() => {
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const cutoff = in7.toISOString().slice(0, 10);
    return upcoming.filter((e) => e.shootDate <= cutoff).length;
  }, [upcoming]);

  return (
    <div className="space-y-4">
      <PageHeader title="Welcome back, Grant" />

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card padding="md">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-primary">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            Upcoming
          </div>
          <div className="mt-2 text-[28px] font-semibold text-text-primary leading-none">
            {data ? upcoming.length : "—"}
          </div>
          <div className="mt-1 text-xs text-text-tertiary">
            total shoots queued
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-primary">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            This Week
          </div>
          <div className="mt-2 text-[28px] font-semibold text-text-primary leading-none">
            {data ? thisWeekCount : "—"}
          </div>
          <div className="mt-1 text-xs text-text-tertiary">
            shoots in the next 7 days
          </div>
        </Card>

        <Link
          href={`/pr/dept/${token}/products`}
          className="rounded-xl border border-border bg-surface p-5 hover:border-text-tertiary transition-colors flex items-start justify-between gap-3 group"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-primary">
              <Package className="h-4 w-4 shrink-0 text-primary" />
              Catalog
            </div>
            <div className="mt-2 text-sm font-semibold text-text-primary leading-tight">
              View products
            </div>
            <div className="mt-1 text-xs text-text-tertiary">
              Item numbers, restrictions, R&amp;P guides
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-text-tertiary shrink-0 mt-1 group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* Upcoming requests — all departments */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Product requests
            </h3>
          </div>
          <Link
            href={`/pr/dept/${token}`}
            className="text-xs text-primary hover:underline"
          >
            View full calendar →
          </Link>
        </div>
        <div className="px-3.5 pt-3 pb-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-surface w-fit">
            {(
              [
                { key: "pending" as const, label: "Pending", count: pendingEntries.length },
                { key: "approved" as const, label: "Approved", count: approvedEntries.length },
              ]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusTab(t.key)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                  statusTab === t.key
                    ? "bg-surface-secondary text-text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {t.label}
                {t.count > 0 && <span className="ml-1">({t.count})</span>}
              </button>
            ))}
          </div>
        </div>
        {!data ? (
          <div className="px-5 py-8 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-text-secondary" />
          </div>
        ) : visibleEntries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-tertiary italic">
            {statusTab === "pending"
              ? "No pending product requests."
              : "No approved product requests."}
          </p>
        ) : (
          <ul className="divide-y divide-border-light">
            {visibleEntries.map((e) => (
              <li key={`${e.docId}:${e.department}`} className="px-5 py-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="text-base font-semibold text-text-primary">
                    {formatLongDate(e.shootDate)}
                  </div>
                  <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                    {e.department}
                  </div>
                </div>
                <div className="text-sm text-text-secondary mt-0.5">
                  {e.campaign.wfNumber
                    ? `${e.campaign.wfNumber} ${e.campaign.name}`
                    : e.campaign.name}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-text-secondary">
                  {(e.pickupDate || e.pickupTime) && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                      Pickup{" "}
                      {e.pickupDate
                        ? formatLongDate(e.pickupDate)
                        : formatLongDate(e.shootDate)}
                      {e.pickupTime ? ` · ${formatTime(e.pickupTime)}` : ""}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-text-tertiary" />
                    {e.itemCount} {e.itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
                {e.sectionToken && (
                  <Link
                    href={`/pr/view/${e.sectionToken}`}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-text-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    Review
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

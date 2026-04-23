"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Package,
  User,
} from "lucide-react";
import type { DeptCalendarView } from "@/types/domain";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";

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

function formatTime(hhmm: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
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

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () =>
      (data?.entries ?? []).filter((e) => e.shootDate >= today),
    [data, today]
  );
  const next = upcoming[0];
  const thisWeekCount = useMemo(() => {
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const cutoff = in7.toISOString().slice(0, 10);
    return upcoming.filter((e) => e.shootDate <= cutoff).length;
  }, [upcoming]);

  const deptLabel = data ? PR_DEPARTMENT_LABELS[data.department] : "";

  return (
    <div className="max-w-[11in] w-full mx-auto px-6 py-6 space-y-5">
      <header className="bg-white border border-neutral-200 rounded-xl px-6 py-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
          Welcome back
        </div>
        <h1 className="mt-1 text-[24px] font-semibold text-neutral-900 leading-tight">
          {deptLabel || "Department"} Dashboard
        </h1>
        <p className="mt-1 text-[13px] text-neutral-500">
          Upcoming product requests and quick access to your catalog.
        </p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            <CalendarDays className="h-3 w-3" />
            Upcoming
          </div>
          <div className="mt-1.5 text-[28px] font-semibold text-neutral-900 tabular-nums leading-none">
            {data ? upcoming.length : "—"}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            total shoots queued
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            <Clock className="h-3 w-3" />
            This week
          </div>
          <div className="mt-1.5 text-[28px] font-semibold text-neutral-900 tabular-nums leading-none">
            {data ? thisWeekCount : "—"}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            shoots in the next 7 days
          </div>
        </div>
        <Link
          href={`/pr/dept/${token}/products`}
          className="group bg-white border border-neutral-200 rounded-xl px-5 py-4 hover:border-neutral-400 transition-colors flex items-start justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              <Package className="h-3 w-3" />
              Catalog
            </div>
            <div className="mt-1.5 text-[14px] font-semibold text-neutral-900 leading-tight">
              View {deptLabel || "department"} products
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500">
              Item numbers, restrictions, R&amp;P guides
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-neutral-400 shrink-0 mt-1 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* Next shoot */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Next shoot
          </h3>
          <Link
            href={`/pr/dept/${token}`}
            className="text-[11px] text-[#004C2A] hover:underline"
          >
            View full calendar →
          </Link>
        </div>
        {!data ? (
          <div className="px-5 py-8 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
          </div>
        ) : !next ? (
          <p className="px-5 py-8 text-center text-[13px] text-neutral-400 italic">
            No upcoming shoots for {deptLabel}.
          </p>
        ) : (
          <div className="px-5 py-4">
            <div className="text-[15px] font-semibold text-neutral-900">
              {formatLongDate(next.shootDate)}
            </div>
            <div className="text-[13px] text-neutral-600 mt-0.5">
              {next.campaign.name}
              {next.campaign.wfNumber && (
                <span className="text-neutral-400 tabular-nums">
                  {" · "}
                  {next.campaign.wfNumber}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-neutral-700">
              {(next.pickupDate || next.pickupTime) && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-neutral-500" />
                  Pickup{" "}
                  {next.pickupDate
                    ? formatLongDate(next.pickupDate)
                    : formatLongDate(next.shootDate)}
                  {next.pickupTime ? ` · ${formatTime(next.pickupTime)}` : ""}
                </span>
              )}
              {next.pickupPerson && (
                <span className="flex items-center gap-1.5">
                  <User className="h-3 w-3 text-neutral-500" />
                  {next.pickupPerson}
                  {next.pickupPhone && (
                    <span className="text-neutral-500 tabular-nums">
                      · {next.pickupPhone}
                    </span>
                  )}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Package className="h-3 w-3 text-neutral-500" />
                {next.itemCount} {next.itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            {next.sectionToken && (
              <Link
                href={`/pr/view/${next.sectionToken}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-800 transition-colors"
              >
                Open request
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

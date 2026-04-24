"use client";

import Link from "next/link";
import useSWR from "swr";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { LobChip } from "./lob-chip";
import type { BmmShootsResponse, BmmShootRow } from "@/lib/services/brand-marketing.service";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";

async function fetcher(url: string): Promise<BmmShootsResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Shoots fetch failed: ${r.status}`);
  return r.json();
}

const WINDOW_DAYS = 14;

function daysBetween(isoFrom: string, isoTo: string): number {
  const a = new Date(isoFrom + "T00:00:00Z").getTime();
  const b = new Date(isoTo + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatMonthDay(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function relativeLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function RailUpcomingShoots() {
  const { data } = useSWR<BmmShootsResponse>(
    "/api/brand-marketing/shoots",
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60000 }
  );

  const today = data?.today ?? new Date().toISOString().slice(0, 10);
  const shoots = (data?.shoots ?? []).filter((s) => {
    const d = daysBetween(today, s.shootDate);
    return d >= 0 && d <= WINDOW_DAYS;
  });

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <CalendarClock />
          <span>Next 2 weeks · Shoots</span>
        </CardTitle>
        <span className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal">
          {shoots.length === 0
            ? "nothing imminent"
            : `${shoots.length} ${shoots.length === 1 ? "shoot" : "shoots"}`}
        </span>
      </CardHeader>

      {shoots.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">Clear calendar.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Nothing is shooting in the next two weeks.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {shoots.map((s) => (
            <ShootRow key={s.shootDateId} row={s} today={today} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ShootRow({ row, today }: { row: BmmShootRow; today: string }) {
  const days = daysBetween(today, row.shootDate);
  const accent = row.deskMatch
    ? "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-primary"
    : "";

  return (
    <li className="relative">
      <Link
        href={`/campaigns/${row.campaignId}`}
        className={`flex items-center gap-4 px-4 py-3 hover:bg-surface-secondary transition-colors ${accent}`}
      >
        <div className="w-16 shrink-0">
          <div className="text-sm font-semibold text-text-primary">
            {formatMonthDay(row.shootDate)}
          </div>
          <div className="text-[11px] text-text-tertiary">
            {relativeLabel(days)}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-tertiary">{row.wfNumber}</span>
            <span className="text-sm font-medium text-text-primary truncate">
              {row.campaignName}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <LobChip lob={row.lineOfBusiness} />
            {row.departments
              .filter((d) => PR_DEPARTMENT_LABELS[d] !== row.lineOfBusiness)
              .slice(0, 3)
              .map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-text-secondary ring-1 ring-inset ring-border"
                >
                  {PR_DEPARTMENT_LABELS[d]}
                </span>
              ))}
          </div>
        </div>

        <div className="shrink-0">
          {row.prStatus === "none" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-warning ring-1 ring-inset ring-amber-200">
              <AlertTriangle className="h-3 w-3" />
              No PR
            </span>
          ) : (
            <PRStatusPill status={row.prStatus} />
          )}
        </div>
      </Link>
    </li>
  );
}

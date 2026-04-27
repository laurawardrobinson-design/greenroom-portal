"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CalendarRange, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { LobChip } from "./lob-chip";
import type { BmmShootsResponse, BmmShootRow } from "@/lib/services/brand-marketing.service";
import type { PRDepartment } from "@/types/domain";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";

async function fetcher(url: string): Promise<BmmShootsResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Shoots fetch failed: ${r.status}`);
  return r.json();
}

const IMMINENT_CUTOFF_DAYS = 14;

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

const DEPT_ORDER: PRDepartment[] = ["Bakery", "Deli", "Produce", "Meat-Seafood", "Grocery"];

export function RailRbuAgenda() {
  const { data } = useSWR<BmmShootsResponse>(
    "/api/brand-marketing/shoots",
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60000 }
  );

  const today = data?.today ?? new Date().toISOString().slice(0, 10);
  const desk = data?.deskDepartment ?? null;

  // Only future shoots (> 14 days out). Group by department — a shoot
  // with multiple departments shows up under each for visibility.
  const byDept = useMemo(() => {
    const groups = new Map<PRDepartment, BmmShootRow[]>();
    for (const s of data?.shoots ?? []) {
      if (daysBetween(today, s.shootDate) <= IMMINENT_CUTOFF_DAYS) continue;
      const depts = s.departments.length > 0 ? s.departments : [];
      for (const d of depts) {
        if (!groups.has(d)) groups.set(d, []);
        groups.get(d)!.push(s);
      }
    }
    return groups;
  }, [data, today]);

  // Sort dept keys: user's desk first, then the canonical order.
  const orderedDepts = useMemo(() => {
    const seen = new Set<PRDepartment>();
    const out: PRDepartment[] = [];
    const candidates: PRDepartment[] = [];
    if (desk && byDept.has(desk)) candidates.push(desk);
    for (const d of DEPT_ORDER) if (d !== desk) candidates.push(d);
    for (const d of candidates) {
      if (byDept.has(d) && !seen.has(d)) {
        out.push(d);
        seen.add(d);
      }
    }
    return out;
  }, [byDept, desk]);

  const totalRows = useMemo(
    () => [...byDept.values()].reduce((acc, rows) => acc + rows.length, 0),
    [byDept]
  );
  const missingPrCount = useMemo(() => {
    const uniqueMissing = new Set<string>();
    for (const rows of byDept.values()) {
      for (const r of rows) {
        if (r.prStatus === "none") uniqueMissing.add(r.shootDateId);
      }
    }
    return uniqueMissing.size;
  }, [byDept]);

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <CalendarRange />
          <span>RBU weekly agenda · Shoots on the horizon</span>
        </CardTitle>
        <span className="text-[13px] font-normal text-text-tertiary normal-case tracking-normal">
          {totalRows === 0
            ? "nothing scheduled"
            : missingPrCount > 0
              ? `${missingPrCount} awaiting PR`
              : `${totalRows} scheduled`}
        </span>
      </CardHeader>

      {orderedDepts.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">Nothing on the horizon.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Once producers schedule shoots 2+ weeks out, they'll land here as
            your weekly RBU talking points.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {orderedDepts.map((dept) => {
            const rows = byDept.get(dept) ?? [];
            const isDesk = dept === desk;
            return (
              <li key={dept} className="py-2">
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isDesk ? "text-primary" : "text-text-secondary"
                    }`}
                  >
                    {PR_DEPARTMENT_LABELS[dept]}
                  </span>
                  {isDesk && (
                    <span className="rounded-full bg-primary-light px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                      my desk
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-text-tertiary">
                    {rows.length} {rows.length === 1 ? "shoot" : "shoots"}
                  </span>
                </div>
                <ul>
                  {rows.map((r) => (
                    <AgendaRow key={`${dept}-${r.shootDateId}`} row={r} today={today} isDesk={isDesk} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function AgendaRow({
  row,
  today,
  isDesk,
}: {
  row: BmmShootRow;
  today: string;
  isDesk: boolean;
}) {
  const days = daysBetween(today, row.shootDate);
  const weeksOut = Math.floor(days / 7);
  const accent = isDesk
    ? "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-primary"
    : "";

  return (
    <li className="relative">
      <Link
        href={`/brand-marketing/campaigns/${row.campaignId}`}
        className={`flex items-center gap-3 px-4 py-2 hover:bg-surface-secondary transition-colors ${accent}`}
      >
        <div className="w-20 shrink-0">
          <div className="text-sm font-medium text-text-primary">
            {formatMonthDay(row.shootDate)}
          </div>
          <div className="text-[11px] text-text-tertiary">
            {weeksOut <= 1 ? `in ${days} days` : `~${weeksOut} wks out`}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-text-tertiary">{row.wfNumber}</span>
            <span className="text-sm text-text-primary truncate">
              {row.campaignName}
            </span>
          </div>
          <div className="mt-0.5">
            <LobChip lob={row.lineOfBusiness} />
          </div>
        </div>

        <div className="shrink-0">
          {row.prStatus === "none" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-warning ring-1 ring-inset ring-amber-200">
              <AlertTriangle className="h-3 w-3" />
              Pre-brief RBU
            </span>
          ) : (
            <PRStatusPill status={row.prStatus} />
          )}
        </div>
      </Link>
    </li>
  );
}

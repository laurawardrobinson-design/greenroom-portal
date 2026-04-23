"use client";

import { useMemo, useState } from "react";
import {
  Apple,
  Beef,
  ChevronLeft,
  ChevronRight,
  Cookie,
  Sandwich,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import type {
  DeptCalendarEntry,
  PRDepartment,
} from "@/types/domain";

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

// Flat, print-friendly palette. Keep bg light (prints well) and
// border medium so chips still read on monochrome output.
export const DEPT_COLORS: Record<
  PRDepartment,
  { bg: string; border: string; text: string; dot: string }
> = {
  Bakery: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  Produce: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    dot: "bg-green-600",
  },
  Deli: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
    dot: "bg-orange-500",
  },
  "Meat-Seafood": {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-800",
    dot: "bg-rose-500",
  },
  Grocery: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-800",
    dot: "bg-sky-600",
  },
};

const MONTH_LABEL: Record<number, string> = {
  0: "January",
  1: "February",
  2: "March",
  3: "April",
  4: "May",
  5: "June",
  6: "July",
  7: "August",
  8: "September",
  9: "October",
  10: "November",
  11: "December",
};

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function groupByDate(
  entries: DeptCalendarEntry[]
): Map<string, DeptCalendarEntry[]> {
  const map = new Map<string, DeptCalendarEntry[]>();
  for (const e of entries) {
    if (!map.has(e.shootDate)) map.set(e.shootDate, []);
    map.get(e.shootDate)!.push(e);
  }
  return map;
}

export function PRMonthCalendar({
  entries,
  onEntryClick,
  showDept = false,
  initialDate,
  selectedKey,
}: {
  entries: DeptCalendarEntry[];
  onEntryClick: (entry: DeptCalendarEntry) => void;
  showDept?: boolean;
  initialDate?: Date;
  selectedKey?: string;
}) {
  // Default to the earliest entry's month, or today if no entries.
  const defaultMonth = useMemo(() => {
    if (initialDate) return initialDate;
    if (entries.length > 0) {
      const first = entries[0].shootDate;
      return new Date(`${first}T12:00:00`);
    }
    return new Date();
  }, [entries, initialDate]);

  const [cursor, setCursor] = useState(
    () => new Date(defaultMonth.getFullYear(), defaultMonth.getMonth(), 1)
  );

  const byDate = useMemo(() => groupByDate(entries), [entries]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = startOfMonth(year, month);
  const leadingBlanks = first.getDay(); // 0=Sun
  const totalDays = daysInMonth(year, month);

  const cells: { iso: string | null; day: number | null }[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ iso: null, day: null });
  for (let d = 1; d <= totalDays; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });

  const todayIso = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  const gotoPrev = () => setCursor(new Date(year, month - 1, 1));
  const gotoNext = () => setCursor(new Date(year, month + 1, 1));
  const gotoToday = () => {
    const t = new Date();
    setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-text-primary">
            {MONTH_LABEL[month]} {year}
          </h2>
          <button
            onClick={gotoToday}
            className="text-[12px] text-text-tertiary hover:text-text-primary transition-colors no-print"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1 no-print">
          <button
            onClick={gotoPrev}
            className="rounded-md p-1 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={gotoNext}
            className="rounded-md p-1 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-secondary/40">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 auto-rows-[minmax(3.25rem,_auto)]">
        {cells.map((cell, idx) => {
          if (!cell.iso) {
            return (
              <div
                key={idx}
                className="border-b border-r border-border/60 bg-surface-secondary/20"
              />
            );
          }
          const dayEntries = byDate.get(cell.iso) || [];
          const isToday = cell.iso === todayIso;
          return (
            <div
              key={cell.iso}
              className={`relative border-b border-r border-border/60 p-1 min-h-[3.25rem] ${
                isToday ? "bg-primary/[0.04]" : ""
              }`}
            >
              <div
                className={`text-[10px] tabular-nums leading-none mb-0.5 ${
                  isToday
                    ? "font-semibold text-primary"
                    : "text-text-tertiary"
                }`}
              >
                {cell.day}
              </div>
              <DayCellChips
                dayEntries={dayEntries}
                groupByCampaign={showDept}
                onEntryClick={onEntryClick}
                selectedKey={selectedKey}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Renders the chips for a single day cell. In per-department mode
// (public view) we show one tiny chip per entry. In campaign mode
// (BMM master) we group the day's entries by campaign and show one
// card per campaign with its departments listed underneath.
function DayCellChips({
  dayEntries,
  groupByCampaign,
  onEntryClick,
  selectedKey,
}: {
  dayEntries: DeptCalendarEntry[];
  groupByCampaign: boolean;
  onEntryClick: (entry: DeptCalendarEntry) => void;
  selectedKey?: string;
}) {
  if (!groupByCampaign) {
    return (
      <div className="flex flex-wrap gap-0.5">
        {dayEntries.map((e) => {
          const c = DEPT_COLORS[e.department];
          const key = `${e.docId}:${e.department}`;
          const selected = selectedKey === key;
          return (
            <button
              key={key}
              onClick={() => onEntryClick(e)}
              className={`flex items-center gap-0.5 rounded border ${c.border} ${c.bg} px-1 py-0.5 text-[10px] ${c.text} hover:shadow-sm transition-all ${
                selected ? "ring-2 ring-primary ring-offset-1" : ""
              }`}
              title={`${e.campaign.name} · ${e.itemCount} items${e.pickupTime ? ` · ${e.pickupTime}` : ""}`}
            >
              <span className="font-medium tabular-nums leading-none">
                {e.campaign.wfNumber || e.docNumber}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Group by docId (one PR doc per campaign per shoot date)
  const byDoc = new Map<string, DeptCalendarEntry[]>();
  for (const e of dayEntries) {
    if (!byDoc.has(e.docId)) byDoc.set(e.docId, []);
    byDoc.get(e.docId)!.push(e);
  }

  return (
    <div className="space-y-1">
      {Array.from(byDoc.entries()).map(([docId, group]) => {
        const first = group[0];
        const totalItems = group.reduce((n, e) => n + e.itemCount, 0);
        const selected = selectedKey === docId;
        return (
          <button
            key={docId}
            onClick={() => onEntryClick(first)}
            className={`block w-full overflow-hidden text-left rounded border border-border bg-surface px-1.5 py-1 hover:shadow-sm transition-all ${
              selected ? "ring-2 ring-primary ring-offset-1" : ""
            }`}
            title={`${first.campaign.name} · ${group.length} ${
              group.length === 1 ? "dept" : "depts"
            } · ${totalItems} items`}
          >
            <div className="text-[10px] font-semibold text-text-primary tabular-nums leading-tight truncate">
              {first.campaign.wfNumber || first.docNumber}
            </div>
            <div className="text-[10px] text-text-tertiary leading-tight truncate">
              {first.campaign.name}
            </div>
            <div className="mt-0.5 flex items-center gap-0.5">
              {group.map((e) => {
                const c = DEPT_COLORS[e.department];
                const Icon = DEPT_ICONS[e.department];
                return (
                  <span
                    key={e.department}
                    className={`inline-flex items-center justify-center h-3.5 w-3.5 rounded border ${c.border} ${c.bg}`}
                    title={e.department}
                  >
                    <Icon className={`h-2.5 w-2.5 ${c.text}`} />
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

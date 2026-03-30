"use client";

import { useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  selectedDates: string[]; // ISO date strings
  onToggleDate: (date: string) => void;
  onRemoveDate: (date: string) => void;
}

export function DateChipPicker({
  selectedDates,
  onToggleDate,
  onRemoveDate,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedSet = new Set(selectedDates);

  return (
    <div className="space-y-2">
      {/* Calendar */}
      <div className="rounded-lg border border-border bg-surface p-2 max-w-[240px]">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="h-5 w-5 flex items-center justify-center rounded text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="text-[11px] font-semibold text-text-primary">
            {format(currentMonth, "MMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="h-5 w-5 flex items-center justify-center rounded text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div
              key={i}
              className="h-5 flex items-center justify-center text-[10px] font-medium text-text-tertiary"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const isSelected = selectedSet.has(iso);
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <button
                type="button"
                key={iso}
                onClick={() => onToggleDate(iso)}
                className={`h-6 w-full flex items-center justify-center text-[10px] rounded transition-all ${
                  isSelected
                    ? "bg-primary text-white font-semibold"
                    : inMonth
                    ? "text-text-primary hover:bg-surface-secondary"
                    : "text-text-tertiary/40"
                } ${today && !isSelected ? "ring-1 ring-primary/30" : ""}`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date chips */}
      {selectedDates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {formatDateChips(selectedDates).map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => {
                  chip.dates.forEach((d) => onRemoveDate(d));
                }}
                className="ml-0.5 text-primary/60 hover:text-primary transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Format selected dates into chips, collapsing consecutive dates into ranges
function formatDateChips(
  dates: string[]
): { key: string; label: string; dates: string[] }[] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const chips: { key: string; label: string; dates: string[] }[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];
  let rangeDates = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(rangeEnd);
    const curr = new Date(sorted[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;

    if (diffDays === 1) {
      rangeEnd = sorted[i];
      rangeDates.push(sorted[i]);
    } else {
      chips.push(makeChip(rangeStart, rangeEnd, rangeDates));
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
      rangeDates = [sorted[i]];
    }
  }
  chips.push(makeChip(rangeStart, rangeEnd, rangeDates));
  return chips;
}

function makeChip(
  start: string,
  end: string,
  dates: string[]
): { key: string; label: string; dates: string[] } {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");

  if (start === end) {
    return {
      key: start,
      label: format(s, "EEE, MMM d"),
      dates,
    };
  }

  // Same month
  if (s.getMonth() === e.getMonth()) {
    return {
      key: `${start}-${end}`,
      label: `${format(s, "MMM d")}–${format(e, "d")}`,
      dates,
    };
  }

  return {
    key: `${start}-${end}`,
    label: `${format(s, "MMM d")}–${format(e, "MMM d")}`,
    dates,
  };
}

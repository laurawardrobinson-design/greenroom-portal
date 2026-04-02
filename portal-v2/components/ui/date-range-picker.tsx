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
  isBefore,
  startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  startDate: string; // ISO date string or ""
  endDate: string; // ISO date string or ""
  onChange: (start: string, end: string) => void;
  minDate?: string; // ISO date string — dates before this are disabled
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(
    startDate ? new Date(startDate + "T12:00:00") : new Date()
  );
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const minDateObj = minDate
    ? startOfDay(new Date(minDate + "T12:00:00"))
    : startOfDay(new Date());

  // Selection is "picking end" when we have a start but no end
  const pickingEnd = !!startDate && !endDate;

  function handleDayClick(iso: string) {
    const clicked = new Date(iso + "T12:00:00");
    if (isBefore(clicked, minDateObj)) return;

    if (!startDate || (startDate && endDate)) {
      // Start fresh selection
      onChange(iso, "");
    } else {
      // We have a start, set end
      if (iso < startDate) {
        // Clicked before start — reset with this as new start
        onChange(iso, "");
      } else if (iso === startDate) {
        // Same day — treat as single-day range
        onChange(iso, iso);
      } else {
        onChange(startDate, iso);
      }
    }
  }

  function getDayState(iso: string) {
    const isStart = iso === startDate;
    const isEnd = iso === endDate;
    const isSelected = isStart || isEnd;

    let inRange = false;
    if (startDate && endDate) {
      inRange = iso > startDate && iso < endDate;
    } else if (pickingEnd && hoveredDate && hoveredDate > startDate) {
      inRange = iso > startDate && iso <= hoveredDate;
    }

    return { isStart, isEnd, isSelected, inRange };
  }

  // Summary text
  const summary = startDate
    ? endDate
      ? startDate === endDate
        ? format(new Date(startDate + "T12:00:00"), "EEE, MMM d")
        : `${format(new Date(startDate + "T12:00:00"), "MMM d")} – ${format(new Date(endDate + "T12:00:00"), "MMM d, yyyy")}`
      : `${format(new Date(startDate + "T12:00:00"), "MMM d")} – select end date`
    : null;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-surface p-3">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="h-6 w-6 flex items-center justify-center rounded text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-semibold text-text-primary">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="h-6 w-6 flex items-center justify-center rounded text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
            <div
              key={i}
              className="h-7 flex items-center justify-center text-[10px] font-semibold text-text-tertiary uppercase"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const disabled = isBefore(
              startOfDay(day),
              minDateObj
            );
            const { isStart, isEnd, isSelected, inRange } = getDayState(iso);

            // Range background band
            let rangeBg = "";
            if (inRange) rangeBg = "bg-primary/10";
            if (isStart && (endDate || (pickingEnd && hoveredDate && hoveredDate > startDate)))
              rangeBg += " rounded-l-md";
            if (isEnd || (inRange && !endDate && iso === hoveredDate))
              rangeBg += " rounded-r-md";

            return (
              <div key={iso} className={`relative ${rangeBg}`}>
                <button
                  type="button"
                  onClick={() => handleDayClick(iso)}
                  onMouseEnter={() => pickingEnd && setHoveredDate(iso)}
                  onMouseLeave={() => setHoveredDate(null)}
                  disabled={disabled}
                  className={`relative z-10 h-8 w-full flex items-center justify-center text-xs rounded-md transition-all ${
                    isSelected
                      ? "bg-primary text-white font-semibold"
                      : disabled
                      ? "text-text-tertiary/30 cursor-not-allowed"
                      : inMonth
                      ? "text-text-primary hover:bg-surface-secondary"
                      : "text-text-tertiary/30"
                  } ${today && !isSelected ? "ring-1 ring-primary/30" : ""}`}
                >
                  {format(day, "d")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Range summary */}
      {summary && (
        <p className="text-xs font-medium text-primary px-1">{summary}</p>
      )}
    </div>
  );
}

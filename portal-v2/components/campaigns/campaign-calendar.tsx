"use client";

import { useState, useMemo } from "react";
import type { CampaignListItem } from "@/types/domain";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  campaigns: CampaignListItem[];
}

const SHOOT_DOT_COLOR: Record<string, string> = {
  Photo: "bg-blue-400",
  Video: "bg-purple-400",
  Hybrid: "bg-amber-400",
  Other: "bg-slate-400",
};

interface ShootEvent {
  campaignName: string;
  campaignId: string;
  shootName: string;
  shootType: string;
  date: string;
}

export function CampaignCalendar({ campaigns }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Collect all shoot dates across campaigns
  const shootEvents = useMemo(() => {
    const events: ShootEvent[] = [];
    for (const c of campaigns) {
      for (const shoot of c.shootsSummary) {
        for (const date of shoot.dates) {
          events.push({
            campaignName: c.name,
            campaignId: c.id,
            shootName: shoot.name,
            shootType: shoot.shootType,
            date,
          });
        }
      }
    }
    return events;
  }, [campaigns]);

  // Group by date string
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ShootEvent[]>();
    for (const e of shootEvents) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [shootEvents]);

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedEvents = selectedDateStr ? eventsByDate.get(selectedDateStr) || [] : [];

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="rounded-md p-1 text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="rounded-md p-1 text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="text-center text-[10px] font-medium text-text-tertiary py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const events = eventsByDate.get(dateStr) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          // Unique shoot types on this day
          const types = [...new Set(events.map((e) => e.shootType))];

          return (
            <button
              key={dateStr}
              onClick={() => events.length > 0 && setSelectedDate(isSelected ? null : day)}
              className={`
                relative flex flex-col items-center justify-center py-1.5 text-xs rounded-md transition-colors
                ${!inMonth ? "text-text-tertiary/40" : today ? "font-bold text-primary" : "text-text-primary"}
                ${isSelected ? "bg-primary/10 ring-1 ring-primary/30" : ""}
                ${events.length > 0 ? "cursor-pointer hover:bg-surface-secondary" : "cursor-default"}
              `}
            >
              <span className={today ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold" : ""}>
                {format(day, "d")}
              </span>
              {types.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {types.slice(0, 3).map((type, i) => (
                    <span
                      key={i}
                      className={`h-1 w-1 rounded-full ${SHOOT_DOT_COLOR[type] || SHOOT_DOT_COLOR.Other}`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date events */}
      {selectedEvents.length > 0 && selectedDate && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            {format(selectedDate, "EEEE, MMMM d")}
          </p>
          {selectedEvents.map((e, i) => (
            <a
              key={i}
              href={`/campaigns/${e.campaignId}`}
              className="flex items-center gap-2 rounded-lg bg-surface-secondary p-2 text-xs hover:bg-surface-tertiary transition-colors"
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${SHOOT_DOT_COLOR[e.shootType] || SHOOT_DOT_COLOR.Other}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">{e.shootName}</p>
                <p className="text-text-tertiary truncate">{e.campaignName}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

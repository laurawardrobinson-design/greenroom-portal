"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
  isSameDay,
  parseISO,
} from "date-fns";
import Link from "next/link";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface ShootEvent {
  id: string;
  date: string;
  location: string;
  callTime: string;
  notes: string;
  campaign: {
    id: string;
    name: string;
    wfNumber: string;
    status: string;
    brand: string;
  } | null;
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, "yyyy-MM");

  const { data: rawEvents } = useSWR<ShootEvent[]>(
    `/api/calendar?month=${monthStr}`,
    fetcher
  );
  const events: ShootEvent[] = Array.isArray(rawEvents) ? rawEvents : [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart); // 0=Sun

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const selectedEvents = selectedDay
    ? events.filter((e) => isSameDay(parseISO(e.date), selectedDay))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">
          Shoot Calendar
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium text-text-primary">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar grid */}
        <Card padding="sm" className="lg:col-span-2">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-medium text-text-tertiary"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells for padding */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="h-20 border-t border-border-light" />
            ))}

            {days.map((day) => {
              const dayEvents = events.filter((e) =>
                isSameDay(parseISO(e.date), day)
              );
              const isSelected = selectedDay && isSameDay(day, selectedDay);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`h-20 border-t border-border-light p-1 text-left transition-colors hover:bg-surface-secondary ${
                    isSelected ? "bg-primary/5 ring-1 ring-primary" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday(day)
                        ? "bg-primary text-white font-bold"
                        : "text-text-primary"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <div
                          key={e.id}
                          className="truncate rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary"
                        >
                          {e.campaign?.name || "Shoot"}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-text-tertiary px-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Day detail panel */}
        <Card>
          {selectedDay ? (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                {format(selectedDay, "EEEE, MMMM d")}
              </h3>
              <p className="text-xs text-text-tertiary mb-4">
                {selectedEvents.length} shoot{selectedEvents.length !== 1 ? "s" : ""}
              </p>

              {selectedEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={event.campaign ? `/campaigns/${event.campaign.id}` : "#"}
                      className="block rounded-lg border border-border p-3 hover:bg-surface-secondary transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-text-primary">
                          {event.campaign?.name || "Untitled shoot"}
                        </p>
                        {event.campaign?.status && (
                          <CampaignStatusBadge status={event.campaign.status as never} />
                        )}
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-text-tertiary">
                        {event.location && <span>{event.location}</span>}
                        {event.callTime && <span>Call: {event.callTime}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No shoots"
                  description="No shoots scheduled for this day."
                />
              )}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarIcon className="h-5 w-5" />}
              title="Select a day"
              description="Click a day on the calendar to see shoot details."
            />
          )}
        </Card>
      </div>
    </div>
  );
}

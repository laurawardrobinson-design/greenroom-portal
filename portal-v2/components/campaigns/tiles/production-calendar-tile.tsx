"use client";

import { useState, useMemo } from "react";
import type { Shoot } from "@/types/domain";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
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
  isToday,
  isBefore,
  startOfDay,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, AlertTriangle, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getShootDayName } from "@/components/campaigns/shoot-day-modal";

interface Props {
  shoots: Shoot[];
  campaignId: string;
  wfNumber: string | null | undefined;
  canEdit: boolean;
  onMutate: () => void;
  onDayClick: (shoot: Shoot) => void;
}

export function ProductionCalendarTile({
  shoots,
  campaignId,
  wfNumber,
  canEdit,
  onMutate,
  onDayClick,
}: Props) {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{
    shootId: string;
    dateId: string;
    date: string;
    name: string;
    hasCrew: boolean;
    callTime: string | null;
  } | null>(null);

  // Build map of date string → shoot
  const dateShootMap = useMemo(() => {
    const map = new Map<string, Shoot>();
    for (const shoot of shoots) {
      for (const d of shoot.dates) {
        map.set(d.shootDate, shoot);
      }
    }
    return map;
  }, [shoots]);

  const shootDateSet = useMemo(() => new Set(dateShootMap.keys()), [dateShootMap]);

  // Calendar grid
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

  const today = startOfDay(new Date());

  function handleDateClick(dateStr: string, inMonth: boolean, isPastDate: boolean) {
    if (!inMonth) return;

    const existingShoot = dateShootMap.get(dateStr);
    if (existingShoot) {
      onDayClick(existingShoot);
      return;
    }

    if (isPastDate || !canEdit) return;
    handleAddDay(dateStr);
  }

  async function handleAddDay(dateStr: string) {
    setAdding(true);
    try {
      // Compute day number for the name
      const allDates = shoots
        .filter((s) => s.dates.length > 0)
        .map((s) => s.dates[0].shootDate);
      const sortedDates = [...allDates, dateStr].sort();
      const dayNum = sortedDates.indexOf(dateStr) + 1;
      const dateLabel = format(parseISO(dateStr), "MMM d");
      const shootName = wfNumber
        ? `${dateLabel} - Day ${dayNum} of ${wfNumber}`
        : `${dateLabel} - Day ${dayNum}`;

      // Create shoot
      const shootRes = await fetch("/api/shoots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          name: shootName,
          shootType: "Photo",
          dates: [],
        }),
      });
      if (!shootRes.ok) throw new Error("Failed");
      const newShoot = await shootRes.json();

      // Add date to it
      const dateRes = await fetch(`/api/shoots/${newShoot.id}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [{ shootDate: dateStr }] }),
      });
      if (!dateRes.ok) throw new Error("Failed");

      await new Promise((r) => setTimeout(r, 300));
      onMutate();
    } catch {
      toast("error", "Failed to add shoot day");
    } finally {
      setAdding(false);
    }
  }

  async function removeDate(dateId: string) {
    try {
      await fetch(`/api/shoot-dates/${dateId}`, { method: "DELETE" });
      toast("success", "Date removed");
      setConfirmRemove(null);
      await new Promise((r) => setTimeout(r, 300));
      onMutate();
    } catch {
      toast("error", "Failed to remove date");
    }
  }

  return (
    <Card padding="none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="rounded-md p-0.5 text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="rounded-md p-0.5 text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3.5 py-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-0.5">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-medium text-text-tertiary py-0.5"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, currentMonth);
            const isTodays = isToday(day);
            const isPast = isBefore(day, today) && !isToday(day);
            const hasShoot = shootDateSet.has(dateStr);
            const isLoading = adding;

            return (
              <button
                key={dateStr}
                onClick={() => handleDateClick(dateStr, inMonth, isPast)}
                disabled={isLoading && !hasShoot}
                className={`
                  relative flex items-center justify-center h-7 w-7 mx-auto text-[11px] rounded-full transition-all
                  ${!inMonth ? "text-text-tertiary/30 cursor-default" : ""}
                  ${inMonth && isPast && !hasShoot ? "text-text-tertiary/50 cursor-default" : ""}
                  ${inMonth && !isPast && !hasShoot && !isTodays ? "text-text-primary cursor-pointer hover:bg-surface-secondary" : ""}
                  ${isTodays && !hasShoot ? "font-bold text-primary cursor-pointer" : ""}
                  ${hasShoot ? "bg-primary text-white font-medium cursor-pointer hover:bg-primary/90" : ""}
                `}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        {adding && (
          <p className="text-[10px] text-text-tertiary text-center mt-2">Adding...</p>
        )}
      </div>

      {/* Confirmation modal for removing dates with data */}
      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove Shoot Date?"
      >
        {confirmRemove && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-text-primary">
                  <strong>{format(parseISO(confirmRemove.date), "EEEE, MMMM d")}</strong> has
                  data that will be lost:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                  {confirmRemove.callTime && (
                    <li>Call time: {confirmRemove.callTime}</li>
                  )}
                  {confirmRemove.hasCrew && <li>Crew assignments</li>}
                </ul>
              </div>
            </div>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
                Keep Date
              </Button>
              <Button
                variant="danger"
                onClick={() => removeDate(confirmRemove.dateId)}
              >
                Remove Date
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </Card>
  );
}

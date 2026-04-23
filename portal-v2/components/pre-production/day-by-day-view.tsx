"use client";

import { useState, useCallback } from "react";
import { CalendarDays, Clock, GripVertical } from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { format, parseISO } from "date-fns";
import type { Shoot } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Format "05:00:00" or "08:30:00" → "5:00 AM" or "8:30 AM"
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h)) return time;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface Props {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  shoots: Shoot[];
}

interface ScheduleData {
  setups: Array<{ id: string; name: string; location: string; sort_order: number }>;
  shots: Array<{
    id: string;
    setup_id: string;
    name: string;
    description: string;
    props: string;
    location: string;
    sort_order: number;
    estimated_duration_minutes: number;
    shoot_date_id: string | null;
    sort_order_in_day: number;
  }>;
  links: Array<{ shot_id: string; deliverable_id: string }>;
  productLinks: Array<{ shot_id: string; campaign_product_id: string }>;
  deliverables: Array<{ id: string; channel: string }>;
  campaignProducts: Array<{ id: string; product?: { name: string; item_code: string } }>;
  talent: Array<{ id: string; shot_id: string; campaign_id: string; talent_number: number; label: string }>;
}

// Colors for setup badges
const SETUP_BADGE_COLORS = [
  "bg-amber-100 text-warning",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-error",
  "bg-emerald-100 text-success",
  "bg-violet-100 text-violet-700",
  "bg-yellow-100 text-yellow-700",
  "bg-orange-100 text-warning",
  "bg-sky-100 text-sky-700",
];

export function DayByDayView({ campaignId, campaignName, wfNumber, shoots }: Props) {
  const allDates = shoots.flatMap((s) =>
    s.dates.map((d) => ({ ...d, shootName: s.name, shootId: s.id }))
  ).sort((a, b) => a.shootDate.localeCompare(b.shootDate));

  const { data, isLoading } = useSWR<ScheduleData>(
    `/api/campaigns/${campaignId}/schedule`,
    fetcher
  );

  const [dragShotId, setDragShotId] = useState<string | null>(null);

  const handleDrop = useCallback(
    async (targetDateId: string | null) => {
      if (!dragShotId || !data) return;

      await fetch(`/api/campaigns/${campaignId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: dragShotId,
          shootDateId: targetDateId,
        }),
      });

      globalMutate(`/api/campaigns/${campaignId}/schedule`);
      setDragShotId(null);
    },
    [dragShotId, data, campaignId]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || data.shots.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          <CalendarDays className="h-4 w-4 text-text-tertiary" />
        </div>
        <p className="text-sm text-text-tertiary">No shots to schedule. Add shots from the campaign detail page.</p>
      </div>
    );
  }

  // Setup color map
  const setupIds = [...new Set(data.setups.map((s) => s.id))];
  const setupColorMap = new Map(setupIds.map((id, i) => [id, SETUP_BADGE_COLORS[i % SETUP_BADGE_COLORS.length]]));
  const setupNameMap = new Map(data.setups.map((s) => [s.id, s.name]));

  // Group shots by date
  const shotsByDate = new Map<string | null, typeof data.shots>();
  for (const shot of data.shots) {
    const key = shot.shoot_date_id;
    if (!shotsByDate.has(key)) shotsByDate.set(key, []);
    shotsByDate.get(key)!.push(shot);
  }

  // Unassigned shots
  const unassigned = shotsByDate.get(null) || [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <p className="text-sm text-text-secondary">
        {data.shots.length} shot{data.shots.length !== 1 ? "s" : ""} &middot;{" "}
        {allDates.length} day{allDates.length !== 1 ? "s" : ""} &middot;{" "}
        {unassigned.length} unassigned
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Date columns */}
        {allDates.map((dateObj, di) => {
          const dateShots = (shotsByDate.get(dateObj.id) || [])
            .sort((a, b) => a.sort_order_in_day - b.sort_order_in_day);
          const totalMin = dateShots.reduce((s, shot) => s + (shot.estimated_duration_minutes || 15), 0);
          const hrs = Math.floor(totalMin / 60);
          const mins = totalMin % 60;

          return (
            <div
              key={dateObj.id}
              className="rounded-lg border border-border bg-surface overflow-hidden"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(dateObj.id)}
            >
              {/* Date header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-surface-secondary/50">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Day {di + 1}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {format(parseISO(dateObj.shootDate), "EEE, MMM d")}
                    {dateObj.callTime ? ` · Call: ${formatTime(dateObj.callTime)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                  <Clock className="h-3 w-3" />
                  {dateShots.length} shots &middot; {hrs > 0 ? `${hrs}h ` : ""}{mins}m
                </div>
              </div>

              {/* Shot cards */}
              <div className="p-2 space-y-1.5 min-h-[80px]">
                {dateShots.length === 0 ? (
                  <p className="text-xs text-text-tertiary py-4 text-center">
                    Drag shots here
                  </p>
                ) : (
                  dateShots.map((shot) => (
                    <ShotCard
                      key={shot.id}
                      shot={shot}
                      setupName={setupNameMap.get(shot.setup_id) || ""}
                      setupColor={setupColorMap.get(shot.setup_id) || ""}
                      onDragStart={() => setDragShotId(shot.id)}
                      isDragging={dragShotId === shot.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Unassigned column */}
        {unassigned.length > 0 && (
          <div
            className="rounded-lg border border-dashed border-border bg-surface overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(null)}
          >
            <div className="px-3.5 py-2.5 border-b border-border">
              <p className="text-sm font-semibold text-text-tertiary">Unassigned</p>
              <p className="text-xs text-text-tertiary">{unassigned.length} shots not assigned to a date</p>
            </div>
            <div className="p-2 space-y-1.5">
              {unassigned.sort((a, b) => a.sort_order - b.sort_order).map((shot) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  setupName={setupNameMap.get(shot.setup_id) || ""}
                  setupColor={setupColorMap.get(shot.setup_id) || ""}
                  onDragStart={() => setDragShotId(shot.id)}
                  isDragging={dragShotId === shot.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shot Card ───────────────────────────────────────────────────────────────
function ShotCard({
  shot,
  setupName,
  setupColor,
  onDragStart,
  isDragging,
}: {
  shot: { id: string; name: string; description: string; props: string; estimated_duration_minutes: number };
  setupName: string;
  setupColor: string;
  onDragStart: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`
        flex items-start gap-2 rounded-md border border-border bg-surface px-2.5 py-2
        cursor-grab active:cursor-grabbing hover:bg-surface-secondary/50 transition-colors
        ${isDragging ? "opacity-40" : ""}
      `}
    >
      <GripVertical className="h-3 w-3 mt-0.5 shrink-0 text-text-tertiary/40" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-text-primary truncate">{shot.description || shot.name}</p>
          <span className="text-[10px] text-text-tertiary shrink-0">{shot.estimated_duration_minutes || 15}m</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {setupName && (
            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${setupColor}`}>
              {setupName}
            </span>
          )}
          {shot.props && (
            <span className="text-[10px] text-text-tertiary truncate">{shot.props}</span>
          )}
        </div>
      </div>
    </div>
  );
}

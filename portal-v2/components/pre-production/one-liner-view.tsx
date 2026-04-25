"use client";

import { useState, useCallback, type DragEvent } from "react";
import { Download, AlignJustify, GripVertical, X, Plus, Truck, Utensils, Flag } from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { format, parseISO } from "date-fns";
import { generateOneLinerPdf } from "@/lib/utils/pdf-generator";
import type { Shoot } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  shoots: Shoot[];
}

interface ScheduleShot {
  id: string;
  setup_id: string;
  name: string;
  description: string;
  angle: string;
  location: string;
  notes: string;
  props: string;
  talent: string;
  sort_order: number;
  estimated_duration_minutes: number;
  shoot_date_id: string | null;
  sort_order_in_day: number;
  int_ext?: string;
  surface?: string;
  hero_sku?: string | null;
}

type DayEventType = "move" | "lunch" | "wrap" | "other";

interface DayEvent {
  id: string;
  shoot_date_id: string;
  type: DayEventType;
  label: string;
  time: string | null;
  sort_order_in_day: number;
}

interface ScheduleData {
  setups: Array<{
    id: string;
    name: string;
    location: string;
    sort_order: number;
  }>;
  shots: ScheduleShot[];
  links: Array<{ shot_id: string; deliverable_id: string }>;
  productLinks: Array<{ shot_id: string; campaign_product_id: string }>;
  deliverables: Array<{ id: string; channel: string; aspect_ratio: string }>;
  campaignProducts: Array<{
    id: string;
    product?: { name: string; item_code: string };
  }>;
  dayEvents?: DayEvent[];
}

type DateBucket = {
  id: string | null; // null = unassigned
  shootDate: string | null;
  dayNumber: number | null;
  totalDays: number;
  location: string;
  callTime: string | null;
  shootName: string;
  shots: ScheduleShot[];
};

function buildBuckets(data: ScheduleData, shoots: Shoot[]): DateBucket[] {
  const allDates = shoots
    .flatMap((s) =>
      s.dates.map((d) => ({
        ...d,
        shootName: s.name,
        shootId: s.id,
        shootLocation: s.location,
      }))
    )
    .sort((a, b) => a.shootDate.localeCompare(b.shootDate));

  const totalDays = allDates.length;

  const byDate = new Map<string, ScheduleShot[]>();
  const unassigned: ScheduleShot[] = [];
  for (const shot of data.shots) {
    if (shot.shoot_date_id) {
      if (!byDate.has(shot.shoot_date_id)) byDate.set(shot.shoot_date_id, []);
      byDate.get(shot.shoot_date_id)!.push(shot);
    } else {
      unassigned.push(shot);
    }
  }

  const buckets: DateBucket[] = allDates.map((d, i) => ({
    id: d.id,
    shootDate: d.shootDate,
    dayNumber: i + 1,
    totalDays,
    location: d.location || d.shootLocation || "",
    callTime: d.callTime || null,
    shootName: d.shootName,
    shots: (byDate.get(d.id) || []).sort(
      (a, b) => (a.sort_order_in_day ?? 0) - (b.sort_order_in_day ?? 0)
    ),
  }));

  if (unassigned.length > 0) {
    buckets.push({
      id: null,
      shootDate: null,
      dayNumber: null,
      totalDays,
      location: "",
      callTime: null,
      shootName: "Unassigned",
      shots: unassigned.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    });
  }

  return buckets;
}

export function OneLinerView({ campaignId, campaignName, wfNumber, shoots }: Props) {
  const swrKey = `/api/campaigns/${campaignId}/schedule`;
  const { data, isLoading } = useSWR<ScheduleData>(swrKey, fetcher);

  // Drag state — carries the shot id + its current bucket id
  const [drag, setDrag] = useState<{ shotId: string; bucketId: string | null } | null>(
    null
  );

  const handleDragStart = (
    e: DragEvent,
    shotId: string,
    bucketId: string | null
  ) => {
    setDrag({ shotId, bucketId });
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", shotId);
    }
  };
  const handleDragEnd = () => setDrag(null);

  const moveShot = useCallback(
    async (shotId: string, targetBucketId: string | null, targetIdx: number) => {
      if (!data) return;
      const buckets = buildBuckets(data, shoots);
      const targetBucket = buckets.find((b) => b.id === targetBucketId);
      const sourceBucket = buckets.find((b) => b.shots.some((s) => s.id === shotId));
      if (!targetBucket || !sourceBucket) return;

      const moved = sourceBucket.shots.find((s) => s.id === shotId);
      if (!moved) return;

      const targetList = targetBucket.shots.filter((s) => s.id !== shotId);
      targetList.splice(targetIdx, 0, moved);

      const reorderPayload = targetList.map((s, i) => ({
        shotId: s.id,
        sortOrderInDay: i,
        shootDateId: targetBucketId,
      }));

      const sourceRewrite =
        sourceBucket.id !== targetBucketId
          ? sourceBucket.shots
              .filter((s) => s.id !== shotId)
              .map((s, i) => ({
                shotId: s.id,
                sortOrderInDay: i,
                shootDateId: sourceBucket.id,
              }))
          : [];

      const allUpdates = [...reorderPayload, ...sourceRewrite];
      const updateMap = new Map(
        allUpdates.map((u) => [u.shotId, u] as const)
      );

      // Optimistic local update — render the new order immediately,
      // then revalidate from the server. No flash, no round-trip wait.
      const optimistic: ScheduleData = {
        ...data,
        shots: data.shots.map((s) => {
          const u = updateMap.get(s.id);
          if (!u) return s;
          return {
            ...s,
            shoot_date_id: u.shootDateId,
            sort_order_in_day: u.sortOrderInDay,
          };
        }),
      };

      globalMutate(
        swrKey,
        (async () => {
          await fetch(swrKey, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reorder: allUpdates }),
          });
          return optimistic;
        })(),
        { optimisticData: optimistic, rollbackOnError: true, revalidate: true }
      );
    },
    [data, shoots, swrKey]
  );

  const handleDurationChange = async (shotId: string, minutes: number) => {
    await fetch(swrKey, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shotId, estimatedDurationMinutes: minutes }),
    });
    globalMutate(swrKey);
  };

  const handleIntExtChange = async (shotId: string, intExt: string) => {
    await fetch(swrKey, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shotId, intExt }),
    });
    globalMutate(swrKey);
  };

  const addEvent = async (shootDateId: string, type: DayEventType) => {
    await fetch(swrKey, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: { action: "create", shootDateId, type, sortOrderInDay: 9999 },
      }),
    });
    globalMutate(swrKey);
  };

  const deleteEvent = async (id: string) => {
    await fetch(swrKey, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: { action: "delete", id } }),
    });
    globalMutate(swrKey);
  };

  const [addingDay, setAddingDay] = useState(false);
  const addShootDay = async () => {
    const primaryShoot = shoots[0];
    if (!primaryShoot) return;
    // Default: day after the last existing date, or tomorrow if none.
    const allDates = shoots.flatMap((s) => s.dates.map((d) => d.shootDate)).sort();
    const lastDate = allDates[allDates.length - 1];
    const base = lastDate ? new Date(lastDate) : new Date();
    base.setDate(base.getDate() + 1);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (base < todayStart) base.setTime(todayStart.getTime());
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const dd = String(base.getDate()).padStart(2, "0");
    setAddingDay(true);
    try {
      await fetch(`/api/shoots/${primaryShoot.id}/dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: [
            {
              shootDate: `${yyyy}-${mm}-${dd}`,
              callTime: null,
              location: primaryShoot.location || "",
              notes: "",
            },
          ],
        }),
      });
      // Re-fetch the campaign so `shoots` updates upstream
      globalMutate(`/api/campaigns/${campaignId}`);
      globalMutate(swrKey);
    } finally {
      setAddingDay(false);
    }
  };

  const handleDownload = () => {
    if (!data) return;

    // PDF: first real shoot day; multi-day PDF can be added later
    const buckets = buildBuckets(data, shoots);
    const firstReal = buckets.find((b) => b.id !== null);
    if (!firstReal) return;

    const setupNameMap = new Map(data.setups.map((s) => [s.id, s.name]));
    const rows = firstReal.shots.map((shot, i) => {
      const shotLinks = data.links.filter((l) => l.shot_id === shot.id);
      const channels = shotLinks
        .map((l) => data.deliverables.find((d) => d.id === l.deliverable_id)?.channel)
        .filter(Boolean)
        .join(", ");
      const shotProductLinks = (data.productLinks || []).filter(
        (l) => l.shot_id === shot.id
      );
      const productNames = shotProductLinks
        .map((l) => {
          const cp = (data.campaignProducts || []).find(
            (p) => p.id === l.campaign_product_id
          );
          if (!cp?.product) return null;
          const code = cp.product.item_code ? ` (${cp.product.item_code})` : "";
          return `${cp.product.name}${code}`;
        })
        .filter(Boolean)
        .join(", ");
      return {
        shotNumber: i + 1,
        description: shot.description,
        products: productNames || shot.props || "",
        environment:
          shot.surface ||
          shot.location ||
          data.setups.find((s) => s.id === shot.setup_id)?.location ||
          "",
        channels,
        timeEst: `${shot.estimated_duration_minutes || 15}m`,
        notes: shot.notes || "",
        setupName: setupNameMap.get(shot.setup_id) || "",
      };
    });

    const doc = generateOneLinerPdf({
      campaignName,
      wfNumber,
      shootDate: firstReal.shootDate || "",
      callTime: firstReal.callTime || undefined,
      location: firstReal.location || undefined,
      dayNumber: firstReal.dayNumber || 1,
      totalDays: firstReal.totalDays,
      rows,
    });

    const dateStr = firstReal.shootDate
      ? format(parseISO(firstReal.shootDate), "MMdd")
      : "schedule";
    doc.save(`${wfNumber}_OneLiner_${dateStr}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || data.setups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          <AlignJustify className="h-4 w-4 text-text-tertiary" />
        </div>
        <p className="text-sm text-text-tertiary">
          No shots yet. Add shots from the campaign detail page.
        </p>
      </div>
    );
  }

  const buckets = buildBuckets(data, shoots);
  const setupNameMap = new Map(data.setups.map((s) => [s.id, s.name]));
  const setupLocationMap = new Map(data.setups.map((s) => [s.id, s.location]));

  const productNamesByShot = new Map<string, string>();
  for (const shot of data.shots) {
    const links = (data.productLinks || []).filter((l) => l.shot_id === shot.id);
    const names = links
      .map((l) => {
        const cp = (data.campaignProducts || []).find(
          (p) => p.id === l.campaign_product_id
        );
        if (!cp?.product) return null;
        const code = cp.product.item_code ? ` (${cp.product.item_code})` : "";
        return `${cp.product.name}${code}`;
      })
      .filter(Boolean) as string[];
    productNamesByShot.set(shot.id, names.join(", "));
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-tertiary">
          {data.shots.length} shot{data.shots.length !== 1 ? "s" : ""} across{" "}
          {buckets.filter((b) => b.id !== null).length} shoot day
          {buckets.filter((b) => b.id !== null).length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </button>
      </div>

      {/* Multi-day one-liner */}
      <div className="border-2 border-black overflow-hidden bg-white">
        {/* Column headers */}
        <div className="grid grid-cols-[24px_36px_56px_minmax(200px,2fr)_110px_minmax(160px,1.2fr)_minmax(140px,1fr)_64px_minmax(140px,1fr)] border-b-2 border-black bg-white text-[10px] font-bold uppercase tracking-wider text-black">
          <div className="px-2 py-1.5" />
          <div className="px-2 py-1.5 border-l border-black/30">#</div>
          <div className="px-2 py-1.5 border-l border-black/30">I/E</div>
          <div className="px-2 py-1.5 border-l border-black/30">Description</div>
          <div className="px-2 py-1.5 border-l border-black/30">Talent</div>
          <div className="px-2 py-1.5 border-l border-black/30">Product</div>
          <div className="px-2 py-1.5 border-l border-black/30">Wardrobe / Props</div>
          <div className="px-2 py-1.5 border-l border-black/30">Time</div>
          <div className="px-2 py-1.5 border-l border-black/30">Notes</div>
        </div>
        {buckets.map((bucket) => {
          // Group shots by setup, preserving the bucket's order
          const setupGroups: { setupId: string; shots: ScheduleShot[] }[] = [];
          for (const shot of bucket.shots) {
            const last = setupGroups[setupGroups.length - 1];
            if (last && last.setupId === shot.setup_id) {
              last.shots.push(shot);
            } else {
              setupGroups.push({ setupId: shot.setup_id, shots: [shot] });
            }
          }

          let runningIdx = 0;
          const isDropTarget = drag !== null;
          return (
            <div
              key={bucket.id ?? "unassigned"}
              onDragOver={(e) => {
                if (drag) e.preventDefault();
              }}
              onDrop={() => {
                if (drag) moveShot(drag.shotId, bucket.id, bucket.shots.length);
              }}
              className={isDropTarget ? "ring-1 ring-inset ring-black/30" : ""}
            >
              <DayBar bucket={bucket} />
              {bucket.shots.length === 0 ? (
                <div
                  className="border-t border-black/30 px-4 py-6 text-center text-[11px] font-medium text-text-tertiary bg-surface-secondary/40"
                >
                  Drag a shot here to assign to{" "}
                  {bucket.id === null
                    ? "unassigned"
                    : `Day ${bucket.dayNumber}`}
                  .
                </div>
              ) : (
                setupGroups.map((group, gi) => {
                  const setupName = setupNameMap.get(group.setupId) || "Setup";
                  const setupLoc = setupLocationMap.get(group.setupId) || "";
                  return (
                    <div key={`${group.setupId}-${gi}`}>
                      <div className="border-t border-black/30 bg-surface-secondary/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-black">
                        {setupName}
                        {setupLoc && (
                          <span className="ml-2 font-normal normal-case tracking-normal text-text-tertiary">
                            · {setupLoc}
                          </span>
                        )}
                      </div>
                      {group.shots.map((shot) => {
                        const idx = runningIdx++;
                        const products =
                          productNamesByShot.get(shot.id) || shot.hero_sku || "—";
                        return (
                          <div
                            key={shot.id}
                            onDragOver={(e) => {
                              if (drag) e.preventDefault();
                            }}
                            onDrop={() => {
                              if (drag) moveShot(drag.shotId, bucket.id, idx);
                            }}
                            className={`grid grid-cols-[24px_36px_56px_minmax(200px,2fr)_110px_minmax(160px,1.2fr)_minmax(140px,1fr)_64px_minmax(140px,1fr)] items-start border-t border-border ${
                              idx % 2 === 1 ? "bg-surface-secondary/25" : ""
                            } ${
                              drag?.shotId === shot.id ? "opacity-40" : ""
                            } hover:bg-surface-secondary/30 transition-colors`}
                          >
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, shot.id, bucket.id)}
                              onDragEnd={handleDragEnd}
                              className="flex items-center justify-center pt-1.5 cursor-grab active:cursor-grabbing"
                              title="Drag to reorder or move"
                            >
                              <GripVertical className="h-3.5 w-3.5 text-text-tertiary" />
                            </div>
                            <div className="border-l border-black/20 px-2 py-1.5 text-xs font-bold text-text-primary tabular-nums">
                              {shot.sort_order}
                            </div>
                            <div className="border-l border-black/20 py-1 px-1">
                              <select
                                value={shot.int_ext || ""}
                                onChange={(e) => handleIntExtChange(shot.id, e.target.value)}
                                className="w-full bg-transparent px-0.5 py-0 text-[11px] font-bold tabular-nums text-text-primary focus:outline-none uppercase"
                              >
                                <option value="">—</option>
                                <option value="INT">INT</option>
                                <option value="EXT">EXT</option>
                                <option value="INT/EXT">I/E</option>
                              </select>
                            </div>
                            <div className="border-l border-black/20 px-2 py-1.5 text-xs leading-snug text-text-primary">
                              {shot.description || shot.name || "—"}
                            </div>
                            <div className="border-l border-black/20 px-2 py-1.5 text-xs text-text-secondary">
                              {shot.talent || "—"}
                            </div>
                            <div className="border-l border-black/20 px-2 py-1.5 text-xs text-text-secondary">
                              {products}
                            </div>
                            <div className="border-l border-black/20 px-2 py-1.5 text-xs text-text-secondary">
                              {shot.props || "—"}
                            </div>
                            <div className="border-l border-border px-1.5 py-1.5">
                              <select
                                value={shot.estimated_duration_minutes || 15}
                                onChange={(e) =>
                                  handleDurationChange(shot.id, Number(e.target.value))
                                }
                                className="w-full bg-transparent px-0.5 py-0 text-[11px] font-medium tabular-nums text-text-primary focus:outline-none"
                              >
                                {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                                  <option key={m} value={m}>
                                    {m}m
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="border-l border-black/20 px-2 py-1.5 text-xs text-text-tertiary">
                              {shot.notes || ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
              {bucket.id !== null && (
                <>
                  {(data.dayEvents || [])
                    .filter((ev) => ev.shoot_date_id === bucket.id)
                    .map((ev) => (
                      <EventBanner
                        key={ev.id}
                        event={ev}
                        onDelete={() => deleteEvent(ev.id)}
                      />
                    ))}
                  <div className="flex items-center gap-2 border-t border-black/20 bg-white px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                    <span>Add break:</span>
                    <button
                      type="button"
                      onClick={() => addEvent(bucket.id!, "move")}
                      className="inline-flex items-center gap-1 border border-black/30 px-2 py-0.5 hover:bg-black hover:text-white transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Company Move
                    </button>
                    <button
                      type="button"
                      onClick={() => addEvent(bucket.id!, "lunch")}
                      className="inline-flex items-center gap-1 border border-black/30 px-2 py-0.5 hover:bg-black hover:text-white transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Lunch
                    </button>
                    <button
                      type="button"
                      onClick={() => addEvent(bucket.id!, "wrap")}
                      className="inline-flex items-center gap-1 border border-black/30 px-2 py-0.5 hover:bg-black hover:text-white transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Wrap
                    </button>
                  </div>
                </>
              )}
              {bucket.id !== null && bucket.shots.length > 0 && (
                <div className="border-t-2 border-black bg-black px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                  End of Day {bucket.dayNumber} — {bucket.shots.length} shot
                  {bucket.shots.length === 1 ? "" : "s"} —{" "}
                  {formatDayTotal(
                    bucket.shots.reduce(
                      (acc, s) => acc + (s.estimated_duration_minutes || 15),
                      0
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
        {/* Add a new shoot day */}
        {shoots.length > 0 && (
          <button
            type="button"
            onClick={addShootDay}
            disabled={addingDay}
            className="flex w-full items-center justify-center gap-2 border-t-2 border-black bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-black hover:bg-neutral-100 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {addingDay ? "Adding…" : "Add Shoot Day"}
          </button>
        )}
      </div>
    </div>
  );
}

function formatDayTotal(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Day-bar (Wave 3) ────────────────────────────────────────────────────────
// Net-new pattern documented in PRODUCER_DOCS_IMPLEMENTATION_PLAN.md.
// 2px top rule + uppercase tracking-wider header, content like:
//   DAY 3 / 8 — THU 5/12 — STUDIO A — EST WRAP 6:30P
// Postgres time values arrive as "HH:mm:ss"; render as "H:mm AM/PM".
// Anything else (already formatted, or empty) passes through.
function formatTimeLabel(raw: string): string {
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

const EVENT_LABELS: Record<DayEventType, string> = {
  move: "Company Move",
  lunch: "Lunch",
  wrap: "Wrap",
  other: "Break",
};

function EventBanner({
  event,
  onDelete,
}: {
  event: DayEvent;
  onDelete: () => void;
}) {
  const Icon =
    event.type === "move" ? Truck : event.type === "lunch" ? Utensils : Flag;
  const label = event.label || EVENT_LABELS[event.type];
  return (
    <div className="group flex items-center justify-between gap-3 border-t border-black/40 bg-surface-secondary/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-black">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
        {event.time && (
          <span className="font-normal normal-case tracking-normal text-text-secondary">
            · {formatTimeLabel(event.time)}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error transition-opacity"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DayBar({ bucket }: { bucket: DateBucket }) {
  if (bucket.id === null) {
    return (
      <div className="border-t-2 border-black bg-neutral-300 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-black">
        Unassigned
      </div>
    );
  }
  const parts: string[] = [];
  if (bucket.dayNumber && bucket.totalDays) {
    parts.push(`Day ${bucket.dayNumber} / ${bucket.totalDays}`);
  }
  if (bucket.shootDate) {
    parts.push(format(parseISO(bucket.shootDate), "EEE M/d"));
  }
  if (bucket.location) parts.push(bucket.location);
  if (bucket.callTime) parts.push(`Call ${formatTimeLabel(bucket.callTime)}`);

  return (
    <div className="border-t-2 border-black bg-neutral-300 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-black">
      {parts.join(" — ")}
    </div>
  );
}

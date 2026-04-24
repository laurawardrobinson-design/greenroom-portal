"use client";

import { useState, useCallback } from "react";
import { Download, AlignJustify, GripVertical } from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { format, parseISO } from "date-fns";
import { generateOneLinerPdf } from "@/lib/utils/pdf-generator";
import type { Shoot } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SETUP_COLORS = [
  "border-l-amber-400 bg-amber-50/40",
  "border-l-blue-400 bg-blue-50/40",
  "border-l-rose-400 bg-rose-50/40",
  "border-l-emerald-400 bg-emerald-50/40",
  "border-l-violet-400 bg-violet-50/40",
  "border-l-yellow-400 bg-yellow-50/40",
  "border-l-orange-400 bg-orange-50/40",
  "border-l-sky-400 bg-sky-50/40",
];

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
  surface?: string;
  hero_sku?: string | null;
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

  const handleDragStart = (shotId: string, bucketId: string | null) =>
    setDrag({ shotId, bucketId });
  const handleDragEnd = () => setDrag(null);

  const moveShot = useCallback(
    async (shotId: string, targetBucketId: string | null, targetIdx: number) => {
      if (!data) return;
      // Rebuild the target bucket's new order
      const buckets = buildBuckets(data, shoots);
      const targetBucket = buckets.find((b) => b.id === targetBucketId);
      const sourceBucket = buckets.find((b) => b.shots.some((s) => s.id === shotId));
      if (!targetBucket || !sourceBucket) return;

      const moved = sourceBucket.shots.find((s) => s.id === shotId);
      if (!moved) return;

      // Remove from source order; add at target position
      const targetList = targetBucket.shots.filter((s) => s.id !== shotId);
      targetList.splice(targetIdx, 0, moved);

      const reorderPayload = targetList.map((s, i) => ({
        shotId: s.id,
        sortOrderInDay: i,
        shootDateId: targetBucketId,
      }));

      // Also rewrite source bucket's sortOrderInDay if we moved cross-bucket
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

      await fetch(swrKey, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: [...reorderPayload, ...sourceRewrite] }),
      });
      globalMutate(swrKey);
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
  const uniqueSetups = [...new Set(data.shots.map((s) => s.setup_id))];
  const setupColorMap = new Map<string, string>();
  uniqueSetups.forEach((id, i) =>
    setupColorMap.set(id, SETUP_COLORS[i % SETUP_COLORS.length])
  );

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
      <div className="rounded-lg border border-border overflow-hidden">
        {buckets.map((bucket) => (
          <div key={bucket.id ?? "unassigned"}>
            <DayBar bucket={bucket} />
            {bucket.shots.length === 0 ? (
              <div
                className="border-t border-border px-4 py-4 text-center text-[11px] text-text-tertiary"
                onDragOver={(e) => {
                  if (drag) e.preventDefault();
                }}
                onDrop={() => {
                  if (drag) moveShot(drag.shotId, bucket.id, 0);
                }}
              >
                Drop a shot here to assign to{" "}
                {bucket.id === null
                  ? "unassigned"
                  : `Day ${bucket.dayNumber}`}
                .
              </div>
            ) : (
              bucket.shots.map((shot, idx) => {
                const colorClass = setupColorMap.get(shot.setup_id) || "";
                const setupName = setupNameMap.get(shot.setup_id) || "";
                const shotLinks = data.links.filter((l) => l.shot_id === shot.id);
                const channels = shotLinks
                  .map(
                    (l) =>
                      data.deliverables.find((d) => d.id === l.deliverable_id)
                        ?.channel
                  )
                  .filter(Boolean)
                  .join(", ");

                return (
                  <div
                    key={shot.id}
                    draggable
                    onDragStart={() => handleDragStart(shot.id, bucket.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (drag) e.preventDefault();
                    }}
                    onDrop={() => {
                      if (drag) moveShot(drag.shotId, bucket.id, idx);
                    }}
                    className={`grid grid-cols-[32px_36px_1fr_120px_90px_90px_52px_1fr] border-t border-border border-l-[3px] ${colorClass} ${
                      drag?.shotId === shot.id ? "opacity-40" : ""
                    } hover:bg-surface-secondary/30 transition-colors cursor-grab active:cursor-grabbing`}
                  >
                    <div className="flex items-center justify-center px-1">
                      <GripVertical className="h-3 w-3 text-text-tertiary/40" />
                    </div>
                    <div className="px-2 py-2 text-xs font-medium text-text-primary">
                      {idx + 1}
                    </div>
                    <div className="px-2 py-2">
                      <p className="text-xs text-text-primary leading-relaxed">
                        {shot.description || shot.name}
                      </p>
                      {setupName && (
                        <p className="text-[10px] text-text-tertiary mt-0.5">
                          Setup: {setupName}
                        </p>
                      )}
                    </div>
                    <div className="px-2 py-2 text-xs text-text-secondary">
                      {shot.props}
                    </div>
                    <div className="px-2 py-2">
                      <span className="inline-block rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] text-text-secondary">
                        {shot.location ||
                          data.setups.find((s) => s.id === shot.setup_id)
                            ?.location ||
                          "—"}
                      </span>
                    </div>
                    <div className="px-2 py-2 text-[10px] text-text-tertiary">
                      {channels}
                    </div>
                    <div className="px-2 py-2">
                      <select
                        value={shot.estimated_duration_minutes || 15}
                        onChange={(e) =>
                          handleDurationChange(shot.id, Number(e.target.value))
                        }
                        className="w-full rounded border border-border bg-surface px-1 py-0.5 text-[10px] focus:outline-none"
                      >
                        {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                          <option key={m} value={m}>
                            {m}m
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="px-2 py-2 text-[10px] text-text-tertiary">
                      {shot.notes}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>

      {/* Setup legend */}
      {uniqueSetups.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-text-tertiary">
          <span className="font-medium">Setups:</span>
          {uniqueSetups.map((id, i) => (
            <span key={id} className="flex items-center gap-1">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-sm border-l-[3px] ${
                  SETUP_COLORS[i % SETUP_COLORS.length].split(" ")[0]
                }`}
              />
              {setupNameMap.get(id) || `Setup ${i + 1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
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

function DayBar({ bucket }: { bucket: DateBucket }) {
  if (bucket.id === null) {
    return (
      <div className="border-t-2 border-black bg-surface-secondary/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
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
    <div className="border-t-2 border-black bg-surface-secondary/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
      {parts.join(" — ")}
    </div>
  );
}

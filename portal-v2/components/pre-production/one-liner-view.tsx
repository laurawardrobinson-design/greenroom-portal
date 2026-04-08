"use client";

import { useState, useCallback } from "react";
import { Download, AlignJustify, GripVertical, Clock } from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { format, parseISO } from "date-fns";
import { generateOneLinerPdf } from "@/lib/utils/pdf-generator";
import type { Shoot } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Setup color palette (pastel left-border accents) ────────────────────────
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

interface ScheduleData {
  setups: Array<{
    id: string;
    name: string;
    location: string;
    sort_order: number;
  }>;
  shots: Array<{
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
  }>;
  links: Array<{ shot_id: string; deliverable_id: string }>;
  productLinks: Array<{ shot_id: string; campaign_product_id: string }>;
  deliverables: Array<{ id: string; channel: string; aspect_ratio: string }>;
  campaignProducts: Array<{ id: string; product?: { name: string; item_code: string } }>;
}

export function OneLinerView({ campaignId, campaignName, wfNumber, shoots }: Props) {
  // Flatten all shoot dates for the date selector
  const allDates = shoots.flatMap((s) =>
    s.dates.map((d) => ({ ...d, shootName: s.name, shootId: s.id }))
  ).sort((a, b) => a.shootDate.localeCompare(b.shootDate));

  const [selectedDateId, setSelectedDateId] = useState(allDates[0]?.id || "");
  const selectedDate = allDates.find((d) => d.id === selectedDateId);

  const { data, isLoading } = useSWR<ScheduleData>(
    `/api/campaigns/${campaignId}/schedule`,
    fetcher
  );

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDragStart = (shotId: string) => setDragId(shotId);
  const handleDragEnd = () => setDragId(null);

  const handleDrop = useCallback(
    async (targetIdx: number) => {
      if (!dragId || !data) return;

      // Get shots for current date
      const dateShots = getDateShots(data, selectedDateId);
      const dragIdx = dateShots.findIndex((s) => s.id === dragId);
      if (dragIdx === -1 || dragIdx === targetIdx) return;

      // Reorder
      const reordered = [...dateShots];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(targetIdx, 0, moved);

      // Update sort orders
      const reorderPayload = reordered.map((s, i) => ({
        shotId: s.id,
        sortOrderInDay: i,
        shootDateId: selectedDateId || null,
      }));

      await fetch(`/api/campaigns/${campaignId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: reorderPayload }),
      });

      globalMutate(`/api/campaigns/${campaignId}/schedule`);
      setDragId(null);
    },
    [dragId, data, selectedDateId, campaignId]
  );

  const handleDurationChange = async (shotId: string, minutes: number) => {
    await fetch(`/api/campaigns/${campaignId}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shotId, estimatedDurationMinutes: minutes }),
    });
    globalMutate(`/api/campaigns/${campaignId}/schedule`);
  };

  const handleDownload = () => {
    if (!data) return;

    const dateShots = getDateShots(data, selectedDateId);
    const setupNameMap2 = new Map(data.setups.map((s) => [s.id, s.name]));

    const rows = dateShots.map((shot: ScheduleShot, i: number) => {
      const shotLinks = data.links.filter((l) => l.shot_id === shot.id);
      const channels = shotLinks
        .map((l) => data.deliverables.find((d) => d.id === l.deliverable_id)?.channel)
        .filter(Boolean)
        .join(", ");

      // Resolve real product names
      const shotProductLinks = (data.productLinks || []).filter((l: { shot_id: string }) => l.shot_id === shot.id);
      const productNames = shotProductLinks
        .map((l: { campaign_product_id: string }) => {
          const cp = (data.campaignProducts || []).find((p: { id: string }) => p.id === l.campaign_product_id);
          if (!cp?.product) return null;
          const code = cp.product.item_code ? ` (${cp.product.item_code})` : "";
          return `${cp.product.name}${code}`;
        })
        .filter(Boolean)
        .join(", ");

      return {
        shotNumber: i + 1,
        description: shot.description as string,
        products: productNames || (shot.props || "") as string,
        environment: ((shot as Record<string, unknown>).surface as string) || (shot.location || data.setups.find((s) => s.id === shot.setup_id)?.location || "") as string,
        channels,
        timeEst: `${shot.estimated_duration_minutes || 15}m`,
        notes: (shot.notes || "") as string,
        setupName: (setupNameMap2.get(shot.setup_id) || "") as string,
      };
    });

    const doc = generateOneLinerPdf({
      campaignName,
      wfNumber,
      shootDate: selectedDate?.shootDate || "",
      callTime: selectedDate?.callTime || undefined,
      location: selectedDate?.location || undefined,
      dayNumber: allDates.indexOf(allDates.find((d) => d.id === selectedDateId)!) + 1,
      totalDays: allDates.length,
      rows,
    });

    const dateStr = selectedDate?.shootDate
      ? format(parseISO(selectedDate.shootDate), "MMdd")
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
        <p className="text-sm text-text-tertiary">No shots yet. Add shots from the campaign detail page.</p>
      </div>
    );
  }

  const dateShots = getDateShots(data, selectedDateId);
  const setupNameMap = new Map<string, string>(data.setups.map((s) => [s.id, s.name]));
  const setupColorMap = new Map<string, string>();
  const uniqueSetups = [...new Set(dateShots.map((s: ScheduleShot) => s.setup_id))] as string[];
  uniqueSetups.forEach((id: string, i: number) => setupColorMap.set(id, SETUP_COLORS[i % SETUP_COLORS.length]));

  const totalMinutes = dateShots.reduce((sum: number, s: ScheduleShot) => sum + (s.estimated_duration_minutes || 15), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainMin = totalMinutes % 60;

  return (
    <div className="space-y-3">
      {/* Header row: date picker + download */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {allDates.length > 1 ? (
            <select
              value={selectedDateId}
              onChange={(e) => setSelectedDateId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {allDates.map((d, i) => (
                <option key={d.id} value={d.id}>
                  Day {i + 1} — {format(parseISO(d.shootDate), "EEE, MMM d")}
                  {d.shootName ? ` (${d.shootName})` : ""}
                </option>
              ))}
            </select>
          ) : allDates.length === 1 ? (
            <p className="text-sm font-medium text-text-primary">
              {format(parseISO(allDates[0].shootDate), "EEEE, MMMM d, yyyy")}
            </p>
          ) : (
            <p className="text-sm text-text-tertiary">No shoot dates scheduled</p>
          )}

          <div className="flex items-center gap-1 text-xs text-text-tertiary">
            <Clock className="h-3 w-3" />
            {dateShots.length} shots &middot; {totalHours > 0 ? `${totalHours}h ` : ""}{remainMin}m est.
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </button>
      </div>

      {/* Strip board */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[32px_36px_1fr_120px_90px_90px_52px_1fr] bg-surface-secondary">
          <div className="px-1.5 py-2" />
          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Shot</div>
          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Description</div>
          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Products</div>
          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Env</div>
          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Channels</div>
          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Est.</div>
          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Notes</div>
        </div>

        {/* Rows */}
        {dateShots.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-text-tertiary">
            {allDates.length > 0
              ? "No shots assigned to this date yet. Assign shots from the Day-by-Day view."
              : "No shoot dates scheduled. Add dates from the campaign detail page."}
          </div>
        ) : (
          dateShots.map((shot, idx) => {
            const colorClass = setupColorMap.get(shot.setup_id) || "";
            const setupName = setupNameMap.get(shot.setup_id) || "";
            const shotLinks = data.links.filter((l) => l.shot_id === shot.id);
            const channels = shotLinks
              .map((l) => data.deliverables.find((d) => d.id === l.deliverable_id)?.channel)
              .filter(Boolean)
              .join(", ");

            return (
              <div
                key={shot.id}
                draggable
                onDragStart={() => handleDragStart(shot.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                className={`
                  grid grid-cols-[32px_36px_1fr_120px_90px_90px_52px_1fr] border-t border-border
                  border-l-[3px] ${colorClass}
                  ${dragId === shot.id ? "opacity-40" : ""}
                  hover:bg-surface-secondary/30 transition-colors cursor-grab active:cursor-grabbing
                `}
              >
                <div className="flex items-center justify-center px-1">
                  <GripVertical className="h-3 w-3 text-text-tertiary/40" />
                </div>
                <div className="px-2 py-2 text-xs font-medium text-text-primary">{idx + 1}</div>
                <div className="px-2 py-2">
                  <p className="text-xs text-text-primary leading-relaxed">{shot.description || shot.name}</p>
                  {setupName && (
                    <p className="text-[10px] text-text-tertiary mt-0.5">Setup: {setupName}</p>
                  )}
                </div>
                <div className="px-2 py-2 text-xs text-text-secondary">{shot.props}</div>
                <div className="px-2 py-2">
                  <span className="inline-block rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] text-text-secondary">
                    {shot.location || data.setups.find((s) => s.id === shot.setup_id)?.location || "—"}
                  </span>
                </div>
                <div className="px-2 py-2 text-[10px] text-text-tertiary">{channels}</div>
                <div className="px-2 py-2">
                  <select
                    value={shot.estimated_duration_minutes || 15}
                    onChange={(e) => handleDurationChange(shot.id, Number(e.target.value))}
                    className="w-full rounded border border-border bg-surface px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>{m}m</option>
                    ))}
                  </select>
                </div>
                <div className="px-2 py-2 text-[10px] text-text-tertiary">{shot.notes}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Setup legend */}
      {uniqueSetups.length > 1 && (
        <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
          <span className="font-medium">Setups:</span>
          {uniqueSetups.map((id, i) => (
            <span key={id} className="flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm border-l-[3px] ${SETUP_COLORS[i % SETUP_COLORS.length].split(" ")[0]}`} />
              {setupNameMap.get(id) || `Setup ${i + 1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper: get shots for a specific date ───────────────────────────────────
type ScheduleShot = ScheduleData["shots"][number];

function getDateShots(
  data: ScheduleData,
  dateId: string
): ScheduleShot[] {
  // If no date selected or no dates exist, show all shots in setup order
  if (!dateId) {
    return [...data.shots].sort((a, b) => a.sort_order - b.sort_order);
  }

  // Show shots assigned to this date, plus unassigned shots
  const dateShots = data.shots.filter(
    (s: ScheduleShot) => s.shoot_date_id === dateId || !s.shoot_date_id
  );

  return dateShots.sort((a: ScheduleShot, b: ScheduleShot) => {
    // Assigned shots first, ordered by sort_order_in_day
    if (a.shoot_date_id && !b.shoot_date_id) return -1;
    if (!a.shoot_date_id && b.shoot_date_id) return 1;
    if (a.shoot_date_id && b.shoot_date_id) return a.sort_order_in_day - b.sort_order_in_day;
    return a.sort_order - b.sort_order;
  });
}

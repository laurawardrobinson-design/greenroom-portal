"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { TodayView } from "@/components/studio/today-view";
import { FoodView } from "@/components/studio/food-view";
import { FloorPlan } from "@/components/studio/floor-plan";
import { SPACE_TYPE_ICON, SPACE_TYPE_COLOR, SPACE_TYPE_LABELS, getSpaceIcon } from "@/lib/constants/studio";
import type { StudioSpace, SpaceReservation } from "@/types/domain";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ClipboardList,
  Coffee,
  Sun,
  QrCode,
  LayoutGrid,
  Map as MapIcon,
} from "lucide-react";
import { format, addDays, startOfWeek, parseISO, isToday } from "date-fns";
import Link from "next/link";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

// ─── Week navigation ─────────────────────────────────────────────────────────

function getWeekDays(anchor: Date): Date[] {
  const mon = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

// ─── Reserve modal ────────────────────────────────────────────────────────────

interface ReserveModalProps {
  space: StudioSpace;
  date: Date;
  existingReservation: SpaceReservation | null;
  userRole: string;
  userId: string;
  onClose: () => void;
  onReserved: () => void;
}

function ReserveModal({ space, date, existingReservation, userRole, userId, onClose, onReserved }: ReserveModalProps) {
  const { data: campaigns } = useSWR<Array<{ id: string; wfNumber: string; name: string; producerId?: string }>>(
    "/api/campaigns",
    fetcher
  );
  const { toast } = useToast();
  const [campaignId, setCampaignId] = useState(existingReservation?.campaignId ?? "");
  const [startTime, setStartTime] = useState(existingReservation?.startTime ?? "");
  const [endTime, setEndTime] = useState(existingReservation?.endTime ?? "");
  const [notes, setNotes] = useState(existingReservation?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);

  // Producers: show their campaigns first, then others. Studio/Admin: show all together.
  const activeCampaigns = useMemo(() => {
    const all = campaigns ?? [];
    if (userRole === "Producer") {
      const mine = all.filter((c) => (c as any).producerId === userId);
      const others = all.filter((c) => (c as any).producerId !== userId);
      return { mine, others };
    }
    return { mine: all, others: [] }; // Studio + Admin see all campaigns in one list
  }, [campaigns, userRole, userId]);

  async function handleReserve() {
    if (!campaignId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/studio/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          spaceId: space.id,
          reservedDate: format(date, "yyyy-MM-dd"),
          startTime: startTime || null,
          endTime: endTime || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to reserve");
      }
      toast("success", "Space reserved");
      onReserved();
      onClose();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to reserve");
    } finally {
      setSaving(false);
    }
  }

  async function handleRelease() {
    if (!existingReservation) return;
    setReleasing(true);
    try {
      const res = await fetch(`/api/studio/reservations?id=${existingReservation.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to release");
      toast("success", "Reservation released");
      onReserved();
      onClose();
    } catch {
      toast("error", "Failed to release reservation");
    } finally {
      setReleasing(false);
    }
  }

  const SpaceIcon = SPACE_TYPE_ICON[space.type] ?? Building2;

  return (
    <Modal
      open
      onClose={onClose}
      title={
        existingReservation
          ? `${space.name} — ${format(date, "EEE, MMM d")}`
          : `Reserve ${space.name}`
      }
    >
      <div className="space-y-4">
        {/* Space info */}
        <div className={`flex items-center gap-3 rounded-lg border p-3 ${SPACE_TYPE_COLOR[space.type] ?? "bg-surface-secondary border-border"}`}>
          <SpaceIcon className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{space.name}</p>
            <p className="text-xs capitalize opacity-70">
              {space.type.replace(/_/g, " ")}
              {space.capacity ? ` · Seats ${space.capacity}` : ""}
            </p>
          </div>
          <Badge variant="custom" className="ml-auto shrink-0 text-xs border border-border bg-surface text-text-secondary">
            {format(date, "EEE, MMM d")}
          </Badge>
        </div>

        {existingReservation ? (
          /* View existing */
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-secondary p-3 space-y-1.5">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Reserved for</p>
              <p className="text-sm font-semibold text-text-primary">
                {existingReservation.campaign?.wfNumber} — {existingReservation.campaign?.name}
              </p>
              {(existingReservation.startTime || existingReservation.endTime) && (
                <p className="text-xs text-text-secondary">
                  {existingReservation.startTime ?? "—"} → {existingReservation.endTime ?? "—"}
                </p>
              )}
              {existingReservation.notes && (
                <p className="text-xs text-text-secondary">{existingReservation.notes}</p>
              )}
              <p className="text-xs text-text-tertiary">
                Reserved by {existingReservation.reservedByUser?.name ?? "unknown"}
              </p>
            </div>
          </div>
        ) : (
          /* Create new */
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Campaign</label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select a campaign...</option>
                {activeCampaigns.mine.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.wfNumber} — {c.name}
                  </option>
                ))}
                {activeCampaigns.others.length > 0 && (
                  <optgroup label="Other campaigns">
                    {activeCampaigns.others.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.wfNumber} — {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Start time (optional)</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">End time (optional)</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Setup requirements, special notes..."
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        {existingReservation ? (
          <>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="danger" onClick={handleRelease} disabled={releasing}>
              {releasing ? "Releasing..." : "Release Reservation"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleReserve} disabled={!campaignId || saving}>
              {saving ? "Reserving..." : "Reserve Space"}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}

// ─── Spaces view (grid + map) ─────────────────────────────────────────────────

interface SpacesViewProps {
  userRole: string;
  userId: string;
}

function SpacesView({ userRole, userId }: SpacesViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  // ── Grid state ──────────────────────────────────────────────────────────────
  const [anchor, setAnchor] = useState(() => new Date());
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const dateFrom = format(weekDays[0], "yyyy-MM-dd");
  const dateTo   = format(weekDays[6], "yyyy-MM-dd");

  // ── Map state ───────────────────────────────────────────────────────────────
  const [mapDate, setMapDate] = useState(() => new Date());
  const mapDateStr = format(mapDate, "yyyy-MM-dd");

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: spaces, isLoading: loadingSpaces } =
    useSWR<StudioSpace[]>("/api/studio/spaces", fetcher);

  // Grid reservations (full week)
  const { data: gridRes, isLoading: loadingGridRes, mutate: refreshGrid } =
    useSWR<SpaceReservation[]>(
      viewMode === "grid"
        ? `/api/studio/reservations?dateFrom=${dateFrom}&dateTo=${dateTo}`
        : null,
      fetcher
    );

  // Map reservations (single day, only when map is shown)
  const { data: mapRes, mutate: refreshMap } =
    useSWR<SpaceReservation[]>(
      viewMode === "map"
        ? `/api/studio/reservations?dateFrom=${mapDateStr}&dateTo=${mapDateStr}`
        : null,
      fetcher
    );

  // ── Modal (shared between grid + map) ────────────────────────────────────────
  const [modal, setModal] = useState<{ space: StudioSpace; date: Date } | null>(null);

  // Grid reservation lookup
  const gridResMap = useMemo(() => {
    const m = new Map<string, SpaceReservation>();
    (gridRes ?? []).forEach((r) => m.set(`${r.spaceId}::${r.reservedDate}`, r));
    return m;
  }, [gridRes]);

  // Map reservation lookup
  const mapResMap = useMemo(() => {
    const m = new Map<string, SpaceReservation>();
    (mapRes ?? []).forEach((r) => m.set(r.spaceId, r));
    return m;
  }, [mapRes]);

  const modalReservation = useMemo(() => {
    if (!modal) return null;
    if (viewMode === "map") return mapResMap.get(modal.space.id) ?? null;
    return gridResMap.get(`${modal.space.id}::${format(modal.date, "yyyy-MM-dd")}`) ?? null;
  }, [modal, viewMode, mapResMap, gridResMap]);

  function handleReserved() {
    refreshGrid();
    refreshMap();
  }

  // Grid helpers
  const currentWeekDays = useMemo(() => getWeekDays(new Date()), []);
  const isCurrentWeek = weekDays[0].toDateString() === currentWeekDays[0].toDateString();

  const isLoading = loadingSpaces || loadingGridRes;

  if (viewMode === "grid" && isLoading) return (
    <div className="space-y-2">
      {[1,2,3,4].map(i => (
        <div key={i} className="h-10 rounded-lg bg-surface-secondary animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── View toggle ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === "grid"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              viewMode === "map"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            Map
          </button>
        </div>

        {/* Date navigator — changes label based on mode */}
        {viewMode === "grid" ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnchor((d) => addDays(d, -7))}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => setAnchor(new Date())}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              >
                Today
              </button>
            )}
            <span className="text-sm font-semibold text-text-primary min-w-[160px] text-center">
              {format(weekDays[0], "MMM d")} – {format(weekDays[6], "MMM d, yyyy")}
            </span>
            <button
              onClick={() => setAnchor((d) => addDays(d, 7))}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMapDate((d) => addDays(d, -1))}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {!isToday(mapDate) && (
              <button
                onClick={() => setMapDate(new Date())}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              >
                Today
              </button>
            )}
            <span className={`text-sm font-semibold min-w-[180px] text-center ${isToday(mapDate) ? "text-primary" : "text-text-primary"}`}>
              {isToday(mapDate) ? "Today — " : ""}{format(mapDate, "EEE, MMM d, yyyy")}
            </span>
            <button
              onClick={() => setMapDate((d) => addDays(d, 1))}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Grid view ────────────────────────────────────────────────────────── */}
      {viewMode === "grid" && (
        <>
          <div className="rounded-xl border border-border bg-surface overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-44 px-3.5 py-2.5 text-left">
                    <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Space</span>
                  </th>
                  {weekDays.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={`px-2 py-2.5 text-center ${isToday(day) ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                          {format(day, "EEE")}
                        </span>
                        <span className={`text-sm font-bold leading-none ${isToday(day) ? "text-primary" : "text-text-primary"}`}>
                          {format(day, "d")}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(spaces ?? []).map((space, idx) => {
                  const SpaceIcon = SPACE_TYPE_ICON[space.type] ?? Building2;
                  const typeColor = SPACE_TYPE_COLOR[space.type] ?? "bg-surface-secondary text-text-secondary border-transparent";
                  return (
                    <tr
                      key={space.id}
                      className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "" : "bg-surface-secondary/30"}`}
                    >
                      <td className="px-3.5 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${typeColor}`}>
                            <SpaceIcon className="h-3 w-3" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-text-primary truncate">{space.name}</p>
                            {space.capacity && (
                              <p className="text-[10px] text-text-tertiary">Seats {space.capacity}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const key = `${space.id}::${format(day, "yyyy-MM-dd")}`;
                        const res = gridResMap.get(key);
                        return (
                          <td
                            key={day.toISOString()}
                            className={`px-1.5 py-1.5 text-center ${isToday(day) ? "bg-primary/5" : ""}`}
                          >
                            <button
                              onClick={() => setModal({ space, date: day })}
                              className={`w-full min-h-[36px] rounded-md border text-[10px] font-medium transition-all ${
                                res
                                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                                  : "border-border bg-surface hover:bg-surface-secondary text-text-tertiary hover:text-text-secondary"
                              }`}
                            >
                              {res ? (
                                <div className="px-1 py-0.5 text-left leading-tight">
                                  <div className="font-semibold truncate">{res.campaign?.wfNumber}</div>
                                  <div className="opacity-70 truncate">{res.campaign?.name}</div>
                                </div>
                              ) : (
                                <span className="opacity-40">+</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Map view ─────────────────────────────────────────────────────────── */}
      {viewMode === "map" && spaces && (
        <FloorPlan
          spaces={spaces}
          reservations={mapRes ?? []}
          onRoomClick={(space, reservation) => setModal({ space, date: mapDate })}
        />
      )}

      {/* ── Legend (both views) ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(SPACE_TYPE_LABELS).map(([type, label]) => {
          const Icon = SPACE_TYPE_ICON[type] ?? Building2;
          const color = SPACE_TYPE_COLOR[type] ?? "";
          return (
            <div key={type} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${color}`}>
              <Icon className="h-3 w-3" />
              {label}
            </div>
          );
        })}
      </div>

      {/* ── Reserve / view modal ────────────────────────────────────────────── */}
      {modal && (
        <ReserveModal
          space={modal.space}
          date={modal.date}
          existingReservation={modalReservation}
          userRole={userRole}
          userId={userId}
          onClose={() => setModal(null)}
          onReserved={handleReserved}
        />
      )}
    </div>
  );
}

// ─── Shoot Prep view ──────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  date: string;
  location: string;
  callTime: string;
  shootName: string;
  shootType: string;
  campaign: {
    id: string;
    name: string;
    wfNumber: string;
    status: string;
  } | null;
}

// ─── Space picker modal for Shoot Prep ───────────────────────────────────────

interface SpacePickerModalProps {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  date: Date;
  spaces: StudioSpace[];
  reservations: SpaceReservation[];
  onClose: () => void;
  onChanged: () => void;
}

function SpacePickerModal({
  campaignId,
  campaignName,
  wfNumber,
  date,
  spaces,
  reservations,
  onClose,
  onChanged,
}: SpacePickerModalProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null); // spaceId being acted on

  const dateStr = format(date, "yyyy-MM-dd");

  // Map spaceId → reservation for this date
  const resMap = useMemo(() => {
    const m = new Map<string, SpaceReservation>();
    reservations.forEach((r) => { if (r.reservedDate === dateStr) m.set(r.spaceId, r); });
    return m;
  }, [reservations, dateStr]);

  async function reserveSpace(spaceId: string) {
    setBusy(spaceId);
    try {
      const res = await fetch("/api/studio/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, spaceId, reservedDate: dateStr }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to reserve");
      }
      toast("success", "Space reserved");
      onChanged();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Failed to reserve");
    } finally {
      setBusy(null);
    }
  }

  async function releaseSpace(reservationId: string) {
    setBusy(reservationId);
    try {
      const res = await fetch(`/api/studio/reservations?id=${reservationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to release");
      toast("success", "Reservation released");
      onChanged();
    } catch {
      toast("error", "Failed to release reservation");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Select Spaces — ${format(date, "EEE, MMM d")}`}
    >
      <div className="space-y-4">
        {/* Context */}
        <div className="rounded-lg bg-surface-secondary border border-border px-3 py-2.5">
          <p className="text-xs text-text-tertiary">Reserving for</p>
          <p className="text-sm font-semibold text-text-primary">{wfNumber} — {campaignName}</p>
        </div>

        {/* Space list */}
        <div className="space-y-2">
          {spaces.map((space) => {
            const existing = resMap.get(space.id);
            const isOurs = existing?.campaignId === campaignId;
            const isTaken = existing && !isOurs;
            const SpaceIcon = SPACE_TYPE_ICON[space.type] ?? Building2;
            const typeColor = SPACE_TYPE_COLOR[space.type] ?? "bg-surface-secondary text-text-secondary border-border";
            const isBusy = busy === space.id || busy === existing?.id;

            return (
              <div
                key={space.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  isOurs
                    ? "bg-primary/5 border-primary/30"
                    : isTaken
                    ? "bg-surface-secondary border-border opacity-60"
                    : "bg-surface border-border"
                }`}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border ${typeColor}`}>
                  <SpaceIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{space.name}</p>
                  <p className="text-[10px] text-text-tertiary capitalize">
                    {space.type.replace(/_/g, " ")}
                    {space.capacity ? ` · Seats ${space.capacity}` : ""}
                    {isTaken && existing?.campaign
                      ? ` · Booked: ${existing.campaign.wfNumber}`
                      : ""}
                  </p>
                </div>
                {isOurs ? (
                  <button
                    onClick={() => releaseSpace(existing!.id)}
                    disabled={isBusy}
                    className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {isBusy ? "..." : "Release"}
                  </button>
                ) : isTaken ? (
                  <span className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-medium text-text-tertiary">
                    Booked
                  </span>
                ) : (
                  <button
                    onClick={() => reserveSpace(space.id)}
                    disabled={isBusy}
                    className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isBusy ? "..." : "Reserve"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </ModalFooter>
    </Modal>
  );
}

interface ShootPrepViewProps {
  userRole: string;
  userId: string;
}

function ShootPrepView({ userRole, userId }: ShootPrepViewProps) {
  const now = new Date();
  const monthStr = format(now, "yyyy-MM");
  const nextMonthStr = format(addDays(now, 30), "yyyy-MM");
  const today = format(now, "yyyy-MM-dd");
  const limit = format(addDays(now, 30), "yyyy-MM-dd");

  const dateFrom = today;
  const dateTo = limit;

  const { data: rawEvents1, isLoading: loadingShoots } = useSWR<CalendarEvent[]>(
    `/api/calendar?month=${monthStr}`,
    fetcher
  );
  const { data: rawEvents2 } = useSWR<CalendarEvent[]>(
    monthStr !== nextMonthStr ? `/api/calendar?month=${nextMonthStr}` : null,
    fetcher
  );
  const { data: spaces } = useSWR<StudioSpace[]>("/api/studio/spaces", fetcher);
  const { data: reservations, mutate: refreshRes } = useSWR<SpaceReservation[]>(
    `/api/studio/reservations?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    fetcher
  );

  const [spacePicker, setSpacePicker] = useState<{ shoot: CalendarEvent } | null>(null);

  // Merge and filter to upcoming 30 days
  const shoots = useMemo(() => {
    const all = [...(rawEvents1 ?? []), ...(rawEvents2 ?? [])];
    return all
      .filter((e) => e.date >= today && e.date <= limit && e.campaign)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rawEvents1, rawEvents2, today, limit]);

  const ressByDate = useMemo(() => {
    const m = new Map<string, SpaceReservation[]>();
    (reservations ?? []).forEach((r) => {
      const d = r.reservedDate;
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(r);
    });
    return m;
  }, [reservations]);

  if (loadingShoots) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-surface-secondary animate-pulse" />)}
    </div>
  );

  const upcoming = shoots.slice(0, 20);

  if (!upcoming.length) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-5 w-5" />}
        title="No upcoming shoots"
        description="Shoot days will appear here as they're added to campaigns."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {upcoming.map((shoot) => {
          const daySpaces = ressByDate.get(shoot.date) ?? [];
          const campaignId = shoot.campaign?.id ?? "";
          const ours = daySpaces.filter((r) => r.campaignId === campaignId);

          return (
            <div key={shoot.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-border">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                      {format(parseISO(shoot.date), "EEE, MMM d")}
                    </span>
                    {isToday(parseISO(shoot.date)) && (
                      <Badge variant="custom" className="bg-primary/10 text-primary text-[10px]">Today</Badge>
                    )}
                  </div>
                </div>
                <Link
                  href={`/campaigns/${campaignId}`}
                  className="text-xs text-text-tertiary hover:text-primary transition-colors"
                >
                  {shoot.campaign?.wfNumber} — {shoot.campaign?.name}
                </Link>
              </div>

              {/* Body */}
              <div className="p-3.5 space-y-3">
                {/* Location / call */}
                <div className="flex items-start gap-6 text-xs text-text-secondary">
                  {shoot.location && (
                    <span><span className="font-medium text-text-primary">Location:</span> {shoot.location}</span>
                  )}
                  {shoot.callTime && (
                    <span><span className="font-medium text-text-primary">Call:</span> {shoot.callTime}</span>
                  )}
                </div>

                {/* Reserved spaces */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Greenroom Spaces</p>
                    <button
                      onClick={() => setSpacePicker({ shoot })}
                      className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
                    >
                      + Manage Spaces
                    </button>
                  </div>
                  {ours.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ours.map((r) => {
                        const Icon = SPACE_TYPE_ICON[r.space?.type ?? ""] ?? Building2;
                        const color = SPACE_TYPE_COLOR[r.space?.type ?? ""] ?? "bg-surface-secondary text-text-secondary border-border";
                        return (
                          <button
                            key={r.id}
                            onClick={() => setSpacePicker({ shoot })}
                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-opacity hover:opacity-70 ${color}`}
                          >
                            <Icon className="h-3 w-3" />
                            {r.space?.name ?? "Space"}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-text-tertiary italic">No spaces reserved — click Manage Spaces to add</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {spacePicker && spaces && reservations && (
        <SpacePickerModal
          campaignId={spacePicker.shoot.campaign!.id}
          campaignName={spacePicker.shoot.campaign!.name}
          wfNumber={spacePicker.shoot.campaign!.wfNumber}
          date={parseISO(spacePicker.shoot.date)}
          spaces={spaces}
          reservations={reservations}
          onClose={() => setSpacePicker(null)}
          onChanged={() => refreshRes()}
        />
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "today" | "spaces" | "prep" | "food";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "today",  label: "Today",      icon: Sun },
  { id: "spaces", label: "Spaces",     icon: Building2 },
  { id: "prep",   label: "Shoot Prep", icon: ClipboardList },
  { id: "food",   label: "Meals & Crafty", icon: Coffee },
];

function getDefaultTab(role: string): Tab {
  if (role === "Producer") return "spaces";
  return "today"; // Studio + Admin default to Today
}

export default function StudioManagementPage() {
  const { user, isLoading } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read tab from URL, fall back to role default
  const urlTab = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>("today"); // placeholder, will be set in effect

  useEffect(() => {
    if (user) {
      const validTabs: Tab[] = ["today", "spaces", "prep", "food"];
      if (urlTab && validTabs.includes(urlTab)) {
        setTab(urlTab);
      } else {
        setTab(getDefaultTab(user.role));
      }
    }
  }, [user, urlTab]);

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    // Update URL without navigation
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.replace(`/studio?${params.toString()}`, { scroll: false });
  }

  if (isLoading || !user) return <DashboardSkeleton />;

  const pageTitle = "Studio Management";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
          <p className="text-sm text-text-secondary">Greenroom building — spaces, prep, and food coordination</p>
        </div>
        {user.role === "Studio" && (
          <Link href="/gear/scan">
            <Button size="md" variant="secondary">
              <QrCode className="h-4 w-4" />
              Scan Gear
            </Button>
          </Link>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-surface-secondary p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === id
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "today"  && <TodayView userRole={user.role} />}
      {tab === "spaces" && <SpacesView userRole={user.role} userId={user.id} />}
      {tab === "prep"   && <ShootPrepView userRole={user.role} userId={user.id} />}
      {tab === "food"   && <FoodView userRole={user.role} />}
    </div>
  );
}

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
import { SpacePickerModal } from "@/components/studio/space-picker-modal";
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
} from "lucide-react";
import { PageTabs } from "@/components/ui/page-tabs";
import {
  format, addDays, startOfWeek, parseISO, isToday, isSameDay, isSameMonth,
  startOfMonth, endOfMonth, eachDayOfInterval, getISODay, subMonths, addMonths,
} from "date-fns";
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

// ─── Shared types ────────────────────────────────────────────────────────────

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

// ─── Spaces view — calendar + floor plan ─────────────────────────────────────

interface SpacesViewProps {
  userRole: string;
  userId: string;
}

function SpacesView({ userRole, userId }: SpacesViewProps) {
  const today = useMemo(() => new Date(), []);
  const { toast } = useToast();

  // Selected date drives the floor plan; calMonth drives the calendar display
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [calMonth, setCalMonth]         = useState<Date>(today);

  // Rooms staged for reservation (spaceIds pending confirmation)
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // User-selected shoot for booking mode (null = not in booking mode)
  const [activeShoot, setActiveShoot] = useState<CalendarEvent | null>(null);

  // Manual reserve modal (used only when no shoot is selected)
  const [modal, setModal] = useState<{ space: StudioSpace; date: Date } | null>(null);

  const monthStart  = startOfMonth(calMonth);
  const monthEnd    = endOfMonth(calMonth);
  const selectedStr = format(selectedDate, "yyyy-MM-dd");
  const calMonthStr = format(calMonth, "yyyy-MM");

  const { data: spaces } = useSWR<StudioSpace[]>("/api/studio/spaces", fetcher);

  // Full month reservations — powers calendar dots + floor plan
  const { data: monthRes, mutate: refreshRes } = useSWR<SpaceReservation[]>(
    `/api/studio/reservations?dateFrom=${format(monthStart, "yyyy-MM-dd")}&dateTo=${format(monthEnd, "yyyy-MM-dd")}`,
    fetcher
  );

  // Shoot dates for the displayed month — green dots + selection mode
  const { data: calEvents } = useSWR<CalendarEvent[]>(
    `/api/calendar?month=${calMonthStr}`,
    fetcher
  );

  // Days with any reservation → blue dot
  const markedDays = useMemo(() => {
    const s = new Set<string>();
    (monthRes ?? []).forEach((r) => s.add(r.reservedDate));
    return s;
  }, [monthRes]);

  // Days with scheduled shoots → green dot; multiple shoots per day supported
  const shootDays = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    (calEvents ?? []).forEach((e) => {
      if (e.campaign) {
        if (!m.has(e.date)) m.set(e.date, []);
        m.get(e.date)!.push(e);
      }
    });
    return m;
  }, [calEvents]);

  // All shoots on the selected date — listed below the calendar
  const todayShoots = shootDays.get(selectedStr) ?? [];

  // Reservations for the selected date → drives floor plan
  const dayRes = useMemo(
    () => (monthRes ?? []).filter((r) => r.reservedDate === selectedStr),
    [monthRes, selectedStr]
  );

  // activeCampaignId comes from user clicking a shoot, not auto-derived
  const activeCampaignId = activeShoot?.campaign?.id ?? null;

  const modalReservation = useMemo(() => {
    if (!modal) return null;
    return dayRes.find((r) => r.spaceId === modal.space.id) ?? null;
  }, [modal, dayRes]);

  function selectDay(day: Date) {
    setSelectedDate(day);
    setSelectedRooms(new Set());
    setActiveShoot(null);
    if (!isSameMonth(day, calMonth)) setCalMonth(day);
  }

  function navMonth(dir: 1 | -1) {
    const newMonth    = dir === 1 ? addMonths(calMonth, 1) : subMonths(calMonth, 1);
    const newSelected = isSameMonth(newMonth, today) ? today : startOfMonth(newMonth);
    setCalMonth(newMonth);
    setSelectedDate(newSelected);
    setSelectedRooms(new Set());
    setActiveShoot(null);
  }

  function handleRoomClick(space: StudioSpace, res: SpaceReservation | null) {
    if (!activeCampaignId) {
      // No shoot on this date — fall back to manual reserve modal
      setModal({ space, date: selectedDate });
      return;
    }
    // Blocked by another campaign — cannot override
    if (res && res.campaignId !== activeCampaignId) return;
    // Already confirmed for this campaign — not re-selectable
    if (res && res.campaignId === activeCampaignId) return;
    // Toggle selection
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(space.id)) next.delete(space.id);
      else next.add(space.id);
      return next;
    });
  }

  async function handleConfirm() {
    if (!activeCampaignId || selectedRooms.size === 0) return;
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedRooms).map((spaceId) =>
          fetch("/api/studio/reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignId: activeCampaignId, spaceId, reservedDate: selectedStr }),
          }).then((r) => { if (!r.ok) throw new Error("Failed"); })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast("success", `${selectedRooms.size} space${selectedRooms.size !== 1 ? "s" : ""} reserved`);
      } else {
        toast("error", `${failed} space${failed !== 1 ? "s" : ""} could not be reserved`);
      }
      setSelectedRooms(new Set());
      setActiveShoot(null);
      refreshRes();
    } finally {
      setSaving(false);
    }
  }

  // Calendar grid: Mon–Sun with leading nulls for offset
  const calDays = useMemo(() => {
    const days   = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const offset = getISODay(monthStart) - 1;
    return [...Array<null>(offset).fill(null), ...days];
  }, [monthStart, monthEnd]);

  return (
    <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "360px 600px" }}>

      {/* ── Left: Calendar + Shoots (1/3) ──────────────────────────────────── */}
      <div className="flex flex-col gap-4 min-w-0">
      <div className="rounded-xl border border-border bg-surface overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              {format(calMonth, "MMMM yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!isSameMonth(today, calMonth) && (
              <button
                onClick={() => { setCalMonth(today); setSelectedDate(today); setSelectedRooms(new Set()); }}
                className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                Today
              </button>
            )}
            <button onClick={() => navMonth(-1)} className="rounded-md p-1 text-text-secondary hover:bg-surface-secondary transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => navMonth(1)} className="rounded-md p-1 text-text-secondary hover:bg-surface-secondary transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 p-2 gap-1">
          {calDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const ds         = format(day, "yyyy-MM-dd");
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDay = isToday(day);
            const hasShoot   = shootDays.has(ds);
            const hasRes     = markedDays.has(ds);

            return (
              <button
                key={ds}
                onClick={() => selectDay(day)}
                className={`flex flex-col items-center justify-center rounded-lg py-2 transition-all ${
                  isSelected && isTodayDay
                    ? "bg-primary text-white font-semibold"
                    : isSelected
                    ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/25"
                    : isTodayDay
                    ? "text-primary font-semibold"
                    : "text-text-secondary hover:bg-surface-secondary"
                }`}
              >
                <span className="text-sm leading-none">{format(day, "d")}</span>
                <div className="flex gap-0.5 mt-1 h-1.5 items-center">
                  {hasShoot && <span className={`h-1 w-1 rounded-full ${isSelected && isTodayDay ? "bg-white/70" : "bg-slate-300"}`} />}
                  {hasRes   && <span className={`h-1 w-1 rounded-full ${isSelected && isTodayDay ? "bg-white" : "bg-emerald-500"}`} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Dot legend */}
        <div className="flex gap-4 px-3.5 py-2 border-t border-border">
          <span className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />Shoot scheduled
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />Spaces reserved
          </span>
        </div>

        {/* Viewing footer + campaigns */}
        <div className="border-t border-border">
          <div className="px-3.5 py-2 flex items-center justify-between">
            <p className="text-[10px] text-text-tertiary">
              Viewing{" "}
              <span className={`font-semibold ${isToday(selectedDate) ? "text-primary" : "text-text-primary"}`}>
                {isToday(selectedDate) ? "Today" : format(selectedDate, "EEE, MMM d")}
              </span>
            </p>
          </div>
          {todayShoots.length > 0 && (
            <div className="divide-y divide-border border-t border-border">
              {todayShoots.map((shoot) => {
                const isActive = activeShoot?.id === shoot.id;
                return (
                  <div
                    key={shoot.id}
                    className={`flex items-center justify-between gap-2 px-3.5 py-2.5 transition-colors ${
                      isActive ? "bg-primary/5" : "hover:bg-surface-secondary"
                    }`}
                  >
                    <div className="min-w-0">
                      {shoot.campaign?.wfNumber && (
                        <p className="text-[10px] text-text-tertiary font-mono">{shoot.campaign.wfNumber}</p>
                      )}
                      <p className="text-xs font-medium text-text-primary truncate">
                        {shoot.campaign?.name ?? shoot.shootName}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (isActive) {
                          setActiveShoot(null);
                          setSelectedRooms(new Set());
                        } else {
                          setActiveShoot(shoot);
                          setSelectedRooms(new Set());
                        }
                      }}
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                        isActive
                          ? "bg-primary text-white"
                          : "border border-border bg-surface text-text-secondary hover:border-primary hover:text-primary"
                      }`}
                    >
                      {isActive ? "Booking" : "Book"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      </div>{/* end left column */}

      {/* ── Right: Floor plan (2/3) ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface">

        {/* Tile header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Greenroom
            </span>
          </div>
          <span className="text-xs text-text-tertiary">
            {dayRes.length > 0
              ? `${dayRes.length} space${dayRes.length !== 1 ? "s" : ""} reserved`
              : "No reservations"}
          </span>
        </div>

        {/* Booking context banner — visible when a shoot is scheduled on selected date */}
        {activeShoot?.campaign && (
          <div className="flex items-center justify-between gap-4 px-3.5 py-2.5 border-b border-border bg-surface-secondary">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">Booking for</p>
              <p className="text-sm font-semibold text-text-primary truncate">
                {activeShoot.campaign.wfNumber} — {activeShoot.campaign.name}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setActiveShoot(null); setSelectedRooms(new Set()); }}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              {selectedRooms.size > 0 ? (
                <Button size="sm" onClick={handleConfirm} disabled={saving}>
                  {saving ? "Reserving..." : `Confirm ${selectedRooms.size} space${selectedRooms.size !== 1 ? "s" : ""}`}
                </Button>
              ) : (
                <p className="text-xs text-text-tertiary">Click spaces to select</p>
              )}
            </div>
          </div>
        )}

        {/* Floor plan */}
        <div className="p-3">
          {spaces ? (
            <FloorPlan
              spaces={spaces}
              reservations={dayRes}
              onRoomClick={handleRoomClick}
              selectedSpaceIds={selectedRooms}
              activeCampaignId={activeCampaignId}
            />
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Manual reserve modal (no shoot on selected date) */}
      {modal && (
        <ReserveModal
          space={modal.space}
          date={modal.date}
          existingReservation={modalReservation}
          userRole={userRole}
          userId={userId}
          onClose={() => setModal(null)}
          onReserved={() => refreshRes()}
        />
      )}
    </div>
  );
}

// ─── Shoot Prep view ──────────────────────────────────────────────────────────

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
                      <Badge variant="custom" className="bg-emerald-500/10 text-primary text-[10px]">Today</Badge>
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
  if (role === "Producer" || role === "Post Producer") return "spaces";
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
      <div className="space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h2 className="text-2xl font-bold text-text-primary">{pageTitle}</h2>
          {user.role === "Studio" && (
            <Link href="/gear/scan">
              <Button size="md" variant="secondary">
                <QrCode className="h-4 w-4" />
                Scan Gear
              </Button>
            </Link>
          )}
        </div>

        <PageTabs
          tabs={TABS.map(({ id, label, icon }) => ({ key: id, label, icon }))}
          activeTab={tab}
          onTabChange={(key) => handleTabChange(key as Tab)}
        />
      </div>

      {tab === "today"  && <TodayView userRole={user.role} />}
      {tab === "spaces" && <SpacesView userRole={user.role} userId={user.id} />}
      {tab === "prep"   && <ShootPrepView userRole={user.role} userId={user.id} />}
      {tab === "food"   && <FoodView userRole={user.role} />}
    </div>
  );
}

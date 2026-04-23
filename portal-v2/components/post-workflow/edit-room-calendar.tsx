"use client";

import { useState, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getISODay,
  addMonths,
  subMonths,
  parseISO,
  isToday,
  isSameDay,
  isSameMonth,
} from "date-fns";
import type { AppUser, EditRoom, EditRoomReservation } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ReserveRoomModal } from "./reserve-room-modal";
import { EditRoomMap } from "./edit-room-map";
import {
  Clapperboard,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Monitor,
} from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface Props {
  user: AppUser;
}

interface DetailPanel {
  groupId: string;
  roomName: string;
  editorName: string;
  campaignWfNumber: string | null;
  campaignName: string | null;
  dates: string[];
}

export function EditRoomCalendar({ user }: Props) {
  const { toast } = useToast();
  const { mutate } = useSWRConfig();

  const today = useMemo(() => new Date(), []);

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [calMonth, setCalMonth] = useState<Date>(today);

  const [showReserveModal, setShowReserveModal] = useState(false);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultRoomId, setDefaultRoomId] = useState<string | undefined>();
  const [detail, setDetail] = useState<DetailPanel | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const selectedStr = format(selectedDate, "yyyy-MM-dd");

  const { data: rooms } = useSWR<EditRoom[]>("/api/post-workflow/edit-rooms", fetcher);
  const { data: reservationsRaw, mutate: refreshRes } = useSWR<EditRoomReservation[]>(
    `/api/post-workflow/edit-room-reservations?from=${format(monthStart, "yyyy-MM-dd")}&to=${format(monthEnd, "yyyy-MM-dd")}`,
    fetcher
  );
  const { data: campaigns } = useSWR<any[]>("/api/campaigns", fetcher);

  const roomList = Array.isArray(rooms) ? rooms : [];
  const reservations = Array.isArray(reservationsRaw) ? reservationsRaw : [];
  const campaignList = Array.isArray(campaigns)
    ? campaigns.map((c: any) => ({
        id: c.id,
        wfNumber: c.wfNumber ?? c.wf_number,
        name: c.name,
      }))
    : [];

  // Map: roomId → { dateStr → reservation }
  const reservationMap = useMemo(() => {
    const map = new Map<string, Map<string, EditRoomReservation>>();
    for (const r of reservations) {
      if (!map.has(r.roomId)) map.set(r.roomId, new Map());
      map.get(r.roomId)!.set(r.reservedDate, r);
    }
    return map;
  }, [reservations]);

  // Map: groupId → all dates in this month for that group
  const groupDatesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of reservations) {
      if (!map.has(r.groupId)) map.set(r.groupId, []);
      map.get(r.groupId)!.push(r.reservedDate);
    }
    return map;
  }, [reservations]);

  // Days in this month that have any bookings → calendar dots
  const bookedDays = useMemo(() => {
    const set = new Set<string>();
    for (const r of reservations) set.add(r.reservedDate);
    return set;
  }, [reservations]);

  // roomId → reservation for the selected date
  const reservationsByRoom = useMemo(() => {
    const map = new Map<string, EditRoomReservation>();
    for (const [roomId, dateMap] of reservationMap) {
      const res = dateMap.get(selectedStr);
      if (res) map.set(roomId, res);
    }
    return map;
  }, [reservationMap, selectedStr]);

  // Calendar grid with leading nulls for Mon offset
  const calDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const offset = getISODay(monthStart) - 1;
    return [...Array<null>(offset).fill(null), ...days];
  }, [monthStart, monthEnd]);

  function selectDay(day: Date) {
    setSelectedDate(day);
    if (!isSameMonth(day, calMonth)) setCalMonth(day);
  }

  function navMonth(dir: 1 | -1) {
    const newMonth = dir === 1 ? addMonths(calMonth, 1) : subMonths(calMonth, 1);
    const newSelected = isSameMonth(newMonth, today) ? today : startOfMonth(newMonth);
    setCalMonth(newMonth);
    setSelectedDate(newSelected);
  }

  function handleMapRoomClick(room: EditRoom, reservation: EditRoomReservation | null) {
    if (reservation) {
      openDetail(reservation, room.name);
    } else if (canWrite) {
      setDefaultRoomId(room.id);
      setDefaultDate(selectedStr);
      setShowReserveModal(true);
    }
  }

  function openDetail(r: EditRoomReservation, roomName: string) {
    const dates = groupDatesMap.get(r.groupId) ?? [r.reservedDate];
    dates.sort();
    setDetail({
      groupId: r.groupId,
      roomName,
      editorName: r.editorName,
      campaignWfNumber: r.campaignWfNumber ?? null,
      campaignName: r.campaignName ?? null,
      dates,
    });
  }

  async function handleCancel(groupId: string) {
    setCancelling(true);
    try {
      const res = await fetch(
        `/api/post-workflow/edit-room-reservations/group/${groupId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast("error", "Failed to cancel booking.");
        return;
      }
      toast("success", "Booking cancelled.");
      setDetail(null);
      refreshRes();
    } finally {
      setCancelling(false);
    }
  }

  const canWrite = ["Admin", "Producer", "Post Producer"].includes(user.role);
  const dayResCount = reservationsByRoom.size;

  return (
    <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "360px 1fr" }}>

      {/* ── Left: Month calendar ───────────────────────────────────────────── */}
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
                onClick={() => { setCalMonth(today); setSelectedDate(today); }}
                className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => navMonth(-1)}
              className="rounded-md p-1 text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => navMonth(1)}
              className="rounded-md p-1 text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-text-tertiary"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 p-2 gap-1">
          {calDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const ds = format(day, "yyyy-MM-dd");
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDay = isToday(day);
            const hasBookings = bookedDays.has(ds);

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
                  {hasBookings && (
                    <span
                      className={`h-1 w-1 rounded-full ${
                        isSelected && isTodayDay ? "bg-white" : "bg-primary"
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend + viewing footer */}
        <div className="border-t border-border">
          <div className="flex gap-4 px-3.5 py-2">
            <span className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              Edit room booked
            </span>
          </div>
          <div className="border-t border-border px-3.5 py-2">
            <p className="text-[10px] text-text-tertiary">
              Viewing{" "}
              <span className={`font-semibold ${isToday(selectedDate) ? "text-primary" : "text-text-primary"}`}>
                {isToday(selectedDate) ? "Today" : format(selectedDate, "EEE, MMM d")}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Right: Edit room map ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">

        {/* Tile header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Edit Rooms
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-tertiary">
              {dayResCount > 0
                ? `${dayResCount} room${dayResCount !== 1 ? "s" : ""} booked`
                : "All rooms available"}
            </span>
            {canWrite && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setDefaultRoomId(undefined);
                  setDefaultDate(selectedStr);
                  setShowReserveModal(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Reserve Room
              </Button>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="p-3">
          {roomList.length > 0 ? (
            <EditRoomMap
              rooms={roomList}
              reservationsByRoom={reservationsByRoom}
              onRoomClick={handleMapRoomClick}
              canWrite={canWrite}
            />
          ) : (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Detail panel overlay */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <div
            className="relative w-full max-w-sm rounded-xl border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-4 py-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">{detail.roomName}</h4>
                <p className="mt-0.5 text-xs text-text-tertiary">Booking details</p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="rounded-md p-1 text-text-tertiary hover:bg-surface-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">Editor</p>
                <p className="mt-0.5 text-sm font-medium text-text-primary">{detail.editorName}</p>
              </div>
              {detail.campaignWfNumber && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">Campaign</p>
                  <p className="mt-0.5 text-sm text-text-primary">
                    {detail.campaignWfNumber}
                    {detail.campaignName ? ` — ${detail.campaignName}` : ""}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                  Dates ({detail.dates.length} {detail.dates.length === 1 ? "day" : "days"})
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {detail.dates.map((d) => (
                    <span
                      key={d}
                      className="flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] text-text-secondary"
                    >
                      <CalendarDays className="h-3 w-3" />
                      {format(parseISO(d), "EEE, MMM d")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {canWrite && (
              <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancel(detail.groupId)}
                  disabled={cancelling}
                  className="text-error hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {cancelling ? "Cancelling…" : "Cancel Booking"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <ReserveRoomModal
        open={showReserveModal}
        onClose={() => setShowReserveModal(false)}
        rooms={roomList}
        campaigns={campaignList}
        defaultRoomId={defaultRoomId}
        defaultDate={defaultDate}
      />
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  parseISO,
  isSameDay,
  isToday,
} from "date-fns";
import type { AppUser, EditRoom, EditRoomReservation } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ReserveRoomModal } from "./reserve-room-modal";
import { getRoomColor } from "@/lib/constants/edit-rooms";
import {
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  CalendarDays,
  Pencil,
  Trash2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); });

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

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

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultRoomId, setDefaultRoomId] = useState<string | undefined>();
  const [detail, setDetail] = useState<DetailPanel | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const fromStr = format(weekStart, "yyyy-MM-dd");
  const toStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: rooms } = useSWR<EditRoom[]>("/api/post-workflow/edit-rooms", fetcher);
  const { data: reservationsRaw, isLoading } = useSWR<EditRoomReservation[]>(
    `/api/post-workflow/edit-room-reservations?from=${fromStr}&to=${toStr}`,
    fetcher
  );
  const { data: campaigns } = useSWR<any[]>("/api/campaigns", fetcher);

  const roomList = Array.isArray(rooms) ? rooms : [];
  const reservations = Array.isArray(reservationsRaw) ? reservationsRaw : [];
  const campaignList = Array.isArray(campaigns)
    ? campaigns.map((c: any) => ({ id: c.id, wfNumber: c.wfNumber ?? c.wf_number, name: c.name }))
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

  // Map: groupId → all dates in this week for that group
  const groupDatesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of reservations) {
      if (!map.has(r.groupId)) map.set(r.groupId, []);
      map.get(r.groupId)!.push(r.reservedDate);
    }
    return map;
  }, [reservations]);

  // Room color by sort_order index
  function roomColor(roomIndex: number) {
    return getRoomColor(roomIndex);
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
      const res = await fetch(`/api/post-workflow/edit-room-reservations/group/${groupId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast("error", "Failed to cancel booking.");
        return;
      }
      toast("success", "Booking cancelled.");
      setDetail(null);
      mutate(`/api/post-workflow/edit-room-reservations?from=${fromStr}&to=${toStr}`);
    } finally {
      setCancelling(false);
    }
  }

  const canWrite = ["Admin", "Producer", "Post Producer"].includes(user.role);

  return (
    <div className="space-y-4">
      <Card padding="none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Edit Room Schedule
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[160px] text-center text-sm font-medium text-text-primary">
                {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="text-xs"
            >
              Today
            </Button>
            {canWrite && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setDefaultRoomId(undefined); setDefaultDate(undefined); setShowReserveModal(true); }}
              >
                <Plus className="h-4 w-4" />
                Reserve Room
              </Button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className={`overflow-x-auto transition-opacity ${isLoading ? "opacity-40" : ""}`}>
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr>
                {/* Room label column */}
                <th className="w-32 border-b border-r border-border bg-surface-secondary px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-text-tertiary" />
                {weekDays.map((day, i) => {
                  const today = isToday(day);
                  return (
                    <th
                      key={i}
                      className={`border-b border-r border-border px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide ${
                        today ? "bg-primary/5 text-primary" : "bg-surface-secondary text-text-tertiary"
                      }`}
                    >
                      <div>{DAY_LABELS[i]}</div>
                      <div
                        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                          today ? "bg-primary font-bold text-white" : "text-text-secondary"
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roomList.map((room, roomIdx) => {
                const color = roomColor(roomIdx);
                const roomReservations = reservationMap.get(room.id) ?? new Map();

                return (
                  <tr key={room.id} className="group">
                    {/* Room name */}
                    <td className="border-b border-r border-border-light bg-surface-secondary px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.bg}`} />
                        <span className="text-xs font-medium text-text-primary leading-tight">
                          {room.name}
                        </span>
                      </div>
                    </td>

                    {/* Day cells */}
                    {weekDays.map((day, dayIdx) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const reservation = roomReservations.get(dateStr);
                      const today = isToday(day);

                      // Determine visual block edges within the week
                      const prevDateStr = dayIdx > 0 ? format(addDays(day, -1), "yyyy-MM-dd") : null;
                      const nextDateStr = dayIdx < 6 ? format(addDays(day, 1), "yyyy-MM-dd") : null;
                      const hasPrev = reservation && prevDateStr
                        ? roomReservations.get(prevDateStr)?.groupId === reservation.groupId
                        : false;
                      const hasNext = reservation && nextDateStr
                        ? roomReservations.get(nextDateStr)?.groupId === reservation.groupId
                        : false;

                      return (
                        <td
                          key={dayIdx}
                          className={`relative border-b border-r border-border-light p-1 ${
                            today ? "bg-primary/3" : ""
                          }`}
                          style={{ minWidth: 90, height: 52 }}
                        >
                          {reservation ? (
                            <button
                              onClick={() => openDetail(reservation, room.name)}
                              className={`
                                flex h-full w-full cursor-pointer items-center px-2 text-left transition-opacity hover:opacity-80
                                ${color.light}
                                ${!hasPrev ? "rounded-l-md border-l border-t border-b" : "border-t border-b"}
                                ${!hasNext ? "rounded-r-md border-r" : ""}
                                border-opacity-50
                              `}
                            >
                              {!hasPrev && (
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[11px] font-semibold leading-tight">
                                    {reservation.editorName}
                                  </p>
                                  {reservation.campaignWfNumber && (
                                    <p className="truncate text-[10px] opacity-70">
                                      {reservation.campaignWfNumber}
                                    </p>
                                  )}
                                </div>
                              )}
                            </button>
                          ) : canWrite ? (
                            <button
                              onClick={() => {
                                setDefaultRoomId(room.id);
                                setDefaultDate(dateStr);
                                setShowReserveModal(true);
                              }}
                              className="flex h-full w-full items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-surface-secondary group-hover:opacity-100"
                              title="Add booking"
                            >
                              <Plus className="h-3.5 w-3.5 text-text-tertiary" />
                            </button>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {roomList.length === 0 && !isLoading && (
          <div className="py-10 text-center text-sm text-text-tertiary">
            No edit rooms configured.
          </div>
        )}
      </Card>

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
                  className="text-red-600 hover:bg-red-50"
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

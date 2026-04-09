"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { StudioSpace, SpaceReservation } from "@/types/domain";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ClipboardList,
  X,
  Camera,
  ChefHat,
  Shirt,
  Package,
  Layers,
  Users,
  Warehouse,
  Box,
} from "lucide-react";
import { format, addDays, startOfWeek, parseISO, isToday, isSameDay } from "date-fns";
import Link from "next/link";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

// ─── Space type display helpers ──────────────────────────────────────────────

const SPACE_TYPE_ICON: Record<string, React.ElementType> = {
  shooting_bay:      Camera,
  set_kitchen:       ChefHat,
  prep_kitchen:      ChefHat,
  wardrobe:          Shirt,
  multipurpose:      Layers,
  conference:        Users,
  equipment_storage: Package,
  prop_storage:      Box,
};

const SPACE_TYPE_COLOR: Record<string, string> = {
  shooting_bay:      "bg-violet-50 text-violet-700 border-violet-200",
  set_kitchen:       "bg-amber-50 text-amber-700 border-amber-200",
  prep_kitchen:      "bg-orange-50 text-orange-700 border-orange-200",
  wardrobe:          "bg-pink-50 text-pink-700 border-pink-200",
  multipurpose:      "bg-blue-50 text-blue-700 border-blue-200",
  conference:        "bg-teal-50 text-teal-700 border-teal-200",
  equipment_storage: "bg-slate-50 text-slate-600 border-slate-200",
  prop_storage:      "bg-stone-50 text-stone-600 border-stone-200",
};

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
  onClose: () => void;
  onReserved: () => void;
}

function ReserveModal({ space, date, existingReservation, onClose, onReserved }: ReserveModalProps) {
  const { data: campaigns } = useSWR<Array<{ id: string; wfNumber: string; name: string }>>(
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

  const activeCampaigns = (campaigns ?? []).filter((c: { id: string; wfNumber: string; name: string }) => c);

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
                {activeCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.wfNumber} — {c.name}
                  </option>
                ))}
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

// ─── Spaces grid ─────────────────────────────────────────────────────────────

function SpacesView() {
  const [anchor, setAnchor] = useState(() => new Date());
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);

  const dateFrom = format(weekDays[0], "yyyy-MM-dd");
  const dateTo   = format(weekDays[6], "yyyy-MM-dd");

  const { data: spaces, isLoading: loadingSpaces } =
    useSWR<StudioSpace[]>("/api/studio/spaces", fetcher);
  const { data: reservations, isLoading: loadingRes, mutate: refreshRes } =
    useSWR<SpaceReservation[]>(
      `/api/studio/reservations?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      fetcher
    );

  const [modal, setModal] = useState<{ space: StudioSpace; date: Date } | null>(null);

  const resMap = useMemo(() => {
    const m = new Map<string, SpaceReservation>();
    (reservations ?? []).forEach((r) => {
      m.set(`${r.spaceId}::${r.reservedDate}`, r);
    });
    return m;
  }, [reservations]);

  if (loadingSpaces || loadingRes) return (
    <div className="space-y-2">
      {[1,2,3,4].map(i => (
        <div key={i} className="h-10 rounded-lg bg-surface-secondary animate-pulse" />
      ))}
    </div>
  );

  const modalReservation = modal
    ? resMap.get(`${modal.space.id}::${format(modal.date, "yyyy-MM-dd")}`) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setAnchor((d) => addDays(d, -7))}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev week
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {format(weekDays[0], "MMM d")} – {format(weekDays[6], "MMM d, yyyy")}
        </span>
        <button
          onClick={() => setAnchor((d) => addDays(d, 7))}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          Next week
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
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
                  {/* Space label */}
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
                  {/* Day cells */}
                  {weekDays.map((day) => {
                    const key = `${space.id}::${format(day, "yyyy-MM-dd")}`;
                    const res = resMap.get(key);
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries({
          shooting_bay: "Shooting Bay",
          set_kitchen: "Set Kitchen",
          prep_kitchen: "Prep Kitchen",
          wardrobe: "Wardrobe",
          multipurpose: "Multipurpose",
          conference: "Conference",
          equipment_storage: "Equipment Storage",
          prop_storage: "Prop Storage",
        }).map(([type, label]) => {
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

      {/* Reserve modal */}
      {modal && (
        <ReserveModal
          space={modal.space}
          date={modal.date}
          existingReservation={modalReservation}
          onClose={() => setModal(null)}
          onReserved={() => refreshRes()}
        />
      )}
    </div>
  );
}

// ─── Shoot Prep view ──────────────────────────────────────────────────────────

interface ShootDay {
  id: string;
  shootDate: string;
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  location: string;
  callTime: string | null;
  spaces: SpaceReservation[];
}

function ShootPrepView() {
  const now = new Date();
  const dateFrom = format(now, "yyyy-MM-dd");
  const dateTo   = format(addDays(now, 30), "yyyy-MM-dd");

  const { data: shoots, isLoading: loadingShoots } = useSWR<ShootDay[]>(
    `/api/calendar?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    fetcher
  );
  const { data: reservations } = useSWR<SpaceReservation[]>(
    `/api/studio/reservations?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    fetcher
  );

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

  const upcoming = (shoots ?? []).slice(0, 20);

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
    <div className="space-y-3">
      {upcoming.map((shoot) => {
        const daySpaces = ressByDate.get(shoot.shootDate) ?? [];
        const isGreenroom = daySpaces.some((r) => r.campaignId === shoot.campaignId);

        return (
          <div key={shoot.id} className="rounded-xl border border-border bg-surface overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-border">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                    {format(parseISO(shoot.shootDate), "EEE, MMM d")}
                  </span>
                  {isToday(parseISO(shoot.shootDate)) && (
                    <Badge variant="custom" className="bg-primary/10 text-primary text-[10px]">Today</Badge>
                  )}
                </div>
              </div>
              <Link
                href={`/campaigns/${shoot.campaignId}`}
                className="text-xs text-text-tertiary hover:text-primary transition-colors"
              >
                {shoot.wfNumber} — {shoot.campaignName}
              </Link>
            </div>

            {/* Body */}
            <div className="p-3.5 space-y-3">
              {/* Location */}
              <div className="flex items-start gap-6 text-xs text-text-secondary">
                {shoot.location && (
                  <span><span className="font-medium text-text-primary">Location:</span> {shoot.location}</span>
                )}
                {shoot.callTime && (
                  <span><span className="font-medium text-text-primary">Call:</span> {shoot.callTime}</span>
                )}
              </div>

              {/* Reserved spaces */}
              {daySpaces.filter((r) => r.campaignId === shoot.campaignId).length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">Reserved Spaces</p>
                  <div className="flex flex-wrap gap-1.5">
                    {daySpaces
                      .filter((r) => r.campaignId === shoot.campaignId)
                      .map((r) => {
                        const Icon = SPACE_TYPE_ICON[r.space?.type ?? ""] ?? Building2;
                        const color = SPACE_TYPE_COLOR[r.space?.type ?? ""] ?? "bg-surface-secondary text-text-secondary border-border";
                        return (
                          <div
                            key={r.id}
                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${color}`}
                          >
                            <Icon className="h-3 w-3" />
                            {r.space?.name ?? "Space"}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-tertiary italic">No Greenroom spaces reserved for this shoot</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "spaces" | "prep";

export default function StudioManagementPage() {
  const { user, isLoading } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("spaces");

  if (isLoading || !user) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Studio Management</h2>
          <p className="text-sm text-text-secondary">Greenroom space reservations and shoot prep</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-surface-secondary p-1 w-fit">
        {[
          { id: "spaces" as Tab, label: "Spaces", icon: Building2 },
          { id: "prep"   as Tab, label: "Shoot Prep", icon: ClipboardList },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
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

      {tab === "spaces" && <SpacesView />}
      {tab === "prep"   && <ShootPrepView />}
    </div>
  );
}

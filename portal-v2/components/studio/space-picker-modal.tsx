"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Building2 } from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SPACE_TYPE_ICON, SPACE_TYPE_COLOR } from "@/lib/constants/studio";
import type { StudioSpace, SpaceReservation } from "@/types/domain";

interface SpacePickerModalProps {
  campaignId: string;
  campaignName?: string;
  wfNumber?: string;
  date: Date;
  spaces: StudioSpace[];
  reservations: SpaceReservation[];
  onClose: () => void;
  onChanged: () => void;
}

export function SpacePickerModal({
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
  const [busy, setBusy] = useState<string | null>(null);

  const dateStr = format(date, "yyyy-MM-dd");

  const resMap = useMemo(() => {
    const m = new Map<string, SpaceReservation>();
    reservations.forEach((r) => {
      if (r.reservedDate === dateStr) m.set(r.spaceId, r);
    });
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
        {/* Context header — shown when campaign name is available */}
        {campaignName && (
          <div className="rounded-lg bg-surface-secondary border border-border px-3 py-2.5">
            <p className="text-xs text-text-tertiary">Reserving for</p>
            <p className="text-sm font-semibold text-text-primary">{[wfNumber, campaignName].filter(Boolean).join(" ")}</p>
          </div>
        )}

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
                    className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-error hover:bg-red-100 transition-colors disabled:opacity-50"
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

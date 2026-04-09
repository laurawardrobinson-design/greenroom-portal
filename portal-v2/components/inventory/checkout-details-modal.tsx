"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Calendar, Tag, ArrowUpFromLine } from "lucide-react";
import type { CampaignListItem } from "@/types/domain";
import { differenceInDays, parseISO, isToday } from "date-fns";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface CheckoutDetailsModalProps {
  open: boolean;
  itemCount: number;
  onConfirm: (opts: { campaignId?: string; dueDate?: string }) => void;
  onCancel: () => void;
}

function shootDateLabel(nextShootDate: string | null): string {
  if (!nextShootDate) return "";
  const d = parseISO(nextShootDate);
  if (isToday(d)) return " — shoot TODAY";
  const days = differenceInDays(d, new Date());
  if (days === 1) return " — shoot tomorrow";
  if (days > 1 && days <= 14) return ` — shoot in ${days}d`;
  return "";
}

export function CheckoutDetailsModal({
  open,
  itemCount,
  onConfirm,
  onCancel,
}: CheckoutDetailsModalProps) {
  const [campaignId, setCampaignId] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCampaignId("");
      setDueDate("");
    }
  }, [open]);

  const { data: rawCampaigns } = useSWR<CampaignListItem[]>(
    open ? "/api/campaigns" : null,
    fetcher
  );

  // Sort: active campaigns with near-term shoots first, then others, exclude completed/cancelled
  const campaigns = useMemo(() => {
    const all: CampaignListItem[] = Array.isArray(rawCampaigns) ? rawCampaigns : [];
    const active = all.filter(
      (c) => c.status !== "Complete" && c.status !== "Cancelled"
    );
    const today = new Date();
    return active.sort((a, b) => {
      const aDate = a.nextShootDate ? differenceInDays(parseISO(a.nextShootDate), today) : 999;
      const bDate = b.nextShootDate ? differenceInDays(parseISO(b.nextShootDate), today) : 999;
      // Negative days (past) sort after future dates
      const aScore = aDate < 0 ? 999 + Math.abs(aDate) : aDate;
      const bScore = bDate < 0 ? 999 + Math.abs(bDate) : bDate;
      return aScore - bScore;
    });
  }, [rawCampaigns]);

  // Group into "upcoming" (shoot within 14 days or today) vs everything else
  const today = new Date();
  const upcoming = campaigns.filter((c) => {
    if (!c.nextShootDate) return false;
    const days = differenceInDays(parseISO(c.nextShootDate), today);
    return days >= 0 && days <= 14;
  });
  const other = campaigns.filter((c) => !upcoming.includes(c));

  function handleConfirm() {
    onConfirm({
      campaignId: campaignId || undefined,
      dueDate: dueDate || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Check Out ${itemCount} Item${itemCount !== 1 ? "s" : ""}`}
      description="Optionally assign a campaign and set a return date."
      size="sm"
    >
      <div className="space-y-4">
        {/* Campaign */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
            <Tag className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              CAMPAIGN
            </h3>
          </div>
          <div className="p-3.5">
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-surface pl-3 pr-3 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">No campaign (general checkout)</option>
              {upcoming.length > 0 && (
                <optgroup label="— Upcoming shoots —">
                  {upcoming.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.wfNumber ? `${c.wfNumber} — ` : ""}{c.name}{shootDateLabel(c.nextShootDate)}
                    </option>
                  ))}
                </optgroup>
              )}
              {other.length > 0 && (
                <optgroup label="— Other campaigns —">
                  {other.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.wfNumber ? `${c.wfNumber} — ` : ""}{c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Return date */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
            <Calendar className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              RETURN DATE
            </h3>
          </div>
          <div className="p-3.5">
            <input
              type="date"
              value={dueDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-surface pl-3 pr-3 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
            {!dueDate && (
              <p className="mt-1.5 text-xs text-text-tertiary">
                Leave blank if no specific return date is needed.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            <ArrowUpFromLine className="h-4 w-4" />
            Confirm Checkout
          </Button>
        </div>
      </div>
    </Modal>
  );
}

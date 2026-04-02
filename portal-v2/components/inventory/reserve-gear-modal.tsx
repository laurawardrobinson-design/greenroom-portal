"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useToast } from "@/components/ui/toast";
import type { GearItem, CampaignListItem } from "@/types/domain";

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });

export function ReserveGearModal({
  open,
  onClose,
  items,
  preselectedItem,
  onReserved,
}: {
  open: boolean;
  onClose: () => void;
  items: GearItem[];
  preselectedItem: GearItem | null;
  onReserved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [gearItemId, setGearItemId] = useState(preselectedItem?.id || "");
  const [gearSearch, setGearSearch] = useState(
    preselectedItem ? `${preselectedItem.name} (${preselectedItem.brand} ${preselectedItem.model})` : ""
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [notes, setNotes] = useState("");
  const [dateError, setDateError] = useState("");

  const { data: rawCampaigns } = useSWR<CampaignListItem[]>(
    open ? "/api/campaigns" : null,
    fetcher
  );
  const campaigns = Array.isArray(rawCampaigns) ? rawCampaigns : [];

  if (preselectedItem && gearItemId !== preselectedItem.id) {
    setGearItemId(preselectedItem.id);
    setGearSearch(`${preselectedItem.name} (${preselectedItem.brand} ${preselectedItem.model})`);
  }

  const today = new Date().toISOString().split("T")[0];

  function validateDates(): boolean {
    if (!startDate || !endDate) {
      setDateError("Both start and end dates are required");
      return false;
    }
    if (startDate < today) {
      setDateError("Start date cannot be in the past");
      return false;
    }
    if (endDate <= startDate) {
      setDateError("End date must be after start date");
      return false;
    }
    setDateError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gearItemId) {
      toast("error", "Select a gear item");
      return;
    }
    if (!validateDates()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/gear/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gearItemId, startDate, endDate, campaignId: campaignId || undefined, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast("success", "Reservation created");
      setGearItemId("");
      setGearSearch("");
      setStartDate("");
      setEndDate("");
      setCampaignId("");
      setCampaignSearch("");
      setNotes("");
      onReserved();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to reserve");
    } finally {
      setSaving(false);
    }
  }

  const available = items.filter(
    (i) => i.status === "Available" || i.id === preselectedItem?.id
  );

  return (
    <Modal open={open} onClose={onClose} title="Reserve Gear">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label className="block text-xs font-medium text-text-primary mb-1">
            Gear Item
          </label>
          <input
            type="text"
            value={gearSearch}
            onChange={(e) => {
              setGearSearch(e.target.value);
              setGearItemId("");
              setShowDropdown(true);
            }}
            onFocus={() => { if (!gearItemId) setShowDropdown(true); }}
            placeholder="Search by name, brand, or model..."
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {showDropdown && !gearItemId && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-[180px] overflow-y-auto rounded-lg border border-border bg-surface shadow-md">
                {(() => {
                  const filtered = gearSearch.trim()
                    ? available.filter((i) =>
                        `${i.name} ${i.brand} ${i.model}`.toLowerCase().includes(gearSearch.toLowerCase())
                      ).slice(0, 8)
                    : available.slice(0, 8);
                  return filtered.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-text-tertiary">No items found</p>
                  ) : (
                    filtered.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setGearItemId(item.id);
                          setGearSearch(`${item.name} (${item.brand} ${item.model})`);
                          setShowDropdown(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-text-tertiary">{item.brand} {item.model}</span>
                      </button>
                    ))
                  );
                })()}
              </div>
            </>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-text-primary mb-1">
            Dates
          </label>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            minDate={today}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); setDateError(""); }}
          />
        </div>
        {dateError && (
          <p className="text-xs text-red-600">{dateError}</p>
        )}
        {/* Campaign */}
        <div className="relative">
          <label className="block text-xs font-medium text-text-primary mb-1">
            Campaign
          </label>
          <input
            type="text"
            value={campaignSearch}
            onChange={(e) => {
              setCampaignSearch(e.target.value);
              setCampaignId("");
              setShowCampaignDropdown(true);
            }}
            onFocus={() => { if (!campaignId) setShowCampaignDropdown(true); }}
            placeholder="Search campaigns..."
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {showCampaignDropdown && !campaignId && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowCampaignDropdown(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-[160px] overflow-y-auto rounded-lg border border-border bg-surface shadow-md">
                {(() => {
                  const filtered = campaignSearch.trim()
                    ? campaigns.filter((c) =>
                        `${c.wfNumber} ${c.name}`.toLowerCase().includes(campaignSearch.toLowerCase())
                      ).slice(0, 6)
                    : campaigns.slice(0, 6);
                  return filtered.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-text-tertiary">No campaigns found</p>
                  ) : (
                    filtered.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCampaignId(c.id);
                          setCampaignSearch(`${c.wfNumber} — ${c.name}`);
                          setShowCampaignDropdown(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                      >
                        <span className="text-xs text-text-tertiary">{c.wfNumber}</span>
                        <span className="font-medium">{c.name}</span>
                      </button>
                    ))
                  );
                })()}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-text-primary mb-1">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., For Spring Campaign shoot"
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Reserve
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

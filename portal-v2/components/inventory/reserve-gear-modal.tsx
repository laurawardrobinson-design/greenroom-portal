"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useToast } from "@/components/ui/toast";
import type { GearItem, CampaignListItem } from "@/types/domain";
import { Check } from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });

export function ReserveGearModal({
  open,
  onClose,
  items,
  preselectedItem,
  initialStartDate,
  initialEndDate,
  initialCampaignId,
  initialCampaignLabel,
  onReserved,
}: {
  open: boolean;
  onClose: () => void;
  items: GearItem[];
  preselectedItem: GearItem | null;
  initialStartDate?: string;
  initialEndDate?: string;
  initialCampaignId?: string;
  initialCampaignLabel?: string;
  onReserved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedItem ? [preselectedItem.id] : []);
  const [gearSearch, setGearSearch] = useState("");
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState(initialEndDate ?? "");
  const [campaignId, setCampaignId] = useState(initialCampaignId ?? "");
  const [campaignSearch, setCampaignSearch] = useState(initialCampaignLabel ?? "");
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [notes, setNotes] = useState("");
  const [dateError, setDateError] = useState("");

  const { data: rawCampaigns } = useSWR<CampaignListItem[]>(
    open ? "/api/campaigns" : null,
    fetcher
  );
  const campaigns = Array.isArray(rawCampaigns) ? rawCampaigns : [];

  const [lastPreselectedId, setLastPreselectedId] = useState<string | null>(preselectedItem?.id ?? null);
  if (preselectedItem && preselectedItem.id !== lastPreselectedId) {
    setLastPreselectedId(preselectedItem.id);
    setSelectedIds((prev) => (prev.includes(preselectedItem.id) ? prev : [...prev, preselectedItem.id]));
  }

  const [lastPrefillKey, setLastPrefillKey] = useState("");
  const prefillKey = `${initialStartDate ?? ""}|${initialEndDate ?? ""}|${initialCampaignId ?? ""}`;
  if (open && prefillKey !== "||" && prefillKey !== lastPrefillKey) {
    setLastPrefillKey(prefillKey);
    if (initialStartDate) setStartDate(initialStartDate);
    if (initialEndDate) setEndDate(initialEndDate);
    if (initialCampaignId) setCampaignId(initialCampaignId);
    if (initialCampaignLabel) setCampaignSearch(initialCampaignLabel);
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
    if (endDate < startDate) {
      setDateError("End date must be on or after start date");
      return false;
    }
    setDateError("");
    return true;
  }

  function resetForm() {
    setSelectedIds([]);
    setGearSearch("");
    setStartDate("");
    setEndDate("");
    setCampaignId("");
    setCampaignSearch("");
    setNotes("");
    setLastPrefillKey("");
    setLastPreselectedId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      toast("error", "Add at least one gear item");
      return;
    }
    if (!validateDates()) return;
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((gearItemId) =>
          fetch("/api/gear/reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gearItemId, startDate, endDate, campaignId: campaignId || undefined, notes }),
          }).then(async (r) => {
            if (!r.ok) {
              const data = await r.json().catch(() => ({}));
              throw new Error(data.error || "Failed");
            }
          })
        )
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length === 0) {
        toast("success", `${selectedIds.length} reservation${selectedIds.length !== 1 ? "s" : ""} created`);
        resetForm();
        onReserved();
      } else if (failures.length < selectedIds.length) {
        toast("error", `${selectedIds.length - failures.length} reserved · ${failures.length} failed`);
        onReserved();
      } else {
        const first = failures[0] as PromiseRejectedResult;
        throw new Error(first.reason?.message ?? "Failed to reserve");
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to reserve");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={campaignId && campaignSearch.trim() ? campaignSearch.trim() : "Reserve Gear"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!campaignId && (
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
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
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
                          setCampaignSearch([c.wfNumber, c.name].filter(Boolean).join(" "));
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
        )}
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
          <p className="text-xs text-error">{dateError}</p>
        )}

        <div>
          <label className="block text-xs font-medium text-text-primary mb-1">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., For Spring Campaign shoot"
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-primary mb-1">
            Gear Items {selectedIds.length > 0 && <span className="text-text-tertiary">· {selectedIds.length} selected</span>}
          </label>
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <input
              type="text"
              value={gearSearch}
              onChange={(e) => setGearSearch(e.target.value)}
              placeholder="Search by name, brand, or model..."
              className="w-full h-9 border-b border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <ul className="max-h-[220px] overflow-y-auto divide-y divide-border">
              {(() => {
                const pool = items.filter(
                  (i) => i.status === "Available" || selectedIds.includes(i.id) || i.id === preselectedItem?.id
                );
                const filtered = gearSearch.trim()
                  ? pool.filter((i) =>
                      `${i.name} ${i.brand} ${i.model}`.toLowerCase().includes(gearSearch.toLowerCase())
                    )
                  : pool;
                if (filtered.length === 0) {
                  return (
                    <li className="px-3 py-3 text-xs text-text-tertiary">No items match</li>
                  );
                }
                return filtered.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedIds((prev) =>
                            isSelected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                          )
                        }
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                          isSelected ? "bg-primary/5" : "hover:bg-surface-secondary"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected ? "border-primary bg-primary text-white" : "border-border bg-surface"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-text-primary truncate">{item.name}</span>
                          <span className="block text-[11px] text-text-tertiary truncate">{item.brand} {item.model}</span>
                        </span>
                      </button>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {selectedIds.length > 1 ? `Reserve ${selectedIds.length} Items` : "Reserve"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

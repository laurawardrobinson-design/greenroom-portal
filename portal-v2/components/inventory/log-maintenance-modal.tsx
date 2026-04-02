"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { GearItem } from "@/types/domain";

export function LogMaintenanceModal({
  open,
  onClose,
  items,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  items: GearItem[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [gearItemId, setGearItemId] = useState("");
  const [gearSearch, setGearSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [type, setType] = useState<"Scheduled" | "Repair">("Scheduled");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = gearSearch.trim()
    ? items.filter((i) =>
        `${i.name} ${i.brand} ${i.model}`.toLowerCase().includes(gearSearch.toLowerCase())
      ).slice(0, 8)
    : items.slice(0, 8);

  function selectItem(item: GearItem) {
    setGearItemId(item.id);
    setGearSearch(`${item.name} (${item.brand} ${item.model})`);
    setShowDropdown(false);
  }

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setGearItemId("");
      setGearSearch("");
      setDescription("");
      setScheduledDate("");
      setCost("");
      setNotes("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gearItemId || !description) {
      toast("error", "Select an item and describe the work");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/gear/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gearItemId,
          type,
          description,
          scheduledDate: scheduledDate || undefined,
          cost: cost ? Number(cost) : undefined,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to log maintenance");
      toast("success", "Maintenance logged");
      onCreated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to log maintenance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Maintenance">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Gear item typeahead */}
        <div className="relative">
          <label className="block text-xs font-medium text-text-primary mb-1">
            Gear Item
          </label>
          <input
            ref={inputRef}
            type="text"
            value={gearSearch}
            onChange={(e) => {
              setGearSearch(e.target.value);
              setGearItemId("");
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search by name, brand, or model..."
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {showDropdown && !gearItemId && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-[180px] overflow-y-auto rounded-lg border border-border bg-surface shadow-md">
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-text-tertiary">No items found</p>
                ) : (
                  filtered.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItem(item)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-text-tertiary">
                        {item.brand} {item.model}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "Scheduled" | "Repair")}
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Scheduled">Scheduled</option>
              <option value="Repair">Repair</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Scheduled Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-primary mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs to be done?"
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Estimated Cost</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Log Maintenance
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

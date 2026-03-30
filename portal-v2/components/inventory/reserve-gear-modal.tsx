"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { GearItem } from "@/types/domain";

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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [dateError, setDateError] = useState("");

  if (preselectedItem && gearItemId !== preselectedItem.id) {
    setGearItemId(preselectedItem.id);
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
        body: JSON.stringify({ gearItemId, startDate, endDate, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast("success", "Reservation created");
      setGearItemId("");
      setStartDate("");
      setEndDate("");
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
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Gear Item
          </label>
          <select
            value={gearItemId}
            onChange={(e) => setGearItemId(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select item...</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.brand} {item.model})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            min={today}
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setDateError(""); }}
          />
          <Input
            label="End Date"
            type="date"
            min={startDate || today}
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setDateError(""); }}
          />
        </div>
        {dateError && (
          <p className="text-xs text-red-600">{dateError}</p>
        )}
        <Input
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., For Spring Campaign shoot"
        />
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

"use client";

import { useState } from "react";
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
  const [type, setType] = useState<"Scheduled" | "Repair">("Scheduled");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

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
      setGearItemId("");
      setDescription("");
      setScheduledDate("");
      setCost("");
      setNotes("");
      onCreated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to log maintenance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Maintenance">
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
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.brand} {item.model})
              </option>
            ))}
          </select>
        </div>
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as "Scheduled" | "Repair")}
          options={[
            { value: "Scheduled", label: "Scheduled Maintenance" },
            { value: "Repair", label: "Repair" },
          ]}
        />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs to be done?"
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Scheduled Date"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
          <Input
            label="Estimated Cost"
            type="number"
            min={0}
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <Input
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
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

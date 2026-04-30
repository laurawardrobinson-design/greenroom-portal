"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { GearItem, AppUser } from "@/types/domain";
import useSWR from "swr";
import {
  defaultNextDueDate,
  MAINTENANCE_INTERVAL_LABELS,
  MAINTENANCE_TASKS,
} from "@/lib/constants/maintenance-defaults";

const usersFetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : []));

export function LogMaintenanceModal({
  open,
  onClose,
  items,
  preselectedItemId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  items: GearItem[];
  preselectedItemId?: string | null;
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
  const [nextDueDate, setNextDueDate] = useState("");
  const [nextDueTouched, setNextDueTouched] = useState(false);
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: rawUsers } = useSWR<AppUser[]>(
    open ? "/api/users" : null,
    usersFetcher
  );
  const users: AppUser[] = Array.isArray(rawUsers) ? rawUsers : [];

  const selectedItem = useMemo(
    () => items.find((i) => i.id === gearItemId) ?? null,
    [items, gearItemId]
  );
  const intervalLabel = selectedItem
    ? MAINTENANCE_INTERVAL_LABELS[selectedItem.category]
    : null;

  // Auto-fill "next due" from category default whenever a scheduled date or
  // item is set — until the user types in the field themselves.
  useEffect(() => {
    if (nextDueTouched) return;
    if (type !== "Scheduled") return;
    if (!selectedItem) return;
    const base = scheduledDate || new Date().toISOString().slice(0, 10);
    const computed = defaultNextDueDate(selectedItem.category, base);
    if (computed) setNextDueDate(computed);
  }, [selectedItem, scheduledDate, type, nextDueTouched]);

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

  // Reset when modal opens/closes; honor preselected item on open.
  useEffect(() => {
    if (!open) {
      setGearItemId("");
      setGearSearch("");
      setDescription("");
      setScheduledDate("");
      setNextDueDate("");
      setNextDueTouched(false);
      setCost("");
      setNotes("");
      setPerformedBy("");
      return;
    }
    if (preselectedItemId) {
      const found = items.find((i) => i.id === preselectedItemId);
      if (found) {
        setGearItemId(found.id);
        setGearSearch(`${found.name} (${found.brand} ${found.model})`);
      }
    }
  }, [open, preselectedItemId, items]);

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
          nextDueDate: type === "Scheduled" && nextDueDate ? nextDueDate : undefined,
          performedBy: performedBy || undefined,
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
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
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
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none"
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
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {type === "Scheduled" ? (
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Next Due
              </label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => {
                  setNextDueDate(e.target.value);
                  setNextDueTouched(true);
                }}
                placeholder={intervalLabel ?? ""}
                className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none"
              />
            </div>
          ) : (
            <div />
          )}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Performed By
            </label>
            <select
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none"
            >
              <option value="">Me (default)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-primary mb-1">Description</label>
          {selectedItem && MAINTENANCE_TASKS[selectedItem.category]?.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {MAINTENANCE_TASKS[selectedItem.category].map((task) => (
                <button
                  type="button"
                  key={task}
                  onClick={() => setDescription(task)}
                  className="rounded-full border border-border px-2 h-6 text-[10px] font-medium text-text-secondary hover:border-primary hover:text-primary transition-colors"
                >
                  {task}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs to be done?"
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
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
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
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

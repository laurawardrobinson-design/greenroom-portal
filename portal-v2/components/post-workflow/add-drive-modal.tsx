"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { DRIVE_SIZES, DRIVE_TYPES, DRIVE_CONDITIONS, DRIVE_LOCATIONS } from "@/lib/constants/edit-rooms";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDriveModal({ open, onClose, onSuccess }: Props) {
  const { toast } = useToast();

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [storageSize, setStorageSize] = useState("2 TB");
  const [driveType, setDriveType] = useState("Portable SSD");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [condition, setCondition] = useState("Good");
  const [location, setLocation] = useState("Corporate");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setBrand(""); setModel(""); setStorageSize("2 TB"); setDriveType("Portable SSD");
    setPurchaseDate(""); setCondition("Good"); setLocation("Corporate"); setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand || !storageSize || !driveType) {
      toast("error", "Brand, size and type are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/post-workflow/drives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          model: model || null,
          storageSize,
          driveType,
          purchaseDate: purchaseDate || null,
          condition,
          location,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast("error", d.error ?? "Failed to add drive.");
        return;
      }
      toast("success", "Drive added to inventory.");
      reset();
      onClose();
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add Hard Drive">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Brand</label>
            <Input placeholder="e.g. Samsung" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Model (optional)</label>
            <Input placeholder="e.g. T9" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Storage Size</label>
            <Select options={DRIVE_SIZES.map((s) => ({ value: s, label: s }))} value={storageSize} onChange={(e) => setStorageSize(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Drive Type</label>
            <Select options={DRIVE_TYPES.map((t) => ({ value: t, label: t }))} value={driveType} onChange={(e) => setDriveType(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Purchase Date</label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            <p className="mt-1 text-[11px] text-text-tertiary">Retirement date auto-calculated (+3 years)</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-primary">Condition</label>
            <Select options={DRIVE_CONDITIONS.map((c) => ({ value: c, label: c }))} value={condition} onChange={(e) => setCondition(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Location</label>
          <Select options={DRIVE_LOCATIONS.map((l) => ({ value: l, label: l }))} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">Notes (optional)</label>
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button variant="ghost" type="button" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? "Adding…" : "Add Drive"}</Button>
        </div>
      </form>
    </Modal>
  );
}

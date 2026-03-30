"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { RfidScanner } from "@/components/ui/rfid-scanner";
import { GEAR_CATEGORIES } from "@/lib/constants/categories";
import type { GearItem, GearCondition } from "@/types/domain";
import { Archive, Radio, X } from "lucide-react";

const CONDITIONS: GearCondition[] = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Damaged",
];

export function EditGearModal({
  item,
  open,
  onClose,
  onUpdated,
  onRetired,
}: {
  item: GearItem | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onRetired?: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [condition, setCondition] = useState<string>("Good");
  const [notes, setNotes] = useState("");
  const [rfidTag, setRfidTag] = useState<string | null>(null);
  const [assigningRfid, setAssigningRfid] = useState(false);
  const [savingRfid, setSavingRfid] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setBrand(item.brand);
      setModel(item.model);
      setSerialNumber(item.serialNumber);
      setCondition(item.condition);
      setNotes(item.notes || "");
      setRfidTag(item.rfidTag ?? null);
      setImageUrl(item.imageUrl || null);
      imageFileRef.current = null;
      setConfirmRetire(false);
      setAssigningRfid(false);
    }
  }, [item]);

  async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "gear");
    const res = await fetch("/api/upload-image", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image upload failed");
    return data.url;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !name.trim()) {
      toast("error", "Name is required");
      return;
    }
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFileRef.current) {
        finalImageUrl = await uploadImage(imageFileRef.current);
      }
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: item.id,
          name,
          category,
          brand,
          model,
          serialNumber,
          condition,
          notes,
          imageUrl: finalImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update item");
      toast("success", "Item updated");
      onUpdated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setSaving(false);
    }
  }

  async function handleRetire() {
    if (!item) return;
    if (!confirmRetire) {
      setConfirmRetire(true);
      return;
    }
    setRetiring(true);
    try {
      const res = await fetch(`/api/gear?id=${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retire item");
      toast("success", `${item.name} retired`);
      onRetired?.();
      onUpdated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to retire item");
    } finally {
      setRetiring(false);
      setConfirmRetire(false);
    }
  }

  const handleAssignRfid = useCallback(
    async (epc: string) => {
      if (!item) return;
      setAssigningRfid(false);
      setSavingRfid(true);
      try {
        const res = await fetch("/api/gear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "assign_rfid", id: item.id, rfidTag: epc }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to assign RFID tag");
        setRfidTag(epc);
        toast("success", "RFID tag assigned");
        onUpdated();
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Failed to assign RFID tag");
      } finally {
        setSavingRfid(false);
      }
    },
    [item, toast, onUpdated]
  );

  async function handleRemoveRfid() {
    if (!item) return;
    setSavingRfid(true);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_rfid", id: item.id, rfidTag: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove RFID tag");
      setRfidTag(null);
      toast("success", "RFID tag removed");
      onUpdated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to remove RFID tag");
    } finally {
      setSavingRfid(false);
    }
  }

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit Gear Item" size="md">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <ImageUpload
          value={imageUrl}
          onFileSelected={(file) => { imageFileRef.current = file; }}
          onRemove={() => { imageFileRef.current = null; setImageUrl(null); }}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={GEAR_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <Select
            label="Condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            options={CONDITIONS.map((c) => ({ value: c, label: c }))}
          />
          <Input
            label="Brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
          <Input
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <Input
            label="Serial Number"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
          <Input
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* RFID Tag */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
              <Radio className="h-3.5 w-3.5 text-text-tertiary" />
              RFID Tag
            </label>
            {rfidTag && !assigningRfid && (
              <button
                type="button"
                onClick={handleRemoveRfid}
                disabled={savingRfid}
                className="text-xs text-text-tertiary hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {assigningRfid ? (
            <div className="space-y-2">
              <RfidScanner
                active={true}
                onScan={handleAssignRfid}
                hint="Hold item near reader to assign its EPC tag"
              />
              <button
                type="button"
                onClick={() => setAssigningRfid(false)}
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          ) : rfidTag ? (
            <div className="flex items-center justify-between gap-2">
              <code className="flex-1 truncate rounded bg-surface-secondary px-2 py-1 text-xs font-mono text-text-secondary">
                {rfidTag}
              </code>
              <button
                type="button"
                onClick={() => setAssigningRfid(true)}
                disabled={savingRfid}
                className="shrink-0 text-xs text-primary hover:underline"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAssigningRfid(true)}
              disabled={savingRfid}
              className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-text-tertiary hover:border-primary hover:text-primary transition-colors"
            >
              {savingRfid ? "Saving…" : "+ Assign RFID Tag"}
            </button>
          )}
        </div>

        <ModalFooter>
          {item?.status !== "Retired" && (
            <Button
              type="button"
              variant="ghost"
              loading={retiring}
              onClick={handleRetire}
              className={confirmRetire ? "text-red-600 hover:text-red-700" : "text-text-tertiary"}
            >
              <Archive className="h-3.5 w-3.5" />
              {confirmRetire ? "Confirm Retire?" : "Retire"}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}

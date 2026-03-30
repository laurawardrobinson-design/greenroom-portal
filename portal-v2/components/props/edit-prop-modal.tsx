"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { PROPS_CATEGORIES } from "@/lib/constants/categories";
import type { GearItem, GearCondition } from "@/types/domain";
import { Archive } from "lucide-react";

const CONDITIONS: GearCondition[] = ["Excellent", "Good", "Fair", "Poor", "Damaged"];

export function EditPropModal({
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
  const [condition, setCondition] = useState<string>("Good");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setBrand(item.brand);
      setCondition(item.condition);
      setNotes(item.notes || "");
      setImageUrl(item.imageUrl || null);
      imageFileRef.current = null;
      setConfirmRetire(false);
    }
  }, [item]);

  async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "props");
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
          condition,
          notes,
          imageUrl: finalImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update prop");
      toast("success", "Prop updated");
      onUpdated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update prop");
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
      if (!res.ok) throw new Error(data.error || "Failed to retire prop");
      toast("success", `${item.name} retired`);
      onRetired?.();
      onUpdated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to retire prop");
    } finally {
      setRetiring(false);
      setConfirmRetire(false);
    }
  }

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit Prop" size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <ImageUpload
          value={imageUrl}
          onFileSelected={(file) => { imageFileRef.current = file; }}
          onRemove={() => { imageFileRef.current = null; setImageUrl(null); }}
        />
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={PROPS_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <Select
            label="Condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            options={CONDITIONS.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <Input
          label="Brand / Source"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <ModalFooter>
          {item.status !== "Retired" && (
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
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Changes</Button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}

"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { PROPS_CATEGORIES } from "@/lib/constants/categories";

export function AddPropModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(PROPS_CATEGORIES[0]);
  const [brand, setBrand] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageFileRef = useRef<File | null>(null);

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
    if (!name.trim()) {
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
          name,
          category,
          brand,
          purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
          notes,
          imageUrl: finalImageUrl || undefined,
          section: "Props",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add prop");
      toast("success", "Prop added");
      setName("");
      setCategory(PROPS_CATEGORIES[0]);
      setBrand("");
      setPurchasePrice("");
      setNotes("");
      setImageUrl(null);
      imageFileRef.current = null;
      onCreated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to add prop");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Prop" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
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
          placeholder="e.g., White Marble Slab"
        />
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={PROPS_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Input
          label="Brand / Source"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Where it came from"
        />
        <Input
          label="Value"
          type="number"
          min={0}
          step="0.01"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="0.00"
        />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Handling notes, storage location, condition details..."
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add Prop
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

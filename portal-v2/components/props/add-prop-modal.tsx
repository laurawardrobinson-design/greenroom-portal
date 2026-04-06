"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { PROPS_CATEGORIES } from "@/lib/constants/categories";
import { X } from "lucide-react";

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
  const [category, setCategory] = useState<string>("");
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
          category: category || "Other",
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
      setCategory("");
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
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prop name"
            className="text-lg font-semibold text-text-primary bg-transparent flex-1 min-w-0 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image + Notes side by side */}
        <div className="flex gap-3 items-start">
          <ImageUpload
            value={imageUrl}
            onFileSelected={(file) => { imageFileRef.current = file; }}
            onRemove={() => { imageFileRef.current = null; setImageUrl(null); }}
          />
          <div className="flex-1">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Handling notes, storage location, condition details..."
              rows={4}
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Category</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-transparent text-sm text-text-primary focus:outline-none cursor-pointer"
          >
            <option value="">Select category...</option>
            {PROPS_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Brand / Value */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Brand / Source</p>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Where it came from"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Value</p>
            <input
              type="number"
              min={0}
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" loading={saving} className="flex-1">Add Prop</Button>
        </div>
      </form>
    </Modal>
  );
}

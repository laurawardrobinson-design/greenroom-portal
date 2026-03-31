"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { useToast } from "@/components/ui/toast";
import { GEAR_CATEGORIES } from "@/lib/constants/categories";
import { Link2, Loader2, CheckCircle2 } from "lucide-react";

export function AddGearModal({
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
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageFileRef = useRef<File | null>(null);

  const [pcomUrl, setPcomUrl] = useState("");
  const [pcomFetching, setPcomFetching] = useState(false);
  const [pcomFetched, setPcomFetched] = useState(false);
  const [pcomImportedFields, setPcomImportedFields] = useState<string[]>([]);
  const [pcomError, setPcomError] = useState("");

  async function handlePcomImport() {
    if (!pcomUrl.trim()) return;
    setPcomFetching(true);
    setPcomError("");
    setPcomFetched(false);
    try {
      const res = await fetch("/api/scrape-pcom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pcomUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setPcomError(data.error || "Could not fetch product info."); return; }
      const imported: string[] = [];
      if (data.name) { setName(data.name); imported.push("name"); }
      if (data.imageUrl) { setImageUrl(data.imageUrl); imported.push("image"); }
      setPcomImportedFields(imported);
      setPcomFetched(true);
    } catch {
      setPcomError("Something went wrong. Check the link and try again.");
    } finally {
      setPcomFetching(false);
    }
  }

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
          model,
          serialNumber,
          purchaseDate: purchaseDate || undefined,
          purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
          imageUrl: finalImageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item");
      toast("success", "Gear item added");
      setName("");
      setCategory("");
      setBrand("");
      setModel("");
      setSerialNumber("");
      setPurchaseDate("");
      setPurchasePrice("");
      setImageUrl(null);
      imageFileRef.current = null;
      onCreated();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Gear Item" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={`rounded-xl border p-3.5 space-y-3 ${pcomFetched ? "border-emerald-200 bg-emerald-50" : "border-border bg-surface-secondary"}`}>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-text-primary">Add from Pcom</span>
            {pcomFetched && <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto shrink-0" />}
          </div>
          <p className="text-xs text-text-secondary">Paste a Publix.com product link and we'll fill in what we can automatically.</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={pcomUrl}
              onChange={(e) => { setPcomUrl(e.target.value); setPcomFetched(false); setPcomError(""); }}
              placeholder="https://www.publix.com/pd/..."
              className="flex-1 h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handlePcomImport}
              disabled={pcomFetching || !pcomUrl.trim()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            >
              {pcomFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {pcomFetching ? "Fetching…" : "Import"}
            </button>
          </div>
          {pcomError && <p className="text-xs text-red-600">{pcomError}</p>}
          {pcomFetched && (
            <p className="text-xs text-emerald-700 font-medium">
              Imported: {pcomImportedFields.join(", ")}.
              {!pcomImportedFields.includes("image") && " Add an image manually below."}
            </p>
          )}
        </div>
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
          placeholder="e.g., Canon R5 Body"
        />
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Select category..."
          options={GEAR_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Canon"
          />
          <Input
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="EOS R5"
          />
        </div>
        <Input
          label="Serial Number"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Purchase Date"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
          <Input
            label="Purchase Price"
            type="number"
            min={0}
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Add Item
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

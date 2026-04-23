"use client";

import { useState, useEffect, useRef } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PROPS_CATEGORIES } from "@/lib/constants/categories";
import type { GearItem, GearCondition, GearStatus } from "@/types/domain";
import { Camera, Pencil, Trash2, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

const STATUS_BADGE: Record<string, string> = {
  Available: "bg-emerald-50 text-success",
  Reserved: "bg-blue-50 text-blue-700",
  "Checked Out": "bg-amber-50 text-warning",
  "Under Maintenance": "bg-purple-50 text-purple-700",
  "In Repair": "bg-red-50 text-error",
};

const CONDITION_BADGE: Record<string, string> = {
  Excellent: "bg-emerald-50 text-success",
  Good: "bg-blue-50 text-blue-700",
  Fair: "bg-amber-50 text-warning",
  Poor: "bg-orange-50 text-warning",
  Damaged: "bg-red-50 text-error",
};

const CONDITIONS: GearCondition[] = ["Excellent", "Good", "Fair", "Poor", "Damaged"];

const STATUSES: GearStatus[] = [
  "Available",
  "Reserved",
  "Checked Out",
  "Under Maintenance",
  "In Repair",
];

export function PropDetailModal({
  item,
  open,
  onClose,
  onSaved,
  onDeleted,
  canEdit = true,
}: {
  item: GearItem | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
  canEdit?: boolean;
}) {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState<string>("Good");
  const [status, setStatus] = useState<string>("Available");
  const [notes, setNotes] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setBrand(item.brand);
      setCondition(item.condition);
      setStatus(item.status);
      setNotes(item.notes || "");
      setPurchasePrice(item.purchasePrice > 0 ? String(item.purchasePrice) : "");
      setImageUrl(item.imageUrl || null);
      imageFileRef.current = null;
      setEditMode(false);
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

  async function handleSave() {
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
          status,
          notes,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : 0,
          imageUrl: finalImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update prop");
      toast("success", "Prop updated");
      onSaved?.();
      setEditMode(false);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update prop");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setBrand(item.brand);
      setCondition(item.condition);
      setStatus(item.status);
      setNotes(item.notes || "");
      setPurchasePrice(item.purchasePrice > 0 ? String(item.purchasePrice) : "");
      setImageUrl(item.imageUrl || null);
      imageFileRef.current = null;
    }
    setEditMode(false);
  }

  async function handleDelete() {
    if (!item) return;
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/gear/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete prop");
      toast("success", "Prop deleted");
      onDeleted?.();
      onClose();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to delete prop");
    } finally {
      setDeleting(false);
    }
  }

  if (!item) return null;

  return (
    <Modal open={open} onClose={onClose} title={item.name} size="md">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="space-y-4">
        {/* ── Image ── */}
        <div className="relative">
          {imageUrl ? (
            <img src={imageUrl} alt={item.name} className="h-40 w-full rounded-xl object-cover" />
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-xl bg-surface-tertiary">
              <Camera className="h-8 w-8 text-text-tertiary" />
            </div>
          )}
          {editMode && (
            <>
              <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      imageFileRef.current = file;
                      setImageUrl(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => { imageFileRef.current = null; setImageUrl(null); }}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Status / condition / category row ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status */}
          {editMode ? (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`appearance-none cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium outline-none ${STATUS_BADGE[status] || "bg-surface-secondary text-text-secondary"}`}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <Badge variant="custom" className={STATUS_BADGE[status] || ""}>
              {status}
            </Badge>
          )}
          {/* Condition */}
          {editMode ? (
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className={`appearance-none cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium outline-none ${CONDITION_BADGE[condition] || "bg-surface-secondary text-text-secondary"}`}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <Badge variant="custom" className={CONDITION_BADGE[condition] || ""}>
              {condition}
            </Badge>
          )}
          {/* Category */}
          {editMode ? (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none cursor-pointer rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary outline-none"
            >
              {PROPS_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <Badge variant="default">{category}</Badge>
          )}
        </div>

        {/* ── Detail grid ── */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="col-span-2">
            <p className="text-text-tertiary text-xs mb-0.5">Name</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={!editMode}
              required
              className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
            />
          </div>
          <div className="col-span-2">
            <p className="text-text-tertiary text-xs mb-0.5">Brand / Source</p>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              readOnly={!editMode}
              className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
            />
          </div>
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Value</p>
            <input
              value={editMode ? purchasePrice : (item.purchasePrice > 0 ? formatCurrency(item.purchasePrice) : "—")}
              onChange={(e) => setPurchasePrice(e.target.value)}
              readOnly={!editMode}
              placeholder={editMode ? "0.00" : undefined}
              className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
            />
          </div>
        </div>

        {/* ── Notes ── */}
        <div>
          <p className="text-text-tertiary text-xs mb-0.5">Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            readOnly={!editMode}
            rows={2}
            className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 resize-none outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
          />
        </div>

        {/* ── Footer ── */}
        <ModalFooter>
          {editMode ? (
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>
              <Button type="button" onClick={handleSave} loading={saving}>Save Changes</Button>
            </div>
          ) : (
            canEdit && (
              <div className="flex items-center justify-between w-full">
                <Button type="button" variant="ghost" size="sm" onClick={handleDelete} loading={deleting}
                  className="text-red-500 hover:text-error hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                {onSaved && (
                  <Button type="button" size="sm" onClick={() => setEditMode(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>
            )
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
}

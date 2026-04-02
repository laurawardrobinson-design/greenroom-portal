"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { RfidScanner } from "@/components/ui/rfid-scanner";
import { GEAR_CATEGORIES } from "@/lib/constants/categories";
import type { GearItem, GearCondition } from "@/types/domain";
import { Camera, QrCode, Printer, X, Pencil, Archive, Radio } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

const STATUS_BADGE: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700",
  Reserved: "bg-blue-50 text-blue-700",
  "Checked Out": "bg-amber-50 text-amber-700",
  "Under Maintenance": "bg-purple-50 text-purple-700",
  "In Repair": "bg-red-50 text-red-600",
  Retired: "bg-slate-100 text-slate-500",
};

const CONDITION_BADGE: Record<string, string> = {
  Excellent: "bg-emerald-50 text-emerald-700",
  Good: "bg-blue-50 text-blue-700",
  Fair: "bg-amber-50 text-amber-700",
  Poor: "bg-orange-50 text-orange-700",
  Damaged: "bg-red-50 text-red-600",
};

const CONDITIONS: GearCondition[] = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Damaged",
];

export function GearDetailModal({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: GearItem | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [condition, setCondition] = useState<string>("Good");
  const [notes, setNotes] = useState("");
  const [rfidTag, setRfidTag] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageFileRef = useRef<File | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [assigningRfid, setAssigningRfid] = useState(false);
  const [savingRfid, setSavingRfid] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setBrand(item.brand);
      setModel(item.model);
      setSerialNumber(item.serialNumber);
      setQrCode(item.qrCode);
      setPurchasePrice(item.purchasePrice > 0 ? String(item.purchasePrice) : "");
      setCondition(item.condition);
      setNotes(item.notes || "");
      setRfidTag(item.rfidTag ?? null);
      setImageUrl(item.imageUrl || null);
      imageFileRef.current = null;
      setConfirmRetire(false);
      setAssigningRfid(false);
      setEditMode(false);
    }
  }, [item]);

  function resetForm() {
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setBrand(item.brand);
    setModel(item.model);
    setSerialNumber(item.serialNumber);
    setQrCode(item.qrCode);
    setPurchasePrice(item.purchasePrice > 0 ? String(item.purchasePrice) : "");
    setCondition(item.condition);
    setNotes(item.notes || "");
    setRfidTag(item.rfidTag ?? null);
    setImageUrl(item.imageUrl || null);
    imageFileRef.current = null;
    setConfirmRetire(false);
    setAssigningRfid(false);
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
          qrCode,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : 0,
          condition,
          notes,
          imageUrl: finalImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update item");
      toast("success", "Item updated");
      onSaved?.();
      setEditMode(false);
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
      onSaved?.();
      onClose();
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
        onSaved?.();
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Failed to assign RFID tag");
      } finally {
        setSavingRfid(false);
      }
    },
    [item, toast, onSaved]
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
      onSaved?.();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to remove RFID tag");
    } finally {
      setSavingRfid(false);
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Image ── always h-40, edit mode adds click-to-change overlay */}
        <div className="relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              className="h-40 w-full rounded-xl object-cover"
            />
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

        {/* ── Status / condition / category row ── always same layout */}
        <div className="flex items-center gap-2">
          {/* Status — always read-only */}
          <Badge variant="custom" className={STATUS_BADGE[item.status] || ""}>
            {item.status}
          </Badge>
          {/* Condition — badge in view, badge-styled select in edit */}
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
            <Badge variant="custom" className={CONDITION_BADGE[item.condition] || ""}>
              {item.condition}
            </Badge>
          )}
          {/* Category — badge in view, badge-styled select in edit */}
          {editMode ? (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none cursor-pointer rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary outline-none"
            >
              {GEAR_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <Badge variant="default">{item.category}</Badge>
          )}
        </div>

        {/* ── Detail grid — always same elements, readOnly toggles ── */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {/* Name */}
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

          {/* Brand */}
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Brand</p>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              readOnly={!editMode}
              className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
            />
          </div>

          {/* Model */}
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Model</p>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              readOnly={!editMode}
              className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
            />
          </div>

          {/* Serial Number */}
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Serial Number</p>
            <input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              readOnly={!editMode}
              className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
            />
          </div>

          {/* QR Code */}
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">QR Code</p>
            <input
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              readOnly={!editMode}
              className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
            />
          </div>

          {/* Purchase Price */}
          <div>
            <p className="text-text-tertiary text-xs mb-0.5">Purchase Price</p>
            <input
              value={editMode ? purchasePrice : (item.purchasePrice > 0 ? formatCurrency(item.purchasePrice) : "—")}
              onChange={(e) => setPurchasePrice(e.target.value)}
              readOnly={!editMode}
              placeholder={editMode ? "0.00" : undefined}
              className={`w-full bg-transparent text-text-primary font-medium text-sm p-0 outline-none border-b ${editMode ? "border-dashed border-border focus:border-primary" : "border-transparent cursor-default"}`}
            />
          </div>
        </div>

        {/* ── Notes ── always a textarea, readOnly toggles */}
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

        {/* ── RFID Tag ── */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
              <Radio className="h-3.5 w-3.5 text-text-tertiary" />
              RFID Tag
            </label>
            {editMode && rfidTag && !assigningRfid && (
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
              {editMode && (
                <button
                  type="button"
                  onClick={() => setAssigningRfid(true)}
                  disabled={savingRfid}
                  className="shrink-0 text-xs text-primary hover:underline"
                >
                  Replace
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-text-tertiary">No tag assigned</p>
              {editMode && (
                <button
                  type="button"
                  onClick={() => setAssigningRfid(true)}
                  disabled={savingRfid}
                  className="text-xs text-primary hover:underline"
                >
                  Assign
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <ModalFooter>
          {editMode ? (
            <>
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { resetForm(); setEditMode(false); }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  Save Changes
                </Button>
              </div>
            </>
          ) : (
            <>
              {onSaved && (
                <Button type="button" size="sm" onClick={() => setEditMode(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => window.open(`/gear/print?ids=${item.id}`, "_blank")}
              >
                <Printer className="h-3.5 w-3.5" />
                Print QR Label
              </Button>
            </>
          )}
        </ModalFooter>
      </form>
    </Modal>
  );
}

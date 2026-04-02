"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import useSWR from "swr";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { RfidScanner } from "@/components/ui/rfid-scanner";
import { GEAR_CATEGORIES } from "@/lib/constants/categories";
import type { GearItem, GearCondition, GearMaintenance } from "@/types/domain";
import { Camera, QrCode, Printer, X, Pencil, Radio, MessageSquare, Send, Wrench } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { formatDistanceToNow, parseISO, format } from "date-fns";

const noteFetcher = (url: string) =>
  fetch(url).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });

interface GearNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700",
  Reserved: "bg-blue-50 text-blue-700",
  "Checked Out": "bg-amber-50 text-amber-700",
  "Under Maintenance": "bg-purple-50 text-purple-700",
  "In Repair": "bg-red-50 text-red-600",
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
  const { user: currentUser } = useCurrentUser();
  const [editMode, setEditMode] = useState(false);

  // Maintenance logs
  const { data: maintenanceLogs } = useSWR<GearMaintenance[]>(
    item ? `/api/gear/maintenance?gearItemId=${item.id}` : null,
    noteFetcher
  );

  // User notes
  const { data: gearNotes, mutate: mutateNotes } = useSWR<GearNote[]>(
    item ? `/api/gear/${item.id}/notes` : null,
    noteFetcher
  );
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function handleAddNote() {
    if (!item || !newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/gear/${item.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNote.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setNewNote("");
      mutateNotes();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!item) return;
    try {
      await fetch(`/api/gear/${item.id}/notes/${noteId}`, { method: "DELETE" });
      mutateNotes();
    } catch {
      toast("error", "Failed to delete note");
    }
  }

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

        {/* ── User Notes ── */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
            <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Notes
            </span>
            {gearNotes && gearNotes.length > 0 && (
              <span className="text-[10px] text-text-tertiary ml-auto">{gearNotes.length}</span>
            )}
          </div>
          <div className="px-3.5 py-3 space-y-3">
            {gearNotes && gearNotes.length > 0 ? (
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
                {gearNotes.map((n) => (
                  <div key={n.id} className="group flex gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {n.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-medium text-text-primary">{n.authorName}</span>
                        <span className="text-[10px] text-text-tertiary">
                          {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5 break-words">{n.text}</p>
                    </div>
                    {currentUser && n.authorId === currentUser.id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(n.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:text-red-500 transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">No notes yet</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                placeholder="Add a note..."
                className="flex-1 h-8 rounded-lg border border-border bg-surface px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!newNote.trim() || addingNote}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-40 hover:bg-primary-hover transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Maintenance Log ── */}
        {maintenanceLogs && maintenanceLogs.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <Wrench className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                Maintenance History
              </span>
              <span className="text-[10px] text-text-tertiary ml-auto">{maintenanceLogs.length}</span>
            </div>
            <div className="divide-y divide-border max-h-[160px] overflow-y-auto">
              {maintenanceLogs.map((m) => {
                const statusColor: Record<string, string> = {
                  Scheduled: "text-blue-600",
                  "In Progress": "text-amber-600",
                  "Sent for Repair": "text-purple-600",
                  Completed: "text-emerald-600",
                  Cancelled: "text-slate-400",
                };
                return (
                  <div key={m.id} className="px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-text-primary truncate">{m.description}</p>
                      <span className={`text-[10px] font-medium shrink-0 ${statusColor[m.status] || "text-text-secondary"}`}>
                        {m.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-tertiary mt-0.5">
                      {m.type}
                      {m.scheduledDate && ` · ${format(parseISO(m.scheduledDate), "MMM d, yyyy")}`}
                      {m.cost > 0 && ` · ${formatCurrency(m.cost)}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

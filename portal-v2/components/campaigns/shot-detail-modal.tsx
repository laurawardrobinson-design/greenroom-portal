"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Crosshair, Trash2, Plus, X, ShoppingBasket, Camera, Upload } from "lucide-react";
import { ShotProductPicker } from "@/components/campaigns/shot-product-picker";
import { ShotPropsPicker } from "@/components/campaigns/shot-props-picker";
import type { ShotListShot, CampaignProduct } from "@/types/domain";

const MEDIA_TYPE_OPTIONS = ["Still", "Video", "Stop Motion"];
const LOCATION_OPTIONS = ["White seamless", "Lifestyle: Studio", "Lifestyle: Location"];
const ANGLE_OPTIONS = ["Straight on", "Overhead", "3/4", "Various (video)"];

const SELECT_CLASS = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary focus:outline-none appearance-none cursor-pointer";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-text-secondary mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function InlineField({ label, value, onChange, placeholder }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }
  return (
    <div className="flex gap-2 items-start border-b border-border/60 py-1.5">
      <label className="text-[11px] font-semibold text-text-secondary pt-px shrink-0 w-24">{label}</label>
      <textarea
        value={value}
        onChange={(e) => { onChange(e); autoResize(e.target); }}
        onFocus={(e) => autoResize(e.target)}
        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
        placeholder={placeholder}
        rows={1}
        className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary/50 focus:outline-none resize-none overflow-hidden py-0"
      />
    </div>
  );
}

export function ShotDetailModal({
  shot,
  open,
  onClose,
  onSaved,
  campaignProducts = [],
  wfNumber,
  shotIndex,
}: {
  shot: ShotListShot;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  campaignProducts?: CampaignProduct[];
  wfNumber?: string;
  shotIndex?: number;
}) {
  const { toast } = useToast();
  // Auto-generated file name: WF######_Shot##
  const fileName = wfNumber && shotIndex
    ? `${wfNumber.replace(/\s/g, "")}_Shot${String(shotIndex).padStart(2, "0")}`
    : null;
  const [name, setName] = useState(shot.name);
  const [mediaType, setMediaType] = useState(shot.mediaType || "");
  const [location, setLocation] = useState(shot.location || "");
  const [angle, setAngle] = useState(shot.angle || "");
  const [description, setDescription] = useState(shot.description || "");
  const [notes, setNotes] = useState(shot.notes || "");
  const [talent, setTalent] = useState(shot.talent || "");
  const [props, setProps] = useState(shot.props || "");
  const [wardrobe, setWardrobe] = useState(shot.wardrobe || "");
  const [surface, setSurface] = useState(shot.surface || "");
  const [lighting, setLighting] = useState(shot.lighting || "");
  const [retouchingNotes, setRetouchingNotes] = useState(shot.retouchingNotes || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const [linkedProductIds, setLinkedProductIds] = useState<Set<string>>(
    new Set(shot.productLinks?.map((l) => l.campaignProductId) || [])
  );

  const [refUploading, setRefUploading] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(shot.name);
      setConfirmDelete(false);
      setMediaType(shot.mediaType || "");
      setLocation(shot.location || "");
      setAngle(shot.angle || "");
      setDescription(shot.description || "");
      setNotes(shot.notes || "");
      setTalent(shot.talent || "");
      setProps(shot.props || "");
      setWardrobe(shot.wardrobe || "");
      setSurface(shot.surface || "");
      setLighting(shot.lighting || "");
      setRetouchingNotes(shot.retouchingNotes || "");
      setLinkedProductIds(new Set(shot.productLinks?.map((l) => l.campaignProductId) || []));
      setShowProductPicker(false);
    }
  }, [open, shot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleProduct(cpId: string) {
    const isLinked = linkedProductIds.has(cpId);
    setLinkedProductIds((prev) => {
      const next = new Set(prev);
      if (isLinked) next.delete(cpId); else next.add(cpId);
      return next;
    });
    try {
      await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignProductId: cpId,
          action: isLinked ? "unlink" : "link",
        }),
      });
    } catch {
      setLinkedProductIds((prev) => {
        const next = new Set(prev);
        if (isLinked) next.add(cpId); else next.delete(cpId);
        return next;
      });
      toast("error", "Failed to update product link");
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/shot-list/shots/${shot.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      onSaved();
      onClose();
    } catch {
      toast("error", "Failed to delete shot");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("error", "Shot name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mediaType,
          location,
          angle,
          description: description.trim(),
          notes: notes.trim(),
          talent: talent.trim(),
          props: props.trim(),
          wardrobe: wardrobe.trim(),
          surface: surface.trim(),
          lighting: lighting.trim(),
          retouchingNotes: retouchingNotes.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      onSaved();
      onClose();
    } catch {
      toast("error", "Failed to save shot");
    } finally {
      setSaving(false);
    }
  }

  const linkedProducts = campaignProducts.filter((cp) => linkedProductIds.has(cp.id));

  async function uploadRefImage(file: File) {
    if (!file.type.startsWith("image/")) { toast("error", "Please select an image"); return; }
    setRefUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("campaignId", shot.campaignId);
      fd.append("category", "reference");
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageUrl: data.url }),
      });
      onSaved();
    } catch { toast("error", "Upload failed"); }
    finally { setRefUploading(false); }
  }

  async function removeRefImage() {
    await fetch(`/api/shot-list/shots/${shot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceImageUrl: null }),
    });
    onSaved();
  }

  return (
    <>
      <Modal open={open} onClose={onClose} size="lg">
        <form onSubmit={handleSubmit} className="space-y-1.5">
          {/* Header: Shot name + file name + reference image */}
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Crosshair className="h-4 w-4 shrink-0 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Shot</h2>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shot name…"
                className="w-full text-sm font-semibold text-text-primary bg-transparent border-none outline-none focus:ring-0 p-0 placeholder:text-text-tertiary/40"
              />
              {fileName && (
                <p className="text-[11px] text-text-tertiary mt-0.5">{fileName}</p>
              )}
            </div>

            {/* Reference image — square, like inventory */}
            <div className="shrink-0">
              <input ref={refInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRefImage(f); e.target.value = ""; }} />
              {shot.referenceImageUrl ? (
                <div className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.referenceImageUrl}
                    alt="Reference"
                    onClick={() => window.open(shot.referenceImageUrl!, "_blank")}
                    className="h-16 w-16 rounded-lg object-cover border border-border cursor-zoom-in hover:opacity-90 transition-opacity"
                  />
                  <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={() => refInputRef.current?.click()}
                      className="rounded bg-white/90 p-1 text-text-primary hover:bg-white transition-colors">
                      <Camera className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={removeRefImage}
                      className="rounded bg-white/90 p-1 text-red-600 hover:bg-white transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => refInputRef.current?.click()}
                  className={`flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    refUploading ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-primary/3"
                  }`}>
                  {refUploading
                    ? <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    : <Upload className="h-4 w-4 text-text-tertiary" />}
                </button>
              )}
              <p className="text-[10px] text-text-tertiary text-center mt-0.5">Ref image</p>
            </div>
          </div>

          {/* Row 2: Type / Angle / Environment */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type">
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} className={SELECT_CLASS}>
                <option value="">—</option>
                {MEDIA_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Angle">
              <select value={angle} onChange={(e) => setAngle(e.target.value)} className={SELECT_CLASS}>
                <option value="">—</option>
                {ANGLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Environment">
              <select value={location} onChange={(e) => setLocation(e.target.value)} className={SELECT_CLASS}>
                <option value="">—</option>
                {LOCATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          {/* Products */}
          <Field label="Products">
            <div className="space-y-1.5">
              {linkedProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {linkedProducts.map((cp) => (
                    <span key={cp.id}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                      <ShoppingBasket className="h-3 w-3" />
                      {cp.product?.name || "Product"}
                      {cp.product?.itemCode && (
                        <span className="opacity-70 text-[10px]">{cp.product.itemCode}</span>
                      )}
                      <button type="button" onClick={() => toggleProduct(cp.id)}
                        className="ml-0.5 hover:text-red-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setShowProductPicker(true)}
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-primary transition-colors">
                <Plus className="h-3 w-3" />
                {linkedProducts.length > 0 ? "Manage products" : "Add products from library"}
              </button>
            </div>
          </Field>

          {/* Inline text fields — ordered how an AD thinks through a shot */}
          <div className="rounded-lg border border-border overflow-hidden">
            <InlineField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shot concept and composition…" />

            {/* Surface — searchable from props library (Surfaces & Backgrounds category) */}
            <div className="flex gap-2 items-start border-b border-border/60 py-1.5 px-0">
              <label className="text-[11px] font-semibold text-text-secondary pt-px shrink-0 w-24 pl-0">Surface</label>
              <div className="flex-1 min-w-0">
                <ShotPropsPicker
                  mode="surface"
                  value={surface}
                  onChange={setSurface}
                  placeholder="Marble, wood, paper…"
                />
              </div>
            </div>

            {/* Props — searchable from props library */}
            <div className="flex gap-2 items-start border-b border-border/60 py-1.5 px-0">
              <label className="text-[11px] font-semibold text-text-secondary pt-px shrink-0 w-24 pl-0">Props</label>
              <div className="flex-1 min-w-0">
                <ShotPropsPicker
                  mode="props"
                  value={props}
                  onChange={setProps}
                  placeholder="Styling elements…"
                />
              </div>
            </div>
            <InlineField label="Lighting" value={lighting} onChange={(e) => setLighting(e.target.value)} placeholder="Natural, studio strobe, moody…" />
            <InlineField label="Talent" value={talent} onChange={(e) => setTalent(e.target.value)} placeholder="Who's in this shot…" />
            <InlineField label="Wardrobe" value={wardrobe} onChange={(e) => setWardrobe(e.target.value)} placeholder="What they're wearing…" />
            <InlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions…" />
            <InlineField label="Retouching" value={retouchingNotes} onChange={(e) => setRetouchingNotes(e.target.value)} placeholder="Post-production needs…" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-0.5">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-500">Delete this shot?</span>
                <button type="button" onClick={handleDelete}
                  className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors">
                  Yes, delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="text-xs text-text-tertiary hover:text-text-secondary transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-red-500 transition-colors">
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" loading={saving}>Save Shot</Button>
            </div>
          </div>
        </form>
      </Modal>

      <ShotProductPicker
        open={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        shotId={shot.id}
        campaignId={shot.campaignId}
        linkedProductIds={linkedProductIds}
        onToggle={toggleProduct}
        onProductCreatedAndLinked={onSaved}
      />
    </>
  );
}

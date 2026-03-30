"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Crosshair, Trash2 } from "lucide-react";
import type { ShotListShot } from "@/types/domain";

const MEDIA_TYPE_OPTIONS = ["Stills", "Video", "Hybrid"];
const LOCATION_OPTIONS = ["Studio", "Lifestyle", "Store"];
const ANGLE_OPTIONS = ["Hero", "Detail", "Overhead", "3/4", "Flat Lay", "Side"];

const TEXTAREA_CLASS = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function ShotDetailModal({
  shot,
  open,
  onClose,
  onSaved,
}: {
  shot: ShotListShot;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(shot.name);
  const [mediaType, setMediaType] = useState(shot.mediaType || "");
  const [location, setLocation] = useState(shot.location || "");
  const [angle, setAngle] = useState(shot.angle || "");
  const [description, setDescription] = useState(shot.description || "");
  const [notes, setNotes] = useState(shot.notes || "");
  const [talent, setTalent] = useState(shot.talent || "");
  const [props, setProps] = useState(shot.props || "");
  const [wardrobe, setWardrobe] = useState(shot.wardrobe || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    }
  }, [open, shot.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          angle: angle.trim(),
          description: description.trim(),
          notes: notes.trim(),
          talent: talent.trim(),
          props: props.trim(),
          wardrobe: wardrobe.trim(),
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

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Crosshair className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Shot</h2>
        </div>

        {/* Full-width: name */}
        <Field label="Shot Name">
          <Input placeholder="e.g., WF123456-Shot01" value={name}
            onChange={(e) => setName(e.target.value)} className="text-xs py-1.5" />
        </Field>

        {/* Full-width: selectors */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Media Type">
            <div className="flex gap-1.5">
              {MEDIA_TYPE_OPTIONS.map((opt) => (
                <button key={opt} type="button"
                  onClick={() => setMediaType(mediaType === opt ? "" : opt)}
                  className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                    mediaType === opt
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Location">
            <div className="flex gap-1.5 items-center">
              {LOCATION_OPTIONS.map((opt) => (
                <button key={opt} type="button"
                  onClick={() => setLocation(location === opt ? "" : opt)}
                  className={`shrink-0 px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                    location === opt
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
                  }`}>
                  {opt}
                </button>
              ))}
              <input type="text"
                value={LOCATION_OPTIONS.includes(location) ? "" : location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Other…"
                className={`w-16 min-w-0 px-2 py-1 rounded-md text-sm border transition-colors bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary ${
                  location && !LOCATION_OPTIONS.includes(location) ? "border-primary" : "border-border"
                }`}
              />
            </div>
          </Field>
        </div>

        {/* Angle selector — full width */}
        <Field label="Angle">
          <div className="flex gap-1.5 flex-wrap">
            {ANGLE_OPTIONS.map((opt) => (
              <button key={opt} type="button"
                onClick={() => setAngle(angle === opt ? "" : opt)}
                className={`px-3 py-1 rounded-md text-sm font-medium border transition-colors ${
                  angle === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-secondary hover:border-primary/40 hover:text-primary"
                }`}>
                {opt}
              </button>
            ))}
            <input type="text"
              value={ANGLE_OPTIONS.includes(angle) ? "" : angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="Other…"
              className={`w-20 min-w-0 px-2 py-1 rounded-md text-sm border transition-colors bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary ${
                angle && !ANGLE_OPTIONS.includes(angle) ? "border-primary" : "border-border"
              }`}
            />
          </div>
        </Field>

        {/* 2-col grid for text fields */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the shot…" rows={1} className={TEXTAREA_CLASS} />
          </Field>
          <Field label="Talent">
            <textarea value={talent} onChange={(e) => setTalent(e.target.value)}
              placeholder="Who's in this shot…" rows={1} className={TEXTAREA_CLASS} />
          </Field>
          <Field label="Props">
            <textarea value={props} onChange={(e) => setProps(e.target.value)}
              placeholder="Props needed…" rows={1} className={TEXTAREA_CLASS} />
          </Field>
          <Field label="Wardrobe">
            <textarea value={wardrobe} onChange={(e) => setWardrobe(e.target.value)}
              placeholder="Wardrobe details…" rows={1} className={TEXTAREA_CLASS} />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Lighting, special instructions…" rows={1} className={TEXTAREA_CLASS} />
          </Field>
        </div>

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
  );
}

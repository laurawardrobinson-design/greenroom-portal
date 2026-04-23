"use client";

import { useState } from "react";
import { Plus, Download, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { generateOverlayPng } from "@/lib/utils/overlay-generator";
import { CHANNEL_PRESETS, UNIQUE_CHANNELS } from "@/lib/constants/channels";
import type { CampaignDeliverable, CampaignVendor } from "@/types/domain";

interface Props {
  campaignId: string;
  deliverables: CampaignDeliverable[];
  vendors: CampaignVendor[];
  canEdit: boolean;
  onMutate: () => void;
}

// Channel color accent map for the pill badges
const CHANNEL_COLORS: Record<string, string> = {
  Instagram:  "bg-pink-50 text-pink-700 border-pink-200",
  TikTok:     "bg-slate-100 text-slate-700 border-slate-200",
  YouTube:    "bg-red-50 text-red-700 border-red-200",
  Facebook:   "bg-blue-50 text-blue-700 border-blue-200",
  Pinterest:  "bg-red-50 text-red-700 border-red-200",
  Web:        "bg-surface-secondary text-text-secondary border-border",
  Print:      "bg-amber-50 text-amber-700 border-amber-200",
  Email:      "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function DeliverablesSection({ campaignId, deliverables, vendors, canEdit, onMutate }: Props) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Deliverable key for picker = "channel||format"
  const alreadyAdded = new Set(deliverables.map((d) => `${d.channel}||${d.format}`));

  function togglePickerItem(key: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleAdd() {
    if (pickerSelected.size === 0) return;
    setAdding(true);
    try {
      const toAdd = CHANNEL_PRESETS.filter((p) => pickerSelected.has(`${p.channel}||${p.format}`));
      await Promise.all(
        toAdd.map((preset) =>
          fetch("/api/deliverables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaignId,
              channel: preset.channel,
              format: preset.format,
              width: preset.width,
              height: preset.height,
              aspectRatio: preset.aspectRatio,
              quantity: 1,
            }),
          })
        )
      );
      toast("success", `Added ${toAdd.length} deliverable${toAdd.length > 1 ? "s" : ""}`);
      setPickerSelected(new Set());
      setShowPicker(false);
      onMutate();
    } catch {
      toast("error", "Failed to add deliverables");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/deliverables/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed");
      if (selectedId === id) setSelectedId(null);
      onMutate();
    } catch {
      toast("error", "Failed to remove deliverable");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleVendorAssign(id: string, vendorId: string | null) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedVendorId: vendorId }),
      });
      if (!res.ok) throw new Error("Failed");
      onMutate();
    } catch {
      toast("error", "Failed to assign vendor");
    } finally {
      setUpdatingId(null);
    }
  }

  const channelColor = (ch: string) =>
    CHANNEL_COLORS[ch] ?? "bg-surface-secondary text-text-secondary border-border";

  return (
    <div>
      {/* Deliverable cards grid */}
      {deliverables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {deliverables.map((d) => {
            const isSelected = selectedId === d.id;
            const assignedVendor = vendors.find((v) => v.vendorId === d.assignedVendorId);

            return (
              <div key={d.id} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : d.id)}
                  className={`group relative rounded-lg border px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-surface hover:border-border-secondary"
                  }`}
                >
                  {/* Channel badge */}
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium mb-1.5 ${channelColor(d.channel)}`}>
                    {d.channel}
                  </span>

                  <p className="text-sm font-medium text-text-primary leading-tight truncate pr-4">
                    {d.format}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-text-tertiary bg-surface-secondary rounded px-1 py-0.5">
                      {d.aspectRatio}
                    </span>
                    {d.quantity > 1 && (
                      <span className="text-[10px] text-text-tertiary">×{d.quantity}</span>
                    )}
                  </div>

                  {assignedVendor && (
                    <p className="text-[10px] text-text-tertiary mt-1 truncate">
                      {assignedVendor.vendor?.companyName}
                    </p>
                  )}

                  {/* Delete on hover */}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                      disabled={deletingId === d.id}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-500 transition-all p-0.5 rounded"
                      aria-label="Remove deliverable"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </button>

                {/* Expanded panel */}
                {isSelected && (
                  <div className="mt-1 rounded-lg border border-primary/20 bg-primary/3 p-3 space-y-2.5">
                    {/* Overlay download */}
                    <button
                      type="button"
                      onClick={() => generateOverlayPng({ width: d.width, height: d.height, channel: d.channel, format: d.format, aspectRatio: d.aspectRatio })}
                      className="flex w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-primary hover:border-primary/40 transition-colors"
                    >
                      <Download className="h-3 w-3 shrink-0" />
                      <span>Capture One Overlay</span>
                      <span className="ml-auto text-text-tertiary">{d.width}×{d.height}</span>
                    </button>

                    {/* Vendor assignment */}
                    {canEdit && vendors.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                          Assigned Vendor
                        </label>
                        <div className="relative">
                          <select
                            value={d.assignedVendorId ?? ""}
                            onChange={(e) => handleVendorAssign(d.id, e.target.value || null)}
                            disabled={updatingId === d.id}
                            className="w-full appearance-none rounded-md border border-border bg-surface px-2.5 py-1.5 pr-7 text-xs text-text-primary focus:outline-none"
                          >
                            <option value="">Unassigned</option>
                            {vendors.map((v) => (
                              <option key={v.id} value={v.vendorId}>
                                {v.vendor?.companyName ?? v.vendorId}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-tertiary" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {deliverables.length === 0 && !showPicker && (
        <p className="text-sm text-text-tertiary py-1 mb-3">No deliverables added yet.</p>
      )}

      {/* Add button */}
      {canEdit && !showPicker && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowPicker(true)}
          className="w-full justify-center border border-dashed border-border hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Deliverables
        </Button>
      )}

      {/* Channel picker panel */}
      {showPicker && (
        <div className="rounded-xl border border-border bg-surface-secondary p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-text-primary">Select output formats</p>
            <button
              type="button"
              onClick={() => { setShowPicker(false); setPickerSelected(new Set()); }}
              className="text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {UNIQUE_CHANNELS.map((ch) => {
              const presets = CHANNEL_PRESETS.filter((p) => p.channel === ch);
              return (
                <div key={ch}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">{ch}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => {
                      const key = `${p.channel}||${p.format}`;
                      const isChosen = pickerSelected.has(key);
                      const isExisting = alreadyAdded.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={isExisting}
                          onClick={() => togglePickerItem(key)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                            isExisting
                              ? "border-border bg-surface text-text-tertiary opacity-40 cursor-default"
                              : isChosen
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-surface text-text-secondary hover:border-border-secondary hover:text-text-primary"
                          }`}
                        >
                          {p.format}
                          <span className="ml-1.5 text-[10px] opacity-60">{p.aspectRatio}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <p className="text-xs text-text-tertiary">
              {pickerSelected.size > 0 ? `${pickerSelected.size} selected` : "Select formats above"}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowPicker(false); setPickerSelected(new Set()); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pickerSelected.size === 0}
                loading={adding}
                onClick={handleAdd}
              >
                Add {pickerSelected.size > 0 ? pickerSelected.size : ""} Deliverable{pickerSelected.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

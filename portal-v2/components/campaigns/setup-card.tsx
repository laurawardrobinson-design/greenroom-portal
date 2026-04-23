"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  Plus,
  Check,
  X,
  CircleDot,
  AlertTriangle,
  Package,
} from "lucide-react";
import type { ShotListSetup, ShotStatus, CampaignDeliverable } from "@/types/domain";

function ShotDeliverables({
  shot,
  deliverables,
  canEdit,
  onMutate,
}: {
  shot: { id: string; deliverableLinks: Array<{ id: string; shotId: string; deliverableId: string }> };
  deliverables: CampaignDeliverable[];
  canEdit: boolean;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const [showPicker, setShowPicker] = useState(false);

  const linkedIds = new Set(shot.deliverableLinks.map((l) => l.deliverableId));
  const unlinkedDeliverables = deliverables.filter((d) => !linkedIds.has(d.id));

  async function linkDeliverable(deliverableId: string) {
    try {
      await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId }),
      });
      onMutate();
    } catch {
      toast("error", "Failed to link deliverable");
    }
  }

  async function unlinkDeliverable(deliverableId: string) {
    try {
      await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId, action: "unlink" }),
      });
      onMutate();
    } catch {
      toast("error", "Failed to unlink deliverable");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {shot.deliverableLinks.map((link) => {
        const del = deliverables.find((d) => d.id === link.deliverableId);
        if (!del) return null;
        return (
          <span
            key={link.id}
            className="group inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
          >
            {del.channel} {del.aspectRatio}
            {canEdit && (
              <button
                onClick={() => unlinkDeliverable(del.id)}
                className="hidden group-hover:inline-flex h-3 w-3 items-center justify-center rounded-full hover:bg-primary/20"
                title="Remove from shot"
              >
                <X className="h-2 w-2" />
              </button>
            )}
          </span>
        );
      })}

      {canEdit && unlinkedDeliverables.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] text-text-tertiary hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-2.5 w-2.5" />
            deliverable
          </button>

          {showPicker && (
            <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] rounded-lg border border-border bg-surface shadow-lg p-1.5">
              {unlinkedDeliverables.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { linkDeliverable(d.id); setShowPicker(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-text-primary hover:bg-surface-secondary transition-colors"
                >
                  <Package className="h-3 w-3 text-text-tertiary" />
                  {d.channel} — {d.format}
                  <span className="ml-auto text-text-tertiary">{d.aspectRatio}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShotNotes({
  notes,
  onSave,
  onSetMode,
}: {
  notes: string;
  onSave: (notes: string) => void;
  onSetMode: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes);

  if (editing || (onSetMode && !notes)) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== notes) onSave(value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (value !== notes) onSave(value);
            setEditing(false);
          }
        }}
        placeholder="Add notes..."
        className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-xs text-text-secondary focus:outline-none"
      />
    );
  }

  return notes ? (
    <p
      className="mt-1 text-xs text-text-tertiary cursor-pointer hover:text-text-secondary"
      onClick={() => { setValue(notes); setEditing(true); }}
    >
      {notes}
    </p>
  ) : null;
}

export function FlatShotRow({
  shot,
  setupName,
  shotNumber,
  deliverables,
  canComplete,
  onMutate,
}: {
  shot: { id: string; description: string; status: ShotStatus; deliverableLinks?: { deliverableId: string }[] };
  setupName: string;
  shotNumber: number;
  deliverables: CampaignDeliverable[];
  canComplete: boolean;
  onMutate: () => void;
}) {
  const { toast } = useToast();

  async function toggleStatus() {
    const newStatus = shot.status === "Complete" ? "Pending" : "Complete";
    try {
      await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onMutate();
    } catch {
      toast("error", "Failed to update shot");
    }
  }

  const linkedDeliverables = (shot.deliverableLinks || [])
    .map((link) => deliverables.find((d) => d.id === link.deliverableId))
    .filter(Boolean);

  const shotPillStyle =
    shot.status === "Complete"
      ? { color: "var(--status-approved-fg)", backgroundColor: "var(--status-approved-tint)" }
      : shot.status === "Needs Retouching"
      ? { color: "var(--status-pending-fg)", backgroundColor: "var(--status-pending-tint)" }
      : { color: "var(--status-draft-fg)", backgroundColor: "var(--status-draft-tint)" };

  return (
    <tr
      className="transition-colors hover:bg-surface-secondary/50"
      style={shot.status === "Complete" ? { backgroundColor: "var(--status-approved-tint)" } : undefined}
    >
      <td className="px-2 py-2">
        {canComplete && (
          <button
            onClick={toggleStatus}
            style={
              shot.status === "Complete"
                ? { backgroundColor: "var(--color-success)", borderColor: "var(--color-success)", color: "#fff" }
                : shot.status === "Needs Retouching"
                ? { backgroundColor: "var(--color-warning)", borderColor: "var(--color-warning)", color: "#fff" }
                : undefined
            }
            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
              shot.status === "Complete" || shot.status === "Needs Retouching"
                ? ""
                : "border-border hover:border-primary"
            }`}
          >
            {shot.status === "Complete" && <Check className="h-3 w-3" />}
            {shot.status === "Needs Retouching" && <AlertTriangle className="h-2.5 w-2.5" />}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-text-tertiary whitespace-nowrap">{setupName}</td>
      <td className="px-3 py-2 text-sm font-medium text-text-primary">{shot.description || `Shot ${shotNumber}`}</td>
      <td className="px-3 py-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={shotPillStyle}
        >
          {shot.status}
        </span>
      </td>
      <td className="px-3 py-2 hidden lg:table-cell">
        <div className="flex gap-1">
          {linkedDeliverables.map((d: any) => (
            <span key={d.id} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {d.channel}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

export function SetupCard({
  setup,
  deliverables,
  campaignId,
  canEdit,
  canComplete,
  onSetMode,
  onMutate,
}: {
  setup: ShotListSetup;
  deliverables: CampaignDeliverable[];
  campaignId: string;
  canEdit: boolean;
  canComplete: boolean;
  onSetMode: boolean;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [addingShot, setAddingShot] = useState(false);
  const [newShotDesc, setNewShotDesc] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedShots, setSelectedShots] = useState<Set<string>>(new Set());
  const [batchCompleting, setBatchCompleting] = useState(false);

  function toggleShotSelection(shotId: string) {
    setSelectedShots(prev => {
      const next = new Set(prev);
      if (next.has(shotId)) next.delete(shotId); else next.add(shotId);
      return next;
    });
  }

  async function batchComplete() {
    setBatchCompleting(true);
    try {
      await Promise.all(
        Array.from(selectedShots).map(shotId =>
          fetch(`/api/shot-list/shots/${shotId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Complete" }),
          })
        )
      );
      toast("success", `${selectedShots.size} shot${selectedShots.size !== 1 ? "s" : ""} marked complete`);
      setSelectedShots(new Set());
      setSelectMode(false);
      onMutate();
    } catch {
      toast("error", "Failed to mark shots complete");
    } finally {
      setBatchCompleting(false);
    }
  }

  async function addShot() {
    if (!newShotDesc.trim()) return;
    try {
      await fetch("/api/shot-list/shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupId: setup.id,
          campaignId,
          description: newShotDesc.trim(),
          sortOrder: setup.shots.length,
        }),
      });
      setNewShotDesc("");
      setAddingShot(false);
      onMutate();
    } catch {
      toast("error", "Failed to add shot");
    }
  }

  async function toggleShotStatus(shotId: string, currentStatus: ShotStatus) {
    const newStatus = currentStatus === "Complete" ? "Pending" : "Complete";
    try {
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onMutate();
    } catch {
      toast("error", "Failed to update shot");
    }
  }

  async function updateShotNotes(shotId: string, notes: string) {
    try {
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      onMutate();
    } catch {
      toast("error", "Failed to save notes");
    }
  }

  const completedCount = setup.shots.filter((s) => s.status === "Complete").length;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex w-full items-center gap-3 px-4 py-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <CircleDot className="h-4 w-4 shrink-0 text-text-secondary" />
          <span className="text-sm font-semibold text-text-primary flex-1">
            {setup.name || "Untitled Setup"}
          </span>
          <span className="text-xs text-text-tertiary">
            {completedCount}/{setup.shots.length}
          </span>
        </button>
        {canComplete && setup.shots.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSelectMode(!selectMode); if (selectMode) setSelectedShots(new Set()); }}
            className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            {selectMode ? "Done" : "Select"}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="border-t border-border px-4 pb-3 pt-2 space-y-1.5">
          {setup.description && (
            <p className="text-xs text-text-secondary mb-2">{setup.description}</p>
          )}

          {setup.shots.map((shot) => {
            const shotRowBg =
              shot.status === "Complete"
                ? "var(--status-approved-tint)"
                : shot.status === "Needs Retouching"
                ? "var(--status-pending-tint)"
                : undefined;
            const shotCheckStyle =
              shot.status === "Complete"
                ? { backgroundColor: "var(--color-success)", borderColor: "var(--color-success)", color: "#fff" }
                : shot.status === "Needs Retouching"
                ? { backgroundColor: "var(--color-warning)", borderColor: "var(--color-warning)", color: "#fff" }
                : undefined;
            return (
            <div
              key={shot.id}
              style={shotRowBg ? { backgroundColor: shotRowBg } : undefined}
              className={`flex items-start gap-2.5 rounded-lg p-2.5 transition-colors ${
                shotRowBg ? "" : "bg-surface-secondary"
              } ${onSetMode ? "min-h-[44px]" : ""} ${selectMode && selectedShots.has(shot.id) ? "ring-1 ring-primary/40" : ""}`}
            >
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selectedShots.has(shot.id)}
                  onChange={() => toggleShotSelection(shot.id)}
                  className="h-4 w-4 rounded border-border mt-0.5 shrink-0 accent-primary"
                />
              )}
              {canComplete && !selectMode && (
                <div className="flex flex-col items-center gap-0.5 mt-0.5 shrink-0">
                  <button
                    onClick={() => toggleShotStatus(shot.id, shot.status)}
                    style={shotCheckStyle}
                    className={`flex items-center justify-center rounded border transition-colors ${
                      onSetMode ? "h-7 w-7" : "h-5 w-5"
                    } ${shotCheckStyle ? "" : "border-border hover:border-primary"}`}
                    title={shot.status === "Complete" ? "Mark pending" : "Mark complete"}
                  >
                    {shot.status === "Complete" && <Check className="h-3 w-3" />}
                    {shot.status === "Needs Retouching" && <AlertTriangle className="h-2.5 w-2.5" />}
                  </button>
                  {shot.status !== "Needs Retouching" && (
                    <button
                      onClick={async () => {
                        try {
                          await fetch(`/api/shot-list/shots/${shot.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "Needs Retouching" }),
                          });
                          onMutate();
                        } catch { /* ignore */ }
                      }}
                      className="text-text-tertiary transition-colors hover:text-warning"
                      title="Flag for retouching"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className={`text-sm ${
                  shot.status === "Complete"
                    ? "text-text-secondary line-through"
                    : "text-text-primary"
                }`}>
                  {shot.description}
                </p>

                <ShotDeliverables
                  shot={shot}
                  deliverables={deliverables}
                  canEdit={canEdit}
                  onMutate={onMutate}
                />

                {shot.status === "Needs Retouching" && (
                  <Badge variant="warning" className="mt-1 text-[10px]">
                    Needs Retouching
                  </Badge>
                )}

                {(shot.notes || shot.status === "Complete") && (
                  <ShotNotes
                    notes={shot.notes}
                    onSave={(notes) => updateShotNotes(shot.id, notes)}
                    onSetMode={onSetMode}
                  />
                )}
              </div>
            </div>
            );
          })}

          {canEdit && (
            addingShot ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  autoFocus
                  value={newShotDesc}
                  onChange={(e) => setNewShotDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addShot();
                    if (e.key === "Escape") setAddingShot(false);
                  }}
                  placeholder="Shot description..."
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none"
                />
                <Button size="sm" onClick={addShot}>Add</Button>
                <button onClick={() => setAddingShot(false)} className="text-text-tertiary">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingShot(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-primary transition-colors mt-1"
              >
                <Plus className="h-3 w-3" />
                Add shot
              </button>
            )
          )}

          {selectMode && selectedShots.size > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <span className="text-xs font-medium text-primary">
                {selectedShots.size} shot{selectedShots.size !== 1 ? "s" : ""} selected
              </span>
              <Button
                size="sm"
                loading={batchCompleting}
                onClick={batchComplete}
              >
                <Check className="h-3 w-3" />
                Mark Complete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

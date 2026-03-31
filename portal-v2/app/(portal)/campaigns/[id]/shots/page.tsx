"use client";

import { use, useState, useRef, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useCampaign } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ShotDetailModal } from "@/components/campaigns/shot-detail-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  Crosshair, GripVertical, Check, AlertTriangle, Film, Camera, Layers,
  MapPin, User, Package, Shirt, FileText, RotateCcw, Plus, Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { ShotListShot, ShotListSetup, CampaignDeliverable } from "@/types/domain";
import { CHANNEL_TEMPLATES } from "@/lib/constants/channels";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildShotName(wf: string | undefined, date: string | undefined, n: number) {
  const w = (wf || "").replace(/\s/g, "");
  const d = date ? format(parseISO(date), "MMdd") : "";
  const num = String(n).padStart(2, "0");
  if (w || d) return `${w}${d}-Shot${num}`;
  return `Shot${num}`;
}

function StatusBadge({ status }: { status: ShotListShot["status"] }) {
  const styles: Record<string, string> = {
    Complete: "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Needs Retouching": "bg-amber-100 text-amber-700 border-amber-200",
    Cancelled: "bg-neutral-100 text-neutral-400 border-neutral-200",
    Pending: "bg-surface-secondary text-text-tertiary border-border",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status] ?? styles.Pending}`}>
      {status}
    </span>
  );
}

function MetaChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-secondary border border-border px-2 py-0.5 text-xs text-text-secondary">
      <Icon className="h-3 w-3 shrink-0 text-text-tertiary" />
      {label}
    </span>
  );
}

function ChannelChips({ shot, deliverables }: { shot: ShotListShot; deliverables: CampaignDeliverable[] }) {
  if (!shot.deliverableLinks?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {shot.deliverableLinks.map((lnk) => {
        const del = deliverables.find((d) => d.id === lnk.deliverableId);
        if (!del) return null;
        const abbr = CHANNEL_TEMPLATES.find((t) => t.name === del.channel)?.abbr ?? del.channel;
        return (
          <span key={lnk.id} className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
            {abbr} <span className="font-mono font-normal opacity-70">{del.aspectRatio}</span>
          </span>
        );
      })}
    </div>
  );
}

// ─── Shot card ────────────────────────────────────────────────────────────────
function ShotCard({
  shot, deliverables, canEdit, canComplete, onMutate,
  isDragOver, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  shot: ShotListShot;
  deliverables: CampaignDeliverable[];
  canEdit: boolean;
  canComplete: boolean;
  onMutate: () => void;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const { toast } = useToast();
  const [showDetail, setShowDetail] = useState(false);

  const done = shot.status === "Complete";
  const retouch = shot.status === "Needs Retouching";
  const cancelled = shot.status === "Cancelled";

  async function patch(u: Record<string, unknown>) {
    try {
      await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(u),
      });
      onMutate();
    } catch { toast("error", "Failed to save"); }
  }

  async function handleDelete() {
    try {
      await fetch(`/api/shot-list/shots/${shot.id}`, { method: "DELETE" });
      onMutate();
    } catch { toast("error", "Failed to delete shot"); }
  }

  const mediaIcon = shot.mediaType === "Video" ? Film : shot.mediaType === "Hybrid" ? Layers : Camera;
  const hasDetails = shot.description || shot.talent || shot.props || shot.wardrobe || shot.notes;

  return (
    <>
      {showDetail && (
        <ShotDetailModal
          shot={shot}
          open={showDetail}
          onClose={() => setShowDetail(false)}
          onSaved={() => { onMutate(); setShowDetail(false); }}
        />
      )}
      <div
        draggable={canEdit}
        onDragStart={canEdit ? onDragStart : undefined}
        onDragOver={canEdit ? onDragOver : undefined}
        onDrop={canEdit ? onDrop : undefined}
        onDragEnd={canEdit ? onDragEnd : undefined}
        className={`group relative flex gap-3 rounded-lg border bg-white px-3 py-3 transition-all ${
          isDragOver ? "border-primary/60 shadow-sm ring-2 ring-primary/20" :
          done ? "border-emerald-200 bg-emerald-50/30" :
          retouch ? "border-amber-200 bg-amber-50/30" :
          cancelled ? "border-border/50 opacity-60" :
          "border-border hover:border-primary/20 hover:shadow-sm"
        }`}
      >
        {/* Drag handle */}
        {canEdit && (
          <div className="flex flex-col items-center justify-start pt-0.5">
            <span className="text-text-tertiary/25 group-hover:text-text-tertiary/50 transition-colors cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4" />
            </span>
          </div>
        )}

        {/* Status toggle */}
        {canComplete && (
          <div className="flex flex-col items-center justify-start pt-0.5">
            <button
              type="button"
              onClick={() => patch({ status: done ? "Pending" : "Complete" })}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                done    ? "border-emerald-500 bg-emerald-500 text-white" :
                retouch ? "border-amber-400 bg-amber-400 text-white" :
                          "border-border hover:border-emerald-400 hover:bg-emerald-50"
              }`}
            >
              {done && <Check className="h-3 w-3" />}
              {retouch && <AlertTriangle className="h-2.5 w-2.5" />}
            </button>
          </div>
        )}

        {/* Reference image */}
        {shot.referenceImageUrl && (
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.referenceImageUrl}
              alt="Ref"
              onClick={() => window.open(shot.referenceImageUrl!, "_blank")}
              className="h-16 w-16 rounded-md object-cover border border-border cursor-pointer hover:opacity-80 transition-opacity"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Row 1: name + status + meta chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="font-mono text-sm font-semibold text-text-primary hover:text-primary transition-colors"
            >
              {shot.name || <span className="text-text-tertiary/40 font-normal">Unnamed shot</span>}
            </button>
            <StatusBadge status={shot.status} />
            {shot.mediaType && <MetaChip icon={mediaIcon} label={shot.mediaType} />}
            {shot.location && <MetaChip icon={MapPin} label={shot.location} />}
            {shot.angle && (
              <span className="inline-flex items-center rounded-md bg-surface-secondary border border-border px-2 py-0.5 text-xs text-text-secondary">
                {shot.angle}
              </span>
            )}
          </div>

          {/* Row 2: channels */}
          <ChannelChips shot={shot} deliverables={deliverables} />

          {/* Row 3: detail fields */}
          {hasDetails && (
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {shot.description && (
                <span className="flex items-start gap-1 text-xs text-text-secondary max-w-xs">
                  <FileText className="h-3 w-3 mt-0.5 shrink-0 text-text-tertiary" />
                  <span className="line-clamp-2">{shot.description}</span>
                </span>
              )}
              {shot.talent && (
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <User className="h-3 w-3 shrink-0 text-text-tertiary" />
                  {shot.talent}
                </span>
              )}
              {shot.props && (
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <Package className="h-3 w-3 shrink-0 text-text-tertiary" />
                  {shot.props}
                </span>
              )}
              {shot.wardrobe && (
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <Shirt className="h-3 w-3 shrink-0 text-text-tertiary" />
                  {shot.wardrobe}
                </span>
              )}
              {shot.notes && (
                <span className="flex items-center gap-1 text-xs text-text-tertiary italic">
                  {shot.notes}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Delete button */}
        {canEdit && (
          <div className="flex flex-col items-end justify-start">
            <button
              type="button"
              onClick={handleDelete}
              title="Delete shot"
              className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-text-tertiary/40 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Scene section ─────────────────────────────────────────────────────────────
function SceneSection({
  setup, deliverables, canEdit, canComplete, onMutate,
  dragOverShotId, onShotDragStart, onShotDragOver, onShotDrop, onShotDragEnd,
}: {
  setup: ShotListSetup;
  deliverables: CampaignDeliverable[];
  canEdit: boolean;
  canComplete: boolean;
  onMutate: () => void;
  dragOverShotId: string | null;
  onShotDragStart: (shotId: string, setupId: string) => void;
  onShotDragOver: (e: React.DragEvent, shotId: string, setupId: string) => void;
  onShotDrop: (targetShotId: string, targetSetupId: string) => void;
  onShotDragEnd: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(setup.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setName(setup.name); }, [setup.name, editing]);

  async function saveName() {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === setup.name) { setName(setup.name); return; }
    try {
      await fetch(`/api/shot-list/setups/${setup.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      onMutate();
    } catch { toast("error", "Failed to update setup"); setName(setup.name); }
  }

  async function handleDeleteSetup() {
    try {
      await fetch(`/api/shot-list/setups/${setup.id}`, { method: "DELETE" });
      onMutate();
    } catch { toast("error", "Failed to delete setup"); }
  }

  const done = setup.shots.filter((s) => s.status === "Complete").length;

  return (
    <div className="space-y-2">
      {/* Scene header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-3 rounded-full bg-primary" />
          {canEdit && editing ? (
            <input
              ref={inputRef} autoFocus value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveName(); }
                if (e.key === "Escape") { setName(setup.name); setEditing(false); }
              }}
              className="text-sm font-bold text-primary bg-transparent border-b border-primary outline-none uppercase tracking-wider"
            />
          ) : (
            <span
              onClick={() => canEdit && setEditing(true)}
              className={`text-sm font-bold uppercase tracking-wider text-primary ${canEdit ? "cursor-pointer hover:opacity-70 transition-opacity" : ""}`}
            >
              {setup.name}
            </span>
          )}
          {setup.location && (
            <span className="text-xs text-primary/60 font-medium">{setup.location}</span>
          )}
          {setup.shots.length > 0 && (
            <span className="text-[10px] text-text-tertiary/60">
              {done}/{setup.shots.length} complete
            </span>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleDeleteSetup}
            className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary/20 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Shots */}
      <div className="space-y-2">
        {setup.shots.map((shot) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            deliverables={deliverables}
            canEdit={canEdit}
            canComplete={canComplete}
            onMutate={onMutate}
            isDragOver={dragOverShotId === shot.id}
            onDragStart={() => onShotDragStart(shot.id, setup.id)}
            onDragOver={(e) => onShotDragOver(e, shot.id, setup.id)}
            onDrop={() => onShotDrop(shot.id, setup.id)}
            onDragEnd={onShotDragEnd}
          />
        ))}
        {setup.shots.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-xs text-text-tertiary/60">
            No shots in this scene yet
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FullShotListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { campaign, shoots, setups, deliverables, isLoading, mutate } = useCampaign(id);
  const { user } = useCurrentUser();

  const canEdit = user?.role === "Admin" || user?.role === "Producer" || user?.role === "Art Director";
  const canComplete = canEdit || user?.role === "Studio";
  const shootComplete = campaign?.status === "Post" || campaign?.status === "Complete";

  // Local setups for optimistic drag reorder
  const [localSetups, setLocalSetups] = useState<ShotListSetup[]>([]);
  useEffect(() => setLocalSetups(setups), [setups]);

  // Drag state
  const dragRef = useRef<{ shotId: string; setupId: string } | null>(null);
  const [dragOverShotId, setDragOverShotId] = useState<string | null>(null);

  const handleShotDragStart = useCallback((shotId: string, setupId: string) => {
    dragRef.current = { shotId, setupId };
  }, []);

  const handleShotDragOver = useCallback((e: React.DragEvent, shotId: string, setupId: string) => {
    e.preventDefault();
    if (!dragRef.current || dragRef.current.setupId !== setupId) return;
    if (dragRef.current.shotId !== shotId) setDragOverShotId(shotId);
  }, []);

  const handleShotDrop = useCallback(async (targetShotId: string, targetSetupId: string) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragOverShotId(null);
    if (!drag || drag.shotId === targetShotId || drag.setupId !== targetSetupId) return;

    const setup = localSetups.find((s) => s.id === targetSetupId);
    if (!setup) return;

    const shots = [...setup.shots];
    const fromIdx = shots.findIndex((s) => s.id === drag.shotId);
    const toIdx = shots.findIndex((s) => s.id === targetShotId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = shots.splice(fromIdx, 1);
    shots.splice(toIdx, 0, moved);

    setLocalSetups((prev) => prev.map((s) => s.id === targetSetupId ? { ...s, shots } : s));

    try {
      await Promise.all(
        shots.map((sh, i) =>
          fetch(`/api/shot-list/shots/${sh.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: i }),
          })
        )
      );
      mutate();
    } catch {
      toast("error", "Failed to reorder shots");
      setLocalSetups(setups);
    }
  }, [localSetups, setups, mutate, toast]);

  const handleShotDragEnd = useCallback(() => {
    dragRef.current = null;
    setDragOverShotId(null);
  }, []);

  // Add shot to last setup
  const [addingShot, setAddingShot] = useState(false);
  const allDates = shoots.flatMap((s) => s.dates.map((d) => d.shootDate));
  const firstShootDate = allDates[0];

  async function handleAddShot() {
    const lastSetup = localSetups[localSetups.length - 1];
    if (!lastSetup) return;
    setAddingShot(true);
    let globalIdx = 1;
    for (const s of localSetups) globalIdx += s.shots.length;
    try {
      const res = await fetch("/api/shot-list/shots", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupId: lastSetup.id, campaignId: id,
          name: buildShotName(campaign?.wfNumber ?? undefined, firstShootDate, globalIdx),
          sortOrder: lastSetup.shots.length,
        }),
      });
      if (!res.ok) throw new Error();
      mutate();
    } catch { toast("error", "Failed to add shot"); }
    finally { setAddingShot(false); }
  }

  // Add scene
  const [addingScene, setAddingScene] = useState(false);
  async function handleAddScene() {
    setAddingScene(true);
    try {
      const res = await fetch("/api/shot-list/setups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id, name: `Scene ${localSetups.length + 1}`, sortOrder: localSetups.length }),
      });
      if (!res.ok) throw new Error();
      mutate();
    } catch { toast("error", "Failed to add scene"); }
    finally { setAddingScene(false); }
  }

  // Reset naming
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleResetNaming() {
    setResetting(true);
    try {
      let idx = 1;
      const patches: Promise<Response>[] = [];
      for (const setup of localSetups) {
        for (const shot of setup.shots) {
          const newName = buildShotName(campaign?.wfNumber ?? undefined, firstShootDate, idx);
          patches.push(
            fetch(`/api/shot-list/shots/${shot.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: newName }),
            })
          );
          idx++;
        }
      }
      await Promise.all(patches);
      mutate();
      setShowResetConfirm(false);
    } catch {
      toast("error", "Failed to reset naming");
    } finally {
      setResetting(false);
    }
  }

  if (isLoading) return <DashboardSkeleton />;
  if (!campaign) {
    return (
      <EmptyState
        title="Campaign not found"
        description="This campaign may have been deleted or you don't have access."
      />
    );
  }

  const allShots = localSetups.flatMap((s) => s.shots);
  const completedShots = allShots.filter((s) => s.status === "Complete").length;
  const totalShots = allShots.length;

  return (
    <>
      <ConfirmDialog
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetNaming}
        title="Reset Shot Naming?"
        description="This will renumber all shots based on their current order, replacing existing shot names. This cannot be undone."
        confirmLabel="Reset Naming"
        cancelLabel="Cancel"
        variant="danger"
        loading={resetting}
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Page header */}
        <PageHeader
          breadcrumb={`${campaign.wfNumber ? campaign.wfNumber + " " : ""}${campaign.name}`}
          breadcrumbHref={`/campaigns/${id}`}
          title={
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-text-primary">Shots</span>
            </div>
          }
        />

        {/* Progress + actions */}
        <div className="flex flex-col items-end gap-3 shrink-0">
            {totalShots > 0 && (
              <div className="text-right space-y-1">
                <p className="text-xs font-medium text-text-tertiary">
                  {completedShots} of {totalShots} complete
                </p>
                <div className="h-1.5 w-36 rounded-full bg-surface-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${totalShots > 0 ? (completedShots / totalShots) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            {canEdit && !shootComplete && (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary/60 hover:text-text-secondary transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Naming
              </button>
            )}
        </div>

        {/* Scenes */}
        {localSetups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
              <Crosshair className="h-5 w-5 text-text-tertiary" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-text-secondary">No shots yet</p>
              <p className="text-xs text-text-tertiary">Add a scene to get started</p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={handleAddScene}
                disabled={addingScene}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Scene
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {localSetups.map((setup) => (
              <SceneSection
                key={setup.id}
                setup={setup}
                deliverables={deliverables}
                canEdit={canEdit}
                canComplete={canComplete}
                onMutate={mutate}
                dragOverShotId={dragOverShotId}
                onShotDragStart={handleShotDragStart}
                onShotDragOver={handleShotDragOver}
                onShotDrop={handleShotDrop}
                onShotDragEnd={handleShotDragEnd}
              />
            ))}
          </div>
        )}

        {/* Bottom bar */}
        {canEdit && localSetups.length > 0 && (
          <div className="flex items-center gap-4 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={handleAddShot}
              disabled={addingShot || localSetups.length === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-text-tertiary hover:text-primary transition-colors disabled:opacity-40"
            >
              {addingShot
                ? <span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                : <Plus className="h-3.5 w-3.5" />}
              Add Shot
            </button>
            <button
              type="button"
              onClick={handleAddScene}
              disabled={addingScene}
              className="flex items-center gap-1.5 text-sm font-medium text-text-tertiary hover:text-primary transition-colors disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Scene
            </button>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import { Download, List, GripVertical, Plus, Trash2, ChevronLeft, X } from "lucide-react";
import useSWR, { mutate as globalMutate } from "swr";
import { useToast } from "@/components/ui/toast";
import { generateShotListPdf } from "@/lib/utils/pdf-generator";
import { CHANNEL_TEMPLATES, SPEC_DIMENSIONS } from "@/lib/constants/channels";
import type { ChannelTemplate } from "@/lib/constants/channels";
import type { Shoot } from "@/types/domain";
import { generateOverlayPng } from "@/lib/utils/overlay-generator";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Portal panel hook ────────────────────────────────────────────────────────
const PANEL_ESTIMATE_H = 340;

function usePortalPanel<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });
  const anchorRef = useRef<T>(null);

  function calcPos() {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < PANEL_ESTIMATE_H && r.top > PANEL_ESTIMATE_H;
    setPos({
      top: openUp ? r.top - 4 : r.bottom + 4,
      left: r.left,
      openUp,
    });
  }

  const toggle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!open) calcPos();
    setOpen((v) => !v);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open]);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    zIndex: 9999,
    ...(pos.openUp ? { transform: "translateY(-100%)" } : {}),
  };

  return { anchorRef, panelStyle, open, toggle, close };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DraftDeliverableSel { channel: string; spec: string }

interface Props {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  assetsDeliveryDate: string | null;
  shoots: Shoot[];
}

interface ScheduleData {
  setups: Array<{
    id: string;
    name: string;
    description: string;
    location: string;
    media_type: string;
    sort_order: number;
  }>;
  shots: Array<{
    id: string;
    setup_id: string;
    name: string;
    description: string;
    angle: string;
    media_type: string;
    location: string;
    notes: string;
    talent: string;
    props: string;
    surface: string;
    lighting: string;
    priority: string;
    retouching_notes: string;
    sort_order: number;
    estimated_duration_minutes: number;
    shoot_date_id: string | null;
  }>;
  links: Array<{ shot_id: string; deliverable_id: string }>;
  productLinks: Array<{ shot_id: string; campaign_product_id: string }>;
  deliverables: Array<{ id: string; channel: string; format: string; aspect_ratio: string }>;
  campaignProducts: Array<{ id: string; product: { name: string; item_code: string | null } | null }>;
}

// ─── Editable Cell ───────────────────────────────────────────────────────────
function Cell({
  value,
  placeholder,
  onSave,
  className = "",
}: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  return (
    <td
      className={`relative cursor-cell group ${className}`}
      onClick={() => {
        if (!editing) {
          setDraft(value);
          setEditing(true);
          setTimeout(() => inputRef.current?.select(), 0);
        }
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className="absolute inset-0 px-2.5 py-2 text-xs bg-white outline-none z-10 ring-2 ring-inset ring-primary text-text-primary"
          placeholder={placeholder}
        />
      ) : (
        <div
          className={`px-2.5 py-2 text-xs h-full ${
            value ? "text-text-primary" : "text-text-tertiary/40"
          } group-hover:bg-primary/3 transition-colors`}
        >
          {value || placeholder || "—"}
        </div>
      )}
    </td>
  );
}

// ─── Overlay preview ──────────────────────────────────────────────────────────
function OverlayPreview({ spec }: { spec: string }) {
  let w = 1, h = 1;
  const colonParts = spec.split(":");
  const crossParts = spec.split("×");
  if (colonParts.length === 2) {
    w = parseFloat(colonParts[0]);
    h = parseFloat(colonParts[1]);
  } else if (crossParts.length === 2) {
    w = parseInt(crossParts[0]);
    h = parseInt(crossParts[1]);
  }
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
    return (
      <div className="flex items-center justify-center h-20 rounded-lg bg-neutral-600/30 text-text-tertiary text-sm">
        {spec}
      </div>
    );
  }
  const MAX_W = 148, MAX_H = 172;
  const scale = Math.min(MAX_W / w, MAX_H / h);
  const dW = Math.round(w * scale);
  const dH = Math.round(h * scale);
  const labelSize = Math.max(7, Math.round(dH * 0.065));

  return (
    <div className="flex items-center justify-center py-1">
      <div className="relative rounded overflow-hidden bg-neutral-600 shadow-sm" style={{ width: dW, height: dH }}>
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.12) 1px,transparent 1px)",
          backgroundSize: "33.33% 33.33%",
        }} />
        <div className="absolute border border-white/40" style={{ inset: "5%" }} />
        <div className="absolute bg-white/35" style={{ top: "50%", left: "44%", right: "44%", height: 1 }} />
        <div className="absolute bg-white/35" style={{ left: "50%", top: "44%", bottom: "44%", width: 1 }} />
        <div className="absolute bottom-1 left-1.5 text-white/55" style={{ fontSize: labelSize }}>
          {spec}
        </div>
      </div>
    </div>
  );
}

// ─── Channel picker panel ─────────────────────────────────────────────────────
function ChannelPickerPanel({
  selected,
  onToggle,
  onClose,
}: {
  selected: DraftDeliverableSel[];
  onToggle: (sel: DraftDeliverableSel) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"list" | "detail">("list");
  const [active, setActive] = useState<ChannelTemplate | null>(null);
  const [detailSpec, setDetailSpec] = useState<string>("");

  function openDetail(tmpl: ChannelTemplate) {
    setActive(tmpl);
    setDetailSpec(tmpl.specs[0]);
    setView("detail");
  }

  function isSel(channel: string, spec: string) {
    return selected.some((s) => s.channel === channel && s.spec === spec);
  }

  function triggerDownload() {
    if (!active || !detailSpec) return;
    const dims = SPEC_DIMENSIONS[detailSpec] ?? { width: 1080, height: 1080 };
    generateOverlayPng({
      width: dims.width, height: dims.height,
      channel: active.name, format: detailSpec, aspectRatio: detailSpec,
    });
  }

  // Detail view
  if (view === "detail" && active) {
    const alreadySel = isSel(active.name, detailSpec);
    return (
      <div className="w-60">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
          <button type="button" onClick={() => setView("list")}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-secondary text-text-tertiary transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] font-semibold text-text-primary">{active.name}</span>
        </div>

        {active.specs.length > 1 && (
          <div className="flex flex-wrap gap-1 px-3 pt-2.5">
            {active.specs.map((spec) => (
              <button key={spec} type="button" onClick={() => setDetailSpec(spec)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  detailSpec === spec
                    ? "bg-primary text-white"
                    : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}>
                {spec}
              </button>
            ))}
          </div>
        )}

        <div className="px-3 pt-2 pb-1">
          <OverlayPreview spec={detailSpec} />
        </div>

        <div className="px-3 pb-2">
          <button type="button" onClick={triggerDownload}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-2 text-[11px] font-medium text-text-secondary hover:border-primary/40 hover:text-primary transition-colors">
            <Download className="h-3 w-3 shrink-0" />
            Capture One Overlay
            <span className="ml-auto text-[11px] text-text-tertiary">{detailSpec}</span>
          </button>
        </div>

        <div className="px-3 pb-3 pt-1 border-t border-border">
          <button type="button"
            onClick={() => { onToggle({ channel: active.name, spec: detailSpec }); setView("list"); }}
            className={`w-full rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
              alreadySel
                ? "bg-red-50 text-red-500 hover:bg-red-100 border border-red-200"
                : "bg-primary text-white hover:bg-primary/90"
            }`}>
            {alreadySel ? "Remove from shot" : `Add ${active.name}`}
          </button>
        </div>
      </div>
    );
  }

  // List view
  const tiles = CHANNEL_TEMPLATES.flatMap((tmpl) =>
    tmpl.specs.map((spec) => ({ tmpl, spec }))
  );

  return (
    <div className="w-64">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[11px] font-semibold text-text-primary">Add channels</span>
        <button type="button" onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-secondary text-text-tertiary transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1 p-2 max-h-[320px] overflow-y-auto">
        {tiles.map(({ tmpl, spec }) => {
          const sel = isSel(tmpl.name, spec);
          return (
            <button key={`${tmpl.name}|${spec}`} type="button"
              onClick={() => onToggle({ channel: tmpl.name, spec })}
              className={`flex flex-col items-center justify-center rounded-lg border py-1.5 px-1 transition-all ${
                sel
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-text-secondary hover:border-primary/30 hover:bg-surface-secondary"
              }`}>
              <span className="text-[11px] font-semibold leading-snug text-center">{tmpl.abbr ?? tmpl.name} {spec}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Channel chip ────────────────────────────────────────────────────────────
function ChannelChip({ sel, tmpl, onRemove }: {
  sel: DraftDeliverableSel;
  tmpl: ChannelTemplate | undefined;
  onRemove: () => void;
}) {
  const { anchorRef, panelStyle, open, toggle, close } = usePortalPanel<HTMLButtonElement>();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) close();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close, anchorRef]);

  return (
    <span className="relative inline-block">
      <button ref={anchorRef} type="button" onClick={toggle}
        className="group inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors">
        {tmpl?.abbr ?? sel.channel} <span className="font-normal opacity-70">{sel.spec}</span>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={close} />
          <div ref={panelRef} style={{ ...panelStyle, width: 240 }}
            className="rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
            <div className="px-3 pt-2.5 pb-1">
              <p className="text-[11px] font-semibold text-text-primary">{tmpl?.name ?? sel.channel}</p>
              <p className="text-[11px] text-text-tertiary mt-0.5">{sel.spec}</p>
            </div>
            <div className="px-3 pt-1 pb-1">
              <OverlayPreview spec={sel.spec} />
            </div>
            <div className="px-3 pb-3">
              <button type="button"
                onClick={() => {
                  const dims = SPEC_DIMENSIONS[sel.spec] ?? { width: 1080, height: 1080 };
                  generateOverlayPng({ width: dims.width, height: dims.height, channel: sel.channel, format: sel.spec, aspectRatio: sel.spec });
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-2 text-sm font-medium text-text-secondary hover:border-primary/40 hover:text-primary transition-colors">
                <Download className="h-3 w-3 shrink-0" />
                Capture One Overlay
                <span className="ml-auto text-[11px] text-text-tertiary">{sel.spec}</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </span>
  );
}

// ─── Channel cell ────────────────────────────────────────────────────────────
function ChannelCell({
  shotId,
  data,
  swrKey,
}: {
  shotId: string;
  data: ScheduleData;
  swrKey: string;
}) {
  const { toast } = useToast();
  const { anchorRef: addRef, panelStyle, open, toggle, close } = usePortalPanel<HTMLDivElement>();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        addRef.current && !addRef.current.contains(e.target as Node)
      ) close();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close, addRef]);

  const shotLinks = data.links.filter((l) => l.shot_id === shotId);
  const linked: DraftDeliverableSel[] = shotLinks
    .map((lnk) => {
      const d = data.deliverables.find((x) => x.id === lnk.deliverable_id);
      return d ? { channel: d.channel, spec: d.aspect_ratio } : null;
    })
    .filter(Boolean) as DraftDeliverableSel[];

  async function unlink(deliverableId: string) {
    try {
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId, action: "unlink" }),
      });
      globalMutate(swrKey);
    } catch {
      toast("error", "Failed to unlink");
    }
  }

  async function toggleSel(sel: DraftDeliverableSel) {
    const existing = data.deliverables.find(
      (d) => d.channel === sel.channel && d.aspect_ratio === sel.spec
    );
    if (existing && shotLinks.some((l) => l.deliverable_id === existing.id)) {
      await unlink(existing.id);
      return;
    }
    try {
      const delId = existing?.id;
      if (delId) {
        await fetch(`/api/shot-list/shots/${shotId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliverableId: delId }),
        });
        globalMutate(swrKey);
      }
    } catch {
      toast("error", "Failed to add channel");
    }
    close();
  }

  return (
    <div ref={addRef} className="flex flex-wrap items-center gap-1 px-2 py-1.5 min-h-[32px] h-full"
      onClick={toggle}
      style={{ cursor: "cell" }}>
      {shotLinks.map((lnk) => {
        const del = data.deliverables.find((d) => d.id === lnk.deliverable_id);
        if (!del) return null;
        const tmpl = CHANNEL_TEMPLATES.find((t) => t.name === del.channel);
        return (
          <ChannelChip
            key={lnk.deliverable_id}
            sel={{ channel: del.channel, spec: del.aspect_ratio }}
            tmpl={tmpl}
            onRemove={() => unlink(del.id)}
          />
        );
      })}

      <button type="button"
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-text-tertiary border border-dashed border-border/70 hover:border-primary hover:text-primary hover:bg-primary/3 transition-colors">
        <Plus className="h-2.5 w-2.5" />
        {shotLinks.length === 0 && <span>Add channel</span>}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={close} />
          <div ref={panelRef} style={panelStyle} className="rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
            <ChannelPickerPanel selected={linked} onToggle={toggleSel} onClose={close} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function ShotListCleanView({
  campaignId,
  campaignName,
  wfNumber,
  assetsDeliveryDate,
  shoots,
}: Props) {
  const { toast } = useToast();
  const swrKey = `/api/campaigns/${campaignId}/schedule`;
  const { data, isLoading } = useSWR<ScheduleData>(swrKey, fetcher);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);

  // ─── Patch a shot field ────────────────────────────────────────────────────
  const patchShot = useCallback(
    async (shotId: string, field: string, value: string) => {
      try {
        await fetch(`/api/shot-list/shots/${shotId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        globalMutate(swrKey);
      } catch {
        toast("error", "Failed to save");
      }
    },
    [swrKey, toast]
  );

  // ─── Add a shot to the end of a setup ──────────────────────────────────────
  const addShot = useCallback(
    async (setupId: string) => {
      if (!data) return;
      const setupShots = data.shots.filter((s) => s.setup_id === setupId);
      const maxOrder = setupShots.length > 0
        ? Math.max(...setupShots.map((s) => s.sort_order))
        : 0;

      try {
        await fetch("/api/shot-list/shots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setupId,
            campaignId,
            name: "",
            description: "",
            sortOrder: maxOrder + 1,
          }),
        });
        globalMutate(swrKey);
      } catch {
        toast("error", "Failed to add shot");
      }
    },
    [data, campaignId, swrKey, toast]
  );

  // ─── Delete a shot ─────────────────────────────────────────────────────────
  const deleteShot = useCallback(
    async (shotId: string) => {
      try {
        await fetch(`/api/shot-list/shots/${shotId}`, { method: "DELETE" });
        globalMutate(swrKey);
      } catch {
        toast("error", "Failed to delete");
      }
    },
    [swrKey, toast]
  );

  // ─── Add a setup ──────────────────────────────────────────────────────────
  const addSetup = useCallback(async () => {
    if (!data) return;
    const maxOrder = data.setups.length > 0
      ? Math.max(...data.setups.map((s) => s.sort_order))
      : 0;

    try {
      await fetch("/api/shot-list/setups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          name: `Setup ${data.setups.length + 1}`,
          sortOrder: maxOrder + 1,
        }),
      });
      globalMutate(swrKey);
    } catch {
      toast("error", "Failed to add setup");
    }
  }, [data, campaignId, swrKey, toast]);

  // ─── Reorder via drag-and-drop ─────────────────────────────────────────────
  const handleDrop = useCallback(
    async (targetShotId: string) => {
      if (!dragId || !data || dragId === targetShotId) return;

      // Build flat ordered list
      const allShots = data.setups.flatMap((setup) =>
        data.shots
          .filter((s) => s.setup_id === setup.id)
          .sort((a, b) => a.sort_order - b.sort_order)
      );

      const dragIdx = allShots.findIndex((s) => s.id === dragId);
      const targetIdx = allShots.findIndex((s) => s.id === targetShotId);
      if (dragIdx === -1 || targetIdx === -1) return;

      const reordered = [...allShots];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(targetIdx, 0, moved);

      // If moving across setups, update setup_id too
      const targetShot = allShots[targetIdx];
      const movedToNewSetup = moved.setup_id !== targetShot.setup_id;

      // Update sort orders
      try {
        // If crossed setup boundaries, update the shot's setup
        if (movedToNewSetup) {
          await fetch(`/api/shot-list/shots/${moved.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: targetIdx }),
          });
        }

        // Update all sort orders in affected setups
        const affectedSetups = new Set([moved.setup_id, targetShot.setup_id]);
        for (const setupId of affectedSetups) {
          const setupShots = reordered.filter((s) => s.setup_id === setupId || (s.id === moved.id && setupId === targetShot.setup_id));
          for (let i = 0; i < setupShots.length; i++) {
            if (setupShots[i].sort_order !== i) {
              await fetch(`/api/shot-list/shots/${setupShots[i].id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sortOrder: i }),
              });
            }
          }
        }

        globalMutate(swrKey);
      } catch {
        toast("error", "Failed to reorder");
      }
      setDragId(null);
    },
    [dragId, data, swrKey, toast]
  );

  // ─── Download PDF ──────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!data) return;
    const rows = buildShotListRows(data);
    const doc = generateShotListPdf({
      campaignName,
      wfNumber,
      deliveryDate: assetsDeliveryDate || undefined,
      rows,
    });
    doc.save(`${wfNumber}_${campaignName.replace(/\s+/g, "_")}_Shot_List.pdf`);
  };

  // ─── Loading / Empty ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data || (data.setups.length === 0 && data.shots.length === 0)) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          <List className="h-4 w-4 text-text-tertiary" />
        </div>
        <p className="text-sm text-text-tertiary">No shots yet.</p>
        <button
          type="button"
          onClick={addSetup}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add First Setup
        </button>
      </div>
    );
  }

  const totalShots = data.shots.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">
          {totalShots} shot{totalShots !== 1 ? "s" : ""} across{" "}
          {data.setups.length} setup{data.setups.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addSetup}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Setup
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Setups + shots */}
      {data.setups
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((setup) => {
          const setupShots = data.shots
            .filter((s) => s.setup_id === setup.id)
            .sort((a, b) => a.sort_order - b.sort_order);

          return (
            <div
              key={setup.id}
              className="rounded-lg border border-border overflow-hidden"
            >
              {/* Setup header */}
              <SetupHeader
                setup={setup}
                shotCount={setupShots.length}
                onSaveName={(name) =>
                  fetch(`/api/shot-list/setups/${setup.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  }).then(() => globalMutate(swrKey))
                }
                onDelete={() =>
                  fetch(`/api/shot-list/setups/${setup.id}`, { method: "DELETE" })
                    .then(() => globalMutate(swrKey))
                }
              />

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-secondary">
                      <th className="w-[28px]" />
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary w-[40px]">
                        #
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary min-w-[160px]">
                        File Name
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary w-[60px]">
                        Type
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary w-[80px]">
                        Angle
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary w-[100px]">
                        Environment
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary min-w-[180px]">
                        Description
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary min-w-[100px]">
                        Surface
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary min-w-[100px]">
                        Lighting
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary min-w-[130px]">
                        Products
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary w-[60px]">
                        Talent
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary min-w-[100px]">
                        Channel
                      </th>
                      <th className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary min-w-[120px]">
                        Notes
                      </th>
                      <th className="w-[28px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {setupShots.map((shot, si) => {
                      const shotLinks = data.links.filter(
                        (l) => l.shot_id === shot.id
                      );
                      const channels = shotLinks
                        .map((l) =>
                          data.deliverables.find(
                            (d) => d.id === l.deliverable_id
                          )
                        )
                        .filter(Boolean)
                        .map((d) => d!.channel)
                        .join(", ");

                      const globalIdx =
                        data.shots.findIndex((s) => s.id === shot.id) + 1;

                      return (
                        <tr
                          key={shot.id}
                          draggable
                          onDragStart={() => setDragId(shot.id)}
                          onDragEnd={() => setDragId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(shot.id);
                          }}
                          className={`border-t border-border transition-colors ${
                            dragId === shot.id
                              ? "opacity-30 bg-primary/5"
                              : "hover:bg-surface-secondary/50"
                          }`}
                        >
                          {/* Drag handle */}
                          <td className="w-[28px] cursor-grab active:cursor-grabbing">
                            <div className="flex items-center justify-center h-full">
                              <GripVertical className="h-3 w-3 text-text-tertiary/30" />
                            </div>
                          </td>

                          {/* Shot # (read-only) */}
                          <td className="px-2.5 py-2 text-xs font-medium text-text-primary">
                            {globalIdx}
                          </td>

                          {/* File Name */}
                          <Cell
                            value={shot.name}
                            placeholder="Shot name"
                            onSave={(v) => patchShot(shot.id, "name", v)}
                          />

                          {/* Type */}
                          <td className="relative">
                            <select
                              value={shot.media_type || "Still"}
                              onChange={(e) => patchShot(shot.id, "mediaType", e.target.value)}
                              className="w-full px-2.5 py-2 text-xs text-text-primary bg-transparent border-none outline-none cursor-pointer hover:bg-primary/3 transition-colors appearance-none"
                            >
                              <option value="Still">Still</option>
                              <option value="Video">Video</option>
                              <option value="Stop Motion">Stop Motion</option>
                            </select>
                          </td>

                          {/* Angle */}
                          <td className="relative">
                            <select
                              value={shot.angle || ""}
                              onChange={(e) => patchShot(shot.id, "angle", e.target.value)}
                              className={`w-full px-2.5 py-2 text-xs bg-transparent border-none outline-none cursor-pointer hover:bg-primary/3 transition-colors appearance-none ${
                                shot.angle ? "text-text-primary" : "text-text-tertiary/40"
                              }`}
                            >
                              <option value="">Angle</option>
                              <option value="Straight on">Straight on</option>
                              <option value="Overhead">Overhead</option>
                              <option value="3/4">3/4</option>
                              <option value="Various (video)">Various (video)</option>
                            </select>
                          </td>

                          {/* Environment */}
                          <td className="relative">
                            <select
                              value={shot.location || ""}
                              onChange={(e) => patchShot(shot.id, "location", e.target.value)}
                              className={`w-full px-2.5 py-2 text-xs bg-transparent border-none outline-none cursor-pointer hover:bg-primary/3 transition-colors appearance-none ${
                                shot.location ? "text-text-primary" : "text-text-tertiary/40"
                              }`}
                            >
                              <option value="">Environment</option>
                              <option value="White seamless">White seamless</option>
                              <option value="Lifestyle: Studio">Lifestyle: Studio</option>
                              <option value="Lifestyle: Location">Lifestyle: Location</option>
                            </select>
                          </td>

                          {/* Description */}
                          <Cell
                            value={shot.description}
                            placeholder="Description"
                            onSave={(v) =>
                              patchShot(shot.id, "description", v)
                            }
                          />

                          {/* Surface */}
                          <Cell
                            value={shot.surface || ""}
                            placeholder="Surface"
                            onSave={(v) => patchShot(shot.id, "surface", v)}
                          />

                          {/* Lighting */}
                          <Cell
                            value={shot.lighting || ""}
                            placeholder="Lighting"
                            onSave={(v) => patchShot(shot.id, "lighting", v)}
                          />

                          {/* Products */}
                          <Cell
                            value={shot.props}
                            placeholder="Products"
                            onSave={(v) => patchShot(shot.id, "props", v)}
                          />

                          {/* Talent */}
                          <Cell
                            value={shot.talent || "No"}
                            placeholder="No"
                            onSave={(v) => patchShot(shot.id, "talent", v)}
                          />

                          {/* Channel */}
                          <td className="relative">
                            {data && <ChannelCell shotId={shot.id} data={data} swrKey={swrKey} />}
                          </td>

                          {/* Notes */}
                          <Cell
                            value={shot.notes}
                            placeholder="Notes"
                            onSave={(v) => patchShot(shot.id, "notes", v)}
                          />

                          {/* Delete */}
                          <td className="w-[28px]">
                            <button
                              type="button"
                              onClick={() => deleteShot(shot.id)}
                              className="flex items-center justify-center h-full w-full opacity-0 hover:opacity-100 focus:opacity-100 text-text-tertiary hover:text-red-500 transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add shot button */}
              <button
                type="button"
                onClick={() => addShot(setup.id)}
                className="flex items-center gap-1 w-full px-3.5 py-2 text-xs text-text-tertiary hover:text-primary hover:bg-primary/3 transition-colors border-t border-border"
              >
                <Plus className="h-3 w-3" />
                Add shot
              </button>
            </div>
          );
        })}
    </div>
  );
}

// ─── Setup Header ────────────────────────────────────────────────────────────
function SetupHeader({
  setup,
  shotCount,
  onSaveName,
  onDelete,
}: {
  setup: { id: string; name: string; location: string };
  shotCount: number;
  onSaveName: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(setup.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(setup.name);
  }, [setup.name, editing]);

  function commit() {
    setEditing(false);
    if (draft !== setup.name && draft.trim()) onSaveName(draft.trim());
  }

  return (
    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-secondary/60 border-b border-border group">
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(setup.name);
              setEditing(false);
            }
          }}
          className="text-sm font-semibold text-text-primary bg-transparent border-b border-primary outline-none px-0 py-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setTimeout(() => inputRef.current?.select(), 0);
          }}
          className="text-sm font-semibold text-text-primary hover:text-primary transition-colors"
        >
          {setup.name || "Untitled Setup"}
        </button>
      )}
      <span className="text-xs text-text-tertiary">
        {shotCount} shot{shotCount !== 1 ? "s" : ""}
      </span>
      {setup.location && (
        <span className="text-xs text-text-tertiary">· {setup.location}</span>
      )}
      <div className="ml-auto">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-500">Delete setup{shotCount > 0 ? ` and ${shotCount} shot${shotCount !== 1 ? "s" : ""}` : ""}?</span>
            <button type="button" onClick={onDelete}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors">
              Yes
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors">
              No
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary/30 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Delete setup">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Helper: build PDF rows ──────────────────────────────────────────────────
function buildShotListRows(data: ScheduleData) {
  let shotNum = 0;
  const rows: Array<{
    shotNumber: number;
    fileName: string;
    fileType: string;
    angle: string;
    ratio: string;
    environment: string;
    description: string;
    products: string;
    talent: string;
    channel: string;
    notes: string;
  }> = [];

  for (const setup of data.setups.sort((a, b) => a.sort_order - b.sort_order)) {
    const setupShots = data.shots
      .filter((s) => s.setup_id === setup.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const shot of setupShots) {
      shotNum++;
      const shotLinks = data.links.filter((l) => l.shot_id === shot.id);
      const channels = shotLinks
        .map((l) => data.deliverables.find((d) => d.id === l.deliverable_id))
        .filter(Boolean)
        .map((d) => d!.channel)
        .join(", ");

      const ratios = [
        ...new Set(
          shotLinks
            .map(
              (l) =>
                data.deliverables.find((d) => d.id === l.deliverable_id)
                  ?.aspect_ratio
            )
            .filter(Boolean)
        ),
      ].join(", ");

      // Resolve real product names from product links
      const shotProductLinks = (data.productLinks || []).filter((l) => l.shot_id === shot.id);
      const productNames = shotProductLinks
        .map((l) => {
          const cp = (data.campaignProducts || []).find((p) => p.id === l.campaign_product_id);
          if (!cp?.product) return null;
          const code = cp.product.item_code ? ` (${cp.product.item_code})` : "";
          return `${cp.product.name}${code}`;
        })
        .filter(Boolean)
        .join(", ");

      rows.push({
        shotNumber: shotNum,
        fileName: shot.name,
        fileType: shot.media_type || "Still",
        angle: shot.angle,
        ratio: ratios,
        environment: shot.surface || shot.location || setup.location,
        description: shot.description,
        products: productNames || shot.props,
        talent: shot.talent || "No",
        channel: channels,
        notes: shot.notes,
      });
    }
  }

  return rows;
}

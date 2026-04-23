"use client";

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import {
  Check, AlertTriangle, Plus, X, Download, Upload, ChevronLeft, Trash2, GripVertical, RotateCcw,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { generateOverlayPng } from "@/lib/utils/overlay-generator";
import { CHANNEL_TEMPLATES, SPEC_DIMENSIONS } from "@/lib/constants/channels";
import type { ChannelTemplate } from "@/lib/constants/channels";
import type { ShotListSetup, ShotListShot, CampaignDeliverable, CampaignStatus, CampaignProduct, Product } from "@/types/domain";
import { ProductDetailModal } from "@/components/campaigns/product-detail-modal";
import { ProductDrawer } from "@/components/products/product-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DraftDeliverableSel { channel: string; spec: string }

// ─── Portal panel hook — escapes overflow:hidden/auto ancestors ───────────────
// Auto-flips upward when panel would clip the bottom of the viewport.
const PANEL_ESTIMATE_H = 340; // conservative max panel height in px

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When openUp, the panel bottom aligns with the anchor top — use translateY(-100%)
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    zIndex: 9999,
    ...(pos.openUp ? { transform: "translateY(-100%)" } : {}),
  };

  return { anchorRef, panelStyle, open, toggle, close };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildShotName(wf: string | undefined, date: string | undefined, n: number) {
  const w = (wf || "").replace(/\s/g, "");
  const d = date ? format(parseISO(date), "MMdd") : "";
  const num = String(n).padStart(2, "0");
  if (w || d) return `${w}${d}-Shot${num}`;
  return `Shot${num}`;
}

// ─── CSS overlay preview ──────────────────────────────────────────────────────
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
      <div className="flex items-center justify-center h-20 rounded-lg bg-neutral-600/30 text-text-tertiary text-sm ">
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
        {/* Rule of thirds */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.12) 1px,transparent 1px)",
          backgroundSize: "33.33% 33.33%",
        }} />
        {/* Title-safe border */}
        <div className="absolute border border-white/40" style={{ inset: "5%" }} />
        {/* Crosshair */}
        <div className="absolute bg-white/35" style={{ top: "50%", left: "44%", right: "44%", height: 1 }} />
        <div className="absolute bg-white/35" style={{ left: "50%", top: "44%", bottom: "44%", width: 1 }} />
        {/* Spec label */}
        <div className="absolute bottom-1 left-1.5  text-white/55" style={{ fontSize: labelSize }}>
          {spec}
        </div>
      </div>
    </div>
  );
}

// ─── Channel picker panel (list → detail, shared by draft & saved rows) ───────
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

  // ── Detail view ──
  if (view === "detail" && active) {
    const alreadySel = isSel(active.name, detailSpec);
    return (
      <div className="w-60">
        {/* Back header */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
          <button type="button" onClick={() => setView("list")}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-secondary text-text-tertiary transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-semibold text-text-primary">{active.name}</span>
        </div>

        {/* Spec tabs */}
        {active.specs.length > 1 && (
          <div className="flex flex-wrap gap-1 px-3 pt-2.5">
            {active.specs.map((spec) => (
              <button key={spec} type="button" onClick={() => setDetailSpec(spec)}
                className={`px-2 py-0.5 rounded text-xs  font-semibold transition-colors ${
                  detailSpec === spec
                    ? "bg-primary text-white"
                    : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}>
                {spec}
              </button>
            ))}
          </div>
        )}

        {/* Overlay preview */}
        <div className="px-3 pt-2 pb-1">
          <OverlayPreview spec={detailSpec} />
        </div>

        {/* Download */}
        <div className="px-3 pb-2">
          <button type="button" onClick={triggerDownload}
            className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-2 text-sm font-medium text-text-secondary hover:border-primary/40 hover:text-primary transition-colors">
            <Download className="h-3 w-3 shrink-0" />
            Capture One Overlay
            <span className="ml-auto  text-xs text-text-tertiary">{detailSpec}</span>
          </button>
        </div>

        {/* Add / remove */}
        <div className="px-3 pb-3 pt-1 border-t border-border">
          <button type="button"
            onClick={() => { onToggle({ channel: active.name, spec: detailSpec }); setView("list"); }}
            className={`w-full rounded-lg py-1.5 text-sm font-semibold transition-colors ${
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

  // ── List view — one tile per channel+spec ──
  const tiles = CHANNEL_TEMPLATES.flatMap((tmpl) =>
    tmpl.specs.map((spec) => ({ tmpl, spec }))
  );

  return (
    <div className="w-64">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold text-text-primary">Add channels</span>
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
              <span className="text-xs font-semibold leading-snug text-center">{tmpl.abbr ?? tmpl.name} {spec}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Draft channel chip (click = info popup, hover X = remove) ───────────────
function DraftChannelChip({ sel, tmpl, onRemove }: {
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
        className="group inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
        {tmpl?.abbr ?? sel.channel} <span className=" font-normal opacity-70">{sel.spec}</span>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={close} />
          <div ref={panelRef} style={{ ...panelStyle, width: 240 }}
            className="rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
            <div className="px-3 pt-2.5 pb-1">
              <p className="text-[13px] font-semibold text-text-primary">{tmpl?.name ?? sel.channel}</p>
              <p className=" text-xs text-text-tertiary mt-0.5">{sel.spec}</p>
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
                <span className="ml-auto  text-xs text-text-tertiary">{sel.spec}</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </span>
  );
}

// ─── Draft channel cell (used in draft / ghost rows) ─────────────────────────
function DraftChannelCell({
  selected,
  onToggle,
}: {
  selected: DraftDeliverableSel[];
  onToggle: (sel: DraftDeliverableSel) => void;
}) {
  const { anchorRef, panelStyle, open, toggle, close } = usePortalPanel<HTMLButtonElement>();

  // Close on outside click
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
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 min-h-[32px]">
      {selected.map((s) => {
        const tmpl = CHANNEL_TEMPLATES.find((t) => t.name === s.channel);
        return (
          <DraftChannelChip key={`${s.channel}|${s.spec}`} sel={s} tmpl={tmpl} onRemove={() => onToggle(s)} />
        );
      })}

      <button ref={anchorRef} type="button" onClick={toggle}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-text-tertiary border border-dashed border-border/70 hover:border-primary hover:text-primary hover:bg-primary/3 transition-colors">
        <Plus className="h-2.5 w-2.5" />
        {selected.length === 0 && <span>Add channel</span>}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={close} />
          <div ref={panelRef} style={panelStyle} className="rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
            <ChannelPickerPanel selected={selected} onToggle={onToggle} onClose={close} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Deliverable chip (on saved shots) ────────────────────────────────────────
function DeliverableChip({ del, canEdit, onRemove }: {
  del: CampaignDeliverable; canEdit: boolean; onRemove: () => void;
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

  const channelLabel = CHANNEL_TEMPLATES.find((t) => t.name === del.channel)?.abbr ?? del.channel;

  return (
    <span className="relative inline-block">
      <button ref={anchorRef} type="button" onClick={toggle}
        className="group inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
        {channelLabel} <span className=" font-normal opacity-70">{del.aspectRatio}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={close} />
          <div ref={panelRef} style={{ ...panelStyle, width: 240 }}
            className="rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
            <div className="px-3 pt-2.5 pb-1">
              <p className="text-[13px] font-semibold text-text-primary">{del.channel}</p>
              <p className=" text-xs text-text-tertiary mt-0.5">{del.format} · {del.width}×{del.height}</p>
            </div>
            <div className="px-3 pt-1 pb-1">
              <OverlayPreview spec={del.aspectRatio} />
            </div>
            <div className="px-3 pb-3">
              <button type="button"
                onClick={() => {
                  const dims = SPEC_DIMENSIONS[del.aspectRatio] ?? { width: del.width, height: del.height };
                  generateOverlayPng({ width: dims.width, height: dims.height, channel: del.channel, format: del.format, aspectRatio: del.aspectRatio });
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-2 text-sm font-medium text-text-secondary hover:border-primary/40 hover:text-primary transition-colors">
                <Download className="h-3 w-3 shrink-0" />
                Capture One Overlay
                <span className="ml-auto  text-xs text-text-tertiary">{del.aspectRatio}</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </span>
  );
}

// ─── Deliverable cell (saved shots) ───────────────────────────────────────────
function DeliverableCell({ shot, deliverables, canEdit, onMutate }: {
  shot: ShotListShot; deliverables: CampaignDeliverable[]; canEdit: boolean; onMutate: () => void;
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

  const linkedIds = new Set(shot.deliverableLinks.map((l) => l.deliverableId));
  const linked: DraftDeliverableSel[] = shot.deliverableLinks
    .map((lnk) => {
      const d = deliverables.find((x) => x.id === lnk.deliverableId);
      return d ? { channel: d.channel, spec: d.aspectRatio } : null;
    })
    .filter(Boolean) as DraftDeliverableSel[];

  async function unlink(id: string) {
    try {
      const res = await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId: id, action: "unlink" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed (${res.status})`);
      }
      onMutate();
    } catch (err) { toast("error", err instanceof Error ? err.message : "Failed to remove channel"); }
  }

  async function toggleSel(sel: DraftDeliverableSel) {
    const existing = deliverables.find(
      (d) => d.channel === sel.channel && d.aspectRatio === sel.spec
    );
    if (existing && linkedIds.has(existing.id)) {
      await unlink(existing.id);
      return;
    }
    try {
      let delId: string;
      if (existing) {
        delId = existing.id;
      } else {
        const dims = SPEC_DIMENSIONS[sel.spec] ?? { width: 1080, height: 1080 };
        const r = await fetch("/api/deliverables", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: shot.campaignId, channel: sel.channel, format: sel.spec,
            width: dims.width, height: dims.height, aspectRatio: sel.spec, quantity: 1,
          }),
        });
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || `Failed (${r.status})`);
        }
        delId = (await r.json()).id;
      }
      const linkRes = await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId: delId }),
      });
      if (!linkRes.ok) {
        const errData = await linkRes.json().catch(() => ({}));
        throw new Error(errData.error || `Link failed (${linkRes.status})`);
      }
      onMutate();
    } catch (err) { toast("error", err instanceof Error ? err.message : "Failed to add channel"); }
    close();
  }

  return (
    <div ref={addRef} className="flex flex-wrap items-center gap-1 px-2 py-1.5 min-h-[32px] h-full"
      onClick={canEdit ? toggle : undefined}
      style={canEdit ? { cursor: "cell" } : undefined}>
      {shot.deliverableLinks.map((lnk) => {
        const del = deliverables.find((d) => d.id === lnk.deliverableId);
        if (!del) return null;
        return (
          <DeliverableChip key={lnk.id} del={del} canEdit={canEdit}
            onRemove={() => unlink(del.id)} />
        );
      })}

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

// ─── Spreadsheet cell ─────────────────────────────────────────────────────────
function Cell({ value, placeholder, onSave, readOnly = false, className = "" }: {
  value: string; placeholder?: string; onSave?: (v: string) => void;
  readOnly?: boolean; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft !== value && onSave) onSave(draft);
  }

  if (readOnly) {
    return (
      <div className={`px-2 py-1.5 h-full min-h-[32px] text-sm text-text-primary ${className}`}>
        {value || "—"}
      </div>
    );
  }

  return (
    <div
      className={`relative h-full min-h-[32px] cursor-cell group ${className}`}
      onClick={() => { if (!editing) { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); } }}
    >
      {editing ? (
        <input ref={inputRef} autoFocus value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="absolute inset-0 px-2 py-1.5 text-sm bg-white dark:bg-surface outline-none z-10 ring-2 ring-inset ring-primary text-text-primary"
          placeholder={placeholder}
        />
      ) : (
        <div className={`px-2 py-1.5 text-sm h-full ${
          value ? "text-text-primary" : "text-text-tertiary/40"
        } group-hover:bg-primary/3 transition-colors`}>
          {value || placeholder}
        </div>
      )}
    </div>
  );
}

// ─── Ref image upload cell ────────────────────────────────────────────────────
function RefCell({ shotId, campaignId, value, canEdit, onMutate }: {
  shotId: string; campaignId: string; value: string | null; canEdit: boolean; onMutate: () => void;
}) {
  const { toast } = useToast();
  const { anchorRef, panelStyle, open, toggle, close } = usePortalPanel<HTMLButtonElement>();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) { toast("error", "Please select an image file"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("campaignId", campaignId); fd.append("category", "reference");
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageUrl: data.url }),
      });
      onMutate(); close();
    } catch { toast("error", "Upload failed"); }
    finally { setUploading(false); }
  }

  async function clear() {
    await fetch(`/api/shot-list/shots/${shotId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceImageUrl: null }),
    });
    onMutate();
  }

  return (
    <div className="flex items-center justify-center min-h-[32px] px-1">
      {value ? (
        <div className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Ref" onClick={() => window.open(value, "_blank")}
            className="w-8 h-8 rounded object-cover border border-border cursor-pointer hover:opacity-80 transition-opacity" />
          {canEdit && (
            <button onClick={clear}
              className="absolute -top-1 -right-1 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface border border-border text-text-tertiary hover:text-red-500">
              <X className="h-2 w-2" />
            </button>
          )}
        </div>
      ) : canEdit ? (
        <button ref={anchorRef} type="button" onClick={toggle}
          className="flex h-7 w-7 items-center justify-center rounded border border-dashed border-border text-text-tertiary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
          title="Upload reference image">
          <Upload className="h-3 w-3" />
        </button>
      ) : null}

      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={close} />
          <div ref={panelRef} style={{ ...panelStyle, width: 256 }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/50 hover:bg-primary/3"
              }`}>
              {uploading
                ? <span className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                : <Upload className={`h-6 w-6 ${dragging ? "text-primary" : "text-text-tertiary"}`} />}
              <p className="text-sm font-medium text-text-secondary text-center">
                {uploading ? "Uploading…" : "Drop image here or click to browse"}
              </p>
              <p className="text-xs text-text-tertiary">JPG, PNG, WEBP, HEIC</p>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Setup header row (editable name + delete) ────────────────────────────────
function SetupHeaderRow({ setup, canEdit, onMutate }: {
  setup: ShotListSetup; canEdit: boolean; onMutate: () => void;
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

  async function handleDelete() {
    try {
      await fetch(`/api/shot-list/setups/${setup.id}`, { method: "DELETE" });
      onMutate();
    } catch { toast("error", "Failed to delete setup"); }
  }

  const done = setup.shots.filter((s) => s.status === "Complete").length;

  return (
    <tr className="group">
      <td colSpan={7} className="border border-border/60 bg-primary/[0.06] border-l-2 border-l-primary px-3 py-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canEdit && editing ? (
              <input
                ref={inputRef} autoFocus value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveName(); }
                  if (e.key === "Escape") { setName(setup.name); setEditing(false); }
                }}
                className="text-sm font-semibold text-primary bg-transparent border-b border-primary outline-none min-w-[80px]"
              />
            ) : (
              <span
                onClick={() => canEdit && setEditing(true)}
                className={`text-sm font-semibold text-primary ${canEdit ? "cursor-pointer hover:opacity-70 transition-opacity" : ""}`}
              >
                {setup.name}
              </span>
            )}
            {setup.location && (
              <span className="text-xs text-primary/60 font-medium">{setup.location}</span>
            )}
          </div>
          {canEdit && (
            <button type="button" onClick={handleDelete} title="Delete setup"
              className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary/30 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Product cell (search inventory + free-text) ──────────────────────────────
function ProductCell({
  shot,
  campaignId,
  campaignProducts,
  canEdit,
  onMutate,
  onViewProduct,
}: {
  shot: ShotListShot;
  campaignId: string;
  campaignProducts: CampaignProduct[];
  canEdit: boolean;
  onMutate: () => void;
  onViewProduct: (id: string) => void;
}) {
  const { toast } = useToast();
  const { anchorRef, panelStyle, open, toggle, close } = usePortalPanel<HTMLDivElement>();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);

  // Existing product links resolved against campaignProducts
  const linked = (shot.productLinks || [])
    .map((lnk) => {
      const cp = campaignProducts.find((p) => p.id === lnk.campaignProductId);
      return cp ? { lnk, cp } : null;
    })
    .filter(Boolean) as { lnk: (typeof shot.productLinks)[0]; cp: CampaignProduct }[];

  const linkedProductIds = new Set(
    linked.map((l) => l.cp.productId)
  );

  // Debounced product search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) { setResults([]); return; }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=8`);
        if (res.ok) setResults(await res.json());
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 200);
    return () => clearTimeout(id);
  }, [query, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); }
    else { setQuery(""); setResults([]); }
  }, [open]);

  // Close on outside click
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

  async function addProduct(productId?: string, customName?: string) {
    if (adding) return;
    setAdding(true);
    try {
      // 1. Ensure product is linked to campaign (creates ad-hoc product if name-only)
      const body = productId ? { productId } : { name: customName };
      const cpRes = await fetch(`/api/campaigns/${campaignId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!cpRes.ok) throw new Error("Failed to link product to campaign");
      const cp: CampaignProduct = await cpRes.json();

      // 2. Link campaign product to this shot
      const linkRes = await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignProductId: cp.id }),
      });
      if (!linkRes.ok) throw new Error("Failed to link product to shot");

      onMutate();
      setQuery("");
      setResults([]);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to add product");
    } finally {
      setAdding(false);
    }
  }

  async function removeProduct(campaignProductId: string) {
    try {
      const res = await fetch(`/api/shot-list/shots/${shot.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignProductId, action: "unlink" }),
      });
      if (!res.ok) throw new Error("Failed to remove product");
      onMutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to remove product");
    }
  }

  const trimmedQuery = query.trim();
  // Show "add custom" option when query is non-empty and doesn't exactly match a result
  const hasExactMatch = results.some(
    (r) => r.name.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCustomOption = trimmedQuery.length > 0 && !hasExactMatch;

  return (
    <div ref={anchorRef} className="flex flex-wrap items-center gap-1 px-2 py-1.5 min-h-[32px] h-full">
      {/* Existing product chips */}
      {linked.map(({ lnk, cp }) => (
        <span key={lnk.id} className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-700 max-w-[160px]">
          <button
            type="button"
            onClick={() => cp.product && onViewProduct(cp.product.id)}
            className="truncate hover:underline cursor-pointer"
          >
            {cp.product?.name ?? "Product"}
          </button>
          {cp.product?.itemCode && (
            <span className="text-[10px] opacity-70 shrink-0">{cp.product.itemCode}</span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeProduct(cp.id); }}
              className="shrink-0 ml-0.5 text-amber-500 hover:text-red-500 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
      ))}

      {/* Empty state */}
      {linked.length === 0 && !canEdit && (
        <span className="text-text-tertiary/40 text-sm">—</span>
      )}

      {/* Add button — only when canEdit */}
      {canEdit && (
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-text-tertiary border border-dashed border-border/70 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 transition-colors"
        >
          <Plus className="h-2.5 w-2.5" />
          {linked.length === 0 && <span>Add</span>}
        </button>
      )}

      {/* Search panel */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={close} />
          <div ref={panelRef} style={{ ...panelStyle, width: 260 }}
            className="rounded-xl border border-border bg-surface shadow-xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && trimmedQuery && showCustomOption) {
                    addProduct(undefined, trimmedQuery);
                    close();
                  }
                  if (e.key === "Escape") close();
                }}
                placeholder="Search products…"
                className="flex-1 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-tertiary"
              />
              {searching && (
                <span className="h-3 w-3 rounded-full border border-text-tertiary border-t-transparent animate-spin shrink-0" />
              )}
            </div>

            {/* Results */}
            <div className="max-h-48 overflow-y-auto">
              {results.length > 0 && (
                <div className="py-1">
                  {results.map((product) => {
                    const alreadyLinked = linkedProductIds.has(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        disabled={alreadyLinked || adding}
                        onClick={() => { addProduct(product.id); close(); }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                          alreadyLinked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-surface-secondary"
                        }`}
                      >
                        <span className="text-sm text-text-primary truncate">{product.name}</span>
                        {product.itemCode ? (
                          <span className="text-[10px] text-text-tertiary shrink-0 ml-2">{product.itemCode}</span>
                        ) : (
                          <span className="text-[10px] text-text-tertiary/50 shrink-0 ml-2">no code</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom / free-text option */}
              {showCustomOption && (
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => { addProduct(undefined, trimmedQuery); close(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-50 transition-colors border-t border-border/60"
                >
                  <Plus className="h-3 w-3 text-amber-500 shrink-0" />
                  <span className="text-sm text-amber-700">Add &ldquo;{trimmedQuery}&rdquo;</span>
                </button>
              )}

              {/* Empty state */}
              {!searching && trimmedQuery && results.length === 0 && !showCustomOption && (
                <p className="px-3 py-3 text-xs text-text-tertiary text-center">No inventory match — press Enter to add as custom</p>
              )}

              {!trimmedQuery && (
                <p className="px-3 py-3 text-xs text-text-tertiary text-center">Type to search inventory</p>
              )}
            </div>

            {/* Add new product to inventory */}
            <div className="border-t border-border/60">
              <button
                type="button"
                onClick={() => { close(); setShowNewProductModal(true); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-secondary transition-colors"
              >
                <Plus className="h-3 w-3 text-text-tertiary shrink-0" />
                <span className="text-xs text-text-secondary">Add new product to inventory</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* New product modal — full ProductDrawer, portaled to body to escape table DOM */}
      {showNewProductModal && typeof document !== "undefined" && createPortal(
        <ProductDrawer
          product={null}
          canEdit={true}
          onClose={() => setShowNewProductModal(false)}
          onSaved={async (saved) => {
            setShowNewProductModal(false);
            if (saved) {
              // Auto-link the new product to campaign + shot
              await addProduct(saved.id);
            }
          }}
          onDeleted={() => setShowNewProductModal(false)}
        />,
        document.body
      )}
    </div>
  );
}

// ─── Saved shot row ───────────────────────────────────────────────────────────
function ShotRow({ shot, deliverables, campaignProducts, campaignId, wfNumber, shotIndex, canEdit, canComplete, onMutate,
  isDragOver, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  shot: ShotListShot; deliverables: CampaignDeliverable[];
  campaignProducts: CampaignProduct[];
  campaignId: string; wfNumber?: string; shotIndex?: number;
  canEdit: boolean; canComplete: boolean; onMutate: () => void;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const { toast } = useToast();
  const [viewProductId, setViewProductId] = useState<string | null>(null);

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

  return (
    <>
      {viewProductId && typeof document !== "undefined" && createPortal(
        <ProductDetailModal
          productId={viewProductId}
          open={!!viewProductId}
          onClose={() => setViewProductId(null)}
        />,
        document.body
      )}
    <tr
      draggable={canEdit}
      onDragStart={canEdit ? onDragStart : undefined}
      onDragOver={canEdit ? onDragOver : undefined}
      onDrop={canEdit ? onDrop : undefined}
      onDragEnd={canEdit ? onDragEnd : undefined}
      className={`group transition-colors ${isDragOver ? "outline outline-2 outline-primary/50 outline-offset-[-1px]" : ""} bg-white hover:bg-primary/[0.015]`}
    >
      {/* Drag handle */}
      <td className="border border-border/60 w-5 p-0">
        <div className="flex items-center justify-center min-h-[32px]">
          {canEdit && (
            <span className="text-text-tertiary/25 group-hover:text-text-tertiary/50 transition-colors cursor-grab active:cursor-grabbing">
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </td>
      <td className="border border-border/60 p-0 w-28">
        <Cell value={shot.name} placeholder="Shot name…" onSave={(v) => patch({ name: v })} />
      </td>
      <td className="border border-border/60 p-0 w-52">
        <DeliverableCell shot={shot} deliverables={deliverables} canEdit={canEdit} onMutate={onMutate} />
      </td>
      <td className="border border-border/60 p-0">
        <Cell value={shot.description} placeholder="Description…" onSave={(v) => patch({ description: v })} />
      </td>
      <td className="border border-border/60 p-0 w-40">
        <ProductCell
          shot={shot}
          campaignId={campaignId}
          campaignProducts={campaignProducts}
          canEdit={canEdit}
          onMutate={onMutate}
          onViewProduct={(id) => setViewProductId(id)}
        />
      </td>
      <td className="border border-border/60 p-0 w-12">
        <RefCell shotId={shot.id} campaignId={campaignId} value={shot.referenceImageUrl} canEdit={canEdit} onMutate={onMutate} />
      </td>
      <td className="border border-border/60 p-0 w-8">
        <div className="flex items-center justify-center min-h-[32px]">
          {canEdit && (
            <button type="button" onClick={handleDelete} title="Delete shot"
              className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary/30 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>
    </tr>
    </>
  );
}


// ─── Bottom bar ───────────────────────────────────────────────────────────────
function BottomBar({ setups, campaignId, wf, date, onMutate, onAddSetup, onResetNaming, resetNamingDisabled }: {
  setups: ShotListSetup[]; campaignId: string;
  wf?: string; date?: string; onMutate: () => void; onAddSetup: () => void;
  onResetNaming: () => void; resetNamingDisabled: boolean;
}) {
  const { toast } = useToast();
  const [addingShot, setAddingShot] = useState(false);
  const lastSetup = setups[setups.length - 1];

  let globalIdx = 1;
  for (const s of setups) globalIdx += s.shots.length + 1;
  const nextShotIdx = globalIdx - 1;

  async function addShot() {
    if (!lastSetup) return;
    setAddingShot(true);
    try {
      const res = await fetch("/api/shot-list/shots", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupId: lastSetup.id, campaignId,
          name: buildShotName(wf, date, nextShotIdx),
          sortOrder: lastSetup.shots.length,
        }),
      });
      if (!res.ok) throw new Error();
      onMutate();
    } catch { toast("error", "Failed to add shot"); }
    finally { setAddingShot(false); }
  }

  return (
    <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
      <div className="flex items-center gap-4">
        <button type="button" onClick={addShot} disabled={addingShot || !lastSetup}
          className="flex items-center gap-1.5 text-sm font-medium text-text-tertiary hover:text-primary transition-colors disabled:opacity-40">
          {addingShot
            ? <span className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
            : <Plus className="h-3 w-3" />}
          Add Shot
        </button>
        <button type="button" onClick={onAddSetup}
          className="flex items-center gap-1.5 text-sm font-medium text-text-tertiary hover:text-primary transition-colors">
          <Plus className="h-3 w-3" />
          Add Scene
        </button>
      </div>
      <button
        type="button"
        onClick={onResetNaming}
        disabled={resetNamingDisabled}
        title={resetNamingDisabled ? "Cannot reset naming after shoot is complete" : "Renumber shots based on current order"}
        className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary/60 hover:text-text-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <RotateCcw className="h-3 w-3" />
        Reset Naming
      </button>
    </div>
  );
}

// ─── Main spreadsheet ─────────────────────────────────────────────────────────
interface Props {
  setups: ShotListSetup[];
  deliverables: CampaignDeliverable[];
  campaignProducts?: CampaignProduct[];
  campaignId: string;
  wfNumber?: string;
  firstShootDate?: string;
  canEdit: boolean;
  canComplete: boolean;
  campaignStatus: CampaignStatus;
  onAddSetup: () => void;
  onMutate: () => void;
}

export function ShotListSpreadsheet({
  setups, deliverables, campaignProducts = [], campaignId, wfNumber, firstShootDate,
  canEdit, canComplete, campaignStatus, onAddSetup, onMutate,
}: Props) {
  const { toast } = useToast();

  // Local copy of setups for optimistic drag reordering
  const [localSetups, setLocalSetups] = useState(setups);
  useEffect(() => setLocalSetups(setups), [setups]);

  // Drag state (using ref for the dragged item to avoid re-render during drag)
  const dragRef = useRef<{ shotId: string; setupId: string } | null>(null);
  const [dragOverShotId, setDragOverShotId] = useState<string | null>(null);

  function handleShotDragStart(shotId: string, setupId: string) {
    dragRef.current = { shotId, setupId };
  }

  function handleShotDragOver(e: React.DragEvent, shotId: string, setupId: string) {
    e.preventDefault();
    if (!dragRef.current || dragRef.current.setupId !== setupId) return;
    if (dragRef.current.shotId !== shotId) setDragOverShotId(shotId);
  }

  async function handleShotDrop(targetShotId: string, targetSetupId: string) {
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

    // Optimistic update
    setLocalSetups((prev) => prev.map((s) => s.id === targetSetupId ? { ...s, shots } : s));

    // Commit new sortOrder for all shots in the setup
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
      onMutate();
    } catch {
      toast("error", "Failed to reorder shots");
      setLocalSetups(setups);
    }
  }

  function handleShotDragEnd() {
    dragRef.current = null;
    setDragOverShotId(null);
  }

  // Reset naming
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const shootComplete = campaignStatus === "Post" || campaignStatus === "Complete";

  async function handleResetNaming() {
    setResetting(true);
    try {
      let idx = 1;
      const patches: Promise<Response>[] = [];
      for (const setup of localSetups) {
        for (const shot of setup.shots) {
          const newName = buildShotName(wfNumber, firstShootDate, idx);
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
      onMutate();
      setShowResetConfirm(false);
    } catch {
      toast("error", "Failed to reset naming");
    } finally {
      setResetting(false);
    }
  }

  if (localSetups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 px-5">
        {canEdit && (
          <button type="button" onClick={onAddSetup}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors">
            <Plus className="h-3 w-3" />
            Add Scene
          </button>
        )}
      </div>
    );
  }

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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="bg-surface-secondary/80">
              <th className="border border-border/60 w-5" />
              <th className="border border-border/60 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary w-28">Shot</th>
              <th className="border border-border/60 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary w-52">Channel</th>
              <th className="border border-border/60 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Description</th>
              <th className="border border-border/60 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary w-36">Products</th>
              <th className="border border-border/60 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-text-tertiary w-12">Ref</th>
              <th className="border border-border/60 w-8" />
            </tr>
          </thead>
          <tbody>
            {(() => {
              let globalShotIdx = 0;
              return localSetups.map((setup) => (
              <Fragment key={setup.id}>
                <SetupHeaderRow setup={setup} canEdit={canEdit} onMutate={onMutate} />
                {setup.shots.map((shot) => {
                  globalShotIdx++;
                  return (
                  <ShotRow
                    key={shot.id}
                    shot={shot}
                    deliverables={deliverables}
                    campaignProducts={campaignProducts}
                    campaignId={campaignId}
                    wfNumber={wfNumber}
                    shotIndex={globalShotIdx}
                    canEdit={canEdit}
                    canComplete={canComplete}
                    onMutate={onMutate}
                    isDragOver={dragOverShotId === shot.id}
                    onDragStart={() => handleShotDragStart(shot.id, setup.id)}
                    onDragOver={(e) => handleShotDragOver(e, shot.id, setup.id)}
                    onDrop={() => handleShotDrop(shot.id, setup.id)}
                    onDragEnd={handleShotDragEnd}
                  />
                  );
                })}
              </Fragment>
            ));
            })()}
          </tbody>
        </table>

        {canEdit && (
          <BottomBar
            setups={localSetups}
            campaignId={campaignId}
            wf={wfNumber}
            date={firstShootDate}
            onMutate={onMutate}
            onAddSetup={onAddSetup}
            onResetNaming={() => setShowResetConfirm(true)}
            resetNamingDisabled={shootComplete}
          />
        )}
      </div>
    </>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import { Download, List, GripVertical, Plus, Trash2, ChevronLeft, X, Upload, UserPlus, User } from "lucide-react";
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
  embedded?: boolean;
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
    campaign_id: string;
    name: string;
    description: string;
    angle: string;
    media_type: string;
    location: string;
    notes: string;
    talent: string;
    props: string;
    wardrobe: string;
    surface: string;
    lighting: string;
    priority: string;
    retouching_notes: string;
    reference_image_url: string | null;
    product_tags: string;
    sort_order: number;
    estimated_duration_minutes: number;
    shoot_date_id: string | null;
  }>;
  links: Array<{ shot_id: string; deliverable_id: string }>;
  productLinks: Array<{ shot_id: string; campaign_product_id: string }>;
  talent: Array<{
    id: string;
    shot_id: string;
    campaign_id: string;
    talent_number: number;
    label: string;
    age_range: string;
    gender: string;
    ethnicity: string;
    skin_tone: string;
    hair: string;
    build: string;
    wardrobe_notes: string;
    notes: string;
  }>;
  deliverables: Array<{ id: string; channel: string; format: string; aspect_ratio: string }>;
  campaignProducts: Array<{ id: string; product_id: string; product: { id: string; name: string; item_code: string | null; department: string | null; description: string | null; shooting_notes: string | null; image_url: string | null } | null }>;
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
          className="absolute inset-0 px-[var(--density-shotlist-row-cell-px)] py-[var(--density-shotlist-row-cell-py)] text-xs bg-white outline-none z-10 ring-2 ring-inset ring-primary text-text-primary"
          placeholder={placeholder}
        />
      ) : (
        <div
          className={`px-[var(--density-shotlist-row-cell-px)] py-[var(--density-shotlist-row-cell-py)] text-xs h-full ${
            value ? "text-text-primary" : "text-text-tertiary/40"
          } group-hover:bg-primary/3 transition-colors`}
        >
          {value || placeholder || "—"}
        </div>
      )}
    </td>
  );
}

// ─── Ref image cell (click to upload) ────────────────────────────────────────
function RefImageCell({
  shotId,
  campaignId,
  url,
  swrKey,
}: {
  shotId: string;
  campaignId: string;
  url: string | null;
  swrKey: string;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { toast("error", "Please select an image"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("campaignId", campaignId);
      fd.append("category", "Reference");
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageUrl: data.fileUrl }),
      });
      globalMutate(swrKey);
    } catch { toast("error", "Upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <td className="px-1 py-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      {uploading ? (
        <div className="flex items-center justify-center h-6 w-6">
          <div className="h-3 w-3 rounded-full border border-primary border-t-transparent animate-spin" />
        </div>
      ) : url ? (
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Ref"
            onClick={() => setLightbox(true)}
            className="h-6 w-6 rounded object-cover border border-border cursor-zoom-in hover:opacity-80 transition-opacity"
          />
          {/* Replace button on hover */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="absolute -top-1 -right-1 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white border border-border shadow-sm text-text-tertiary hover:text-primary transition-colors"
          >
            <Upload className="h-2 w-2" />
          </button>
          {/* Lightbox */}
          {lightbox && typeof document !== "undefined" && createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
              onClick={() => setLightbox(false)}
            >
              <div className="relative max-w-[80vw] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Reference" className="max-w-full max-h-[80vh] rounded-lg object-contain" />
                <button
                  type="button"
                  onClick={() => setLightbox(false)}
                  className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-lg text-text-primary hover:bg-surface-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setLightbox(false); inputRef.current?.click(); }}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-text-primary shadow-lg hover:bg-white transition-colors"
                >
                  <Upload className="h-3 w-3" />
                  Replace
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center h-6 w-6 rounded border border-dashed border-border/60 text-text-tertiary/30 hover:border-primary/40 hover:text-primary/50 transition-colors"
        >
          <Upload className="h-3 w-3" />
        </button>
      )}
    </td>
  );
}

// ─── Product info popover ────────────────────────────────────────────────────
function ProductPopover({
  product,
  onClose,
  onUnlink,
}: {
  product: { cpId: string; name: string; itemCode: string | null; department: string | null; description: string | null; shootingNotes: string | null; imageUrl: string | null };
  onClose: () => void;
  onUnlink: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Position near center of viewport
    setPos({ top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - 140 });
  }, []);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] w-72 rounded-xl border border-border bg-surface shadow-xl overflow-hidden"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-3.5 py-3 border-b border-border">
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <span className="text-warning text-sm font-bold">{product.name.charAt(0)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary leading-tight">{product.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {product.itemCode && <span className="text-[10px] text-text-tertiary">{product.itemCode}</span>}
            {product.department && <span className="text-[10px] text-text-tertiary">{product.department}</span>}
          </div>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Details */}
      {(product.description || product.shootingNotes) && (
        <div className="px-3.5 py-2.5 space-y-2 text-xs">
          {product.description && (
            <div>
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-0.5">Description</p>
              <p className="text-text-secondary leading-relaxed">{product.description}</p>
            </div>
          )}
          {product.shootingNotes && (
            <div>
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-0.5">Shooting Notes</p>
              <p className="text-text-secondary leading-relaxed">{product.shootingNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-3.5 py-2 border-t border-border">
        <button
          type="button"
          onClick={onUnlink}
          className="text-[10px] font-medium text-red-500 hover:text-error transition-colors"
        >
          Remove from shot
        </button>
      </div>
    </div>
  );
}

// ─── Product tag cell (search + free-text) ──────────────────────────────────
interface ProductResult { id: string; name: string; itemCode: string | null; department: string }

function ProductTagCell({
  shotId,
  campaignId,
  linkedProducts,
  freeTextTags,
  swrKey,
}: {
  shotId: string;
  campaignId: string;
  linkedProducts: Array<{ cpId: string; name: string; itemCode: string | null; department: string | null; description: string | null; shootingNotes: string | null; imageUrl: string | null }>;
  freeTextTags: string[];
  swrKey: string;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLTableCellElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults((data.products || data || []).map((p: Record<string, string | null>) => ({
            id: p.id, name: p.name, itemCode: p.item_code ?? p.itemCode, department: p.department,
          })));
          setHighlightIdx(0);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    if (!editing) return;
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        commitText();
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing, query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function linkProduct(productId: string) {
    try {
      // Step 1: ensure product is linked to campaign
      const cpRes = await fetch("/api/campaign-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, productId }),
      });
      const cpData = await cpRes.json();
      const cpId = cpData.id || cpData.campaignProduct?.id;
      if (!cpId) throw new Error();

      // Step 2: link campaign product to shot
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignProductId: cpId, action: "link" }),
      });
      globalMutate(swrKey);
    } catch {
      toast("error", "Failed to link product");
    }
    setQuery("");
    setResults([]);
  }

  async function unlinkProduct(cpId: string) {
    try {
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignProductId: cpId, action: "unlink" }),
      });
      globalMutate(swrKey);
    } catch { toast("error", "Failed to unlink product"); }
  }

  function commitText() {
    const text = query.replace(/,+$/, "").trim();
    if (!text) return;
    // Check if it matches a result
    const match = results.find((r) => r.name.toLowerCase() === text.toLowerCase());
    if (match) {
      linkProduct(match.id);
    } else {
      // Add as free text tag
      const current = freeTextTags.filter(Boolean);
      if (!current.includes(text)) {
        const updated = [...current, text].join(", ");
        fetch(`/api/shot-list/shots/${shotId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productTags: updated }),
        }).then(() => globalMutate(swrKey)).catch(() => toast("error", "Failed to save"));
      }
    }
    setQuery("");
    setResults([]);
  }

  function removeFreeTag(tag: string) {
    const updated = freeTextTags.filter((t) => t !== tag).join(", ");
    fetch(`/api/shot-list/shots/${shotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productTags: updated }),
    }).then(() => globalMutate(swrKey)).catch(() => toast("error", "Failed to save"));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0 && e.key === "Enter") {
        linkProduct(results[highlightIdx]?.id || results[0].id);
      } else {
        commitText();
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setResults([]);
      setEditing(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Backspace" && !query) {
      // Remove last tag
      if (freeTextTags.length > 0) {
        removeFreeTag(freeTextTags[freeTextTags.length - 1]);
      } else if (linkedProducts.length > 0) {
        unlinkProduct(linkedProducts[linkedProducts.length - 1].cpId);
      }
    }
  }

  const hasTags = linkedProducts.length > 0 || freeTextTags.length > 0;
  const [popoverProduct, setPopoverProduct] = useState<typeof linkedProducts[number] | null>(null);

  if (!editing) {
    return (
      <td className="px-[var(--density-shotlist-chip-cell-px)] py-[var(--density-shotlist-chip-cell-py)] overflow-hidden relative">
        {hasTags ? (
          <div className="flex flex-col gap-0.5 overflow-hidden">
            {linkedProducts.map((p) => (
              <span
                key={p.cpId}
                onClick={(e) => { e.stopPropagation(); setPopoverProduct(popoverProduct?.cpId === p.cpId ? null : p); }}
                className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-warning max-w-full overflow-hidden cursor-pointer hover:border-amber-400 transition-colors"
              >
                <span className="truncate min-w-0">{p.name}</span>
                {p.itemCode && <span className="opacity-60 shrink-0">{p.itemCode}</span>}
              </span>
            ))}
            {freeTextTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-surface-secondary border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-secondary max-w-full overflow-hidden">
                <span className="truncate min-w-0">{tag}</span>
              </span>
            ))}
            {/* Click below chips to add more */}
            <button
              type="button"
              onClick={() => { setPopoverProduct(null); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
              className="text-[10px] text-text-tertiary/40 hover:text-primary/60 transition-colors text-left mt-0.5"
            >
              + add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="text-xs text-text-tertiary/40 hover:text-text-tertiary/60 transition-colors w-full text-left"
          >
            Products
          </button>
        )}

        {/* Product info popover */}
        {popoverProduct && typeof document !== "undefined" && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setPopoverProduct(null)} />
            <ProductPopover product={popoverProduct} onClose={() => setPopoverProduct(null)} onUnlink={() => { unlinkProduct(popoverProduct.cpId); setPopoverProduct(null); }} />
          </>,
          document.body
        )}
      </td>
    );
  }

  return (
    <td className="px-0 py-0 relative overflow-hidden" ref={dropRef}>
      <div className="flex flex-col gap-0.5 px-[var(--density-shotlist-chip-cell-px)] py-[var(--density-shotlist-chip-cell-py)] min-h-[32px] ring-2 ring-inset ring-primary bg-white overflow-hidden">
        {/* Linked product chips */}
        {linkedProducts.map((p) => (
          <span key={p.cpId} className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-warning max-w-full overflow-hidden">
            <span className="truncate min-w-0">{p.name}</span>
            {p.itemCode && <span className="opacity-60 shrink-0">{p.itemCode}</span>}
            <button type="button" onClick={() => unlinkProduct(p.cpId)} className="ml-0.5 shrink-0 hover:text-red-500 transition-colors">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {/* Free text chips */}
        {freeTextTags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-surface-secondary border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-secondary max-w-full overflow-hidden">
            <span className="truncate min-w-0">{tag}</span>
            <button type="button" onClick={() => removeFreeTag(tag)} className="ml-0.5 shrink-0 hover:text-red-500 transition-colors">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {/* Input */}
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasTags ? "" : "Search products…"}
          className="flex-1 min-w-[80px] text-xs bg-transparent outline-none text-text-primary placeholder:text-text-tertiary/40"
        />
      </div>

      {/* Dropdown */}
      {(results.length > 0 || (loading && query)) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-0.5 rounded-lg border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-tertiary">Searching…</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); linkProduct(r.id); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                i === highlightIdx ? "bg-primary/5 text-primary" : "text-text-primary hover:bg-surface-secondary"
              }`}
            >
              <span className="font-medium">{r.name}</span>
              {r.itemCode && <span className="text-text-tertiary">{r.itemCode}</span>}
              <span className="ml-auto text-[10px] text-text-tertiary">{r.department}</span>
            </button>
          ))}
          {!loading && query.trim() && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-tertiary">
              No matches — press <kbd className="rounded border border-border px-1 py-0.5 text-[10px]">,</kbd> to add as text
            </div>
          )}
        </div>
      )}
    </td>
  );
}

// ─── Add Talent Modal ────────────────────────────────────────────────────────
const AGE_OPTIONS = ["Child (2-6)", "Child (7-12)", "Teen", "20s", "30s", "40s", "50s", "60+", "Open"];
const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Open"];
const SKIN_TONE_OPTIONS = ["Light", "Medium", "Medium-Deep", "Deep", "Open"];

function AddTalentModal({
  open,
  onClose,
  shotId,
  campaignId,
  existingTalent,
  swrKey,
}: {
  open: boolean;
  onClose: () => void;
  shotId: string;
  campaignId: string;
  existingTalent: ScheduleData["talent"];
  swrKey: string;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [saving, setSaving] = useState(false);

  // Form state for new talent
  const [label, setLabel] = useState("");
  const [ageRange, setAgeRange] = useState("Open");
  const [gender, setGender] = useState("Open");
  const [ethnicity, setEthnicity] = useState("");
  const [skinTone, setSkinTone] = useState("Open");
  const [hair, setHair] = useState("");
  const [build, setBuild] = useState("");
  const [wardrobeNotes, setWardrobeNotes] = useState("");
  const [notes, setNotes] = useState("");

  // Unique talent across campaign (by talent_number)
  const campaignTalent = existingTalent.reduce((acc, t) => {
    if (!acc.find((x) => x.talent_number === t.talent_number)) acc.push(t);
    return acc;
  }, [] as typeof existingTalent);

  // Which talent_numbers are already on this shot
  const shotTalentNumbers = new Set(existingTalent.filter((t) => t.shot_id === shotId).map((t) => t.talent_number));
  const assignable = campaignTalent.filter((t) => !shotTalentNumbers.has(t.talent_number));

  // Auto-switch to create if no existing talent to assign
  useEffect(() => {
    if (open) {
      setMode(assignable.length > 0 ? "pick" : "create");
      setLabel(""); setAgeRange("Open"); setGender("Open"); setEthnicity("");
      setSkinTone("Open"); setHair(""); setBuild(""); setWardrobeNotes(""); setNotes("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function assignExisting(talentNumber: number) {
    const source = campaignTalent.find((t) => t.talent_number === talentNumber);
    if (!source) return;
    setSaving(true);
    try {
      await fetch("/api/shot-list/talent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId, campaignId, talentNumber,
          label: source.label, ageRange: source.age_range, gender: source.gender,
          ethnicity: source.ethnicity, skinTone: source.skin_tone, hair: source.hair,
          build: source.build,
        }),
      });
      globalMutate(swrKey);
      onClose();
    } catch { toast("error", "Failed to assign talent"); }
    finally { setSaving(false); }
  }

  async function createNew(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/shot-list/talent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId, campaignId,
          label, ageRange, gender,
          ethnicity: ethnicity || "Open",
          skinTone, hair: hair || "Open", build: build || "Open",
          wardrobeNotes, notes,
        }),
      });
      globalMutate(swrKey);
      onClose();
    } catch { toast("error", "Failed to add talent"); }
    finally { setSaving(false); }
  }

  if (!open) return null;

  const nextNum = campaignTalent.length > 0
    ? Math.max(...campaignTalent.map((t) => t.talent_number)) + 1
    : 1;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-text-primary">Add Talent</h3>
          </div>
          <button type="button" onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toggle if there are existing talent to assign */}
        {assignable.length > 0 && (
          <div className="flex border-b border-border">
            <button type="button" onClick={() => setMode("pick")}
              className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${mode === "pick" ? "text-primary bg-primary/5" : "text-text-tertiary hover:text-text-secondary"}`}>
              Assign Existing
            </button>
            <button type="button" onClick={() => setMode("create")}
              className={`flex-1 px-4 py-2 text-xs font-medium border-l border-border transition-colors ${mode === "create" ? "text-primary bg-primary/5" : "text-text-tertiary hover:text-text-secondary"}`}>
              New Talent
            </button>
          </div>
        )}

        {mode === "pick" ? (
          <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
            {assignable.map((t) => (
              <button key={t.talent_number} type="button" onClick={() => assignExisting(t.talent_number)}
                disabled={saving}
                className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  T{t.talent_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{t.label || `Talent ${t.talent_number}`}</p>
                  <p className="text-[10px] text-text-tertiary">
                    {[t.age_range, t.gender, t.ethnicity].filter((v) => v && v !== "Open").join(" · ") || "Open casting"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={createNew} className="p-4 space-y-3">
            {/* Talent number badge */}
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                T{nextNum}
              </span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Role label — Mom, Chef, Hero…"
                className="flex-1 text-sm font-medium text-text-primary bg-transparent border-b border-border focus:border-primary outline-none py-1 placeholder:text-text-tertiary/40" />
            </div>

            {/* Demographics grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Age Range</label>
                <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:outline-none">
                  {AGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:outline-none">
                  {GENDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Ethnicity</label>
                <input value={ethnicity} onChange={(e) => setEthnicity(e.target.value)} placeholder="Open — or per brief"
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary/40 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Skin Tone</label>
                <select value={skinTone} onChange={(e) => setSkinTone(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary focus:outline-none">
                  {SKIN_TONE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Hair</label>
                <input value={hair} onChange={(e) => setHair(e.target.value)} placeholder="Open"
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary/40 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Build</label>
                <input value={build} onChange={(e) => setBuild(e.target.value)} placeholder="Open"
                  className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary/40 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Wardrobe for this shot</label>
              <input value={wardrobeNotes} onChange={(e) => setWardrobeNotes(e.target.value)} placeholder="What they're wearing…"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary/40 focus:outline-none" />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Other casting notes…"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary/40 focus:outline-none" />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
              <button type="submit" disabled={saving}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? "Adding…" : `Add Talent ${nextNum}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Talent cell ─────────────────────────────────────────────────────────────
function TalentCell({
  shotId,
  campaignId,
  shotTalent,
  allTalent,
  swrKey,
}: {
  shotId: string;
  campaignId: string;
  shotTalent: ScheduleData["talent"];
  allTalent: ScheduleData["talent"];
  swrKey: string;
}) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [popover, setPopover] = useState<ScheduleData["talent"][number] | null>(null);

  async function removeTalent(id: string) {
    try {
      await fetch(`/api/shot-list/talent?id=${id}`, { method: "DELETE" });
      globalMutate(swrKey);
      setPopover(null);
    } catch { toast("error", "Failed to remove talent"); }
  }

  return (
    <td className="px-2 py-1.5 overflow-hidden">
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {shotTalent.map((t) => (
          <span
            key={t.id}
            onClick={() => setPopover(popover?.id === t.id ? null : t)}
            className="inline-flex items-center gap-1 rounded bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 max-w-full overflow-hidden cursor-pointer hover:border-violet-400 transition-colors"
          >
            <span className="font-bold shrink-0">T{t.talent_number}</span>
            <span className="truncate min-w-0">{t.label || `Talent ${t.talent_number}`}</span>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-0.5 text-[10px] text-text-tertiary/40 hover:text-primary/60 transition-colors w-fit"
        >
          <UserPlus className="h-2.5 w-2.5" />
          {shotTalent.length === 0 ? "" : ""}
        </button>
      </div>

      {/* Talent detail popover */}
      {popover && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setPopover(null)} />
          <div
            className="fixed z-[9999] w-64 rounded-xl border border-border bg-surface shadow-xl overflow-hidden"
            style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">T{popover.talent_number}</span>
                <span className="text-sm font-semibold text-text-primary">{popover.label || `Talent ${popover.talent_number}`}</span>
              </div>
              <button type="button" onClick={() => setPopover(null)} className="text-text-tertiary hover:text-text-primary transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-3.5 py-2.5 space-y-1.5 text-xs">
              {[
                ["Age", popover.age_range],
                ["Gender", popover.gender],
                ["Ethnicity", popover.ethnicity],
                ["Skin Tone", popover.skin_tone],
                ["Hair", popover.hair],
                ["Build", popover.build],
              ].map(([label, value]) => (
                value && value !== "Open" ? (
                  <div key={label} className="flex justify-between">
                    <span className="text-text-tertiary">{label}</span>
                    <span className="text-text-primary font-medium">{value}</span>
                  </div>
                ) : null
              ))}
              {popover.wardrobe_notes && (
                <div className="pt-1 border-t border-border/60">
                  <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Wardrobe</span>
                  <p className="text-text-secondary mt-0.5">{popover.wardrobe_notes}</p>
                </div>
              )}
              {popover.notes && (
                <div className="pt-1 border-t border-border/60">
                  <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Notes</span>
                  <p className="text-text-secondary mt-0.5">{popover.notes}</p>
                </div>
              )}
              {/* Show "Open casting" if all fields are Open */}
              {["age_range", "gender", "ethnicity", "skin_tone", "hair", "build"].every(
                (k) => !popover[k as keyof typeof popover] || popover[k as keyof typeof popover] === "Open"
              ) && (
                <p className="text-text-tertiary italic">Open casting — no specific requirements</p>
              )}
            </div>
            <div className="px-3.5 py-2 border-t border-border">
              <button type="button" onClick={() => removeTalent(popover.id)}
                className="text-[10px] font-medium text-red-500 hover:text-error transition-colors">
                Remove from shot
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      <AddTalentModal
        open={showModal}
        onClose={() => setShowModal(false)}
        shotId={shotId}
        campaignId={campaignId}
        existingTalent={allTalent}
        swrKey={swrKey}
      />
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
        className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors whitespace-nowrap">
        {tmpl?.abbr ?? sel.channel} <span className="font-normal opacity-70">{sel.spec}</span>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={close} />
          <div ref={panelRef} style={{ ...panelStyle, width: 240 }}
            className="rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
            <div className="relative px-3 pt-2.5 pb-1">
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <button type="button" onClick={() => { onRemove(); close(); }}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove channel">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={close}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
                  title="Close">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] font-semibold text-text-primary pr-16">{tmpl?.name ?? sel.channel}</p>
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
  campaignId,
  data,
  swrKey,
}: {
  shotId: string;
  campaignId: string;
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
      let delId: string;
      if (existing) {
        delId = existing.id;
      } else {
        const dims = SPEC_DIMENSIONS[sel.spec] ?? { width: 1080, height: 1080 };
        const r = await fetch("/api/deliverables", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId, channel: sel.channel, format: sel.spec,
            width: dims.width, height: dims.height, aspectRatio: sel.spec, quantity: 1,
          }),
        });
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        delId = (await r.json()).id;
      }
      await fetch(`/api/shot-list/shots/${shotId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableId: delId }),
      });
      globalMutate(swrKey);
    } catch {
      toast("error", "Failed to add channel");
    }
    close();
  }

  return (
    <div ref={addRef} className="flex h-full min-h-[32px] flex-wrap items-center gap-1 px-[var(--density-shotlist-chip-cell-px)] py-[var(--density-shotlist-chip-cell-py)]"
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
  embedded = false,
}: Props) {
  const { toast } = useToast();
  const swrKey = `/api/campaigns/${campaignId}/schedule`;
  const { data, isLoading } = useSWR<ScheduleData>(swrKey, fetcher);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [expandedShots, setExpandedShots] = useState<Record<string, boolean>>({});

  // ─── Column resize ──────────────────────────────────────────────────────────
  const COLUMNS = [
    { key: "drag", label: "", minW: 28, defaultW: 28 },
    { key: "#", label: "#", minW: 36, defaultW: 36 },
    { key: "ref", label: "Ref", minW: 36, defaultW: 36 },
    { key: "name", label: "Shot Name", minW: 120, defaultW: 190 },
    { key: "type", label: "Type", minW: 56, defaultW: 72 },
    { key: "angle", label: "Angle", minW: 64, defaultW: 84 },
    { key: "env", label: "Env", minW: 72, defaultW: 98 },
    { key: "channel", label: "Channel", minW: 84, defaultW: 118 },
    { key: "desc", label: "Description", minW: 150, defaultW: 260 },
    { key: "details", label: "Details", minW: 76, defaultW: 82 },
    { key: "delete", label: "", minW: 28, defaultW: 28 },
  ];

  const storageKey = `shotlist-col-widths-v5-${campaignId}`;
  const [colWidths, setColWidths] = useState<number[]>(() => {
    if (typeof window === "undefined") return COLUMNS.map((c) => c.defaultW);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === COLUMNS.length) return parsed;
      }
    } catch { /* ignore */ }
    return COLUMNS.map((c) => c.defaultW);
  });

  const resizingRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { colIdx, startX: e.clientX, startW: colWidths[colIdx] };

    function onMove(ev: MouseEvent) {
      if (!resizingRef.current) return;
      const { colIdx: ci, startX, startW } = resizingRef.current;
      const delta = ev.clientX - startX;
      const newW = Math.max(COLUMNS[ci].minW, startW + delta);
      setColWidths((prev) => {
        const next = [...prev];
        next[ci] = newW;
        return next;
      });
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      resizingRef.current = null;
      // Persist
      setColWidths((current) => {
        try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* ignore */ }
        return current;
      });
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [colWidths, storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const sortedSetups = [...data.setups].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className={embedded ? "" : "space-y-[var(--density-shotlist-stack-gap)]"}>
      {/* Header */}
      <div className={`flex items-center justify-between ${embedded ? "border-b border-border pb-3" : ""}`}>
        <p className="inline-flex items-center rounded-md bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
          {totalShots} shot{totalShots !== 1 ? "s" : ""} across{" "}
          {data.setups.length} setup{data.setups.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-[var(--density-shotlist-actions-gap)]">
          <button
            type="button"
            onClick={addSetup}
            className="flex items-center gap-[var(--density-shotlist-button-gap)] rounded-lg border border-border px-[var(--density-shotlist-btn-px-sm)] py-[var(--density-shotlist-btn-py)] text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Setup
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-[var(--density-shotlist-button-gap)] rounded-lg border border-border px-[var(--density-shotlist-btn-px-md)] py-[var(--density-shotlist-btn-py)] text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Unified shot-list frame with setup sections */}
      <div className={embedded ? "" : "overflow-hidden rounded-xl border border-border bg-surface"}>
        {sortedSetups.map((setup, setupIdx) => {
          const setupShots = data.shots
            .filter((s) => s.setup_id === setup.id)
            .sort((a, b) => a.sort_order - b.sort_order);

          return (
            <section key={setup.id} className={setupIdx > 0 ? "border-t border-border" : embedded ? "pt-1" : ""}>
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
                <table className="text-left" style={{ tableLayout: "fixed", width: colWidths.reduce((a, b) => a + b, 0) }}>
                  <thead>
                    <tr className="bg-surface-secondary">
                      {COLUMNS.map((col, ci) => (
                        <th
                          key={col.key}
                          style={{ width: colWidths[ci] }}
                          className={`relative ${col.label ? "px-[var(--density-shotlist-table-head-px)] py-[var(--density-shotlist-table-head-py)] text-[11px] font-semibold uppercase tracking-wider text-text-secondary" : ""} select-none`}
                        >
                          {col.label}
                          {/* Resize handle (skip for first, last, and tiny columns) */}
                          {col.label && ci < COLUMNS.length - 1 && (
                            <div
                              onMouseDown={(e) => handleResizeStart(ci, e)}
                              className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors"
                            />
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {setupShots.map((shot) => {
                      const globalIdx =
                        data.shots.findIndex((s) => s.id === shot.id) + 1;
                      const detailsOpen = !!expandedShots[shot.id];
                      const linkedProducts = data.productLinks
                        .filter((pl) => pl.shot_id === shot.id)
                        .map((pl) => {
                          const cp = data.campaignProducts.find((c) => c.id === pl.campaign_product_id);
                          return cp ? {
                            cpId: cp.id,
                            name: cp.product?.name || "Product",
                            itemCode: cp.product?.item_code ?? null,
                            department: cp.product?.department ?? null,
                            description: cp.product?.description ?? null,
                            shootingNotes: cp.product?.shooting_notes ?? null,
                            imageUrl: cp.product?.image_url ?? null,
                          } : null;
                        })
                        .filter((x): x is { cpId: string; name: string; itemCode: string | null; department: string | null; description: string | null; shootingNotes: string | null; imageUrl: string | null } => !!x);
                      const freeTextTags = shot.product_tags
                        ? shot.product_tags.split(",").map((t) => t.trim()).filter(Boolean)
                        : [];
                      const shotTalent = data.talent.filter((t) => t.shot_id === shot.id);

                      return (
                        <Fragment key={shot.id}>
                          <tr
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
                            <td className="px-[var(--density-shotlist-row-cell-px)] py-[var(--density-shotlist-row-cell-py)] text-xs font-medium text-text-primary">
                              {globalIdx}
                            </td>

                            {/* Ref image (click to upload) */}
                            <RefImageCell
                              shotId={shot.id}
                              campaignId={campaignId}
                              url={shot.reference_image_url}
                              swrKey={swrKey}
                            />

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
                                className="w-full px-[var(--density-shotlist-row-cell-px)] py-[var(--density-shotlist-row-cell-py)] text-xs text-text-primary bg-transparent border-none outline-none cursor-pointer hover:bg-primary/3 transition-colors appearance-none"
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
                                className={`w-full px-[var(--density-shotlist-row-cell-px)] py-[var(--density-shotlist-row-cell-py)] text-xs bg-transparent border-none outline-none cursor-pointer hover:bg-primary/3 transition-colors appearance-none ${
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
                                className={`w-full px-[var(--density-shotlist-row-cell-px)] py-[var(--density-shotlist-row-cell-py)] text-xs bg-transparent border-none outline-none cursor-pointer hover:bg-primary/3 transition-colors appearance-none ${
                                  shot.location ? "text-text-primary" : "text-text-tertiary/40"
                                }`}
                              >
                                <option value="">Environment</option>
                                <option value="White seamless">White seamless</option>
                                <option value="Lifestyle: Studio">Lifestyle: Studio</option>
                                <option value="Lifestyle: Location">Lifestyle: Location</option>
                              </select>
                            </td>

                            {/* Channel */}
                            <td className="relative">
                              <ChannelCell shotId={shot.id} campaignId={campaignId} data={data} swrKey={swrKey} />
                            </td>

                            {/* Description */}
                            <Cell
                              value={shot.description}
                              placeholder="Description"
                              onSave={(v) => patchShot(shot.id, "description", v)}
                            />

                            {/* Expand details */}
                            <td className="px-[var(--density-shotlist-row-cell-px)] py-[var(--density-shotlist-row-cell-py)]">
                              <button
                                type="button"
                                onClick={() => setExpandedShots((prev) => ({ ...prev, [shot.id]: !prev[shot.id] }))}
                                className="inline-flex items-center rounded border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
                              >
                                {detailsOpen ? "Hide" : "Details"}
                              </button>
                            </td>

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

                          {detailsOpen && (
                            <tr className="border-t border-border bg-surface-secondary/35">
                              <td colSpan={COLUMNS.length} className="px-2 py-2">
                                <div className="overflow-x-auto rounded-md border border-border bg-surface">
                                  <table className="min-w-[780px] w-full text-left" style={{ tableLayout: "fixed" }}>
                                    <thead>
                                      <tr className="bg-surface-secondary">
                                        {[
                                          "Surface",
                                          "Props",
                                          "Products",
                                          "Lighting",
                                          "Talent",
                                          "Wardrobe",
                                          "Notes",
                                          "Retouching",
                                        ].map((label) => (
                                          <th
                                            key={label}
                                            className="px-[var(--density-shotlist-table-head-px)] py-[var(--density-shotlist-table-head-py)] text-[10px] font-semibold uppercase tracking-wider text-text-secondary"
                                          >
                                            {label}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="border-t border-border">
                                        <Cell
                                          value={shot.surface || ""}
                                          placeholder="Surface"
                                          onSave={(v) => patchShot(shot.id, "surface", v)}
                                        />
                                        <Cell
                                          value={shot.props}
                                          placeholder="Props"
                                          onSave={(v) => patchShot(shot.id, "props", v)}
                                        />
                                        <ProductTagCell
                                          shotId={shot.id}
                                          campaignId={campaignId}
                                          linkedProducts={linkedProducts}
                                          freeTextTags={freeTextTags}
                                          swrKey={swrKey}
                                        />
                                        <Cell
                                          value={shot.lighting || ""}
                                          placeholder="Lighting"
                                          onSave={(v) => patchShot(shot.id, "lighting", v)}
                                        />
                                        <TalentCell
                                          shotId={shot.id}
                                          campaignId={campaignId}
                                          shotTalent={shotTalent}
                                          allTalent={data.talent}
                                          swrKey={swrKey}
                                        />
                                        <Cell
                                          value={shot.wardrobe || ""}
                                          placeholder="Wardrobe"
                                          onSave={(v) => patchShot(shot.id, "wardrobe", v)}
                                        />
                                        <Cell
                                          value={shot.notes}
                                          placeholder="Notes"
                                          onSave={(v) => patchShot(shot.id, "notes", v)}
                                        />
                                        <Cell
                                          value={shot.retouching_notes || ""}
                                          placeholder="Retouching"
                                          onSave={(v) => patchShot(shot.id, "retouchingNotes", v)}
                                        />
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add shot button */}
              <button
                type="button"
                onClick={() => addShot(setup.id)}
                className="flex w-full items-center gap-[var(--density-shotlist-button-gap)] border-t border-border px-[var(--density-shotlist-addshot-px)] py-[var(--density-shotlist-addshot-py)] text-xs text-text-tertiary transition-colors hover:bg-primary/3 hover:text-primary"
              >
                <Plus className="h-3 w-3" />
                Add shot
              </button>
            </section>
          );
        })}
      </div>
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
    <div className="flex items-center gap-[var(--density-shotlist-setup-gap)] border-b border-border bg-surface-secondary/60 px-[var(--density-shotlist-setup-px)] py-[var(--density-shotlist-setup-py)] group">
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
              className="text-xs font-semibold text-red-500 hover:text-error transition-colors">
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

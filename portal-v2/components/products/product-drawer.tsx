"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { Product, ProductDepartment, ProductLifecyclePhase } from "@/types/domain";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PRODUCT_DEPARTMENTS } from "@/lib/constants/products";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ShoppingBasket,
  Edit2,
  Flag,
  Trash2,
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { InlineFlagSection } from "@/components/products/inline-flag-section";
import { resolvePublixLink } from "@/lib/products/publix-link";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

export const DEPT_COLORS: Record<string, string> = {
  Deli: "bg-orange-50 text-warning",
  Bakery: "bg-amber-50 text-warning",
  "Meat-Seafood": "bg-red-50 text-error",
  Produce: "bg-emerald-50 text-success",
  Grocery: "bg-blue-50 text-blue-700",
  Other: "bg-slate-50 text-slate-600",
};

export const PHASE_COLORS: Record<ProductLifecyclePhase, string> = {
  planning: "bg-violet-50 text-violet-700",
  coming_soon: "bg-sky-50 text-sky-700",
  live: "bg-emerald-50 text-success",
  discontinued: "bg-slate-100 text-slate-500",
};

export const PHASE_LABELS: Record<ProductLifecyclePhase, string> = {
  planning: "Planning",
  coming_soon: "Coming Soon",
  live: "Live",
  discontinued: "Discontinued",
};

// Auto-expanding textarea
export function AutoTextarea({
  value, onChange, placeholder, maxHeight = 220, className = "", readOnly = false,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  maxHeight?: number;
  className?: string;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = next + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={1}
      className={className}
    />
  );
}

// --- Unified Product Drawer (view + inline edit + add) ---
export function ProductDrawer({
  product,
  onClose,
  onSaved,
  onDeleted,
  canEdit,
  hideTeamNotes = false,
  initialName,
  reviewMode = false,
  rbuToken = null,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: (updated: Product | null) => void;
  onDeleted: () => void;
  canEdit: boolean;
  hideTeamNotes?: boolean;
  initialName?: string;
  // When opened from the Review tab: start in edit mode and auto-flag
  // producers if the user saves any changes — so a quick edit during review
  // doesn't slip past the producer team. Approval itself happens from the
  // tile in the Review list, not in this drawer.
  reviewMode?: boolean;
  // RBU token surface: fetch history through the token-gated endpoint
  // since RBU users have no auth session.
  rbuToken?: string | null;
}) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { mutate: globalMutate } = useSWRConfig();
  const isNew = product === null;
  const [editMode, setEditMode] = useState(isNew || (reviewMode && canEdit));
  const [current, setCurrent] = useState<Product | null>(product);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [flagPanelOpen, setFlagPanelOpen] = useState(false);

  const canRaiseFlag =
    !!current &&
    (user?.role === "Admin" ||
      user?.role === "Producer" ||
      user?.role === "Post Producer" ||
      user?.role === "Brand Marketing Manager");

  const canChangePhase =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Post Producer" ||
    user?.role === "Brand Marketing Manager";

  // Form state
  const [name, setName] = useState(product?.name ?? initialName ?? "");
  const [department, setDepartment] = useState<ProductDepartment | "">(product?.department ?? "");
  const [itemCode, setItemCode] = useState(product?.itemCode ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [shootingNotes, setShootingNotes] = useState(product?.shootingNotes ?? "");
  const [restrictions, setRestrictions] = useState(product?.restrictions ?? "");
  const [pcomLink, setPcomLink] = useState(product?.pcomLink ?? "");
  const [rpGuideUrl, setRpGuideUrl] = useState(product?.rpGuideUrl ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);
  const imageFileRef = useRef<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [deptRequired, setDeptRequired] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<ProductLifecyclePhase>(
    product?.lifecyclePhase ?? "live"
  );
  const [imageBroken, setImageBroken] = useState(false);
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const phaseDropdownRef = useRef<HTMLDivElement>(null);
  // Snapshot used to detect actual edits during a reviewMode session — only
  // captured once per opened product so it survives Save → re-edit cycles.
  const reviewSnapshotRef = useRef<{
    name: string; itemCode: string; description: string; shootingNotes: string;
    restrictions: string; pcomLink: string; rpGuideUrl: string;
    imageUrl: string | null; department: ProductDepartment | "";
    phase: ProductLifecyclePhase;
  } | null>(null);
  if (reviewMode && reviewSnapshotRef.current === null && product) {
    reviewSnapshotRef.current = {
      name: product.name ?? "",
      itemCode: product.itemCode ?? "",
      description: product.description ?? "",
      shootingNotes: product.shootingNotes ?? "",
      restrictions: product.restrictions ?? "",
      pcomLink: product.pcomLink ?? "",
      rpGuideUrl: product.rpGuideUrl ?? "",
      imageUrl: product.imageUrl ?? null,
      department: product.department,
      phase: product.lifecyclePhase ?? "live",
    };
  }

  // Close dept dropdown on outside click
  useEffect(() => {
    if (!showDeptDropdown) return;
    function handler(e: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setShowDeptDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDeptDropdown]);

  useEffect(() => {
    if (!showPhaseDropdown) return;
    function handler(e: MouseEvent) {
      if (phaseDropdownRef.current && !phaseDropdownRef.current.contains(e.target as Node)) {
        setShowPhaseDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPhaseDropdown]);

  // Pcom import
  const [pcomUrl, setPcomUrl] = useState("");
  const [pcomFetching, setPcomFetching] = useState(false);
  const [pcomFetched, setPcomFetched] = useState(false);
  const [pcomImportedFields, setPcomImportedFields] = useState<string[]>([]);
  const [pcomError, setPcomError] = useState("");

  // Notes
  const [notes, setNotes] = useState<{ id: string; text: string; authorName: string; createdAt: string }[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const { data: notesData, mutate: mutateNotes } = useSWR(
    current && !hideTeamNotes ? `/api/products/${current.id}/notes` : null,
    fetcher
  );
  useEffect(() => { if (notesData) setNotes(notesData); }, [notesData]);

  const handleAddNote = useCallback(async () => {
    if (!newNote.trim() || !current) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/products/${current.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNote.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const note = await res.json();
      setNotes((prev) => [...prev, note]);
      setNewNote("");
      mutateNotes();
    } catch {
      toast("error", "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  }, [newNote, current, mutateNotes, toast]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!current) return;
    try {
      await fetch(`/api/products/${current.id}/notes/${noteId}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      mutateNotes();
    } catch {
      toast("error", "Failed to delete note");
    }
  }, [current, mutateNotes, toast]);

  const { data: historyData } = useSWR(
    current
      ? rbuToken
        ? `/api/rbu/${rbuToken}/products/${current.id}?history=true`
        : `/api/products/${current.id}?history=true`
      : null,
    fetcher
  );
  const { data: flagCounts } = useSWR<Record<string, number>>(
    current && !rbuToken ? "/api/product-flags/counts" : null,
    fetcher
  );
  const productFlagCount = current ? (flagCounts?.[current.id] ?? 0) : 0;
  const campaigns = historyData?.campaigns || [];
  const upcomingShoots: { campaignId: string; campaignName: string; wfNumber: string; role: "hero" | "secondary" | null; date: string; shootName: string }[] = historyData?.upcoming || [];
  const planningCampaigns: { campaignId: string; campaignName: string; wfNumber: string; role: "hero" | "secondary" | null }[] = historyData?.planning || [];
  const lastApproval: { at: string; by: string | null; campaignId: string; campaignName: string; wfNumber: string } | null = historyData?.lastApproval || null;

  function syncFormToProduct(p: Product | null) {
    setName(p?.name ?? "");
    setDepartment(p?.department ?? "");
    setItemCode(p?.itemCode ?? "");
    setDescription(p?.description ?? "");
    setShootingNotes(p?.shootingNotes ?? "");
    setRestrictions(p?.restrictions ?? "");
    setPcomLink(p?.pcomLink ?? "");
    setRpGuideUrl(p?.rpGuideUrl ?? "");
    setImageUrl(p?.imageUrl ?? null);
    setPhase(p?.lifecyclePhase ?? "live");
    imageFileRef.current = null;
  }

  function handleCancelEdit() {
    if (isNew) {
      onClose();
    } else {
      syncFormToProduct(current);
      setEditMode(false);
    }
  }

  async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "products");
    const res = await fetch("/api/upload-image", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image upload failed");
    return data.url;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("error", "Product name is required");
      return;
    }
    if (!department) {
      setDeptRequired(true);
      return;
    }
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFileRef.current) {
        finalImageUrl = await uploadImage(imageFileRef.current);
      }
      const body = {
        name: name.trim(),
        department: department || "Other",
        itemCode: itemCode.trim() || null,
        description,
        shootingNotes,
        restrictions,
        pcomLink: pcomLink || null,
        rpGuideUrl: rpGuideUrl || null,
        imageUrl: finalImageUrl || null,
        lifecyclePhase: phase,
      };

      const url = current ? `/api/products/${current.id}` : "/api/products";
      const method = current ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      const saved: Product = await res.json();
      toast("success", current ? "Product updated" : "Product added");

      // Review-mode auto-flag: if the BMM/RBU edited anything while reviewing,
      // raise a "about to change" flag so producers see the update before the
      // shoot. Only meaningful for existing products with a real RBU dept.
      if (reviewMode && current && reviewSnapshotRef.current) {
        const snap = reviewSnapshotRef.current;
        const changed =
          snap.name !== body.name ||
          snap.itemCode !== (body.itemCode ?? "") ||
          snap.description !== body.description ||
          snap.shootingNotes !== body.shootingNotes ||
          snap.restrictions !== body.restrictions ||
          snap.pcomLink !== (body.pcomLink ?? "") ||
          snap.rpGuideUrl !== (body.rpGuideUrl ?? "") ||
          snap.imageUrl !== (body.imageUrl ?? null) ||
          snap.department !== body.department ||
          snap.phase !== body.lifecyclePhase;
        const dept = body.department;
        const flaggable =
          dept === "Bakery" ||
          dept === "Produce" ||
          dept === "Deli" ||
          dept === "Meat-Seafood" ||
          dept === "Grocery";
        if (changed && flaggable) {
          try {
            await fetch("/api/product-flags/internal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                productId: current.id,
                dept,
                reason: "about_to_change",
                comment: "Edited during RBU review — please confirm before shoot.",
              }),
            });
            globalMutate("/api/product-flags/counts");
          } catch {
            // Non-fatal — the save succeeded; the flag is a nice-to-have.
          }
          // Refresh the snapshot so a follow-up save without further changes
          // doesn't re-flag.
          reviewSnapshotRef.current = {
            name: body.name, itemCode: body.itemCode ?? "", description: body.description,
            shootingNotes: body.shootingNotes, restrictions: body.restrictions,
            pcomLink: body.pcomLink ?? "", rpGuideUrl: body.rpGuideUrl ?? "",
            imageUrl: body.imageUrl ?? null, department: body.department, phase: body.lifecyclePhase,
          };
        }
      }

      setCurrent(saved);
      setEditMode(false);
      onSaved(saved);
      // Review-mode flow: after saving, close the modal so the user goes
      // straight back to the Review list to approve from the tile.
      if (reviewMode) onClose();
    } catch {
      toast("error", "Failed to save product");
    } finally {
      setSaving(false);
    }
  }


  async function handleDelete() {
    if (!current) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${current.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Product deleted");
      onDeleted();
    } catch {
      toast("error", "Failed to delete product");
    } finally {
      setDeleting(false);
    }
  }

  async function savePhase(next: ProductLifecyclePhase) {
    setPhase(next);
    setShowPhaseDropdown(false);
    if (!current) return;
    try {
      const res = await fetch(`/api/products/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecyclePhase: next }),
      });
      if (!res.ok) throw new Error("Failed");
      const saved: Product = await res.json();
      setCurrent(saved);
      onSaved(saved);
    } catch {
      toast("error", "Failed to update phase");
    }
  }

  async function reportBrokenLink() {
    if (!current) return;
    try {
      const res = await fetch(`/api/products/${current.id}/report-broken-link`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      const saved: Product = await res.json();
      setCurrent(saved);
      onSaved(saved);
      toast("success", "Link flagged. Showing search fallback.");
    } catch {
      toast("error", "Couldn't flag link");
    }
  }

  async function saveDepartment(dept: ProductDepartment) {
    setDepartment(dept);
    setDeptRequired(false);
    setShowDeptDropdown(false);
    if (!current) return; // new product — just update local state
    try {
      const res = await fetch(`/api/products/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: dept }),
      });
      if (!res.ok) throw new Error("Failed");
      const saved: Product = await res.json();
      setCurrent(saved);
      onSaved(saved);
    } catch {
      toast("error", "Failed to update department");
    }
  }

  async function handlePcomImport() {
    if (!pcomUrl.trim()) return;
    setPcomFetching(true);
    setPcomError("");
    setPcomFetched(false);
    try {
      const res = await fetch("/api/scrape-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pcomUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPcomError(data.error || "Could not fetch product info.");
        return;
      }
      const imported: string[] = [];
      if (data.name) { setName(data.name); imported.push("name"); }
      if (data.description) { setDescription(data.description); imported.push("description"); }
      if (data.imageUrl) { setImageUrl(data.imageUrl); imported.push("image"); }
      if (data.itemCode) { setItemCode(data.itemCode); imported.push("item code"); }
      setPcomLink(pcomUrl.trim());
      setPcomImportedFields(imported);
      setPcomFetched(true);
    } catch {
      setPcomError("Something went wrong. Check the link and try again.");
    } finally {
      setPcomFetching(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} size="lg">
      {/* Header — always shows name + item code; editable inline when in edit mode */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          readOnly={!editMode}
          autoFocus={isNew}
          placeholder="Product name"
          className={`text-lg font-semibold text-text-primary bg-transparent flex-1 min-w-0 focus:outline-none ${editMode ? "border-b border-transparent hover:border-border focus:border-primary pb-0.5" : "pointer-events-none truncate"}`}
        />
        <div className="flex items-center gap-1 shrink-0">
          <div ref={deptDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => editMode && setShowDeptDropdown((v) => !v)}
              className={`text-xs font-medium rounded-full px-2 py-0.5 inline-flex items-center gap-1 transition-opacity hover:opacity-80 ${department ? (DEPT_COLORS[department] || DEPT_COLORS.Other) : "bg-surface-secondary text-text-tertiary"}`}
              title="Change department"
            >
              {department || "No dept"}
              <svg className="h-2.5 w-2.5 opacity-60" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l4 4 4-4"/></svg>
            </button>
            {showDeptDropdown && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-border bg-surface shadow-lg py-1">
                {PRODUCT_DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => saveDepartment(dept as ProductDepartment)}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-secondary ${department === dept ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
                  >
                    <span className={`inline-flex rounded-full px-2 py-0.5 ${DEPT_COLORS[dept] || DEPT_COLORS.Other}`}>
                      {dept}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!hideTeamNotes && <div ref={phaseDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => canChangePhase && !isNew && setShowPhaseDropdown((v) => !v)}
              disabled={!canChangePhase || isNew}
              className={`text-xs font-medium rounded-full px-2 py-0.5 inline-flex items-center gap-1 transition-opacity ${canChangePhase && !isNew ? "hover:opacity-80" : ""} ${PHASE_COLORS[phase]}`}
              title={canChangePhase ? "Change lifecycle phase" : "Lifecycle phase"}
            >
              {PHASE_LABELS[phase]}
              {canChangePhase && !isNew && (
                <svg className="h-2.5 w-2.5 opacity-60" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 1l4 4 4-4"/>
                </svg>
              )}
            </button>
            {showPhaseDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-border bg-surface shadow-lg py-1">
                {(["planning","coming_soon","live","discontinued"] as ProductLifecyclePhase[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => savePhase(p)}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-secondary ${phase === p ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
                  >
                    <span className={`inline-flex rounded-full px-2 py-0.5 ${PHASE_COLORS[p]}`}>
                      {PHASE_LABELS[p]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>}
          <input
            type="text"
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value)}
            readOnly={!editMode}
            placeholder="Item code"
            size={Math.max((itemCode || "Item code").length, 4)}
            className={`text-sm font-semibold text-text-primary bg-transparent focus:outline-none ${editMode ? "border-b border-transparent hover:border-border focus:border-primary pb-0.5" : "pointer-events-none"}`}
          />
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isNew && editMode ? (
        /* ---- New product form (pcom import + fields) ---- */
        <form onSubmit={handleSave} className="space-y-4">
          <div className={`rounded-xl border p-3 space-y-2 ${pcomFetched ? "border-emerald-200 bg-emerald-50" : "border-border bg-surface-secondary"}`}>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-text-primary">Add from link</span>
              {pcomFetched && <CheckCircle2 className="h-4 w-4 text-success ml-auto shrink-0" />}
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={pcomUrl}
                onChange={(e) => { setPcomUrl(e.target.value); setPcomFetched(false); setPcomError(""); }}
                placeholder="Paste any product link..."
                className="flex-1 h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              <button
                type="button"
                onClick={handlePcomImport}
                disabled={pcomFetching || !pcomUrl.trim()}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
              >
                {pcomFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                {pcomFetching ? "Fetching…" : "Import"}
              </button>
            </div>
            {pcomError && <p className="text-xs text-error">{pcomError}</p>}
            {pcomFetched && (
              <p className="text-xs text-success font-medium">
                Imported: {pcomImportedFields.join(", ")}.
                {!pcomImportedFields.includes("image") && " Add an image manually below."}
              </p>
            )}
          </div>
          <div className="flex gap-3 items-start">
            <ImageUpload
              value={imageUrl}
              onFileSelected={(file) => { imageFileRef.current = file; }}
              onRemove={() => { imageFileRef.current = null; setImageUrl(null); }}
              onSourceUrl={(url) => {
                const m = url.match(/\/(\d{5,6})-600x600/);
                if (m?.[1] && !itemCode) setItemCode(m[1]);
              }}
              onImageClick={(url) => setLightboxUrl(url)}
            />
            <div className="flex-1">
              <AutoTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="General product description..."
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Restrictions</p>
            <AutoTextarea value={restrictions} onChange={(e) => setRestrictions(e.target.value)} placeholder="None"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary italic focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Pcom Link</p>
                {name.trim() && (
                  <a
                    href={`https://www.publix.com/search?search=${encodeURIComponent(name.trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] italic text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Find on Publix
                  </a>
                )}
              </div>
              <input type="url" value={pcomLink} onChange={(e) => setPcomLink(e.target.value)} placeholder="Paste any product link..."
                className="w-full bg-transparent text-sm text-primary placeholder:text-text-tertiary italic focus:outline-none" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">R&P Guide</p>
              <input type="url" value={rpGuideUrl} onChange={(e) => setRpGuideUrl(e.target.value)} placeholder="https://..."
                className="w-full bg-transparent text-sm text-primary placeholder:text-text-tertiary italic focus:outline-none" />
            </div>
          </div>
          {deptRequired && (
            <p className="text-xs text-amber-600 text-right">Select a department before adding</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleCancelEdit} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">Add Product</Button>
          </div>
        </form>
      ) : current ? (
        /* ---- Unified detail/edit view ---- */
        <form onSubmit={handleSave} className="space-y-4">
          {/* Image + description */}
          <div className="flex items-start gap-3">
            {editMode ? (
              <ImageUpload
                value={imageUrl}
                onFileSelected={(file) => { imageFileRef.current = file; }}
                onRemove={() => { imageFileRef.current = null; setImageUrl(null); }}
                onSourceUrl={(url) => {
                  const m = url.match(/\/(\d{5,6})-600x600/);
                  if (m?.[1] && !itemCode) setItemCode(m[1]);
                }}
                onImageClick={(url) => setLightboxUrl(url)}
              />
            ) : current.imageUrl && !imageBroken ? (
              <img
                src={current.imageUrl}
                alt={current.name}
                onClick={() => setLightboxUrl(current.imageUrl)}
                onError={() => setImageBroken(true)}
                className="h-50 w-50 rounded-xl object-cover shrink-0 cursor-zoom-in"
              />
            ) : (
              <div className="flex h-30 w-30 items-center justify-center rounded-xl bg-surface-tertiary shrink-0">
                <ShoppingBasket className="h-8 w-8 text-text-tertiary" />
              </div>
            )}
            <div className="flex flex-col justify-center flex-1 min-w-0">
              <AutoTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={!editMode}
                placeholder={editMode ? "General product description..." : ""}
                className={`w-full bg-transparent text-sm text-text-secondary placeholder:text-text-tertiary focus:outline-none resize-none ${!editMode ? "pointer-events-none" : ""}`}
              />
            </div>
          </div>

          {/* Shooting Notes — hidden for BMM (hideTeamNotes) to avoid exposing informal production commentary */}
          {!hideTeamNotes && <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Shooting Notes</p>
            {notes.length > 0 ? (
              <div className="space-y-2.5 mb-2">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-2 group/note">
                    <div className="shrink-0 mt-0.5">
                      <UserAvatar name={note.authorName ?? "?"} size="xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-text-primary">{(note.authorName ?? "Unknown").split(" ")[0]}</span>
                        <span className="text-[10px] text-text-tertiary">
                          {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <button type="button" onClick={() => handleDeleteNote(note.id)}
                          className="ml-auto opacity-0 group-hover/note:opacity-100 text-text-tertiary hover:text-red-500 transition-all">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-sm text-text-secondary">{note.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                placeholder="Add a note…"
                className="flex-1 h-8 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              <button type="button" onClick={handleAddNote} disabled={!newNote.trim() || addingNote}
                className="h-8 px-3 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40 transition-opacity shrink-0">
                {addingNote ? "…" : "Add"}
              </button>
            </div>
          </div>}

          {/* Restrictions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">Restrictions</p>
            <AutoTextarea
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              readOnly={!editMode}
              placeholder={editMode ? "None" : "None"}
              className={`w-full bg-transparent text-sm font-medium placeholder:text-text-tertiary italic focus:outline-none resize-none ${!editMode ? "pointer-events-none" : ""} ${restrictions ? "text-warning" : "text-text-primary"}`}
            />
          </div>

          {/* Pcom Link + R&P Guide */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">Pcom Link</p>
              {!editMode ? (
                (() => {
                  const resolved = resolvePublixLink({
                    pcomLink: current?.pcomLink ?? pcomLink ?? null,
                    itemCode: current?.itemCode ?? itemCode ?? null,
                    pcomLinkBrokenAt: current?.pcomLinkBrokenAt,
                  });
                  if (!resolved) {
                    return <span className="text-sm italic text-text-tertiary">No link</span>;
                  }
                  return (
                    <div className="flex items-center gap-2">
                      <a href={resolved.href} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm italic text-primary hover:underline">
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        {resolved.label}
                      </a>
                      {!resolved.isFallback && canEdit && (
                        <button
                          type="button"
                          onClick={reportBrokenLink}
                          title="Report this link as broken — we'll fall back to a Publix search"
                          className="inline-flex items-center gap-1 text-[11px] italic text-text-tertiary hover:text-warning"
                        >
                          <Link2Off className="h-3 w-3" />
                          Broken?
                        </button>
                      )}
                      {resolved.isFallback && (
                        <span className="text-[11px] italic text-text-tertiary">
                          (link reported broken)
                        </span>
                      )}
                    </div>
                  );
                })()
              ) : (
                <input
                  type="url"
                  value={pcomLink}
                  onChange={(e) => setPcomLink(e.target.value)}
                  placeholder="Paste any product link..."
                  className="w-full bg-transparent text-sm text-primary placeholder:text-text-tertiary italic focus:outline-none"
                />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">R&P Guide</p>
              {!editMode ? (
                rpGuideUrl ? (
                  <a href={rpGuideUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm italic text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    View Guide
                  </a>
                ) : (
                  <span className="text-sm italic text-text-tertiary">No document</span>
                )
              ) : (
                <input
                  type="url"
                  value={rpGuideUrl}
                  onChange={(e) => setRpGuideUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-transparent text-sm text-primary placeholder:text-text-tertiary italic focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Last approved by RBU (across any campaign) */}
          {(!editMode || reviewMode) && lastApproval && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-text-secondary">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                Last approved {new Date(lastApproval.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {lastApproval.by ? ` by ${lastApproval.by}` : ""}
              </span>
            </div>
          )}

          {/* Upcoming — scheduled shoots (with date) + planning campaigns (no date yet) */}
          {(!editMode || reviewMode) && (upcomingShoots.length > 0 || planningCampaigns.length > 0) && (() => {
            const byCampaign = new Map<string, typeof upcomingShoots[number]>();
            for (const u of upcomingShoots) {
              const existing = byCampaign.get(u.campaignId);
              if (!existing || u.date < existing.date) byCampaign.set(u.campaignId, u);
            }
            const shootingRows = Array.from(byCampaign.values()).sort((a, b) => a.date.localeCompare(b.date));
            return (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Upcoming</p>
                <div className="space-y-1.5">
                  {shootingRows.map((u) => {
                    const [y, m, d] = u.date.split("-").map(Number);
                    const formatted = new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return (
                      <Link
                        key={u.campaignId}
                        href={`/campaigns/${u.campaignId}`}
                        className="flex items-center gap-2 rounded-lg bg-surface-secondary p-2.5 text-sm hover:bg-surface-tertiary transition-colors"
                      >
                        <span className="text-text-tertiary text-xs">{u.wfNumber || "—"}</span>
                        <span className="text-text-primary font-medium truncate">{u.campaignName}</span>
                        <span className="ml-auto text-xs text-text-secondary">Shooting {formatted}</span>
                        {u.role && (
                          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">{u.role}</span>
                        )}
                      </Link>
                    );
                  })}
                  {planningCampaigns.map((c) => (
                    <Link
                      key={c.campaignId}
                      href={`/campaigns/${c.campaignId}`}
                      className="flex items-center gap-2 rounded-lg bg-surface-secondary p-2.5 text-sm hover:bg-surface-tertiary transition-colors"
                    >
                      <span className="text-text-tertiary text-xs">{c.wfNumber || "—"}</span>
                      <span className="text-text-primary font-medium truncate">{c.campaignName}</span>
                      {c.role && (
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-text-tertiary">{c.role}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Campaign History (view only) */}
          {(!editMode || reviewMode) && campaigns.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Campaign History</p>
              <div className="space-y-1.5">
                {campaigns.map((c: { campaignId: string; campaignName: string; wfNumber: string }) => (
                  <Link key={c.campaignId} href={`/campaigns/${c.campaignId}`}
                    className="flex items-center gap-2 rounded-lg bg-surface-secondary p-2.5 text-sm hover:bg-surface-tertiary transition-colors">
                    <span className="text-text-tertiary text-xs">{c.wfNumber || "—"}</span>
                    <span className="text-text-primary font-medium">{c.campaignName}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(flagPanelOpen || productFlagCount > 0) && current && canRaiseFlag && (
            <InlineFlagSection
              productId={current.id}
              productDept={current.department}
              onChanged={() => {
                globalMutate("/api/product-flags/counts");
              }}
            />
          )}

          {/* Actions */}
          {(canEdit || canRaiseFlag) && (
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              {editMode ? (
                <div className="ml-auto flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                  <Button type="submit" size="sm" loading={saving}>Save Changes</Button>
                </div>
              ) : (
                <>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      title="Delete product"
                      className="rounded-md p-1.5 text-text-tertiary hover:text-error hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    {canEdit && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditMode(true)}>
                        <Edit2 className="h-3.5 w-3.5" />Edit
                      </Button>
                    )}
                    {canRaiseFlag && !flagPanelOpen && productFlagCount === 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const next = !flagPanelOpen;
                          setFlagPanelOpen(next);
                          if (next && productFlagCount > 0 && canEdit) {
                            setEditMode(true);
                          }
                        }}
                        className={productFlagCount > 0 ? "border-amber-300 bg-amber-50 text-warning hover:bg-amber-100" : ""}
                        title={productFlagCount > 0 ? "Review open flags" : "Flag for BMM + RBU review"}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        {productFlagCount > 0 ? "Flagged" : "Flag"}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </form>
      ) : null}


      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Product photo"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </Modal>
  );
}

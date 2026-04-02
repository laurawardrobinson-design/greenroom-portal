"use client";
// v2
import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import type { Product, ProductDepartment } from "@/types/domain";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PRODUCT_DEPARTMENTS } from "@/lib/validation/products.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Plus,
  Search,
  ShoppingBasket,
  Edit2,
  Trash2,
  ExternalLink,
  ClipboardList,
  LayoutGrid,
  List,
  Link2,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

const DEPT_COLORS: Record<string, string> = {
  Deli: "bg-orange-50 text-orange-700",
  Bakery: "bg-amber-50 text-amber-700",
  "Meat-Seafood": "bg-red-50 text-red-700",
  Produce: "bg-emerald-50 text-emerald-700",
  Grocery: "bg-blue-50 text-blue-700",
  Floral: "bg-pink-50 text-pink-700",
  Other: "bg-slate-50 text-slate-600",
};

type Tab = "items" | "product-requests";
const NEW_PRODUCT = "NEW" as const;

export default function ProductDirectoryPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<ProductDepartment | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [drawerProduct, setDrawerProduct] = useState<Product | typeof NEW_PRODUCT | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (deptFilter) params.set("department", deptFilter);
  const qs = params.toString();

  const { data: rawProducts, isLoading, mutate } = useSWR<Product[]>(
    `/api/products${qs ? `?${qs}` : ""}`,
    fetcher
  );
  const products: Product[] = Array.isArray(rawProducts) ? rawProducts : [];

  const canEdit =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Art Director" ||
    user?.role === "Studio";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Food</h2>
          <p className="text-sm text-text-secondary">
            {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["items", "product-requests"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            {t === "items" ? "Items" : "Product Requests"}
          </button>
        ))}
      </div>

      {tab === "items" && (
        <>
          {/* Search + filter bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative min-w-[180px] max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="ml-auto flex items-center gap-1">
                {canEdit && (
                  <button
                    onClick={() => setDrawerProduct(NEW_PRODUCT)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                    title="Add product"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "grid" ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setDeptFilter("")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  deptFilter === ""
                    ? "bg-text-primary text-white"
                    : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}
              >
                All
              </button>
              {PRODUCT_DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  onClick={() => setDeptFilter(deptFilter === dept ? "" : dept)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    deptFilter === dept
                      ? "bg-text-primary text-white"
                      : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={<ShoppingBasket className="h-5 w-5" />}
              title={search || deptFilter ? "No products match your filters" : "No products yet"}
              description={
                search || deptFilter
                  ? "Try adjusting your search or department filter."
                  : "Start building your product directory by adding products used in shoots."
              }
              action={
                canEdit && !search && !deptFilter ? (
                  <Button size="sm" onClick={() => setDrawerProduct(NEW_PRODUCT)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Product
                  </Button>
                ) : undefined
              }
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setDrawerProduct(product)}
                  className="flex flex-col rounded-xl border border-border bg-surface p-4 text-left hover:bg-surface-secondary transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-14 w-14 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
                        <ShoppingBasket className="h-6 w-6 text-text-tertiary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {product.name}
                      </p>
                      {product.itemCode && (
                        <p className="text-[10px] font-mono text-text-tertiary leading-tight">
                          {product.itemCode}
                        </p>
                      )}
                      <Badge
                        variant="custom"
                        className={`mt-1 ${DEPT_COLORS[product.department] || DEPT_COLORS.Other}`}
                      >
                        {product.department}
                      </Badge>
                    </div>
                  </div>
                  {product.shootingNotes && (
                    <p className="mt-2 text-xs text-text-secondary line-clamp-2">
                      {product.shootingNotes}
                    </p>
                  )}
                  {product.restrictions && (
                    <p className="mt-1 text-xs text-orange-700 font-medium">
                      {product.restrictions}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_160px_1fr] gap-0 bg-surface-secondary border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                <div>Name</div>
                <div>Department</div>
                <div>Restrictions</div>
              </div>
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setDrawerProduct(product)}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_160px_1fr] gap-0 px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface-secondary cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="h-7 w-7 rounded object-cover shrink-0" />
                    ) : null}
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate block">{product.name}</span>
                      {product.itemCode && (
                        <span className="text-[10px] font-mono text-text-tertiary">{product.itemCode}</span>
                      )}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center">
                    <Badge variant="custom" className={`text-[10px] ${DEPT_COLORS[product.department] || DEPT_COLORS.Other}`}>
                      {product.department}
                    </Badge>
                  </div>
                  <div className="hidden sm:flex items-center">
                    <span className="text-xs text-orange-700 font-medium truncate">{product.restrictions || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "product-requests" && (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No product requests yet"
          description="Product requests from shoots will appear here."
        />
      )}

      {/* Unified Product Drawer */}
      {drawerProduct !== null && (
        <ProductDrawer
          product={drawerProduct === NEW_PRODUCT ? null : drawerProduct}
          onClose={() => setDrawerProduct(null)}
          onSaved={(updated) => {
            mutate();
            if (updated) setDrawerProduct(updated);
            else setDrawerProduct(null);
          }}
          onDeleted={() => { setDrawerProduct(null); mutate(); }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

// Auto-expanding textarea
function AutoTextarea({
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
function ProductDrawer({
  product,
  onClose,
  onSaved,
  onDeleted,
  canEdit,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: (updated: Product | null) => void;
  onDeleted: () => void;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const isNew = product === null;
  const [editMode, setEditMode] = useState(isNew);
  const [current, setCurrent] = useState<Product | null>(product);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(product?.name ?? "");
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
    current ? `/api/products/${current.id}/notes` : null,
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
    current ? `/api/products/${current.id}?history=true` : null,
    fetcher
  );
  const campaigns = historyData?.campaigns || [];

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
      setCurrent(saved);
      setEditMode(false);
      onSaved(saved);
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

  async function handlePcomImport() {
    if (!pcomUrl.trim()) return;
    setPcomFetching(true);
    setPcomError("");
    setPcomFetched(false);
    try {
      const res = await fetch("/api/scrape-pcom", {
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
          placeholder="Product name"
          className={`text-lg font-semibold text-text-primary bg-transparent flex-1 min-w-0 focus:outline-none ${editMode ? "border-b border-transparent hover:border-border focus:border-primary pb-0.5" : "pointer-events-none truncate"}`}
        />
        <div className="flex items-center gap-1 shrink-0">
          {editMode ? (
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as ProductDepartment)}
              className={`text-xs font-medium rounded-full px-2.5 py-0.5 focus:outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-primary ${department ? (DEPT_COLORS[department] || DEPT_COLORS.Other) : "bg-surface-secondary text-text-tertiary"}`}
            >
              <option value="">Dept…</option>
              {PRODUCT_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${department ? (DEPT_COLORS[department] || DEPT_COLORS.Other) : "bg-surface-secondary text-text-tertiary"}`}>
              {department || "No dept"}
            </span>
          )}
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
              <span className="text-sm font-semibold text-text-primary">Add from Pcom</span>
              {pcomFetched && <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto shrink-0" />}
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={pcomUrl}
                onChange={(e) => { setPcomUrl(e.target.value); setPcomFetched(false); setPcomError(""); }}
                placeholder="https://www.publix.com/pd/..."
                className="flex-1 h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
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
            {pcomError && <p className="text-xs text-red-600">{pcomError}</p>}
            {pcomFetched && (
              <p className="text-xs text-emerald-700 font-medium">
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
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Pcom Link</p>
              <input type="url" value={pcomLink} onChange={(e) => setPcomLink(e.target.value)} placeholder="https://www.publix.com/pd/..."
                className="w-full bg-transparent text-sm text-primary placeholder:text-text-tertiary italic focus:outline-none" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">R&P Guide</p>
              <input type="url" value={rpGuideUrl} onChange={(e) => setRpGuideUrl(e.target.value)} placeholder="https://..."
                className="w-full bg-transparent text-sm text-primary placeholder:text-text-tertiary italic focus:outline-none" />
            </div>
          </div>
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
            ) : current.imageUrl ? (
              <img
                src={current.imageUrl}
                alt={current.name}
                onClick={() => setLightboxUrl(current.imageUrl)}
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

          {/* Shooting Notes */}
          <div>
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
            ) : (
              <p className="text-sm text-text-tertiary italic mb-2">No notes yet</p>
            )}
            <div className="flex gap-2">
              <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                placeholder="Add a note…"
                className="flex-1 h-8 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="button" onClick={handleAddNote} disabled={!newNote.trim() || addingNote}
                className="h-8 px-3 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40 transition-opacity shrink-0">
                {addingNote ? "…" : "Add"}
              </button>
            </div>
          </div>

          {/* Restrictions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">Restrictions</p>
            <AutoTextarea
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              readOnly={!editMode}
              placeholder={editMode ? "None" : "None"}
              className={`w-full bg-transparent text-sm font-medium placeholder:text-text-tertiary italic focus:outline-none resize-none ${!editMode ? "pointer-events-none" : ""} ${restrictions ? "text-orange-700" : "text-text-primary"}`}
            />
          </div>

          {/* Pcom Link + R&P Guide */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">Pcom Link</p>
              <div className="flex items-center gap-1.5">
                {!editMode && pcomLink && (
                  <a href={pcomLink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <input
                  type="url"
                  value={editMode ? pcomLink : (pcomLink ? "View on Publix.com" : "")}
                  onChange={(e) => setPcomLink(e.target.value)}
                  readOnly={!editMode}
                  placeholder={editMode ? "https://www.publix.com/pd/..." : "No link"}
                  className={`w-full bg-transparent text-sm placeholder:text-text-tertiary italic focus:outline-none ${!editMode ? "pointer-events-none text-primary" : "text-primary"} ${!editMode && !pcomLink ? "text-text-tertiary" : ""}`}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">R&P Guide</p>
              <div className="flex items-center gap-1.5">
                {!editMode && rpGuideUrl && (
                  <a href={rpGuideUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <input
                  type="url"
                  value={editMode ? rpGuideUrl : (rpGuideUrl ? "View Guide" : "")}
                  onChange={(e) => setRpGuideUrl(e.target.value)}
                  readOnly={!editMode}
                  placeholder={editMode ? "https://..." : "No document"}
                  className={`w-full bg-transparent text-sm placeholder:text-text-tertiary italic focus:outline-none ${!editMode ? "pointer-events-none text-primary" : "text-primary"} ${!editMode && !rpGuideUrl ? "text-text-tertiary" : ""}`}
                />
              </div>
            </div>
          </div>

          {/* Campaign History (view only) */}
          {!editMode && campaigns.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Campaign History</p>
              <div className="space-y-1.5">
                {campaigns.map((c: { campaignId: string; campaignName: string; wfNumber: string }) => (
                  <Link key={c.campaignId} href={`/campaigns/${c.campaignId}`}
                    className="flex items-center gap-2 rounded-lg bg-surface-secondary p-2.5 text-sm hover:bg-surface-tertiary transition-colors">
                    <span className="text-text-tertiary font-mono text-xs">{c.wfNumber || "—"}</span>
                    <span className="text-text-primary font-medium">{c.campaignName}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2 pt-1 border-t border-border">
              {editMode ? (
                <>
                  <Button type="button" variant="ghost" onClick={handleCancelEdit} className="flex-1">Cancel</Button>
                  <Button type="submit" loading={saving} className="flex-1">Save Changes</Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={() => setEditMode(true)} className="flex-1">
                    <Edit2 className="h-3.5 w-3.5" />Edit
                  </Button>
                  <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
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

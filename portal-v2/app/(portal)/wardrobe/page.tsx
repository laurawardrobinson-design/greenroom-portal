"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import type { WardrobeItem, WardrobeCategory } from "@/types/domain";
import { WARDROBE_CATEGORIES } from "@/lib/validation/wardrobe.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Drawer } from "@/components/ui/drawer";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Plus,
  Search,
  Shirt,
  Edit2,
  Trash2,
  ExternalLink,
  LayoutGrid,
  List,
} from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

const CATEGORY_COLORS: Record<string, string> = {
  Tops:        "bg-blue-50 text-blue-700",
  Aprons:      "bg-emerald-50 text-emerald-700",
  Headwear:    "bg-violet-50 text-violet-700",
  Bottoms:     "bg-slate-100 text-slate-700",
  Outerwear:   "bg-amber-50 text-amber-700",
  Footwear:    "bg-orange-50 text-orange-700",
  Accessories: "bg-pink-50 text-pink-700",
  Other:       "bg-slate-50 text-slate-600",
};

const NEW_ITEM = "NEW" as const;

export default function WardrobePage() {
  const { user } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<WardrobeCategory | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [drawerItem, setDrawerItem] = useState<WardrobeItem | typeof NEW_ITEM | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (categoryFilter) params.set("category", categoryFilter);
  const qs = params.toString();

  const { data: rawItems, isLoading, mutate } = useSWR<WardrobeItem[]>(
    `/api/wardrobe${qs ? `?${qs}` : ""}`,
    fetcher
  );
  const items: WardrobeItem[] = Array.isArray(rawItems) ? rawItems : [];

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
          <h2 className="text-2xl font-bold text-text-primary">Wardrobe</h2>
          <p className="text-sm text-text-secondary">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search wardrobe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            {canEdit && (
              <button
                onClick={() => setDrawerItem(NEW_ITEM)}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                title="Add item"
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
            onClick={() => setCategoryFilter("")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              categoryFilter === ""
                ? "bg-text-primary text-white"
                : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
            }`}
          >
            All
          </button>
          {WARDROBE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                categoryFilter === cat
                  ? "bg-text-primary text-white"
                  : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Shirt className="h-5 w-5" />}
          title={search || categoryFilter ? "No items match your filters" : "No wardrobe items yet"}
          description={
            search || categoryFilter
              ? "Try adjusting your search or category filter."
              : "Start building your wardrobe directory by adding Publix uniforms used in shoots."
          }
          action={
            canEdit && !search && !categoryFilter ? (
              <Button size="sm" onClick={() => setDrawerItem(NEW_ITEM)}>
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setDrawerItem(item)}
              className="flex flex-col rounded-xl border border-border bg-surface p-4 text-left hover:bg-surface-secondary transition-colors"
            >
              <div className="flex items-start gap-3">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-14 w-14 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
                    <Shirt className="h-6 w-6 text-text-tertiary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                  <Badge
                    variant="custom"
                    className={`mt-1 ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other}`}
                  >
                    {item.category}
                  </Badge>
                </div>
              </div>
              {item.shootingNotes && (
                <p className="mt-2 text-xs text-text-secondary line-clamp-2">{item.shootingNotes}</p>
              )}
              {item.restrictions && (
                <p className="mt-1 text-xs text-orange-700 font-medium">{item.restrictions}</p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_160px_1fr] gap-0 bg-surface-secondary border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            <div>Name</div>
            <div>Category</div>
            <div>Restrictions</div>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => setDrawerItem(item)}
              className="grid grid-cols-1 sm:grid-cols-[1fr_160px_1fr] gap-0 px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface-secondary cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-7 w-7 rounded object-cover shrink-0" />
                ) : null}
                <span className="text-sm font-medium text-text-primary truncate">{item.name}</span>
              </div>
              <div className="hidden sm:flex items-center">
                <Badge variant="custom" className={`text-[10px] ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other}`}>
                  {item.category}
                </Badge>
              </div>
              <div className="hidden sm:flex items-center">
                <span className="text-xs text-orange-700 font-medium truncate">{item.restrictions || "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawerItem !== null && (
        <WardrobeDrawer
          item={drawerItem === NEW_ITEM ? null : drawerItem}
          onClose={() => setDrawerItem(null)}
          onSaved={(updated) => {
            mutate();
            if (updated) setDrawerItem(updated);
            else setDrawerItem(null);
          }}
          onDeleted={() => { setDrawerItem(null); mutate(); }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

// ── Wardrobe Drawer (view / add / edit) ─────────────────────────────────────

function WardrobeDrawer({
  item,
  onClose,
  onSaved,
  onDeleted,
  canEdit,
}: {
  item: WardrobeItem | null;
  onClose: () => void;
  onSaved: (updated: WardrobeItem | null) => void;
  onDeleted: () => void;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(!item); // new item opens straight to edit
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState<WardrobeCategory>(item?.category || "Tops");
  const [description, setDescription] = useState(item?.description || "");
  const [shootingNotes, setShootingNotes] = useState(item?.shootingNotes || "");
  const [restrictions, setRestrictions] = useState(item?.restrictions || "");
  const [guideUrl, setGuideUrl] = useState(item?.guideUrl || "");
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl || null);
  const imageFileRef = useRef<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "wardrobe");
    const res = await fetch("/api/upload-image", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image upload failed");
    return data.url;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast("error", "Item name is required"); return; }
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFileRef.current) {
        finalImageUrl = await uploadImage(imageFileRef.current);
      }
      const body = {
        name: name.trim(),
        category,
        description,
        shootingNotes,
        restrictions,
        guideUrl: guideUrl || null,
        imageUrl: finalImageUrl || null,
      };
      const url = item ? `/api/wardrobe/${item.id}` : "/api/wardrobe";
      const method = item ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      const saved: WardrobeItem = await res.json();
      toast("success", item ? "Item updated" : "Item added");
      onSaved(saved);
    } catch {
      toast("error", "Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/wardrobe/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Item deleted");
      onDeleted();
    } catch {
      toast("error", "Failed to delete item");
    } finally {
      setDeleting(false);
    }
  }

  const title = !item ? "Add Item" : editing ? "Edit Item" : item.name;

  return (
    <Drawer open={true} onClose={onClose} title={title} size="lg">
      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <ImageUpload
            value={imageUrl}
            onFileSelected={(file) => { imageFileRef.current = file; }}
            onRemove={() => { imageFileRef.current = null; setImageUrl(null); }}
          />
          <Input
            label="Item Name"
            placeholder="e.g., Green Apron"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as WardrobeCategory)}
            options={WARDROBE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="General description of this uniform item..."
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Styling Notes</label>
            <textarea
              value={shootingNotes}
              onChange={(e) => setShootingNotes(e.target.value)}
              placeholder="How should this be worn on camera? Tucked in, sleeves rolled, accessories to pair..."
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Restrictions</label>
            <textarea
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              placeholder="Seasonal use, sizing notes, special handling..."
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <Input
            label="Brand Guide URL"
            placeholder="https://..."
            value={guideUrl}
            onChange={(e) => setGuideUrl(e.target.value)}
          />
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => item ? setEditing(false) : onClose()}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              {item ? "Save Changes" : "Add Item"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          {/* Image + category */}
          <div className="flex items-start gap-4">
            {item?.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-20 w-20 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-tertiary">
                <Shirt className="h-8 w-8 text-text-tertiary" />
              </div>
            )}
            <div>
              <Badge
                variant="custom"
                className={CATEGORY_COLORS[item!.category] || CATEGORY_COLORS.Other}
              >
                {item!.category}
              </Badge>
              {item?.description && (
                <p className="mt-2 text-sm text-text-secondary">{item.description}</p>
              )}
            </div>
          </div>

          {item?.shootingNotes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                Styling Notes
              </p>
              <p className="text-sm text-text-primary whitespace-pre-wrap">{item.shootingNotes}</p>
            </div>
          )}

          {item?.restrictions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">
                Restrictions
              </p>
              <p className="text-sm text-amber-700 font-medium">{item.restrictions}</p>
            </div>
          )}

          {item?.guideUrl && (
            <a
              href={item.guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Brand Guide
            </a>
          )}

          {canEdit && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="secondary" onClick={() => setEditing(true)} className="flex-1">
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

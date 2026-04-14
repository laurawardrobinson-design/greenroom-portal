"use client";

import { useState, useRef, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import type {
  WardrobeItem,
  WardrobeCategory,
  WardrobeCondition,
  WardrobeCheckout,
  WardrobeReservation,
  WardrobeUnit,
  UnitSize,
  UnitGender,
  JobClass,
  JobClassItem,
  JobClassNote,
  JobClassItemGender,
} from "@/types/domain";
import { WARDROBE_CATEGORIES, UNIT_SIZES, UNIT_GENDERS } from "@/lib/validation/wardrobe.schema";
import { PRODUCT_DEPARTMENTS } from "@/lib/validation/products.schema";
import { DEPT_COLORS } from "@/components/products/product-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Drawer } from "@/components/ui/drawer";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ImageUpload } from "@/components/ui/image-upload";
import { QrScanner } from "@/components/ui/qr-scanner";
import {
  Plus,
  Search,
  Shirt,
  Edit2,
  Trash2,
  ExternalLink,
  LayoutGrid,
  List,
  ScanLine,
  QrCode,
  Calendar,
  ArrowUpFromLine,
  ArrowDownToLine,
  X,
  Users,
  MessageSquare,
  Package,
  StopCircle,
  ChevronRight,
  AlertTriangle,
  Link as LinkIcon,
  Archive,
  ChevronDown,
  Hash,
  Camera,
  ShieldAlert,
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

const STATUS_COLORS: Record<string, string> = {
  Available:    "bg-emerald-50 text-emerald-700",
  Reserved:     "bg-blue-50 text-blue-700",
  "Checked Out":"bg-amber-50 text-amber-700",
};

const CONDITIONS: WardrobeCondition[] = ["Excellent", "Good", "Fair", "Poor", "Damaged"];

type Tab = "job-classes" | "items" | "backstock" | "reservations";
const NEW_ITEM = "NEW" as const;

const GENDER_COLORS: Record<string, string> = {
  "Men's":   "bg-sky-50 text-sky-700",
  "Women's": "bg-fuchsia-50 text-fuchsia-700",
  "Unisex":  "bg-slate-100 text-slate-600",
  "All":     "bg-slate-100 text-slate-600",
};

const SIZE_ORDER = ["XS","S","M","L","XL","2XL","3XL","One Size","Other"] as const;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WardrobePage() {
  const { user } = useCurrentUser();
  const { mutate: globalMutate } = useSWRConfig();
  const [tab, setTab] = useState<Tab>("job-classes");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<WardrobeCategory | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [drawerItem, setDrawerItem] = useState<WardrobeItem | typeof NEW_ITEM | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<WardrobeItem | null>(null);
  const [checkinItem, setCheckinItem] = useState<WardrobeItem | null>(null);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [cartItems, setCartItems] = useState<WardrobeItem[]>([]);
  const [cartMode, setCartMode] = useState<"checkout" | "checkin" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const cartRef = useRef<WardrobeItem[]>([]);
  cartRef.current = cartItems;
  const cartModeRef = useRef<"checkout" | "checkin" | null>(null);
  cartModeRef.current = cartMode;

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
    user?.role === "Admin" || user?.role === "Producer" ||
    user?.role === "Art Director" || user?.role === "Studio";

  // ── Scan handlers ──────────────────────────────────────────────────────────
  const { toast } = useToast();

  const handleScan = useCallback(async (code: string) => {
    const normalized = code.trim();
    if (!normalized) return;
    if (cartRef.current.some((i) => i.qrCode?.toLowerCase() === normalized.toLowerCase())) return;
    try {
      const res = await fetch(`/api/wardrobe?qr=${encodeURIComponent(normalized)}`);
      if (!res.ok) throw new Error("Item not found");
      const item: WardrobeItem = await res.json();
      const itemMode = item.status === "Checked Out" ? "checkin" : "checkout";
      if (cartModeRef.current === null) setCartMode(itemMode);
      setCartItems((prev) => prev.some((i) => i.id === item.id) ? prev : [...prev, item]);
      toast("success", `Added: ${item.name}`);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch {
      toast("error", "Item not found — check QR code");
    }
  }, [toast]);

  async function handleManualEntry() {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode("");
    await handleScan(code);
  }

  async function handleBatchCheckout() {
    const eligible = cartItems.filter((i) => i.status === "Available" || i.status === "Reserved");
    if (!eligible.length) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_checkout",
          items: eligible.map((i) => ({ wardrobeItemId: i.id, condition: i.condition || "Good" })),
        }),
      });
      if (!res.ok) throw new Error();
      toast("success", `Checked out ${eligible.length} item(s)`);
      setCartItems([]); setCartMode(null);
      mutate(); globalMutate("/api/wardrobe/checkouts");
    } catch { toast("error", "Checkout failed"); }
    finally { setProcessing(false); }
  }

  async function handleBatchCheckin() {
    const eligible = cartItems.filter((i) => i.status === "Checked Out");
    if (!eligible.length) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_checkin",
          wardrobeItemIds: eligible.map((i) => i.id),
          condition: "Good",
        }),
      });
      if (!res.ok) throw new Error();
      toast("success", `Checked in ${eligible.length} item(s)`);
      setCartItems([]); setCartMode(null);
      mutate(); globalMutate("/api/wardrobe/checkouts");
    } catch { toast("error", "Check-in failed"); }
    finally { setProcessing(false); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Wardrobe</h2>
          <p className="text-sm text-text-secondary">Uniform planning and physical backstock</p>
        </div>
        {tab === "backstock" && (
          <Button variant="secondary" onClick={() => { setShowScanner(true); setScannerActive(true); }}>
            <ScanLine className="h-4 w-4" />
            Scan Units
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["job-classes", "items", "backstock", "reservations"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            {t === "job-classes" ? "Job Classes" : t === "items" ? "Uniform Items" : t === "backstock" ? "Backstock" : "Reservations"}
          </button>
        ))}
      </div>

      {/* ── Job Classes Tab ── */}
      {tab === "job-classes" && (
        <JobClassesTab canEdit={canEdit} allItems={items} />
      )}

      {/* ── Uniform Items Tab ── */}
      {tab === "items" && (
        <>
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
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setViewMode("grid")} className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "grid" ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}>
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode("list")} className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${viewMode === "list" ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"}`}>
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setCategoryFilter("")} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${categoryFilter === "" ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"}`}>All</button>
              {WARDROBE_CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${categoryFilter === cat ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"}`}>{cat}</button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Shirt className="h-5 w-5" />}
              title={search || categoryFilter ? "No items match your filters" : "No wardrobe items yet"}
              description={search || categoryFilter ? "Try adjusting your search or category filter." : "Start building your wardrobe directory by adding Publix uniforms used in shoots."}
              action={canEdit && !search && !categoryFilter ? <Button size="sm" onClick={() => setDrawerItem(NEW_ITEM)}><Plus className="h-3.5 w-3.5" />Add Item</Button> : undefined}
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
                <button key={item.id} onClick={() => setDrawerItem(item)} className="flex flex-col rounded-xl border border-border bg-surface p-4 text-left hover:bg-surface-secondary transition-colors">
                  <div className="flex items-start gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
                        <Shirt className="h-6 w-6 text-text-tertiary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                      <Badge variant="custom" className={`mt-1 ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other}`}>{item.category}</Badge>
                    </div>
                  </div>
                  {item.shootingNotes && <p className="mt-2 text-xs text-text-secondary line-clamp-2">{item.shootingNotes}</p>}
                  {item.restrictions && <p className="mt-1 text-xs text-orange-700 font-medium line-clamp-1">{item.restrictions}</p>}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_140px_120px_100px] bg-surface-secondary border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                <div>Name</div><div>Category</div><div>Condition</div><div>Status</div>
              </div>
              {items.map((item) => (
                <div key={item.id} onClick={() => setDrawerItem(item)} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_120px_100px] px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface-secondary cursor-pointer transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.imageUrl && <img src={item.imageUrl} alt="" className="h-7 w-7 rounded object-cover shrink-0" />}
                    <span className="text-sm font-medium text-text-primary truncate">{item.name}</span>
                  </div>
                  <div className="hidden sm:flex items-center"><span className="text-xs text-text-secondary">{item.category}</span></div>
                  <div className="hidden sm:flex items-center"><span className="text-xs text-text-secondary">{item.condition}</span></div>
                  <div className="hidden sm:flex items-center"><Badge variant="custom" className={`text-[10px] ${STATUS_COLORS[item.status] || ""}`}>{item.status}</Badge></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Backstock Tab ── */}
      {tab === "backstock" && (
        <BackstockTab items={items} canEdit={canEdit} />
      )}

      {/* ── Reservations Tab ── */}
      {tab === "reservations" && (
        <ReservationsTab items={items} canEdit={canEdit} onMutate={mutate} />
      )}

      {/* ── Modals & Drawers ── */}
      {drawerItem !== null && (
        <WardrobeDrawer
          item={drawerItem === NEW_ITEM ? null : drawerItem}
          onClose={() => setDrawerItem(null)}
          onSaved={(updated) => { mutate(); updated ? setDrawerItem(updated) : setDrawerItem(null); }}
          onDeleted={() => { setDrawerItem(null); mutate(); }}
          canEdit={canEdit}
        />
      )}
      {checkoutItem && (
        <CheckoutModal item={checkoutItem} onClose={() => setCheckoutItem(null)} onDone={() => { setCheckoutItem(null); mutate(); }} />
      )}
      {checkinItem && (
        <CheckinModal item={checkinItem} onClose={() => setCheckinItem(null)} onDone={() => { setCheckinItem(null); mutate(); }} />
      )}

      {/* ── Scanner Modal ── */}
      <Modal open={showScanner} onClose={() => { setShowScanner(false); setScannerActive(false); }} title="Check Out / Check In" description="Scan wardrobe QR codes to check items out or in" size="lg">
        <div className="space-y-4">
          {/* Scanner tile */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">SCAN ITEMS</h3>
              </div>
              {scannerActive ? (
                <button onClick={() => setScannerActive(false)} className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors">
                  <StopCircle className="h-3.5 w-3.5" />Stop scanning
                </button>
              ) : (
                <button onClick={() => setScannerActive(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  <ScanLine className="h-3.5 w-3.5" />Start scanning
                </button>
              )}
            </div>
            <div className="p-4">
              {scannerActive ? (
                <QrScanner active={scannerActive && showScanner} onScan={handleScan} onError={(err) => toast("error", err)} />
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-secondary/50 p-6 text-center">
                  <QrCode className="h-5 w-5 text-text-tertiary" />
                  <p className="text-sm text-text-secondary">Camera stopped. Tap <strong>Start scanning</strong> to resume.</p>
                </div>
              )}
            </div>
          </div>

          {/* Manual entry */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <Package className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">MANUAL ENTRY</h3>
            </div>
            <div className="flex gap-2 p-3.5">
              <input
                type="text"
                placeholder="Type or paste QR code..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleManualEntry(); }}
                className="h-9 flex-1 rounded-lg border border-border bg-surface pl-3 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <Button size="sm" onClick={handleManualEntry}>Add</Button>
            </div>
          </div>

          {/* Cart */}
          <WardrobeBatchCart
            items={cartItems}
            cartMode={cartMode}
            onRemove={(id) => setCartItems((prev) => prev.filter((i) => i.id !== id))}
            onCheckOutAll={handleBatchCheckout}
            onCheckInAll={handleBatchCheckin}
            onClear={() => { setCartItems([]); setCartMode(null); }}
            processing={processing}
          />

          {/* Active checkouts */}
          <WardrobeActiveCheckouts
            onLoadToCart={(items) => {
              const newItems = items.filter((item) => !cartItems.some((c) => c.id === item.id));
              setCartItems((prev) => [...prev, ...newItems]);
              setCartMode("checkin");
            }}
          />
        </div>
      </Modal>
    </div>
  );
}

// ── Wardrobe Drawer ───────────────────────────────────────────────────────────

function WardrobeDrawer({ item, onClose, onSaved, onDeleted, canEdit }: {
  item: WardrobeItem | null;
  onClose: () => void;
  onSaved: (updated: WardrobeItem | null) => void;
  onDeleted: () => void;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(!item);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState<WardrobeCategory>(item?.category || "Tops");
  const [description, setDescription] = useState(item?.description || "");
  const [shootingNotes, setShootingNotes] = useState(item?.shootingNotes || "");
  const [restrictions, setRestrictions] = useState(item?.restrictions || "");
  const [guideUrl, setGuideUrl] = useState(item?.guideUrl || "");
  const [qrCode, setQrCode] = useState(item?.qrCode || "");
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl || null);
  const imageFileRef = useRef<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "wardrobe");
    const res = await fetch("/api/upload-image", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast("error", "Item name is required"); return; }
    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFileRef.current) finalImageUrl = await uploadImage(imageFileRef.current);
      const body = { name: name.trim(), category, description, shootingNotes, restrictions, guideUrl: guideUrl || null, qrCode: qrCode.trim() || null, imageUrl: finalImageUrl || null };
      const res = await fetch(item ? `/api/wardrobe/${item.id}` : "/api/wardrobe", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const saved: WardrobeItem = await res.json();
      toast("success", item ? "Item updated" : "Item added");
      onSaved(saved);
    } catch { toast("error", "Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/wardrobe/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("success", "Item deleted");
      onDeleted();
    } catch { toast("error", "Failed to delete"); }
    finally { setDeleting(false); }
  }

  return (
    <Drawer open={true} onClose={onClose} title={!item ? "Add Item" : editing ? "Edit Item" : item.name} size="lg">
      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <ImageUpload value={imageUrl} onFileSelected={(f) => { imageFileRef.current = f; }} onRemove={() => { imageFileRef.current = null; setImageUrl(null); }} />
          <Input label="Item Name" placeholder="e.g., Green Apron" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as WardrobeCategory)} options={WARDROBE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="General description..." rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Styling Notes</label>
            <textarea value={shootingNotes} onChange={(e) => setShootingNotes(e.target.value)} placeholder="How to wear on camera — tucked in, sleeves rolled, accessories..." rows={3} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Restrictions</label>
            <textarea value={restrictions} onChange={(e) => setRestrictions(e.target.value)} placeholder="Seasonal use, sizing, special handling..." rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <Input label="Brand Guide URL" placeholder="https://..." value={guideUrl} onChange={(e) => setGuideUrl(e.target.value)} />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => item ? setEditing(false) : onClose()} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">{item ? "Save Changes" : "Add Item"}</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            {item?.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="h-20 w-20 rounded-xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-tertiary">
                <Shirt className="h-8 w-8 text-text-tertiary" />
              </div>
            )}
            <div className="space-y-1">
              <div className="flex flex-wrap gap-1">
                <Badge variant="custom" className={CATEGORY_COLORS[item!.category] || CATEGORY_COLORS.Other}>{item!.category}</Badge>
              </div>
              {item?.description && <p className="text-sm text-text-secondary">{item.description}</p>}
            </div>
          </div>
          {item?.shootingNotes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">Styling Notes</p>
              <p className="text-sm text-text-primary whitespace-pre-wrap">{item.shootingNotes}</p>
            </div>
          )}
          {item?.restrictions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-1">Restrictions</p>
              <p className="text-sm text-amber-700 font-medium">{item.restrictions}</p>
            </div>
          )}
          {item?.guideUrl && (
            <a href={item.guideUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" />View Brand Guide
            </a>
          )}
          {canEdit && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="secondary" onClick={() => setEditing(true)} className="flex-1"><Edit2 className="h-3.5 w-3.5" />Edit</Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ── Checkout Modal ────────────────────────────────────────────────────────────

function CheckoutModal({ item, onClose, onDone }: { item: WardrobeItem; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState("Good");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", wardrobeItemId: item.id, condition, notes }),
      });
      if (!res.ok) throw new Error();
      toast("success", `${item.name} checked out`);
      onDone();
    } catch { toast("error", "Failed to check out"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Check Out — ${item.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Condition" value={condition} onChange={(e) => setCondition(e.target.value)} options={CONDITIONS.map((c) => ({ value: c, label: c }))} />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Which shoot, any handling notes..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Check Out</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ── Checkin Modal ─────────────────────────────────────────────────────────────

function CheckinModal({ item, onClose, onDone }: { item: WardrobeItem; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState("Good");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin_by_item", wardrobeItemId: item.id, condition, notes }),
      });
      if (!res.ok) throw new Error();
      toast("success", `${item.name} checked in`);
      onDone();
    } catch { toast("error", "Failed to check in"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Check In — ${item.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Condition on return" value={condition} onChange={(e) => setCondition(e.target.value)} options={CONDITIONS.map((c) => ({ value: c, label: c }))} />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any damage or notes on return..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Check In</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ── Wardrobe Batch Cart ───────────────────────────────────────────────────────

function WardrobeBatchCart({ items, cartMode, onRemove, onCheckOutAll, onCheckInAll, onClear, processing }: {
  items: WardrobeItem[];
  cartMode: "checkout" | "checkin" | null;
  onRemove: (id: string) => void;
  onCheckOutAll: () => void;
  onCheckInAll: () => void;
  onClear: () => void;
  processing: boolean;
}) {
  if (items.length === 0) return null;
  const available = items.filter((i) => i.status === "Available" || i.status === "Reserved").length;
  const checkedOut = items.filter((i) => i.status === "Checked Out").length;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">SCANNED ITEMS ({items.length})</h3>
        </div>
        <button onClick={onClear} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors">Clear all</button>
      </div>
      <div className="divide-y divide-border-light max-h-48 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="custom" className={`text-[10px] ${STATUS_COLORS[item.status] || ""}`}>{item.status}</Badge>
                <span className="text-[10px] text-text-tertiary">{item.category}</span>
              </div>
            </div>
            <button onClick={() => onRemove(item.id)} className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-secondary transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-3.5 border-t border-border">
        {(cartMode === "checkout" || cartMode === null) && available > 0 && (
          <Button size="sm" onClick={onCheckOutAll} loading={processing} className="flex-1">
            <ArrowUpFromLine className="h-3.5 w-3.5" />Check Out {available}
          </Button>
        )}
        {(cartMode === "checkin" || cartMode === null) && checkedOut > 0 && (
          <Button size="sm" variant="secondary" onClick={onCheckInAll} loading={processing} className="flex-1">
            <ArrowDownToLine className="h-3.5 w-3.5" />Check In {checkedOut}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Wardrobe Active Checkouts ─────────────────────────────────────────────────

function WardrobeActiveCheckouts({ onLoadToCart }: { onLoadToCart?: (items: WardrobeItem[]) => void }) {
  const { toast } = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: checkouts = [], mutate } = useSWR<WardrobeCheckout[]>("/api/wardrobe/checkouts", fetcher);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  async function handleCheckin(checkout: WardrobeCheckout) {
    setCheckingIn(checkout.id);
    try {
      const res = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin", checkoutId: checkout.id, condition: "Good" }),
      });
      if (!res.ok) throw new Error();
      toast("success", `${checkout.wardrobeItem?.name} checked in`);
      mutate(); globalMutate("/api/wardrobe");
    } catch { toast("error", "Failed to check in"); }
    finally { setCheckingIn(null); }
  }

  if (checkouts.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <ArrowUpFromLine className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">CURRENTLY CHECKED OUT ({checkouts.length})</h3>
        </div>
        {onLoadToCart && (
          <button
            onClick={() => onLoadToCart(checkouts.map((c) => c.wardrobeItem!).filter(Boolean))}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Load all to cart
          </button>
        )}
      </div>
      <div className="divide-y divide-border-light max-h-48 overflow-y-auto">
        {checkouts.map((checkout) => (
          <div key={checkout.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{checkout.wardrobeItem?.name || "Unknown item"}</p>
              <p className="text-[10px] text-text-tertiary">
                Out {formatDistanceToNow(parseISO(checkout.checkedOutAt), { addSuffix: true })}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => handleCheckin(checkout)} loading={checkingIn === checkout.id}>
              <ArrowDownToLine className="h-3 w-3" />In
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reservations Tab ──────────────────────────────────────────────────────────

function ReservationsTab({ items, canEdit, onMutate }: { items: WardrobeItem[]; canEdit: boolean; onMutate: () => void }) {
  const { toast } = useToast();
  const { data: rawReservations, isLoading, mutate } = useSWR<WardrobeReservation[]>("/api/wardrobe/reservations", fetcher);
  const reservations = Array.isArray(rawReservations) ? rawReservations : [];
  const [showReserve, setShowReserve] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItemId || !startDate || !endDate) { toast("error", "Fill in all fields"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/wardrobe/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wardrobeItemId: selectedItemId, startDate, endDate }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast("success", "Item reserved");
      setShowReserve(false); setSelectedItemId(""); setStartDate(""); setEndDate("");
      mutate(); onMutate();
    } catch (err) { toast("error", err instanceof Error ? err.message : "Failed to reserve"); }
    finally { setSaving(false); }
  }

  async function handleCancel(id: string) {
    try {
      const res = await fetch(`/api/wardrobe/reservations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("success", "Reservation cancelled");
      mutate(); onMutate();
    } catch { toast("error", "Failed to cancel"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{reservations.length} active reservation{reservations.length !== 1 ? "s" : ""}</p>
        {canEdit && (
          <Button size="sm" onClick={() => setShowReserve(true)}>
            <Calendar className="h-3.5 w-3.5" />Reserve Item
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="grid gap-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : reservations.length === 0 ? (
        <EmptyState icon={<Calendar className="h-5 w-5" />} title="No reservations" description="Reserve wardrobe items for upcoming shoots to make sure they're available." action={canEdit ? <Button size="sm" onClick={() => setShowReserve(true)}><Plus className="h-3.5 w-3.5" />Reserve Item</Button> : undefined} />
      ) : (
        <div className="space-y-2">
          {reservations.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{r.wardrobeItem?.name || items.find((i) => i.id === r.wardrobeItemId)?.name || "Unknown"}</p>
                <p className="text-xs text-text-tertiary">{r.startDate} → {r.endDate}</p>
              </div>
              <Badge variant="custom" className="bg-blue-50 text-blue-700">Confirmed</Badge>
              {canEdit && (
                <button onClick={() => handleCancel(r.id)} className="rounded p-1 text-text-tertiary hover:text-red-600 transition-colors"><X className="h-4 w-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {showReserve && (
        <Modal open={true} onClose={() => setShowReserve(false)} title="Reserve Wardrobe Item" size="sm">
          <form onSubmit={handleReserve} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Item</label>
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} required className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select an item...</option>
                {items.filter((i) => i.status === "Available").map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowReserve(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Reserve</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Job Classes Tab ───────────────────────────────────────────────────────────

function JobClassesTab({ canEdit, allItems }: { canEdit: boolean; allItems: WardrobeItem[] }) {
  const { toast } = useToast();
  const { data: rawClasses, isLoading, mutate } = useSWR<JobClass[]>("/api/job-classes", fetcher);
  const classes = Array.isArray(rawClasses) ? rawClasses : [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDepartment, setNewDepartment] = useState("Other");
  const [newStandards, setNewStandards] = useState("");
  const [newRestrictions, setNewRestrictions] = useState("");
  const [newReferenceUrl, setNewReferenceUrl] = useState("");
  const newImageFileRef = useRef<File | null>(null);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const [scraping, setScraping] = useState(false);
  const [scraped, setScraped] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleOpenAdd() {
    setNewName(""); setNewDepartment("Other"); setNewStandards(""); setNewRestrictions(""); setNewReferenceUrl("");
    setScraped(false);
    setShowAdd(true);
  }

  async function handlePullFromUrl() {
    const url = newReferenceUrl.trim();
    if (!url) return;
    setScraping(true);
    setScraped(false);
    try {
      const res = await fetch("/api/job-classes/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast("error", data.error || "Could not read that page");
        return;
      }
      if (data.name && !newName.trim()) setNewName(data.name);
      if (data.standards && !newStandards.trim()) setNewStandards(data.standards);
      setScraped(true);
      toast("success", "Info pulled from page");
    } catch {
      toast("error", "Failed to reach that URL");
    } finally {
      setScraping(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) { toast("error", "Role name required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/job-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          department: newDepartment,
          standards: newStandards.trim(),
          restrictions: newRestrictions.trim(),
          referenceUrl: newReferenceUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created: JobClass = await res.json();
      // Upload image if one was selected
      if (newImageFileRef.current) {
        const form = new FormData();
        form.append("file", newImageFileRef.current);
        await fetch(`/api/job-classes/${created.id}/image`, { method: "POST", body: form });
        newImageFileRef.current = null;
      }
      toast("success", "Job class created");
      setShowAdd(false);
      await mutate();
      setSelectedId(created.id);
    } catch { toast("error", "Failed to create"); }
    finally { setSaving(false); }
  }

  if (isLoading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{classes.length} job class{classes.length !== 1 ? "es" : ""}</p>
        {canEdit && <Button size="sm" onClick={handleOpenAdd}><Plus className="h-3.5 w-3.5" />Add Job Class</Button>}
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No job classes yet" description='Create job classes like "Grocery Clerk" to define uniform standards per role.' action={canEdit ? <Button size="sm" onClick={handleOpenAdd}><Plus className="h-3.5 w-3.5" />Add Job Class</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {classes.map((jc) => (
            <button key={jc.id} onClick={() => setSelectedId(jc.id)} className="flex flex-col rounded-xl border border-border bg-surface text-left hover:bg-surface-secondary transition-colors overflow-hidden group">
              {/* Uniform photo */}
              <div className="w-full aspect-[4/3] bg-white flex flex-col items-center justify-center border-b border-border relative overflow-hidden">
                {jc.imageUrl ? (
                  <img src={jc.imageUrl} alt={`${jc.name} uniform`} className="w-full h-full object-contain" />
                ) : (
                  <>
                    <Users className="h-10 w-10 text-text-tertiary/40" />
                    <span className="mt-1.5 text-[10px] text-text-tertiary/50">No photo</span>
                  </>
                )}
              </div>
              {/* Name row */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <p className="text-sm font-semibold text-text-primary truncate">{jc.name}</p>
                <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0 ml-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Create Modal ── */}
      {showAdd && (
        <Modal open={true} onClose={() => { setShowAdd(false); newImageFileRef.current = null; }} size="2xl">
          <form onSubmit={handleCreate} className="space-y-2">

            {/* Header row: role name + dept dropdown + X */}
            <div className="flex items-center gap-2 pb-1.5 border-b border-border">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Role name…"
                autoFocus
                className="flex-1 min-w-0 w-0 text-base font-semibold text-text-primary placeholder:text-text-tertiary bg-transparent focus:outline-none truncate"
              />
              <div ref={deptDropdownRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDeptDropdown((v) => !v)}
                  className={`text-xs font-medium rounded-full px-2.5 py-1 inline-flex items-center gap-1 transition-opacity hover:opacity-80 ${DEPT_COLORS[newDepartment] || DEPT_COLORS.Other}`}
                >
                  {newDepartment}
                  <svg className="h-2.5 w-2.5 opacity-60" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1l4 4 4-4"/></svg>
                </button>
                {showDeptDropdown && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-border bg-surface shadow-lg py-1">
                    {PRODUCT_DEPARTMENTS.map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => { setNewDepartment(dept); setShowDeptDropdown(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-secondary"
                      >
                        <span className={`inline-flex rounded-full px-2 py-0.5 ${DEPT_COLORS[dept] || DEPT_COLORS.Other}`}>{dept}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setShowAdd(false)} className="shrink-0 rounded-lg p-1.5 text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Two-column: text fields left, reference photo right */}
            <div className="flex gap-4 items-start">
              {/* Left column: URL + Description + Standards */}
              <div className="flex-1 space-y-2">

                {/* Dress Code URL */}
                <div>
                  <label className="block mt-px text-sm font-medium text-text-primary mb-1">Dress Code Reference URL</label>
                  <div className="flex gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
                      <LinkIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                      <input
                        type="url"
                        value={newReferenceUrl}
                        onChange={(e) => { setNewReferenceUrl(e.target.value); setScraped(false); }}
                        placeholder="https://www.publix.org/dress-code/…"
                        className="h-8 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                      />
                    </div>
                    <Button
                      type="button"
                      variant={scraped ? "ghost" : "secondary"}
                      size="sm"
                      disabled={!newReferenceUrl.trim() || scraping}
                      loading={scraping}
                      onClick={handlePullFromUrl}
                    >
                      {scraped ? "✓ Pulled" : "Pull info"}
                    </Button>
                  </div>
                </div>

                {/* Role Standards */}
                <div>
                  <label className="block mt-px text-sm font-medium text-text-primary mb-1">Role Description</label>
                  <textarea
                    value={newStandards}
                    onChange={(e) => setNewStandards(e.target.value)}
                    placeholder="Job duties, uniform requirements, presentation expectations…"
                    className="w-full h-16 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-y-auto"
                  />
                </div>

                {/* Restrictions */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Restrictions</label>
                  <textarea
                    value={newRestrictions}
                    onChange={(e) => setNewRestrictions(e.target.value)}
                    placeholder="Items that must not be worn, brand restrictions, safety requirements…"
                    className="w-full h-16 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-y-auto"
                  />
                  <p className="mt-1 text-xs text-text-tertiary">Wardrobe items and shoot notes can be added after creating.</p>
                </div>
              </div>

              {/* Right column: Reference Photo */}
              <div className="shrink-0">
                <label className="block mt-px text-sm font-medium text-text-primary mb-1">Reference Photo</label>
                <ImageUpload
                  value={null}
                  onFileSelected={(f) => { newImageFileRef.current = f; }}
                  onRemove={() => { newImageFileRef.current = null; }}
                />
              </div>
            </div>

            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Create Role</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {selectedId && (
        <JobClassModal
          jobClassId={selectedId}
          onClose={() => { setSelectedId(null); mutate(); }}
          canEdit={canEdit}
          allItems={allItems}
        />
      )}
    </div>
  );
}

// ── Job Class Modal (centered editor) ────────────────────────────────────────

function JobClassModal({ jobClassId, onClose, canEdit, allItems }: {
  jobClassId: string;
  onClose: () => void;
  canEdit: boolean;
  allItems: WardrobeItem[];
}) {
  const { toast } = useToast();
  const { data: jc, mutate } = useSWR<JobClass>(`/api/job-classes/${jobClassId}`, fetcher);
  const { data: rawNotes, mutate: mutateNotes } = useSWR<JobClassNote[]>(`/api/job-classes/${jobClassId}/notes`, fetcher);
  const notes = Array.isArray(rawNotes) ? rawNotes : [];
  const items: JobClassItem[] = jc?.items || [];

  const [editingStandards, setEditingStandards] = useState(false);
  const [standards, setStandards] = useState(jc?.standards || "");
  const [savingStandards, setSavingStandards] = useState(false);
  const [editingRestrictions, setEditingRestrictions] = useState(false);
  const [restrictions, setRestrictions] = useState(jc?.restrictions || "");
  const [savingRestrictions, setSavingRestrictions] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(jc?.name || "");
  const [referenceUrl, setReferenceUrl] = useState(jc?.referenceUrl || "");
  const [genderFilter, setGenderFilter] = useState<JobClassItemGender>("All");
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Sync state when data loads
  if (jc && standards === "" && jc.standards) setStandards(jc.standards);
  if (jc && restrictions === "" && jc.restrictions) setRestrictions(jc.restrictions);
  if (jc && name === "" && jc.name) setName(jc.name);
  if (jc && referenceUrl === "" && jc.referenceUrl) setReferenceUrl(jc.referenceUrl);

  const linkedIds = new Set(items.map((i) => i.wardrobeItemId));
  const availableToAdd = allItems.filter((i) => !linkedIds.has(i.id));

  async function handleSaveStandards() {
    setSavingStandards(true);
    try {
      await fetch(`/api/job-classes/${jobClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standards }),
      });
      toast("success", "Standards saved");
      setEditingStandards(false);
      mutate();
    } catch { toast("error", "Failed to save"); }
    finally { setSavingStandards(false); }
  }

  async function handleSaveRestrictions() {
    setSavingRestrictions(true);
    try {
      await fetch(`/api/job-classes/${jobClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restrictions }),
      });
      toast("success", "Restrictions saved");
      setEditingRestrictions(false);
      mutate();
    } catch { toast("error", "Failed to save"); }
    finally { setSavingRestrictions(false); }
  }

  async function handleSaveName() {
    if (!name.trim()) return;
    try {
      await fetch(`/api/job-classes/${jobClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), referenceUrl: referenceUrl.trim() || null }),
      });
      toast("success", "Saved");
      setEditingName(false);
      mutate();
    } catch { toast("error", "Failed to save"); }
  }

  async function handleAddItem() {
    if (!selectedItemId) return;
    setAddingItem(true);
    try {
      const res = await fetch(`/api/job-classes/${jobClassId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wardrobeItemId: selectedItemId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast("success", "Item added");
      setSelectedItemId(""); setShowAddItem(false);
      mutate();
    } catch (err) { toast("error", err instanceof Error ? err.message : "Failed"); }
    finally { setAddingItem(false); }
  }

  async function handleRemoveItem(jobClassItemId: string) {
    try {
      await fetch(`/api/job-classes/${jobClassId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", jobClassItemId }),
      });
      toast("success", "Item removed");
      mutate();
    } catch { toast("error", "Failed to remove"); }
  }

  async function handleUpdateItemNotes(jobClassItemId: string, itemNotes: string) {
    await handleUpdateItem(jobClassItemId, { notes: itemNotes });
  }

  async function handleUpdateItem(jobClassItemId: string, updates: { notes?: string; gender?: JobClassItemGender; required?: boolean }) {
    try {
      await fetch(`/api/job-classes/${jobClassId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_item", jobClassItemId, ...updates }),
      });
      mutate();
    } catch { toast("error", "Failed to save"); }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/job-classes/${jobClassId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newNote.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewNote("");
      mutateNotes();
    } catch { toast("error", "Failed to add note"); }
    finally { setSavingNote(false); }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await fetch(`/api/job-classes/${jobClassId}/notes/${noteId}`, { method: "DELETE" });
      mutateNotes();
    } catch { toast("error", "Failed to delete note"); }
  }

  async function handleDeleteClass() {
    try {
      await fetch(`/api/job-classes/${jobClassId}`, { method: "DELETE" });
      toast("success", "Job class deleted");
      onClose();
    } catch { toast("error", "Failed to delete"); }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/job-classes/${jobClassId}/image`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      mutate();
      toast("success", "Photo updated");
    } catch { toast("error", "Failed to upload photo"); }
    finally { setPhotoUploading(false); }
  }

  async function handleRemovePhoto(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/job-classes/${jobClassId}/image`, { method: "DELETE" });
      mutate();
      toast("success", "Photo removed");
    } catch { toast("error", "Failed to remove photo"); }
  }

  if (!jc) return (
    <Modal open={true} onClose={onClose} size="3xl">
      <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
    </Modal>
  );

  return (
    <Modal open={true} onClose={onClose} size="2xl">
      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />

      {/* Title row */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-xl font-bold text-text-primary tracking-tight truncate">{jc.name}</h2>
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && !editingName && (
            <button onClick={() => setEditingName(true)}
               className="rounded-lg p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onClose} className="rounded-lg p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4">

        {/* Name / reference url — editing form only */}
        {editingName && (
          <div className="space-y-3">
            <Input label="Role Name" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Dress Code Reference URL</label>
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                <input
                  type="url"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="https://www.publix.org/dress-code/..."
                  className="h-9 flex-1 rounded-lg border border-border bg-surface pl-3 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveName}>Save</Button>
            </div>
          </div>
        )}

        {/* ── Uniform Items ── */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center px-3.5 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Shirt className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">UNIFORM ITEMS</h3>
            </div>
          </div>

          {(items.length > 0 || jc.referenceUrl) && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border bg-surface-secondary/60">
              <div className="flex items-center gap-1.5">
                {(["All", "Men's", "Women's"] as JobClassItemGender[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      genderFilter === g
                        ? g === "Men's"
                          ? "bg-sky-100 text-sky-700"
                          : g === "Women's"
                          ? "bg-fuchsia-100 text-fuchsia-700"
                          : "bg-primary text-white"
                        : "text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {jc.referenceUrl && (
                <a href={jc.referenceUrl} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0">
                  <LinkIcon className="h-3 w-3" />Dress Code
                </a>
              )}
            </div>
          )}
          <div className="flex min-h-[200px]">
            {/* Items list */}
            <div className="flex-1 min-w-0">

              {items.length === 0 ? (
                <div className="p-6 text-center">
                  <Shirt className="h-6 w-6 text-text-tertiary/30 mx-auto mb-2" />
                  <p className="text-sm text-text-tertiary">No items linked yet.</p>
                </div>
              ) : (() => {
                const filtered = items.filter((ji) =>
                  ji.gender === "All" || ji.gender === genderFilter
                );
                if (filtered.length === 0) {
                  return (
                    <div className="p-6 text-center">
                      <p className="text-sm text-text-tertiary">No items for {genderFilter} view.</p>
                    </div>
                  );
                }
                type RowGroup = { type: "single"; item: JobClassItem } | { type: "or-group"; key: string; items: JobClassItem[] };
                const rows: RowGroup[] = [];
                const seen = new Set<string>();
                for (const ji of filtered) {
                  if (!ji.optionGroup) {
                    rows.push({ type: "single", item: ji });
                  } else if (!seen.has(ji.optionGroup)) {
                    seen.add(ji.optionGroup);
                    rows.push({ type: "or-group", key: ji.optionGroup, items: filtered.filter((x) => x.optionGroup === ji.optionGroup) });
                  }
                }
                return (
                  <div className="p-4 space-y-2.5">
                    {rows.map((row) => {
                      if (row.type === "single") {
                        return (
                          <div key={row.item.id} className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
                            <JobClassItemRow ji={row.item} canEdit={canEdit} onRemove={() => handleRemoveItem(row.item.id)} onSaveNotes={(n) => handleUpdateItemNotes(row.item.id, n)} onSaveItem={(u) => handleUpdateItem(row.item.id, u)} />
                          </div>
                        );
                      }
                      return (
                        <div key={row.key} className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary px-4 pt-3 pb-1">Pick one</p>
                          {row.items.map((ji, i) => (
                            <div key={ji.id}>
                              <JobClassItemRow ji={ji} canEdit={canEdit} onRemove={() => handleRemoveItem(ji.id)} onSaveNotes={(n) => handleUpdateItemNotes(ji.id, n)} onSaveItem={(u) => handleUpdateItem(ji.id, u)} compact />
                              {i < row.items.length - 1 && (
                                <div className="flex items-center gap-2 my-1 pl-12">
                                  <div className="flex-1 h-px bg-border-light" />
                                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">or</span>
                                  <div className="flex-1 h-px bg-border-light" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {showAddItem && availableToAdd.length > 0 && (
                <div className="flex gap-2 px-4 pb-4 pt-1">
                  <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Select an item...</option>
                    {availableToAdd.map((i) => <option key={i.id} value={i.id}>{i.name} — {i.category}</option>)}
                  </select>
                  <Button size="sm" onClick={handleAddItem} loading={addingItem}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
                </div>
              )}
              {showAddItem && availableToAdd.length === 0 && (
                <p className="px-4 pb-4 text-sm text-text-tertiary text-center">All wardrobe items are already linked.</p>
              )}
              {canEdit && !showAddItem && (
                <button onClick={() => setShowAddItem(true)} className="flex items-center gap-1.5 px-4 pb-4 pt-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                  <Plus className="h-3.5 w-3.5" />Add Item
                </button>
              )}
            </div>

            {/* Photo column */}
            <div className="w-[220px] shrink-0 flex flex-col items-center justify-start p-4 bg-surface-secondary/40">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-3 self-start">Reference Photo</p>
              <button
                type="button"
                onClick={() => canEdit && photoInputRef.current?.click()}
                className={`relative group w-full aspect-[3/4] rounded-xl overflow-hidden ${canEdit ? "cursor-pointer" : "cursor-default"}`}
              >
                {jc.imageUrl ? (
                  <>
                    <img src={jc.imageUrl} alt="Uniform photo" className="w-full h-full object-contain bg-white rounded-xl" />
                    {canEdit && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 rounded-xl">
                        <span className="text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-lg">Replace Photo</span>
                        <button type="button" onClick={handleRemovePhoto} className="text-white/70 text-[10px] font-medium hover:text-white transition-colors">Remove</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-white">
                    {canEdit ? (
                      <>
                        <Camera className="h-6 w-6 text-text-tertiary/40" />
                        <span className="text-[10px] font-medium text-text-tertiary text-center leading-relaxed">Add reference<br/>photo</span>
                      </>
                    ) : (
                      <>
                        <Users className="h-6 w-6 text-text-tertiary/30" />
                        <span className="text-[10px] text-text-tertiary/50">No photo</span>
                      </>
                    )}
                  </div>
                )}
                {photoUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                    <span className="text-[10px] text-text-secondary">Uploading…</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Standards ── */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">ROLE STANDARDS</h3>
            </div>
            {canEdit && !editingStandards && (
              <button onClick={() => setEditingStandards(true)} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <div className="px-4 py-3.5">
            {editingStandards ? (
              <div className="space-y-3">
                <textarea value={standards} onChange={(e) => setStandards(e.target.value)} rows={4} placeholder="General uniform standards for this role — what's required, presentation expectations, approved variations..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingStandards(false); setStandards(jc.standards); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveStandards} loading={savingStandards}>Save</Button>
                </div>
              </div>
            ) : jc.standards ? (
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{jc.standards}</p>
            ) : (
              <p className="text-sm text-text-tertiary/70 italic">No standards defined yet.{canEdit ? " Click the edit icon to add." : ""}</p>
            )}
          </div>
        </div>

        {/* ── Restrictions ── */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">RESTRICTIONS</h3>
            </div>
            {canEdit && !editingRestrictions && (
              <button onClick={() => setEditingRestrictions(true)} className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <div className="px-4 py-3.5">
            {editingRestrictions ? (
              <div className="space-y-3">
                <textarea value={restrictions} onChange={(e) => setRestrictions(e.target.value)} rows={3} placeholder="Items that must not be worn, brand restrictions, safety requirements…" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingRestrictions(false); setRestrictions(jc.restrictions); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveRestrictions} loading={savingRestrictions}>Save</Button>
                </div>
              </div>
            ) : jc.restrictions ? (
              <p className="text-sm text-amber-700 font-medium whitespace-pre-wrap leading-relaxed">{jc.restrictions}</p>
            ) : (
              <p className="text-sm text-text-tertiary/70 italic">No restrictions defined.{canEdit ? " Click edit to add." : ""}</p>
            )}
          </div>
        </div>

        {/* ── Shoot Notes ── */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
            <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">SHOOT NOTES</h3>
          </div>
          <div className="divide-y divide-border-light">
            {notes.map((note) => (
              <div key={note.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary leading-relaxed">{note.text}</p>
                  <p className="text-[10px] text-text-tertiary mt-1.5 font-medium">
                    {note.authorName} · {formatDistanceToNow(parseISO(note.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => handleDeleteNote(note.id)} className="shrink-0 rounded-lg p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"><X className="h-3.5 w-3.5" /></button>
                )}
              </div>
            ))}
            {notes.length === 0 && (
              <p className="px-4 py-4 text-sm text-text-tertiary/70 italic">No notes yet. Add observations from recent shoots.</p>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2 px-4 py-3.5 border-t border-border bg-surface-secondary/40">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                placeholder="Add a shoot note..."
                className="h-9 flex-1 rounded-lg border border-border bg-surface pl-3 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <Button size="sm" onClick={handleAddNote} loading={savingNote}>Add</Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-1 border-t border-border flex items-center justify-between">
          {canEdit ? (
            <button onClick={handleDeleteClass} title="Delete job class" className="rounded-lg p-1.5 text-text-tertiary hover:text-red-500 hover:bg-surface-secondary transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          ) : <span />}
          <Button size="sm" variant="secondary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Job Class Item Row ────────────────────────────────────────────────────────

function JobClassItemRow({ ji, canEdit, onRemove, onSaveNotes, onSaveItem, compact = false }: {
  ji: JobClassItem;
  canEdit: boolean;
  onRemove: () => void;
  onSaveNotes: (notes: string) => void;
  onSaveItem?: (updates: { notes?: string; gender?: JobClassItemGender; required?: boolean }) => void;
  compact?: boolean;
}) {
  const item = ji.wardrobeItem;
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(ji.notes);
  const [gender, setGender] = useState<JobClassItemGender>(ji.gender);
  const [required, setRequired] = useState(ji.required);

  function handleSave() {
    if (onSaveItem) {
      onSaveItem({ notes, gender, required });
    } else {
      onSaveNotes(notes);
    }
    setEditing(false);
  }

  function handleCancel() {
    setNotes(ji.notes);
    setGender(ji.gender);
    setRequired(ji.required);
    setEditing(false);
  }

  return (
    <div className={`${compact ? "px-3 py-2" : "px-4 py-3.5"} space-y-2`}>
      <div className="flex items-center gap-3">
        {item?.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="h-12 w-12 rounded-lg object-cover shrink-0 bg-surface-secondary" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-secondary shrink-0">
            <Shirt className="h-5 w-5 text-text-tertiary/50" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary truncate">{item?.name || "Unknown item"}</p>
            {!ji.required && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">optional</span>}
          </div>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {item && <Badge variant="custom" className={`text-[10px] ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other}`}>{item.category}</Badge>}
            {ji.gender !== "All" && (
              <Badge variant="custom" className={`text-[10px] ${GENDER_COLORS[ji.gender] || ""}`}>{ji.gender}</Badge>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
            <button onClick={onRemove} className="rounded-lg p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>


      {/* Edit panel */}
      {editing && (
        <div className="space-y-2.5 rounded-lg border border-border bg-surface-secondary p-3">
          {/* Notes */}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Role-specific notes for this item…"
            className="h-8 w-full rounded-lg border border-border bg-surface pl-3 pr-3 text-xs text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            autoFocus
          />
          {/* Gender + Required row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              {(["All", "Men's", "Women's"] as JobClassItemGender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    gender === g
                      ? g === "Men's" ? "bg-sky-100 text-sky-700" : g === "Women's" ? "bg-fuchsia-100 text-fuchsia-700" : "bg-slate-200 text-slate-700"
                      : "text-text-tertiary hover:bg-surface-tertiary"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRequired((r) => !r)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${required ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
            >
              {required ? "Required" : "Optional"}
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Backstock Tab ─────────────────────────────────────────────────────────────

function BackstockTab({ items, canEdit }: { items: WardrobeItem[]; canEdit: boolean }) {
  const { toast } = useToast();
  const { data: rawUnits, isLoading, mutate } = useSWR<WardrobeUnit[]>("/api/wardrobe/units", fetcher);
  const units = Array.isArray(rawUnits) ? rawUnits : [];
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [addUnitFor, setAddUnitFor] = useState<WardrobeItem | null>(null);
  const [editUnit, setEditUnit] = useState<WardrobeUnit | null>(null);

  // Group units by wardrobe_item_id
  const unitsByItem = new Map<string, WardrobeUnit[]>();
  for (const unit of units) {
    const list = unitsByItem.get(unit.wardrobeItemId) ?? [];
    list.push(unit);
    unitsByItem.set(unit.wardrobeItemId, list);
  }

  function toggleExpand(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDeleteUnit(unit: WardrobeUnit) {
    try {
      await fetch(`/api/wardrobe/units/${unit.id}`, { method: "DELETE" });
      toast("success", "Unit removed");
      mutate();
    } catch { toast("error", "Failed to remove unit"); }
  }

  // Items that have units + items that don't (show all item types)
  const itemsWithUnits = items.filter((i) => unitsByItem.has(i.id));
  const itemsWithoutUnits = items.filter((i) => !unitsByItem.has(i.id));
  const allItemsSorted = [...itemsWithUnits, ...itemsWithoutUnits];

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{units.length} unit{units.length !== 1 ? "s" : ""} across {itemsWithUnits.length} item type{itemsWithUnits.length !== 1 ? "s" : ""}</p>
        {canEdit && items.length > 0 && (
          <Button size="sm" onClick={() => setAddUnitFor(items[0])}>
            <Plus className="h-3.5 w-3.5" />Add Units
          </Button>
        )}
      </div>

      {allItemsSorted.length === 0 ? (
        <EmptyState icon={<Archive className="h-5 w-5" />} title="No uniform items yet" description="Add uniform item types in the Uniform Items tab first, then add physical units here." />
      ) : (
        <div className="space-y-2">
          {allItemsSorted.map((item) => {
            const itemUnits = unitsByItem.get(item.id) ?? [];
            const available = itemUnits.filter((u) => u.status === "Available").length;
            const isExpanded = expandedItems.has(item.id);

            return (
              <div key={item.id} className="rounded-xl border border-border bg-surface overflow-hidden">
                {/* Section header */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-surface-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-8 w-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
                        <Shirt className="h-3.5 w-3.5 text-text-tertiary" />
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-semibold text-text-primary">{item.name}</p>
                      <p className="text-[10px] text-text-tertiary">
                        {itemUnits.length === 0 ? "No units yet" : `${itemUnits.length} unit${itemUnits.length !== 1 ? "s" : ""} — ${available} available`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="custom" className={CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other}>{item.category}</Badge>
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddUnitFor(item); }}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />Add
                      </button>
                    )}
                    <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Units list */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {itemUnits.length === 0 ? (
                      <div className="px-4 py-4 text-center">
                        <p className="text-sm text-text-tertiary">No physical units logged yet.</p>
                        {canEdit && (
                          <button onClick={() => setAddUnitFor(item)} className="mt-1 text-xs text-primary hover:underline">
                            Add first unit
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-border-light">
                        {/* Column headers */}
                        <div className="hidden sm:grid grid-cols-[80px_100px_120px_120px_1fr_80px] px-4 py-2 bg-surface-secondary text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                          <div>Size</div><div>Gender</div><div>Status</div><div>Condition</div><div>Notes</div><div></div>
                        </div>
                        {itemUnits.map((unit) => (
                          <div key={unit.id} className="grid grid-cols-1 sm:grid-cols-[80px_100px_120px_120px_1fr_80px] items-center px-4 py-2.5 gap-2">
                            <span className="text-sm font-medium text-text-primary">{unit.size}</span>
                            <Badge variant="custom" className={`text-[10px] w-fit ${GENDER_COLORS[unit.gender] || ""}`}>{unit.gender}</Badge>
                            <Badge variant="custom" className={`text-[10px] w-fit ${STATUS_COLORS[unit.status] || ""}`}>{unit.status}</Badge>
                            <span className="text-xs text-text-secondary">{unit.condition}</span>
                            <span className="text-xs text-text-tertiary truncate">{unit.qrCode ? `QR: ${unit.qrCode}` : unit.notes || "—"}</span>
                            {canEdit && (
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => setEditUnit(unit)} className="rounded p-1 text-text-tertiary hover:text-text-secondary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleDeleteUnit(unit)} className="rounded p-1 text-text-tertiary hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addUnitFor && (
        <AddUnitModal
          item={addUnitFor}
          allItems={items}
          onClose={() => setAddUnitFor(null)}
          onSaved={() => { setAddUnitFor(null); mutate(); }}
        />
      )}
      {editUnit && (
        <EditUnitModal
          unit={editUnit}
          onClose={() => setEditUnit(null)}
          onSaved={() => { setEditUnit(null); mutate(); }}
        />
      )}
    </div>
  );
}

// ── Add Unit Modal ────────────────────────────────────────────────────────────

function AddUnitModal({ item, allItems, onClose, onSaved }: {
  item: WardrobeItem;
  allItems: WardrobeItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [itemId, setItemId] = useState(item.id);
  const [size, setSize] = useState<UnitSize>("One Size");
  const [gender, setGender] = useState<UnitGender>("Unisex");
  const [condition, setCondition] = useState("Good");
  const [qrCode, setQrCode] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/wardrobe/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wardrobeItemId: itemId,
          size, gender, condition,
          qrCode: qrCode.trim() || null,
          notes: notes.trim(),
          quantity,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast("success", `${quantity} unit${quantity !== 1 ? "s" : ""} added`);
      onSaved();
    } catch (err) { toast("error", err instanceof Error ? err.message : "Failed to add unit"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={true} onClose={onClose} title="Add Backstock Units" size="md">
      <form onSubmit={handleSave} className="space-y-4">
        {/* Item type selector */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Uniform Item Type</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
            {allItems.map((i) => <option key={i.id} value={i.id}>{i.name} — {i.category}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value as UnitSize)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              {UNIT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Gender Cut</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as UnitGender)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              {UNIT_GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Condition */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Condition</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Quantity</label>
            <input
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {quantity === 1 && (
          <Input label="QR Code (optional)" placeholder="Unique code for this unit" value={qrCode} onChange={(e) => setQrCode(e.target.value)} />
        )}

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any unit-specific notes..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>

        {quantity > 1 && (
          <p className="text-[11px] text-text-tertiary">Adding {quantity} identical units — QR codes can be assigned individually after creation.</p>
        )}

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Add {quantity > 1 ? `${quantity} Units` : "Unit"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ── Edit Unit Modal ───────────────────────────────────────────────────────────

function EditUnitModal({ unit, onClose, onSaved }: {
  unit: WardrobeUnit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [size, setSize] = useState<UnitSize>(unit.size);
  const [gender, setGender] = useState<UnitGender>(unit.gender);
  const [condition, setCondition] = useState(unit.condition);
  const [status, setStatus] = useState(unit.status);
  const [qrCode, setQrCode] = useState(unit.qrCode ?? "");
  const [notes, setNotes] = useState(unit.notes);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/wardrobe/units/${unit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size, gender, condition, status, qrCode: qrCode.trim() || null, notes }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast("success", "Unit updated");
      onSaved();
    } catch (err) { toast("error", err instanceof Error ? err.message : "Failed to update unit"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Edit Unit — ${unit.wardrobeItem?.name ?? "Unit"}`} size="md">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value as UnitSize)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              {UNIT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Gender Cut</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as UnitGender)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              {UNIT_GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Condition</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value as WardrobeCondition)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as WardrobeUnit["status"])} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              <option>Available</option>
              <option>Reserved</option>
              <option>Checked Out</option>
            </select>
          </div>
        </div>
        <Input label="QR Code (optional)" placeholder="Unique code for scanning" value={qrCode} onChange={(e) => setQrCode(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

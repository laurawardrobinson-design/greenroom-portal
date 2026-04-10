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
  JobClass,
  JobClassItem,
  JobClassNote,
} from "@/types/domain";
import { WARDROBE_CATEGORIES } from "@/lib/validation/wardrobe.schema";
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

type Tab = "items" | "reservations" | "job-classes";
const NEW_ITEM = "NEW" as const;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WardrobePage() {
  const { user } = useCurrentUser();
  const { mutate: globalMutate } = useSWRConfig();
  const [tab, setTab] = useState<Tab>("items");
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
          <p className="text-sm text-text-secondary">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        {tab === "items" && (
          <Button variant="secondary" onClick={() => { setShowScanner(true); setScannerActive(true); }}>
            <ScanLine className="h-4 w-4" />
            Scan Items
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["items", "reservations", "job-classes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            {t === "items" ? "Items" : t === "reservations" ? "Reservations" : "Job Classes"}
          </button>
        ))}
      </div>

      {/* ── Items Tab ── */}
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
                      <Badge variant="custom" className={`mt-1 ml-1 ${STATUS_COLORS[item.status] || ""}`}>{item.status}</Badge>
                    </div>
                  </div>
                  {item.shootingNotes && <p className="mt-2 text-xs text-text-secondary line-clamp-2">{item.shootingNotes}</p>}
                  {item.restrictions && <p className="mt-1 text-xs text-orange-700 font-medium">{item.restrictions}</p>}
                  {canEdit && (item.status === "Available" || item.status === "Checked Out") && (
                    <div className="mt-2 pt-2 border-t border-border-light w-full">
                      <button
                        onClick={(e) => { e.stopPropagation(); item.status === "Available" ? setCheckoutItem(item) : setCheckinItem(item); }}
                        className="text-xs text-primary hover:underline"
                      >
                        {item.status === "Available" ? "Check Out" : "Check In"}
                      </button>
                    </div>
                  )}
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

      {/* ── Reservations Tab ── */}
      {tab === "reservations" && (
        <ReservationsTab items={items} canEdit={canEdit} onMutate={mutate} />
      )}

      {/* ── Job Classes Tab ── */}
      {tab === "job-classes" && (
        <JobClassesTab canEdit={canEdit} allItems={items} />
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
          <Input label="QR Code (optional)" placeholder="Unique code for scanning" value={qrCode} onChange={(e) => setQrCode(e.target.value)} />
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
                <Badge variant="custom" className={STATUS_COLORS[item!.status] || ""}>{item!.status}</Badge>
                <Badge variant="custom" className="bg-surface-secondary text-text-secondary">{item!.condition}</Badge>
              </div>
              {item?.description && <p className="text-sm text-text-secondary">{item.description}</p>}
              {item?.qrCode && <p className="text-[10px] text-text-tertiary font-mono">QR: {item.qrCode}</p>}
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
  const [selectedClass, setSelectedClass] = useState<JobClass | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStandards, setNewStandards] = useState("");
  const [newReferenceUrl, setNewReferenceUrl] = useState("");
  const [saving, setSaving] = useState(false);

  function handleOpenAdd() {
    setNewName(""); setNewDescription(""); setNewStandards(""); setNewReferenceUrl("");
    setShowAdd(true);
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
          description: newDescription.trim(),
          standards: newStandards.trim(),
          referenceUrl: newReferenceUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const created: JobClass = await res.json();
      toast("success", "Job class created");
      setShowAdd(false);
      await mutate();
      // Open the new class drawer immediately
      setSelectedClass(created);
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((jc) => (
            <button key={jc.id} onClick={() => setSelectedClass(jc)} className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4 text-left hover:bg-surface-secondary transition-colors">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm font-semibold text-text-primary truncate">{jc.name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
              </div>
              {jc.description && <p className="text-xs text-text-secondary line-clamp-2">{jc.description}</p>}
              {jc.referenceUrl && (
                <span className="flex items-center gap-1 text-[10px] text-primary/70 truncate max-w-full">
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">Dress code linked</span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Comprehensive Create Modal ── */}
      {showAdd && (
        <Modal open={true} onClose={() => setShowAdd(false)} title="New Job Class" size="lg">
          <form onSubmit={handleCreate} className="space-y-5">
            {/* Role Name */}
            <Input
              label="Role Name"
              placeholder="e.g., Grocery Clerk, Bakery Associate, Deli Team Member"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description of this role and when these standards apply..."
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Dress Code Reference URL */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Dress Code Reference URL
              </label>
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                <input
                  type="url"
                  value={newReferenceUrl}
                  onChange={(e) => setNewReferenceUrl(e.target.value)}
                  placeholder="https://www.publix.org/dress-code/..."
                  className="h-9 flex-1 rounded-lg border border-border bg-surface pl-3 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-text-tertiary">Link to the official Publix dress code page for this role</p>
            </div>

            {/* Role Standards */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Role Standards</label>
              <textarea
                value={newStandards}
                onChange={(e) => setNewStandards(e.target.value)}
                placeholder="Uniform requirements, presentation expectations, approved variations, items that must be worn together..."
                rows={5}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <p className="mt-1 text-[11px] text-text-tertiary">You can add wardrobe items and shoot notes after creating the role.</p>
            </div>

            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>Create Role</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {selectedClass && (
        <JobClassDrawer
          jobClassId={selectedClass.id}
          onClose={() => { setSelectedClass(null); mutate(); }}
          canEdit={canEdit}
          allItems={allItems}
        />
      )}
    </div>
  );
}

// ── Job Class Drawer ──────────────────────────────────────────────────────────

function JobClassDrawer({ jobClassId, onClose, canEdit, allItems }: {
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
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(jc?.name || "");
  const [description, setDescription] = useState(jc?.description || "");
  const [referenceUrl, setReferenceUrl] = useState(jc?.referenceUrl || "");

  // Sync state when data loads
  if (jc && standards === "" && jc.standards) setStandards(jc.standards);
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

  async function handleSaveName() {
    if (!name.trim()) return;
    try {
      await fetch(`/api/job-classes/${jobClassId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, referenceUrl: referenceUrl.trim() || null }),
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
    try {
      await fetch(`/api/job-classes/${jobClassId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_notes", jobClassItemId, notes: itemNotes }),
      });
      mutate();
    } catch { toast("error", "Failed to save notes"); }
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

  if (!jc) return <Drawer open={true} onClose={onClose} title="Loading..." size="lg"><div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div></Drawer>;

  return (
    <Drawer open={true} onClose={onClose} title={jc.name} size="lg">
      <div className="space-y-6">

        {/* Name / description / reference url */}
        {editingName ? (
          <div className="space-y-3">
            <Input label="Role Name" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
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
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 min-w-0">
              {jc.description && <p className="text-sm text-text-secondary">{jc.description}</p>}
              {jc.referenceUrl && (
                <a
                  href={jc.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Publix Dress Code Reference</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
            </div>
            {canEdit && <button onClick={() => setEditingName(true)} className="shrink-0 text-xs text-text-tertiary hover:text-text-secondary transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>}
          </div>
        )}

        {/* ── Uniform Items ── */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Shirt className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">UNIFORM ITEMS</h3>
            </div>
            {canEdit && (
              <button onClick={() => setShowAddItem(true)} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                <Plus className="h-3.5 w-3.5" />Add item
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-text-tertiary">No items linked yet.</p>
              {canEdit && <button onClick={() => setShowAddItem(true)} className="mt-1 text-xs text-primary hover:underline">Add an item</button>}
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {items.map((ji) => (
                <JobClassItemRow key={ji.id} ji={ji} canEdit={canEdit} onRemove={() => handleRemoveItem(ji.id)} onSaveNotes={(n) => handleUpdateItemNotes(ji.id, n)} />
              ))}
            </div>
          )}

          {showAddItem && availableToAdd.length > 0 && (
            <div className="flex gap-2 p-3.5 border-t border-border">
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Select an item...</option>
                {availableToAdd.map((i) => <option key={i.id} value={i.id}>{i.name} — {i.category}</option>)}
              </select>
              <Button size="sm" onClick={handleAddItem} loading={addingItem}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
            </div>
          )}
          {showAddItem && availableToAdd.length === 0 && (
            <p className="p-4 text-sm text-text-tertiary text-center">All wardrobe items are already linked.</p>
          )}
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
          <div className="p-4">
            {editingStandards ? (
              <div className="space-y-3">
                <textarea value={standards} onChange={(e) => setStandards(e.target.value)} rows={4} placeholder="General uniform standards for this role — what's required, presentation expectations, approved variations..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingStandards(false); setStandards(jc.standards); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveStandards} loading={savingStandards}>Save</Button>
                </div>
              </div>
            ) : jc.standards ? (
              <p className="text-sm text-text-primary whitespace-pre-wrap">{jc.standards}</p>
            ) : (
              <p className="text-sm text-text-tertiary italic">No standards defined yet.{canEdit ? " Click edit to add." : ""}</p>
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
              <div key={note.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{note.text}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">
                    {note.authorName} · {formatDistanceToNow(parseISO(note.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => handleDeleteNote(note.id)} className="shrink-0 rounded p-1 text-text-tertiary hover:text-red-600 transition-colors"><X className="h-3.5 w-3.5" /></button>
                )}
              </div>
            ))}
            {notes.length === 0 && (
              <p className="px-4 py-3 text-sm text-text-tertiary">No notes yet. Add observations from recent shoots.</p>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2 p-3.5 border-t border-border">
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

        {/* Delete */}
        {canEdit && (
          <div className="pt-2 border-t border-border">
            <Button variant="danger" onClick={handleDeleteClass} className="w-full">
              <Trash2 className="h-3.5 w-3.5" />Delete Job Class
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ── Job Class Item Row ────────────────────────────────────────────────────────

function JobClassItemRow({ ji, canEdit, onRemove, onSaveNotes }: {
  ji: JobClassItem;
  canEdit: boolean;
  onRemove: () => void;
  onSaveNotes: (notes: string) => void;
}) {
  const item = ji.wardrobeItem;
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(ji.notes);

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start gap-3">
        {item?.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
            <Shirt className="h-4 w-4 text-text-tertiary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text-primary truncate">{item?.name || "Unknown item"}</p>
            {item && <Badge variant="custom" className={`text-[10px] ${STATUS_COLORS[item.status] || ""}`}>{item.status}</Badge>}
          </div>
          {item && <Badge variant="custom" className={`text-[10px] mt-0.5 ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other}`}>{item.category}</Badge>}
        </div>
        {canEdit && (
          <button onClick={onRemove} className="shrink-0 rounded p-1 text-text-tertiary hover:text-red-600 transition-colors"><X className="h-3.5 w-3.5" /></button>
        )}
      </div>

      {/* Per-item role notes */}
      {editingNotes ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Role-specific notes for this item..."
            className="h-8 flex-1 rounded-lg border border-border bg-surface pl-3 pr-3 text-xs text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            onKeyDown={(e) => { if (e.key === "Enter") { onSaveNotes(notes); setEditingNotes(false); } if (e.key === "Escape") { setNotes(ji.notes); setEditingNotes(false); } }}
            autoFocus
          />
          <Button size="sm" onClick={() => { onSaveNotes(notes); setEditingNotes(false); }}>Save</Button>
        </div>
      ) : (
        <button
          onClick={() => canEdit && setEditingNotes(true)}
          className={`w-full text-left text-xs rounded px-2 py-1.5 transition-colors ${notes ? "text-text-secondary bg-surface-secondary hover:bg-surface-tertiary" : "text-text-tertiary italic hover:bg-surface-secondary"} ${!canEdit ? "pointer-events-none" : ""}`}
        >
          {notes || (canEdit ? "Add role-specific notes for this item..." : "No notes")}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import type {
  GearItem,
  GearCategory,
  GearCondition,
  GearReservation,
  GearKit,
  GearMaintenance,
} from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { GEAR_CATEGORIES } from "@/lib/constants/categories";
import { GearDetailModal } from "@/components/inventory/gear-detail-modal";
import { AddGearModal } from "@/components/inventory/add-gear-modal";
import { BatchAddGearModal } from "@/components/inventory/batch-add-gear-modal";
import { ReserveGearModal } from "@/components/inventory/reserve-gear-modal";
import { LogMaintenanceModal } from "@/components/inventory/log-maintenance-modal";
import { QrScanner } from "@/components/ui/qr-scanner";
import { BatchCart } from "@/components/inventory/batch-cart";
import { ActiveCheckouts } from "@/components/inventory/active-checkouts";
import { Modal } from "@/components/ui/modal";
import {
  Plus,
  Package,
  Search,
  CalendarRange,
  LayoutGrid,
  List,
  Pencil,
  Check,
  ChevronRight,
  Printer,
  QrCode,
  ArrowDownToLine,
  ScanLine,
  X,
  Wrench,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

const STATUS_BADGE: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700",
  Reserved: "bg-blue-50 text-blue-700",
  "Checked Out": "bg-amber-50 text-amber-700",
  "Under Maintenance": "bg-purple-50 text-purple-700",
  "In Repair": "bg-red-50 text-red-600",
};

const CONDITIONS: GearCondition[] = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Damaged",
];

type Tab = "items" | "reservations" | "maintenance";

export default function InventoryPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("items");

  // Items state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null);
  const [detailItem, setDetailItem] = useState<GearItem | null>(null);

  // Scanner drawer state
  const [showScanner, setShowScanner] = useState(false);

  // Checkout tab state
  const [cartItems, setCartItems] = useState<GearItem[]>([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const cartRef = useRef<GearItem[]>([]);
  cartRef.current = cartItems;

  // Inline row editing
  const [editingRow, setEditingRow] = useState<{
    id: string; name: string; category: string; brand: string;
    model: string; serialNumber: string; condition: string; notes: string;
  } | null>(null);
  const [savingRow, setSavingRow] = useState(false);

  // Data
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (categoryFilter) params.set("category", categoryFilter);
  const qs = params.toString();

  const { data: rawAllItems, isLoading, mutate } = useSWR<GearItem[]>(
    `/api/gear${qs ? `?${qs}` : ""}`,
    fetcher
  );
  const allItems: GearItem[] = Array.isArray(rawAllItems) ? rawAllItems : [];
  const items = allItems;

  const { data: rawReservations, mutate: mutateReservations } = useSWR<GearReservation[]>(
    tab === "reservations" ? "/api/gear/reservations?upcoming=true" : null,
    fetcher
  );
  const reservations: GearReservation[] = Array.isArray(rawReservations) ? rawReservations : [];

  const { data: rawMaintenance, mutate: mutateMaintenance } = useSWR<GearMaintenance[]>(
    tab === "maintenance" ? "/api/gear/maintenance" : null,
    fetcher
  );
  const maintenance: GearMaintenance[] = Array.isArray(rawMaintenance) ? rawMaintenance : [];

  const [showMaintenance, setShowMaintenance] = useState(false);

  const canEdit = user?.role === "Admin" || user?.role === "Studio" || user?.role === "Producer";

  // Auto-open scanner drawer when ?scan=true
  useEffect(() => {
    if (searchParams.get("scan") === "true") {
      setShowScanner(true);
    }
  }, [searchParams]);

  // Activate scanner when drawer is visible
  useEffect(() => {
    setScannerActive(showScanner);
  }, [showScanner]);

  // Scan handler — stable ref to avoid restarting camera
  const handleScan = useCallback(async (code: string) => {
    if (cartRef.current.some((i) => i.qrCode === code)) {
      toast("info", "Item already scanned");
      return;
    }
    try {
      const res = await fetch(`/api/gear?qr=${encodeURIComponent(code)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Item not found");
      }
      const item: GearItem = await res.json();
      setCartItems((prev) => [...prev, item]);
      toast("success", `Added: ${item.name}`);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Scan failed");
    }
  }, [toast]);

  async function handleManualEntry() {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode("");
    await handleScan(code);
  }

  async function handleBatchCheckout() {
    const eligible = cartItems.filter(
      (i) => i.status === "Available" || i.status === "Reserved"
    );
    if (eligible.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_checkout",
          items: eligible.map((i) => ({
            gearItemId: i.id,
            condition: i.condition || "Good",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      toast("success", `Checked out ${eligible.length} item(s)`);
      setCartItems([]);
      mutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setProcessing(false);
    }
  }

  async function handleBatchCheckin() {
    const eligible = cartItems.filter((i) => i.status === "Checked Out");
    if (eligible.length === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_checkin",
          gearItemIds: eligible.map((i) => i.id),
          condition: "Good",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");
      toast("success", `Checked in ${eligible.length} item(s)`);
      setCartItems([]);
      mutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setProcessing(false);
    }
  }

  const availableCount = items.filter((i) => i.status === "Available").length;

  async function handleSaveRow() {
    if (!editingRow) return;
    setSavingRow(true);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: editingRow.id,
          name: editingRow.name,
          category: editingRow.category,
          brand: editingRow.brand,
          model: editingRow.model,
          serialNumber: editingRow.serialNumber,
          condition: editingRow.condition,
          notes: editingRow.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      mutate();
      setEditingRow(null);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingRow(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Gear</h2>
          <p className="text-sm text-text-secondary">
            {items.length} item{items.length !== 1 ? "s" : ""} · {availableCount} available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowScanner(true)}>
            <ScanLine className="h-4 w-4" />
            Scan
          </Button>
          {canEdit && tab === "items" && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-xs transition-all hover:bg-primary-hover hover:shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add Item
                <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${showAddMenu ? "rotate-90" : ""}`} />
              </button>
              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-30 w-40 rounded-lg border border-border bg-surface py-1 shadow-md">
                    <button
                      onClick={() => { setShowAdd(true); setShowAddMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Single Item
                    </button>
                    <button
                      onClick={() => { setShowBatchAdd(true); setShowAddMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                    >
                      <List className="h-3.5 w-3.5" />
                      Batch Add
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: "items" as Tab, label: "Items" },
          { key: "reservations" as Tab, label: "Reservations" },
          { key: "maintenance" as Tab, label: "Maintenance" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Items tab */}
      {tab === "items" && (
        <>
          {/* Search + filter bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative min-w-[180px] max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search gear..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="ml-auto flex items-center gap-1">
                {canEdit && (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                    title="Add gear item"
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
                <button
                  onClick={() => {
                    const allIds = items.map((i) => i.id).join(",");
                    window.open(`/gear/print?ids=${allIds}`, "_blank");
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-text-tertiary hover:text-text-secondary transition-colors"
                  title="Print labels"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setCategoryFilter("")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  !categoryFilter ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}
              >
                All
              </button>
              {GEAR_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    categoryFilter === cat ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Items list */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title={search || categoryFilter ? "No items match" : "No gear yet"}
              description={
                search || categoryFilter
                  ? "Try adjusting your filters."
                  : "Add equipment to start tracking your inventory."
              }
              action={
                canEdit && !search && !categoryFilter ? (
                  <Button size="sm" onClick={() => setShowAdd(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </Button>
                ) : undefined
              }
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
                <Card
                  key={item.id}
                  hover
                  padding="md"
                  onClick={() => setDetailItem(item)}
                  className="cursor-pointer"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-28 w-full rounded-lg object-cover mb-2"
                    />
                  ) : null}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{item.name}</h3>
                      <p className="text-xs text-text-tertiary">{item.brand} {item.model}</p>
                    </div>
                    <Badge variant="custom" className={STATUS_BADGE[item.status] || ""}>
                      {item.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-tertiary mt-3 pt-3 border-t border-border-light">
                    <span className="flex items-center gap-1 font-mono">
                      <QrCode className="h-3 w-3" />
                      {item.qrCode}
                    </span>
                    <Badge variant="default">{item.category}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_140px_120px_110px_90px_72px] gap-0 bg-surface-secondary border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                <div className="px-1">Name</div>
                <div className="px-1">Brand / Model</div>
                <div className="px-1">Category</div>
                <div className="px-1">Condition</div>
                <div className="px-1">Status</div>
                <div />
              </div>
              {items.map((item, idx) => {
                const isEditing = editingRow?.id === item.id;
                const cellBase = "px-1 py-0.5";
                const inputCls = "w-full rounded border border-primary/60 bg-white px-1.5 py-0.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary";
                const selectCls = "w-full rounded border border-primary/60 bg-white px-1 py-0.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary";
                return (
                  <div
                    key={item.id}
                    className={`sm:grid grid-cols-[1fr_140px_120px_110px_90px_72px] gap-0 items-center px-3 py-2 transition-colors ${
                      idx !== 0 ? "border-t border-border" : ""
                    } ${isEditing ? "bg-primary/[0.03]" : "hover:bg-surface-secondary/50 cursor-pointer"}`}
                    onClick={() => {
                      if (!isEditing && canEdit) {
                        setEditingRow({
                          id: item.id,
                          name: item.name,
                          category: item.category,
                          brand: item.brand,
                          model: item.model,
                          serialNumber: item.serialNumber,
                          condition: item.condition,
                          notes: item.notes || "",
                        });
                      } else if (!canEdit) {
                        setDetailItem(item);
                      }
                    }}
                  >
                    {/* Name */}
                    <div className={cellBase}>
                      {isEditing ? (
                        <input
                          autoFocus
                          className={inputCls}
                          value={editingRow!.name}
                          onChange={(e) => setEditingRow((r) => r && { ...r, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveRow(); if (e.key === "Escape") setEditingRow(null); }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="h-7 w-7 rounded object-cover shrink-0" />
                          ) : null}
                          {item.name}
                        </span>
                      )}
                    </div>

                    {/* Brand / Model */}
                    <div className={`${cellBase} hidden sm:block`}>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <input
                            className={inputCls}
                            placeholder="Brand"
                            value={editingRow!.brand}
                            onChange={(e) => setEditingRow((r) => r && { ...r, brand: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveRow(); if (e.key === "Escape") setEditingRow(null); }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <input
                            className={inputCls}
                            placeholder="Model"
                            value={editingRow!.model}
                            onChange={(e) => setEditingRow((r) => r && { ...r, model: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveRow(); if (e.key === "Escape") setEditingRow(null); }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-text-tertiary">{item.brand} {item.model}</span>
                      )}
                    </div>

                    {/* Category */}
                    <div className={`${cellBase} hidden sm:block`}>
                      {isEditing ? (
                        <select
                          className={selectCls}
                          value={editingRow!.category}
                          onChange={(e) => setEditingRow((r) => r && { ...r, category: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {GEAR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <Badge variant="default">{item.category}</Badge>
                      )}
                    </div>

                    {/* Condition */}
                    <div className={`${cellBase} hidden sm:block`}>
                      {isEditing ? (
                        <select
                          className={selectCls}
                          value={editingRow!.condition}
                          onChange={(e) => setEditingRow((r) => r && { ...r, condition: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-text-secondary">{item.condition}</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className={cellBase}>
                      <Badge variant="custom" className={STATUS_BADGE[item.status] || ""}>
                        {item.status}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className={`${cellBase} flex items-center justify-end gap-1`} onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={handleSaveRow}
                            disabled={savingRow}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                            title="Save"
                          >
                            {savingRow ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => setEditingRow(null)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-secondary transition-colors"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : canEdit ? (
                        <button
                          onClick={() => setDetailItem(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
                          title="Details"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Reservations tab */}
      {tab === "reservations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {reservations.length} upcoming reservation{reservations.length !== 1 ? "s" : ""}
            </p>
            {canEdit && (
              <Button size="sm" onClick={() => setShowReserve(true)}>
                <CalendarRange className="h-3.5 w-3.5" />
                Reserve Gear
              </Button>
            )}
          </div>
          {reservations.length === 0 ? (
            <EmptyState
              icon={<CalendarRange className="h-5 w-5" />}
              title="No upcoming reservations"
              description="Reserve gear for upcoming shoots."
              action={
                canEdit ? (
                  <Button size="sm" onClick={() => setShowReserve(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Reserve Gear
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {reservations.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <CalendarRange className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {r.gearItem?.name || "Unknown Item"}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {format(parseISO(r.startDate), "MMM d")} — {format(parseISO(r.endDate), "MMM d, yyyy")}
                      {r.notes && ` · ${r.notes}`}
                    </p>
                  </div>
                  <Badge variant="custom" className="bg-blue-50 text-blue-700">
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Maintenance tab */}
      {tab === "maintenance" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {maintenance.length} maintenance record{maintenance.length !== 1 ? "s" : ""}
            </p>
            {canEdit && (
              <Button size="sm" onClick={() => setShowMaintenance(true)}>
                <Wrench className="h-3.5 w-3.5" />
                Log Maintenance
              </Button>
            )}
          </div>
          {maintenance.length === 0 ? (
            <EmptyState
              icon={<Wrench className="h-5 w-5" />}
              title="No maintenance records"
              description="Log maintenance and repairs for your gear."
              action={
                canEdit ? (
                  <Button size="sm" onClick={() => setShowMaintenance(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Log Maintenance
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {maintenance.map((m) => {
                const gearItem = allItems.find((i) => i.id === m.gearItemId);
                const statusColor: Record<string, string> = {
                  Scheduled: "bg-blue-50 text-blue-700",
                  "In Progress": "bg-amber-50 text-amber-700",
                  "Sent for Repair": "bg-purple-50 text-purple-700",
                  Completed: "bg-emerald-50 text-emerald-700",
                  Cancelled: "bg-slate-100 text-slate-500",
                };
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${m.type === "Repair" ? "bg-red-50 text-red-600" : "bg-purple-50 text-purple-700"}`}>
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">
                        {gearItem?.name || "Unknown Item"}
                      </p>
                      <p className="text-xs text-text-secondary truncate">{m.description}</p>
                      <p className="text-[10px] text-text-tertiary mt-0.5">
                        {m.type}
                        {m.scheduledDate && ` · ${format(parseISO(m.scheduledDate), "MMM d, yyyy")}`}
                        {m.cost > 0 && ` · $${m.cost.toFixed(2)}`}
                      </p>
                    </div>
                    <Badge variant="custom" className={statusColor[m.status] || ""}>
                      {m.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AddGearModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { mutate(); setShowAdd(false); }}
      />
      <BatchAddGearModal
        open={showBatchAdd}
        onClose={() => setShowBatchAdd(false)}
        onCreated={() => { mutate(); setShowBatchAdd(false); }}
      />
      <ReserveGearModal
        open={showReserve}
        onClose={() => { setShowReserve(false); setSelectedItem(null); }}
        items={items}
        preselectedItem={selectedItem}
        onReserved={() => { mutateReservations(); setShowReserve(false); setSelectedItem(null); }}
      />
      <GearDetailModal
        item={detailItem}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        onSaved={canEdit ? () => { mutate(); } : undefined}
      />
      <LogMaintenanceModal
        open={showMaintenance}
        onClose={() => setShowMaintenance(false)}
        items={items}
        onCreated={() => { mutateMaintenance(); setShowMaintenance(false); }}
      />

      {/* Scanner modal (centered) */}
      <Modal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        title="Check Out / Check In"
        description="Scan gear QR codes to check items out or in"
        size="lg"
      >
        <div className="space-y-4">
          {/* Scanner tile */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <QrCode className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                SCAN ITEMS
              </h3>
            </div>
            <div className="p-4">
              <QrScanner
                active={scannerActive && showScanner}
                onScan={handleScan}
                onError={(err) => toast("error", err)}
              />
            </div>
          </div>

          {/* Manual entry */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
              <Package className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                MANUAL ENTRY
              </h3>
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
              <Button size="sm" onClick={handleManualEntry}>
                Add
              </Button>
            </div>
          </div>

          {/* Scanned items cart */}
          <BatchCart
            items={cartItems}
            onRemove={(id) => setCartItems((prev) => prev.filter((i) => i.id !== id))}
            onCheckOutAll={handleBatchCheckout}
            onCheckInAll={handleBatchCheckin}
            onClear={() => setCartItems([])}
            processing={processing}
          />

          {/* Active checkouts */}
          <ActiveCheckouts />
        </div>
      </Modal>
    </div>
  );
}

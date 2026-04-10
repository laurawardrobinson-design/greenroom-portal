"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
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
import { CreateKitModal } from "@/components/inventory/create-kit-modal";
import { EditKitModal } from "@/components/inventory/edit-kit-modal";
import { QrScanner } from "@/components/ui/qr-scanner";
import { BatchCart } from "@/components/inventory/batch-cart";
import { CheckoutDetailsModal } from "@/components/inventory/checkout-details-modal";
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
  ChevronLeft,
  Printer,
  QrCode,
  ArrowDownToLine,
  ScanLine,
  StopCircle,
  X,
  Wrench,
  Layers,
  Star,
  ChevronDown,
} from "lucide-react";
import {
  format,
  parseISO,
  addDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";

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

type Tab = "items" | "kits" | "reservations" | "maintenance";

export default function InventoryPage() {
  const { toast } = useToast();
  const { mutate: globalMutate } = useSWRConfig();
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
  const [scannerActive, setScannerActive] = useState(false);

  // Checkout tab state
  const [cartItems, setCartItems] = useState<GearItem[]>([]);
  const [cartMode, setCartMode] = useState<"checkout" | "checkin" | null>(null);
  const [conflictIds, setConflictIds] = useState<Set<string>>(new Set());
  const [showConflictConfirm, setShowConflictConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<"checkout" | "checkin" | null>(null);
  const [showCheckoutDetails, setShowCheckoutDetails] = useState(false);
  const [pendingCheckoutItems, setPendingCheckoutItems] = useState<GearItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const cartRef = useRef<GearItem[]>([]);
  cartRef.current = cartItems;
  const cartModeRef = useRef<"checkout" | "checkin" | null>(null);
  cartModeRef.current = cartMode;

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

  // Reservation calendar state
  const [resCalMonth, setResCalMonth] = useState(() => new Date());
  const [selectedReservationDate, setSelectedReservationDate] = useState<Date | null>(null);

  // Set of all date strings covered by any reservation (for calendar dots)
  const reservationDateSet = useMemo(() => {
    const set = new Set<string>();
    reservations.forEach((r) => {
      let d = parseISO(r.startDate);
      const end = parseISO(r.endDate);
      while (d <= end) {
        set.add(format(d, "yyyy-MM-dd"));
        d = addDays(d, 1);
      }
    });
    return set;
  }, [reservations]);

  // Reservations filtered by selected calendar date
  const filteredReservations = useMemo(() => {
    if (!selectedReservationDate) return reservations;
    const sel = format(selectedReservationDate, "yyyy-MM-dd");
    return reservations.filter((r) => {
      const start = r.startDate.slice(0, 10);
      const end = r.endDate.slice(0, 10);
      return start <= sel && sel <= end;
    });
  }, [reservations, selectedReservationDate]);

  const { data: rawMaintenance, mutate: mutateMaintenance } = useSWR<GearMaintenance[]>(
    tab === "maintenance" ? "/api/gear/maintenance" : null,
    fetcher
  );
  const maintenance: GearMaintenance[] = Array.isArray(rawMaintenance) ? rawMaintenance : [];

  const { data: rawKits, mutate: mutateKits } = useSWR<GearKit[]>(
    tab === "kits" ? "/api/gear/kits" : null,
    fetcher
  );
  const kits: GearKit[] = Array.isArray(rawKits) ? rawKits : [];

  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showCreateKit, setShowCreateKit] = useState(false);
  const [editKit, setEditKit] = useState<GearKit | null>(null);
  const [expandedKit, setExpandedKit] = useState<string | null>(null);

  const canEdit = user?.role === "Admin" || user?.role === "Studio" || user?.role === "Producer";

  // Auto-open scanner drawer when ?scan=true
  useEffect(() => {
    if (searchParams.get("scan") === "true") {
      setShowScanner(true);
    }
  }, [searchParams]);

  // Auto-activate scanner when modal opens; reset to inactive when it closes
  useEffect(() => {
    if (showScanner) {
      setScannerActive(true);
    } else {
      setScannerActive(false);
    }
  }, [showScanner]);

  // Scan handler — stable ref to avoid restarting camera
  const handleScan = useCallback(async (code: string) => {
    const normalized = code.trim();
    if (!normalized) return;

    if (cartRef.current.some((i) => i.qrCode.trim().toLowerCase() === normalized.toLowerCase())) {
      return;
    }
    try {
      const res = await fetch(`/api/gear?qr=${encodeURIComponent(normalized)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Item not found");
      }
      const item: GearItem = await res.json();
      const itemMode = item.status === "Checked Out" ? "checkin" : "checkout";
      const currentMode = cartModeRef.current;
      const isConflict = currentMode !== null && itemMode !== currentMode;

      if (currentMode === null) {
        setCartMode(itemMode);
      }
      setCartItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        return [...prev, item];
      });
      if (isConflict) {
        setConflictIds((prev) => new Set([...prev, item.id]));
        toast("warning", `${item.name} flagged — status conflicts with current operation`);
      } else {
        toast("success", `Added: ${item.name}`);
      }
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

  async function executeBatchCheckout(items: GearItem[], opts?: { campaignId?: string; dueDate?: string }) {
    setProcessing(true);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_checkout",
          campaignId: opts?.campaignId || undefined,
          dueDate: opts?.dueDate || undefined,
          items: items.map((i) => ({
            gearItemId: i.id,
            condition: i.condition || "Good",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      const failed = (data.results || []).filter((r: { success: boolean }) => !r.success);
      if (failed.length > 0) {
        toast("error", `${failed.length} item(s) could not be checked out`);
      } else {
        toast("success", `Checked out ${items.length} item(s)`);
      }
      setCartItems([]);
      setCartMode(null);
      setConflictIds(new Set());
      mutate();
      globalMutate("/api/gear/checkouts");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setProcessing(false);
    }
  }

  async function executeBatchCheckin(items: GearItem[]) {
    setProcessing(true);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_checkin",
          gearItemIds: items.map((i) => i.id),
          condition: "Good",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");
      const failed = (data.results || []).filter((r: { success: boolean }) => !r.success);
      if (failed.length > 0) {
        toast("error", `${failed.length} item(s) could not be checked in`);
      } else {
        toast("success", `Checked in ${items.length} item(s)`);
      }
      setCartItems([]);
      setCartMode(null);
      setConflictIds(new Set());
      mutate();
      globalMutate("/api/gear/checkouts");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setProcessing(false);
    }
  }

  function handleBatchCheckout() {
    const conflicts = cartItems.filter((i) => conflictIds.has(i.id));
    if (conflicts.length > 0) {
      setPendingAction("checkout");
      setShowConflictConfirm(true);
    } else {
      const items = cartItems.filter((i) => i.status === "Available" || i.status === "Reserved");
      setPendingCheckoutItems(items);
      setShowCheckoutDetails(true);
    }
  }

  function handleBatchCheckin() {
    const conflicts = cartItems.filter((i) => conflictIds.has(i.id));
    if (conflicts.length > 0) {
      setPendingAction("checkin");
      setShowConflictConfirm(true);
    } else {
      executeBatchCheckin(cartItems.filter((i) => i.status === "Checked Out"));
    }
  }

  function handleConfirmOverride() {
    setShowConflictConfirm(false);
    if (pendingAction === "checkout") {
      const items = cartItems.filter((i) => i.status === "Available" || i.status === "Reserved" || conflictIds.has(i.id));
      setPendingCheckoutItems(items);
      setShowCheckoutDetails(true);
    } else if (pendingAction === "checkin") {
      executeBatchCheckin(cartItems.filter((i) => i.status === "Checked Out" || conflictIds.has(i.id)));
    }
    setPendingAction(null);
  }

  function handleDismissConflicts() {
    setShowConflictConfirm(false);
    setPendingAction(null);
    // Remove conflicting items from cart and proceed with clean items only
    setCartItems((prev) => prev.filter((i) => !conflictIds.has(i.id)));
    setConflictIds(new Set());
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
            Scan Gear
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: "items" as Tab, label: "Items" },
          { key: "kits" as Tab, label: "Kits" },
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
                  <div className="relative">
                    <button
                      onClick={() => setShowAddMenu((v) => !v)}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
                      title="Add gear item"
                    >
                      <Plus className="h-4 w-4" />
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
                    <span className="flex items-center gap-1">
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

      {/* Kits tab */}
      {tab === "kits" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {kits.length} kit{kits.length !== 1 ? "s" : ""}
            </p>
            {canEdit && (
              <Button size="sm" onClick={() => setShowCreateKit(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create Kit
              </Button>
            )}
          </div>

          {kits.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="No kits yet"
              description="Group gear items into reusable kits for quick checkout."
              action={
                canEdit ? (
                  <Button size="sm" onClick={() => setShowCreateKit(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Create Kit
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kits.map((kit) => {
                const totalCount = kit.items?.length || 0;
                const availCount = kit.items?.filter((i) => i.status === "Available").length || 0;

                return (
                  <Card
                    key={kit.id}
                    hover
                    padding="md"
                    onClick={() => setEditKit(kit)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-center h-28 rounded-lg bg-surface-secondary mb-2">
                      <Layers className="h-8 w-8 text-text-tertiary" />
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{kit.name}</h3>
                        {kit.description && (
                          <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{kit.description}</p>
                        )}
                      </div>
                      {kit.isFavorite && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-tertiary mt-3 pt-3 border-t border-border-light">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {totalCount} item{totalCount !== 1 ? "s" : ""}
                      </span>
                      <Badge variant="custom" className="bg-emerald-50 text-emerald-700">
                        {availCount} available
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reservations tab */}
      {tab === "reservations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              {selectedReservationDate
                ? `${filteredReservations.length} reservation${filteredReservations.length !== 1 ? "s" : ""} on ${format(selectedReservationDate, "MMM d")}`
                : `${reservations.length} upcoming reservation${reservations.length !== 1 ? "s" : ""}`}
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
              {/* Mini calendar */}
              <div className="rounded-xl border border-border bg-surface overflow-hidden shrink-0">
                {/* Month nav */}
                <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                  <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                    {format(resCalMonth, "MMMM yyyy")}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="sm" onClick={() => setResCalMonth(subMonths(resCalMonth, 1))}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setResCalMonth(addMonths(resCalMonth, 1))}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-border">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
                    <div key={d} className="py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Day grid */}
                <div className="grid grid-cols-7">
                  {(() => {
                    const monthStart = startOfMonth(resCalMonth);
                    const monthEnd = endOfMonth(resCalMonth);
                    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
                    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
                    const days: Date[] = [];
                    let cur = calStart;
                    while (cur <= calEnd) { days.push(cur); cur = addDays(cur, 1); }
                    return days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const inMonth = isSameMonth(day, resCalMonth);
                      const hasRes = reservationDateSet.has(dateStr);
                      const isSelected = selectedReservationDate ? isSameDay(day, selectedReservationDate) : false;
                      const todayDate = isToday(day);
                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedReservationDate((prev) => prev && isSameDay(prev, day) ? null : day)}
                          className={`
                            relative flex flex-col items-center py-1.5 transition-colors
                            ${!inMonth ? "opacity-30" : ""}
                            ${isSelected ? "bg-primary/10" : "hover:bg-surface-secondary"}
                          `}
                        >
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                            todayDate ? "bg-primary font-bold text-white" : isSelected ? "text-primary font-semibold" : "text-text-primary"
                          }`}>
                            {format(day, "d")}
                          </span>
                          {hasRes && (
                            <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-primary" : "bg-blue-400"}`} />
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
                {selectedReservationDate && (
                  <div className="border-t border-border px-3.5 py-2">
                    <button
                      onClick={() => setSelectedReservationDate(null)}
                      className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </div>

              {/* Reservation list */}
              <div className="min-w-0">
                {filteredReservations.length === 0 ? (
                  <EmptyState
                    icon={<CalendarRange className="h-5 w-5" />}
                    title="No reservations on this date"
                    description="Select another date or clear the filter."
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredReservations.map((r) => (
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
      <CreateKitModal
        open={showCreateKit}
        onClose={() => setShowCreateKit(false)}
        items={items}
        onCreated={() => { mutateKits(); setShowCreateKit(false); }}
      />
      <EditKitModal
        kit={editKit}
        open={!!editKit}
        onClose={() => setEditKit(null)}
        items={items}
        onUpdated={() => { mutateKits(); setEditKit(null); }}
        onDeleted={() => { mutateKits(); setEditKit(null); }}
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
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  SCAN ITEMS
                </h3>
              </div>
              {scannerActive ? (
                <button
                  onClick={() => setScannerActive(false)}
                  className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  Stop scanning
                </button>
              ) : (
                <button
                  onClick={() => setScannerActive(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  Start scanning
                </button>
              )}
            </div>
            <div className="p-4">
              {scannerActive ? (
                <QrScanner
                  active={scannerActive && showScanner}
                  onScan={handleScan}
                  onError={(err) => toast("error", err)}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-secondary/50 p-6 text-center">
                  <QrCode className="h-5 w-5 text-text-tertiary" />
                  <p className="text-sm text-text-secondary">
                    Camera stopped. Tap <strong>Start scanning</strong> to resume.
                  </p>
                </div>
              )}
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
            conflictIds={conflictIds}
            cartMode={cartMode}
            onRemove={(id) => {
              setCartItems((prev) => prev.filter((i) => i.id !== id));
              setConflictIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
            }}
            onCheckOutAll={handleBatchCheckout}
            onCheckInAll={handleBatchCheckin}
            onClear={() => { setCartItems([]); setCartMode(null); setConflictIds(new Set()); }}
            processing={processing}
          />

          {/* Active checkouts */}
          <ActiveCheckouts />
        </div>
      </Modal>

      {/* Checkout details modal — collects campaign + return date */}
      <CheckoutDetailsModal
        open={showCheckoutDetails}
        itemCount={pendingCheckoutItems.length}
        onConfirm={(opts) => {
          setShowCheckoutDetails(false);
          executeBatchCheckout(pendingCheckoutItems, opts);
          setPendingCheckoutItems([]);
        }}
        onCancel={() => {
          setShowCheckoutDetails(false);
          setPendingCheckoutItems([]);
        }}
      />

      {/* Conflict confirmation modal */}
      <Modal
        open={showConflictConfirm}
        onClose={() => { setShowConflictConfirm(false); setPendingAction(null); }}
        title="Some items need attention"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {pendingAction === "checkout"
              ? "The following items are already checked out. Checking them out again will override the existing record. Continue?"
              : "The following items show as available in the system. Checking them in anyway will mark them as returned. Continue?"}
          </p>
          <ul className="rounded-lg border border-border divide-y divide-border-light overflow-hidden">
            {cartItems.filter((i) => conflictIds.has(i.id)).map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="text-sm font-medium text-text-primary flex-1 truncate">{item.name}</span>
                <span className="text-xs text-amber-600 font-medium">{item.status}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={handleDismissConflicts}>
              Remove &amp; continue without them
            </Button>
            <Button onClick={handleConfirmOverride}>
              Override &amp; {pendingAction === "checkout" ? "check out" : "check in"} all
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

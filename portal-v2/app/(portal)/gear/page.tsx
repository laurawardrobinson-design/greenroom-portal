"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
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
import { QrScanner } from "@/components/ui/qr-scanner";
import { RfidScanner } from "@/components/ui/rfid-scanner";
import { BatchCart } from "@/components/inventory/batch-cart";
import { ActiveCheckouts } from "@/components/inventory/active-checkouts";
import { FavoriteKits } from "@/components/inventory/favorite-kits";
import { GearDetailModal } from "@/components/inventory/gear-detail-modal";
import { AddGearModal } from "@/components/inventory/add-gear-modal";
import { ReserveGearModal } from "@/components/inventory/reserve-gear-modal";
import { CreateKitModal } from "@/components/inventory/create-kit-modal";
import { LogMaintenanceModal } from "@/components/inventory/log-maintenance-modal";
import { EditGearModal } from "@/components/inventory/edit-gear-modal";
import { EditKitModal } from "@/components/inventory/edit-kit-modal";
import {
  Plus,
  Package,
  Search,
  QrCode,
  ScanLine,
  CalendarRange,
  Layers,
  Wrench,
  Star,
  ChevronDown,
  ChevronRight,
  Camera,
  X,
  Radio,
  Printer,
  LayoutGrid,
  List,
  Pencil,
  Eye,
  EyeOff,
  CheckCircle2,
  Check,
  ShoppingBasket,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/utils/format";

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
  Retired: "bg-slate-100 text-slate-500",
};

const MAINT_STATUS_BADGE: Record<string, string> = {
  Scheduled: "bg-blue-50 text-blue-700",
  "In Progress": "bg-amber-50 text-amber-700",
  "Sent for Repair": "bg-purple-50 text-purple-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-slate-100 text-slate-500",
};

const CONDITIONS: GearCondition[] = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Damaged",
];

type InventoryView = "quick" | "all";
type AllGearTab = "items" | "reservations" | "kits" | "maintenance";

export default function InventoryPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();

  // View state
  const [view, setView] = useState<InventoryView>(
    searchParams.get("scan") === "true" ? "quick" : "quick"
  );
  const [allGearTab, setAllGearTab] = useState<AllGearTab>("items");

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(
    searchParams.get("scan") === "true"
  );
  const [rfidOpen, setRfidOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<GearItem[]>([]);
  const [condition, setCondition] = useState<GearCondition>("Good");
  const [processing, setProcessing] = useState(false);
  const [manualCode, setManualCode] = useState("");

  // All Gear state
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [gearViewMode, setGearViewMode] = useState<"grid" | "table">("grid");

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [showCreateKit, setShowCreateKit] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null);
  const [detailItem, setDetailItem] = useState<GearItem | null>(null);
  const [editItem, setEditItem] = useState<GearItem | null>(null);
  const [editKit, setEditKit] = useState<(typeof kits)[0] | null>(null);
  const [expandedKit, setExpandedKit] = useState<string | null>(null);
  const [updatingMaintenance, setUpdatingMaintenance] = useState<string | null>(null);

  // Inline row editing state
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

  const {
    data: rawAllItems,
    isLoading,
    mutate,
  } = useSWR<GearItem[]>(`/api/gear${qs ? `?${qs}` : ""}`, fetcher);
  const allItems: GearItem[] = Array.isArray(rawAllItems) ? rawAllItems : [];

  // Hide retired items by default
  const items = showRetired ? allItems : allItems.filter((i) => i.status !== "Retired");

  const { data: rawReservations, mutate: mutateReservations } =
    useSWR<GearReservation[]>(
      allGearTab === "reservations"
        ? "/api/gear/reservations?upcoming=true"
        : null,
      fetcher
    );
  const reservations: GearReservation[] = Array.isArray(rawReservations) ? rawReservations : [];

  const { data: rawKits, mutate: mutateKits } = useSWR<GearKit[]>(
    allGearTab === "kits" ? "/api/gear/kits" : null,
    fetcher
  );
  const kits: GearKit[] = Array.isArray(rawKits) ? rawKits : [];

  const { data: maintenanceRaw, mutate: mutateMaintenance } =
    useSWR<GearMaintenance[]>(
      allGearTab === "maintenance" ? "/api/gear/maintenance" : null,
      fetcher
    );
  const maintenance = Array.isArray(maintenanceRaw) ? maintenanceRaw : [];

  const canEdit = user?.role === "Admin" || user?.role === "Studio" || user?.role === "Producer";

  // --- Scanner state refs (prevent race conditions) ---
  const scanLockRef = useRef(false);
  const batchItemsRef = useRef<GearItem[]>([]);
  useEffect(() => {
    batchItemsRef.current = batchItems;
  }, [batchItems]);

  // --- Scanner handlers ---
  const handleScan = useCallback(
    async (code: string) => {
      // Prevent concurrent scans — ignore if a lookup is already in flight
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      try {
        const res = await fetch(
          `/api/gear?qr=${encodeURIComponent(code)}`
        );
        const item = await res.json();
        if (!item || !item.id) {
          toast("error", `No gear found for code: ${code}`);
          return;
        }
        // Use ref to avoid stale closure on batchItems
      if (batchItemsRef.current.some((i) => i.id === item.id)) {
          toast("info", `${item.name} already in cart`);
          return;
        }
        setBatchItems((prev) => [...prev, item]);
        toast("success", `Added ${item.name}`);
      } catch {
        toast("error", "Failed to look up QR code");
      } finally {
        // Hold lock for 1.5s cooldown before accepting next scan
        setTimeout(() => {
          scanLockRef.current = false;
        }, 1500);
      }
    },
    [toast]
  );

  const handleRfidScan = useCallback(
    async (epc: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      try {
        const res = await fetch(`/api/gear?rfid=${encodeURIComponent(epc)}`);
        const item = await res.json();
        if (!item || !item.id) {
          toast("error", `No gear assigned to tag: ${epc}`);
          return;
        }
        if (batchItemsRef.current.some((i) => i.id === item.id)) {
          toast("info", `${item.name} already in cart`);
          return;
        }
        setBatchItems((prev) => [...prev, item]);
        toast("success", `Added ${item.name}`);
      } catch {
        toast("error", "Failed to look up RFID tag");
      } finally {
        setTimeout(() => {
          scanLockRef.current = false;
        }, 1500);
      }
    },
    [toast]
  );

  async function handleManualLookup(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      await handleScan(manualCode.trim());
      setManualCode("");
    }
  }

  async function handleBatchCheckOut() {
    setProcessing(true);
    const toCheckOut = batchItems
      .filter((i) => i.status === "Available" || i.status === "Reserved")
      .map((i) => ({ gearItemId: i.id, name: i.name, condition }));
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_checkout", items: toCheckOut }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch checkout failed");
      const results: { gearItemId: string; name: string; success: boolean; error?: string }[] = data.results;
      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);
      if (succeeded.length > 0) {
        toast("success", `Checked out ${succeeded.length} item${succeeded.length !== 1 ? "s" : ""}`);
      }
      if (failed.length > 0) {
        const msg = failed.map((r) => `${r.name}${r.error ? `: ${r.error}` : ""}`).join(", ");
        toast("error", `${failed.length} failed — ${msg}`);
      }
      // Only remove successfully checked-out items; keep failures in cart for retry
      const succeededIds = new Set(succeeded.map((r) => r.gearItemId));
      setBatchItems((prev) => prev.filter((i) => !succeededIds.has(i.id)));
      mutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Batch checkout failed");
    } finally {
      setProcessing(false);
    }
  }

  async function handleBatchCheckIn() {
    setProcessing(true);
    const toCheckIn = batchItems
      .filter((i) => i.status === "Checked Out")
      .map((i) => i.id);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_checkin",
          gearItemIds: toCheckIn,
          condition,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch checkin failed");
      const results: { gearItemId: string; name: string; success: boolean; error?: string }[] = data.results;
      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);
      if (succeeded.length > 0) {
        toast("success", `Checked in ${succeeded.length} item${succeeded.length !== 1 ? "s" : ""}`);
      }
      if (failed.length > 0) {
        const msg = failed.map((r) => `${r.name}${r.error ? `: ${r.error}` : ""}`).join(", ");
        toast("error", `${failed.length} failed — ${msg}`);
      }
      const succeededIds = new Set(succeeded.map((r) => r.gearItemId));
      setBatchItems((prev) => prev.filter((i) => !succeededIds.has(i.id)));
      mutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Batch checkin failed");
    } finally {
      setProcessing(false);
    }
  }

  async function handleUpdateMaintenanceStatus(id: string, status: string) {
    setUpdatingMaintenance(id);
    try {
      const res = await fetch(`/api/gear/maintenance?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          completedDate: status === "Completed" ? new Date().toISOString().split("T")[0] : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      toast("success", `Status updated to ${status}`);
      mutateMaintenance();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingMaintenance(null);
    }
  }

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

  // --- All Gear tab definitions ---
  const ALL_GEAR_TABS: {
    key: AllGearTab;
    label: string;
    icon: typeof Package;
  }[] = [
    { key: "items", label: "Items", icon: Package },
    { key: "reservations", label: "Reservations", icon: CalendarRange },
    { key: "kits", label: "Kits", icon: Layers },
    { key: "maintenance", label: "Maintenance", icon: Wrench },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Gear
          </h2>
          <p className="text-sm text-text-secondary">
            Gear check-in/out and management
          </p>
        </div>
        <div className="flex gap-2">
          {view === "all" && canEdit && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex rounded-lg border border-border bg-surface-secondary p-0.5">
        <button
          onClick={() => setView("quick")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            view === "quick"
              ? "bg-surface text-text-primary shadow-xs"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <ScanLine className="h-4 w-4" />
          Quick Actions
        </button>
        <button
          onClick={() => setView("all")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
            view === "all"
              ? "bg-surface text-text-primary shadow-xs"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Package className="h-4 w-4" />
          All Gear
          <span className="text-xs text-text-tertiary">
            {items.length}
          </span>
        </button>
      </div>

      {/* ================================================ */}
      {/* QUICK ACTIONS VIEW                               */}
      {/* ================================================ */}
      {view === "quick" && (
        <div className="space-y-5">
          {/* Scan Card */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Scan Gear
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {/* Scanner toggle */}
                <Button
                  size="sm"
                  variant={scannerOpen ? "secondary" : "primary"}
                  onClick={() => setScannerOpen(!scannerOpen)}
                >
                  {scannerOpen ? (
                    <>
                      <X className="h-3.5 w-3.5" />
                      Close
                    </>
                  ) : (
                    <>
                      <Camera className="h-3.5 w-3.5" />
                      Open Camera
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Camera scanner */}
              <QrScanner
                active={scannerOpen}
                onScan={handleScan}
                onError={(err) => toast("error", err)}
              />

              {/* Manual entry */}
              <form onSubmit={handleManualLookup} className="flex gap-2">
                <div className="relative flex-1">
                  <QrCode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Enter QR code manually..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-text-tertiary shadow-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <Button type="submit" variant="secondary" size="md">
                  Look Up
                </Button>
              </form>

              {/* Condition selector */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-text-secondary whitespace-nowrap">
                  Condition:
                </label>
                <div className="flex flex-wrap gap-1">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondition(c)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                        condition === c
                          ? "bg-text-primary text-white"
                          : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Batch cart */}
            <div className="border-t border-border p-4">
              <BatchCart
                items={batchItems}
                onRemove={(id) =>
                  setBatchItems((prev) =>
                    prev.filter((i) => i.id !== id)
                  )
                }
                onCheckOutAll={handleBatchCheckOut}
                onCheckInAll={handleBatchCheckIn}
                onClear={() => setBatchItems([])}
                processing={processing}
              />
            </div>
          </div>

          {/* Active Checkouts */}
          <ActiveCheckouts />

          {/* Favorite Kits */}
          <FavoriteKits />

          {/* RFID Scan Card */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  RFID Reader
                </h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  USB HID
                </span>
              </div>
              <Button
                size="sm"
                variant={rfidOpen ? "secondary" : "primary"}
                onClick={() => setRfidOpen(!rfidOpen)}
              >
                {rfidOpen ? (
                  <>
                    <X className="h-3.5 w-3.5" />
                    Stop
                  </>
                ) : (
                  <>
                    <Radio className="h-3.5 w-3.5" />
                    Start Reader
                  </>
                )}
              </Button>
            </div>
            <div className="p-4">
              {rfidOpen ? (
                <RfidScanner active={rfidOpen} onScan={handleRfidScan} />
              ) : (
                <p className="text-xs text-text-tertiary">
                  Connect a UHF RFID USB reader, then press Start Reader. Tagged
                  items scan directly into the cart — no camera needed.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================ */}
      {/* ALL GEAR VIEW                                    */}
      {/* ================================================ */}
      {view === "all" && (
        <div className="space-y-5">
          {/* Sub-tabs */}
          <div className="border-b border-border">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {ALL_GEAR_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setAllGearTab(tab.key)}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      allGearTab === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items tab */}
          {allGearTab === "items" && (
            <>
              {/* Search + controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 ml-auto">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSearch(searchInput);
                    }}
                  >
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                      <input
                        type="text"
                        placeholder="Search gear..."
                        value={searchInput}
                        onChange={(e) => {
                          setSearchInput(e.target.value);
                          if (!e.target.value) setSearch("");
                        }}
                        className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-text-tertiary shadow-xs focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none sm:w-64"
                      />
                    </div>
                  </form>
                  {/* View toggle */}
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setGearViewMode("grid")}
                      className={`h-9 w-9 flex items-center justify-center transition-colors ${
                        gearViewMode === "grid"
                          ? "bg-surface-secondary text-text-primary"
                          : "bg-surface text-text-tertiary hover:text-text-secondary"
                      }`}
                      title="Grid view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setGearViewMode("table")}
                      className={`h-9 w-9 flex items-center justify-center border-l border-border transition-colors ${
                        gearViewMode === "table"
                          ? "bg-surface-secondary text-text-primary"
                          : "bg-surface text-text-tertiary hover:text-text-secondary"
                      }`}
                      title="Row view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowRetired(!showRetired)}
                    className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-medium transition-colors ${
                      showRetired
                        ? "bg-surface-secondary text-text-primary"
                        : "bg-surface text-text-tertiary hover:text-text-secondary"
                    }`}
                    title={showRetired ? "Hide retired" : "Show retired"}
                  >
                    {showRetired ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    Retired
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const allIds = items.map((i) => i.id).join(",");
                      window.open(
                        `/gear/print?ids=${allIds}`,
                        "_blank"
                      );
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Labels
                  </Button>
                </div>
              </div>

              {/* Category header bar */}
              <div className="border-b border-border overflow-x-auto scrollbar-hide -mx-0">
                <div className="flex">
                  <button
                    onClick={() => setCategoryFilter("")}
                    className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      !categoryFilter
                        ? "border-primary text-primary"
                        : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
                    }`}
                  >
                    All
                  </button>
                  {GEAR_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
                      className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        categoryFilter === cat
                          ? "border-primary text-primary"
                          : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items list */}
              {isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<Package className="h-5 w-5" />}
                  title={
                    search || categoryFilter
                      ? "No items match"
                      : "No gear yet"
                  }
                  description={
                    search || categoryFilter
                      ? "Try adjusting your filters."
                      : "Add equipment to start tracking your inventory."
                  }
                  action={
                    !search && !categoryFilter ? (
                      <Button
                        size="sm"
                        onClick={() => setShowAdd(true)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Item
                      </Button>
                    ) : undefined
                  }
                />
              ) : gearViewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                          <h3 className="text-sm font-semibold text-text-primary">
                            {item.name}
                          </h3>
                          <p className="text-xs text-text-tertiary">
                            {item.brand} {item.model}
                          </p>
                        </div>
                        <Badge
                          variant="custom"
                          className={
                            STATUS_BADGE[item.status] || ""
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-tertiary mt-3 pt-3 border-t border-border-light">
                        <span className="flex items-center gap-1 font-mono">
                          <QrCode className="h-3 w-3" />
                          {item.qrCode}
                        </span>
                        <Badge variant="default">
                          {item.category}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                /* Table / Row view — inline editable */
                <div className="rounded-xl border border-border overflow-hidden">
                  {/* Table header */}
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

                        {/* Status (read-only) */}
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
          {allGearTab === "reservations" && (
            <div>
              <div className="flex justify-end mb-4">
                <Button
                  size="sm"
                  onClick={() => setShowReserve(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Reserve Gear
                </Button>
              </div>
              {reservations.length === 0 ? (
                <EmptyState
                  icon={<CalendarRange className="h-5 w-5" />}
                  title="No upcoming reservations"
                  description="Reserve gear for upcoming shoots."
                />
              ) : (
                <div className="space-y-2">
                  {reservations.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <CalendarRange className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {r.gearItem?.name || "Unknown Item"}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {format(parseISO(r.startDate), "MMM d")}{" "}
                          —{" "}
                          {format(
                            parseISO(r.endDate),
                            "MMM d, yyyy"
                          )}
                          {r.notes && ` · ${r.notes}`}
                        </p>
                      </div>
                      <Badge
                        variant="custom"
                        className="bg-blue-50 text-blue-700"
                      >
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Kits tab */}
          {allGearTab === "kits" && (
            <div>
              <div className="flex justify-end mb-4">
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => setShowCreateKit(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Kit
                  </Button>
                )}
              </div>
              {kits.length === 0 ? (
                <EmptyState
                  icon={<Layers className="h-5 w-5" />}
                  title="No kits yet"
                  description="Create gear kits for quick checkout of standard setups."
                />
              ) : (
                <div className="space-y-3">
                  {kits.map((kit) => (
                    <Card key={kit.id} padding="md">
                      <div className="flex items-center gap-3 w-full">
                        <button
                          onClick={() =>
                            setExpandedKit(
                              expandedKit === kit.id ? null : kit.id
                            )
                          }
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {expandedKit === kit.id ? (
                            <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-text-primary">
                                {kit.name}
                              </h3>
                              {kit.isFavorite && (
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            <p className="text-xs text-text-tertiary">
                              {kit.items?.length || 0} items
                              {kit.description &&
                                ` · ${kit.description}`}
                            </p>
                          </div>
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => setEditKit(kit)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors"
                            title="Edit kit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {expandedKit === kit.id && kit.items && (
                        <div className="mt-3 pt-3 border-t border-border-light space-y-1.5 ml-7">
                          {kit.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <Badge
                                variant="custom"
                                className={
                                  STATUS_BADGE[item.status] || ""
                                }
                              >
                                {item.status}
                              </Badge>
                              <span className="text-text-primary font-medium">
                                {item.name}
                              </span>
                              <span className="text-text-tertiary">
                                {item.brand} {item.model}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Maintenance tab */}
          {allGearTab === "maintenance" && (
            <div>
              <div className="flex justify-end mb-4">
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => setShowMaintenance(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Log Maintenance
                  </Button>
                )}
              </div>
              {maintenance.length === 0 ? (
                <EmptyState
                  icon={<Wrench className="h-5 w-5" />}
                  title="No maintenance records"
                  description="Log maintenance and repairs for gear items."
                />
              ) : (
                <div className="space-y-2">
                  {maintenance.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          m.type === "Repair"
                            ? "bg-red-50 text-red-600"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {m.description}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {m.type}
                          {m.scheduledDate &&
                            ` · ${format(
                              parseISO(m.scheduledDate),
                              "MMM d, yyyy"
                            )}`}
                          {m.cost > 0 &&
                            ` · ${formatCurrency(m.cost)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="custom"
                          className={
                            MAINT_STATUS_BADGE[m.status] || ""
                          }
                        >
                          {m.status}
                        </Badge>
                        {canEdit && m.status !== "Completed" && m.status !== "Cancelled" && (
                          <button
                            onClick={() => handleUpdateMaintenanceStatus(m.id, "Completed")}
                            disabled={updatingMaintenance === m.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50"
                            title="Mark completed"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AddGearModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => {
          mutate();
          setShowAdd(false);
        }}
      />
      <ReserveGearModal
        open={showReserve}
        onClose={() => {
          setShowReserve(false);
          setSelectedItem(null);
        }}
        items={items}
        preselectedItem={selectedItem}
        onReserved={() => {
          mutateReservations();
          setShowReserve(false);
          setSelectedItem(null);
        }}
      />
      <CreateKitModal
        open={showCreateKit}
        onClose={() => setShowCreateKit(false)}
        items={items}
        onCreated={() => {
          mutateKits();
          setShowCreateKit(false);
        }}
      />
      <LogMaintenanceModal
        open={showMaintenance}
        onClose={() => setShowMaintenance(false)}
        items={items}
        onCreated={() => {
          mutateMaintenance();
          setShowMaintenance(false);
        }}
      />
      <GearDetailModal
        item={detailItem}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={canEdit ? (item) => {
          setDetailItem(null);
          setEditItem(item);
        } : undefined}
      />
      <EditGearModal
        item={editItem}
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onUpdated={() => {
          mutate();
          setEditItem(null);
        }}
      />
      <EditKitModal
        kit={editKit}
        open={!!editKit}
        onClose={() => setEditKit(null)}
        items={allItems.filter((i) => i.status !== "Retired")}
        onUpdated={() => {
          mutateKits();
          setEditKit(null);
        }}
        onDeleted={() => {
          mutateKits();
          setEditKit(null);
        }}
      />
    </div>
  );
}

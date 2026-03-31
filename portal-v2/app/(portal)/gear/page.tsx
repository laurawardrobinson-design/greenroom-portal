"use client";

import { useState, useRef } from "react";
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
import { GearDetailModal } from "@/components/inventory/gear-detail-modal";
import { AddGearModal } from "@/components/inventory/add-gear-modal";
import { ReserveGearModal } from "@/components/inventory/reserve-gear-modal";
import { EditGearModal } from "@/components/inventory/edit-gear-modal";
import {
  Plus,
  Package,
  Search,
  CalendarRange,
  LayoutGrid,
  List,
  Pencil,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  Printer,
  QrCode,
  X,
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
  Retired: "bg-slate-100 text-slate-500",
};

const CONDITIONS: GearCondition[] = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Damaged",
];

type Tab = "items" | "reservations";

export default function InventoryPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("items");

  // Items state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null);
  const [detailItem, setDetailItem] = useState<GearItem | null>(null);
  const [editItem, setEditItem] = useState<GearItem | null>(null);

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
  const items = showRetired ? allItems : allItems.filter((i) => i.status !== "Retired");

  const { data: rawReservations, mutate: mutateReservations } = useSWR<GearReservation[]>(
    tab === "reservations" ? "/api/gear/reservations?upcoming=true" : null,
    fetcher
  );
  const reservations: GearReservation[] = Array.isArray(rawReservations) ? rawReservations : [];

  const canEdit = user?.role === "Admin" || user?.role === "Studio" || user?.role === "Producer";

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
          <h2 className="text-lg font-semibold text-text-primary">Gear</h2>
          <p className="text-sm text-text-secondary">
            {items.length} item{items.length !== 1 ? "s" : ""} · {availableCount} available
          </p>
        </div>
        {canEdit && tab === "items" && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["items", "reservations"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-border"
            }`}
          >
            {t === "items" ? "Items" : "Reservations"}
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
                  onClick={() => setShowRetired(!showRetired)}
                  className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
                    showRetired ? "bg-surface-secondary text-text-primary" : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title={showRetired ? "Hide retired" : "Show retired"}
                >
                  {showRetired ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  Retired
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Modals */}
      <AddGearModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { mutate(); setShowAdd(false); }}
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
        onEdit={canEdit ? (item) => { setDetailItem(null); setEditItem(item); } : undefined}
      />
      <EditGearModal
        item={editItem}
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onUpdated={() => { mutate(); setEditItem(null); }}
      />
    </div>
  );
}

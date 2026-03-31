"use client";

import { useState } from "react";
import useSWR from "swr";
import type { GearItem, GearStatus, GearCondition } from "@/types/domain";
import { PROPS_CATEGORIES } from "@/lib/constants/categories";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AddPropModal } from "@/components/props/add-prop-modal";
import { EditPropModal } from "@/components/props/edit-prop-modal";
import { PropDetailModal } from "@/components/props/prop-detail-modal";
import {
  Plus,
  Search,
  Boxes,
  Camera,
  Calendar,
  LayoutGrid,
  List,
} from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

const STATUS_BADGE: Record<string, string> = {
  Available: "bg-emerald-50 text-emerald-700",
  Reserved: "bg-blue-50 text-blue-700",
  "Checked Out": "bg-amber-50 text-amber-700",
  Retired: "bg-slate-100 text-slate-500",
};

type Tab = "items" | "reservations";

export default function PropsPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<GearItem | null>(null);
  const [detailItem, setDetailItem] = useState<GearItem | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<GearItem | null>(null);
  const [checkinItem, setCheckinItem] = useState<GearItem | null>(null);

  const params = new URLSearchParams({ section: "Props" });
  if (search) params.set("search", search);
  if (categoryFilter) params.set("category", categoryFilter);
  const qs = params.toString();

  const { data: rawItems, isLoading, mutate } = useSWR<GearItem[]>(
    `/api/gear?${qs}`,
    fetcher
  );
  const items: GearItem[] = Array.isArray(rawItems) ? rawItems : [];

  const canEdit = user?.role === "Admin" || user?.role === "Producer" || user?.role === "Studio";

  const availableCount = items.filter((i) => i.status === "Available").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Props</h2>
          <p className="text-sm text-text-secondary">
            {items.length} item{items.length !== 1 ? "s" : ""} · {availableCount} available
          </p>
        </div>
        {canEdit && tab === "items" && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add Prop
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

      {tab === "items" && (
        <>
          {/* Search + filter bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative min-w-[180px] max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search props..."
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
                    title="Add prop"
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
                  !categoryFilter ? "bg-text-primary text-white" : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}
              >
                All
              </button>
              {PROPS_CATEGORIES.map((cat) => (
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

          {/* Items */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Boxes className="h-5 w-5" />}
              title={search || categoryFilter ? "No props match your filters" : "No props yet"}
              description={
                search || categoryFilter
                  ? "Try adjusting your search or category filter."
                  : "Add props like surfaces, tableware, linens, and decorative items."
              }
              action={
                canEdit && !search && !categoryFilter ? (
                  <Button size="sm" onClick={() => setShowAdd(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Prop
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
                      className="h-28 w-full rounded-lg object-cover mb-3"
                    />
                  ) : null}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">{item.category}</p>
                    </div>
                    <Badge variant="custom" className={STATUS_BADGE[item.status] || ""}>
                      {item.status}
                    </Badge>
                  </div>
                  {canEdit && item.status === "Available" && (
                    <div className="mt-3 pt-3 border-t border-border-light">
                      <button
                        onClick={(e) => { e.stopPropagation(); setCheckoutItem(item); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Check Out
                      </button>
                    </div>
                  )}
                  {canEdit && item.status === "Checked Out" && (
                    <div className="mt-3 pt-3 border-t border-border-light">
                      <button
                        onClick={(e) => { e.stopPropagation(); setCheckinItem(item); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Check In
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_160px_120px_80px] gap-0 bg-surface-secondary border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                <div>Name</div>
                <div>Category</div>
                <div>Condition</div>
                <div>Status</div>
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setDetailItem(item)}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px_80px] gap-0 px-4 py-3 border-b border-border-light last:border-b-0 hover:bg-surface-secondary cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-7 w-7 rounded object-cover shrink-0" />
                    ) : null}
                    <span className="text-sm font-medium text-text-primary truncate">{item.name}</span>
                  </div>
                  <div className="hidden sm:flex items-center">
                    <span className="text-xs text-text-secondary">{item.category}</span>
                  </div>
                  <div className="hidden sm:flex items-center">
                    <span className="text-xs text-text-secondary">{item.condition}</span>
                  </div>
                  <div className="hidden sm:flex items-center">
                    <Badge variant="custom" className={`text-[10px] ${STATUS_BADGE[item.status] || ""}`}>
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "reservations" && (
        <ReservationsTab items={items} canEdit={canEdit} onMutate={mutate} />
      )}

      {/* Modals */}
      <AddPropModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => { setShowAdd(false); mutate(); }}
      />
      <EditPropModal
        item={editingItem}
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onUpdated={() => { setEditingItem(null); mutate(); }}
        onRetired={() => { setEditingItem(null); mutate(); }}
      />
      <PropDetailModal
        item={detailItem}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={(item) => { setDetailItem(null); setEditingItem(item); }}
      />
      {checkoutItem && (
        <CheckoutModal
          item={checkoutItem}
          onClose={() => setCheckoutItem(null)}
          onDone={() => { setCheckoutItem(null); mutate(); }}
        />
      )}
      {checkinItem && (
        <CheckinModal
          item={checkinItem}
          onClose={() => setCheckinItem(null)}
          onDone={() => { setCheckinItem(null); mutate(); }}
        />
      )}
    </div>
  );
}

// --- Checkout Modal ---
function CheckoutModal({
  item,
  onClose,
  onDone,
}: {
  item: GearItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState<string>("Good");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          gearItemId: item.id,
          condition,
          notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to check out");
      toast("success", `${item.name} checked out`);
      onDone();
    } catch {
      toast("error", "Failed to check out");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Check Out — ${item.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          options={["Excellent", "Good", "Fair", "Poor", "Damaged"].map((c) => ({ value: c, label: c }))}
        />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Which shoot, any handling notes..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Check Out</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// --- Checkin Modal ---
function CheckinModal({
  item,
  onClose,
  onDone,
}: {
  item: GearItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState<string>("Good");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin_by_item",
          gearItemId: item.id,
          condition,
          notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to check in");
      toast("success", `${item.name} checked in`);
      onDone();
    } catch {
      toast("error", "Failed to check in");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`Check In — ${item.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Condition on return"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          options={["Excellent", "Good", "Fair", "Poor", "Damaged"].map((c) => ({ value: c, label: c }))}
        />
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any damage or notes on return..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Check In</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// --- Reservations Tab ---
function ReservationsTab({
  items,
  canEdit,
  onMutate,
}: {
  items: GearItem[];
  canEdit: boolean;
  onMutate: () => void;
}) {
  const { data: rawReservations, isLoading, mutate } = useSWR(
    "/api/gear/reservations",
    fetcher
  );
  const reservations = Array.isArray(rawReservations) ? rawReservations : [];
  const { toast } = useToast();
  const [showReserve, setShowReserve] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter reservations to only Props items
  const propsItemIds = new Set(items.map((i) => i.id));
  const propsReservations = reservations.filter((r: { gearItemId: string }) =>
    propsItemIds.has(r.gearItemId)
  );

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItemId || !startDate || !endDate) {
      toast("error", "Fill in all fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/gear/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gearItemId: selectedItemId, startDate, endDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reserve");
      }
      toast("success", "Prop reserved");
      setShowReserve(false);
      setSelectedItemId("");
      setStartDate("");
      setEndDate("");
      mutate();
      onMutate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to reserve");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {propsReservations.length} active reservation{propsReservations.length !== 1 ? "s" : ""}
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setShowReserve(true)}>
            <Calendar className="h-3.5 w-3.5" />
            Reserve Prop
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : propsReservations.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-5 w-5" />}
          title="No reservations"
          description="Reserve props for upcoming shoots to make sure they're available."
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setShowReserve(true)}>
                <Plus className="h-3.5 w-3.5" />
                Reserve Prop
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {propsReservations.map((r: { id: string; gearItemId: string; startDate: string; endDate: string; gearItem?: { name: string } }) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {r.gearItem?.name || items.find((i) => i.id === r.gearItemId)?.name || "Unknown"}
                </p>
                <p className="text-xs text-text-tertiary">
                  {r.startDate} → {r.endDate}
                </p>
              </div>
              <Badge variant="custom" className="bg-blue-50 text-blue-700">Confirmed</Badge>
            </div>
          ))}
        </div>
      )}

      {showReserve && (
        <Modal open={true} onClose={() => setShowReserve(false)} title="Reserve Prop" size="sm">
          <form onSubmit={handleReserve} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Prop</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a prop...</option>
                {items.filter((i) => i.status === "Available").map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
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

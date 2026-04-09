"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { ShootMeal, MealType, MealLocation, MealHandlerRole, MealStatus } from "@/types/domain";
import {
  Utensils,
  Plus,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Users,
  Edit2,
  Trash2,
  Coffee,
  Sun,
  Sunset,
  Moon,
  ShoppingBag,
} from "lucide-react";
import { format, addDays, parseISO } from "date-fns";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

// ─── Constants ───────────────────────────────────────────────────────────────

const MEAL_TYPES: { value: MealType; label: string; icon: React.ElementType }[] = [
  { value: "crafty",    label: "Crafty",    icon: ShoppingBag },
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch",     label: "Lunch",     icon: Sun },
  { value: "dinner",    label: "Dinner",    icon: Moon },
  { value: "snacks",    label: "Snacks",    icon: Sunset },
];

const MEAL_STATUS_STYLES: Record<MealStatus, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-slate-50 text-slate-600 border-slate-200" },
  ordered:   { label: "Ordered",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "Confirmed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  received:  { label: "Received",  className: "bg-violet-50 text-violet-700 border-violet-200" },
  set:       { label: "Set",       className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const STATUS_ORDER: MealStatus[] = ["pending", "ordered", "confirmed", "received", "set"];

function nextStatus(s: MealStatus): MealStatus | null {
  const idx = STATUS_ORDER.indexOf(s);
  return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}

// ─── Meal form modal ──────────────────────────────────────────────────────────

interface MealFormProps {
  campaignId: string;
  shootDate: string;
  meal: ShootMeal | null;
  defaultHandlerRole: MealHandlerRole;
  onClose: () => void;
  onSaved: () => void;
}

function MealFormModal({ campaignId, shootDate, meal, defaultHandlerRole, onClose, onSaved }: MealFormProps) {
  const { toast } = useToast();
  const [mealType, setMealType] = useState<MealType>(meal?.mealType ?? "crafty");
  const [location, setLocation] = useState<MealLocation>(meal?.location ?? "greenroom");
  const [handlerRole, setHandlerRole] = useState<MealHandlerRole>(meal?.handlerRole ?? defaultHandlerRole);
  const [headcount, setHeadcount] = useState(meal?.headcount?.toString() ?? "");
  const [dietary, setDietary] = useState(meal?.dietaryNotes ?? "");
  const [prefs, setPrefs] = useState(meal?.preferences ?? "");
  const [vendor, setVendor] = useState(meal?.vendor ?? "");
  const [deliveryTime, setDeliveryTime] = useState(meal?.deliveryTime ?? "");
  const [notes, setNotes] = useState(meal?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        campaignId,
        shootDate,
        mealType,
        location,
        handlerRole,
        headcount: headcount ? parseInt(headcount) : null,
        dietaryNotes: dietary || null,
        preferences: prefs || null,
        vendor: vendor || null,
        deliveryTime: deliveryTime || null,
        notes: notes || null,
      };

      if (meal) {
        const res = await fetch("/api/shoot-meals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: meal.id, ...payload }),
        });
        if (!res.ok) throw new Error("Failed to save");
      } else {
        const res = await fetch("/api/shoot-meals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to save");
      }

      toast("success", meal ? "Meal updated" : "Meal added");
      onSaved();
      onClose();
    } catch {
      toast("error", "Failed to save meal");
    } finally {
      setSaving(false);
    }
  }

  const MealIcon = MEAL_TYPES.find((m) => m.value === mealType)?.icon ?? Utensils;

  return (
    <Modal
      open
      onClose={onClose}
      title={meal ? "Edit Meal" : "Add Meal / Crafty"}
    >
      <div className="space-y-4">
        {/* Type + Location row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {MEAL_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setMealType(value)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                    mealType === value
                      ? "bg-primary text-white border-primary"
                      : "bg-surface border-border text-text-secondary hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Location</label>
            <div className="flex gap-1.5">
              {(["greenroom", "outside"] as MealLocation[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocation(loc)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-all ${
                    location === loc
                      ? "bg-primary text-white border-primary"
                      : "bg-surface border-border text-text-secondary hover:border-primary/40"
                  }`}
                >
                  {loc === "greenroom" ? "Greenroom" : "Outside"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Handler */}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Handled by</label>
          <div className="flex gap-1.5">
            {(["studio", "producer"] as MealHandlerRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setHandlerRole(role)}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-all ${
                  handlerRole === role
                    ? "bg-primary text-white border-primary"
                    : "bg-surface border-border text-text-secondary hover:border-primary/40"
                }`}
              >
                {role === "studio" ? "Studio Manager" : "Producer"}
              </button>
            ))}
          </div>
        </div>

        {/* Crew details */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Headcount</label>
            <input
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              placeholder="e.g. 12"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Delivery / Setup time</label>
            <input
              type="time"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Dietary restrictions</label>
          <input
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            placeholder="Gluten-free, vegan, nut allergy..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Preferences (nice-to-haves)</label>
          <input
            value={prefs}
            onChange={(e) => setPrefs(e.target.value)}
            placeholder="Fresh fruit, coffee station, specific cuisine..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Vendor / Caterer</label>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Publix Catering, local restaurant..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional details..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : meal ? "Save Changes" : "Add Meal"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ─── Meal card ────────────────────────────────────────────────────────────────

interface MealCardProps {
  meal: ShootMeal;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusAdvance: () => void;
}

function MealCard({ meal, canEdit, onEdit, onDelete, onStatusAdvance }: MealCardProps) {
  const { label: statusLabel, className: statusClass } = MEAL_STATUS_STYLES[meal.status];
  const MealIcon = MEAL_TYPES.find((m) => m.value === meal.mealType)?.icon ?? Utensils;
  const next = nextStatus(meal.status);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border">
        <MealIcon className="h-4 w-4 text-text-secondary" />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-primary capitalize">{meal.mealType}</span>
          <Badge
            variant="custom"
            className={`text-[10px] border ${statusClass}`}
          >
            {statusLabel}
          </Badge>
          <Badge
            variant="custom"
            className={`text-[10px] border ${meal.location === "greenroom" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
          >
            {meal.location === "greenroom" ? "Greenroom" : "Outside"}
          </Badge>
          <span className="text-[10px] text-text-tertiary capitalize ml-auto">
            {meal.handlerRole === "studio" ? "Studio Manager" : "Producer"}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
          {meal.headcount && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {meal.headcount} people
            </span>
          )}
          {meal.deliveryTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {meal.deliveryTime}
            </span>
          )}
          {meal.vendor && (
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              {meal.vendor}
            </span>
          )}
        </div>

        {meal.dietaryNotes && (
          <p className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">Restrictions:</span> {meal.dietaryNotes}
          </p>
        )}
        {meal.preferences && (
          <p className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">Preferences:</span> {meal.preferences}
          </p>
        )}
        {meal.notes && (
          <p className="text-xs text-text-tertiary italic">{meal.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {next && canEdit && (
          <button
            onClick={onStatusAdvance}
            title={`Mark as ${MEAL_STATUS_STYLES[next].label}`}
            className="rounded-md p-1.5 text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        {canEdit && (
          <>
            <button
              onClick={onEdit}
              className="rounded-md p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-md p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shoot day block ──────────────────────────────────────────────────────────

interface ShootDayBlockProps {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  shootDate: string;
  meals: ShootMeal[];
  userRole: string;
  onRefresh: () => void;
}

function ShootDayBlock({
  campaignId,
  campaignName,
  wfNumber,
  shootDate,
  meals,
  userRole,
  onRefresh,
}: ShootDayBlockProps) {
  const { toast } = useToast();
  const [addModal, setAddModal] = useState(false);
  const [editMeal, setEditMeal] = useState<ShootMeal | null>(null);
  const [expanded, setExpanded] = useState(true);

  const defaultHandlerRole: MealHandlerRole =
    userRole === "Studio" ? "studio" : "producer";

  const totalHeadcount = meals.reduce((acc, m) => {
    if (m.mealType !== "crafty" && m.headcount) return Math.max(acc, m.headcount);
    return acc;
  }, 0);

  const hasRestrictions = meals.some((m) => m.dietaryNotes);
  const pendingCount = meals.filter((m) => m.status === "pending").length;

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/shoot-meals?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast("success", "Meal removed");
      onRefresh();
    } catch {
      toast("error", "Failed to remove meal");
    }
  }

  async function handleStatusAdvance(meal: ShootMeal) {
    const next = nextStatus(meal.status);
    if (!next) return;
    try {
      await fetch("/api/shoot-meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meal.id, status: next }),
      });
      onRefresh();
    } catch {
      toast("error", "Failed to update status");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-border hover:bg-surface-secondary/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Utensils className="h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              {format(parseISO(shootDate), "EEE, MMM d")}
            </span>
            <span className="text-xs text-text-tertiary">
              {wfNumber} — {campaignName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <Badge variant="custom" className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
              {pendingCount} pending
            </Badge>
          )}
          {totalHeadcount > 0 && (
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Users className="h-3 w-3" />
              {totalHeadcount}
            </span>
          )}
          {hasRestrictions && (
            <AlertCircle className="h-4 w-4 text-amber-500" aria-label="Dietary restrictions present" />
          )}
          <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="p-3.5 space-y-2">
          {meals.length === 0 ? (
            <p className="text-xs text-text-tertiary italic text-center py-2">No meals or crafty added yet.</p>
          ) : (
            meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                canEdit={
                  userRole === "Admin" ||
                  (userRole === "Studio" && meal.handlerRole === "studio") ||
                  (userRole === "Producer" && meal.handlerRole === "producer")
                }
                onEdit={() => setEditMeal(meal)}
                onDelete={() => handleDelete(meal.id)}
                onStatusAdvance={() => handleStatusAdvance(meal)}
              />
            ))
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1"
            onClick={() => setAddModal(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add meal or crafty
          </Button>
        </div>
      )}

      {/* Modals */}
      {addModal && (
        <MealFormModal
          campaignId={campaignId}
          shootDate={shootDate}
          meal={null}
          defaultHandlerRole={defaultHandlerRole}
          onClose={() => setAddModal(false)}
          onSaved={onRefresh}
        />
      )}
      {editMeal && (
        <MealFormModal
          campaignId={campaignId}
          shootDate={shootDate}
          meal={editMeal}
          defaultHandlerRole={defaultHandlerRole}
          onClose={() => setEditMeal(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}

// ─── Campaign group ───────────────────────────────────────────────────────────

interface CampaignGroup {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  days: Map<string, ShootMeal[]>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ViewFilter = "all" | "greenroom" | "outside";

export default function FoodCraftyPage() {
  const { user, isLoading } = useCurrentUser();
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [dateRange, setDateRange] = useState<"upcoming" | "past">("upcoming");

  const now = new Date();
  const dateFrom = dateRange === "upcoming" ? format(now, "yyyy-MM-dd") : format(addDays(now, -60), "yyyy-MM-dd");
  const dateTo   = dateRange === "upcoming" ? format(addDays(now, 60), "yyyy-MM-dd") : format(now, "yyyy-MM-dd");
  const locationParam = viewFilter !== "all" ? `&location=${viewFilter}` : "";

  const { data: meals, isLoading: loadingMeals, mutate: refreshMeals } =
    useSWR<ShootMeal[]>(
      `/api/shoot-meals?dateFrom=${dateFrom}&dateTo=${dateTo}${locationParam}`,
      fetcher
    );

  // Group by campaign → shoot date
  const campaignGroups = useMemo<CampaignGroup[]>(() => {
    if (!meals) return [];
    const map = new Map<string, CampaignGroup>();
    meals.forEach((m) => {
      const cg = map.get(m.campaignId) ?? {
        campaignId: m.campaignId,
        campaignName: m.campaign?.name ?? "Unknown",
        wfNumber: m.campaign?.wfNumber ?? "",
        days: new Map(),
      };
      const dayMeals = cg.days.get(m.shootDate) ?? [];
      dayMeals.push(m);
      cg.days.set(m.shootDate, dayMeals);
      map.set(m.campaignId, cg);
    });
    // Sort days within each campaign
    map.forEach((cg) => {
      cg.days = new Map([...cg.days.entries()].sort(([a], [b]) => a.localeCompare(b)));
    });
    return [...map.values()].sort((a, b) => {
      const aFirst = a.days.keys().next().value ?? "";
      const bFirst = b.days.keys().next().value ?? "";
      return aFirst.localeCompare(bFirst);
    });
  }, [meals]);

  if (isLoading || !user) return <DashboardSkeleton />;

  const totalPending = (meals ?? []).filter((m) => m.status === "pending").length;
  const uniqueHeadcounts = (meals ?? [])
    .filter((m) => m.mealType !== "crafty" && m.headcount)
    .map((m) => m.headcount as number);
  const maxHeadcount = uniqueHeadcounts.length ? Math.max(...uniqueHeadcounts) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Food & Crafty</h2>
        <p className="text-sm text-text-secondary">Meal coordination for all shoots</p>
      </div>

      {/* Summary chips */}
      {(meals ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totalPending > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <AlertCircle className="h-3 w-3" />
              {totalPending} pending
            </div>
          )}
          {maxHeadcount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-medium text-text-secondary">
              <Users className="h-3 w-3" />
              Up to {maxHeadcount} crew
            </div>
          )}
          {(meals ?? []).some((m) => m.dietaryNotes) && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              <AlertCircle className="h-3 w-3" />
              Dietary restrictions on file
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-surface-secondary p-1">
          {(["upcoming", "past"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                dateRange === r
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {r === "upcoming" ? "Upcoming" : "Past 60 days"}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-xl bg-surface-secondary p-1">
          {(["all", "greenroom", "outside"] as ViewFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setViewFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                viewFilter === f
                  ? "bg-surface text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {f === "greenroom" && <MapPin className="h-3.5 w-3.5" />}
              {f === "all" ? "All Locations" : f === "greenroom" ? "Greenroom" : "Outside"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loadingMeals ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-surface-secondary animate-pulse" />)}
        </div>
      ) : campaignGroups.length === 0 ? (
        <EmptyState
          icon={<Utensils className="h-5 w-5" />}
          title="No meals logged yet"
          description="Add meals and crafty from the campaign pre-production page, or use the buttons within each shoot day."
        />
      ) : (
        <div className="space-y-8">
          {campaignGroups.map((group) => (
            <div key={group.campaignId} className="space-y-3">
              {/* Campaign header */}
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  {group.wfNumber} — {group.campaignName}
                </h3>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Shoot days */}
              {[...group.days.entries()].map(([date, dayMeals]) => (
                <ShootDayBlock
                  key={date}
                  campaignId={group.campaignId}
                  campaignName={group.campaignName}
                  wfNumber={group.wfNumber}
                  shootDate={date}
                  meals={dayMeals}
                  userRole={user.role}
                  onRefresh={() => refreshMeals()}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

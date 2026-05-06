"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MEAL_TYPES } from "@/lib/constants/meals";
import type { ShootMeal, MealType, MealLocation, MealHandlerRole, MealCrewSuggestion } from "@/types/domain";
import { Sparkles, Plus, Trash2, GripVertical } from "lucide-react";

export interface MealFormModalProps {
  campaignId: string;
  shootDate: string;
  meal: ShootMeal | null;
  defaultHandlerRole: MealHandlerRole;
  onClose: () => void;
  onSaved: () => void;
}

export function MealFormModal({ campaignId, shootDate, meal, defaultHandlerRole, onClose, onSaved }: MealFormModalProps) {
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
  const [items, setItems] = useState<{ name: string; quantity: string; notes: string }[]>(
    meal?.items?.length
      ? meal.items.map((it) => ({
          name: it.name,
          quantity: it.quantity ?? "",
          notes: it.notes ?? "",
        }))
      : []
  );
  const [saving, setSaving] = useState(false);
  const [pulling, setPulling] = useState(false);

  async function pullFromCrew() {
    setPulling(true);
    try {
      const res = await fetch(
        `/api/shoot-meals/suggest?campaignId=${campaignId}&shootDate=${shootDate}`
      );
      if (!res.ok) throw new Error("Failed");
      const sug = (await res.json()) as MealCrewSuggestion;
      if (!sug.headcount) {
        toast("info", "No crew assigned to this date yet");
        return;
      }
      setHeadcount(String(sug.headcount));
      if (sug.dietaryNotes) setDietary(sug.dietaryNotes);
      if (sug.preferences) setPrefs(sug.preferences);
      toast("success", `Pulled ${sug.headcount} crew member${sug.headcount === 1 ? "" : "s"}`);
    } catch {
      toast("error", "Couldn't pull crew details");
    } finally {
      setPulling(false);
    }
  }

  function addItem() {
    setItems((prev) => [...prev, { name: "", quantity: "", notes: "" }]);
  }
  function updateItem(idx: number, key: "name" | "quantity" | "notes", value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const cleanItems = items
        .map((it) => ({
          name: it.name.trim(),
          quantity: it.quantity.trim() || null,
          notes: it.notes.trim() || null,
        }))
        .filter((it) => it.name.length > 0);

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
        items: cleanItems,
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

        {/* Pull from crew */}
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-surface-secondary px-3 py-2">
          <div className="text-xs text-text-secondary">
            Pull crew count + dietary restrictions from the crew assigned to this day.
          </div>
          <button
            type="button"
            onClick={pullFromCrew}
            disabled={pulling}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:border-primary/40 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            {pulling ? "Pulling..." : "Pull from crew"}
          </button>
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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Delivery / Setup time</label>
            <input
              type="time"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none/40"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Dietary restrictions</label>
          <input
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            placeholder="Gluten-free, vegan, nut allergy..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none/40"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Preferences (nice-to-haves)</label>
          <input
            value={prefs}
            onChange={(e) => setPrefs(e.target.value)}
            placeholder="Fresh fruit, coffee station, specific cuisine..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none/40"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Vendor / Caterer</label>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Publix Catering, DoorDash, local restaurant..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none/40"
          />
        </div>

        {/* Items / order list */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text-secondary">Order items</label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              <Plus className="h-3 w-3" />
              Add item
            </button>
          </div>
          {items.length === 0 ? (
            <button
              type="button"
              onClick={addItem}
              className="w-full rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-xs text-text-tertiary hover:border-primary/40 hover:text-text-secondary"
            >
              No items yet. Click to add what you're ordering.
            </button>
          ) : (
            <div className="space-y-1.5">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <GripVertical className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  <input
                    value={it.name}
                    onChange={(e) => updateItem(idx, "name", e.target.value)}
                    placeholder="Turkey wraps"
                    className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:outline-none/40"
                  />
                  <input
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                    placeholder="Qty"
                    className="w-20 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:outline-none/40"
                  />
                  <input
                    value={it.notes}
                    onChange={(e) => updateItem(idx, "notes", e.target.value)}
                    placeholder="Notes"
                    className="w-32 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm focus:outline-none/40"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="rounded-md p-1 text-text-tertiary hover:text-red-500 hover:bg-red-50"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any additional details..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm resize-none focus:outline-none/40"
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

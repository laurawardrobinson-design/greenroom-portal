"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { MEAL_TYPES } from "@/lib/constants/meals";
import type { ShootMeal, MealType, MealLocation, MealHandlerRole } from "@/types/domain";
import { Utensils, MapPin } from "lucide-react";

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

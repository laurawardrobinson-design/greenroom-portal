import {
  Coffee,
  Sun,
  Moon,
  Sunset,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import type { MealType, MealStatus } from "@/types/domain";

export const MEAL_TYPES: { value: MealType; label: string; icon: React.ElementType }[] = [
  { value: "crafty",    label: "Crafty",    icon: ShoppingBag },
  { value: "breakfast", label: "Breakfast", icon: Coffee },
  { value: "lunch",     label: "Lunch",     icon: Sun },
  { value: "dinner",    label: "Dinner",    icon: Moon },
  { value: "snacks",    label: "Snacks",    icon: Sunset },
];

export const MEAL_STATUS_STYLES: Record<MealStatus, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-slate-50 text-slate-600 border-slate-200" },
  ordered:   { label: "Ordered",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  confirmed: { label: "Confirmed", className: "bg-amber-50 text-amber-700 border-amber-200" },
  received:  { label: "Received",  className: "bg-violet-50 text-violet-700 border-violet-200" },
  set:       { label: "Set",       className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const STATUS_ORDER: MealStatus[] = ["pending", "ordered", "confirmed", "received", "set"];

export function nextStatus(s: MealStatus): MealStatus | null {
  const idx = STATUS_ORDER.indexOf(s);
  return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}

export function getMealIcon(mealType: MealType) {
  return MEAL_TYPES.find((m) => m.value === mealType)?.icon ?? Utensils;
}

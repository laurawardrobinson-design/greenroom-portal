import {
  Camera,
  ChefHat,
  Shirt,
  Package,
  Layers,
  Users,
  Box,
  Building2,
} from "lucide-react";

export const SPACE_TYPE_ICON: Record<string, React.ElementType> = {
  shooting_bay:      Camera,
  set_kitchen:       ChefHat,
  prep_kitchen:      ChefHat,
  wardrobe:          Shirt,
  multipurpose:      Layers,
  conference:        Users,
  equipment_storage: Package,
  prop_storage:      Box,
};

export const SPACE_TYPE_COLOR: Record<string, string> = {
  shooting_bay:      "bg-violet-50 text-violet-700 border-violet-200",
  set_kitchen:       "bg-amber-50 text-amber-700 border-amber-200",
  prep_kitchen:      "bg-orange-50 text-orange-700 border-orange-200",
  wardrobe:          "bg-pink-50 text-pink-700 border-pink-200",
  multipurpose:      "bg-blue-50 text-blue-700 border-blue-200",
  conference:        "bg-teal-50 text-teal-700 border-teal-200",
  equipment_storage: "bg-slate-50 text-slate-600 border-slate-200",
  prop_storage:      "bg-stone-50 text-stone-600 border-stone-200",
};

export const SPACE_TYPE_LABELS: Record<string, string> = {
  shooting_bay:      "Shooting Bay",
  set_kitchen:       "Set Kitchen",
  prep_kitchen:      "Prep Kitchen",
  wardrobe:          "Wardrobe",
  multipurpose:      "Multipurpose",
  conference:        "Conference",
  equipment_storage: "Equipment Storage",
  prop_storage:      "Prop Storage",
};

export function getSpaceIcon(type: string) {
  return SPACE_TYPE_ICON[type] ?? Building2;
}

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
  shooting_bay:      "bg-slate-100 text-slate-700 border-slate-200",
  set_kitchen:       "bg-stone-100 text-stone-700 border-stone-200",
  prep_kitchen:      "bg-stone-100 text-stone-700 border-stone-200",
  wardrobe:          "bg-slate-100 text-slate-700 border-slate-200",
  multipurpose:      "bg-slate-100 text-slate-700 border-slate-200",
  conference:        "bg-slate-100 text-slate-700 border-slate-200",
  equipment_storage: "bg-slate-50 text-slate-500 border-slate-200",
  prop_storage:      "bg-slate-50 text-slate-500 border-slate-200",
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

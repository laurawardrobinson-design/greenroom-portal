import type { CostCategory, GearCategory } from "@/types/domain";

export const PROPS_CATEGORIES = [
  "Surfaces & Backgrounds",
  "Tableware",
  "Linens & Textiles",
  "Cookware & Small Wares",
  "Decorative Items",
  "Furniture",
  "Other",
] as const;

export type PropsCategory = typeof PROPS_CATEGORIES[number];

export const COST_CATEGORIES: CostCategory[] = [
  "Talent",
  "Styling",
  "Equipment Rental",
  "Studio Space",
  "Post-Production",
  "Travel",
  "Catering",
  "Props",
  "Wardrobe",
  "Set Design",
  "Other",
];

export const GEAR_CATEGORIES: GearCategory[] = [
  "Camera",
  "Lens",
  "Lighting",
  "Audio",
  "Tripod / Support",
  "Grip",
  "Accessories",
  "Other",
];

export const VENDOR_CATEGORIES = [
  "Food Stylist",
  "Photographer",
  "Videographer",
  "Production Company",
  "Studio",
  "Makeup Artist",
  "Prop Stylist",
  "Retoucher",
  "Set Designer",
  "Talent Agency",
  "Catering",
  "Other",
] as const;

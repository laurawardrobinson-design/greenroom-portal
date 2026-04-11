import { z } from "zod";

export const WARDROBE_CATEGORIES = [
  "Tops",
  "Aprons",
  "Headwear",
  "Bottoms",
  "Outerwear",
  "Footwear",
  "Accessories",
  "Other",
] as const;

export const UNIT_SIZES = [
  "XS", "S", "M", "L", "XL", "2XL", "3XL", "One Size", "Other",
] as const;

export const UNIT_GENDERS = ["Men's", "Women's", "Unisex"] as const;

// ── Wardrobe item type schema (no size/gender/status at type level) ────────────
export const createWardrobeSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  category: z.enum(WARDROBE_CATEGORIES),
  description: z.string().default(""),
  shootingNotes: z.string().default(""),
  restrictions: z.string().default(""),
  guideUrl: z.string().url().nullable().default(null),
  imageUrl: z.string().url().nullable().default(null),
  qrCode: z.string().nullable().default(null),
});

export const updateWardrobeSchema = createWardrobeSchema.partial();

// ── Wardrobe unit schema (physical backstock) ──────────────────────────────────
export const createUnitSchema = z.object({
  wardrobeItemId: z.string().uuid("Valid item ID required"),
  size: z.enum(UNIT_SIZES).default("One Size"),
  gender: z.enum(UNIT_GENDERS).default("Unisex"),
  condition: z.enum(["Excellent", "Good", "Fair", "Poor", "Damaged"]).default("Good"),
  qrCode: z.string().nullable().default(null),
  notes: z.string().default(""),
  quantity: z.number().int().min(1).max(50).default(1),
});

export const updateUnitSchema = createUnitSchema
  .omit({ wardrobeItemId: true, quantity: true })
  .extend({ status: z.enum(["Available", "Reserved", "Checked Out"]).optional() })
  .partial();

export type CreateWardrobeInput = z.infer<typeof createWardrobeSchema>;
export type UpdateWardrobeInput = z.infer<typeof updateWardrobeSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

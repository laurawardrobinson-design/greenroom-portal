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

export type CreateWardrobeInput = z.infer<typeof createWardrobeSchema>;
export type UpdateWardrobeInput = z.infer<typeof updateWardrobeSchema>;

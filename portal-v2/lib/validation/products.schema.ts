import { z } from "zod";

export const PRODUCT_DEPARTMENTS = [
  "Deli",
  "Bakery",
  "Meat-Seafood",
  "Produce",
  "Grocery",
  "Other",
] as const;

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  department: z.enum(PRODUCT_DEPARTMENTS),
  itemCode: z.string().nullable().default(null),
  description: z.string().default(""),
  shootingNotes: z.string().default(""),
  restrictions: z.string().default(""),
  pcomLink: z.string().url().nullable().default(null),
  rpGuideUrl: z.string().url().nullable().default(null),
  imageUrl: z.string().url().nullable().default(null),
});

export const updateProductSchema = createProductSchema.partial();

export const linkProductToCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  productId: z.string().uuid(),
  notes: z.string().default(""),
  sortOrder: z.number().int().min(0).default(0),
});

export const linkGearToCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  gearItemId: z.string().uuid(),
  notes: z.string().default(""),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

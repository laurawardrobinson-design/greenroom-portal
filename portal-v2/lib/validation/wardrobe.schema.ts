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

// ── Reservation schema ─────────────────────────────────────────────────────────
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date must be YYYY-MM-DD");

export const createReservationSchema = z.object({
  wardrobeItemId: z.string().uuid("Valid item ID required"),
  startDate: dateString,
  endDate: dateString,
  campaignId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const updateReservationSchema = z
  .object({
    startDate: dateString,
    endDate: dateString,
    campaignId: z.string().uuid().nullable(),
    notes: z.string(),
    status: z.enum(["Active", "Completed", "Cancelled"]),
  })
  .partial();

// ── Checkout schema ────────────────────────────────────────────────────────────
export const createCheckoutSchema = z.object({
  unitId: z.string().uuid("Valid unit ID required"),
  reservationId: z.string().uuid().optional(),
  expectedReturnDate: dateString.optional(),
  notes: z.string().optional(),
});

// ── Wardrobe action schemas (main route: POST /api/wardrobe with { action }) ───
export const WARDROBE_CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Damaged"] as const;

export const checkoutActionSchema = z.object({
  wardrobeItemId: z.string().uuid("Valid item ID required"),
  campaignId: z.string().uuid().optional(),
  condition: z.enum(WARDROBE_CONDITIONS).optional(),
  notes: z.string().optional(),
  dueDate: dateString.optional(),
});

export const checkinActionSchema = z.object({
  checkoutId: z.string().uuid("Valid checkout ID required"),
  condition: z.enum(WARDROBE_CONDITIONS).optional(),
  notes: z.string().optional(),
});

export const checkinByItemActionSchema = z.object({
  wardrobeItemId: z.string().uuid("Valid item ID required"),
  condition: z.enum(WARDROBE_CONDITIONS).optional(),
  notes: z.string().optional(),
});

export const batchCheckoutActionSchema = z.object({
  items: z
    .array(
      z.object({
        wardrobeItemId: z.string().uuid(),
        condition: z.enum(WARDROBE_CONDITIONS).optional(),
      })
    )
    .min(1, "At least one item required"),
  campaignId: z.string().uuid().optional(),
  dueDate: dateString.optional(),
});

export const batchCheckinActionSchema = z.object({
  wardrobeItemIds: z.array(z.string().uuid()).min(1, "At least one item required"),
  condition: z.enum(WARDROBE_CONDITIONS).optional(),
});

export type CreateWardrobeInput = z.infer<typeof createWardrobeSchema>;
export type UpdateWardrobeInput = z.infer<typeof updateWardrobeSchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

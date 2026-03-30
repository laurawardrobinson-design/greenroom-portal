import { z } from "zod";

// --- Campaign schemas ---

export const createCampaignSchema = z.object({
  wfNumber: z.string().default(""),
  name: z.string().min(1, "Campaign name is required"),
  status: z
    .enum([
      "Planning",
      "In Production",
      "Post",
      "Complete",
      "Cancelled",
    ])
    .default("Planning"),
  productionBudget: z.number().min(0).default(0),
  budgetPoolId: z.string().uuid().nullable().default(null),
  assetsDeliveryDate: z.string().nullable().default(null),
  notes: z.string().default(""),
});

export const updateCampaignSchema = z.object({
  wfNumber: z.string().optional(),
  name: z.string().min(1, "Campaign name is required").optional(),
  status: z
    .enum([
      "Planning",
      "In Production",
      "Post",
      "Complete",
      "Cancelled",
    ])
    .optional(),
  productionBudget: z.number().min(0).optional(),
  budgetPoolId: z.string().uuid().nullable().optional(),
  assetsDeliveryDate: z.string().nullable().optional(),
  notes: z.string().optional(),
  producerId: z.string().uuid().nullable().optional(),
});

export const campaignStatusSchema = z.enum([
  "Planning",
  "In Production",
  "Post",
  "Complete",
  "Cancelled",
]);

// --- Shoot schemas ---

export const shootDateSchema = z.object({
  shootDate: z.string().refine(
    (date) => {
      const shootDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return shootDate >= today;
    },
    "Shoot date must be today or in the future"
  ),
  callTime: z.string().nullable().optional(),
  location: z.string().default(""),
  notes: z.string().default(""),
});

export const createShootSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().default(""),
  shootType: z.enum(["Photo", "Video", "Hybrid", "Other"]).default("Photo"),
  location: z.string().default(""),
  notes: z.string().default(""),
  dates: z.array(shootDateSchema).default([]),
});

export const updateShootSchema = z.object({
  name: z.string().optional(),
  shootType: z.enum(["Photo", "Video", "Hybrid", "Other"]).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  crewVariesByDay: z.boolean().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateShootInput = z.infer<typeof createShootSchema>;
export type UpdateShootInput = z.infer<typeof updateShootSchema>;
export type ShootDateInput = z.infer<typeof shootDateSchema>;

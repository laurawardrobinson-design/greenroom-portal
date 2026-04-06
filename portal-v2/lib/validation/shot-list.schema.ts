import { z } from "zod";

export const createSetupSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1, "Scene name is required"),
  description: z.string().default(""),
  location: z.string().default(""),
  mediaType: z.string().default(""),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateSetupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  mediaType: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createShotSchema = z.object({
  setupId: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string().default(""),
  description: z.string().default(""),
  angle: z.string().default(""),
  notes: z.string().default(""),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateShotSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  angle: z.string().optional(),
  mediaType: z.string().optional(),
  location: z.string().optional(),
  referenceImageUrl: z.string().nullable().optional(),
  status: z.enum(["Pending", "Complete", "Needs Retouching", "Cancelled"]).optional(),
  notes: z.string().optional(),
  talent: z.string().optional(),
  props: z.string().optional(),
  wardrobe: z.string().optional(),
  surface: z.string().optional(),
  lighting: z.string().optional(),
  priority: z.string().optional(),
  retouchingNotes: z.string().optional(),
  productTags: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const linkDeliverableSchema = z.object({
  shotId: z.string().uuid(),
  deliverableId: z.string().uuid(),
});

export const linkProductSchema = z.object({
  campaignProductId: z.string().uuid(),
  notes: z.string().default(""),
  quantity: z.string().default(""),
});

export const unlinkProductSchema = z.object({
  campaignProductId: z.string().uuid(),
});

export type CreateSetupInput = z.infer<typeof createSetupSchema>;
export type UpdateSetupInput = z.infer<typeof updateSetupSchema>;
export type CreateShotInput = z.infer<typeof createShotSchema>;
export type UpdateShotInput = z.infer<typeof updateShotSchema>;

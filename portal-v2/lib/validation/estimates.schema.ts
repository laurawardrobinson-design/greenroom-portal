import { z } from "zod";

export const estimateItemSchema = z.object({
  category: z.enum([
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
  ]),
  description: z.string().min(1, "Description required"),
  quantity: z.number().min(0).default(1),
  unitPrice: z.number().min(0, "Price must be positive"),
  amount: z.number().min(0),
});

export const submitEstimateSchema = z.object({
  campaignVendorId: z.string().uuid(),
  estimateFileUrl: z.string().min(1).nullable().optional(),
  estimateFileName: z.string().min(1).nullable().optional(),
  items: z.array(estimateItemSchema).min(1, "At least one line item is required"),
});

export type EstimateItemInput = z.infer<typeof estimateItemSchema>;
export type SubmitEstimateInput = z.infer<typeof submitEstimateSchema>;

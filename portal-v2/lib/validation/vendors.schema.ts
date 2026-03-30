import { z } from "zod";

export const createVendorSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().default(""),
  email: z.string().email("Valid email required").or(z.literal("")),
  phone: z.string().default(""),
  category: z.string().default(""),
  specialty: z.string().default(""),
  taxId: z.string().default(""),
  notes: z.string().default(""),
});

export const updateVendorSchema = createVendorSchema.partial();

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

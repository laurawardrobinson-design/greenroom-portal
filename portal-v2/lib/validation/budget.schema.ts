import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Must be an ISO date (YYYY-MM-DD)");

export const createBudgetPoolSchema = z.object({
  name: z.string().min(1, "Name is required"),
  periodStart: dateString,
  periodEnd: dateString,
  totalAmount: z.number().nonnegative("Total must be zero or positive"),
});

export const updateBudgetPoolSchema = z.object({
  id: z.string().uuid("Pool id must be a UUID"),
  name: z.string().min(1).optional(),
  periodStart: dateString.optional(),
  periodEnd: dateString.optional(),
  totalAmount: z.number().nonnegative().optional(),
});

export type CreateBudgetPoolInput = z.infer<typeof createBudgetPoolSchema>;
export type UpdateBudgetPoolInput = z.infer<typeof updateBudgetPoolSchema>;

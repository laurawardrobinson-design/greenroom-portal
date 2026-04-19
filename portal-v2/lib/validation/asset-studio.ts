import { z } from "zod";

// ─── Primitives ──────────────────────────────────────────────────────────────

const uuid = z.string().uuid();
const nonEmptyString = z.string().trim().min(1);

// Dynamic copy overrides: { bindingPath -> value }. Values are free text so a
// user can blank-check a previously-set override with "". Values are treated
// as strings (sharp SVG rendering converts anything else to text anyway).
const copyOverrideMap = z.record(z.string(), z.string());

// ─── Variants ────────────────────────────────────────────────────────────────

export const bulkVariantActionSchema = z.object({
  ids: z.array(uuid).min(1).max(500),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});
export type BulkVariantActionInput = z.infer<typeof bulkVariantActionSchema>;

export const rejectVariantSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .default({});
export type RejectVariantInput = z.infer<typeof rejectVariantSchema>;

// ─── Runs ────────────────────────────────────────────────────────────────────

// Mirror of VariantRunBindings from types/domain.ts. Kept local so zod and the
// TS type can evolve together without a circular import.
// Locale codes follow BCP-47 ish: letters-letters, 2-5 chars per segment.
// Keep loose — we don't want to reject fr-CA vs. pt-BR vs. es-419.
const localeCode = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,5})?$/);

export const variantRunBindingsSchema = z
  .object({
    campaign_product_ids: z.array(uuid).min(1).max(500),
    output_spec_ids: z.array(uuid).min(1).max(50).optional(),
    locale_codes: z.array(localeCode).min(1).max(20).optional(),
    copy_overrides: copyOverrideMap.optional(),
    copy_overrides_by_product: z
      .record(uuid, copyOverrideMap)
      .optional(),
  })
  .passthrough();

export const createRunSchema = z.object({
  templateId: uuid,
  campaignId: z.union([uuid, z.null()]).optional(),
  name: nonEmptyString.max(200),
  notes: z.string().max(2000).optional(),
  bindings: variantRunBindingsSchema,
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

// ─── Templates ───────────────────────────────────────────────────────────────

export const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000),
    status: z.enum(["draft", "published", "archived"]),
    category: z.string().max(100),
    brandTokensId: z.union([uuid, z.null()]),
    thumbnailUrl: z.union([z.string().url(), z.null()]),
    canvasWidth: z.number().int().min(1).max(8000),
    canvasHeight: z.number().int().min(1).max(8000),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a request body against a schema and return either the parsed value or
 * a NextResponse-ready error object. Callers unwrap with:
 *
 *   const parsed = parseBody(body, schema);
 *   if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });
 *
 * Keeps per-route code short without hiding what's happening.
 */
export function parseBody<T>(
  body: unknown,
  schema: z.ZodType<T>
):
  | { ok: true; data: T }
  | { ok: false; error: { error: string; issues: unknown[] } } {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: {
      error: "Invalid request body",
      issues: result.error.issues,
    },
  };
}

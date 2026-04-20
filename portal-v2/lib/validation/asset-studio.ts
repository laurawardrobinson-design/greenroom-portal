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

export const updateVariantSchema = z.object({
  status: z.enum(["pending", "rendering", "rendered", "approved", "rejected", "failed"]),
  assetUrl: z.union([z.string().max(4000), z.null()]).optional(),
  storagePath: z.union([z.string().max(4000), z.null()]).optional(),
  thumbnailUrl: z.union([z.string().max(4000), z.null()]).optional(),
  errorMessage: z.union([z.string().max(2000), z.null()]).optional(),
});
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

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
    image_overrides_by_product: z
      .record(uuid, z.string().url().max(2048))
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

export const enqueueRenderJobSchema = z
  .object({
    priority: z.number().int().min(1).max(1000).optional(),
  })
  .default({});
export type EnqueueRenderJobInput = z.infer<typeof enqueueRenderJobSchema>;

export const updateRunSchema = z
  .object({
    status: z.enum(["queued", "rendering", "completed", "failed", "cancelled"]).optional(),
    action: z.literal("cancel").optional(),
  })
  .refine((v) => Boolean(v.status || v.action), {
    message: "Provide status or action",
  });
export type UpdateRunInput = z.infer<typeof updateRunSchema>;

// ─── DAM Placeholder ────────────────────────────────────────────────────────

const damAssetStatusSchema = z.enum([
  "ingested",
  "retouching",
  "retouched",
  "versioning",
  "ready_for_activation",
  "archived",
]);

const damPhotoshopStatusSchema = z.enum([
  "not_requested",
  "requested",
  "in_progress",
  "completed",
]);

const damSyncJobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const ingestDamAssetSchema = z.object({
  campaignAssetId: uuid,
});
export type IngestDamAssetInput = z.infer<typeof ingestDamAssetSchema>;

export const updateDamAssetSchema = z
  .object({
    action: z
      .enum(["request_photoshop", "link_campaign", "unlink_campaign"])
      .optional(),
    campaignId: uuid.optional(),
    status: damAssetStatusSchema.optional(),
    photoshopStatus: damPhotoshopStatusSchema.optional(),
    photoshopNote: z.string().max(2000).optional(),
    retouchingNotes: z.string().max(4000).optional(),
  })
  .refine(
    (v) =>
      Boolean(
        v.action ||
          v.campaignId !== undefined ||
          v.status !== undefined ||
          v.photoshopStatus !== undefined ||
          v.photoshopNote !== undefined ||
          v.retouchingNotes !== undefined
      ),
    { message: "Provide at least one update field" }
  )
  .refine(
    (v) =>
      !v.action ||
      (v.action !== "link_campaign" && v.action !== "unlink_campaign") ||
      Boolean(v.campaignId),
    {
      message:
        "campaignId is required when action is link_campaign or unlink_campaign",
    }
  );
export type UpdateDamAssetInput = z.infer<typeof updateDamAssetSchema>;

export const createDamAssetVersionSchema = z.object({
  label: z.string().trim().max(200).optional(),
  notes: z.string().max(4000).optional(),
  stage: damAssetStatusSchema.optional(),
  fileUrl: z.string().max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateDamAssetVersionInput = z.infer<typeof createDamAssetVersionSchema>;

export const enqueueDamSyncJobSchema = z.object({
  damAssetId: uuid,
  damAssetVersionId: uuid.optional(),
  reason: z.string().trim().max(500).optional(),
  force: z.boolean().optional(),
});
export type EnqueueDamSyncJobInput = z.infer<typeof enqueueDamSyncJobSchema>;

export const listDamSyncJobsQuerySchema = z.object({
  damAssetId: uuid.optional(),
  status: damSyncJobStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type ListDamSyncJobsQueryInput = z.infer<typeof listDamSyncJobsQuerySchema>;

export const retryDamSyncJobSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .default({});
export type RetryDamSyncJobInput = z.infer<typeof retryDamSyncJobSchema>;

export const reconcileDamSyncSchema = z.object({
  damAssetId: uuid,
  reason: z.string().trim().max(500).optional(),
});
export type ReconcileDamSyncInput = z.infer<typeof reconcileDamSyncSchema>;

export const advanceWorkflowTransitionSchema = z
  .object({
    action: z.string().trim().min(1).max(120).optional(),
    toStage: z.string().trim().min(1).max(120).optional(),
    reason: z.string().trim().max(1000).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Boolean(v.action || v.toStage), {
    message: "Provide action or toStage",
  });
export type AdvanceWorkflowTransitionInput = z.infer<typeof advanceWorkflowTransitionSchema>;

export const myWorkQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type MyWorkQueueQueryInput = z.infer<typeof myWorkQueueQuerySchema>;

// ─── Templates ───────────────────────────────────────────────────────────────

export const createTemplateSchema = z.object({
  // Optional when deliverableId is provided — we'll derive the name.
  name: nonEmptyString.max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  brandTokensId: z.union([uuid, z.null()]).optional(),
  canvasWidth: z.number().int().min(1).max(8000).optional(),
  canvasHeight: z.number().int().min(1).max(8000).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  seedDefaultSpecs: z.boolean().optional(),
  // When present, prefill canvas from the deliverable, back-link the
  // template via campaign_deliverable_id, and advance the deliverable
  // workflow from needs_template → drafting. Used by "Start templating"
  // on My Work.
  deliverableId: uuid.optional(),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

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

const templateLayerTypeSchema = z.enum(["text", "image", "logo", "shape"]);
const templateLayerPropsSchema = z.record(z.string(), z.unknown());
const templateLayerGeometrySchema = z.object({
  xPct: z.number().finite().min(0).max(100).optional(),
  yPct: z.number().finite().min(0).max(100).optional(),
  widthPct: z.number().finite().min(0.01).max(100).optional(),
  heightPct: z.number().finite().min(0.01).max(100).optional(),
});

export const createTemplateLayerSchema = z
  .object({
    name: nonEmptyString.max(200),
    layerType: templateLayerTypeSchema,
    isDynamic: z.boolean().optional(),
    isLocked: z.boolean().optional(),
    dataBinding: z.string().max(300).optional(),
    staticValue: z.string().max(10_000).optional(),
    rotationDeg: z.number().finite().min(-3600).max(3600).optional(),
    zIndex: z.number().int().min(-100_000).max(100_000).optional(),
    sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
    props: templateLayerPropsSchema.optional(),
    locales: z.record(z.string(), z.string()).optional(),
  })
  .merge(templateLayerGeometrySchema);
export type CreateTemplateLayerInput = z.infer<typeof createTemplateLayerSchema>;

export const updateTemplateLayerSchema = z
  .object({
    name: nonEmptyString.max(200),
    layerType: templateLayerTypeSchema,
    isDynamic: z.boolean(),
    isLocked: z.boolean(),
    dataBinding: z.string().max(300),
    staticValue: z.string().max(10_000),
    rotationDeg: z.number().finite().min(-3600).max(3600),
    zIndex: z.number().int().min(-100_000).max(100_000),
    sortOrder: z.number().int().min(-100_000).max(100_000),
    props: templateLayerPropsSchema,
    locales: z.record(z.string(), z.string()),
  })
  .merge(templateLayerGeometrySchema)
  .partial();
export type UpdateTemplateLayerInput = z.infer<typeof updateTemplateLayerSchema>;

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

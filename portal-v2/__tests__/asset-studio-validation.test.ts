import { describe, expect, it } from "vitest";
import {
  advanceWorkflowTransitionSchema,
  createDamAssetVersionSchema,
  createTemplateLayerSchema,
  createTemplateSchema,
  enqueueDamSyncJobSchema,
  ingestDamAssetSchema,
  listDamSyncJobsQuerySchema,
  myWorkQueueQuerySchema,
  reconcileDamSyncSchema,
  retryDamSyncJobSchema,
  updateRunSchema,
  updateDamAssetSchema,
  updateTemplateLayerSchema,
  updateVariantSchema,
} from "@/lib/validation/asset-studio";

describe("asset studio validation", () => {
  it("accepts valid template-layer create payloads", () => {
    const parsed = createTemplateLayerSchema.safeParse({
      name: "Product image",
      layerType: "image",
      xPct: 10,
      yPct: 12,
      widthPct: 40,
      heightPct: 55,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid template-layer geometry", () => {
    const parsed = createTemplateLayerSchema.safeParse({
      name: "Bad layer",
      layerType: "shape",
      widthPct: 0,
      heightPct: 120,
      xPct: -4,
    });
    expect(parsed.success).toBe(false);
  });

  it("allows partial template-layer updates", () => {
    const parsed = updateTemplateLayerSchema.safeParse({
      isLocked: true,
      widthPct: 25,
    });
    expect(parsed.success).toBe(true);
  });

  it("requires status or action for run updates", () => {
    const empty = updateRunSchema.safeParse({});
    const statusOnly = updateRunSchema.safeParse({ status: "cancelled" });
    const actionOnly = updateRunSchema.safeParse({ action: "cancel" });
    expect(empty.success).toBe(false);
    expect(statusOnly.success).toBe(true);
    expect(actionOnly.success).toBe(true);
  });

  it("requires explicit variant status updates", () => {
    expect(updateVariantSchema.safeParse({}).success).toBe(false);
    expect(
      updateVariantSchema.safeParse({ status: "approved", assetUrl: null }).success
    ).toBe(true);
  });

  it("validates template canvas bounds", () => {
    expect(
      createTemplateSchema.safeParse({
        name: "Publix card",
        canvasWidth: 1080,
        canvasHeight: 1350,
      }).success
    ).toBe(true);
    expect(
      createTemplateSchema.safeParse({
        name: "Too big",
        canvasWidth: 20000,
      }).success
    ).toBe(false);
  });

  it("accepts DAM ingest payloads", () => {
    expect(
      ingestDamAssetSchema.safeParse({
        campaignAssetId: "4f5f31f1-3c4d-448b-86e3-43141f2b19f2",
      }).success
    ).toBe(true);
  });

  it("requires at least one DAM update field", () => {
    expect(updateDamAssetSchema.safeParse({}).success).toBe(false);
    expect(
      updateDamAssetSchema.safeParse({ action: "request_photoshop" }).success
    ).toBe(true);
    expect(
      updateDamAssetSchema.safeParse({ status: "retouched" }).success
    ).toBe(true);
    expect(
      updateDamAssetSchema.safeParse({
        action: "link_campaign",
        campaignId: "4f5f31f1-3c4d-448b-86e3-43141f2b19f2",
      }).success
    ).toBe(true);
    expect(
      updateDamAssetSchema.safeParse({
        action: "unlink_campaign",
        campaignId: "4f5f31f1-3c4d-448b-86e3-43141f2b19f2",
      }).success
    ).toBe(true);
    expect(
      updateDamAssetSchema.safeParse({
        action: "link_campaign",
      }).success
    ).toBe(false);
  });

  it("accepts DAM version creation payloads", () => {
    expect(
      createDamAssetVersionSchema.safeParse({
        label: "v2 retouch pass",
        stage: "retouched",
        notes: "Color cleanup pass",
      }).success
    ).toBe(true);
  });

  it("validates DAM sync enqueue payloads", () => {
    expect(
      enqueueDamSyncJobSchema.safeParse({
        damAssetId: "4f5f31f1-3c4d-448b-86e3-43141f2b19f2",
      }).success
    ).toBe(true);

    expect(
      enqueueDamSyncJobSchema.safeParse({
        damAssetId: "not-a-uuid",
      }).success
    ).toBe(false);
  });

  it("validates DAM sync listing query payloads", () => {
    expect(
      listDamSyncJobsQuerySchema.safeParse({
        status: "failed",
        limit: "25",
      }).success
    ).toBe(true);

    expect(
      listDamSyncJobsQuerySchema.safeParse({
        status: "not_real",
      }).success
    ).toBe(false);
  });

  it("validates DAM sync retry/reconcile payloads", () => {
    expect(retryDamSyncJobSchema.safeParse({}).success).toBe(true);

    expect(
      reconcileDamSyncSchema.safeParse({
        damAssetId: "4f5f31f1-3c4d-448b-86e3-43141f2b19f2",
      }).success
    ).toBe(true);

    expect(
      reconcileDamSyncSchema.safeParse({
        damAssetId: "bad-id",
      }).success
    ).toBe(false);
  });

  it("requires action or target stage for workflow transitions", () => {
    expect(advanceWorkflowTransitionSchema.safeParse({}).success).toBe(false);

    expect(
      advanceWorkflowTransitionSchema.safeParse({
        action: "start_retouching",
      }).success
    ).toBe(true);

    expect(
      advanceWorkflowTransitionSchema.safeParse({
        toStage: "versioning",
      }).success
    ).toBe(true);
  });

  it("validates My Work query payload", () => {
    expect(myWorkQueueQuerySchema.safeParse({ limit: "20" }).success).toBe(true);
    expect(myWorkQueueQuerySchema.safeParse({ limit: "9999" }).success).toBe(false);
  });
});

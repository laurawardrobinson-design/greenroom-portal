import { createClient } from "@/lib/supabase/server";
import type {
  Variant,
  VariantBindings,
  VariantStatus,
  TemplateOutputSpec,
} from "@/types/domain";

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toVariant(row: Record<string, unknown>): Variant {
  const outputSpecRow = row.template_output_specs as Record<string, unknown> | undefined;
  const productRow = row.campaign_products as Record<string, unknown> | undefined;
  const productInner = productRow?.products as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    runId: row.run_id as string,
    templateId: (row.template_id as string | null) ?? null,
    outputSpecId: (row.output_spec_id as string | null) ?? null,
    campaignProductId: (row.campaign_product_id as string | null) ?? null,
    width: Number(row.width),
    height: Number(row.height),
    status: row.status as VariantStatus,
    assetUrl: (row.asset_url as string | null) ?? null,
    storagePath: (row.storage_path as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    localeCode: (row.locale_code as string | null) ?? null,
    bindings: (row.bindings as VariantBindings) ?? {},
    errorMessage: (row.error_message as string | null) ?? null,
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    rejectedBy: (row.rejected_by as string | null) ?? null,
    rejectedAt: (row.rejected_at as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    outputSpec: outputSpecRow
      ? {
          id: outputSpecRow.id as string,
          templateId: outputSpecRow.template_id as string,
          label: outputSpecRow.label as string,
          width: Number(outputSpecRow.width),
          height: Number(outputSpecRow.height),
          channel: (outputSpecRow.channel as string) ?? "",
          format: (outputSpecRow.format as TemplateOutputSpec["format"]) ?? "png",
          sortOrder: Number(outputSpecRow.sort_order ?? 0),
          createdAt: outputSpecRow.created_at as string,
        }
      : null,
    product: productInner
      ? {
          id: productInner.id as string,
          name: productInner.name as string,
          imageUrl: (productInner.image_url as string | null) ?? null,
        }
      : null,
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listVariantsByRun(runId: string): Promise<Variant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .select("*, template_output_specs(*), campaign_products(*, products(*))")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toVariant);
}

export async function listVariants(filters?: {
  status?: VariantStatus;
  templateId?: string;
  limit?: number;
}): Promise<Variant[]> {
  const supabase = await createClient();
  let q = supabase
    .from("variants")
    .select("*, template_output_specs(*), campaign_products(*, products(*))")
    .order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.templateId) q = q.eq("template_id", filters.templateId);
  if (filters?.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toVariant);
}

export async function getVariant(id: string): Promise<Variant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .select("*, template_output_specs(*), campaign_products(*, products(*))")
    .eq("id", id)
    .single();
  if (error) return null;
  return toVariant(data);
}

// ─── Status transitions ──────────────────────────────────────────────────────

export async function updateVariantStatus(
  id: string,
  status: VariantStatus,
  patch?: Partial<{
    assetUrl: string | null;
    storagePath: string | null;
    thumbnailUrl: string | null;
    errorMessage: string | null;
  }>
): Promise<Variant> {
  const supabase = await createClient();
  const body: Record<string, unknown> = { status };
  if (patch?.assetUrl !== undefined) body.asset_url = patch.assetUrl;
  if (patch?.storagePath !== undefined) body.storage_path = patch.storagePath;
  if (patch?.thumbnailUrl !== undefined) body.thumbnail_url = patch.thumbnailUrl;
  if (patch?.errorMessage !== undefined) body.error_message = patch.errorMessage;
  const { data, error } = await supabase
    .from("variants")
    .update(body)
    .eq("id", id)
    .select("*, template_output_specs(*), campaign_products(*, products(*))")
    .single();
  if (error) throw error;
  return toVariant(data);
}

export async function approveVariant(id: string, approvedBy: string | null): Promise<Variant> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .update({
      status: "approved",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      // Clear any prior rejection state
      rejected_by: null,
      rejected_at: null,
      rejection_reason: "",
    })
    .eq("id", id)
    .select("*, template_output_specs(*), campaign_products(*, products(*))")
    .single();
  if (error) throw error;
  return toVariant(data);
}

export async function rejectVariant(
  id: string,
  rejectedBy: string | null,
  reason: string
): Promise<Variant> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variants")
    .update({
      status: "rejected",
      rejected_by: rejectedBy,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
      // Clear any prior approval state
      approved_by: null,
      approved_at: null,
    })
    .eq("id", id)
    .select("*, template_output_specs(*), campaign_products(*, products(*))")
    .single();
  if (error) throw error;
  return toVariant(data);
}

// ─── Bulk ops ────────────────────────────────────────────────────────────────

export async function bulkApproveVariants(
  ids: string[],
  approvedBy: string | null
): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("variants")
    .update(
      {
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        rejected_by: null,
        rejected_at: null,
        rejection_reason: "",
      },
      { count: "exact" }
    )
    .in("id", ids);
  if (error) throw error;
  return count ?? 0;
}

export async function bulkRejectVariants(
  ids: string[],
  rejectedBy: string | null,
  reason: string
): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("variants")
    .update(
      {
        status: "rejected",
        rejected_by: rejectedBy,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        approved_by: null,
        approved_at: null,
      },
      { count: "exact" }
    )
    .in("id", ids);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteVariant(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("variants").delete().eq("id", id);
  if (error) throw error;
}

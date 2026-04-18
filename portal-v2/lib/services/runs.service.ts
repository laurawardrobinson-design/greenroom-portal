import { createClient } from "@/lib/supabase/server";
import type {
  VariantRun,
  VariantRunBindings,
  VariantRunStatus,
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

function toRun(row: Record<string, unknown>): VariantRun {
  const variantsRows = row.variants as Record<string, unknown>[] | undefined;
  const campaignRow = row.campaigns as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    templateId: (row.template_id as string | null) ?? null,
    templateVersionId: (row.template_version_id as string | null) ?? null,
    campaignId: (row.campaign_id as string | null) ?? null,
    name: row.name as string,
    status: row.status as VariantRunStatus,
    totalVariants: Number(row.total_variants ?? 0),
    completedVariants: Number(row.completed_variants ?? 0),
    failedVariants: Number(row.failed_variants ?? 0),
    bindings: (row.bindings as VariantRunBindings) ?? {},
    notes: (row.notes as string) ?? "",
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    variants: variantsRows?.map(toVariant),
    campaign: campaignRow
      ? {
          id: campaignRow.id as string,
          wfNumber: (campaignRow.wf_number as string) ?? "",
          name: (campaignRow.name as string) ?? "",
          brand: (campaignRow.brand as string | null) ?? null,
        }
      : null,
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listRuns(filters?: {
  status?: VariantRunStatus;
  templateId?: string;
  campaignId?: string;
  limit?: number;
}): Promise<VariantRun[]> {
  const supabase = await createClient();
  let q = supabase
    .from("variant_runs")
    .select("*, campaigns(id, wf_number, name, brand)")
    .order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.templateId) q = q.eq("template_id", filters.templateId);
  if (filters?.campaignId) q = q.eq("campaign_id", filters.campaignId);
  if (filters?.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toRun);
}

export async function getRun(id: string): Promise<VariantRun | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variant_runs")
    .select(
      "*, campaigns(id, wf_number, name, brand), variants(*, template_output_specs(*), campaign_products(*, products(*)))"
    )
    .eq("id", id)
    .single();
  if (error) return null;
  // Sort variants for stable gallery ordering
  if (data && Array.isArray(data.variants)) {
    data.variants.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      String(a.created_at).localeCompare(String(b.created_at))
    );
  }
  return toRun(data);
}

// ─── Create + status transitions ─────────────────────────────────────────────

/**
 * Create a run and fan out variant stubs (one per product × output spec).
 *
 * Required bindings:
 *   - campaign_product_ids: which products to render
 *
 * Optional bindings:
 *   - output_spec_ids: subset of the template's specs (defaults to all)
 *   - copy_overrides:  free-form text overrides keyed by binding path
 */
export async function createRun(input: {
  templateId: string;
  campaignId?: string | null;
  name: string;
  bindings: VariantRunBindings;
  notes?: string;
  createdBy?: string | null;
}): Promise<VariantRun> {
  const supabase = await createClient();

  const productIds = input.bindings.campaign_product_ids ?? [];
  if (productIds.length === 0) {
    throw new Error("createRun: bindings.campaign_product_ids must contain at least one product");
  }

  // Resolve output specs (default = all of the template's specs)
  let specsQuery = supabase
    .from("template_output_specs")
    .select("*")
    .eq("template_id", input.templateId)
    .order("sort_order", { ascending: true });
  if (input.bindings.output_spec_ids && input.bindings.output_spec_ids.length > 0) {
    specsQuery = specsQuery.in("id", input.bindings.output_spec_ids);
  }
  const { data: specs, error: specsErr } = await specsQuery;
  if (specsErr) throw specsErr;
  if (!specs || specs.length === 0) {
    throw new Error("createRun: template has no output specs configured");
  }

  // Resolve campaign products (snapshot product info into variant bindings)
  const { data: cps, error: cpsErr } = await supabase
    .from("campaign_products")
    .select("*, products(*)")
    .in("id", productIds);
  if (cpsErr) throw cpsErr;
  if (!cps || cps.length === 0) {
    throw new Error("createRun: none of the supplied campaign_product_ids resolved");
  }

  const totalVariants = cps.length * specs.length;

  // Look up the template's current version so we can pin this run to it.
  // If the template has never been published, current_version_id is null and
  // we still let the run proceed — it just won't have a provenance link.
  const { data: tmplRow } = await supabase
    .from("templates")
    .select("current_version_id")
    .eq("id", input.templateId)
    .single();
  const templateVersionId = (tmplRow?.current_version_id as string | null) ?? null;

  // Insert the run row first so we can fan out children.
  const { data: runRow, error: runErr } = await supabase
    .from("variant_runs")
    .insert({
      template_id: input.templateId,
      template_version_id: templateVersionId,
      campaign_id: input.campaignId ?? null,
      name: input.name,
      status: "queued",
      total_variants: totalVariants,
      completed_variants: 0,
      failed_variants: 0,
      bindings: input.bindings,
      notes: input.notes ?? "",
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (runErr) throw runErr;

  // Build variant stubs — snapshot product fields into the per-variant bindings.
  const stubs = cps.flatMap((cp: Record<string, unknown>) => {
    const product = (cp.products ?? {}) as Record<string, unknown>;
    const productSnapshot: VariantBindings["product"] = {
      id: product.id as string | undefined,
      name: (product.name as string | undefined) ?? "",
      image_url: (product.image_url as string | undefined) ?? "",
      department: (product.department as string | undefined) ?? "",
      item_code: (product.item_code as string | null | undefined) ?? null,
    };
    return specs.map((s: Record<string, unknown>) => ({
      run_id: runRow.id,
      template_id: input.templateId,
      output_spec_id: s.id,
      campaign_product_id: cp.id,
      width: Number(s.width),
      height: Number(s.height),
      status: "pending",
      bindings: {
        product: productSnapshot,
        copy: input.bindings.copy_overrides ?? {},
      },
    }));
  });

  if (stubs.length > 0) {
    const { error: variantsErr } = await supabase.from("variants").insert(stubs);
    if (variantsErr) throw variantsErr;
  }

  return toRun(runRow);
}

export async function updateRunStatus(
  id: string,
  status: VariantRunStatus,
  opts?: { startedAt?: string | null; completedAt?: string | null }
): Promise<VariantRun> {
  const supabase = await createClient();
  const body: Record<string, unknown> = { status };
  if (status === "rendering") body.started_at = opts?.startedAt ?? new Date().toISOString();
  if (status === "completed" || status === "failed" || status === "cancelled") {
    body.completed_at = opts?.completedAt ?? new Date().toISOString();
  }
  if (opts?.startedAt !== undefined) body.started_at = opts.startedAt;
  if (opts?.completedAt !== undefined) body.completed_at = opts.completedAt;

  const { data, error } = await supabase
    .from("variant_runs")
    .update(body)
    .eq("id", id)
    .select("*, campaigns(id, wf_number, name, brand)")
    .single();
  if (error) throw error;
  return toRun(data);
}

/**
 * Refresh the cached counts on a run by counting child variants directly.
 * Cheaper to call after a batch render completes than tracking deltas client-side.
 */
export async function refreshRunCounts(id: string): Promise<VariantRun> {
  const supabase = await createClient();
  const { data: variants, error: vErr } = await supabase
    .from("variants")
    .select("status")
    .eq("run_id", id);
  if (vErr) throw vErr;
  const total = variants?.length ?? 0;
  let completed = 0;
  let failed = 0;
  for (const v of variants ?? []) {
    const s = (v as Record<string, unknown>).status as VariantStatus;
    if (s === "rendered" || s === "approved" || s === "rejected") completed += 1;
    if (s === "failed") failed += 1;
  }
  const allDone = total > 0 && completed + failed === total;
  const body: Record<string, unknown> = {
    total_variants: total,
    completed_variants: completed,
    failed_variants: failed,
  };
  if (allDone) {
    body.status = failed > 0 && completed === 0 ? "failed" : "completed";
    body.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("variant_runs")
    .update(body)
    .eq("id", id)
    .select("*, campaigns(id, wf_number, name, brand)")
    .single();
  if (error) throw error;
  return toRun(data);
}

export async function cancelRun(id: string): Promise<VariantRun> {
  return updateRunStatus(id, "cancelled");
}

export async function deleteRun(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("variant_runs").delete().eq("id", id);
  if (error) throw error;
}

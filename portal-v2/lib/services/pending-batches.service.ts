import { createClient } from "@/lib/supabase/server";

export interface PendingBatchThumbnail {
  id: string;
  thumbnailUrl: string | null;
  assetUrl: string | null;
  productName: string | null;
  specLabel: string | null;
  updatedAt: string;
}

export interface PendingBatch {
  runId: string;
  runName: string;
  runCreatedAt: string;
  pendingCount: number;
  totalCount: number;
  oldestPendingAt: string;
  campaign: {
    id: string;
    wfNumber: string;
    name: string;
    brand: string | null;
  } | null;
  template: { id: string; name: string } | null;
  thumbnails: PendingBatchThumbnail[];
  pendingVariantIds: string[];
}

const THUMBS_PER_BATCH = 6;

// Returns every run that has at least one variant in 'rendered' (pending
// approval) status, grouped with enough context for the CD/DD home inbox:
// campaign + template info, pending count, and a handful of thumbnails.
// Oldest-pending-first so the most overdue work surfaces to the top.
//
// Implemented as two queries (variants, then the runs they belong to) — nested
// joins through an intermediate table don't reliably resolve campaign metadata
// via PostgREST's inferred joins.
export async function listPendingBatches(): Promise<PendingBatch[]> {
  const supabase = await createClient();

  const { data: variantRows, error: variantErr } = await supabase
    .from("variants")
    .select(
      `
      id,
      run_id,
      created_at,
      updated_at,
      thumbnail_url,
      asset_url,
      template_output_specs(label),
      campaign_products(products(name))
      `
    )
    .eq("status", "rendered")
    .order("created_at", { ascending: true });

  if (variantErr) throw variantErr;
  const variants = (variantRows ?? []) as Record<string, unknown>[];
  if (variants.length === 0) return [];

  const runIds = Array.from(
    new Set(variants.map((r) => r.run_id as string).filter(Boolean))
  );

  const { data: runRows, error: runErr } = await supabase
    .from("variant_runs")
    .select("id, name, created_at, total_variants, campaign_id, template_id")
    .in("id", runIds);

  if (runErr) throw runErr;
  const runs = (runRows ?? []) as Record<string, unknown>[];

  const campaignIds = Array.from(
    new Set(
      runs.map((r) => r.campaign_id as string | null).filter((v): v is string => Boolean(v))
    )
  );
  const templateIds = Array.from(
    new Set(
      runs.map((r) => r.template_id as string | null).filter((v): v is string => Boolean(v))
    )
  );

  const [campaignRes, templateRes] = await Promise.all([
    campaignIds.length > 0
      ? supabase.from("campaigns").select("id, wf_number, name, brand").in("id", campaignIds)
      : Promise.resolve({ data: [], error: null as unknown as null }),
    templateIds.length > 0
      ? supabase.from("templates").select("id, name").in("id", templateIds)
      : Promise.resolve({ data: [], error: null as unknown as null }),
  ]);
  if (campaignRes.error) throw campaignRes.error;
  if (templateRes.error) throw templateRes.error;

  const campaignById = new Map<string, Record<string, unknown>>();
  for (const c of (campaignRes.data ?? []) as Record<string, unknown>[]) {
    campaignById.set(c.id as string, c);
  }
  const templateById = new Map<string, Record<string, unknown>>();
  for (const t of (templateRes.data ?? []) as Record<string, unknown>[]) {
    templateById.set(t.id as string, t);
  }

  const runById = new Map<string, Record<string, unknown>>();
  for (const r of runs) {
    runById.set(r.id as string, r);
  }

  const byRun = new Map<string, PendingBatch>();
  for (const row of variants) {
    const runId = row.run_id as string;
    const run = runById.get(runId);
    if (!run) continue;

    let batch = byRun.get(runId);
    if (!batch) {
      const campaignId = run.campaign_id as string | null;
      const templateId = run.template_id as string | null;
      const campaign = campaignId ? campaignById.get(campaignId) ?? null : null;
      const template = templateId ? templateById.get(templateId) ?? null : null;
      batch = {
        runId,
        runName: (run.name as string) ?? "Untitled run",
        runCreatedAt: run.created_at as string,
        pendingCount: 0,
        totalCount: Number(run.total_variants ?? 0),
        oldestPendingAt: row.created_at as string,
        campaign: campaign
          ? {
              id: campaign.id as string,
              wfNumber: (campaign.wf_number as string) ?? "",
              name: (campaign.name as string) ?? "",
              brand: (campaign.brand as string | null) ?? null,
            }
          : null,
        template: template
          ? {
              id: template.id as string,
              name: (template.name as string) ?? "",
            }
          : null,
        thumbnails: [],
        pendingVariantIds: [],
      };
      byRun.set(runId, batch);
    }

    batch.pendingCount += 1;
    batch.pendingVariantIds.push(row.id as string);
    if (batch.thumbnails.length < THUMBS_PER_BATCH) {
      const spec = row.template_output_specs as Record<string, unknown> | null;
      const productJoin = row.campaign_products as Record<string, unknown> | null;
      const productInner = productJoin?.products as Record<string, unknown> | null;
      batch.thumbnails.push({
        id: row.id as string,
        thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
        assetUrl: (row.asset_url as string | null) ?? null,
        productName: (productInner?.name as string | null) ?? null,
        specLabel: (spec?.label as string | null) ?? null,
        updatedAt: row.updated_at as string,
      });
    }
  }

  return Array.from(byRun.values()).sort((a, b) =>
    a.oldestPendingAt.localeCompare(b.oldestPendingAt)
  );
}

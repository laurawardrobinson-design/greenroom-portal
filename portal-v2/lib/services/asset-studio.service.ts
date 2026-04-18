import { createClient } from "@/lib/supabase/server";
import type { AssetStudioSummary } from "@/types/domain";
import { listRuns } from "./runs.service";

/**
 * Aggregates the numbers shown on the Asset Studio Overview tab.
 * Cheap counts via head-only selects, then 5 most-recent runs.
 */
export async function getAssetStudioSummary(): Promise<AssetStudioSummary> {
  const supabase = await createClient();

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoISO = oneWeekAgo.toISOString();

  const [
    templatesAll,
    templatesPub,
    runsActive,
    variantsWeek,
    variantsPending,
    variantsApproved,
  ] = await Promise.all([
    supabase.from("templates").select("id", { count: "exact", head: true }),
    supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("variant_runs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "rendering"]),
    supabase
      .from("variants")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneWeekAgoISO),
    supabase
      .from("variants")
      .select("id", { count: "exact", head: true })
      .eq("status", "rendered"),
    supabase
      .from("variants")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
  ]);

  const recentRuns = await listRuns({ limit: 5 });

  return {
    templateCount: templatesAll.count ?? 0,
    publishedTemplateCount: templatesPub.count ?? 0,
    activeRunCount: runsActive.count ?? 0,
    variantsThisWeek: variantsWeek.count ?? 0,
    pendingApprovalCount: variantsPending.count ?? 0,
    approvedCount: variantsApproved.count ?? 0,
    recentRuns,
  };
}

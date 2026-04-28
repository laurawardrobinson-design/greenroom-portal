import { createAdminClient } from "@/lib/supabase/admin";

export interface CampaignBrief {
  id: string;
  campaignId: string;
  objective: string;
  audience: string;
  proposition: string;
  mandatories: string;
  successMeasure: string;
  references: string[];
  authorId: string | null;
  lastEditedBy: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type CampaignBriefInput = Omit<
  CampaignBrief,
  "id" | "campaignId" | "authorId" | "lastEditedBy" | "version" | "createdAt" | "updatedAt"
>;

// Six first-class fields — `references` is metadata, not counted toward brand-health.
const SCORED_FIELDS: (keyof CampaignBriefInput)[] = [
  "objective",
  "audience",
  "mandatories",
];

export function briefCompleteness(brief: Partial<CampaignBriefInput> | null | undefined) {
  if (!brief) return { filled: 0, total: SCORED_FIELDS.length };
  const filled = SCORED_FIELDS.reduce((n, key) => {
    const v = brief[key];
    if (typeof v === "string" && v.trim().length > 0) return n + 1;
    return n;
  }, 0);
  return { filled, total: SCORED_FIELDS.length };
}

function toBrief(row: any): CampaignBrief {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    objective: row.objective ?? "",
    audience: row.audience ?? "",
    proposition: row.proposition ?? "",
    mandatories: row.mandatories ?? "",
    successMeasure: row.success_measure ?? "",
    references: Array.isArray(row.references) ? row.references : [],
    authorId: row.author_id ?? null,
    lastEditedBy: row.last_edited_by ?? null,
    version: row.version ?? 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBriefByCampaignId(
  campaignId: string
): Promise<CampaignBrief | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_briefs")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) throw error;
  return data ? toBrief(data) : null;
}

export async function upsertBrief(
  campaignId: string,
  input: CampaignBriefInput,
  userId: string
): Promise<CampaignBrief> {
  const db = createAdminClient();

  const existing = await getBriefByCampaignId(campaignId);

  if (!existing) {
    const { data, error } = await db
      .from("campaign_briefs")
      .insert({
        campaign_id: campaignId,
        objective: input.objective,
        audience: input.audience,
        proposition: input.proposition,
        mandatories: input.mandatories,
        success_measure: input.successMeasure,
        references: input.references,
        author_id: userId,
        last_edited_by: userId,
        version: 1,
      })
      .select("*")
      .single();

    if (error) throw error;
    const created = toBrief(data);
    await recordVersion(created, userId);
    return created;
  }

  const nextVersion = existing.version + 1;
  const { data, error } = await db
    .from("campaign_briefs")
    .update({
      objective: input.objective,
      audience: input.audience,
      proposition: input.proposition,
      mandatories: input.mandatories,
      success_measure: input.successMeasure,
      references: input.references,
      last_edited_by: userId,
      version: nextVersion,
    })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) throw error;
  const updated = toBrief(data);
  await recordVersion(updated, userId);
  return updated;
}

async function recordVersion(brief: CampaignBrief, userId: string) {
  const db = createAdminClient();
  await db.from("campaign_brief_versions").insert({
    brief_id: brief.id,
    version: brief.version,
    snapshot_json: {
      objective: brief.objective,
      audience: brief.audience,
      proposition: brief.proposition,
      mandatories: brief.mandatories,
      successMeasure: brief.successMeasure,
      references: brief.references,
    },
    edited_by: userId,
  });
}

// Used by the BMM portfolio query — one SELECT to know which campaigns
// have a brief and whether it's meaningfully complete.
export async function getBriefSummariesForCampaigns(
  campaignIds: string[]
): Promise<Map<string, { hasBrief: boolean; filled: number; total: number }>> {
  const out = new Map<string, { hasBrief: boolean; filled: number; total: number }>();
  if (campaignIds.length === 0) return out;

  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_briefs")
    .select("campaign_id, objective, audience, proposition, mandatories, success_measure")
    .in("campaign_id", campaignIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const brief = {
      objective: row.objective ?? "",
      audience: row.audience ?? "",
      proposition: row.proposition ?? "",
      mandatories: row.mandatories ?? "",
      successMeasure: row.success_measure ?? "",
      references: [],
    };
    const { filled, total } = briefCompleteness(brief);
    out.set(row.campaign_id, { hasBrief: filled > 0, filled, total });
  }

  return out;
}

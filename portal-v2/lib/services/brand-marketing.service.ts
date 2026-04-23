import { createAdminClient } from "@/lib/supabase/admin";
import { isLineOfBusiness, type LineOfBusiness } from "@/lib/constants/lines-of-business";
import { getBriefSummariesForCampaigns } from "@/lib/services/campaign-briefs.service";
import type { CampaignStatus } from "@/types/domain";

// What a campaign looks like on the BMM home page. This is intentionally
// narrower than Campaign / CampaignListItem — the home page shows tiles, not
// a command center, so we only pass what the rails need.
export interface PortfolioCampaign {
  id: string;
  wfNumber: string;
  name: string;
  status: CampaignStatus;
  lineOfBusiness: LineOfBusiness | null;
  assetsDeliveryDate: string | null;
  nextShootDate: string | null;
  hasBrief: boolean; // always false in Sprint 1 until Story 3 lands briefs
}

export interface BrandMarketingPortfolio {
  userId: string;
  inFlight: PortfolioCampaign[];
  nextInMarket: PortfolioCampaign[];
  awaitingApproval: []; // Story 4 fills this; typed-empty so the client shape is stable
  briefHealth: {
    total: number;
    withBrief: number;
    missing: { id: string; wfNumber: string; name: string }[];
  };
}

// Active (non-terminal) statuses — what a BMM thinks of as "in flight."
const ACTIVE_STATUSES: CampaignStatus[] = ["Planning", "Upcoming", "In Production", "Post"];

export async function getBrandMarketingPortfolio(
  userId: string,
  opts: { lob?: string } = {}
): Promise<BrandMarketingPortfolio> {
  const db = createAdminClient();

  const lobFilter = isLineOfBusiness(opts.lob) ? opts.lob : null;

  // Campaign rows (ownership enforced via filter since admin client bypasses RLS).
  let query = db
    .from("campaigns")
    .select("id, wf_number, name, status, line_of_business, assets_delivery_date")
    .eq("brand_owner_id", userId)
    .is("deleted_at", null);

  if (lobFilter) {
    query = query.eq("line_of_business", lobFilter);
  }

  const { data: campaignRows, error } = await query;
  if (error) throw error;

  const rows = campaignRows ?? [];
  const campaignIds = rows.map((r) => r.id as string);

  // Fetch shoot dates in one batch and roll up to the next upcoming per campaign.
  // shoots.campaign_id → shoot_dates.shoot_id; we inner-join in-app.
  const nextShootByCampaign = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: shootRows } = await db
      .from("shoots")
      .select("campaign_id, shoot_dates:shoot_dates(shoot_date)")
      .in("campaign_id", campaignIds);

    const todayIso = new Date().toISOString().slice(0, 10);
    for (const s of shootRows ?? []) {
      const cid = (s as any).campaign_id as string;
      const dates = ((s as any).shoot_dates ?? []) as { shoot_date: string }[];
      for (const d of dates) {
        if (!d.shoot_date || d.shoot_date < todayIso) continue;
        const existing = nextShootByCampaign.get(cid);
        if (!existing || d.shoot_date < existing) {
          nextShootByCampaign.set(cid, d.shoot_date);
        }
      }
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  const briefSummaries = await getBriefSummariesForCampaigns(campaignIds);

  const campaigns: PortfolioCampaign[] = rows.map((row: any) => ({
    id: row.id,
    wfNumber: row.wf_number,
    name: row.name,
    status: row.status,
    lineOfBusiness: isLineOfBusiness(row.line_of_business) ? row.line_of_business : null,
    assetsDeliveryDate: row.assets_delivery_date ?? null,
    nextShootDate: nextShootByCampaign.get(row.id) ?? null,
    hasBrief: briefSummaries.get(row.id)?.hasBrief ?? false,
  }));

  const inFlight = campaigns
    .filter((c) => ACTIVE_STATUSES.includes(c.status))
    .sort((a, b) => {
      // Nearest next shoot first; campaigns without a shoot date sink to the bottom.
      const aDate = a.nextShootDate ?? a.assetsDeliveryDate;
      const bDate = b.nextShootDate ?? b.assetsDeliveryDate;
      if (!aDate && !bDate) return a.name.localeCompare(b.name);
      if (!aDate) return 1;
      if (!bDate) return -1;
      return aDate.localeCompare(bDate);
    });

  const nextInMarket = campaigns
    .filter((c) => {
      if (!c.assetsDeliveryDate) return false;
      const d = new Date(c.assetsDeliveryDate);
      return d >= today && d <= thirtyDaysOut;
    })
    .sort((a, b) => (a.assetsDeliveryDate ?? "").localeCompare(b.assetsDeliveryDate ?? ""));

  const withBrief = inFlight.filter((c) => c.hasBrief).length;
  const missing = inFlight
    .filter((c) => !c.hasBrief)
    .map((c) => ({ id: c.id, wfNumber: c.wfNumber, name: c.name }));

  return {
    userId,
    inFlight,
    nextInMarket,
    awaitingApproval: [],
    briefHealth: { total: inFlight.length, withBrief, missing },
  };
}

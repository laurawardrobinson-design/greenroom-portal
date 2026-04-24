import { createAdminClient } from "@/lib/supabase/admin";
import { isLineOfBusiness, type LineOfBusiness } from "@/lib/constants/lines-of-business";
import { getBriefSummariesForCampaigns } from "@/lib/services/campaign-briefs.service";
import type { CampaignStatus, PRDepartment, PRDocStatus } from "@/types/domain";
import { PR_DEPARTMENTS } from "@/types/domain";

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

// ============================================================
// Horizon 1 — Next 2 weeks: shoots happening soon
// Horizon 3 — Future shoots the BMM needs to pre-brief RBU on
//
// Both views share one wire shape: a list of shoot-date rows with
// the campaign, PR status, and departments involved. The home page
// partitions the list into two horizons (imminent vs future) so
// the BMM can see what's happening now and what to raise at their
// next weekly RBU meeting.
// ============================================================

/**
 * Normalize campaign.line_of_business (e.g. "Meat & Seafood") into
 * the PR department taxonomy (e.g. "Meat-Seafood"). Returns null
 * for LOBs that don't map to a PR department (Health & Wellness,
 * Pharmacy) — those campaigns don't cross RBU.
 */
function lobToDepartment(lob: string | null): PRDepartment | null {
  if (!lob) return null;
  if (lob === "Meat & Seafood") return "Meat-Seafood";
  if (PR_DEPARTMENTS.includes(lob as PRDepartment)) return lob as PRDepartment;
  return null;
}

export interface BmmShootRow {
  shootDateId: string;
  shootDate: string; // ISO yyyy-mm-dd
  shootName: string;
  shootType: string;
  callTime: string | null;
  location: string;
  campaignId: string;
  wfNumber: string;
  campaignName: string;
  lineOfBusiness: LineOfBusiness | null;
  // Departments this shoot touches. Sourced from PR sections when a
  // PR exists; falls back to campaign LOB.
  departments: PRDepartment[];
  // Does this shoot hit the user's desk department? Pre-computed so
  // the UI doesn't need the user object.
  deskMatch: boolean;
  // PR state for this campaign + shoot date. "none" means no PR
  // exists yet — the key "RBU not consulted" signal for horizon 3.
  prStatus: PRDocStatus | "none";
  prDocId: string | null;
  prDocNumber: string | null;
}

export interface BmmShootsResponse {
  today: string; // ISO — for client-side relative formatting
  deskDepartment: PRDepartment | null;
  shoots: BmmShootRow[];
}

/**
 * Fetch every upcoming shoot date across the BMM's portfolio.
 * Returns everything >= today; the home page splits it into
 * horizons by date.
 */
export async function getBmmShoots(
  userId: string,
  deskDepartment: PRDepartment | null
): Promise<BmmShootsResponse> {
  const db = createAdminClient();

  const todayIso = new Date().toISOString().slice(0, 10);

  // 1. The BMM's active campaigns.
  const { data: campaignRows, error: campErr } = await db
    .from("campaigns")
    .select("id, wf_number, name, status, line_of_business")
    .eq("brand_owner_id", userId)
    .is("deleted_at", null)
    .in("status", ["Planning", "Upcoming", "In Production", "Post"]);
  if (campErr) throw campErr;

  const campaigns = campaignRows ?? [];
  const campaignIds = campaigns.map((c) => c.id as string);
  if (campaignIds.length === 0) {
    return { today: todayIso, deskDepartment, shoots: [] };
  }

  const campaignById = new Map(campaigns.map((c) => [c.id as string, c]));

  // 2. Shoots for those campaigns, so we can resolve campaign via shoot_id later.
  const { data: shootRows, error: shootErr } = await db
    .from("shoots")
    .select("id, campaign_id, name, shoot_type")
    .in("campaign_id", campaignIds);
  if (shootErr) throw shootErr;

  const shoots = shootRows ?? [];
  const shootById = new Map(shoots.map((s) => [s.id as string, s]));
  const shootIds = shoots.map((s) => s.id as string);
  if (shootIds.length === 0) {
    return { today: todayIso, deskDepartment, shoots: [] };
  }

  // 3. Future shoot dates only.
  const { data: dateRows, error: dateErr } = await db
    .from("shoot_dates")
    .select("id, shoot_id, shoot_date, call_time, location")
    .in("shoot_id", shootIds)
    .gte("shoot_date", todayIso)
    .order("shoot_date", { ascending: true });
  if (dateErr) throw dateErr;

  const dates = dateRows ?? [];
  if (dates.length === 0) {
    return { today: todayIso, deskDepartment, shoots: [] };
  }

  // 4. PR docs keyed by campaign_id + shoot_date. Drafts are the
  //    Producer's private WIP — BMM only sees PRs once submitted.
  //    Cancelled docs are archaeology, not "consulted RBU yet."
  const { data: prRows, error: prErr } = await db
    .from("product_request_docs")
    .select("id, doc_number, campaign_id, shoot_date, status")
    .in("campaign_id", campaignIds)
    .not("status", "in", "(draft,cancelled)");
  if (prErr) throw prErr;

  const prByKey = new Map<
    string,
    { id: string; docNumber: string; status: PRDocStatus }
  >();
  for (const pr of prRows ?? []) {
    const key = `${pr.campaign_id}__${pr.shoot_date}`;
    prByKey.set(key, {
      id: pr.id as string,
      docNumber: pr.doc_number as string,
      status: pr.status as PRDocStatus,
    });
  }

  // 5. Dept sections for the PRs we matched — drives the "departments
  //    involved" chips for shoots that already have a PR.
  const prDocIds = [...prByKey.values()].map((p) => p.id);
  const deptsByDocId = new Map<string, Set<PRDepartment>>();
  if (prDocIds.length > 0) {
    const { data: sectionRows } = await db
      .from("product_request_dept_sections")
      .select("doc_id, department")
      .in("doc_id", prDocIds);
    for (const row of sectionRows ?? []) {
      const docId = row.doc_id as string;
      const dept = row.department as PRDepartment;
      if (!deptsByDocId.has(docId)) deptsByDocId.set(docId, new Set());
      deptsByDocId.get(docId)!.add(dept);
    }
  }

  // 6. Assemble the rows.
  const rows: BmmShootRow[] = dates
    .map((d): BmmShootRow | null => {
      const shoot = shootById.get(d.shoot_id as string);
      if (!shoot) return null;
      const campaign = campaignById.get(shoot.campaign_id as string);
      if (!campaign) return null;

      const key = `${campaign.id}__${d.shoot_date}`;
      const pr = prByKey.get(key) ?? null;

      const fallbackDept = lobToDepartment(campaign.line_of_business as string);
      const deptSet = pr ? deptsByDocId.get(pr.id) ?? new Set<PRDepartment>() : new Set<PRDepartment>();
      if (deptSet.size === 0 && fallbackDept) deptSet.add(fallbackDept);
      const departments = Array.from(deptSet);

      const deskMatch =
        deskDepartment !== null && departments.includes(deskDepartment);

      return {
        shootDateId: d.id as string,
        shootDate: d.shoot_date as string,
        shootName: (shoot.name as string) || "",
        shootType: (shoot.shoot_type as string) || "Photo",
        callTime: (d.call_time as string) || null,
        location: (d.location as string) || "",
        campaignId: campaign.id as string,
        wfNumber: campaign.wf_number as string,
        campaignName: campaign.name as string,
        lineOfBusiness: isLineOfBusiness(campaign.line_of_business)
          ? (campaign.line_of_business as LineOfBusiness)
          : null,
        departments,
        deskMatch,
        prStatus: pr ? pr.status : "none",
        prDocId: pr ? pr.id : null,
        prDocNumber: pr ? pr.docNumber : null,
      };
    })
    .filter((r): r is BmmShootRow => r !== null);

  return { today: todayIso, deskDepartment, shoots: rows };
}


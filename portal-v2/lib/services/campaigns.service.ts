import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Campaign,
  CampaignListItem,
  CampaignStatus,
  CampaignDeliverable,
  CampaignFinancials,
} from "@/types/domain";
import type { CreateCampaignInput, UpdateCampaignInput } from "@/lib/validation/campaigns.schema";

function toCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    wfNumber: row.wf_number as string,
    name: row.name as string,
    status: row.status as CampaignStatus,
    productionBudget: Number(row.production_budget) || 0,
    budgetPoolId: (row.budget_pool_id as string) || null,
    assetsDeliveryDate: (row.assets_delivery_date as string) || null,
    notes: row.notes as string,
    producerId: (row.producer_id as string) || null,
    createdBy: (row.created_by as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toCampaignListItem(row: Record<string, unknown>): CampaignListItem {
  return {
    ...toCampaign(row),
    nextShootDate: (row.next_shoot_date as string) || null,
    shootCount: Number(row.shoot_count) || 0,
    vendorCount: Number(row.vendor_count) || 0,
    shootsSummary: [],
    committed: 0,
    producerName: null,
    additionalFundsRequested: 0,
    additionalFundsApproved: 0,
  };
}

// --- List campaigns (enriched with shoot/vendor counts) ---
export async function listCampaigns(filters?: {
  status?: CampaignStatus;
  search?: string;
  vendorId?: string;
  userId?: string;
  role?: string;
  createdBy?: string;
}): Promise<CampaignListItem[]> {
  const db = createAdminClient();

  // Use enriched RPC for extra fields, but let the database do the filtering
  let query = db.rpc("get_campaigns_enriched");

  // Note: The RPC function returns all campaigns. To truly optimize, we'd need to
  // modify the RPC to accept filter parameters. For now, we apply filters client-side,
  // but in the future this should move to the database layer.
  const { data: allRows, error } = await query;
  if (error) throw error;

  let results = (allRows || []) as Record<string, unknown>[];

  // Filter out soft-deleted campaigns
  results = results.filter((r) => !r.deleted_at);

  // Apply filters in JS (TODO: move to RPC parameters for better performance)
  if (filters?.status) {
    results = results.filter((r) => r.status === filters.status);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    results = results.filter(
      (r) =>
        (r.name as string).toLowerCase().includes(s) ||
        (r.wf_number as string).toLowerCase().includes(s)
    );
  }
  if (filters?.createdBy) {
    results = results.filter((r) => r.created_by === filters.createdBy);
  }

  // Vendor: only see campaigns they're assigned to
  if (filters?.role === "Vendor" && filters?.vendorId) {
    const { data: assignedIds } = await db
      .from("campaign_vendors")
      .select("campaign_id")
      .eq("vendor_id", filters.vendorId)
      .eq("deleted_at", null);
    const ids = new Set((assignedIds || []).map((r) => r.campaign_id));
    results = results.filter((r) => ids.has(r.id as string));
  }

  // Studio: only see campaigns they're crew on (via shoot_crew)
  if (filters?.role === "Studio" && filters?.userId) {
    const { data: crewRows } = await db
      .from("shoot_crew")
      .select("shoot_id, shoots(campaign_id, deleted_at)")
      .eq("user_id", filters.userId);
    const ids = new Set(
      (crewRows || [])
        .filter((r) => {
          const shoot = (r as Record<string, unknown>).shoots as Record<string, unknown>;
          return !shoot?.deleted_at; // Only include non-deleted campaigns
        })
        .map((r) => ((r as Record<string, unknown>).shoots as Record<string, unknown>)?.campaign_id as string)
    );
    results = results.filter((r) => ids.has(r.id as string));
  }

  // Sort by created_at descending
  results.sort(
    (a, b) =>
      new Date(b.created_at as string).getTime() -
      new Date(a.created_at as string).getTime()
  );

  const items = results.map(toCampaignListItem);

  // Enrich with shoot summaries and committed amounts
  if (items.length > 0) {
    const campaignIds = items.map((c) => c.id);

    // Fetch shoots with dates for all campaigns
    const { data: shoots } = await db
      .from("shoots")
      .select("id, campaign_id, name, shoot_type, shoot_dates(shoot_date)")
      .in("campaign_id", campaignIds);

    // Fetch committed amounts (sum of estimate totals per campaign)
    const { data: vendorTotals } = await db
      .from("campaign_vendors")
      .select("campaign_id, estimate_total")
      .in("campaign_id", campaignIds)
      .not("status", "eq", "Rejected");

    // Build lookups
    const shootsByCampaign = new Map<string, typeof items[0]["shootsSummary"]>();
    for (const s of shoots || []) {
      const cid = s.campaign_id as string;
      if (!shootsByCampaign.has(cid)) shootsByCampaign.set(cid, []);
      const dates = ((s as Record<string, unknown>).shoot_dates as Array<{ shoot_date: string }>) || [];
      shootsByCampaign.get(cid)!.push({
        name: s.name || `${s.shoot_type} Shoot`,
        shootType: s.shoot_type as "Photo" | "Video" | "Hybrid" | "Other",
        dates: dates.map((d) => d.shoot_date).sort(),
      });
    }

    const committedByCampaign = new Map<string, number>();
    for (const v of vendorTotals || []) {
      const cid = v.campaign_id as string;
      committedByCampaign.set(cid, (committedByCampaign.get(cid) || 0) + (Number(v.estimate_total) || 0));
    }

    // Fetch producer names
    const producerIds = [...new Set(items.map((c) => c.producerId).filter(Boolean))] as string[];
    const producerMap = new Map<string, string>();
    if (producerIds.length > 0) {
      const { data: producers } = await db
        .from("users")
        .select("id, name")
        .in("id", producerIds);
      for (const p of producers || []) {
        producerMap.set(p.id, p.name);
      }
    }

    // Fetch budget requests (additional funds) per campaign
    const { data: budgetReqs } = await db
      .from("budget_requests")
      .select("campaign_id, amount, status")
      .in("campaign_id", campaignIds);

    const additionalFundsByCampaign = new Map<string, { requested: number; approved: number }>();
    for (const req of budgetReqs || []) {
      const cid = req.campaign_id as string;
      if (!additionalFundsByCampaign.has(cid)) {
        additionalFundsByCampaign.set(cid, { requested: 0, approved: 0 });
      }
      const entry = additionalFundsByCampaign.get(cid)!;
      const amount = Number(req.amount) || 0;
      if (req.status === "Pending") {
        entry.requested += amount;
      } else if (req.status === "Approved") {
        entry.approved += amount;
      }
    }

    for (const item of items) {
      item.shootsSummary = shootsByCampaign.get(item.id) || [];
      item.committed = committedByCampaign.get(item.id) || 0;
      item.producerName = producerMap.get(item.producerId || "") || null;
      const funds = additionalFundsByCampaign.get(item.id);
      item.additionalFundsRequested = funds?.requested || 0;
      item.additionalFundsApproved = funds?.approved || 0;
    }
  }

  return items;
}

// --- Get single campaign ---
export async function getCampaign(id: string): Promise<Campaign | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return toCampaign(data);
}

// --- Get deliverables for a campaign ---
export async function getDeliverables(
  campaignId: string
): Promise<CampaignDeliverable[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_deliverables")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    channel: row.channel,
    format: row.format,
    width: row.width,
    height: row.height,
    aspectRatio: row.aspect_ratio,
    quantity: row.quantity,
    notes: row.notes,
    assignedVendorId: row.assigned_vendor_id ?? null,
  }));
}

// --- Create campaign ---
export async function createCampaign(
  input: CreateCampaignInput,
  userId: string
): Promise<Campaign> {
  const db = createAdminClient();

  // Check for duplicate WF number if provided
  if (input.wfNumber) {
    const { data: existing, error: checkError } = await db
      .from("campaigns")
      .select("id")
      .eq("wf_number", input.wfNumber)
      .single();

    if (!checkError && existing) {
      throw new Error(
        `Campaign with WF number "${input.wfNumber}" already exists`
      );
    }
  }

  const { data, error } = await db
    .from("campaigns")
    .insert({
      wf_number: input.wfNumber,
      name: input.name,
      status: input.status,
      production_budget: input.productionBudget,
      budget_pool_id: input.budgetPoolId,
      assets_delivery_date: input.assetsDeliveryDate,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return toCampaign(data);
}

// --- Update campaign ---
export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput
): Promise<Campaign> {
  const db = createAdminClient();


  const updateData: Record<string, unknown> = {};
  if (input.wfNumber !== undefined) updateData.wf_number = input.wfNumber;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.productionBudget !== undefined)
    updateData.production_budget = input.productionBudget;
  if (input.budgetPoolId !== undefined)
    updateData.budget_pool_id = input.budgetPoolId;
  if (input.assetsDeliveryDate !== undefined)
    updateData.assets_delivery_date = input.assetsDeliveryDate;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if ((input as Record<string, unknown>).producerId !== undefined)
    updateData.producer_id = (input as Record<string, unknown>).producerId;

  const { data, error } = await db
    .from("campaigns")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toCampaign(data);
}

// --- Delete campaign (soft delete) ---
export async function deleteCampaign(id: string): Promise<{ campaignId: string; deletedAt: string }> {
  const db = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("campaigns")
    .update({ deleted_at: now })
    .eq("id", id)
    .select("id, deleted_at")
    .single();

  if (error) throw error;
  return {
    campaignId: data.id,
    deletedAt: data.deleted_at,
  };
}

// --- Restore campaign (admin only) ---
export async function restoreCampaign(id: string): Promise<Campaign> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("campaigns")
    .update({ deleted_at: null })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toCampaign(data);
}

// --- Duplicate campaign ---
export async function duplicateCampaign(
  id: string,
  userId: string
): Promise<Campaign> {
  const db = createAdminClient();
  const original = await getCampaign(id);
  if (!original) throw new Error("Campaign not found");

  const deliverables = await getDeliverables(id);

  // Get shoots and crew to copy
  const { data: shoots, error: shootsError } = await db
    .from("shoots")
    .select("*")
    .eq("campaign_id", id);
  if (shootsError) throw shootsError;

  // Get shoot crew assignments
  const { data: shootCrew, error: crewError } = await db
    .from("shoot_crew")
    .select("*")
    .in(
      "shoot_id",
      (shoots || []).map((s: any) => s.id)
    );
  if (crewError) throw crewError;

  const newCampaign = await createCampaign(
    {
      wfNumber: original.wfNumber ? `${original.wfNumber}-COPY` : "",
      name: `${original.name} (Copy)`,
      status: "Planning",
      productionBudget: original.productionBudget,
      budgetPoolId: original.budgetPoolId,
      assetsDeliveryDate: null,
      notes: original.notes,
    },
    userId
  );

  // Copy deliverables
  if (deliverables.length > 0) {
    await db.from("campaign_deliverables").insert(
      deliverables.map((d) => ({
        campaign_id: newCampaign.id,
        channel: d.channel,
        format: d.format,
        width: d.width,
        height: d.height,
        aspect_ratio: d.aspectRatio,
        quantity: d.quantity,
        notes: d.notes,
      }))
    );
  }

  // Copy shoots with dates and metadata
  const shootMap: Record<string, string> = {}; // Map old shoot ID to new shoot ID
  if (shoots && shoots.length > 0) {
    const newShoots = await db.from("shoots").insert(
      shoots.map((s: any) => ({
        campaign_id: newCampaign.id,
        name: s.name,
        shoot_type: s.shoot_type,
        location: s.location,
        notes: s.notes,
        crew_varies_by_day: s.crew_varies_by_day,
      }))
    ).select();

    if (newShoots.error) throw newShoots.error;

    // Create mapping of old to new shoot IDs
    shoots.forEach((oldShoot: any, index: number) => {
      if (newShoots.data && newShoots.data[index]) {
        shootMap[oldShoot.id] = (newShoots.data[index] as any).id;
      }
    });

    // Get shoot dates and copy them
    const { data: shootDates, error: datesError } = await db
      .from("shoot_dates")
      .select("*")
      .in("shoot_id", shoots.map((s: any) => s.id));
    if (datesError) throw datesError;

    if (shootDates && shootDates.length > 0) {
      await db.from("shoot_dates").insert(
        shootDates.map((sd: any) => ({
          shoot_id: shootMap[sd.shoot_id],
          shoot_date: sd.shoot_date,
          call_time: sd.call_time,
          location: sd.location,
          notes: sd.notes,
        }))
      );
    }

    // Copy shoot crew assignments
    if (shootCrew && shootCrew.length > 0) {
      await db.from("shoot_crew").insert(
        shootCrew.map((sc: any) => ({
          shoot_id: shootMap[sc.shoot_id],
          user_id: sc.user_id,
          role: sc.role,
        }))
      );
    }
  }

  return newCampaign;
}

// --- Get campaign financials ---
export async function getCampaignFinancials(
  campaignId: string
): Promise<CampaignFinancials> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("get_campaign_financials", {
    p_campaign_id: campaignId,
  });

  const campaign = await getCampaign(campaignId);
  const budget = campaign?.productionBudget || 0;

  if (error || !data || !data[0]) {
    return { committed: 0, spent: 0, budget, remaining: budget };
  }

  const committed = Number(data[0].committed) || 0;
  const spent = Number(data[0].spent) || 0;
  return { committed, spent, budget, remaining: budget - committed };
}


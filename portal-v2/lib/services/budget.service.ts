import { createAdminClient } from "@/lib/supabase/admin";
import type { BudgetPool, BudgetPoolSummary, BudgetRequest, CategorySpending } from "@/types/domain";

// --- Budget Pools ---
export async function listBudgetPools(): Promise<BudgetPoolSummary[]> {
  const db = createAdminClient();
  const { data: pools, error } = await db
    .from("budget_pools")
    .select("*")
    .order("period_start", { ascending: false });

  if (error) throw error;

  const summaries: BudgetPoolSummary[] = [];
  for (const pool of pools || []) {
    const remaining = await db.rpc("get_pool_remaining", { p_pool_id: pool.id });

    // Get allocated (sum of campaign budgets in this pool)
    const { data: campaigns } = await db
      .from("campaigns")
      .select("id, production_budget")
      .eq("budget_pool_id", pool.id);

    const allocated = (campaigns || []).reduce(
      (sum, c) => sum + Number(c.production_budget),
      0
    );

    // Aggregate committed & spent from vendor assignments across pool campaigns
    let committed = 0;
    let spent = 0;
    const campaignIds = (campaigns || []).map((c) => c.id);
    if (campaignIds.length > 0) {
      const COMMITTED_STATUSES = [
        "Estimate Approved",
        "PO Uploaded",
        "PO Signed",
        "Shoot Complete",
        "Invoice Submitted",
        "Invoice Pre-Approved",
        "Invoice Approved",
        "Paid",
      ];
      const { data: vendorRows } = await db
        .from("campaign_vendors")
        .select("estimate_total, payment_amount, status")
        .in("campaign_id", campaignIds)
        .in("status", COMMITTED_STATUSES);

      for (const v of vendorRows || []) {
        committed += Number(v.estimate_total) || 0;
        if (v.status === "Paid") {
          spent += Number(v.payment_amount) || 0;
        }
      }
    }

    summaries.push({
      id: pool.id,
      name: pool.name,
      periodStart: pool.period_start,
      periodEnd: pool.period_end,
      totalAmount: Number(pool.total_amount),
      createdAt: pool.created_at,
      updatedAt: pool.updated_at,
      allocated,
      committed,
      spent,
      remaining: Number(remaining.data) || Number(pool.total_amount) - allocated,
    });
  }

  return summaries;
}

export async function createBudgetPool(input: {
  name: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
}): Promise<BudgetPool> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("budget_pools")
    .insert({
      name: input.name,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      total_amount: input.totalAmount,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    totalAmount: Number(data.total_amount),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// --- Budget Requests (overages) ---
export async function listBudgetRequests(filters?: {
  status?: string;
  campaignId?: string;
}): Promise<BudgetRequest[]> {
  const db = createAdminClient();
  let query = db
    .from("budget_requests")
    .select("*, campaigns(name, wf_number), users!budget_requests_requested_by_fkey(name)")
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.campaignId) query = query.eq("campaign_id", filters.campaignId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    requestedBy: row.requested_by,
    amount: Number(row.amount),
    rationale: row.rationale,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    campaign: row.campaigns
      ? { id: row.campaign_id, name: row.campaigns.name, wfNumber: row.campaigns.wf_number } as never
      : undefined,
    requester: row.users ? { name: row.users.name } as never : undefined,
  }));
}

export async function createBudgetRequest(input: {
  campaignId: string;
  requestedBy: string;
  amount: number;
  rationale: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("budget_requests").insert({
    campaign_id: input.campaignId,
    requested_by: input.requestedBy,
    amount: input.amount,
    rationale: input.rationale,
  });
  if (error) throw error;
}

export async function decideBudgetRequest(input: {
  requestId: string;
  approved: boolean;
  reviewedBy: string;
  notes?: string;
}): Promise<void> {
  const db = createAdminClient();

  const { data: request, error: fetchErr } = await db
    .from("budget_requests")
    .select("campaign_id, amount")
    .eq("id", input.requestId)
    .single();

  if (fetchErr || !request) throw new Error("Request not found");

  // Update the request
  const { error } = await db
    .from("budget_requests")
    .update({
      status: input.approved ? "Approved" : "Declined",
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_notes: input.notes || "",
    })
    .eq("id", input.requestId);

  if (error) throw error;

  // If approved, increase campaign budget
  if (input.approved) {
    const { data: campaign } = await db
      .from("campaigns")
      .select("production_budget")
      .eq("id", request.campaign_id)
      .single();

    if (campaign) {
      await db
        .from("campaigns")
        .update({
          production_budget: Number(campaign.production_budget) + Number(request.amount),
        })
        .eq("id", request.campaign_id);
    }
  }
}

// --- Category Spending ---
export async function getCategorySpending(): Promise<CategorySpending[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("vendor_invoice_items")
    .select("category, amount");

  if (error) throw error;

  const totals: Record<string, number> = {};
  for (const row of data || []) {
    const cat = row.category as string;
    totals[cat] = (totals[cat] || 0) + Number(row.amount);
  }

  return Object.entries(totals)
    .map(([category, amount]) => ({ category: category as never, amount }))
    .sort((a, b) => b.amount - a.amount);
}

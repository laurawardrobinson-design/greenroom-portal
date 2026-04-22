import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/budget/analysis
 *
 * Returns comprehensive financial analysis data for HOP decision-making:
 * - Budget health (pool totals, committed, spent, remaining)
 * - Spend by category with estimate-vs-invoice variance
 * - Spend by vendor with campaign counts and estimate accuracy
 * - Campaign-level budget vs actual
 * - Quarterly spend trends
 * - Budget overage history
 */
export async function GET() {
  try {
    await requireRole(["Admin"]);
    const db = createAdminClient();

    // ── Parallel data fetch ──
    const [
      { data: pools },
      { data: campaigns },
      { data: vendorAssignments },
      { data: estimateItems },
      { data: invoiceItems },
      { data: budgetRequests },
      { data: shootDates },
    ] = await Promise.all([
      db.from("budget_pools").select("*").order("period_start", { ascending: false }),
      db.from("campaigns").select("id, wf_number, name, status, production_budget, budget_pool_id, created_at"),
      db.from("campaign_vendors")
        .select("id, campaign_id, vendor_id, status, estimate_total, invoice_total, payment_amount, payment_date, po_signed_at, created_at, vendors(id, company_name, category)")
        .neq("status", "Rejected"),
      db.from("vendor_estimate_items").select("id, campaign_vendor_id, category, amount"),
      db.from("vendor_invoice_items").select("id, invoice_id, category, amount, matched_estimate_item_id, flagged, vendor_invoices!inner(campaign_vendor_id)"),
      db.from("budget_requests").select("id, campaign_id, amount, status, reviewed_at, created_at"),
      db.from("shoot_dates").select("id, shoot_id, shoot_date, shoots!inner(campaign_id)"),
    ]);

    const allPools = pools || [];
    const allCampaigns = campaigns || [];
    const allVendorAssignments = (vendorAssignments || []) as any[];
    const allEstimateItems = (estimateItems || []) as any[];
    const allInvoiceItems = (invoiceItems || []) as any[];
    const allBudgetRequests = (budgetRequests || []) as any[];
    const allShootDates = (shootDates || []) as any[];

    // Build lookup: campaign_vendor_id → campaign_id
    const cvToCampaign = new Map<string, string>();
    const cvToVendor = new Map<string, { id: string; name: string; category: string }>();
    for (const va of allVendorAssignments) {
      cvToCampaign.set(va.id, va.campaign_id);
      cvToVendor.set(va.id, {
        id: va.vendor_id,
        name: va.vendors?.company_name || "Unknown",
        category: va.vendors?.category || "Other",
      });
    }

    // Build lookup: invoice_item → campaign_vendor_id
    const invoiceItemToCv = new Map<string, string>();
    for (const ii of allInvoiceItems) {
      invoiceItemToCv.set(ii.id, ii.vendor_invoices?.campaign_vendor_id);
    }

    // ── 1. Budget Health (pool-level) ──
    const COMMITTED_STATUSES = [
      "Estimate Approved", "PO Uploaded", "PO Signed", "Shoot Complete",
      "Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid",
    ];

    // Compute per-campaign EFC inline so it can be aggregated into pools.
    // EFC (Estimated Final Cost): for active campaigns, project the larger of
    // committed-to-date vs. budgeted (assumes uncommitted budget headroom is
    // still going to be spent). For complete campaigns, EFC = paid (it's done).
    const campaignEfc = new Map<string, number>();
    for (const c of allCampaigns) {
      const cVAs = allVendorAssignments.filter((va) => va.campaign_id === c.id);
      const cCommitted = cVAs
        .filter((va) => COMMITTED_STATUSES.includes(va.status))
        .reduce((s, va) => s + (Number(va.estimate_total) || 0), 0);
      const cPaid = cVAs
        .filter((va) => va.status === "Paid")
        .reduce((s, va) => s + (Number(va.payment_amount) || 0), 0);
      const budget = Number(c.production_budget) || 0;
      const efc = c.status === "Complete" ? cPaid : Math.max(cCommitted, budget);
      campaignEfc.set(c.id, efc);
    }

    const poolHealth = allPools.map((pool) => {
      const poolCampaigns = allCampaigns.filter((c) => c.budget_pool_id === pool.id);
      const poolCampaignIds = new Set(poolCampaigns.map((c) => c.id));
      const poolVAs = allVendorAssignments.filter((va) => poolCampaignIds.has(va.campaign_id));

      const allocated = poolCampaigns.reduce((s, c) => s + Number(c.production_budget), 0);
      const committed = poolVAs
        .filter((va) => COMMITTED_STATUSES.includes(va.status))
        .reduce((s, va) => s + (Number(va.estimate_total) || 0), 0);
      const invoiced = poolVAs
        .filter((va) => ["Invoice Submitted", "Invoice Pre-Approved", "Invoice Approved", "Paid"].includes(va.status))
        .reduce((s, va) => s + (Number(va.invoice_total) || 0), 0);
      const spent = poolVAs
        .filter((va) => va.status === "Paid")
        .reduce((s, va) => s + (Number(va.payment_amount) || 0), 0);
      const efc = poolCampaigns.reduce((s, c) => s + (campaignEfc.get(c.id) || 0), 0);

      return {
        id: pool.id,
        name: pool.name,
        periodStart: pool.period_start,
        periodEnd: pool.period_end,
        totalAmount: Number(pool.total_amount),
        allocated,
        committed,
        invoiced,
        spent,
        efc,
        remaining: Number(pool.total_amount) - allocated,
        campaignCount: poolCampaigns.length,
        utilizationPct: Number(pool.total_amount) > 0
          ? Math.round((allocated / Number(pool.total_amount)) * 100)
          : 0,
      };
    });

    // ── 2. Spend by Category ──
    // Estimates by category
    const estimateByCategory: Record<string, number> = {};
    for (const ei of allEstimateItems) {
      const cat = ei.category || "Other";
      estimateByCategory[cat] = (estimateByCategory[cat] || 0) + Number(ei.amount);
    }

    // Invoiced by category
    const invoiceByCategory: Record<string, number> = {};
    for (const ii of allInvoiceItems) {
      const cat = ii.category || "Other";
      invoiceByCategory[cat] = (invoiceByCategory[cat] || 0) + Number(ii.amount);
    }

    const allCategories = new Set([...Object.keys(estimateByCategory), ...Object.keys(invoiceByCategory)]);
    const categoryBreakdown = Array.from(allCategories)
      .map((category) => {
        const estimated = estimateByCategory[category] || 0;
        const invoiced = invoiceByCategory[category] || 0;
        const variance = invoiced - estimated;
        const variancePct = estimated > 0 ? Math.round((variance / estimated) * 100) : 0;
        // EFC for category: assume the higher of estimated or invoiced represents
        // where this category will land. No "budget" concept exists per category.
        const efc = Math.max(estimated, invoiced);
        return { category, estimated, invoiced, efc, variance, variancePct };
      })
      .sort((a, b) => b.invoiced - a.invoiced);

    // ── 3. Spend by Vendor ──
    const vendorSpend: Record<string, {
      id: string; name: string; category: string;
      estimateTotal: number; invoiceTotal: number; paidTotal: number;
      campaignIds: Set<string>; assignmentCount: number;
    }> = {};

    for (const va of allVendorAssignments) {
      const vendor = cvToVendor.get(va.id);
      if (!vendor) continue;
      if (!vendorSpend[vendor.id]) {
        vendorSpend[vendor.id] = {
          id: vendor.id, name: vendor.name, category: vendor.category,
          estimateTotal: 0, invoiceTotal: 0, paidTotal: 0,
          campaignIds: new Set(), assignmentCount: 0,
        };
      }
      const vs = vendorSpend[vendor.id];
      vs.assignmentCount++;
      vs.campaignIds.add(va.campaign_id);
      if (COMMITTED_STATUSES.includes(va.status)) {
        vs.estimateTotal += Number(va.estimate_total) || 0;
      }
      if (Number(va.invoice_total) > 0) {
        vs.invoiceTotal += Number(va.invoice_total) || 0;
      }
      if (va.status === "Paid") {
        vs.paidTotal += Number(va.payment_amount) || 0;
      }
    }

    const vendorBreakdown = Object.values(vendorSpend)
      .map((vs) => ({
        id: vs.id,
        name: vs.name,
        category: vs.category,
        estimateTotal: vs.estimateTotal,
        invoiceTotal: vs.invoiceTotal,
        paidTotal: vs.paidTotal,
        // EFC for vendor: take the largest of committed/invoiced/paid as the
        // landing total — captures both projected and actual spend.
        efc: Math.max(vs.estimateTotal, vs.invoiceTotal, vs.paidTotal),
        campaignCount: vs.campaignIds.size,
        assignmentCount: vs.assignmentCount,
        variance: vs.invoiceTotal - vs.estimateTotal,
        variancePct: vs.estimateTotal > 0
          ? Math.round(((vs.invoiceTotal - vs.estimateTotal) / vs.estimateTotal) * 100)
          : 0,
      }))
      .sort((a, b) => (b.paidTotal || b.invoiceTotal || b.estimateTotal) - (a.paidTotal || a.invoiceTotal || a.estimateTotal));

    // ── 4. Campaign Budget vs Actual ──
    const activeCampaigns = allCampaigns.filter(
      (c) => c.status !== "Complete" && c.status !== "Cancelled"
    );
    const completedCampaigns = allCampaigns.filter((c) => c.status === "Complete");

    const campaignAnalysis = allCampaigns
      .filter((c) => c.status !== "Cancelled")
      .map((c) => {
        const cVAs = allVendorAssignments.filter((va) => va.campaign_id === c.id);
        const committed = cVAs
          .filter((va) => COMMITTED_STATUSES.includes(va.status))
          .reduce((s, va) => s + (Number(va.estimate_total) || 0), 0);
        const invoiced = cVAs
          .filter((va) => Number(va.invoice_total) > 0)
          .reduce((s, va) => s + (Number(va.invoice_total) || 0), 0);
        const spent = cVAs
          .filter((va) => va.status === "Paid")
          .reduce((s, va) => s + (Number(va.payment_amount) || 0), 0);
        const budget = Number(c.production_budget);

        // Shoot day count for this campaign
        const campaignShootDates = allShootDates.filter(
          (sd: any) => sd.shoots?.campaign_id === c.id
        );

        const efc = campaignEfc.get(c.id) || 0;
        return {
          id: c.id,
          wfNumber: c.wf_number,
          name: c.name,
          status: c.status,
          budget,
          committed,
          invoiced,
          spent,
          efc,
          remaining: budget - committed,
          // Variance reframed to EFC vs. budget — that's the production-accountant
          // framing (forecast vs. plan), not history vs. plan.
          variancePct: budget > 0 ? Math.round(((efc - budget) / budget) * 100) : 0,
          vendorCount: cVAs.length,
          shootDays: campaignShootDates.length,
          costPerShootDay: campaignShootDates.length > 0
            ? Math.round((spent || committed) / campaignShootDates.length)
            : null,
        };
      })
      .sort((a, b) => b.budget - a.budget);

    // ── 5. Quarterly Spend Trend ──
    // Group paid amounts by quarter
    const quarterlySpend: Record<string, { estimated: number; invoiced: number; paid: number }> = {};
    for (const va of allVendorAssignments) {
      const dateStr = va.payment_date || va.po_signed_at || va.created_at;
      if (!dateStr) continue;
      const date = new Date(dateStr);
      const q = `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
      if (!quarterlySpend[q]) quarterlySpend[q] = { estimated: 0, invoiced: 0, paid: 0 };
      if (COMMITTED_STATUSES.includes(va.status)) {
        quarterlySpend[q].estimated += Number(va.estimate_total) || 0;
      }
      if (Number(va.invoice_total) > 0) {
        quarterlySpend[q].invoiced += Number(va.invoice_total) || 0;
      }
      if (va.status === "Paid") {
        quarterlySpend[q].paid += Number(va.payment_amount) || 0;
      }
    }

    const quarterlyTrend = Object.entries(quarterlySpend)
      .map(([quarter, data]) => ({ quarter, ...data }))
      .sort((a, b) => a.quarter.localeCompare(b.quarter));

    // ── 6. Budget Request / Overage Summary ──
    const overageSummary = {
      totalRequested: allBudgetRequests.reduce((s, r) => s + Number(r.amount), 0),
      totalApproved: allBudgetRequests
        .filter((r) => r.status === "Approved")
        .reduce((s, r) => s + Number(r.amount), 0),
      totalDeclined: allBudgetRequests
        .filter((r) => r.status === "Declined")
        .reduce((s, r) => s + Number(r.amount), 0),
      totalPending: allBudgetRequests
        .filter((r) => r.status === "Pending")
        .reduce((s, r) => s + Number(r.amount), 0),
      requestCount: allBudgetRequests.length,
      approvedCount: allBudgetRequests.filter((r) => r.status === "Approved").length,
      declinedCount: allBudgetRequests.filter((r) => r.status === "Declined").length,
    };

    // ── 7. Top-level summary ──
    const totalBudgeted = allPools.reduce((s, p) => s + Number(p.total_amount), 0);
    const totalAllocated = allCampaigns.reduce((s, c) => s + Number(c.production_budget), 0);
    const totalCommitted = allVendorAssignments
      .filter((va) => COMMITTED_STATUSES.includes(va.status))
      .reduce((s, va) => s + (Number(va.estimate_total) || 0), 0);
    const totalInvoiced = allVendorAssignments
      .filter((va) => Number(va.invoice_total) > 0)
      .reduce((s, va) => s + (Number(va.invoice_total) || 0), 0);
    const totalSpent = allVendorAssignments
      .filter((va) => va.status === "Paid")
      .reduce((s, va) => s + (Number(va.payment_amount) || 0), 0);

    const totalShootDays = allShootDates.length;
    const avgCostPerShootDay = totalShootDays > 0
      ? Math.round((totalSpent || totalCommitted) / totalShootDays)
      : null;

    // Vendor concentration: top 3 vendors as % of total
    const sortedVendors = [...vendorBreakdown].sort(
      (a, b) => (b.paidTotal || b.estimateTotal) - (a.paidTotal || a.estimateTotal)
    );
    const top3Spend = sortedVendors.slice(0, 3).reduce(
      (s, v) => s + (v.paidTotal || v.estimateTotal), 0
    );
    const vendorConcentrationPct = (totalSpent || totalCommitted) > 0
      ? Math.round((top3Spend / (totalSpent || totalCommitted)) * 100)
      : 0;

    const totalEfc = Array.from(campaignEfc.values()).reduce((s, v) => s + v, 0);

    return NextResponse.json({
      summary: {
        totalBudgeted,
        totalAllocated,
        totalCommitted,
        totalInvoiced,
        totalSpent,
        totalEfc,
        unallocated: totalBudgeted - totalAllocated,
        activeCampaignCount: activeCampaigns.length,
        completedCampaignCount: completedCampaigns.length,
        totalShootDays,
        avgCostPerShootDay,
        vendorConcentrationPct,
        estimateAccuracyPct: totalCommitted > 0
          ? Math.round(((totalInvoiced - totalCommitted) / totalCommitted) * 100)
          : 0,
      },
      poolHealth,
      categoryBreakdown,
      vendorBreakdown,
      campaignAnalysis,
      quarterlyTrend,
      overageSummary,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
